import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { EmailOtpType } from "@supabase/supabase-js";
import { resolveStaticAppUrl } from "@/lib/public-url";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

function buildLoginRedirect(requestUrl: URL, message: string, nextPath: string) {
  const redirectBase = resolveStaticAppUrl() || requestUrl.origin;
  const redirectUrl = new URL("/login", `${redirectBase}/`);
  redirectUrl.searchParams.set("authError", message);
  if (nextPath.startsWith("/")) {
    redirectUrl.searchParams.set("redirectedFrom", nextPath);
  }
  return redirectUrl;
}

function buildAuthErrorMessage(errorDescription?: string | null) {
  if (errorDescription?.includes("exchange external code")) {
    return "Google login could not be completed. Check the Supabase Google client settings, the Supabase callback URL in Google Cloud, and make sure this Google account is allowed as a test user if the OAuth app is still in testing.";
  }

  return errorDescription || "Authentication could not be completed right now.";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const explicitError = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (explicitError) {
    return NextResponse.redirect(buildLoginRedirect(requestUrl, buildAuthErrorMessage(errorDescription), nextPath), 307);
  }

  const supabase = createRouteHandlerClient({ cookies });
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        throw error;
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type
      });

      if (error) {
        throw error;
      }
    }
  } catch (error: any) {
    return NextResponse.redirect(
      buildLoginRedirect(requestUrl, buildAuthErrorMessage(error?.message || errorDescription), nextPath),
      307
    );
  }

  const redirectBase = resolveStaticAppUrl() || requestUrl.origin;
  return NextResponse.redirect(new URL(nextPath, `${redirectBase}/`), 307);
}
