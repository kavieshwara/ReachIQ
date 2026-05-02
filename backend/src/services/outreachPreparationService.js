import { generatePersonalizedOutreachMessage } from "./geminiService.js";
import { generateWebsite, getGeneratedWebsitePreviewHtml, resolveGeneratedWebsitePreviewUrl } from "./websiteService.js";
import { captureGeneratedWebsiteVideo, isWebsiteVideoEnabled, resolveGeneratedWebsiteVideoUrl } from "./videoCaptureService.js";
import { interpolateTemplate, nowIso } from "../utils/helpers.js";
import { supabaseAdmin } from "../utils/supabase.js";
import {
  getCampaignAutomationConfig,
  getCompatLeadPreparation,
  listCompatLeadPreparations,
  upsertCompatLeadPreparation
} from "./campaignAutomationCompatService.js";

const DEFAULT_SERVICES_BY_NICHE = {
  cafe: [
    "Signature brews|Highlight the drinks and bites guests remember first.",
    "Reserve on WhatsApp|Turn casual Instagram or Maps visits into direct bookings fast.",
    "Visit guide|Make it easy to find the cafe, timings, and best seating moments."
  ],
  "car showroom": [
    "Featured inventory|Spotlight your bestselling cars with cleaner first impressions.",
    "Test drive booking|Let buyers request a visit without waiting for a callback.",
    "Finance enquiry|Capture interest from customers comparing loan and EMI options."
  ],
  "dental clinic": [
    "Treatment overview|Explain your key dental services in a calm, trustworthy layout.",
    "Doctor trust signals|Show credentials, comfort points, and why patients choose you.",
    "Appointment booking|Guide people straight into a WhatsApp consultation or visit."
  ],
  gym: [
    "Membership plans|Present the plans people ask about most in a simple way.",
    "Trainer highlights|Show the faces and expertise behind the fitness promise.",
    "WhatsApp enquiries|Move walk-ins and referrals into fast mobile conversations."
  ],
  hospital: [
    "Department spotlight|Help visitors find the right department quickly.",
    "Doctor access|Surface specialist availability and enquiry pathways clearly.",
    "Emergency contacts|Keep urgent numbers and directions easy to reach."
  ],
  restaurant: [
    "Menu moments|Feature the dishes that make people choose you over nearby options.",
    "Table booking|Turn interest into reservations with one clear action.",
    "WhatsApp ordering|Make takeaway and special requests feel effortless."
  ],
  salon: [
    "Service menu|Show your core treatments without clutter or confusion.",
    "Before and after trust|Present your style, results, and confidence points clearly.",
    "Quick appointment flow|Let clients book and ask questions from WhatsApp."
  ]
};

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isMissingOutreachPreparationsTable(error) {
  const message = String(error?.message || "");
  return (
    message.includes("public.outreach_preparations") ||
    message.includes("relation \"public.outreach_preparations\" does not exist")
  );
}

function inferServices(lead) {
  const nicheKey = normalizeKey(lead?.niche);
  const matched = Object.entries(DEFAULT_SERVICES_BY_NICHE).find(([key]) => nicheKey.includes(key));
  return (matched?.[1] || ["Business introduction", "Services overview", "WhatsApp enquiry"]).join(", ");
}

function inferTagline(lead) {
  const city = String(lead?.city || "").trim();
  const businessName = String(lead?.business_name || "").trim();
  const nicheKey = normalizeKey(lead?.niche);

  const nicheTaglines = {
    cafe: city
      ? `${businessName} deserves a warmer digital first impression for coffee lovers across ${city}.`
      : `${businessName} deserves a warmer digital first impression for coffee lovers nearby.`,
    "car showroom": city
      ? `${businessName} can now showcase its cars, finance options, and test-drive flow more confidently in ${city}.`
      : `${businessName} can now showcase its cars, finance options, and test-drive flow more confidently online.`,
    "dental clinic": city
      ? `${businessName} can earn patient trust earlier with a cleaner consultation and treatment experience in ${city}.`
      : `${businessName} can earn patient trust earlier with a cleaner consultation and treatment experience online.`,
    restaurant: city
      ? `${businessName} now has a sharper digital experience for guests deciding where to dine in ${city}.`
      : `${businessName} now has a sharper digital experience for guests deciding where to dine nearby.`,
    salon: city
      ? `${businessName} can now turn browsing clients in ${city} into bookings with a more polished online presence.`
      : `${businessName} can now turn browsing clients into bookings with a more polished online presence.`
  };

  const matched = Object.entries(nicheTaglines).find(([key]) => nicheKey.includes(key));
  if (matched?.[1]) {
    return matched[1];
  }

  if (city) {
    return `${businessName} now has a polished online presence for customers in ${city}.`;
  }

  return `${businessName} now has a polished online presence ready to share with new customers.`;
}

