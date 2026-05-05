import fs from "node:fs/promises";
import path from "node:path";
import boomModule from "../../node_modules/@hapi/boom/lib/index.js";
import * as baileysModule from "../../node_modules/@whiskeysockets/baileys/lib/index.js";
import pinoModule from "../../node_modules/pino/pino.js";
import QRCode from "../../node_modules/qrcode/lib/index.js";
import { normalizeWhatsAppPhone, nowIso } from "../utils/helpers.js";
import { supabaseAdmin } from "../utils/supabase.js";
import {
  decryptSecret,
  disconnectWhatsAppProvider,
  encryptSecret,
  getActiveWhatsAppConnection,
  saveWhatsAppConnection
} from "./whatsappConnectionService.js";
import {
  pauseActiveCampaignsAwaitingWhatsApp,
  resumeAwaitingWhatsAppCampaigns
} from "./campaignQueueService.js";
import { getGeneratedWebsiteVideoFilePath } from "./videoCaptureService.js";

const { Boom } = boomModule;
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} = baileysModule;
const pino = pinoModule.default ?? pinoModule;

const QR_EXPIRY_MS = 120000;
const SESSION_ROOT = path.resolve(process.cwd(), process.env.WHATSAPP_QR_SESSION_DIR || ".whatsapp-sessions");
const QR_SESSION_BACKUP_KEY_PREFIX = "qr_session_backup:";
const QR_CRYPTO_FAILURE_WINDOW_MS = 60_000;
const QR_CRYPTO_FAILURE_THRESHOLD = 6;
const QR_ROUTE_RESTORE_TIMEOUT_MS = Math.max(1000, Number(process.env.QR_ROUTE_RESTORE_TIMEOUT_MS || 2500));
const QR_RESTORE_RETRY_COOLDOWN_MS = Math.max(3000, Number(process.env.QR_RESTORE_RETRY_COOLDOWN_MS || 15000));
const QR_RECONNECT_STORM_WINDOW_MS = 120_000;
const QR_RECONNECT_STORM_THRESHOLD = 5;
const QR_SESSION_RECOVERY_MESSAGE = "ReachIQ detected a stale WhatsApp QR session. Refresh the QR session and reconnect WhatsApp.";
const QR_DEFAULT_QUERY_TIMEOUT_MS = Math.max(15_000, Number(process.env.WHATSAPP_DEFAULT_QUERY_TIMEOUT_MS || 60_000));
const QR_CONNECT_TIMEOUT_MS = Math.max(15_000, Number(process.env.WHATSAPP_CONNECT_TIMEOUT_MS || 30_000));
const ENABLE_QR_SESSION_BACKUP = String(process.env.ENABLE_QR_SESSION_BACKUP || "true").toLowerCase() === "true";
const ENABLE_QR_BACKGROUND_RESTORE = String(process.env.ENABLE_QR_BACKGROUND_RESTORE || "true").toLowerCase() === "true";

const sessionSockets = new Map();
const sessionState = new Map();
const sessionQrTimers = new Map();
const qrSubscribers = new Map();
const sessionRestorePromises = new Map();
const sessionBackupTimers = new Map();
const sessionCryptoFailures = new Map();
const sessionCredFlushPromises = new Map();
const scheduledSessionRestores = new Map();
const sessionLastRestoreAttemptAt = new Map();
const sessionReconnectStorms = new Map();
const baseBaileysLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || "error" });

class QrRestoreTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "QrRestoreTimeoutError";
  }
}

function isQrSessionCryptoError(errorLike) {
  const message = String(errorLike?.message || errorLike || "");
  return (
    message.includes("No matching sessions found for message") ||
    message.includes("Bad MAC") ||
    message.includes("Invalid PreKey ID") ||
    message.includes("failed to decrypt message") ||
    message.includes("MessageCounterError") ||
    message.includes("Key used already or never filled")
  );
}

function resetQrCryptoFailures(userId) {
  sessionCryptoFailures.delete(userId);
}

function resetQrReconnectStorm(userId) {
  sessionReconnectStorms.delete(userId);
}

