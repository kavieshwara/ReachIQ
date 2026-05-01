import fs from "node:fs/promises";
import path from "node:path";
import boomModule from "../../node_modules/@hapi/boom/lib/index.js";
import * as baileysModule from "../../node_modules/@whiskeysockets/baileys/lib/index.js";
import QRCode from "../../node_modules/qrcode/lib/index.js";
import { normalizeWhatsAppPhone, nowIso } from "../utils/helpers.js";
import { disconnectWhatsAppProvider, getActiveWhatsAppConnection, saveWhatsAppConnection } from "./whatsappConnectionService.js";
import { getGeneratedWebsiteVideoFilePath } from "./videoCaptureService.js";

const { Boom } = boomModule;
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} = baileysModule;

const QR_EXPIRY_MS = 120000;
const SESSION_ROOT = path.resolve(process.cwd(), process.env.WHATSAPP_QR_SESSION_DIR || ".whatsapp-sessions");

const sessionSockets = new Map();
const sessionState = new Map();
const sessionQrTimers = new Map();
const qrSubscribers = new Map();
const sessionRestorePromises = new Map();

function getSessionDir(userId) {
  return path.join(SESSION_ROOT, String(userId));
}

function emitToSubscribers(userId, payload) {
  const subscribers = qrSubscribers.get(userId);
  if (!subscribers?.size) return;

  const eventName = payload.type || "message";
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of subscribers) {
    res.write(serialized);
  }
}

async function persistQrConnectionState(userId, patch = {}) {
  const snapshot = getQRSessionSnapshot(userId);
  await saveWhatsAppConnection({
    userId,
    providerType: "qr",
    status: patch.status || snapshot.status || "disconnected",
    phoneNumber: patch.phoneNumber ?? snapshot.phoneNumber ?? null,
    sessionData: {
      socketUser: patch.socketUser ?? snapshot.socketUser ?? null,
      ...(patch.sessionData || {})
    },
    lastActiveAt: patch.lastActiveAt ?? snapshot.lastActiveAt ?? null
  });
}

async function clearQrExpiry(userId) {
  const timer = sessionQrTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    sessionQrTimers.delete(userId);
  }
}

async function setQrExpired(userId) {
  const current = sessionState.get(userId);
  if (!current || current.status === "connected") return;

  const next = {
    ...current,
    status: "expired",
    qrImage: null,
    expiresAt: null,
    updatedAt: nowIso()
  };
  sessionState.set(userId, next);
  emitToSubscribers(userId, { type: "status", status: "expired" });
  await saveWhatsAppConnection({
    userId,
    providerType: "qr",
    status: "expired",
    phoneNumber: next.phoneNumber || null,
    sessionData: {
      lastSocketUser: next.socketUser || null
    },
    lastActiveAt: next.lastActiveAt || null
  });
}

function scheduleQrExpiry(userId) {
  clearQrExpiry(userId);
  const timer = setTimeout(() => {
    void setQrExpired(userId);
  }, QR_EXPIRY_MS);
  sessionQrTimers.set(userId, timer);
}

function setSessionState(userId, patch) {
  const previous = sessionState.get(userId) || {
    userId,
    status: "disconnected",
    qrImage: null,
    expiresAt: null,
    phoneNumber: null,
    lastActiveAt: null,
    socketUser: null,
    updatedAt: nowIso()
  };
  const next = {
    ...previous,
    ...patch,
    updatedAt: nowIso()
  };
  sessionState.set(userId, next);
  return next;
}

async function cleanupSessionFiles(userId) {
  const sessionDir = getSessionDir(userId);
  await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
}

async function hasSavedSessionFiles(userId) {
  const sessionDir = getSessionDir(userId);
  try {
    await fs.access(path.join(sessionDir, "creds.json"));
    return true;
  } catch {
    return false;
  }
}

export async function getStoredLinkedQrSessionInfo(userId) {
  const sessionDir = getSessionDir(userId);
  try {
    const raw = await fs.readFile(path.join(sessionDir, "creds.json"), "utf8");
    const creds = JSON.parse(raw);
    const socketUser = creds?.me?.id || null;
    const phoneNumber = normalizeWhatsAppPhone(String(socketUser || "").split(":")[0] || "");
    if (!socketUser || !phoneNumber) {
      return null;
    }

    return {
      socketUser,
      phoneNumber
    };
  } catch {
    return null;
  }
}

