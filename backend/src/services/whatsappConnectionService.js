import crypto from "node:crypto";
import { nowIso } from "../utils/helpers.js";
import { supabaseAdmin } from "../utils/supabase.js";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const TOKEN_SECRET = process.env.WHATSAPP_CREDENTIAL_SECRET || process.env.SUPABASE_SERVICE_KEY || "reachiq-whatsapp-fallback-secret";

export function isMissingWhatsappConnectionsTableError(error) {
  const message = String(error?.message || "");
  return message.includes("public.whatsapp_connections");
}

function buildCipherKey() {
  return crypto.createHash("sha256").update(String(TOKEN_SECRET)).digest();
}

export function encryptSecret(plainText = "") {
  if (!plainText) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, buildCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    content: encrypted.toString("base64")
  });
}

export function decryptSecret(serializedSecret) {
  if (!serializedSecret) return null;

  const payload = JSON.parse(serializedSecret);
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    buildCipherKey(),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.content, "base64")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

export async function getAllWhatsAppConnections(userId) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getActiveWhatsAppConnection(userId) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["connected", "connecting", "waiting_for_scan"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getWhatsAppConnectionByProvider(userId, providerType) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider_type", providerType)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function syncProfileWhatsAppState(userId, connection = null) {
  const isMeta = connection?.provider_type === "meta" && connection?.status === "connected";

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      whatsapp_connected: Boolean(connection?.status === "connected"),
      whatsapp_phone_id: isMeta ? connection?.phone_number_id || null : null,
      whatsapp_token: null,
      meta_verified: Boolean(isMeta),
      updated_at: nowIso()
    })
    .eq("id", userId);

  if (error) throw error;
}

export async function setAllConnectionsDisconnected(userId) {
  const { error } = await supabaseAdmin
    .from("whatsapp_connections")
    .update({
      status: "disconnected",
      updated_at: nowIso()
    })
    .eq("user_id", userId);

  if (error) throw error;
  await syncProfileWhatsAppState(userId, null);
}

export async function saveWhatsAppConnection({
  userId,
  providerType,
  status,
  phoneNumber = null,
  phoneNumberId = null,
  sessionData = {},
  accessToken = null,
  lastActiveAt = null
}) {
  const existing = await getWhatsAppConnectionByProvider(userId, providerType);
  const payload = {
    user_id: userId,
    provider_type: providerType,
    status,
    phone_number: phoneNumber,
    session_data: sessionData || {},
    phone_number_id: phoneNumberId,
    access_token_encrypted: accessToken ? encryptSecret(accessToken) : existing?.access_token_encrypted || null,
    last_active_at: lastActiveAt,
    updated_at: nowIso()
  };

  const { data, error } = await supabaseAdmin
    .from("whatsapp_connections")
    .upsert(payload, { onConflict: "user_id,provider_type" })
    .select("*")
    .single();

  if (error) throw error;

  if (status === "connected") {
    await supabaseAdmin
      .from("whatsapp_connections")
      .update({ status: "disconnected", updated_at: nowIso() })
      .eq("user_id", userId)
      .neq("provider_type", providerType)
      .in("status", ["connected", "connecting", "waiting_for_scan", "expired"]);
  }

  const activeConnection = status === "connected" ? data : await getActiveWhatsAppConnection(userId);
  await syncProfileWhatsAppState(userId, activeConnection);

  return data;
}

export async function disconnectWhatsAppProvider(userId, providerType) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_connections")
    .update({
      status: "disconnected",
      updated_at: nowIso(),
      last_active_at: nowIso()
    })
    .eq("user_id", userId)
    .eq("provider_type", providerType)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  await syncProfileWhatsAppState(userId, null);
  return data || null;
}

export function serializeConnectionForClient(connection) {
  if (!connection) {
    return {
      connected: false,
      providerType: "none",
      status: "disconnected"
    };
  }

  return {
    id: connection.id,
    connected: connection.status === "connected",
    providerType: connection.provider_type,
    status: connection.status,
    phoneNumber: connection.phone_number,
    phoneNumberId: connection.phone_number_id,
    sessionData: connection.session_data || {},
    lastActiveAt: connection.last_active_at,
    updatedAt: connection.updated_at
  };
}
