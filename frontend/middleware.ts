import { NextResponse, type NextRequest } from "next/server";

const primaryHostedHost = "reachiq-zeta.vercel.app";
const legacyHostedHosts = new Set(["reachiq-kavieshwaras-projects.vercel.app"]);
const hostedReachiqHostPattern = /^reachiq(?:-[a-z0-9-]+)?\.vercel\.app$/i;

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|site.webmanifest|logo/).*)"
  ]
};
