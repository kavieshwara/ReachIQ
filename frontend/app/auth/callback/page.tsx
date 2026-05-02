"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FullPageAuthLoader } from "@/components/auth/FullPageAuthLoader";
import { buildBrowserAppUrl } from "@/lib/public-url";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/store/useUserStore";

const AUTH_REDIRECT_STORAGE_KEY = "reachiq_auth_redirect_to";

function buildLoginRedirectUrl(message: string, nextPath?: string | null) {
  const redirectUrl = new URL("/login", buildBrowserAppUrl("/"));
  redirectUrl.searchParams.set("authError", message);
  if (nextPath && nextPath.startsWith("/")) {
    redirectUrl.searchParams.set("redirectedFrom", nextPath);
  }
  return redirectUrl.toString();
}

function buildSafeAuthErrorMessage(errorDescription?: string | null) {
  if (errorDescription?.includes("exchange external code")) {
    return "Google login could not be completed. Check the Supabase Google client settings, the Supabase callback URL in Google Cloud, and make sure this Google account is allowed as a test user if the OAuth app is still in testing.";
  }

  return errorDescription || "Authentication could not be completed right now.";
}

function navigate(to: string, router: ReturnType<typeof useRouter>) {
  if (typeof window !== "undefined") {
    window.location.replace(to);
    return;
  }

  router.replace(to);
}

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { syncSession } = useUserStore();
  const hasRedirectedRef = useRef(false);

  const nextPath = useMemo(() => {
    const next = searchParams?.get("next");
    if (next && next.startsWith("/")) {
      return next;
    }

    if (typeof window !== "undefined") {
      const storedNext = window.sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
      if (storedNext && storedNext.startsWith("/")) {
        return storedNext;
      }
    }

    return "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const clearStoredRedirect = () => {
      window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    };

    if (searchParams?.get("error")) {
      clearStoredRedirect();
      return;
    }

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        clearStoredRedirect();
      }
    });

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, [searchParams]);

  useEffect(() => {
    const error = searchParams?.get("error");
    const errorDescription = searchParams?.get("error_description");

    if (!error || hasRedirectedRef.current) {
      return;
    }

    hasRedirectedRef.current = true;
    navigate(buildLoginRedirectUrl(buildSafeAuthErrorMessage(errorDescription), nextPath), router);
  }, [nextPath, router, searchParams]);

  useEffect(() => {
    if (hasRedirectedRef.current) {
      return;
    }

    let active = true;
    let fallbackTimer: number | null = null;

    const finishWithSession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!active || hasRedirectedRef.current || !session?.user) {
        return false;
      }

      hasRedirectedRef.current = true;
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
      }
      await syncSession(session);
      navigate(nextPath, router);
      return true;
    };

    const recoverSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      return finishWithSession(data.session);
    };

    const run = async () => {
      try {
        const resolvedImmediately = await recoverSession();
        if (resolvedImmediately || !active) {
          return;
        }

        const {
          data: { subscription }
        } = supabase.auth.onAuthStateChange((_event, session) => {
          void finishWithSession(session);
        });

        fallbackTimer = window.setTimeout(async () => {
          if (hasRedirectedRef.current || !active) {
            return;
          }

          const recovered = await recoverSession().catch(() => false);
          if (!recovered && active) {
            hasRedirectedRef.current = true;
            navigate(
              buildLoginRedirectUrl(
                "Google login could not be completed. Check the Supabase Google client settings, the Supabase callback URL in Google Cloud, and make sure this Google account is allowed as a test user if the OAuth app is still in testing.",
                nextPath
              ),
              router
            );
          }
        }, 4500);

        return () => {
          subscription.unsubscribe();
        };
      } catch {
        if (!active || hasRedirectedRef.current) {
          return;
        }

        hasRedirectedRef.current = true;
        navigate(
          buildLoginRedirectUrl(
            "Google login could not be completed. Check the Supabase Google client settings, the Supabase callback URL in Google Cloud, and make sure this Google account is allowed as a test user if the OAuth app is still in testing.",
            nextPath
          ),
          router
        );
      }
    };

    let unsubscribe: (() => void) | undefined;

    void run().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      active = false;
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
      unsubscribe?.();
    };
  }, [nextPath, router, syncSession]);

  return <FullPageAuthLoader description="Completing your ReachIQ sign-in..." />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<FullPageAuthLoader description="Completing your ReachIQ sign-in..." />}>
      <AuthCallbackPageContent />
    </Suspense>
  );
}
