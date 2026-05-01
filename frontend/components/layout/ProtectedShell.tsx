"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileNav } from "@/components/layout/MobileNav";
import { useUserStore } from "@/store/useUserStore";
import { api } from "@/lib/api";
import { isDemoMode, isSupabaseConfigured, supabaseConfigMessage } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FloatingChatbot = dynamic(
  () => import("@/components/chat/FloatingChatbot").then((mod) => mod.FloatingChatbot),
  { ssr: false }
);

const UsageLimitPrompt = dynamic(
  () => import("@/components/billing/UsageLimitPrompt").then((mod) => mod.UsageLimitPrompt),
  { ssr: false }
);

export function ProtectedShell({
  title,
  subtitle,
  adminOnly = false,
  children
}: {
  title: string;
  subtitle?: string;
  adminOnly?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { authStatus, profile, refreshProfile, signOut } = useUserStore();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    refreshProfile().catch(() => null);

    const interval = window.setInterval(() => {
      refreshProfile().catch(() => null);
    }, 30000);

    const handleFocus = () => {
      refreshProfile().catch(() => null);
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [profile?.id, refreshProfile]);

  useEffect(() => {
    api
      .get("/api/platform/settings")
      .then((response) => {
        const settings = Array.isArray(response.data) ? response.data : [];
        const maintenanceFlag = settings.find((item: any) => item.key === "maintenance_mode");
        if (maintenanceFlag?.value === "true" && profile?.role !== "admin") {
          setMaintenance(true);
        }
      })
      .catch(() => null);
  }, [profile?.role]);

  if (!isDemoMode && !isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-textPrimary">Connect Supabase to continue</h1>
              <p className="text-sm text-textSecondary">{supabaseConfigMessage}</p>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => router.push("/login")}>Back to login</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-4 p-8">
            <div className="h-4 w-28 rounded-full bg-white/10" />
            <div className="h-10 w-64 rounded-full bg-white/10" />
            <div className="space-y-3">
              <div className="h-24 rounded-[24px] bg-white/[0.04]" />
              <div className="h-24 rounded-[24px] bg-white/[0.04]" />
            </div>
            <p className="text-sm text-textSecondary">Restoring your ReachIQ workspace...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-textPrimary">Sign in required</h1>
              <p className="text-sm text-textSecondary">
                Your ReachIQ session is not active on this page yet. Sign in again and we will take you straight back into your workspace.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={() => router.replace(`/login?redirectedFrom=${encodeURIComponent(window.location.pathname)}`)}>
                Go to login
              </Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Retry page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-textPrimary">Session not ready</h1>
              <p className="text-sm text-textSecondary">
                ReachIQ could not restore your dashboard session cleanly yet. We are keeping you here instead of bouncing you away so you can recover in one click.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Retry dashboard
              </Button>
              <Button
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                Back to login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (adminOnly && profile.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <Card className="w-full max-w-xl">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold text-textPrimary">Admin access required</h1>
              <p className="text-sm text-textSecondary">Your current account does not have permission to open the ReachIQ admin console.</p>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (maintenance) {
    return <div className="flex min-h-screen items-center justify-center px-6 text-center text-textSecondary">ReachIQ is in maintenance mode. Admin users can still access the dashboard.</div>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden lg:flex">
      {!adminOnly ? <Sidebar /> : null}
      <div className="min-h-screen flex-1 pb-40 lg:pb-0">
        <TopBar title={title} subtitle={subtitle} />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8 lg:px-8">{children}</main>
      </div>
      {!adminOnly ? <MobileNav /> : null}
      <FloatingChatbot />
      <UsageLimitPrompt />
    </div>
  );
}
