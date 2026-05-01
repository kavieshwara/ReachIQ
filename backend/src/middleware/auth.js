import { createRequire } from "node:module";
import { demoProfile, isDemoMode } from "../utils/demo.js";
import { ensureDailyUsageWindow } from "../utils/dailyUsage.js";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js/dist/index.cjs");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function ensureProfile(user) {
  const profilePayload = {
    id: user.id,
    email: user.email || "",
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || null
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export const requireAuth = async (req, res, next) => {
  try {
    if (isDemoMode) {
      req.user = { id: demoProfile.id, email: demoProfile.email };
      req.profile = demoProfile;
      req.accessToken = "demo-access-token";
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authorization token provided" });
    }

    const token = authHeader.replace("Bearer ", "");
    const authContext = await getAuthContextFromToken(token);
    req.user = authContext.user;
    req.profile = authContext.profile;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error(`[Auth Middleware Error] ${new Date().toISOString()}:`, err);
    return res.status(err?.status || 500).json({
      error: err?.message || "Authentication failed"
    });
  }
};

export const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, () => {
    if (req.profile?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
};

export async function getAuthContextFromToken(token) {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    const authError = new Error("Invalid or expired token");
    authError.status = 401;
    throw authError;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.info(`[ReachIQ][auth] profile missing for ${user.id}, creating fallback profile`);
    const ensuredProfile = await ensureProfile(user);
    const normalizedProfile = await ensureDailyUsageWindow(ensuredProfile);
    return {
      user,
      profile: normalizedProfile
    };
  }

  const normalizedProfile = await ensureDailyUsageWindow(profile);

  return {
    user,
    profile: normalizedProfile
  };
}