function trackQrReconnectAttempt(userId) {
  const now = Date.now();
  const tracker = sessionReconnectStorms.get(userId) || {
    count: 0,
    firstAt: now
  };

  if (now - tracker.firstAt > QR_RECONNECT_STORM_WINDOW_MS) {
    tracker.count = 0;
    tracker.firstAt = now;
  }

  tracker.count += 1;
  sessionReconnectStorms.set(userId, tracker);
  return tracker.count >= QR_RECONNECT_STORM_THRESHOLD;
}

async function invalidatePoisonedQrSession(userId, reason) {
  const tracker = sessionCryptoFailures.get(userId) || {};
  if (tracker.disconnecting) {
    return;
  }

  sessionCryptoFailures.set(userId, {
    ...tracker,
    disconnecting: true
  });

  console.warn(`[ReachIQ][qr] invalidating poisoned WhatsApp QR session for ${userId}: ${reason}`);
  try {
    await persistSessionBackupWithRetry(userId, { attempts: 3, delayMs: 600 }).catch(() => false);
  } catch {
    // Best-effort backup only.
  }

  await disconnectQRSession(userId, { clearAuth: false }).catch((error) => {
    console.warn(`[ReachIQ][qr] failed to soft-reset poisoned session for ${userId}: ${error.message}`);
  });
  resetQrCryptoFailures(userId);
}

function recordQrCryptoFailure(userId, details = "") {
  const now = Date.now();
  const tracker = sessionCryptoFailures.get(userId) || {
    count: 0,
    firstAt: now,
    disconnecting: false
  };

  if (now - tracker.firstAt > QR_CRYPTO_FAILURE_WINDOW_MS) {
    tracker.count = 0;
    tracker.firstAt = now;
  }

  tracker.count += 1;
  sessionCryptoFailures.set(userId, tracker);

  if (tracker.disconnecting || tracker.count < QR_CRYPTO_FAILURE_THRESHOLD) {
    return;
  }

  void invalidatePoisonedQrSession(userId, details || "repeated session decrypt failures");
}

function wrapBaileysLogger(userId, logger) {
  return new Proxy(logger, {
    get(target, prop, receiver) {
      if (prop === "child") {
        return (...args) => wrapBaileysLogger(userId, target.child(...args));
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(logger) : value;
    }
  });
}

function getSessionDir(userId) {
  return path.join(SESSION_ROOT, String(userId));
}

function buildSessionBackupKey(userId) {
  return `${QR_SESSION_BACKUP_KEY_PREFIX}${userId}`;
}

async function clearScheduledSessionBackup(userId) {
  const timer = sessionBackupTimers.get(userId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  sessionBackupTimers.delete(userId);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    sleep(timeoutMs).then(() => {
      throw new QrRestoreTimeoutError(`${label} timed out after ${timeoutMs}ms`);
    })
  ]);
}

