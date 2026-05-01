import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (error) {
    const redirectUrl = new URL("/login", request.url);
    const safeMessage = errorDescription?.includes("exchange external code")
      ? "Google login could not be completed. Please check the Google Client ID, client secret, and Supabase callback URL setup."
      : errorDescription || "Google login could not be completed right now.";
    redirectUrl.searchParams.set("authError", safeMessage);
    if (next && next.startsWith("/")) {
      redirectUrl.searchParams.set("redirectedFrom", next);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  const destination = next && next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(new URL(destination, request.url));
}