export function getQRSessionSnapshot(userId) {
  return sessionState.get(userId) || {
    userId,
    status: "disconnected",
    qrImage: null,
    expiresAt: null,
    phoneNumber: null,
    lastActiveAt: null,
    socketUser: null,
    updatedAt: nowIso()
  };
}

export async function disconnectQRSession(userId, { clearAuth = true } = {}) {
  const socket = sessionSockets.get(userId);
  if (socket) {
    try {
      await socket.logout();
    } catch {
      try {
        socket.end?.(new Error("ReachIQ QR disconnect"));
      } catch {
        // ignore
      }
    }
  }

  sessionSockets.delete(userId);
  await clearQrExpiry(userId);
  sessionState.delete(userId);
  await disconnectWhatsAppProvider(userId, "qr");

  if (clearAuth) {
    await cleanupSessionFiles(userId);
  }

  emitToSubscribers(userId, { type: "status", status: "disconnected" });
}

export async function restoreQRSessionIfAvailable(userId) {
  const existingSocket = sessionSockets.get(userId);
  if (existingSocket) {
    return getQRSessionSnapshot(userId);
  }

  const hasSavedSession = await hasSavedSessionFiles(userId);
  if (!hasSavedSession) {
    return null;
  }

  const existingRestore = sessionRestorePromises.get(userId);
  if (existingRestore) {
    await existingRestore;
    return getQRSessionSnapshot(userId);
  }

  const restorePromise = (async () => {
    const current = getQRSessionSnapshot(userId);
    if (current.status === "disconnected" || current.status === "expired") {
      setSessionState(userId, {
        status: "connecting",
        qrImage: null,
        expiresAt: null
      });
      emitToSubscribers(userId, { type: "status", status: "connecting" });
      await persistQrConnectionState(userId, {
        status: "connecting"
      }).catch((error) => {
        console.error(`[ReachIQ][qr] failed to persist restore state for ${userId}`, error);
      });
    }

    await buildSocket(userId, false);
  })();

  sessionRestorePromises.set(userId, restorePromise);

  try {
    await restorePromise;
  } finally {
    sessionRestorePromises.delete(userId);
  }

  return getQRSessionSnapshot(userId);
}

export async function restoreSavedQRSessionsOnBoot() {
  try {
    await fs.mkdir(SESSION_ROOT, { recursive: true });
    const entries = await fs.readdir(SESSION_ROOT, { withFileTypes: true });
    const userIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    for (const userId of userIds) {
      try {
        await restoreQRSessionIfAvailable(userId);
      } catch (error) {
        console.error(`[ReachIQ][qr] failed to restore saved session for ${userId}`, error);
      }
    }
  } catch (error) {
    console.error("[ReachIQ][qr] failed to scan saved WhatsApp sessions on boot", error);
  }
}

