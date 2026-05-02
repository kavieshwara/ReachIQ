import crypto from "node:crypto";
import { supabaseAdmin } from "../utils/supabase.js";
import { ensureStarterWebsiteTemplates } from "../data/starterWebsiteTemplates.js";

const FALLBACK_PRODUCTION_PREVIEW_BASE_URL = "https://reachiq-api.onrender.com";
const LEGACY_PREVIEW_HOST_PATTERNS = [
  /reachiq-hqzc\.onrender\.com/i,
  /localhost/i,
  /127\.0\.0\.1/i
];

function fillTemplate(template, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value || ""),
    template
  );
}

export function buildPreviewBaseUrl() {
  const explicitBase =
    process.env.WEBSITE_PREVIEW_BASE_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.API_PUBLIC_URL;

  if (explicitBase) {
    const normalized = explicitBase.replace(/\/$/, "");
    const looksLegacy = LEGACY_PREVIEW_HOST_PATTERNS.some((pattern) => pattern.test(normalized));
    if (!looksLegacy) {
      return normalized;
    }
  }

  if (process.env.NODE_ENV === "production") {
    return FALLBACK_PRODUCTION_PREVIEW_BASE_URL;
  }

  return `http://localhost:${process.env.PORT || 4001}`;
}

function normalizeServices(services) {
  return String(services || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

export function buildGeneratedWebsitePreviewUrl(websiteId) {
  return `${buildPreviewBaseUrl()}/preview/${websiteId}`;
}

export function resolveGeneratedWebsitePreviewUrl({ websiteId, liveUrl }) {
  if (websiteId) {
    return buildGeneratedWebsitePreviewUrl(websiteId);
  }

  const normalizedLiveUrl = String(liveUrl || "").trim();
  if (!normalizedLiveUrl) {
    return "";
  }

  try {
    const parsed = new URL(normalizedLiveUrl);
    const previewPath = parsed.pathname.replace(/^\/api\/websites(?=\/preview\/)/i, "");
    if (previewPath.startsWith("/preview/")) {
      return `${buildPreviewBaseUrl()}${previewPath}${parsed.search}`;
    }
  } catch {
    // Ignore invalid URLs and fall back to the stored value.
  }

  return normalizedLiveUrl;
}

export async function getGeneratedWebsitePreviewHtml(websiteId) {
  const { data, error } = await supabaseAdmin
    .from("generated_websites")
    .select("html_content")
    .eq("id", websiteId)
    .single();

  if (error) throw error;
  return data?.html_content || "";
}

export async function generateWebsite({
  userId,
  leadId,
  templateId,
  businessName,
  phone,
  address,
  city,
  tagline,
  services
}) {
  if (!templateId) {
    throw new Error("Choose a website template before generating.");
  }

  if (!businessName || !phone) {
    throw new Error("Business name and phone number are required to generate a website.");
  }

  await ensureStarterWebsiteTemplates();

  const { data: template, error } = await supabaseAdmin
    .from("website_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (error) throw error;

  const websiteId = crypto.randomUUID();
  const htmlContent = fillTemplate(template.html_content, {
    BUSINESS_NAME: businessName,
    PHONE: phone,
    ADDRESS: address,
    CITY: city,
    TAGLINE: tagline,
    SERVICES: normalizeServices(services),
    WHATSAPP_LINK: `https://wa.me/${String(phone).replace(/\D/g, "")}`
  });

  const previewUrl = buildGeneratedWebsitePreviewUrl(websiteId);

  const { data: record, error: insertError } = await supabaseAdmin
    .from("generated_websites")
    .insert({
      id: websiteId,
      user_id: userId,
      lead_id: leadId,
      template_id: templateId,
      business_name: businessName,
      phone,
      address,
      live_url: previewUrl,
      github_repo: null,
      html_content: htmlContent
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return record;
}
