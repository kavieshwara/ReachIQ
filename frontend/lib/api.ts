"use client";

import axios from "axios";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type UsageLimitEventDetail = {
  error?: string;
  totalLimit?: number;
  upgradeRequired?: boolean;
};

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 70000,
  headers: {
    "Content-Type": "application/json"
  }
});

let cachedAccessToken: string | null = null;
let sessionLookupPromise: Promise<string | null> | null = null;

export const usageLimitEventName = "reachiq:usage-limit";

export function setApiAccessToken(nextToken: string | null) {
  cachedAccessToken = nextToken;
}

async function resolveAccessToken() {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  if (sessionLookupPromise) {
    return sessionLookupPromise;
  }

  sessionLookupPromise = (async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    cachedAccessToken = session?.access_token || null;
    return cachedAccessToken;
  })().finally(() => {
    sessionLookupPromise = null;
  });

  return sessionLookupPromise;
}

api.interceptors.request.use(async (config) => {
  const accessToken = await resolveAccessToken();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 403) {
      const payload = error?.response?.data || {};
      const message = String(payload?.error || "");
      const looksLikeUsageLimit =
        payload?.upgradeRequired ||
        /daily .*limit reached/i.test(message) ||
        /lead limit reached/i.test(message);

      if (looksLikeUsageLimit) {
        window.dispatchEvent(
          new CustomEvent<UsageLimitEventDetail>(usageLimitEventName, {
            detail: {
              error: message,
              totalLimit: payload?.totalLimit ? Number(payload.totalLimit) : undefined,
              upgradeRequired: Boolean(payload?.upgradeRequired)
            }
          })
        );
      }
    }

    if (typeof window !== "undefined" && error?.response?.status === 401) {
      console.info("[ReachIQ][api] 401 response", error?.config?.url || "unknown-url");
    }

    return Promise.reject(error);
  }
);

export default api;