async function buildSocket(userId, forceFresh = false) {
  const sessionDir = getSessionDir(userId);
  if (forceFresh) {
    await cleanupSessionFiles(userId);
  }

  await fs.mkdir(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    browser: ["ReachIQ", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", (...args) => {
    Promise.resolve(saveCreds(...args)).catch((error) => {
      console.error(`[ReachIQ][qr] creds.update save failed for ${userId}`, error);
    });
  });
  sessionSockets.set(userId, sock);

  sock.ev.on("connection.update", async (update) => {
    try {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        const qrImage = await QRCode.toDataURL(qr, {
          margin: 1,
          width: 320,
          color: {
            dark: "#0A0A0F",
            light: "#FFFFFF"
          }
        });
        const expiresAt = Date.now() + QR_EXPIRY_MS;
        const snapshot = setSessionState(userId, {
          status: "waiting_for_scan",
          qrImage,
          expiresAt,
          phoneNumber: null
        });
        scheduleQrExpiry(userId);
        emitToSubscribers(userId, {
          type: "qr",
          status: "waiting_for_scan",
          qrImage,
          expiresAt,
          expiresIn: Math.floor(QR_EXPIRY_MS / 1000)
        });
        await persistQrConnectionState(userId, {
          status: "waiting_for_scan",
          phoneNumber: snapshot.phoneNumber || null,
          sessionData: { expiresAt }
        });
      }

      if (connection === "connecting") {
        setSessionState(userId, { status: "connecting" });
        emitToSubscribers(userId, { type: "status", status: "connecting" });
        await persistQrConnectionState(userId, {
          status: "connecting",
          sessionData: {}
        });
      }

      if (connection === "open") {
        const snapshotBeforeSave = getQRSessionSnapshot(userId);
        const socketUser = sock.user?.id || snapshotBeforeSave.socketUser || "";
        const phoneNumber = normalizeWhatsAppPhone(
          socketUser.split(":")[0] || snapshotBeforeSave.phoneNumber || ""
        );
        const activeAt = nowIso();

        setSessionState(userId, {
          status: "connected",
          qrImage: null,
          expiresAt: null,
          phoneNumber: phoneNumber || snapshotBeforeSave.phoneNumber || null,
          socketUser: socketUser || snapshotBeforeSave.socketUser || null,
          lastActiveAt: activeAt
        });
        await clearQrExpiry(userId);
        await persistQrConnectionState(userId, {
          status: "connected",
          phoneNumber: phoneNumber || snapshotBeforeSave.phoneNumber || null,
          socketUser: socketUser || snapshotBeforeSave.socketUser || null,
          lastActiveAt: activeAt
        });
        const snapshot = getQRSessionSnapshot(userId);
        emitToSubscribers(userId, {
          type: "connected",
          status: "connected",
          phoneNumber: snapshot.phoneNumber,
          lastActiveAt: snapshot.lastActiveAt
        });
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode;
        const shouldLogout = statusCode === DisconnectReason.loggedOut;
        const shouldRestart = statusCode === DisconnectReason.restartRequired;

        sessionSockets.delete(userId);
        await clearQrExpiry(userId);

        if (shouldLogout) {
          await disconnectQRSession(userId, { clearAuth: true });
          emitToSubscribers(userId, { type: "status", status: "disconnected" });
          return;
        }

        if (shouldRestart) {
          setSessionState(userId, {
            status: "connecting",
            qrImage: null,
            expiresAt: null
          });
          emitToSubscribers(userId, { type: "status", status: "connecting" });
          await persistQrConnectionState(userId, {
            status: "connecting"
          });

          setTimeout(() => {
            void buildSocket(userId, false).catch((error) => {
              console.error(`[ReachIQ][qr] restart required reconnect failed for ${userId}`, error);
            });
          }, 750);
          return;
        }

        const snapshot = setSessionState(userId, {
          status: "disconnected",
          qrImage: null,
          expiresAt: null
        });
        await persistQrConnectionState(userId, {
          status: "disconnected",
          phoneNumber: snapshot.phoneNumber || null,
          socketUser: snapshot.socketUser || null,
          lastActiveAt: snapshot.lastActiveAt || null
        });
        emitToSubscribers(userId, { type: "status", status: "disconnected" });
      }
    } catch (error) {
      console.error(`[ReachIQ][qr] connection.update failed for ${userId}`, error);
    }
  });

  return sock;
}

export async function startOrRestoreQRSession(userId, { forceFresh = false } = {}) {
  const activeConnection = await getActiveWhatsAppConnection(userId);
  if (activeConnection && activeConnection.provider_type === "meta" && activeConnection.status === "connected") {
    const error = new Error("Meta API is already connected. Disconnect it before using QR.");
    error.status = 409;
    throw error;
  }

  const existingSocket = sessionSockets.get(userId);
  if (existingSocket && !forceFresh) {
    return getQRSessionSnapshot(userId);
  }

  const existingRestore = sessionRestorePromises.get(userId);
  if (existingRestore && !forceFresh) {
    await existingRestore;
    return getQRSessionSnapshot(userId);
  }

  await buildSocket(userId, forceFresh);
  return getQRSessionSnapshot(userId);
}

