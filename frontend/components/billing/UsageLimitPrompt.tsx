"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Clock3, Sparkles } from "lucide-react";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usageLimitEventName } from "@/lib/api";
import { getRecommendedCheckoutPlan } from "@/lib/payment-plans";
import { useUserStore } from "@/store/useUserStore";

type LimitPromptState = {
  message: string;
  upgradeRequired: boolean;
  totalLimit?: number;
};

export function UsageLimitPrompt() {
  const profile = useUserStore((state) => state.profile);
  const [state, setState] = useState<LimitPromptState | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<LimitPromptState>).detail;
      if (!detail) {
        return;
      }

      setState({
        message: detail.message || "Your current plan has reached its daily sending allowance.",
        upgradeRequired: Boolean(detail.upgradeRequired),
        totalLimit: detail.totalLimit
      });
    };

    window.addEventListener(usageLimitEventName, handleEvent as EventListener);
    return () => {
      window.removeEventListener(usageLimitEventName, handleEvent as EventListener);
    };
  }, []);

  const totalAllowance = useMemo(
    () => Number(profile?.messages_limit || 0) + Number(profile?.bonus_messages || 0),
    [profile?.bonus_messages, profile?.messages_limit]
  );
  const recommendedPlan = getRecommendedCheckoutPlan(profile?.plan);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (Number(profile.messages_sent_today || 0) >= totalAllowance && totalAllowance > 0) {
      setState({
        message: "You've used today's message allowance. ReachIQ will reset the quota at 12:00 AM Asia/Kolkata.",
        upgradeRequired: String(profile.plan || "").toLowerCase() !== "premium",
        totalLimit: totalAllowance
      });
      return;
    }

    setState((current) => {
      if (!current) {
        return current;
      }

      return Number(profile.messages_sent_today || 0) >= totalAllowance ? current : null;
    });
  }, [profile, totalAllowance]);

  if (!state) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-x-4 bottom-4 z-[80] sm:left-auto sm:right-6 sm:w-[420px]">
        <Card className="border-warning/25 bg-[#171723]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warning/12 text-warning">
                {state.upgradeRequired ? <Sparkles className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-textPrimary">
                  {state.upgradeRequired ? "Daily limit reached" : "Today's allowance is used up"}
                </p>
                <p className="text-sm leading-6 text-textSecondary">{state.message}</p>
                {state.totalLimit ? (
                  <p className="text-xs text-textMuted">
                    Current allowance: {state.totalLimit} messages per day
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-textSecondary">
              <div className="flex items-center gap-2 text-textPrimary">
                <Clock3 className="h-4 w-4 text-primary" />
                Reset window: every day at 12:00 AM Asia/Kolkata
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {state.upgradeRequired ? (
                <Button className="flex-1" onClick={() => setCheckoutOpen(true)}>
                  Upgrade plan
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button className="flex-1" onClick={() => setState(null)}>
                  Back to dashboard
                </Button>
              )}
              <Button variant="secondary" className="sm:w-auto" onClick={() => setState(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={recommendedPlan}
        userEmail={profile?.email || ""}
        userName={profile?.full_name || ""}
      />
    </>
  );
}