function buildFallbackMessage({ campaign, lead, websiteUrl }) {
  const base = interpolateTemplate(campaign.message_template, lead).trim();
  return base;
}

function sanitizeOutboundMessage(messageText) {
  return String(messageText || "")
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/sample website\s*:?\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildVideoFirstPitch(lead) {
  const businessName = String(lead?.business_name || "your business").trim();
  const city = String(lead?.city || "your city").trim();
  const niche = String(lead?.niche || "business").trim();

  const nicheAngle = {
    cafe: "show a warmer menu and reservation experience",
    restaurant: "present the menu, ambience, and booking flow more clearly",
    "dental clinic": "build stronger patient trust before the first call",
    gym: "show memberships and coaching in a more convincing way",
    salon: "turn browsing clients into appointment enquiries faster",
    "car showroom": "show inventory and test-drive intent more confidently"
  };

  const normalizedNiche = normalizeKey(niche);
  const matchedAngle = Object.entries(nicheAngle).find(([key]) => normalizedNiche.includes(key))?.[1]
    || "present the business more confidently online";

  return [
    `Hi ${businessName}, I recorded a quick demo video for your ${niche} in ${city} so you can see how ReachIQ could ${matchedAngle}.`,
    "It is a short personalised concept, not a generic sample, and it is designed to help you get more serious enquiries from mobile visitors.",
    "If you like the direction, reply here and I can build the full version for you."
  ].join("\n\n");
}

function enforceVideoFirstMessage(messageText, lead) {
  const normalized = sanitizeOutboundMessage(messageText)
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/sample website\s*:?\s*/gi, "")
    .replace(/reply yes.*$/gim, "")
    .replace(/want me to (share|send)( the)? (sample|link)\??/gi, "")
    .replace(/\bwebsite preview\b/gi, "short demo video")
    .replace(/\bwebsite sample\b/gi, "short demo video")
    .replace(/\bwebsite\b/gi, "online presence")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const fallback = buildVideoFirstPitch(lead);
  const cleaned = normalized.length >= 80
    ? fallback
    : fallback;

  if (cleaned.length > 900) {
    return `${cleaned.slice(0, 897).trim()}...`;
  }

  return cleaned;
}

function isRecoverableWebsiteGenerationError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("GitHub token permissions are too limited") ||
    message.includes("GitHub deployment is not configured") ||
    message.includes("Could not create GitHub repository") ||
    message.includes("Could not upload site HTML") ||
    message.includes("Could not enable GitHub Pages")
  );
}

function normalizePreparationAssetUrls(preparation) {
  if (!preparation) {
    return preparation;
  }

  const websiteLiveUrl = resolveGeneratedWebsitePreviewUrl({
    websiteId: preparation.generated_website_id,
    liveUrl: preparation.website_live_url
  });
  const videoUrl =
    preparation.video_status === "ready" || preparation.video_url
      ? resolveGeneratedWebsiteVideoUrl({
          videoId: preparation.campaign_lead_id,
          videoUrl: preparation.video_url
        })
      : "";

  return {
    ...preparation,
    website_live_url: websiteLiveUrl || null,
    video_url: videoUrl || null
  };
}

async function getCampaignPreparation(campaignId, campaignLeadId) {
  const { data, error } = await supabaseAdmin
    .from("outreach_preparations")
    .select("*")
    .eq("campaign_lead_id", campaignLeadId)
    .maybeSingle();

  if (error) {
    if (isMissingOutreachPreparationsTable(error)) {
      return getCompatLeadPreparation(campaignId, campaignLeadId);
    }
    throw error;
  }

  return data || null;
}

