import QRCode from "qrcode";
import { getDemoSettings, isDemoMode } from "../utils/demo.js";
import { supabaseAdmin } from "../utils/supabase.js";

export const MANUAL_PAYMENT_PLAN_CONFIG = {
  starter: {
    label: "Starter Plan",
    price: 499,
    messagesLimit: 200
  },
  pro: {
    label: "Pro Plan",
    price: 999,
    messagesLimit: 1000
  }
};

export const PUBLIC_PLATFORM_SETTING_KEYS = [
  "demo_video_url",
  "maintenance_mode",
  "free_messages_per_day",
  "premium_messages_per_day",
  "referral_bonus_messages",
  "platform_announcement",
  "payments_enabled",
  "support_whatsapp_number",
  "upi_id",
  "upi_qr_url"
];

const REACHIQ_UPI_MERCHANT_NAME = "ReachIQ";

export function normalizePlanKey(plan) {
  const normalized = String(plan || "").trim().toLowerCase();

  if (!normalized) {
    return "free";
  }

  if (normalized === "premium") {
    return "starter";
  }

  return normalized;
}

export function isPaidPlan(plan) {
  return ["starter", "pro", "premium"].includes(String(plan || "").trim().toLowerCase());
}

export async function getAdminSettingsMap(keys = []) {
  if (isDemoMode) {
    const demoSettings = Object.fromEntries(
      getDemoSettings().map((item) => [item.key, String(item.value ?? "")])
    );

    if (!keys.length) {
      return demoSettings;
    }

    return Object.fromEntries(keys.map((key) => [key, demoSettings[key] ?? ""]));
  }

  let query = supabaseAdmin.from("admin_settings").select("key, value");

  if (keys.length) {
    query = query.in("key", keys);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return Object.fromEntries((data || []).map((item) => [item.key, String(item.value ?? "")]));
}

export async function paymentsEnabled() {
  const settings = await getAdminSettingsMap(["payments_enabled"]);
  return String(settings.payments_enabled || "false") === "true";
}

export function getPlanConfig(plan) {
  return MANUAL_PAYMENT_PLAN_CONFIG[normalizePlanKey(plan)] || null;
}

export async function getMessageLimitForPlan(plan) {
  const normalized = normalizePlanKey(plan);

  if (normalized === "starter" || normalized === "pro") {
    return MANUAL_PAYMENT_PLAN_CONFIG[normalized].messagesLimit;
  }

  const settings = await getAdminSettingsMap(["free_messages_per_day", "premium_messages_per_day"]);
  const freeLimit = Number(settings.free_messages_per_day || 30);
  const premiumLimit = Number(settings.premium_messages_per_day || 200);

  return normalized === "premium" ? premiumLimit : freeLimit;
}

export async function getPublicPlatformSettings() {
  const settings = await getAdminSettingsMap(PUBLIC_PLATFORM_SETTING_KEYS);
  return PUBLIC_PLATFORM_SETTING_KEYS.map((key) => ({
    key,
    value: settings[key] ?? ""
  }));
}

export function buildUpiIntentUrl({ upiId, amount, planLabel }) {
  const normalizedUpiId = String(upiId || "").trim();
  const numericAmount = Number(amount || 0);

  if (!normalizedUpiId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return "";
  }

  const params = new URLSearchParams({
    pa: normalizedUpiId,
    pn: REACHIQ_UPI_MERCHANT_NAME,
    am: numericAmount.toFixed(2),
    cu: "INR",
    tn: `ReachIQ ${planLabel} upgrade`
  });

  return `upi://pay?${params.toString()}`;
}

export async function getPublicPaymentCheckout(plan) {
  const normalizedPlan = normalizePlanKey(plan);
  const planConfig = getPlanConfig(normalizedPlan);
  const settings = await getAdminSettingsMap(["payments_enabled", "upi_id", "upi_qr_url"]);
  const isEnabled = String(settings.payments_enabled || "false").toLowerCase() === "true";
  const upiId = String(settings.upi_id || "").trim();
  const uploadedQrUrl = String(settings.upi_qr_url || "").trim();

  if (!planConfig) {
    return {
      payments_enabled: isEnabled,
      upi_id: upiId,
      upi_qr_url: uploadedQrUrl,
      plan: normalizedPlan,
      plan_label: "",
      amount: 0,
      upi_intent_url: "",
      dynamic_qr_data_url: ""
    };
  }

  const upiIntentUrl = buildUpiIntentUrl({
    upiId,
    amount: planConfig.price,
    planLabel: planConfig.label
  });

  let dynamicQrDataUrl = "";
  if (upiIntentUrl) {
    try {
      dynamicQrDataUrl = await QRCode.toDataURL(upiIntentUrl, {
        width: 512,
        margin: 1,
        errorCorrectionLevel: "M",
        color: {
          dark: "#0F0F17",
          light: "#FFFFFF"
        }
      });
    } catch (error) {
      console.error("[ReachIQ] Could not generate payment QR", error);
    }
  }

  return {
    payments_enabled: isEnabled,
    upi_id: upiId,
    upi_qr_url: uploadedQrUrl,
    plan: normalizedPlan,
    plan_label: planConfig.label,
    amount: planConfig.price,
    upi_intent_url: upiIntentUrl,
    dynamic_qr_data_url: dynamicQrDataUrl
  };
}
