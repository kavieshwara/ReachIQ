import { supabaseAdmin } from "../utils/supabase.js";
import { normalizeWhatsAppPhone, withTimestampError } from "../utils/helpers.js";
import { decryptSecret, getActiveWhatsAppConnection } from "./whatsappConnectionService.js";
import { releaseGeneratedWebsiteVideo } from "./videoCaptureService.js";
import {
  getQRSessionSnapshot,
  scheduleQRSessionRestore,
  tryRestoreQRSessionIfAvailable,
  sendQrTextMessage,
  sendQrVideoMessage
} from "./whatsappQRService.js";

function extractGeneratedVideoId(videoUrl) {
  try {
    const parsed = new URL(String(videoUrl || "").trim());
    const match = parsed.pathname.match(/\/preview-video\/([^/]+)$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function resolveActiveConnection(userId) {
  const connection = await getActiveWhatsAppConnection(userId);
  if (connection?.provider_type !== "qr" && connection?.status === "connected") {
    return connection;
  }

  if (connection?.provider_type === "qr") {
    const liveSnapshot = getQRSessionSnapshot(userId);
    if (liveSnapshot.status === "connected") {
      return connection;
    }
  }

  const restoredQr = await tryRestoreQRSessionIfAvailable(userId, {
    timeoutMs: 1500,
    reason: "whatsapp_service"
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

  if (connection?.provider_type === "qr") {
    scheduleQRSessionRestore(userId, { reason: "whatsapp_service_retry" });
    return connection
      ? {
          ...connection,
          status: "disconnected"
        }
      : null;
  }

  return connection ?? null;
}

export async function verifyWhatsAppCredentials(phoneNumberId, accessToken) {
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v18.0";
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=display_phone_number,verified_name`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || "Unable to verify WhatsApp credentials");
  }

  return data;
}

export async function sendMessage(phoneNumberId, accessToken, toPhone, messageText) {
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v18.0";
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizeWhatsAppPhone(toPhone),
      type: "text",
      text: {
        body: messageText
      }
    })
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || "Failed to send WhatsApp message");
  }

  return data;
}

export async function sendVideoMessage(phoneNumberId, accessToken, toPhone, videoUrl, caption = "") {
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v18.0";
  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizeWhatsAppPhone(toPhone),
      type: "video",
      video: {
        link: videoUrl,
        caption
      }
    })
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || "Failed to send WhatsApp video");
  }

  return data;
}

export async function sendTestMessage(profile, toPhone) {
  return sendUserTextMessage({
    userId: profile.id,
    toPhone,
    messageText: "ReachIQ test message: your WhatsApp connection is working."
  });
}

export async function persistWebhookStatus(payload) {
  const statuses = payload?.entry?.flatMap((entry) =>
    entry?.changes?.flatMap((change) => change?.value?.statuses || []) || []
  ) || [];

  for (const status of statuses) {
    try {
      const messageId = status.id;
      const mappedStatus = String(status.status || "").toLowerCase();
      const timestamp = status.timestamp ? new Date(Number(status.timestamp) * 1000).toISOString() : new Date().toISOString();
      const updateFields = {};

      if (mappedStatus === "delivered") updateFields.delivered_at = timestamp;
      if (mappedStatus === "read") updateFields.read_at = timestamp;

      if (Object.keys(updateFields).length) {
        await supabaseAdmin
          .from("campaign_leads")
          .update({
            ...updateFields,
            status: mappedStatus
          })
          .eq("error_message", messageId);
      }
    } catch (error) {
      withTimestampError("Webhook status persistence failed", error);
    }
  }
}

export async function sendUserTextMessage({ userId, toPhone, messageText }) {
  const connection = await resolveActiveConnection(userId);
  if (!connection || connection.status !== "connected") {
    throw new Error("No active WhatsApp connection found.");
  }

  if (connection.provider_type === "meta") {
    const accessToken = decryptSecret(connection.access_token_encrypted);
    if (!connection.phone_number_id || !accessToken) {
      throw new Error("Meta WhatsApp credentials are incomplete.");
    }
    return sendMessage(connection.phone_number_id, accessToken, toPhone, messageText);
  }

  return sendQrTextMessage(userId, toPhone, messageText);
}

export async function sendUserVideoMessage({ userId, toPhone, videoUrl, caption = "" }) {
  const connection = await resolveActiveConnection(userId);
  if (!connection || connection.status !== "connected") {
    throw new Error("No active WhatsApp connection found.");
  }

  const generatedVideoId = extractGeneratedVideoId(videoUrl);
  const cleanupVideo = async () => {
    if (!generatedVideoId) {
      return;
    }

    await releaseGeneratedWebsiteVideo(generatedVideoId, { removeStorage: true }).catch((error) => {
      console.warn(`[ReachIQ][video] could not clear generated video ${generatedVideoId} after send: ${error.message}`);
    });
  };

  if (connection.provider_type === "meta") {
    const accessToken = decryptSecret(connection.access_token_encrypted);
    if (!connection.phone_number_id || !accessToken) {
      throw new Error("Meta WhatsApp credentials are incomplete.");
    }
    const result = await sendVideoMessage(connection.phone_number_id, accessToken, toPhone, videoUrl, caption);
    await cleanupVideo();
    return result;
  }

  const result = await sendQrVideoMessage(userId, toPhone, videoUrl, caption);
  await cleanupVideo();
  return result;
}
