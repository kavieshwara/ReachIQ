import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

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

export async function middleware(req: NextRequest) {
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
    "/dashboard/:path*",
    "/admin/:path*",
    "/leads/:path*",
    "/campaigns/:path*",
    "/templates/:path*",
    "/websites/:path*",
    "/follow-ups/:path*",
    "/dashboard/connect/:path*",
    "/connect-whatsapp/:path*",
    "/referral/:path*",
    "/settings/:path*",
    "/support/:path*",
    "/chat/:path*"
  ]
};