async function listSessionFilesRecursive(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSessionFilesRecursive(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

async function readStoredSessionBackup(userId) {
  if (!ENABLE_QR_SESSION_BACKUP) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("value")
    .eq("key", buildSessionBackupKey(userId))
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(data.value);
    const decrypted = decryptSecret(parsed?.payload);
    if (!decrypted) {
      return null;
    }

    const restored = JSON.parse(decrypted);
    if (
      !restored?.files ||
      typeof restored.files !== "object" ||
      !Object.prototype.hasOwnProperty.call(restored.files, "creds.json")
    ) {
      return null;
    }

    return restored;
  } catch (error) {
    console.warn(`[ReachIQ][qr] clearing invalid stored session backup for ${userId}: ${error.message}`);
    await clearStoredSessionBackup(userId).catch((cleanupError) => {
      console.warn(`[ReachIQ][qr] could not clear invalid stored session backup for ${userId}: ${cleanupError.message}`);
    });
    return null;
  }
}

async function hasStoredSessionBackup(userId) {
  if (!ENABLE_QR_SESSION_BACKUP) {
    return false;
  }

  const backup = await readStoredSessionBackup(userId);
  return Boolean(backup?.files && Object.keys(backup.files).length);
}

async function writeStoredSessionBackup(userId, payload) {
  if (!ENABLE_QR_SESSION_BACKUP) {
    return;
  }

  const serializedPayload = encryptSecret(JSON.stringify(payload));
  if (!serializedPayload) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("admin_settings")
    .upsert(
      {
        key: buildSessionBackupKey(userId),
        value: JSON.stringify({
          payload: serializedPayload,
          updated_at: nowIso()
        }),
        updated_at: nowIso()
      },
      { onConflict: "key" }
    );

  if (error) {
    throw error;
  }
}

async function clearStoredSessionBackup(userId) {
  if (!ENABLE_QR_SESSION_BACKUP) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("admin_settings")
    .delete()
    .eq("key", buildSessionBackupKey(userId));

  if (error) {
    throw error;
  }
}

async function persistSessionBackup(userId) {
  if (!ENABLE_QR_SESSION_BACKUP) {
    return false;
  }

  const sessionDir = getSessionDir(userId);
  let files;

  try {
    files = await listSessionFilesRecursive(sessionDir);
  } catch {
    return false;
  }

  if (!files.length) {
    return false;
  }

  const hasCredsFile = files.some((filePath) => path.basename(filePath) === "creds.json");
  if (!hasCredsFile) {
    return false;
  }

  const payload = {
    userId,
    updatedAt: nowIso(),
    files: {}
  };

  for (const filePath of files) {
    const relativePath = path.relative(sessionDir, filePath).replace(/\\/g, "/");
    const raw = await fs.readFile(filePath);
    payload.files[relativePath] = raw.toString("base64");
  }

  await writeStoredSessionBackup(userId, payload);
  return true;
}

async function persistSessionBackupWithRetry(
  userId,
  { attempts = 6, delayMs = 1200 } = {}
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const saved = await persistSessionBackup(userId);
      if (saved) {
        return true;
      }
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.warn(
        `[ReachIQ][qr] retrying WhatsApp session backup for ${userId} after attempt ${attempt}: ${error.message}`
      );
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

export function ensureQrSessionBackup(userId) {
  if (!ENABLE_QR_SESSION_BACKUP) {
    return;
  }

  void persistSessionBackupWithRetry(userId).catch((error) => {
    console.error(`[ReachIQ][qr] failed to persist WhatsApp session backup for ${userId}`, error);
  });
}

function scheduleSessionBackup(userId) {
  if (!ENABLE_QR_SESSION_BACKUP) {
    return;
  }

  void clearScheduledSessionBackup(userId);
  const timer = setTimeout(() => {
    void persistSessionBackupWithRetry(userId, { attempts: 4, delayMs: 900 }).catch((error) => {
      console.error(`[ReachIQ][qr] failed to persist WhatsApp session backup for ${userId}`, error);
    }).finally(() => {
      sessionBackupTimers.delete(userId);
    });
  }, 900);
  sessionBackupTimers.set(userId, timer);
}

function trackSessionCredFlush(userId, promise) {
  const trackedPromise = promise.finally(() => {
    if (sessionCredFlushPromises.get(userId) === trackedPromise) {
      sessionCredFlushPromises.delete(userId);
    }
  });

  sessionCredFlushPromises.set(userId, trackedPromise);
  return trackedPromise;
}

async function waitForSavedSessionCreds(userId, { attempts = 12, delayMs = 250 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await hasSavedSessionFiles(userId)) {
      return true;
    }

    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return hasSavedSessionFiles(userId);
}

async function flushSessionCreds(userId, saveCreds) {
  const inFlightFlush = sessionCredFlushPromises.get(userId);
  if (inFlightFlush) {
    const flushed = await inFlightFlush.catch(() => false);
    if (flushed && (await hasSavedSessionFiles(userId))) {
      return true;
    }
  }

  const flushPromise = Promise.resolve()
    .then(() => ensureSessionDirExists(userId))
    .then(() => saveCreds())
    .then(() => waitForSavedSessionCreds(userId))
    .catch((error) => {
      console.error(`[ReachIQ][qr] forced creds flush failed for ${userId}`, error);
      return false;
    });

  return trackSessionCredFlush(userId, flushPromise);
}

async function restoreSessionFilesFromBackup(userId) {
  const backup = await readStoredSessionBackup(userId);
  if (!backup?.files) {
    return false;
  }

  const sessionDir = getSessionDir(userId);
  await fs.mkdir(sessionDir, { recursive: true });

  for (const [relativePath, encoded] of Object.entries(backup.files)) {
    const targetPath = path.join(sessionDir, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, Buffer.from(String(encoded), "base64"));
  }

  return true;
}

async function listUsersWithStoredSessionBackups() {
  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("key")
    .like("key", `${QR_SESSION_BACKUP_KEY_PREFIX}%`);

  if (error) {
    throw error;
  }

  return (data || [])
    .map((entry) => String(entry.key || "").slice(QR_SESSION_BACKUP_KEY_PREFIX.length))
    .filter(Boolean);
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

function isRecoveringQrSnapshot(snapshot) {
  return snapshot.status === "connecting" || snapshot.status === "waiting_for_scan";
}

async function cleanupSessionFiles(userId) {
  const sessionDir = getSessionDir(userId);
  await fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
}

async function ensureSessionDirExists(userId) {
  await fs.mkdir(getSessionDir(userId), { recursive: true });
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
    const restored = await restoreSessionFilesFromBackup(userId).catch(() => false);
    if (restored) {
      return getStoredLinkedQrSessionInfo(userId);
    }
    return null;
  }
}

export function hasActiveQrSocket(userId) {
  return sessionSockets.has(userId);
}

export function hasLiveQrSocket(userId) {
  const socket = sessionSockets.get(userId);
  const snapshot = getQRSessionSnapshot(userId);
  return Boolean(socket && snapshot.status === "connected" && socket.user?.id);
}

function hasRecoveringQrSocket(userId) {
  const socket = sessionSockets.get(userId);
  const snapshot = getQRSessionSnapshot(userId);
  return Boolean(socket && isRecoveringQrSnapshot(snapshot));
}

export async function hasRecoverableQrAuthState(userId) {
  if (await hasSavedSessionFiles(userId)) {
    return true;
  }

  return hasStoredSessionBackup(userId).catch(() => false);
}

async function clearStaleQrSocketEntry(userId, reason = "stale_socket") {
  const socket = sessionSockets.get(userId);
  if (!socket) {
    return false;
  }

  const snapshot = getQRSessionSnapshot(userId);
  if (hasLiveQrSocket(userId) || isRecoveringQrSnapshot(snapshot)) {
    return false;
  }

  sessionSockets.delete(userId);
  try {
    socket.end?.(new Error(`ReachIQ stale QR socket cleanup (${reason})`));
  } catch {
    // Best-effort cleanup only.
  }

  return true;
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
  resetQrCryptoFailures(userId);
  resetQrReconnectStorm(userId);
  const socket = sessionSockets.get(userId);
  if (socket) {
    if (clearAuth) {
      try {
        await socket.logout();
      } catch {
        try {
          socket.end?.(new Error("ReachIQ QR disconnect"));
        } catch {
          // ignore
        }
      }
    } else {
      try {
        socket.end?.(new Error("ReachIQ QR soft disconnect"));
      } catch {
        // ignore
      }
    }
  }

  sessionSockets.delete(userId);
  await clearQrExpiry(userId);
  await clearScheduledSessionBackup(userId);
  sessionState.delete(userId);
  await disconnectWhatsAppProvider(userId, "qr");
  await pauseActiveCampaignsAwaitingWhatsApp(
    userId,
    clearAuth ? "qr_disconnected" : "qr_connection_lost"
  ).catch((error) => {
    console.warn(`[ReachIQ][qr] could not pause active campaigns for ${userId}: ${error.message}`);
  });

  if (clearAuth) {
    await cleanupSessionFiles(userId);
    await clearStoredSessionBackup(userId).catch(() => null);
  }

  emitToSubscribers(userId, { type: "status", status: "disconnected" });
}

export async function restoreQRSessionIfAvailable(userId) {
  const existingSocket = sessionSockets.get(userId);
  if (existingSocket) {
    const snapshot = getQRSessionSnapshot(userId);
    if (hasLiveQrSocket(userId) || isRecoveringQrSnapshot(snapshot)) {
      return snapshot;
    }

    await clearStaleQrSocketEntry(userId, "restore_short_circuit");
  }

  let hasSavedSession = await hasSavedSessionFiles(userId);
  if (!hasSavedSession && ENABLE_QR_SESSION_BACKUP) {
    hasSavedSession = await restoreSessionFilesFromBackup(userId);
  }
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

async function buildSocketWithSingleFlight(userId, { forceFresh = false, reason = "start" } = {}) {
  const existingSocket = sessionSockets.get(userId);
  if (existingSocket && !forceFresh) {
    const snapshot = getQRSessionSnapshot(userId);
    if (hasLiveQrSocket(userId) || isRecoveringQrSnapshot(snapshot)) {
      return snapshot;
    }

    await clearStaleQrSocketEntry(userId, `${reason}_short_circuit`);
  }

  const existingRestore = sessionRestorePromises.get(userId);
  if (existingRestore && !forceFresh) {
    await existingRestore;
    return getQRSessionSnapshot(userId);
  }

  sessionLastRestoreAttemptAt.set(userId, Date.now());

  const buildPromise = (async () => {
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
        console.error(`[ReachIQ][qr] failed to persist ${reason} state for ${userId}`, error);
      });
    }

    await buildSocket(userId, forceFresh);
  })();

  sessionRestorePromises.set(userId, buildPromise);

  try {
    await buildPromise;
  } finally {
    sessionRestorePromises.delete(userId);
  }

  return getQRSessionSnapshot(userId);
}