export function addQRSubscriber(userId, res) {
  const subscribers = qrSubscribers.get(userId) || new Set();
  subscribers.add(res);
  qrSubscribers.set(userId, subscribers);
}

export function removeQRSubscriber(userId, res) {
  const subscribers = qrSubscribers.get(userId);
  if (!subscribers) return;
  subscribers.delete(res);
  if (!subscribers.size) {
    qrSubscribers.delete(userId);
  }
}

function ensureQrSocket(userId) {
  const sock = sessionSockets.get(userId);
  const snapshot = getQRSessionSnapshot(userId);
  if (!sock || snapshot.status !== "connected") {
    const error = new Error("QR WhatsApp session is not connected.");
    error.status = 409;
    throw error;
  }
  return sock;
}

async function waitForQrConnection(userId, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const sock = sessionSockets.get(userId);
    const snapshot = getQRSessionSnapshot(userId);
    if (sock && snapshot.status === "connected") {
      return sock;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const error = new Error("ReachIQ could not restore the WhatsApp QR session in time.");
  error.status = 409;
  throw error;
}

async function ensureConnectedQrSocket(userId) {
  try {
    return ensureQrSocket(userId);
  } catch {
    const stored = await getStoredLinkedQrSessionInfo(userId);
    if (!stored) {
      throw new Error("QR WhatsApp session is not connected.");
    }

    const current = getQRSessionSnapshot(userId);
    setSessionState(userId, {
      status: "connecting",
      phoneNumber: current.phoneNumber || stored.phoneNumber,
      socketUser: current.socketUser || stored.socketUser
    });
    await persistQrConnectionState(userId, {
      status: "connecting",
      phoneNumber: current.phoneNumber || stored.phoneNumber,
      socketUser: current.socketUser || stored.socketUser
    }).catch(() => null);
    await restoreQRSessionIfAvailable(userId);
    return waitForQrConnection(userId);
  }
}

async function resolveQrVideoPayload(videoUrl) {
  const raw = String(videoUrl || "").trim();
  if (!raw) {
    throw new Error("ReachIQ needs a generated video before it can send one over WhatsApp.");
  }

  try {
    const parsed = new URL(raw);
    const match = parsed.pathname.match(/\/preview-video\/([^/]+)$/i);
    if (match?.[1]) {
      const localVideoPath = getGeneratedWebsiteVideoFilePath(match[1]);
      await fs.access(localVideoPath);
      return { url: localVideoPath };
    }
  } catch {
    // If the value is not a URL, fall back to letting Baileys resolve it.
  }

  return { url: raw };
}

export async function sendQrTextMessage(userId, toPhone, messageText) {
  const sock = await ensureConnectedQrSocket(userId);
  const jid = `${normalizeWhatsAppPhone(toPhone)}@s.whatsapp.net`;
  const result = await sock.sendMessage(jid, { text: messageText });
  const activeAt = nowIso();
  setSessionState(userId, { lastActiveAt: activeAt });
  await saveWhatsAppConnection({
    userId,
    providerType: "qr",
    status: "connected",
    phoneNumber: getQRSessionSnapshot(userId).phoneNumber || null,
    sessionData: {
      socketUser: getQRSessionSnapshot(userId).socketUser || null
    },
    lastActiveAt: activeAt
  });
  return result;
}

export async function sendQrVideoMessage(userId, toPhone, videoUrl, caption = "") {
  const sock = await ensureConnectedQrSocket(userId);
  const jid = `${normalizeWhatsAppPhone(toPhone)}@s.whatsapp.net`;
  const videoPayload = await resolveQrVideoPayload(videoUrl);
  const result = await sock.sendMessage(jid, {
    video: videoPayload,
    caption
  });
  const activeAt = nowIso();
  setSessionState(userId, { lastActiveAt: activeAt });
  await saveWhatsAppConnection({
    userId,
    providerType: "qr",
    status: "connected",
    phoneNumber: getQRSessionSnapshot(userId).phoneNumber || null,
    sessionData: {
      socketUser: getQRSessionSnapshot(userId).socketUser || null
    },
    lastActiveAt: activeAt
  });
  return result;
}
