"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { FullPageAuthLoader } from "@/components/auth/FullPageAuthLoader";
import { buildBrowserAppUrl } from "@/lib/public-url";
import { supabase } from "@/lib/supabase";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

function buildAuthErrorMessage(errorDescription?: string | null) {
  if (errorDescription?.includes("exchange external code")) {
    return "Google login could not be completed. Check the Supabase Google client settings, the Supabase callback URL in Google Cloud, and make sure this Google account is allowed as a test user if the OAuth app is still in testing.";
  }

  return errorDescription || "Authentication could not be completed right now.";
}

function redirectToLogin(message: string, nextPath: string) {
  const loginUrl = new URL(buildBrowserAppUrl("/login"));
  loginUrl.searchParams.set("authError", message);
  if (nextPath.startsWith("/")) {
    loginUrl.searchParams.set("redirectedFrom", nextPath);
  }
  window.location.replace(loginUrl.toString());
}

function CallbackProcessor() {
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const params = searchParams ?? new URLSearchParams();
      const nextPath = sanitizeNextPath(params.get("next"));
      const explicitError = params.get("error");
      const errorDescription = params.get("error_description");

      if (explicitError) {
        redirectToLogin(buildAuthErrorMessage(errorDescription), nextPath);
        return;
      }

      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;

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

        if (!cancelled) {
          window.location.replace(buildBrowserAppUrl(nextPath));
        }
      } catch (error: any) {
        if (!cancelled) {
          redirectToLogin(buildAuthErrorMessage(error?.message || errorDescription), nextPath);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return <FullPageAuthLoader description="Completing your ReachIQ sign-in..." />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageAuthLoader description="Preparing your authentication callback..." />}>
      <CallbackProcessor />
    </Suspense>
  );
}
