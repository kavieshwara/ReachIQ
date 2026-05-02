import crypto from "node:crypto";
import express from "express";
import { getAuthContextFromToken, requireAuth } from "../middleware/auth.js";
import { enforceMessageLimit } from "../middleware/planLimiter.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { followUpQueue } from "../queues/followUpQueue.js";
import { messageQueue } from "../queues/messageQueue.js";
import {
  disconnectWhatsAppProvider,
  getActiveWhatsAppConnection,
  getAllWhatsAppConnections,
  isMissingWhatsappConnectionsTableError,
  saveWhatsAppConnection,
  serializeConnectionForClient,
  setAllConnectionsDisconnected
} from "../services/whatsappConnectionService.js";
import {
  addQRSubscriber,
  disconnectQRSession,
  getQRSessionSnapshot,
  getStoredLinkedQrSessionInfo,
  removeQRSubscriber,
  restoreQRSessionIfAvailable,
  startOrRestoreQRSession
} from "../services/whatsappQRService.js";
import {
  persistWebhookStatus,
  sendTestMessage,
  verifyWhatsAppCredentials
} from "../services/whatsappService.js";
import { getDemoWhatsAppStatus, isDemoMode } from "../utils/demo.js";

const router = express.Router();

function buildQrStatusFromSnapshot(snapshot) {
  return {
    connected: snapshot.status === "connected",
    providerType: "qr",
    status: snapshot.status,
    phoneNumber: snapshot.phoneNumber || null,
    lastActiveAt: snapshot.lastActiveAt || null,
    sessionData: snapshot.socketUser ? { socketUser: snapshot.socketUser } : {},
    qrImage: snapshot.qrImage || null,
    expiresAt: snapshot.expiresAt || null
  };
}

function hasRecoverableQrConnection(connections = []) {
  return connections.some((connection) =>
    connection.provider_type === "qr" &&
    connection.status !== "waiting_for_scan" &&
    (connection.phone_number || connection.session_data?.socketUser)
  );
}

async function buildStoredQrRecoveredStatus(userId, connections = []) {
  const stored = await getStoredLinkedQrSessionInfo(userId);
  if (!stored) {
    return null;
  }

  try {
    const snapshot = await restoreQRSessionIfAvailable(userId);
    if (snapshot?.status === "connected" || snapshot?.status === "connecting" || snapshot?.status === "waiting_for_scan") {
      return {
        ...buildQrStatusFromSnapshot(snapshot),
        metaVerified: false,
        connections: connections.map(serializeConnectionForClient)
      };
    }
  } catch (error) {
    console.warn(`[ReachIQ][qr] could not restore QR connection for ${userId}: ${error.message}`);
  }

  return null;
}

async function buildStaleQrDisconnectedStatus(userId, connection, connections = []) {
  if (connection?.provider_type === "qr" && hasRecoverableQrConnection(connections)) {
    try {
      await disconnectWhatsAppProvider(userId, "qr");
    } catch (error) {
      console.warn(`[ReachIQ][qr] could not mark stale QR connection disconnected for ${userId}: ${error.message}`);
    }
  }

  return {
    connected: false,
    providerType: "qr",
    status: "disconnected",
    phoneNumber: connection?.phone_number || null,
    lastActiveAt: connection?.last_active_at || null,
    sessionData: {},
    qrImage: null,
    expiresAt: null,
    metaVerified: false,
    connections: connections.map(serializeConnectionForClient)
  };
}

