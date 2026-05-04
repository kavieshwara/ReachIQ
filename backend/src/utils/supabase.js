import dns from "node:dns";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js/dist/index.cjs");

dns.setDefaultResultOrder?.("ipv4first");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseFetchTimeoutMs = Math.max(3000, Number(process.env.SUPABASE_FETCH_TIMEOUT_MS || 12000));

if (!supabaseUrl || !serviceKey) {
  console.warn("[ReachIQ] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend environment.");
}

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), supabaseFetchTimeoutMs);
  timeout.unref?.();

  try {
    const signal = init.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;

    return await fetch(input, {
      ...init,
      signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`Supabase request timed out after ${supabaseFetchTimeoutMs}ms`);
      timeoutError.name = "SupabaseTimeoutError";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const sharedOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    fetch: fetchWithTimeout
  }
};

export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  serviceKey || "placeholder",
  sharedOptions
);

export function getUserClient(accessToken) {
  return createClient(supabaseUrl || "https://placeholder.supabase.co", serviceKey || "placeholder", {
    ...sharedOptions,
    global: {
      ...sharedOptions.global,
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}
