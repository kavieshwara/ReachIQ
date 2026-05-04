import { messageQueue } from "../queues/messageQueue.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { nowIso } from "../utils/helpers.js";
import {
  listCompatLeadPreparations,
  upsertCompatLeadPreparation
} from "./campaignAutomationCompatService.js";

function isReconnectableWhatsAppError(message) {
  const text = String(message || "").trim();
  return (
    text.includes("QR WhatsApp session is not connected.") ||
    text.includes("No active WhatsApp connection found.") ||
    text.includes("ReachIQ could not restore the WhatsApp QR session in time.") ||
    text.includes("ReachIQ detected a stale WhatsApp QR session.") ||
    text.includes("Reconnect WhatsApp in Connection Center, then click Launch again.")
  );
}

function isMissingOutreachPreparationsTable(error) {
  const message = String(error?.message || "");
  return (
    message.includes("public.outreach_preparations") ||
    message.includes('relation "public.outreach_preparations" does not exist')
  );
}

async function resetReconnectBlockedLeadRows(campaignIds, userId) {
  if (!campaignIds.length) {
    return;
  }

  const { data: campaignLeadRows, error: campaignLeadError } = await supabaseAdmin
    .from("campaign_leads")
    .select("id, campaign_id, lead_id, status, error_message")
    .in("campaign_id", campaignIds);

  if (campaignLeadError) {
    throw campaignLeadError;
  }

  const reconnectBlockedLeadIds = (campaignLeadRows || [])
    .filter((row) => row.status === "failed" && isReconnectableWhatsAppError(row.error_message))
    .map((row) => row.id)
    .filter(Boolean);

  if (reconnectBlockedLeadIds.length) {
    const { error: resetLeadError } = await supabaseAdmin
      .from("campaign_leads")
      .update({
        status: "pending",
        error_message: null
      })
      .in("id", reconnectBlockedLeadIds);

    if (resetLeadError) {
      throw resetLeadError;
    }
  }

  const reconnectBlockedPreparationLeadIds = new Set(reconnectBlockedLeadIds);

  const { data: preparations, error: preparationError } = await supabaseAdmin
    .from("outreach_preparations")
    .select("campaign_id, campaign_lead_id, send_status, generation_error")
    .in("campaign_id", campaignIds);

  if (preparationError) {
    if (isMissingOutreachPreparationsTable(preparationError)) {
      for (const campaignId of campaignIds) {
        const compatPreparations = await listCompatLeadPreparations(campaignId);
        for (const preparation of compatPreparations) {
          if (
            preparation?.campaign_lead_id &&
            preparation?.send_status === "failed" &&
            isReconnectableWhatsAppError(preparation?.generation_error)
          ) {
            reconnectBlockedPreparationLeadIds.add(preparation.campaign_lead_id);
            await upsertCompatLeadPreparation(campaignId, preparation.campaign_lead_id, {
              user_id: userId,
              campaign_id: campaignId,
              lead_id: preparation.lead_id,
              send_status: "pending",
              generation_error: null,
              updated_at: nowIso()
            });
          }
        }
      }
    } else {
      throw preparationError;
    }
  } else {
    const preparationLeadIds = (preparations || [])
      .filter(
        (preparation) =>
          preparation?.campaign_lead_id &&
          preparation?.send_status === "failed" &&
          isReconnectableWhatsAppError(preparation?.generation_error)
      )
      .map((preparation) => preparation.campaign_lead_id);

    for (const campaignLeadId of preparationLeadIds) {
      reconnectBlockedPreparationLeadIds.add(campaignLeadId);
    }

    if (preparationLeadIds.length) {
      const { error: resetPreparationError } = await supabaseAdmin
        .from("outreach_preparations")
        .update({
          send_status: "pending",
          generation_error: null,
          updated_at: nowIso()
        })
        .in("campaign_lead_id", preparationLeadIds);

      if (resetPreparationError) {
        throw resetPreparationError;
      }
    }
  }

  const pendingRowsToClear = (campaignLeadRows || [])
    .filter(
      (row) =>
        row.status === "pending" &&
        row.error_message &&
        isReconnectableWhatsAppError(row.error_message)
    )
    .map((row) => row.id)
    .filter(Boolean);

  if (pendingRowsToClear.length) {
    const { error: clearPendingLeadError } = await supabaseAdmin
      .from("campaign_leads")
      .update({
        error_message: null
      })
      .in("id", pendingRowsToClear);

    if (clearPendingLeadError) {
      throw clearPendingLeadError;
    }
  }
}

export async function queueCampaignProcessing(campaignId, userId, reason = "launch") {
  if (messageQueue) {
    await messageQueue.add(`campaign-${campaignId}-${reason}`, { campaignId, userId });
    return;
  }

  const { processCampaignMessages } = await import("./campaignService.js");
  void processCampaignMessages({ campaignId, userId }).catch((queueError) => {
    console.error(`[Campaign ${reason}] ${queueError.message}`);
  });
}

export async function resumeAwaitingWhatsAppCampaigns(userId, reason = "whatsapp_reconnected") {
  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "awaiting_whatsapp");

  if (error) {
    throw error;
  }

  const campaignIds = (campaigns || []).map((campaign) => campaign.id).filter(Boolean);
  if (!campaignIds.length) {
    return [];
  }

  await resetReconnectBlockedLeadRows(campaignIds, userId);

  const { error: updateError } = await supabaseAdmin
    .from("campaigns")
    .update({
      status: "running",
      updated_at: nowIso()
    })
    .in("id", campaignIds)
    .eq("user_id", userId);

  if (updateError) {
    throw updateError;
  }

  await Promise.all(
    campaignIds.map((campaignId) =>
      queueCampaignProcessing(campaignId, userId, reason)
    )
  );

  return campaignIds;
}

export async function pauseActiveCampaignsAwaitingWhatsApp(userId, reason = "whatsapp_disconnected") {
  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "running");

  if (error) {
    throw error;
  }

  const campaignIds = (campaigns || []).map((campaign) => campaign.id).filter(Boolean);
  if (!campaignIds.length) {
    return [];
  }

  const { error: updateError } = await supabaseAdmin
    .from("campaigns")
    .update({
      status: "awaiting_whatsapp",
      updated_at: nowIso()
    })
    .in("id", campaignIds)
    .eq("user_id", userId);

  if (updateError) {
    throw updateError;
  }

  console.warn(`[ReachIQ][campaigns] paused ${campaignIds.length} active campaign(s) for ${userId}: ${reason}`);
  return campaignIds;
}