async function connectMetaProvider(req, res) {
  if (isDemoMode) {
    return res.json({
      success: true,
      connection: {
        connected: true,
        providerType: "meta",
        status: "connected",
        phoneNumber: getDemoWhatsAppStatus().display_phone_number,
        phoneNumberId: req.body.phoneNumberId || getDemoWhatsAppStatus().phoneNumberId
      }
    });
  }

  const activeConnection = await getActiveWhatsAppConnection(req.user.id);
  if (activeConnection?.provider_type === "qr" && activeConnection.status === "connected") {
    return res.status(409).json({
      error: "QR connection is already active. Disconnect it before connecting Meta."
    });
  }

  const { phoneNumberId, accessToken } = req.body;
  if (!phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Phone Number ID and access token are required" });
  }

  const verified = await verifyWhatsAppCredentials(phoneNumberId, accessToken);
  await disconnectQRSession(req.user.id, { clearAuth: true }).catch(() => null);
  const saved = await saveWhatsAppConnection({
    userId: req.user.id,
    providerType: "meta",
    status: "connected",
    phoneNumber: verified.display_phone_number || null,
    phoneNumberId,
    accessToken,
    sessionData: {
      verifiedName: verified.verified_name || null
    },
    lastActiveAt: new Date().toISOString()
  });

  return res.json({
    success: true,
    connection: serializeConnectionForClient(saved),
    senderNumber: verified.display_phone_number || null,
    verifiedName: verified.verified_name || null
  });
}

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_APP_SECRET) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/webhook", express.json({ verify: verifyMetaSignature }), async (req, res, next) => {
  try {
    await persistWebhookStatus(req.body);
    if (followUpQueue) {
      await followUpQueue.add("sync-followups", {});
    }
    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

function verifyMetaSignature(req, res, buffer) {
  const signature = req.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!signature || !appSecret) return;

  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(buffer)
    .digest("hex")}`;

  if (expected !== signature) {
    const error = new Error("Invalid webhook signature");
    error.status = 401;
    throw error;
  }
}

router.get("/qr-stream", async (req, res) => {
  try {
    if (isDemoMode) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      });
      res.write(`event: connected\ndata: ${JSON.stringify({
        type: "connected",
        status: "connected",
        phoneNumber: getDemoWhatsAppStatus().display_phone_number,
        lastActiveAt: new Date().toISOString()
      })}\n\n`);
      return;
    }

    const token = String(req.query.token || "");
    if (!token) {
      return res.status(401).json({ error: "Missing session token" });
    }

    const authContext = await getAuthContextFromToken(token);
    const userId = authContext.user.id;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    addQRSubscriber(userId, res);
    const snapshot = getQRSessionSnapshot(userId);
    res.write(`event: snapshot\ndata: ${JSON.stringify({
      type: "snapshot",
      ...snapshot
    })}\n\n`);

    req.on("close", () => {
      removeQRSubscriber(userId, res);
      res.end();
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Could not open QR status stream"
    });
  }
});

router.use(requireAuth);

router.get("/status", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({
        connected: true,
        providerType: "meta",
        status: "connected",
        phoneNumber: getDemoWhatsAppStatus().display_phone_number,
        phoneNumberId: getDemoWhatsAppStatus().phoneNumberId,
        metaVerified: true,
        connections: [getDemoWhatsAppStatus()]
      });
    }

    const [activeConnection, allConnections] = await Promise.all([
      getActiveWhatsAppConnection(req.user.id),
      getAllWhatsAppConnections(req.user.id)
    ]);
    let qrSnapshot = getQRSessionSnapshot(req.user.id);

    if (
      qrSnapshot.status === "connected" ||
      qrSnapshot.status === "connecting" ||
      qrSnapshot.status === "waiting_for_scan"
    ) {
      return res.json({
        ...buildQrStatusFromSnapshot(qrSnapshot),
        metaVerified: false,
        connections: allConnections.map(serializeConnectionForClient)
      });
    }

    const storedQr = await buildStoredQrRecoveredStatus(req.user.id, allConnections);
    if (storedQr) {
      return res.json(storedQr);
    }

    if (activeConnection?.provider_type === "qr") {
      return res.json(await buildStaleQrDisconnectedStatus(req.user.id, activeConnection, allConnections));
    }

    const serialized = serializeConnectionForClient(activeConnection);
    res.json({
      ...serialized,
      metaVerified: Boolean(activeConnection?.provider_type === "meta" && activeConnection?.status === "connected"),
      connections: allConnections.map(serializeConnectionForClient)
    });
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.json({
        connected: false,
        providerType: "none",
        status: "disconnected",
        connections: [],
        migrationRequired: true,
        migrationMessage: "Run the whatsapp_connections SQL migration in Supabase before using the Connection Center."
      });
    }
    next(error);
  }
});

router.post("/qr/start", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({
        success: true,
        connection: {
          connected: true,
          providerType: "qr",
          status: "connected",
          phoneNumber: getDemoWhatsAppStatus().display_phone_number
        }
      });
    }

    const activeConnection = await getActiveWhatsAppConnection(req.user.id);
    if (activeConnection?.provider_type === "meta" && activeConnection.status === "connected") {
      return res.status(409).json({
        error: "Meta API is already connected. Disconnect it before starting QR connection."
      });
    }

    const snapshot = await startOrRestoreQRSession(req.user.id, {
      forceFresh: Boolean(req.body?.forceFresh)
    });

    res.json({
      success: true,
      connection: {
        providerType: "qr",
        status: snapshot.status,
        qrImage: snapshot.qrImage,
        expiresAt: snapshot.expiresAt,
        phoneNumber: snapshot.phoneNumber,
        lastActiveAt: snapshot.lastActiveAt
      }
    });
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.status(503).json({
        error: "WhatsApp connection storage is not installed yet. Run the whatsapp_connections migration in Supabase first."
      });
    }
    next(error);
  }
});

router.post("/qr/connect", async (req, res, next) => {
  try {
    const snapshot = await startOrRestoreQRSession(req.user.id, {
      forceFresh: Boolean(req.body?.forceFresh)
    });
    res.json({
      success: true,
      connection: {
        providerType: "qr",
        status: snapshot.status,
        qrImage: snapshot.qrImage,
        expiresAt: snapshot.expiresAt,
        phoneNumber: snapshot.phoneNumber,
        lastActiveAt: snapshot.lastActiveAt
      }
    });
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.status(503).json({
        error: "WhatsApp connection storage is not installed yet. Run the whatsapp_connections migration in Supabase first."
      });
    }
    next(error);
  }
});

router.get("/qr/status", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({
        providerType: "qr",
        status: "connected",
        phoneNumber: getDemoWhatsAppStatus().display_phone_number,
        connected: true
      });
    }

    const allConnections = await getAllWhatsAppConnections(req.user.id);
    let snapshot = getQRSessionSnapshot(req.user.id);
    const connection = await getActiveWhatsAppConnection(req.user.id);

    if (
      snapshot.status === "connected" ||
      snapshot.status === "connecting" ||
      snapshot.status === "waiting_for_scan"
    ) {
      return res.json(buildQrStatusFromSnapshot(snapshot));
    }

    const restored = await buildStoredQrRecoveredStatus(req.user.id, allConnections);
    if (restored) {
      return res.json(restored);
    }

    if (connection?.provider_type === "qr") {
      return res.json(await buildStaleQrDisconnectedStatus(req.user.id, connection, allConnections));
    }

    res.json({
      providerType: "qr",
      status: connection?.provider_type === "qr" ? connection.status : snapshot.status,
      connected: connection?.provider_type === "qr" && connection.status === "connected",
      phoneNumber: connection?.provider_type === "qr" ? connection.phone_number : snapshot.phoneNumber,
      qrImage: snapshot.qrImage,
      expiresAt: snapshot.expiresAt,
      lastActiveAt: connection?.provider_type === "qr" ? connection.last_active_at : snapshot.lastActiveAt
    });
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.json({
        providerType: "qr",
        status: "disconnected",
        connected: false,
        phoneNumber: null,
        qrImage: null,
        expiresAt: null,
        lastActiveAt: null,
        migrationRequired: true
      });
    }
    next(error);
  }
});

router.post("/qr/disconnect", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ success: true });
    }

    await disconnectQRSession(req.user.id, { clearAuth: true });
    res.json({ success: true });
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.status(503).json({
        error: "WhatsApp connection storage is not installed yet. Run the whatsapp_connections migration in Supabase first."
      });
    }
    next(error);
  }
});

router.post("/meta/verify", async (req, res, next) => {
  try {
    const { phoneNumberId, accessToken } = req.body;
    if (!phoneNumberId || !accessToken) {
      return res.status(400).json({ error: "Phone Number ID and access token are required" });
    }

    const verified = await verifyWhatsAppCredentials(phoneNumberId, accessToken);
    res.json({
      success: true,
      senderNumber: verified.display_phone_number || null,
      verifiedName: verified.verified_name || null,
      connection: verified
    });
  } catch (error) {
    next(error);
  }
});

router.post("/meta/connect", async (req, res, next) => {
  try {
    return await connectMetaProvider(req, res);
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.status(503).json({
        error: "WhatsApp connection storage is not installed yet. Run the whatsapp_connections migration in Supabase first."
      });
    }
    next(error);
  }
});

router.post("/meta/disconnect", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ success: true });
    }

    await disconnectWhatsAppProvider(req.user.id, "meta");
    res.json({ success: true });
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.status(503).json({
        error: "WhatsApp connection storage is not installed yet. Run the whatsapp_connections migration in Supabase first."
      });
    }
    next(error);
  }
});

router.post("/connect", async (req, res, next) => {
  try {
    return await connectMetaProvider(req, res);
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.status(503).json({
        error: "WhatsApp connection storage is not installed yet. Run the whatsapp_connections migration in Supabase first."
      });
    }
    next(error);
  }
});

router.post("/disconnect", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ success: true });
    }

    await setAllConnectionsDisconnected(req.user.id);
    await disconnectQRSession(req.user.id, { clearAuth: true }).catch(() => null);
    res.json({ success: true });
  } catch (error) {
    if (isMissingWhatsappConnectionsTableError(error)) {
      return res.status(503).json({
        error: "WhatsApp connection storage is not installed yet. Run the whatsapp_connections migration in Supabase first."
      });
    }
    next(error);
  }
});

router.post("/send", enforceMessageLimit, async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ success: true, id: `demo-msg-${Date.now()}` });
    }

    const { sendUserTextMessage } = await import("../services/whatsappService.js");
    const result = await sendUserTextMessage({
      userId: req.user.id,
      toPhone: req.body.toPhone,
      messageText: req.body.messageText
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/send-bulk", enforceMessageLimit, async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ success: true, queued: true });
    }

    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ error: "campaignId is required" });
    }

    if (messageQueue) {
      await messageQueue.add(`bulk-${campaignId}`, { campaignId, userId: req.user.id });
    }

    res.json({ success: true, queued: true });
  } catch (error) {
    next(error);
  }
});

router.post("/test-send", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ success: true, id: `demo-test-${Date.now()}` });
    }

    const result = await sendTestMessage(req.profile, req.body.toPhone || req.body.phone || "");
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