export async function tryRestoreQRSessionIfAvailable(
  userId,
  { timeoutMs = QR_ROUTE_RESTORE_TIMEOUT_MS, reason = "route" } = {}
) {
  try {
    return await withTimeout(restoreQRSessionIfAvailable(userId), timeoutMs, `ReachIQ QR restore (${reason})`);
  } catch (error) {
    if (error instanceof QrRestoreTimeoutError) {
      console.warn(`[ReachIQ][qr] ${error.message}`);
      void scheduleQRSessionRestore(userId, {
        reason: `${reason}_timeout`,
        force: true,
        delayMs: 250
      });
      return null;
    }

    throw error;
  }
}

export function scheduleQRSessionRestore(
  userId,
  { reason = "background", force = false, delayMs = 0 } = {}
) {
  if (!ENABLE_QR_BACKGROUND_RESTORE) {
    return false;
  }

  if (sessionSockets.has(userId) || sessionRestorePromises.has(userId) || scheduledSessionRestores.has(userId)) {
    return false;
  }

  const now = Date.now();
  const lastAttemptAt = sessionLastRestoreAttemptAt.get(userId) || 0;
  if (!force && now - lastAttemptAt < QR_RESTORE_RETRY_COOLDOWN_MS) {
    return false;
  }

  sessionLastRestoreAttemptAt.set(userId, now);
  const scheduledPromise = (async () => {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      await restoreQRSessionIfAvailable(userId);
    } catch (error) {
      console.warn(`[ReachIQ][qr] background restore failed for ${userId} (${reason}): ${error.message}`);
    } finally {
      scheduledSessionRestores.delete(userId);
    }
  })();

  scheduledSessionRestores.set(userId, scheduledPromise);
  return true;
}

