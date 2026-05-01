"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, MessageSquareText, Rocket, Search, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type GettingStartedChecklistProps = {
  userId?: string | null;
  whatsappConnected: boolean;
  totalLeads: number;
  totalCampaigns: number;
};

export function GettingStartedChecklist({
  userId,
  whatsappConnected,
  totalLeads,
  totalCampaigns
}: GettingStartedChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  const storageKey = useMemo(
    () => (userId ? `reachiq:onboarding-dismissed:${userId}` : null),
    [userId]
  );

  const steps = useMemo(
    () => [
      {
        title: "Connect WhatsApp",
        description: "Link the sender you'll use for campaigns and follow-ups.",
        href: "/dashboard/connect",
        icon: WalletCards,
        complete: whatsappConnected
      },
      {
        title: "Add your first leads",
        description: "Find local businesses or import your list so ReachIQ has people to contact.",
        href: "/leads/find",
        icon: Search,
        complete: totalLeads > 0
      },
      {
        title: "Launch your first campaign",
        description: "Choose the leads, confirm the message, and let ReachIQ handle the sequence.",
        href: "/campaigns/new",
        icon: Rocket,
        complete: totalCampaigns > 0
      }
    ],
    [totalCampaigns, totalLeads, whatsappConnected]
  );

  const completedCount = steps.filter((step) => step.complete).length;
  const allDone = completedCount === steps.length;

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(storageKey);
    setDismissed(stored === "true");
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      return;
    }

    if (!dismissed) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, "true");
  }, [dismissed, storageKey]);

  if (dismissed) {
    return null;
  }

  return (
    <Card className="border-primary/18 bg-[linear-gradient(135deg,rgba(108,99,255,0.08),rgba(0,217,166,0.05))]">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <MessageSquareText className="h-3.5 w-3.5" />
              First-time setup
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-textPrimary">
                {allDone ? "Your workspace is ready for live outreach" : "Let's get ReachIQ fully ready"}
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-textSecondary">
                Work through these steps once and the rest of the app gets much smoother. You can dismiss this card any time and bring it back later by clearing local storage.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-textSecondary">
            {completedCount} / {steps.length} complete
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                href={step.href}
                key={step.title}
                className="group rounded-[24px] border border-white/8 bg-white/[0.04] p-4 transition hover:border-primary/30 hover:bg-white/[0.05]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      {step.complete ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-textPrimary">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-textSecondary">{step.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-textMuted transition group-hover:text-textPrimary" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDismissed(true)}>
            Hide for now
          </Button>
          {!allDone ? (
            <Link href={steps.find((step) => !step.complete)?.href || "/dashboard/connect"}>
              <Button>Continue setup</Button>
            </Link>
          ) : (
            <Link href="/campaigns/new">
              <Button>Launch your next campaign</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
