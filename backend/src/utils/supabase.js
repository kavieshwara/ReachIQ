import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js/dist/index.cjs");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.warn("[ReachIQ] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend environment.");
}

export const supabaseAdmin = createClient(supabaseUrl || "https://placeholder.supabase.co", serviceKey || "placeholder", {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export function getUserClient(accessToken) {
  return createClient(supabaseUrl || "https://placeholder.supabase.co", serviceKey || "placeholder", {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}
