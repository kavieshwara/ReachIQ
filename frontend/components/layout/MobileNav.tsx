"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  Bot,
  CreditCard,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Search,
  Settings,
  Sparkles,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { DOCS_URL } from "@/lib/docs";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/useUserStore";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/leads/find", label: "Find", icon: Search },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone }
];

const secondaryItems = [
  { href: "/templates", label: "Templates", icon: Sparkles },
  { href: "/websites", label: "Websites", icon: Globe2 },
  { href: "/follow-ups", label: "Follow-ups", icon: MessageSquare },
  { href: "/dashboard/connect", label: "Connect WA", icon: WalletCards },
  { href: "/referral", label: "Referral", icon: Bot },
  { href: "/chat", label: "AI Chat", icon: BarChart3 },
  { href: "/pricing", label: "Pricing", icon: CreditCard },
  { href: DOCS_URL, label: "Docs", icon: BookOpenText, external: true },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/settings", label: "Settings", icon: Settings }
];

function isRouteActive(pathname: string, href: string) {
  if (/^https?:\/\//i.test(href)) {
    return false;
  }

  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

export function MobileNav() {
  const pathname = usePathname() ?? "";
  const profile = useUserStore((state) => state.profile);
  const [moreOpen, setMoreOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const moreItems =
    profile?.role === "admin"
      ? [...secondaryItems, { href: "/admin", label: "Admin", icon: LayoutDashboard }]
      : secondaryItems;

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [moreOpen]);

  const moreActive = moreItems.some((item) => isRouteActive(pathname, item.href));

  return (
    <>
      {moreOpen ? <div className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px] lg:hidden" /> : null}

      {moreOpen ? (
        <div
          ref={panelRef}
          className="fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 max-h-[calc(100dvh-9rem)] overflow-y-auto rounded-[28px] border border-white/10 bg-[#12121A]/96 p-3 shadow-[0_32px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:hidden"
        >
          <div className="mb-3 flex items-start justify-between gap-4 px-2 py-1">
            <div>
              <p className="text-sm font-semibold text-textPrimary">More workspace tools</p>
              <p className="text-xs text-textSecondary">Open templates, websites, follow-ups, support, and settings from here.</p>
            </div>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-textSecondary transition hover:border-primary/30 hover:text-textPrimary"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close more navigation</span>
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isRouteActive(pathname, item.href);
              const itemClass = cn(
                "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-medium transition",
                active
                  ? "border-primary/20 bg-primary/12 text-textPrimary shadow-[0_8px_30px_rgba(108,99,255,0.12)]"
                  : "border-transparent bg-white/[0.03] text-textSecondary hover:border-white/8 hover:bg-white/[0.05] hover:text-textPrimary"
              );
              const iconClass = cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-primary/18 text-primary" : "bg-white/[0.04] text-textSecondary");

              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className={itemClass}
                  >
                    <span className={iconClass}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{item.label}</span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={itemClass}
                >
                  <span className={iconClass}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-2">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = isRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[0.7rem] transition",
                active ? "bg-primary/12 text-primary" : "text-textSecondary hover:bg-white/[0.04] hover:text-textPrimary"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((current) => !current)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[0.7rem] transition",
            moreOpen || moreActive ? "bg-primary/12 text-primary" : "text-textSecondary hover:bg-white/[0.04] hover:text-textPrimary"
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
          More
        </button>
      </div>
    </nav>
    </>
  );
}
