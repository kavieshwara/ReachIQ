import { supabaseAdmin } from "../utils/supabase.js";
import { interpolateTemplate, nowIso, sleep, withTimestampError } from "../utils/helpers.js";
import { prepareCampaignLeadOutreach } from "./outreachPreparationService.js";
import { getCampaignAutomationConfig, upsertCompatLeadPreparation } from "./campaignAutomationCompatService.js";
import { getActiveWhatsAppConnection } from "./whatsappConnectionService.js";
import { restoreQRSessionIfAvailable } from "./whatsappQRService.js";
import { sendUserTextMessage, sendUserVideoMessage } from "./whatsappService.js";
import { ensureDailyUsageWindow } from "../utils/dailyUsage.js";

function isMissingOutreachPreparationsTable(error) {
  const message = String(error?.message || "");
  return (
    message.includes("public.outreach_preparations") ||
    message.includes("relation \"public.outreach_preparations\" does not exist")
  );
}

async function updatePreparationSendState({ campaignId, campaignLeadId, payload }) {
  const { error } = await supabaseAdmin
    .from("outreach_preparations")
    .update({
      ...payload,
      updated_at: nowIso()
    })
    .eq("campaign_lead_id", campaignLeadId);

  if (error) {
    if (isMissingOutreachPreparationsTable(error)) {
      await upsertCompatLeadPreparation(campaignId, campaignLeadId, {
        ...payload,
        updated_at: nowIso()
      });
      return;
    }
    throw error;
  }
}

function finalizeOutboundCaption(value) {
  return String(value || "")
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/sample website\s*:?\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isReconnectableWhatsAppError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("QR WhatsApp session is not connected.") ||
    message.includes("No active WhatsApp connection found.") ||
    message.includes("ReachIQ could not restore the WhatsApp QR session in time.")
  );
}

export async function incrementMessageCount(userId) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;

  const normalizedProfile = await ensureDailyUsageWindow(profile);

  await supabaseAdmin
    .from("profiles")
    .update({ messages_sent_today: Number(normalizedProfile.messages_sent_today || 0) + 1 })
    .eq("id", userId);
}

export async function getLiveMessageAllowance(userId) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;

  const normalizedProfile = await ensureDailyUsageWindow(profile);
  const used = Number(normalizedProfile?.messages_sent_today || 0);
  const total = Number(normalizedProfile?.messages_limit || 0) + Number(normalizedProfile?.bonus_messages || 0);

  return {
    used,
    total,
    remaining: Math.max(total - used, 0)
  };
}

export async function getCampaignWithLeads(campaignId, userId) {
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("*, campaign_leads(*, leads(*))")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return campaign;
}

async function resolveCampaignConnection(userId) {
  const activeConnection = await getActiveWhatsAppConnection(userId);
  if (activeConnection?.status === "connected") {
    return activeConnection;
  }

  const restoredQr = await restoreQRSessionIfAvailable(userId).catch(() => null);
  if (restoredQr?.status === "connected") {
    return {
      provider_type: "qr",
      status: "connected",
      phone_number: restoredQr.phoneNumber,
      session_data: {
        socketUser: restoredQr.socketUser,
        restoredFromDisk: true
      }
    };
  }

  return activeConnection;
}

