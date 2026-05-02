"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { DOCS_URL } from "@/lib/docs";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it Works" },
  { href: "/pricing", label: "Pricing" },
  { href: DOCS_URL, label: "Docs", external: true },
  { href: "/login", label: "Login" }
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed left-0 right-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-white/8 bg-background/88 backdrop-blur-xl" : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Logo variant="full" size="md" theme="dark" href="/" />
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((item) =>
            item.external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="text-sm text-textSecondary transition hover:text-textPrimary">
                {item.label}
              </a>
            ) : item.href.startsWith("#") ? (
              <a key={item.href} href={item.href} className="text-sm text-textSecondary transition hover:text-textPrimary">
                {item.label}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className="text-sm text-textSecondary transition hover:text-textPrimary">
                {item.label}
              </Link>
            )
          )}
          <Link href="/signup">
            <Button>Start Free</Button>
          </Link>
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-textPrimary md:hidden"
          onClick={() => setMobileOpen((current) => !current)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobileOpen ? (
        <div className="border-t border-white/8 bg-surface/96 px-5 pb-5 pt-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-3">
            {navLinks.map((item) =>
              item.external ? (
                <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className="rounded-2xl px-3 py-2 text-sm text-textSecondary hover:bg-white/[0.04] hover:text-textPrimary" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </a>
              ) : item.href.startsWith("#") ? (
                <a key={item.href} href={item.href} className="rounded-2xl px-3 py-2 text-sm text-textSecondary hover:bg-white/[0.04] hover:text-textPrimary" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} href={item.href} className="rounded-2xl px-3 py-2 text-sm text-textSecondary hover:bg-white/[0.04] hover:text-textPrimary" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </Link>
              )
            )}
            <Link href="/signup" onClick={() => setMobileOpen(false)}>
              <Button className="w-full">Start Free</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
