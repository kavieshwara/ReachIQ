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
let lastTokenLookupAt = 0;
const tokenRefreshIntervalMs = 45_000;

export const usageLimitEventName = "reachiq:usage-limit";

export function setApiAccessToken(nextToken: string | null) {
  cachedAccessToken = nextToken;
  lastTokenLookupAt = Date.now();
}

async function resolveAccessToken(forceRefresh = false) {
  const tokenIsFresh =
    cachedAccessToken &&
    Date.now() - lastTokenLookupAt < tokenRefreshIntervalMs;

  if (!forceRefresh && tokenIsFresh) {
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
    lastTokenLookupAt = Date.now();
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
    const originalRequest = error?.config;

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

      if (originalRequest && !originalRequest.__reachiqRetried) {
        originalRequest.__reachiqRetried = true;

        const refreshedToken = await resolveAccessToken(true);
        if (refreshedToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return api.request(originalRequest);
        }
      }

      cachedAccessToken = null;
      lastTokenLookupAt = 0;
    }

    return Promise.reject(error);
  }
);

export default api;