export async function processCampaignMessages({ campaignId, userId }) {
  const campaign = await getCampaignWithLeads(campaignId, userId);
  const automationConfig = await getCampaignAutomationConfig(campaignId);
  let awaitingReconnect = false;

  const activeConnection = await resolveCampaignConnection(userId);
  if (!activeConnection || activeConnection.status !== "connected") {
    await supabaseAdmin
      .from("campaigns")
      .update({ status: "awaiting_whatsapp", updated_at: nowIso() })
      .eq("id", campaignId);
    throw new Error("Connect WhatsApp before launching this campaign.");
  }

  const leads = (campaign.campaign_leads || []).filter((item) => item.status === "pending");

  for (const item of leads) {
    const allowance = await getLiveMessageAllowance(userId);
    if (allowance.used >= allowance.total) {
      await supabaseAdmin
        .from("campaign_leads")
        .update({ status: "failed", error_message: "Daily limit reached" })
        .eq("id", item.id);
      continue;
    }

    if (!String(item.leads?.phone || "").replace(/\D/g, "").trim()) {
      await supabaseAdmin
        .from("campaign_leads")
        .update({
          status: "failed",
          error_message: "Missing phone number"
        })
        .eq("id", item.id);

      await updatePreparationSendState({
        campaignId,
        campaignLeadId: item.id,
        payload: {
          user_id: userId,
          campaign_id: campaignId,
          campaign_lead_id: item.id,
          lead_id: item.lead_id,
          send_status: "failed",
          generation_error: "ReachIQ could not send this lead because the phone number is missing."
        }
      });

      await refreshCampaignMetrics(campaignId);
      continue;
    }

    try {
      const outreach = await prepareCampaignLeadOutreach({
        campaign,
        campaignLead: item,
        lead: item.leads
      });

      const personalizedMessage = finalizeOutboundCaption(
        outreach.personalizedMessage || interpolateTemplate(campaign.message_template, item.leads)
      );

      let response;
      const requiresVideoAssets = Boolean(campaign.require_video_assets ?? automationConfig?.requireVideoAssets);
      if (requiresVideoAssets && !outreach.videoUrl) {
        throw new Error("Website video capture is not configured yet for this campaign. Disable video assets or finish the capture pipeline first.");
      }

      if (outreach.videoUrl) {
        response = await sendUserVideoMessage({
          userId,
          toPhone: item.leads.phone,
          videoUrl: outreach.videoUrl,
          caption: personalizedMessage
        });
      } else {
        response = await sendUserTextMessage({
          userId,
          toPhone: item.leads.phone,
          messageText: personalizedMessage
        });
      }

      await supabaseAdmin
        .from("campaign_leads")
        .update({
          status: "sent",
          sent_at: nowIso(),
          error_message: response?.messages?.[0]?.id || null
        })
        .eq("id", item.id);

      await updatePreparationSendState({
        campaignId,
        campaignLeadId: item.id,
        payload: { send_status: "sent" }
      });

      await supabaseAdmin
        .from("leads")
        .update({ status: "contacted" })
        .eq("id", item.lead_id);

      await incrementMessageCount(userId);
      await refreshCampaignMetrics(campaignId);
      await sleep(Number(campaign.delay_seconds || 5) * 1000);
    } catch (error) {
      withTimestampError(`Campaign send failed for ${item.id}`, error);
      const reconnectableWhatsAppError = isReconnectableWhatsAppError(error);
      const surfacedMessage = reconnectableWhatsAppError
        ? "Reconnect WhatsApp in Connection Center, then click Launch again."
        : error.message;

      await supabaseAdmin
        .from("campaign_leads")
        .update({
          status: "failed",
          error_message: surfacedMessage
        })
        .eq("id", item.id);

      await updatePreparationSendState({
        campaignId,
        campaignLeadId: item.id,
        payload: {
          user_id: userId,
          campaign_id: campaignId,
          campaign_lead_id: item.id,
          lead_id: item.lead_id,
          send_status: "failed",
          generation_error: surfacedMessage
        }
      });

      if (reconnectableWhatsAppError) {
        awaitingReconnect = true;
        await supabaseAdmin
          .from("campaigns")
          .update({ status: "awaiting_whatsapp", updated_at: nowIso() })
          .eq("id", campaignId);
        await refreshCampaignMetrics(campaignId);
        break;
      }

      await refreshCampaignMetrics(campaignId);
    }
  }

  if (awaitingReconnect) {
    return;
  }

  await supabaseAdmin
    .from("campaigns")
    .update({ status: "completed", updated_at: nowIso() })
    .eq("id", campaignId);
}

export async function refreshCampaignMetrics(campaignId) {
  const { data: campaignLeads, error } = await supabaseAdmin
    .from("campaign_leads")
    .select("status")
    .eq("campaign_id", campaignId);

  if (error) throw error;

  const metrics = campaignLeads.reduce(
    (acc, item) => {
      acc.total_leads += 1;
      if (item.status === "sent") acc.sent_count += 1;
      if (item.status === "delivered") acc.delivered_count += 1;
      if (item.status === "read") acc.read_count += 1;
      if (item.status === "replied") acc.replied_count += 1;
      if (item.status === "failed") acc.failed_count += 1;
      return acc;
    },
    {
      total_leads: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      replied_count: 0,
      failed_count: 0
    }
  );

  await supabaseAdmin
    .from("campaigns")
    .update({
      ...metrics,
      updated_at: nowIso()
    })
    .eq("id", campaignId);
}
