import { supabaseAdmin } from "../utils/supabase.js";
import { isPaidPlan } from "../services/paymentService.js";

const FREE_DAILY_SEARCH_LIMIT = 30;
const PREMIUM_DAILY_SEARCH_LIMIT = 300;

export function enforceMessageLimit(req, res, next) {
  const profile = req.profile;

  if (!profile) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const totalLimit = Number(profile.messages_limit || 0) + Number(profile.bonus_messages || 0);
  if (Number(profile.messages_sent_today || 0) >= totalLimit) {
    return res.status(403).json({
      error: "Daily message limit reached",
      totalLimit
    });
  }

  next();
}

export function getLeadSearchLimit(profile) {
  if (!Object.prototype.hasOwnProperty.call(profile || {}, "lead_searches_today")) {
    return null;
  }

  return isPaidPlan(profile?.plan)
    ? PREMIUM_DAILY_SEARCH_LIMIT
    : FREE_DAILY_SEARCH_LIMIT;
}

export function enforceLeadSearchLimit(req, res, next) {
  const profile = req.profile;

  if (!profile) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const totalLimit = getLeadSearchLimit(profile);
  if (totalLimit === null) {
    return next();
  }

  if (Number(profile.lead_searches_today || 0) >= totalLimit) {
    return res.status(403).json({
      error: "Daily lead search limit reached for your plan.",
      totalLimit,
      upgradeRequired: !isPaidPlan(profile.plan)
    });
  }

  next();
}

export async function incrementLeadSearchUsage(profile) {
  if (!profile?.id) {
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(profile, "lead_searches_today")) {
    return;
  }

  const nextValue = Number(profile.lead_searches_today || 0) + 1;
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ lead_searches_today: nextValue })
    .eq("id", profile.id);

  if (error) {
    throw error;
  }

  profile.lead_searches_today = nextValue;
}
