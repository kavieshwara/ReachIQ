import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

const primaryHostedHost = "reachiq-zeta.vercel.app";
const legacyHostedHosts = new Set(["reachiq-kavieshwaras-projects.vercel.app"]);
const hostedReachiqHostPattern = /^reachiq(?:-[a-z0-9-]+)?\.vercel\.app$/i;

const protectedPrefixes = [
  "/dashboard",
  "/admin",
  "/leads",
  "/campaigns",
  "/templates",
  "/websites",
  "/follow-ups",
  "/dashboard/connect",
  "/connect-whatsapp",
  "/referral",
  "/settings",
  "/support",
  "/chat"
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function buildOAuthErrorMessage(errorDescription: string | null) {
  if (errorDescription?.includes("exchange external code")) {
    return "Google login could not be completed. Check the Supabase Google client settings, the Supabase callback URL in Google Cloud, and make sure this Google account is allowed as a test user if the OAuth app is still in testing.";
  }

  return errorDescription || "Authentication could not be completed right now.";
}

export async function middleware(req: NextRequest) {
  const shouldCanonicalizeHostedDomain =
    req.nextUrl.hostname !== primaryHostedHost &&
    (legacyHostedHosts.has(req.nextUrl.hostname) || hostedReachiqHostPattern.test(req.nextUrl.hostname));

  if (shouldCanonicalizeHostedDomain) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.protocol = "https:";
    redirectUrl.host = primaryHostedHost;
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (req.nextUrl.pathname === "/" && req.nextUrl.searchParams.has("error")) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set(
      "authError",
      buildOAuthErrorMessage(req.nextUrl.searchParams.get("error_description"))
    );

    const nextPath = req.nextUrl.searchParams.get("next");
    if (nextPath && nextPath.startsWith("/")) {
      redirectUrl.searchParams.set("redirectedFrom", nextPath);
    }

    return NextResponse.redirect(redirectUrl, 307);
  }

  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    (req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1");

  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return res;
  }

  if (isLocalDev) {
    console.info("[ReachIQ][middleware] local dev bypass", pathname);
    return res;
  }

  if (!isProtectedPath(pathname)) {
    return res;
  }

  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session }
  } = await supabase.auth.getSession();

  console.info("[ReachIQ][middleware] auth check", pathname, session?.user?.id || "no-user");

  if (!session?.user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|site.webmanifest|logo/).*)"
  ]
};
