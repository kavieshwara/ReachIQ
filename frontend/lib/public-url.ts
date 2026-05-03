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

export const preferredHostedAppUrl = "https://reachiq-zeta.vercel.app";
export const legacyHostedAppUrls = new Set([
  "https://reachiq-kavieshwaras-projects.vercel.app"
]);

function canonicalizeHostedAppUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (legacyHostedAppUrls.has(value)) {
    return preferredHostedAppUrl;
  }

  return value;
}

function isReachiqHostedDomain(value: string | null) {
  if (!value) {
    return false;
  }

  return /^https:\/\/reachiq(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(value);
}

export function resolveStaticAppUrl() {
  const explicitUrl = canonicalizeHostedAppUrl(normalizeUrl(process.env.NEXT_PUBLIC_APP_URL));
  const looksLocal = explicitUrl ? /localhost|127\.0\.0\.1/i.test(explicitUrl) : false;
  const vercelUrl = canonicalizeHostedAppUrl(normalizeUrl(process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL));

  if (explicitUrl && !looksLocal) {
    return explicitUrl;
  }

  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  if (process.env.VERCEL_ENV === "production") {
    return preferredHostedAppUrl;
  }

  if (explicitUrl) {
    return explicitUrl;
  }

  return "http://localhost:3002";
}

export function resolveBrowserAppUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    const browserOrigin = normalizeUrl(window.location.origin);
    return browserOrigin || resolveStaticAppUrl();
  }

  return resolveStaticAppUrl();
}

export function buildBrowserAppUrl(pathname = "/") {
  return new URL(pathname, `${resolveBrowserAppUrl()}/`).toString();
}

export function buildAuthCallbackUrl(nextPath = "/dashboard") {
  const callbackUrl = new URL("/auth/callback", `${resolveBrowserAppUrl()}/`);

  if (nextPath && nextPath.startsWith("/")) {
    callbackUrl.searchParams.set("next", nextPath);
  }

  return callbackUrl.toString();
}