export async function getVerifiedQrSessionState(
  userId,
  { timeoutMs = QR_ROUTE_RESTORE_TIMEOUT_MS, reason = "verify", scheduleRetryReason = null, attemptRestore = true } = {}
) {
  let snapshot = getQRSessionSnapshot(userId);

  if (hasLiveQrSocket(userId)) {
    return {
      connected: true,
      live: true,
      recoverable: true,
      restored: false,
      snapshot
    };
  }

  if (hasRecoveringQrSocket(userId)) {
    return {
      connected: false,
      live: false,
      recoverable: true,
      restored: false,
      snapshot
    };
  }

  await clearStaleQrSocketEntry(userId, reason);

  let restored = null;
  if (attemptRestore) {
    restored = await tryRestoreQRSessionIfAvailable(userId, {
      timeoutMs,
      reason
    }).catch(() => null);
  }

  snapshot = restored || getQRSessionSnapshot(userId);

  if (hasLiveQrSocket(userId)) {
    return {
      connected: true,
      live: true,
      recoverable: true,
      restored: Boolean(restored),
      snapshot: getQRSessionSnapshot(userId)
    };
  }

  if (hasRecoveringQrSocket(userId)) {
    return {
      connected: false,
      live: false,
      recoverable: true,
      restored: Boolean(restored),
      snapshot: getQRSessionSnapshot(userId)
    };
  }

  const recoverable = await hasRecoverableQrAuthState(userId).catch(() => false);
  if (scheduleRetryReason && recoverable) {
    scheduleQRSessionRestore(userId, { reason: scheduleRetryReason });
  }

  return {
    connected: false,
    live: false,
    recoverable,
    restored: Boolean(restored),
    snapshot: getQRSessionSnapshot(userId)
  };
}

