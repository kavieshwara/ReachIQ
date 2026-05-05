"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileCog, LayoutPanelTop, MessageCircleWarning, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", icon: LayoutPanelTop },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/campaigns", label: "Campaigns", icon: BarChart3 },
  { href: "/admin/revenue", label: "Revenue", icon: ShieldCheck },
  { href: "/admin/tickets", label: "Tickets", icon: MessageCircleWarning },
  { href: "/admin/settings", label: "Settings", icon: FileCog },
  { href: "/admin/website-templates", label: "Templates", icon: LayoutPanelTop }
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-80 border-r border-white/6 bg-surface/70 px-5 py-6 backdrop-blur-xl lg:block">
      <div className="mb-8 flex items-center gap-3 border-b border-[#2A2A3D] px-2 pb-5">
        <Logo variant="full" size="sm" theme="dark" href="/admin" />
        <span className="rounded-md bg-warning/15 px-2 py-1 text-[10px] font-bold tracking-[0.16em] text-warning">ADMIN</span>
      </div>
      <div className="mb-6 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent/80">Operations</p>
        <p className="mt-2 text-sm text-textPrimary">Monitor accounts, tune platform settings, and resolve support queues.</p>
      </div>
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition",
                active
                  ? "border border-accent/20 bg-accent/12 text-textPrimary shadow-[0_8px_30px_rgba(0,217,166,0.12)]"
                  : "border border-transparent text-textSecondary hover:border-white/8 hover:bg-white/[0.04] hover:text-textPrimary"
              )}
            >
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-accent/18 text-accent" : "bg-white/[0.04] text-textSecondary")}>
                <Icon className="h-4 w-4" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
