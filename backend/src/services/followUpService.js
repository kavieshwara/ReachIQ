import { supabaseAdmin } from "../utils/supabase.js";
import { nowIso, withTimestampError } from "../utils/helpers.js";
import { getActiveWhatsAppConnection } from "./whatsappConnectionService.js";
import { getQRSessionSnapshot, scheduleQRSessionRestore, tryRestoreQRSessionIfAvailable } from "./whatsappQRService.js";
import { sendUserTextMessage } from "./whatsappService.js";
import { getLiveMessageAllowance, incrementMessageCount } from "./campaignService.js";

async function resolveFollowUpConnection(userId) {
  const activeConnection = await getActiveWhatsAppConnection(userId);
  if (activeConnection?.provider_type !== "qr" && activeConnection?.status === "connected") {
    return activeConnection;
  }

  if (activeConnection?.provider_type === "qr") {
    const liveSnapshot = getQRSessionSnapshot(userId);
    if (liveSnapshot.status === "connected") {
      return activeConnection;
    }
  }

  const restoredQr = await tryRestoreQRSessionIfAvailable(userId, {
    timeoutMs: 1500,
    reason: "followup_service"
  }).catch(() => null);
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

  if (activeConnection?.provider_type === "qr") {
    scheduleQRSessionRestore(userId, { reason: "followup_service_retry" });
  }

  return activeConnection;
}

export async function runDueFollowUps({ userId = null, followUpId = null, source = "app" } = {}) {
  const startedAt = new Date().toISOString();
  console.log(
    `[ReachIQ][follow-ups] run started`,
    JSON.stringify({ startedAt, source, userId, followUpId })
  );

  let query = supabaseAdmin
    .from("follow_ups")
    .select("*, leads(*)")
    .lte("scheduled_at", nowIso())
    .eq("sent", false);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (followUpId) {
    query = query.eq("id", followUpId);
  }

  const { data: dueFollowUps, error } = await query;

  if (error) throw error;

  const summary = {
    checked: dueFollowUps?.length || 0,
    sent: 0,
    skippedNoConnection: 0,
    skippedNoPhone: 0,
    skippedDailyLimit: 0,
    failed: 0
  };

  for (const item of dueFollowUps || []) {
    const connection = await resolveFollowUpConnection(item.user_id);
    if (!connection || connection.status !== "connected") {
      summary.skippedNoConnection += 1;
      continue;
    }

    if (!item.leads?.phone) {
      summary.skippedNoPhone += 1;
      continue;
    }

    try {
      const allowance = await getLiveMessageAllowance(item.user_id);
      if (allowance.used >= allowance.total) {
        summary.skippedDailyLimit += 1;
        await supabaseAdmin
          .from("follow_ups")
          .update({
            sent: false,
            sent_at: null
          })
          .eq("id", item.id);
        continue;
      }

      await sendUserTextMessage({
        userId: item.user_id,
        toPhone: item.leads.phone,
        messageText: item.message
      });
      await incrementMessageCount(item.user_id);
      await supabaseAdmin
        .from("follow_ups")
        .update({
          sent: true,
          sent_at: nowIso()
        })
        .eq("id", item.id);
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      withTimestampError(`Follow-up send failed for ${item.id}`, error);
    }
  }

  console.log(
    `[ReachIQ][follow-ups] run finished`,
    JSON.stringify({
      finishedAt: new Date().toISOString(),
      source,
      userId,
      followUpId,
      ...summary
    })
  );

  return summary;
}
