"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Check, Gift, X } from "lucide-react";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { comparisonRows, pricingFaqs, pricingPlans } from "@/components/pricing/pricing-data";
import type { CheckoutPlan } from "@/lib/payment-plans";
import { useUserStore } from "@/store/useUserStore";

type PricingSectionProps = {
  compact?: boolean;
};

export function PricingSection({ compact = false }: PricingSectionProps) {
  const [billingMode, setBillingMode] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan>("starter");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const profile = useUserStore((state) => state.profile);

  const handleUpgrade = (plan: CheckoutPlan) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  return (
    <>
      <section className={cn("space-y-10", compact ? "py-12" : "py-20")}>
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <Badge className="rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-primary">Simple, Transparent Pricing</Badge>
          <div className="space-y-3">
            <h2 className="text-4xl font-semibold tracking-tight text-textPrimary md:text-5xl">Start Free. Scale When Ready.</h2>
            <p className="text-base text-textSecondary md:text-lg">No hidden fees. No lock-in. Upgrade or cancel anytime.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] p-1.5">
            <button
              type="button"
              onClick={() => setBillingMode("monthly")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition",
                billingMode === "monthly" ? "bg-primary text-white shadow-[0_10px_30px_rgba(108,99,255,0.32)]" : "text-textSecondary hover:text-textPrimary"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingMode("yearly")}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition",
                billingMode === "yearly" ? "bg-primary text-white shadow-[0_10px_30px_rgba(108,99,255,0.32)]" : "text-textSecondary hover:text-textPrimary"
              )}
            >
              Yearly
            </button>
            <Badge className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-accent">2 months free</Badge>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {pricingPlans.map((plan) => {
            const checkoutPlan = plan.checkoutPlan;

            return (
              <Card
                key={plan.name}
                className={cn(
                  "relative overflow-hidden border-white/8 bg-surface/90 transition",
                  plan.highlighted
                    ? "scale-[1.02] border-primary/45 shadow-[0_22px_80px_rgba(108,99,255,0.28)]"
                    : plan.borderClass
                )}
              >
                <CardContent className="flex h-full flex-col gap-6 p-7">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <Badge className={cn("rounded-full px-3 py-1.5", plan.highlighted ? "border border-primary/20 bg-primary/12 text-primary" : "border border-white/8 bg-white/[0.04] text-textPrimary")}>
                        {plan.badge}
                      </Badge>
                      {plan.highlighted ? (
                        <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                          Popular
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-textPrimary">{plan.name}</p>
                      <p className={cn("mt-2 text-sm font-medium", plan.accentClass)}>{plan.subtitle}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      {plan.originalPrice ? <span className="text-lg text-textMuted line-through">{plan.originalPrice}</span> : null}
                      <span className="text-4xl font-semibold tracking-tight text-textPrimary">{plan.currentPrice}</span>
                      <span className="pb-1 text-sm text-textSecondary">{plan.priceSuffix}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature.label} className="flex items-start gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3">
                        <div className={cn("mt-0.5 flex h-6 w-6 items-center justify-center rounded-full", feature.included ? "bg-success/12 text-success" : "bg-danger/12 text-danger")}>
                          {feature.included ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </div>
                        <p className={cn("text-sm leading-6", feature.included ? "text-textSecondary" : "text-textMuted")}>{feature.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto space-y-3 pt-2">
                    {plan.buttonHref ? (
                      <Link href={plan.buttonHref}>
                        <Button className="w-full">{plan.buttonLabel}</Button>
                      </Link>
                    ) : checkoutPlan ? (
                      <Button
                        className={cn(
                          "w-full",
                          plan.buttonVariant === "primary" && "bg-cta-gradient text-white shadow-[0_18px_40px_rgba(108,99,255,0.32)]"
                        )}
                        variant={plan.buttonVariant || (plan.highlighted ? "primary" : "secondary")}
                        onClick={() => handleUpgrade(checkoutPlan)}
                      >
                        {plan.buttonLabel}
                      </Button>
                    ) : (
                      <Button className="w-full opacity-80" disabled={plan.buttonDisabled}>
                        {plan.buttonLabel}
                      </Button>
                    )}

                    <p className="text-center text-sm text-textSecondary">{plan.helperText}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="overflow-hidden border-transparent bg-[linear-gradient(135deg,rgba(108,99,255,0.95),rgba(0,217,166,0.85))] shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
          <CardContent className="flex flex-col gap-6 p-7 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3 text-white">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-semibold">Share ReachIQ, Earn More Messages</p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/85">
                  For every friend who signs up with your link, you both get +10 messages/day forever. Refer 10 friends and you can run 130 messages/day even on the free plan.
                </p>
              </div>
            </div>
            <Link href="/referral">
              <Button variant="secondary" className="border-white/20 bg-white text-slate-950 hover:bg-white/90">
                Get Your Referral Link
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-textPrimary">Compare plans at a glance</p>
            <p className="text-sm text-textSecondary">Everything you need to see exactly how ReachIQ grows with you.</p>
          </div>
          <div className="scrollbar-thin overflow-x-auto rounded-[30px] border border-white/8 bg-surface/70">
            <table className="min-w-[760px] w-full border-collapse">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-textMuted">Feature</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-accent">Free</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-primary">Starter</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-warning">Pro</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row[0]} className="border-b border-white/6 last:border-b-0">
                    {row.map((cell, index) => (
                      <td key={`${row[0]}-${index}`} className={cn("px-6 py-4 text-sm", index === 0 ? "font-medium text-textPrimary" : "text-textSecondary")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-2xl font-semibold text-textPrimary">Frequently asked questions</p>
            <p className="text-sm text-textSecondary">The practical questions we hear from freelancers, agencies, and solo operators every day.</p>
          </div>
          <div className="space-y-3">
            {pricingFaqs.map((faq, index) => {
              const open = openFaq === index;
              return (
                <Card key={faq.question} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-base font-medium text-textPrimary">{faq.question}</span>
                    <ChevronDown className={cn("h-5 w-5 shrink-0 text-textSecondary transition", open ? "rotate-180" : "")} />
                  </button>
                  {open ? (
                    <div className="border-t border-white/8 px-6 py-5 text-sm leading-6 text-textSecondary">
                      {faq.answer}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/6">
          <CardContent className="space-y-5 py-9 text-center">
            <div className="space-y-3">
              <p className="text-3xl font-semibold text-textPrimary">Ready to get your first client today?</p>
              <p className="text-sm text-textSecondary">Start with the free plan, then scale into automation once you're ready.</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Link href="/signup">
                <Button className="px-8 py-3 text-base">Start Free - No Card Needed</Button>
              </Link>
              <p className="text-sm text-textSecondary">Join 247 freelancers already using ReachIQ</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <PaymentModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={selectedPlan}
        userEmail={profile?.email || ""}
        userName={profile?.full_name || ""}
      />
    </>
  );
}
