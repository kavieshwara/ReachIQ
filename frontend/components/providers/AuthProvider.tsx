"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { FullPageAuthLoader } from "@/components/auth/FullPageAuthLoader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const authSensitiveRoutes = [
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/auth/callback",
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

function isAuthSensitivePath(pathname: string) {
  return authSensitiveRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAuthPage(pathname: string) {
  return ["/login", "/signup", "/forgot-password", "/verify-email", "/auth/callback"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function AuthProviderContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const { authStatus, boot, signOut } = useUserStore();
  const redirectKeyRef = useRef<string | null>(null);
  const stuckRedirectRef = useRef<string | null>(null);
  const authPage = useMemo(() => isAuthPage(pathname), [pathname]);
  const redirectedFrom = pathname === "/login" ? searchParams?.get("redirectedFrom") : null;
  const destination = redirectedFrom && redirectedFrom.startsWith("/")
    ? redirectedFrom
    : "/dashboard";

  const navigateToDestination = (target: string) => {
    if (typeof window !== "undefined") {
      window.location.replace(target);
      return;
    }

    router.replace(target);
  };

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !authPage) {
      if (authStatus !== "loading") {
        redirectKeyRef.current = null;
        stuckRedirectRef.current = null;
      }
      return;
    }

    const redirectKey = `${pathname}->${destination}`;

    if (redirectKeyRef.current === redirectKey) {
      return;
    }

    redirectKeyRef.current = redirectKey;
    console.info("[ReachIQ][auth] AuthProvider redirect ->", destination, `reason=authenticated:${pathname}`);
    navigateToDestination(destination);
  }, [authPage, authStatus, destination, pathname, router]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !authPage) {
      return undefined;
    }

    const redirectKey = `${pathname}->${destination}`;
    const timer = window.setTimeout(() => {
      if (redirectKeyRef.current === redirectKey) {
        console.info("[ReachIQ][auth] redirect recovery activated", redirectKey);
        stuckRedirectRef.current = redirectKey;
      }
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [authPage, authStatus, destination, pathname]);

  if (isAuthSensitivePath(pathname) && authStatus === "loading") {
    return <FullPageAuthLoader />;
  }

  if (authPage && authStatus === "authenticated") {
    const redirectKey = `${pathname}->${destination}`;

    if (stuckRedirectRef.current === redirectKey) {
      return (
        <div className="flex min-h-screen items-center justify-center px-5">
          <Card className="w-full max-w-xl">
            <CardContent className="space-y-5 p-8 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-textPrimary">Session recovery</h1>
                <p className="text-sm text-textSecondary">
                  ReachIQ restored your login, but the protected route did not open cleanly yet. We can recover from here without leaving you on an endless loader.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button onClick={() => navigateToDestination(destination)}>Try again</Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await signOut();
                    navigateToDestination("/login");
                  }}
                >
                  Sign out and retry
                </Button>
              </div>
              <p className="text-xs text-textMuted">Target route: {destination}</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return <FullPageAuthLoader description="Redirecting you into ReachIQ..." />;
  }

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<FullPageAuthLoader />}>{<AuthProviderContent>{children}</AuthProviderContent>}</Suspense>;
}