export async function restoreSavedQRSessionsOnBoot() {
  try {
    await fs.mkdir(SESSION_ROOT, { recursive: true });
    const entries = await fs.readdir(SESSION_ROOT, { withFileTypes: true });
    const backupUserIds = await listUsersWithStoredSessionBackups().catch(() => []);
    const userIds = Array.from(
      new Set([
        ...entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
        ...backupUserIds
      ])
    );

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
    await clearStoredSessionBackup(userId).catch(() => null);
  }

  await fs.mkdir(sessionDir, { recursive: true });

  if (!forceFresh && ENABLE_QR_SESSION_BACKUP && !(await hasSavedSessionFiles(userId))) {
    await restoreSessionFilesFromBackup(userId).catch((error) => {
      console.error(`[ReachIQ][qr] failed to restore session backup before socket build for ${userId}`, error);
    });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    defaultQueryTimeoutMs: QR_DEFAULT_QUERY_TIMEOUT_MS,
    connectTimeoutMs: QR_CONNECT_TIMEOUT_MS,
    browser: ["ReachIQ", "Chrome", "1.0.0"],
    logger: wrapBaileysLogger(
      userId,
      baseBaileysLogger.child({ class: "baileys", userId })
    )
  });

  sock.ev.on("creds.update", () => {
    const flushPromise = Promise.resolve()
      .then(() => ensureSessionDirExists(userId))
      .then(() => saveCreds())
      .then(() => waitForSavedSessionCreds(userId))
      .catch((error) => {
        console.error(`[ReachIQ][qr] creds.update save failed for ${userId}`, error);
        return false;
      })
      .then((saved) => {
        if (saved) {
          scheduleSessionBackup(userId);
          return true;
        }

        console.warn(`[ReachIQ][qr] creds.update finished without durable creds.json for ${userId}`);
        return false;
      });

    trackSessionCredFlush(userId, flushPromise);
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
        resetQrCryptoFailures(userId);
        resetQrReconnectStorm(userId);
        const snapshotBeforeSave = getQRSessionSnapshot(userId);
        const socketUser = sock.user?.id || snapshotBeforeSave.socketUser || "";
        const phoneNumber = normalizeWhatsAppPhone(
          socketUser.split(":")[0] || snapshotBeforeSave.phoneNumber || ""
        );
        const activeAt = nowIso();
        setSessionState(userId, {
          status: "connecting",
          qrImage: null,
          expiresAt: null,
          phoneNumber: phoneNumber || snapshotBeforeSave.phoneNumber || null,
          socketUser: socketUser || snapshotBeforeSave.socketUser || null,
          lastActiveAt: activeAt
        });
        await clearQrExpiry(userId);
        await persistQrConnectionState(userId, {
          status: "connecting",
          phoneNumber: phoneNumber || snapshotBeforeSave.phoneNumber || null,
          socketUser: socketUser || snapshotBeforeSave.socketUser || null,
          lastActiveAt: activeAt
        });
        let durableCredsPersisted = false;
        try {
          durableCredsPersisted = await flushSessionCreds(userId, saveCreds);
        } catch (error) {
          console.error(`[ReachIQ][qr] failed to flush connected session creds for ${userId}`, error);
        }

        let durableBackupPersisted = !ENABLE_QR_SESSION_BACKUP;
        try {
          if (ENABLE_QR_SESSION_BACKUP && durableCredsPersisted) {
            durableBackupPersisted = await persistSessionBackupWithRetry(userId, {
              attempts: 8,
              delayMs: 1000
            });
          }
        } catch (error) {
          console.error(`[ReachIQ][qr] failed to persist durable WhatsApp backup for ${userId}`, error);
        }
        if (!durableCredsPersisted) {
          console.warn(`[ReachIQ][qr] durable creds.json not confirmed for ${userId}; keeping session in connecting state until storage succeeds`);
          emitToSubscribers(userId, {
            type: "status",
            status: "connecting",
            phoneNumber: phoneNumber || snapshotBeforeSave.phoneNumber || null,
            lastActiveAt: activeAt
          });
          ensureQrSessionBackup(userId);
          scheduleSessionBackup(userId);
          return;
        }

        if (ENABLE_QR_SESSION_BACKUP && !durableBackupPersisted) {
          console.warn(`[ReachIQ][qr] durable WhatsApp backup not yet confirmed for ${userId}; using local auth state and keeping retry backup scheduled`);
          ensureQrSessionBackup(userId);
        }

        setSessionState(userId, {
          status: "connected",
          qrImage: null,
          expiresAt: null,
          phoneNumber: phoneNumber || snapshotBeforeSave.phoneNumber || null,
          socketUser: socketUser || snapshotBeforeSave.socketUser || null,
          lastActiveAt: activeAt
        });
        await persistQrConnectionState(userId, {
          status: "connected",
          phoneNumber: phoneNumber || snapshotBeforeSave.phoneNumber || null,
          socketUser: socketUser || snapshotBeforeSave.socketUser || null,
          lastActiveAt: activeAt
        });
        await resumeAwaitingWhatsAppCampaigns(userId, "qr_reconnected").catch((error) => {
          console.warn(`[ReachIQ][qr] could not resume awaiting campaigns for ${userId}: ${error.message}`);
        });
        scheduleSessionBackup(userId);
        const snapshot = getQRSessionSnapshot(userId);
        emitToSubscribers(userId, {
          type: "connected",
          status: "connected",
          phoneNumber: snapshot.phoneNumber,
          lastActiveAt: snapshot.lastActiveAt
        });
      }

      if (connection === "close") {
        resetQrCryptoFailures(userId);
        const statusCode = lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.output?.statusCode;
        const shouldLogout = statusCode === DisconnectReason.loggedOut;
        const shouldRestart = statusCode === DisconnectReason.restartRequired;
        const hasRecoverableAuth = await hasRecoverableQrAuthState(userId).catch(() => false);

        sessionSockets.delete(userId);
        await clearQrExpiry(userId);

        if (shouldLogout) {
          await disconnectQRSession(userId, { clearAuth: !hasRecoverableAuth });
          emitToSubscribers(userId, { type: "status", status: "disconnected" });
          return;
        }

        if (shouldRestart) {
          const reconnectStormDetected = trackQrReconnectAttempt(userId);
          if (reconnectStormDetected) {
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
            }).catch((error) => {
              console.warn(`[ReachIQ][qr] could not persist restart storm state for ${userId}: ${error.message}`);
            });
            await pauseActiveCampaignsAwaitingWhatsApp(userId, "qr_reconnect_required").catch((error) => {
              console.warn(`[ReachIQ][qr] could not pause active campaigns after restart storm for ${userId}: ${error.message}`);
            });
            emitToSubscribers(userId, { type: "status", status: "disconnected" });
            return;
          }

          if (!ENABLE_QR_BACKGROUND_RESTORE) {
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
            }).catch((error) => {
              console.warn(`[ReachIQ][qr] could not persist disabled-auto-restore state for ${userId}: ${error.message}`);
            });
            await pauseActiveCampaignsAwaitingWhatsApp(userId, "qr_reconnect_required").catch((error) => {
              console.warn(`[ReachIQ][qr] could not pause campaigns after disabled auto-restore for ${userId}: ${error.message}`);
            });
            emitToSubscribers(userId, { type: "status", status: "disconnected" });
            return;
          }

          setSessionState(userId, {
            status: "connecting",
            qrImage: null,
            expiresAt: null
          });
          emitToSubscribers(userId, { type: "status", status: "connecting" });
          await persistQrConnectionState(userId, {
            status: "connecting"
          });

          scheduleQRSessionRestore(userId, {
            reason: "restart_required",
            force: true,
            delayMs: 750
          });
          return;
        }

        if (hasRecoverableAuth) {
          const reconnectStormDetected = trackQrReconnectAttempt(userId);
          if (reconnectStormDetected) {
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
            }).catch((error) => {
              console.warn(`[ReachIQ][qr] could not persist reconnect storm state for ${userId}: ${error.message}`);
            });
            await pauseActiveCampaignsAwaitingWhatsApp(userId, "qr_reconnect_required").catch((error) => {
              console.warn(`[ReachIQ][qr] could not pause active campaigns after reconnect storm for ${userId}: ${error.message}`);
            });
            emitToSubscribers(userId, { type: "status", status: "disconnected" });
            return;
          }

          if (!ENABLE_QR_BACKGROUND_RESTORE) {
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
            }).catch((error) => {
              console.warn(`[ReachIQ][qr] could not persist recoverable-disabled-auto-restore state for ${userId}: ${error.message}`);
            });
            await pauseActiveCampaignsAwaitingWhatsApp(userId, "qr_reconnect_required").catch((error) => {
              console.warn(`[ReachIQ][qr] could not pause campaigns after recoverable close for ${userId}: ${error.message}`);
            });
            emitToSubscribers(userId, { type: "status", status: "disconnected" });
            return;
          }

          setSessionState(userId, {
            status: "connecting",
            qrImage: null,
            expiresAt: null
          });
          emitToSubscribers(userId, { type: "status", status: "connecting" });
          await persistQrConnectionState(userId, {
            status: "connecting"
          }).catch((error) => {
            console.warn(`[ReachIQ][qr] could not persist recoverable close state for ${userId}: ${error.message}`);
          });

          scheduleQRSessionRestore(userId, {
            reason: "recoverable_close",
            force: true,
            delayMs: 1500
          });
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
        await pauseActiveCampaignsAwaitingWhatsApp(userId, "qr_connection_closed").catch((error) => {
          console.warn(`[ReachIQ][qr] could not pause active campaigns after close for ${userId}: ${error.message}`);
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
    const snapshot = getQRSessionSnapshot(userId);
    if (hasLiveQrSocket(userId) || isRecoveringQrSnapshot(snapshot)) {
      return snapshot;
    }

    await clearStaleQrSocketEntry(userId, "start_or_restore_short_circuit");
  }

  const existingRestore = sessionRestorePromises.get(userId);
  if (existingRestore && !forceFresh) {
    await existingRestore;
    return getQRSessionSnapshot(userId);
  }

  if (!forceFresh) {
    return restoreQRSessionIfAvailable(userId);
  }

  return buildSocketWithSingleFlight(userId, {
    forceFresh: true,
    reason: "force_fresh_start"
  });
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
  if (!sock || !hasLiveQrSocket(userId)) {
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
    if (sock && hasLiveQrSocket(userId)) {
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
  let result;
  try {
    result = await sock.sendMessage(jid, { text: messageText });
  } catch (error) {
    if (isQrSessionCryptoError(error)) {
      await invalidatePoisonedQrSession(userId, error.message || "send text decrypt failure");
      const reconnectError = new Error(QR_SESSION_RECOVERY_MESSAGE);
      reconnectError.status = 409;
      throw reconnectError;
    }
    throw error;
  }
  const activeAt = nowIso();
  resetQrCryptoFailures(userId);
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
  ensureQrSessionBackup(userId);
  scheduleSessionBackup(userId);
  return result;
}

export async function sendQrVideoMessage(userId, toPhone, videoUrl, caption = "") {
  const sock = await ensureConnectedQrSocket(userId);
  const jid = `${normalizeWhatsAppPhone(toPhone)}@s.whatsapp.net`;
  const videoPayload = await resolveQrVideoPayload(videoUrl);
  let result;
  try {
    result = await sock.sendMessage(jid, {
      video: videoPayload,
      caption
    });
  } catch (error) {
    if (isQrSessionCryptoError(error)) {
      await invalidatePoisonedQrSession(userId, error.message || "send video decrypt failure");
      const reconnectError = new Error(QR_SESSION_RECOVERY_MESSAGE);
      reconnectError.status = 409;
      throw reconnectError;
    }
    throw error;
  }
  const activeAt = nowIso();
  resetQrCryptoFailures(userId);
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
  ensureQrSessionBackup(userId);
  scheduleSessionBackup(userId);
  return result;
}
