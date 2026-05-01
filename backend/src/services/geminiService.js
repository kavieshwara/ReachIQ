import { GoogleGenerativeAI } from "../../node_modules/@google/generative-ai/dist/index.js";
import { supabaseAdmin } from "../utils/supabase.js";

const geminiModelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const groqModelName = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const groqApiUrl = "https://api.groq.com/openai/v1/chat/completions";

function hasGroq() {
  return Boolean(process.env.GROQ_API_KEY);
}

function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getGeminiModel() {
  if (!hasGemini()) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client.getGenerativeModel({ model: geminiModelName });
}

async function generateWithGroq({ systemPrompt, messages, maxTokens = 320, temperature = 0.65 }) {
  if (!hasGroq()) {
    throw new Error("Missing GROQ_API_KEY");
  }

  const response = await fetch(groqApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: groqModelName,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function generateWithGemini(prompt) {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateWithFallback({ systemPrompt, messages, geminiPrompt, maxTokens, temperature }) {
  const errors = [];

  if (hasGroq()) {
    try {
      return await generateWithGroq({ systemPrompt, messages, maxTokens, temperature });
    } catch (error) {
      errors.push(`Groq: ${error.message}`);
      console.warn("[ReachIQ][llm] Groq failed, falling back", error.message);
    }
  }

  if (hasGemini()) {
    try {
      return await generateWithGemini(geminiPrompt);
    } catch (error) {
      errors.push(`Gemini: ${error.message}`);
      console.warn("[ReachIQ][llm] Gemini failed", error.message);
    }
  }

  throw new Error(errors.length ? errors.join(" | ") : "No AI provider is configured");
}

export async function generateChatResponse(userId, prompt) {
  const { data: history } = await supabaseAdmin
    .from("chat_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(12);

  const systemPrompt =
    "You are ReachIQ Assistant, an expert in WhatsApp outreach, lead generation, and local business pitching. You help freelancers and agency owners find clients, write better pitch messages, and use the ReachIQ platform. You know about real estate, dental clinics, restaurants, insurance, gyms, salons, and coaching businesses. Give practical, actionable advice. Keep responses concise. If asked about the platform, guide the user through the features. Never share harmful or spam advice.";

  const formattedHistory = (history || [])
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${entry.content}`)
    .join("\n");

  return generateWithFallback({
    systemPrompt,
    messages: [
      {
        role: "user",
        content: `Conversation so far:\n${formattedHistory || "No earlier conversation."}\n\nUser: ${prompt}`
      }
    ],
    geminiPrompt: `${systemPrompt}\n\nConversation so far:\n${formattedHistory || "No earlier conversation."}\n\nUser: ${prompt}`,
    maxTokens: 320,
    temperature: 0.55
  });
}

export async function warmProviders() {
  if (hasGroq()) {
    return;
  }

  if (hasGemini()) {
    getGeminiModel();
  }
}

export async function generatePersonalizedOutreachMessage({
  businessName,
  niche,
  city,
  websiteUrl,
  baseTemplate,
  services,
  tagline
}) {
  const systemPrompt = "You are ReachIQ Outreach Writer. Write concise, natural WhatsApp outreach copy for local businesses.";

  const prompt = [
    "You are ReachIQ Outreach Writer.",
    "Write a short WhatsApp message for a local business owner.",
    "Keep it under 420 characters.",
    "Sound natural, helpful, and professional.",
    "Mention that a short demo video has already been prepared.",
    "Do not include any website URL or raw link in the message.",
    "Invite them to reply if they want the full website or details.",
    "Avoid spammy wording, exaggerated promises, and emojis unless one fits naturally.",
    "",
    `Business name: ${businessName || "Unknown"}`,
    `Niche: ${niche || "Local business"}`,
    `City: ${city || "Unknown"}`,
    `Sample website context (do not include the URL): ${websiteUrl ? "Website preview exists" : "No preview available"}`,
    `Suggested services: ${services || "Not specified"}`,
    `Tagline idea: ${tagline || "Not specified"}`,
    `Base template: ${baseTemplate || "No base template provided"}`,
    "",
    "Return only the final message text."
  ].join("\n");

  return generateWithFallback({
    systemPrompt,
    messages: [{ role: "user", content: prompt }],
    geminiPrompt: prompt,
    maxTokens: 220,
    temperature: 0.7
  });
}
