"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, ChevronLeft, ChevronRight, CreditCard, Globe2, LayoutDashboard, LifeBuoy, Megaphone, MessageSquare, Search, Settings, Sparkles, Users, WalletCards } from "lucide-react";
import { Logo, LogoIcon } from "@/components/brand/Logo";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { Button } from "@/components/ui/button";
import { getRecommendedCheckoutPlan, type CheckoutPlan } from "@/lib/payment-plans";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/leads/find", label: "Find Leads", icon: Search },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/templates", label: "Templates", icon: Sparkles },
  { href: "/websites", label: "Websites", icon: Globe2 },
  { href: "/follow-ups", label: "Follow-ups", icon: MessageSquare },
  { href: "/dashboard/connect", label: "Connect WA", icon: WalletCards },
  { href: "/referral", label: "Referral", icon: Bot },
  { href: "/chat", label: "AI Chat", icon: BarChart3 },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUserStore();
  const [collapsed, setCollapsed] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan>(getRecommendedCheckoutPlan(profile?.plan));
  const navItems = profile?.role === "admin"
    ? [...items, { href: "/admin", label: "Admin", icon: LayoutDashboard }]
    : items;
  const recommendedPlan = getRecommendedCheckoutPlan(profile?.plan);
  const showUpgradePrompt = !collapsed && String(profile?.plan || "").toLowerCase() !== "pro";

  const openCheckout = () => {
    setSelectedPlan(recommendedPlan);
    setCheckoutOpen(true);
  };

  return (
    <>
      <aside className={cn("hidden min-h-screen shrink-0 border-r border-[#2A2A3D] bg-[#0A0A0F] px-4 py-6 backdrop-blur-xl transition-all duration-200 lg:block", collapsed ? "w-20" : "w-72")}>
      <div className="mb-6 flex items-center justify-between border-b border-[#2A2A3D] px-2 pb-5">
        {collapsed ? <LogoIcon size="sm" /> : <Logo variant="full" size="sm" theme="dark" href="/dashboard" />}
        <button type="button" onClick={() => setCollapsed((current) => !current)} className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-xl text-textMuted transition hover:bg-white/[0.04] hover:text-textPrimary">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      {!collapsed ? (
      <div className="mb-6 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary/80">Workspace</p>
        <p className="mt-2 text-sm text-textPrimary">Campaign ops, websites, outreach, and follow-ups in one flow.</p>
      </div>
      ) : null}
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition",
                active
                  ? "border border-primary/20 bg-primary/12 text-textPrimary shadow-[0_8px_30px_rgba(108,99,255,0.12)]"
                  : "border border-transparent text-textSecondary hover:border-white/8 hover:bg-white/[0.04] hover:text-textPrimary"
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-primary/18 text-primary" : "bg-white/[0.04] text-textSecondary")}>
                <Icon className="h-4 w-4" />
              </span>
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>
      {showUpgradePrompt ? (
        <div className="mt-8 rounded-[24px] border border-primary/20 bg-primary/8 p-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-textPrimary">
              {recommendedPlan === "starter" ? "Unlock Starter" : "Step up to Pro"}
            </p>
            <p className="text-xs leading-6 text-textSecondary">
              Open the manual UPI checkout whenever you want more daily messages, larger campaign capacity, or faster support.
            </p>
          </div>
          <Button className="mt-4 w-full" onClick={openCheckout}>
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade now
          </Button>
        </div>
      ) : null}
    </aside>

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
