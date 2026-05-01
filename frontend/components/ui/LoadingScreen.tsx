"use client";

import { Logo, LogoIcon } from "@/components/brand/Logo";

export function LoadingScreen({
  title = "Loading ReachIQ",
  description = "Restoring your session and workspace."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0A0A0F] px-5 text-center">
      <div className="relative">
        <LogoIcon size="lg" className="logo-animated" />
        <div className="absolute inset-0 rounded-[22px] animate-ping bg-primary/15" />
      </div>
      <div className="space-y-3">
        <Logo variant="full" size="md" theme="dark" href={undefined} className="justify-center" />
        <div>
          <p className="text-2xl font-semibold text-textPrimary">{title}</p>
          <p className="mt-2 text-sm text-textSecondary">{description}</p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
