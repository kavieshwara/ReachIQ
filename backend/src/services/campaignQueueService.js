import { messageQueue } from "../queues/messageQueue.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { nowIso } from "../utils/helpers.js";

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
