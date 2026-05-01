"use client";

function normalizeUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/$/, "");
}

export function resolveStaticAppUrl() {
  const explicitUrl = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL);
  const looksLocal = explicitUrl ? /localhost|127\.0\.0\.1/i.test(explicitUrl) : false;
  const vercelUrl = normalizeUrl(process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL);

  if (explicitUrl && !looksLocal) {
    return explicitUrl;
  }

  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  if (explicitUrl) {
    return explicitUrl;
  }

  return "http://localhost:3002";
}

export function resolveBrowserAppUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return normalizeUrl(window.location.origin) || resolveStaticAppUrl();
  }

  return resolveStaticAppUrl();
}

export function buildBrowserAppUrl(pathname = "/") {
  return new URL(pathname, `${resolveBrowserAppUrl()}/`).toString();
}
