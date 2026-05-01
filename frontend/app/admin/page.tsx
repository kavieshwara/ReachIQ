"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, BarChart3, CreditCard, LifeBuoy, RefreshCcw, Rocket, ShieldCheck, Users } from "lucide-react";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

type AdminStats = {
  users: number;
  campaigns: number;
  leads: number;
  websites: number;
  activeCampaigns: number;
  premiumUsers: number;
  newToday: number;
  newThisWeek: number;
  totalMessagesSent: number;
  openTickets: number;
  paymentsEnabled: boolean;
};

type DashboardErrorState = {
  title: string;
  message: string;
  actionLabel?: string;
};

const quickLinks = [
  {
    href: "/admin/users",
    title: "User accounts",
    description: "Review plans, message usage, and WhatsApp connection health.",
    icon: Users
  },
  {
    href: "/admin/campaigns",
    title: "Campaign ops",
    description: "Watch send volume, pause risky flows, and inspect delivery stats.",
    icon: Rocket
  },
  {
    href: "/admin/tickets",
    title: "Support queue",
    description: "Triage open tickets and reply to customers without leaving the app.",
    icon: LifeBuoy
  }
];

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<DashboardErrorState | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setErrorState(null);

    try {
      const response = await api.get("/api/admin/stats");
      setStats(response.data || null);
    } catch (error: any) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.error;

      if (status === 401) {
        setErrorState({
          title: "Your admin session needs a refresh",
          message:
            "ReachIQ could not verify your admin session for this dashboard request. Refresh once or sign in again, then we can load the live admin metrics safely.",
          actionLabel: "Retry admin dashboard"
        });
      } else if (status === 403) {
        setErrorState({
          title: "Admin access is blocked for this account",
          message:
            "The admin dashboard request was denied by the backend. This usually means the current account is not marked as admin in the live profile table.",
          actionLabel: "Retry admin dashboard"
        });
      } else {
        setErrorState({
          title: "Admin metrics are temporarily unavailable",
          message: backendMessage || "The admin stats endpoint did not return successfully. The rest of ReachIQ is still intact, but these numbers need another try.",
          actionLabel: "Retry admin dashboard"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin control"
        title="ReachIQ operations"
        description="Keep the platform healthy, watch growth metrics, and make product-level decisions without leaving the console."
        actions={
          <>
            <Link href="/admin/settings">
              <Button variant="secondary">Platform settings</Button>
            </Link>
            <Link href="/admin/tickets">
              <Button>Review tickets</Button>
            </Link>
          </>
        }
      />

      {errorState ? (
        <Card className="border-danger/20 bg-danger/6">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/12 text-danger">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-textPrimary">{errorState.title}</p>
                <p className="max-w-3xl text-sm leading-6 text-textSecondary">{errorState.message}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => void loadStats()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                {errorState.actionLabel || "Retry"}
              </Button>
              <Link href="/dashboard">
                <Button>Back to dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-[28px]" />)
        ) : (
          <>
            <StatsCard label="Total users" value={stats?.users || 0} hint={`${stats?.newToday || 0} new today`} icon={<Users className="h-4 w-4" />} />
            <StatsCard label="Live campaigns" value={stats?.activeCampaigns || 0} hint={`${stats?.campaigns || 0} total campaigns`} icon={<Rocket className="h-4 w-4" />} />
            <StatsCard label="Messages sent" value={stats?.totalMessagesSent || 0} hint={`${stats?.premiumUsers || 0} premium accounts`} icon={<BarChart3 className="h-4 w-4" />} />
            <StatsCard label="Open tickets" value={stats?.openTickets || 0} hint={`${stats?.newThisWeek || 0} new users this week`} icon={<LifeBuoy className="h-4 w-4" />} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-textSecondary">Platform snapshot</p>
                <h3 className="mt-1 text-2xl font-semibold text-textPrimary">Core operational metrics</h3>
              </div>
              <Badge variant={stats?.paymentsEnabled ? "success" : "warning"}>
                {stats?.paymentsEnabled ? "Payments on" : "Payments off"}
              </Badge>
            </div>

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: "Leads tracked", value: stats?.leads || 0, icon: Users },
                  { label: "Websites generated", value: stats?.websites || 0, icon: ShieldCheck },
                  { label: "Premium conversion", value: `${stats?.users ? Math.round(((stats?.premiumUsers || 0) / stats.users) * 100) : 0}%`, icon: CreditCard },
                  { label: "Campaign inventory", value: formatNumber(stats?.campaigns || 0), icon: Rocket }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-textSecondary">{item.label}</p>
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                      <p className="mt-4 text-3xl font-semibold text-textPrimary">{item.value}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-5">
            <div>
              <p className="text-sm font-medium text-textSecondary">Admin shortcuts</p>
              <h3 className="mt-1 text-2xl font-semibold text-textPrimary">Move faster</h3>
            </div>
            <div className="space-y-3">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="block rounded-[24px] border border-white/8 bg-white/[0.04] p-4 transition hover:border-primary/25 hover:bg-white/[0.06]">
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-textPrimary">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-textSecondary">{item.description}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 text-textMuted" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
