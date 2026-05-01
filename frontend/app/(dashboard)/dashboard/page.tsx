"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ArrowUpRight, BarChart3, Clock3, MessageSquareText, Rocket, Search, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { getRecommendedCheckoutPlan, type CheckoutPlan } from "@/lib/payment-plans";
import { useUserStore } from "@/store/useUserStore";
import { GettingStartedChecklist } from "@/components/dashboard/GettingStartedChecklist";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReferralWidget } from "@/components/shared/ReferralWidget";
import { PageHeader } from "@/components/shared/PageHeader";
import { UsageStatusBanner } from "@/components/shared/UsageStatusBanner";
import { Skeleton } from "@/components/ui/skeleton";

const MessageGauge = dynamic(
  () => import("@/components/dashboard/MessageGauge").then((mod) => mod.MessageGauge),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[172px] rounded-[28px]" />
  }
);

const CampaignList = dynamic(
  () => import("@/components/dashboard/CampaignList").then((mod) => mod.CampaignList),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-[24px]" />
        <Skeleton className="h-24 rounded-[24px]" />
      </div>
    )
  }
);

export default function DashboardPage() {
  const { profile, refreshProfile } = useUserStore();
  const [stats, setStats] = useState<any>({});
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan>("starter");
  const totalAllowance = (profile?.messages_limit || 0) + (profile?.bonus_messages || 0);
  const setupComplete = Boolean(profile?.whatsapp_connected) && Number(stats.totalLeads || 0) > 0 && Number(stats.totalCampaigns || campaigns.length || 0) > 0;
  const recommendedPlan = getRecommendedCheckoutPlan(profile?.plan);
  const showUpgradeCard = String(profile?.plan || "").toLowerCase() !== "pro";

  const loadDashboard = async ({ withLoader = false }: { withLoader?: boolean } = {}) => {
    if (withLoader) {
      setLoading(true);
    }

    setLoadError(null);

    try {
      const { data } = await api.get("/api/dashboard/summary");
      setCampaigns(data.recentCampaigns || []);
      setStats(data.stats || {});
      setSettings(Array.isArray(data.settings) ? data.settings : []);
    } catch (error: any) {
      console.error("[ReachIQ][dashboard] failed to load workspace data", error);
      const message = error?.response?.status === 401
        ? "Your session is not ready yet. Please refresh once and try again."
        : "Dashboard data could not be loaded right now.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile().catch(() => null);
    loadDashboard({ withLoader: true }).catch(() => null);
  }, [refreshProfile]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshProfile().catch(() => null);
      loadDashboard().catch(() => null);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [refreshProfile]);

  useEffect(() => {
    if (!profile?.id || typeof window === "undefined" || setupComplete) {
      return;
    }

    const storageKey = `reachiq:welcome-shown:${profile.id}`;
    const hasShown = window.localStorage.getItem(storageKey) === "true";
    if (!hasShown) {
      setShowWelcome(true);
    }
  }, [profile?.id, setupComplete]);

  const dismissWelcome = () => {
    if (profile?.id && typeof window !== "undefined") {
      window.localStorage.setItem(`reachiq:welcome-shown:${profile.id}`, "true");
    }
    setShowWelcome(false);
  };

  const announcement = settings.find((item) => item.key === "platform_announcement")?.value;
  const openCheckout = (plan: CheckoutPlan) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        description="Track your lead flow, watch usage, and launch the next round of outreach from one clean workspace."
        actions={
          <>
            <Link href="/campaigns/new">
              <Button>Launch campaign</Button>
            </Link>
            <Link href="/leads/find">
              <Button variant="secondary">Discover leads</Button>
            </Link>
          </>
        }
      />

      {announcement ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-textSecondary">{announcement}</CardContent>
        </Card>
      ) : null}

      <GettingStartedChecklist
        userId={profile?.id}
        whatsappConnected={Boolean(profile?.whatsapp_connected)}
        totalLeads={Number(stats.totalLeads || 0)}
        totalCampaigns={Number(stats.totalCampaigns || campaigns.length || 0)}
      />

      {loadError ? (
        <Card className="border-danger/30 bg-danger/8">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-textSecondary">{loadError}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Refresh dashboard
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!profile?.whatsapp_connected ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-textSecondary">Connect WhatsApp to start sending messages.</p>
            <Link href="/dashboard/connect">
              <Button variant="secondary">Connect WhatsApp</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <UsageStatusBanner context="dashboard" />

      {showUpgradeCard ? (
        <Card className="border-primary/20 bg-[linear-gradient(135deg,rgba(108,99,255,0.14),rgba(75,68,204,0.08))]">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-textPrimary">
                {recommendedPlan === "starter" ? "Unlock Starter checkout" : "Upgrade to Pro when you need more scale"}
              </p>
              <p className="max-w-3xl text-sm leading-6 text-textSecondary">
                ReachIQ now has manual UPI checkout built in. Open the payment modal, scan the QR, submit your UPI transaction ID, and the admin team can activate your new quota after review.
              </p>
            </div>
            <Button onClick={() => openCheckout(recommendedPlan)}>
              <Sparkles className="mr-2 h-4 w-4" />
              {recommendedPlan === "starter" ? "Open Starter checkout" : "Open Pro checkout"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showWelcome ? (
        <Card className="border-primary/20 bg-[linear-gradient(135deg,rgba(108,99,255,0.12),rgba(0,217,166,0.06))]">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-textPrimary">Welcome to ReachIQ</p>
              <p className="max-w-3xl text-sm leading-6 text-textSecondary">
                We’ll keep the first run simple: connect WhatsApp, save a few leads, then launch one small campaign so you can validate the full flow before scaling up.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/connect">
                <Button>Start guided setup</Button>
              </Link>
              <Button variant="secondary" onClick={dismissWelcome}>
                Hide for now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-[28px]" />)
        ) : (
          <>
            <StatsCard label="Messages sent today" value={`${profile?.messages_sent_today || 0} / ${(profile?.messages_limit || 0) + (profile?.bonus_messages || 0)}`} hint="Daily plan usage" icon={<MessageSquareText className="h-4 w-4" />} />
            <StatsCard label="Active campaigns" value={stats.activeCampaigns || 0} hint={`${stats.totalFollowups || 0} scheduled follow-ups`} icon={<Rocket className="h-4 w-4" />} />
            <StatsCard label="Lead inventory" value={stats.totalLeads || 0} hint="All prospects in your pipeline" icon={<Search className="h-4 w-4" />} />
            <StatsCard label="Replies received" value={stats.repliesReceived || 0} hint="Across your latest campaigns" icon={<BarChart3 className="h-4 w-4" />} />
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["/leads/find", "Find New Leads", Search],
          ["/campaigns/new", "New Campaign", Rocket],
          ["/websites", "Generate Website", Sparkles],
          ["/chat", "Open AI Chat", MessageSquareText]
        ].map(([href, label, Icon]) => {
          const Resolved = Icon as any;
          return (
            <Link href={href as string} key={href as string}>
              <Card className="h-full transition hover:-translate-y-1 hover:border-primary/30">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Resolved className="h-5 w-5" />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <p className="font-medium text-textPrimary">{label as string}</p>
                    <ArrowUpRight className="h-4 w-4 text-textMuted" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <MessageGauge used={profile?.messages_sent_today || 0} total={(profile?.messages_limit || 0) + (profile?.bonus_messages || 0)} />
        <ReferralWidget code={profile?.referral_code} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-textSecondary">Pipeline snapshot</p>
                <h3 className="mt-1 text-2xl font-semibold text-textPrimary">What deserves attention next</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Target className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Leads ready to pitch", value: stats.totalLeads || 0, icon: Search },
                { label: "Pending follow-ups", value: stats.totalFollowups || 0, icon: Clock3 },
                { label: "Reply rate", value: campaigns.length ? `${Math.round((campaigns.reduce((sum, campaign) => sum + Number(campaign.replied_count || 0), 0) / Math.max(campaigns.reduce((sum, campaign) => sum + Number(campaign.sent_count || 0), 0), 1)) * 100)}%` : "0%", icon: BarChart3 }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-textSecondary">{item.label}</p>
                      <Icon className="h-4 w-4 text-textMuted" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-textPrimary">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-textSecondary">Recommended next steps</p>
              <h3 className="mt-1 text-2xl font-semibold text-textPrimary">Stay in motion</h3>
            </div>
            {[
              {
                href: "/leads",
                title: "Clean your lead list",
                copy: "Review contact quality before you launch the next outbound push."
              },
              {
                href: "/follow-ups",
                title: "Check follow-up timing",
                copy: "Make sure warm leads get the next message at the right moment."
              },
              {
                href: "/templates",
                title: "Refresh your pitch",
                copy: "Tighten your best template before the next campaign wave."
              }
            ].map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-[22px] border border-white/8 bg-white/[0.04] p-4 transition hover:border-primary/25 hover:bg-white/[0.06]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-textPrimary">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-textSecondary">{item.copy}</p>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 text-textMuted" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xl font-semibold text-textPrimary">Recent campaigns</p>
          <Link href="/campaigns">
            <Button variant="ghost">View all</Button>
          </Link>
        </div>
        <CampaignList campaigns={campaigns} />
      </div>

      <PaymentModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={selectedPlan}
        userEmail={profile?.email || ""}
        userName={profile?.full_name || ""}
      />
    </div>
  );
}
