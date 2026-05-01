"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCheckoutPlanLabel, getRecommendedCheckoutPlan, type CheckoutPlan } from "@/lib/payment-plans";
import { useUserStore } from "@/store/useUserStore";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const { profile, refreshProfile, signOut } = useUserStore();
  const [tab, setTab] = useState("profile");
  const [fullName, setFullName] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan>("starter");

  const totalAllowance = Number(profile?.messages_limit || 0) + Number(profile?.bonus_messages || 0);
  const recommendedPlan = getRecommendedCheckoutPlan(profile?.plan);
  const currentPlanLabel = getCheckoutPlanLabel(profile?.plan);

  useEffect(() => {
    setFullName(profile?.full_name || "");
  }, [profile?.full_name]);

  const openCheckout = (plan: CheckoutPlan) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  const saveProfile = async () => {
    try {
      await supabase
        .from("profiles")
        .update({
          full_name: fullName
        })
        .eq("id", profile?.id);

      await refreshProfile();
      toast.success("Settings updated");
    } catch {
      toast.error("Could not save settings");
    }
  };

  const deleteAccount = async () => {
    toast.error("Delete account flow still needs a backend action. The UI is ready, but the destructive path is not wired yet.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        {["profile", "plan", "notifications", "whatsapp", "danger"].map((item) => (
          <Button key={item} variant={tab === item ? "primary" : "secondary"} onClick={() => setTab(item)}>
            {item}
          </Button>
        ))}
      </div>

      {tab === "profile" ? (
        <Card>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-textPrimary">Full name</p>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-textPrimary">Lead search</p>
              <p className="text-sm text-textSecondary">
                ReachIQ handles business discovery on the backend now. You do not need to create or paste any Google Maps API key to use Find Leads.
              </p>
            </div>

            <Button onClick={saveProfile}>Save changes</Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === "plan" ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-textMuted">Current plan</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-2xl font-semibold text-textPrimary">{currentPlanLabel}</p>
                    <Badge variant={String(profile?.plan || "").toLowerCase() === "pro" ? "warning" : String(profile?.plan || "").toLowerCase() === "starter" ? "default" : "muted"}>
                      {currentPlanLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-textSecondary">
                    Daily allowance: {Number(profile?.messages_sent_today || 0)} / {totalAllowance} messages used today
                  </p>
                </div>

                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-textSecondary">
                  Recommended next step: <span className="font-medium text-textPrimary">{recommendedPlan === "starter" ? "Starter" : "Pro"} checkout</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-primary/20 bg-primary/6">
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-textPrimary">Starter</p>
                  <p className="text-sm text-textSecondary">For freelancers who want more daily outreach without jumping straight to the top tier.</p>
                </div>
                <p className="text-3xl font-semibold text-textPrimary">Rs 499</p>
                <ul className="space-y-2 text-sm text-textSecondary">
                  <li>200 messages per day</li>
                  <li>10 campaigns</li>
                  <li>Auto follow-ups</li>
                </ul>
                <Button className="w-full" onClick={() => openCheckout("starter")}>
                  Open Starter checkout
                </Button>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-warning/6">
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xl font-semibold text-textPrimary">Pro</p>
                  <p className="text-sm text-textSecondary">For agency-style usage, heavier automation, and more breathing room per day.</p>
                </div>
                <p className="text-3xl font-semibold text-textPrimary">Rs 999</p>
                <ul className="space-y-2 text-sm text-textSecondary">
                  <li>1000 messages per day</li>
                  <li>Unlimited campaigns</li>
                  <li>Priority support</li>
                </ul>
                <Button className="w-full" onClick={() => openCheckout("pro")}>
                  Open Pro checkout
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "notifications" ? (
        <Card>
          <CardContent className="space-y-3 text-sm text-textSecondary">
            <p>Email notifications for campaign completion and replies are still scaffolded.</p>
            <p>The page is ready for those toggles once the email preference columns are added to Supabase.</p>
          </CardContent>
        </Card>
      ) : null}

      {tab === "whatsapp" ? (
        <Card>
          <CardContent className="space-y-3 text-sm text-textSecondary">
            <p>Use the dedicated Connection Center at /dashboard/connect to manage QR sessions, Meta API credentials, and test delivery.</p>
          </CardContent>
        </Card>
      ) : null}

      {tab === "danger" ? (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm text-textSecondary">Sign out of this device or remove your ReachIQ account.</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => signOut()}>
                Sign out
              </Button>
              <Button variant="danger" onClick={deleteAccount}>
                Delete account
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