async function upsertPreparation(campaignId, campaignLeadId, payload) {
  const { data, error } = await supabaseAdmin
    .from("outreach_preparations")
    .upsert(
      {
        campaign_lead_id: campaignLeadId,
        ...payload,
        updated_at: nowIso()
      },
      { onConflict: "campaign_lead_id" }
    )
    .select()
    .single();

  if (error) {
    if (isMissingOutreachPreparationsTable(error)) {
      return upsertCompatLeadPreparation(campaignId, campaignLeadId, {
        ...payload,
        updated_at: nowIso()
      });
    }
    throw error;
  }

  return data;
}

async function resolveWebsiteTemplate(campaign, lead, preparation, automationConfig) {
  const preferredTemplateId =
    preparation?.website_template_id ||
    automationConfig?.websiteTemplateId ||
    campaign.website_template_id ||
    null;

  if (preferredTemplateId) {
    const { data, error } = await supabaseAdmin
      .from("website_templates")
      .select("*")
      .eq("id", preferredTemplateId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const niche = normalizeKey(lead?.niche);
  if (!niche) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("website_templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    (data || []).find((template) => normalizeKey(template.niche) === niche) ||
    (data || []).find((template) => niche.includes(normalizeKey(template.niche)) || normalizeKey(template.niche).includes(niche)) ||
    null
  );
}

async function ensureWebsitePrepared({ campaign, campaignLead, lead, preparation, automationConfig, shouldAutoGenerateAssets }) {
  if (!shouldAutoGenerateAssets) {
    const normalizedWebsiteUrl = resolveGeneratedWebsitePreviewUrl({
      websiteId: preparation.generated_website_id,
      liveUrl: preparation.website_live_url
    });
    return {
      preparation: await upsertPreparation(campaign.id, campaignLead.id, {
        ...preparation,
        website_status: "skipped",
        generated_website_id: preparation.generated_website_id || null,
        website_live_url: normalizedWebsiteUrl || null
      }),
      websiteUrl: normalizedWebsiteUrl,
      generatedWebsiteId: preparation.generated_website_id || null
    };
  }

  if (preparation.website_status === "ready" && (preparation.website_live_url || preparation.generated_website_id)) {
    const normalizedWebsiteUrl = resolveGeneratedWebsitePreviewUrl({
      websiteId: preparation.generated_website_id,
      liveUrl: preparation.website_live_url
    });

    const nextPreparation =
      normalizedWebsiteUrl && normalizedWebsiteUrl !== preparation.website_live_url
        ? await upsertPreparation(campaign.id, campaignLead.id, {
            ...preparation,
            user_id: campaign.user_id,
            campaign_id: campaign.id,
            lead_id: lead.id,
            website_live_url: normalizedWebsiteUrl
          })
        : preparation;

    return {
      preparation: nextPreparation,
      websiteUrl: normalizedWebsiteUrl,
      generatedWebsiteId: preparation.generated_website_id || null
    };
  }

  const template = await resolveWebsiteTemplate(campaign, lead, preparation, automationConfig);
  if (!template) {
    throw new Error(`No website template available for ${lead.niche || "this lead niche"}`);
  }

  await upsertPreparation(campaign.id, campaignLead.id, {
    ...preparation,
    user_id: campaign.user_id,
    campaign_id: campaign.id,
    lead_id: lead.id,
    website_template_id: template.id,
    website_status: "generating"
  });

  const generated = await generateWebsite({
    userId: campaign.user_id,
    leadId: lead.id,
    templateId: template.id,
    businessName: lead.business_name,
    phone: lead.phone,
    address: lead.address,
    city: lead.city,
    tagline: inferTagline(lead),
    services: inferServices(lead)
  });

  const nextPreparation = await upsertPreparation(campaign.id, campaignLead.id, {
    ...preparation,
    user_id: campaign.user_id,
    campaign_id: campaign.id,
    lead_id: lead.id,
    website_template_id: template.id,
    generated_website_id: generated.id,
    website_live_url: generated.live_url,
    website_status: "ready"
  });

  return {
    preparation: nextPreparation,
    websiteUrl: generated.live_url,
    generatedWebsiteId: generated.id
  };
}

async function ensureMessagePrepared({
  campaign,
  campaignLead,
  lead,
  preparation,
  websiteUrl,
  shouldAutoGenerateAssets,
  requiresVideoAssets
}) {
  if (preparation.message_status === "ready" && preparation.personalized_message) {
    let refreshedMessage = sanitizeOutboundMessage(preparation.personalized_message);
    if (requiresVideoAssets || shouldAutoGenerateAssets) {
      refreshedMessage = enforceVideoFirstMessage(refreshedMessage, lead);
    }

    if (refreshedMessage !== preparation.personalized_message) {
      const refreshedPreparation = await upsertPreparation(campaign.id, campaignLead.id, {
        ...preparation,
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        lead_id: lead.id,
        personalized_message: refreshedMessage,
        message_status: "ready"
      });

      return {
        preparation: refreshedPreparation,
        messageText: refreshedMessage
      };
    }

    return {
      preparation,
      messageText: refreshedMessage
    };
  }

  await upsertPreparation(campaign.id, campaignLead.id, {
    ...preparation,
    user_id: campaign.user_id,
    campaign_id: campaign.id,
    lead_id: lead.id,
    message_status: "generating"
  });

  let messageText = "";
  try {
    messageText = await generatePersonalizedOutreachMessage({
      businessName: lead.business_name,
      niche: lead.niche,
      city: lead.city,
      websiteUrl,
      baseTemplate: campaign.message_template,
      services: inferServices(lead),
      tagline: inferTagline(lead)
    });
  } catch (error) {
      messageText = buildFallbackMessage({ campaign, lead, websiteUrl });
    }

  messageText = sanitizeOutboundMessage(messageText);

  if (requiresVideoAssets || shouldAutoGenerateAssets) {
    messageText = enforceVideoFirstMessage(messageText, lead);
  }

  const nextPreparation = await upsertPreparation(campaign.id, campaignLead.id, {
    ...preparation,
    user_id: campaign.user_id,
    campaign_id: campaign.id,
    lead_id: lead.id,
    personalized_message: messageText,
    message_status: "ready",
    send_status: "ready"
  });

  return {
    preparation: nextPreparation,
    messageText
  };
}

async function ensureVideoPrepared({
  campaign,
  campaignLead,
  lead,
  preparation,
  websiteUrl,
  generatedWebsiteId,
  requiresVideoAssets
}) {
  if (!requiresVideoAssets) {
    return upsertPreparation(campaign.id, campaignLead.id, {
      ...preparation,
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      lead_id: lead.id,
      video_status: "skipped"
    });
  }

  if (!isWebsiteVideoEnabled()) {
    return upsertPreparation(campaign.id, campaignLead.id, {
      ...preparation,
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      lead_id: lead.id,
      video_status: "skipped",
      generation_error: "Website video capture is disabled in this environment."
    });
  }

  if (preparation.video_status === "ready" && preparation.video_url) {
    const normalizedVideoUrl = resolveGeneratedWebsiteVideoUrl({
      videoId: campaignLead.id,
      videoUrl: preparation.video_url
    });

    if (normalizedVideoUrl !== preparation.video_url) {
      return upsertPreparation(campaign.id, campaignLead.id, {
        ...preparation,
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        lead_id: lead.id,
        video_url: normalizedVideoUrl,
        generation_error: null
      });
    }

    return preparation;
  }

  if (!websiteUrl) {
    return upsertPreparation(campaign.id, campaignLead.id, {
      ...preparation,
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      lead_id: lead.id,
      video_status: "failed",
      generation_error: "Website video capture needs a generated website URL first."
    });
  }

  await upsertPreparation(campaign.id, campaignLead.id, {
    ...preparation,
    user_id: campaign.user_id,
    campaign_id: campaign.id,
    lead_id: lead.id,
    video_status: "generating"
  });

  const previewHtml = generatedWebsiteId
    ? await getGeneratedWebsitePreviewHtml(generatedWebsiteId).catch(() => "")
    : "";

  const captured = await captureGeneratedWebsiteVideo({
    videoId: campaignLead.id,
    previewUrl: websiteUrl,
    previewHtml
  });

  return upsertPreparation(campaign.id, campaignLead.id, {
    ...preparation,
    user_id: campaign.user_id,
    campaign_id: campaign.id,
    lead_id: lead.id,
    video_status: "ready",
    video_url: captured.videoUrl,
    generation_error: null
  });
}

export async function prepareCampaignLeadOutreach({ campaign, campaignLead, lead }) {
  const automationConfig = await getCampaignAutomationConfig(campaign.id);
  const shouldAutoGenerateAssets = Boolean(
    campaign.auto_generate_assets ??
      automationConfig?.autoGenerateAssets ??
      campaign.website_template_id ??
      automationConfig?.websiteTemplateId
  );
  const requiresVideoAssets = Boolean(
    campaign.require_video_assets ?? automationConfig?.requireVideoAssets
  );

  let preparation = await getCampaignPreparation(campaign.id, campaignLead.id);
  if (!preparation) {
    preparation = await upsertPreparation(campaign.id, campaignLead.id, {
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      lead_id: lead.id,
      website_template_id: automationConfig?.websiteTemplateId || campaign.website_template_id || null,
      website_status: shouldAutoGenerateAssets ? "pending" : "skipped",
      message_status: "pending",
      video_status: requiresVideoAssets ? "pending" : "skipped",
      send_status: "pending"
    });
  }

  try {
    let websitePrepared;
    try {
      websitePrepared = await ensureWebsitePrepared({
        campaign,
        campaignLead,
        lead,
        preparation,
        automationConfig,
        shouldAutoGenerateAssets
      });
      preparation = websitePrepared.preparation;
    } catch (error) {
      if (!isRecoverableWebsiteGenerationError(error)) {
        throw error;
      }

      preparation = await upsertPreparation(campaign.id, campaignLead.id, {
        ...preparation,
        user_id: campaign.user_id,
        campaign_id: campaign.id,
        lead_id: lead.id,
        website_status: "failed",
        generation_error: `${error.message} ReachIQ switched this lead to message-only mode so you can still test sending.`,
        website_live_url: null,
        generated_website_id: null
      });

      websitePrepared = {
        preparation,
        websiteUrl: "",
        generatedWebsiteId: null
      };
    }

    const messagePrepared = await ensureMessagePrepared({
      campaign,
      campaignLead,
      lead,
      preparation,
      websiteUrl: websitePrepared.websiteUrl,
      shouldAutoGenerateAssets,
      requiresVideoAssets
    });
    preparation = messagePrepared.preparation;

    preparation = await ensureVideoPrepared({
      campaign,
      campaignLead,
      lead,
      preparation,
      websiteUrl: websitePrepared.websiteUrl,
      generatedWebsiteId: websitePrepared.generatedWebsiteId,
      requiresVideoAssets
    });

    return {
      preparation,
      websiteUrl: websitePrepared.websiteUrl,
      personalizedMessage: messagePrepared.messageText,
      videoUrl: resolveGeneratedWebsiteVideoUrl({
        videoId: campaignLead.id,
        videoUrl: preparation.video_url
      })
    };
  } catch (error) {
    const failedPreparation = await upsertPreparation(campaign.id, campaignLead.id, {
      ...preparation,
      user_id: campaign.user_id,
      campaign_id: campaign.id,
      lead_id: lead.id,
      send_status: "failed",
      generation_error: error.message,
      website_status: preparation.website_status === "ready" ? preparation.website_status : "failed",
      message_status: preparation.message_status === "ready" ? preparation.message_status : "failed",
      video_status: requiresVideoAssets ? "failed" : preparation.video_status || "skipped"
    });

    throw Object.assign(new Error(error.message), { preparation: failedPreparation });
  }
}

export async function getCampaignPreparations(campaignId) {
  const { data, error } = await supabaseAdmin
    .from("outreach_preparations")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingOutreachPreparationsTable(error)) {
      const compatPreparations = await listCompatLeadPreparations(campaignId);
      const normalizedPreparations = [];

      for (const preparation of compatPreparations) {
        const normalizedPreparation = normalizePreparationAssetUrls(preparation);
        if (
          normalizedPreparation.website_live_url !== preparation.website_live_url ||
          normalizedPreparation.video_url !== preparation.video_url
        ) {
          await upsertCompatLeadPreparation(campaignId, preparation.campaign_lead_id, {
            website_live_url: normalizedPreparation.website_live_url,
            video_url: normalizedPreparation.video_url
          });
        }
        normalizedPreparations.push(normalizedPreparation);
      }

      return normalizedPreparations;
    }
    throw error;
  }

  return (data || []).map(normalizePreparationAssetUrls);
}
