"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Globe,
  MessageSquareText,
  SearchCheck,
  Sparkles,
  WalletCards
} from "lucide-react";
import { LogoIcon } from "@/components/brand/Logo";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DisclaimerBanner } from "@/components/shared/DisclaimerBanner";
import { FullDisclaimer } from "@/components/shared/FullDisclaimer";
import { PricingSection } from "@/components/pricing/PricingSection";

const useCases = [
  ["Real Estate Agents", "Find landlords, pitch websites, and follow up automatically."],
  ["Insurance Agents", "Run steady follow-up flows that keep deals moving."],
  ["Freelancers", "Turn cold leads into website clients with one focused workflow."],
  ["Agency Owners", "Scale outbound campaigns across cities and niches."],
  ["Course Sellers", "Import lists, pitch offers, and nurture replies from one dashboard."]
] as const;

const features = [
  ["Lead Finder", SearchCheck],
  ["Bulk WhatsApp", MessageSquareText],
  ["Auto Follow-ups", Sparkles],
  ["AI Chat", Bot],
  ["Website Generator", Globe],
  ["Campaign Analytics", WalletCards]
] as const;

export default function LandingPage() {
  const [settings, setSettings] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/platform/settings`)
      .then((response) => response.json())
      .then((data) => setSettings(Array.isArray(data) ? data : []))
      .catch(() => setSettings([]));
  }, []);

  const announcement = settings.find((item) => item.key === "platform_announcement")?.value;

  return (
    <div className="reachiq-grid min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-7xl px-5 pb-20 pt-28 lg:px-8">
        {announcement ? (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-textSecondary">
            {announcement}
          </div>
        ) : null}

        <section className="relative overflow-hidden py-20">
          <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
            <div
              className="mb-6"
              style={{
                filter: "drop-shadow(0 0 32px rgba(108, 99, 255, 0.4))"
              }}
            >
              <LogoIcon size="lg" className="h-20 w-20" />
            </div>
            <div className="mb-6 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
              ReachIQ helps freelancers win clients faster
            </div>
            <h1 className="text-4xl font-bold leading-tight text-textPrimary md:text-6xl">
              Find Leads. Send Pitches. Get Clients. Automatically.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-textSecondary">
              ReachIQ helps freelancers and agencies find businesses with no website, pitch them on WhatsApp, and follow up automatically, all in one place.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button className="px-6 py-3 text-base">Start Free - No Credit Card</Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary" className="px-6 py-3 text-base">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="grid gap-6 py-14 md:grid-cols-3">
          {[
            ["Find businesses with no website on Google Maps", SearchCheck],
            ["Send personalized WhatsApp pitches automatically", MessageSquareText],
            ["Follow up and close clients without lifting a finger", Sparkles]
          ].map(([title, Icon], index) => {
            const Resolved = Icon as any;
            return (
              <Card key={index}>
                <CardContent className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <Resolved className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-semibold text-textPrimary">{title}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="py-14">
          <div className="mb-8">
            <p className="text-2xl font-semibold text-textPrimary">Built for modern outbound sellers</p>
            <p className="text-textSecondary">
              From freelancers to field sales teams, ReachIQ keeps the workflow focused and fast.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
            {useCases.map(([title, text]) => (
              <Card key={title}>
                <CardContent className="space-y-3">
                  <p className="text-lg font-semibold text-textPrimary">{title}</p>
                  <p className="text-sm leading-6 text-textSecondary">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="features" className="py-14">
          <div className="mb-8">
            <p className="text-2xl font-semibold text-textPrimary">Everything in one outreach stack</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map(([title, Icon]) => {
              const Resolved = Icon as any;
              return (
                <Card key={title}>
                  <CardContent className="space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                      <Resolved className="h-5 w-5" />
                    </div>
                    <p className="text-lg font-semibold text-textPrimary">{title}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <div id="pricing">
          <PricingSection compact />
        </div>

        <section className="py-14">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="text-2xl font-semibold text-textPrimary">
                  Invite a friend - both of you get 10 extra free messages per day.
                </p>
                <p className="mt-2 text-textSecondary">
                  A simple referral loop that makes the free plan stronger over time.
                </p>
              </div>
              <Link href="/signup">
                <Button>
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="py-14">
          <div className="space-y-4">
            <DisclaimerBanner />
            <FullDisclaimer />
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 text-sm text-textSecondary lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p>ReachIQ - Find leads. Send pitches. Get clients. Automatically.</p>
          <div className="flex gap-6">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
