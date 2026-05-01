import { supabaseAdmin } from "./supabase.js";

const DAILY_RESET_TIMEZONE = process.env.DAILY_RESET_TIMEZONE || "Asia/Kolkata";

export function getDailyUsageDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_RESET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getProfileUsageDate(profile) {
  if (profile?.daily_usage_date) {
    return String(profile.daily_usage_date);
  }

  const fallbackDate = profile?.updated_at || profile?.created_at;
  if (!fallbackDate) {
    return null;
  }

  return getDailyUsageDateString(new Date(fallbackDate));
}

function buildResetPayload(profile) {
  const payload = {
    messages_sent_today: 0
  };

  if (Object.prototype.hasOwnProperty.call(profile || {}, "lead_searches_today")) {
    payload.lead_searches_today = 0;
  }

  if (Object.prototype.hasOwnProperty.call(profile || {}, "daily_usage_date")) {
    payload.daily_usage_date = getDailyUsageDateString();
  }

  return payload;
}

export async function ensureDailyUsageWindow(profile) {
  if (!profile?.id) {
    return profile;
  }

  const today = getDailyUsageDateString();
  const profileDay = getProfileUsageDate(profile);

  if (profileDay === today) {
    return profile;
  }

  const resetPayload = buildResetPayload(profile);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(resetPayload)
    .eq("id", profile.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
