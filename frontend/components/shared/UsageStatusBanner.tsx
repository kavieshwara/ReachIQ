"use client";

import { useState } from "react";
import { Clock3, Sparkles } from "lucide-react";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRecommendedCheckoutPlan } from "@/lib/payment-plans";
import { useUserStore } from "@/store/useUserStore";

type UsageStatusBannerProps = {
  context?: "dashboard" | "campaigns" | "followups";
  compact?: boolean;
};

export function UsageStatusBanner({
  context = "dashboard",
  compact = false
}: UsageStatusBannerProps) {
  const profile = useUserStore((state) => state.profile);
  const refreshProfile = useUserStore((state) => state.refreshProfile);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const totalAllowance = Number(profile?.messages_limit || 0) + Number(profile?.bonus_messages || 0);
  const used = Number(profile?.messages_sent_today || 0);
  const remaining = Math.max(totalAllowance - used, 0);
  const isAtLimit = totalAllowance > 0 && remaining <= 0;
  const isNearLimit = !isAtLimit && totalAllowance > 0 && remaining <= 5;
  const recommendedPlan = getRecommendedCheckoutPlan(profile?.plan);

  if (!isAtLimit && !isNearLimit) {
    return null;
  }

  const title = isAtLimit
    ? "Today's message allowance is used up"
    : `Only ${remaining} messages left today`;

  const description =
    context === "campaigns"
      ? isAtLimit
        ? "You can still prepare assets and save campaigns, but new sends will wait until the reset or an upgrade."
        : "You're close to the cap. Finish the highest-value outreach first before launching the next batch."
      : context === "followups"
        ? isAtLimit
          ? "You can still schedule follow-ups now, and ReachIQ will be ready to send again after the midnight reset."
          : "You're close to the cap. Prioritize the warmest leads before sending more follow-ups."
        : isAtLimit
          ? "ReachIQ will reset your allowance at 12:00 AM Asia/Kolkata. Upgrade now if you need more room today."
          : "You're close to the daily cap. Finish the highest-value outreach first or upgrade before the next campaign wave.";

  return (
    <>
      <Card className={isAtLimit ? "border-danger/30 bg-danger/8" : "border-warning/30 bg-warning/5"}>
        <CardContent className={`flex ${compact ? "flex-col gap-3 p-4" : "flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"}`}>
          <div className="space-y-1">
            <p className="font-medium text-textPrimary">{title}</p>
            <p className="text-sm text-textSecondary">{description}</p>
            <p className="text-xs text-textMuted">
              Usage today: {used} / {totalAllowance} messages
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size={compact ? "sm" : "default"} onClick={() => setCheckoutOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              {isAtLimit ? `Upgrade to ${recommendedPlan === "starter" ? "Starter" : "Pro"}` : "Open checkout"}
            </Button>
            <Button
              variant="secondary"
              size={compact ? "sm" : "default"}
              onClick={() => refreshProfile().catch(() => null)}
            >
              <Clock3 className="mr-2 h-4 w-4" />
              Refresh usage
            </Button>
          </div>
        </CardContent>
      </Card>

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
