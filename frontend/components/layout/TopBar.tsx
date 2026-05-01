"use client";

import { LogOut } from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { Logo, LogoIcon } from "@/components/brand/Logo";
import { getInitials } from "@/lib/utils";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { profile, signOut } = useUserStore();
  return (
    <header className="sticky top-0 z-50 border-b border-white/6 bg-background/85 backdrop-blur-xl">
      <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0 flex flex-1 items-start gap-3">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] shadow-[0_12px_30px_rgba(108,99,255,0.14)] lg:flex">
            <LogoIcon size="sm" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="lg:hidden">
              <Logo variant="full" size="sm" theme="dark" href="/dashboard" />
            </div>
            <h1 className="truncate text-xl font-semibold text-textPrimary sm:text-[1.65rem]">{title}</h1>
            {subtitle ? <p className="max-w-2xl text-sm text-textSecondary">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <GlobalSearch />
          <NotificationsDropdown />
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-textSecondary transition hover:border-primary/30 hover:text-textPrimary md:hidden"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </button>
          <button
            className="hidden items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-textSecondary transition hover:border-primary/30 hover:text-textPrimary md:inline-flex"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/8 bg-primary/15 text-sm font-semibold text-primary shadow-[0_12px_32px_rgba(108,99,255,0.18)]">
            {getInitials(profile?.full_name || profile?.email)}
          </div>
        </div>
      </div>
    </header>
  );
}
