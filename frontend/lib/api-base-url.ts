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

const hostedFallbackApiUrl = "https://reachiq-api.onrender.com";
const blockedHostedApiUrls = new Set(["https://reachiq-hqzc.onrender.com"]);

function shouldRejectConfiguredApiUrl(value: string) {
  if (blockedHostedApiUrls.has(value)) {
    return true;
  }

  if (typeof window !== "undefined" && window.location?.hostname) {
    const hostedWindow = !/localhost|127\.0\.0\.1/i.test(window.location.hostname);
    if (hostedWindow && /localhost|127\.0\.0\.1/i.test(value)) {
      return true;
    }
  }

  return false;
}

export function resolveApiBaseUrl() {
  const configured = normalizeUrl(process.env.NEXT_PUBLIC_API_URL);
  if (configured && !shouldRejectConfiguredApiUrl(configured)) {
    return configured;
  }

  const explicitHosted = normalizeUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
  if (explicitHosted && !shouldRejectConfiguredApiUrl(explicitHosted)) {
    return explicitHosted;
  }

  return hostedFallbackApiUrl;
}

export function buildApiUrl(pathname = "/") {
  return new URL(pathname, `${resolveApiBaseUrl()}/`).toString();
}
