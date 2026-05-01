"use client";

import { useEffect, useState } from "react";
import html2canvas from "html2canvas";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { resolveBrowserAppUrl } from "@/lib/public-url";

export default function ReferralPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/api/referral")
      .then((response) => {
        setData(response.data);
        setLoadError(null);
      })
      .catch(() => {
        setLoadError("Referral data is unavailable right now. Once the backend is healthy, your code and share card will load here.");
      })
      .finally(() => setLoading(false));
  }, []);

  const referralCode = data?.profile?.referral_code || "";
  const appUrl = resolveBrowserAppUrl();
  const referralLink = referralCode ? `${appUrl}/signup?ref=${referralCode}` : "";
  const cleanAppLabel = appUrl.replace(/^https?:\/\//, "");

  const handleScreenshot = async () => {
    const card = document.getElementById("share-card");
    if (!card) return;

    const canvas = await html2canvas(card, {
      scale: 2,
      backgroundColor: null
    });

    const anchor = document.createElement("a");
    anchor.download = "reachiq-referral.png";
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Your referral code</p>
          <p className="text-4xl font-semibold text-primary">{referralCode || (loading ? "..." : "Unavailable")}</p>
          <p className="break-words text-sm text-textSecondary">{referralLink || "Your referral link will appear here once the backend responds."}</p>
          {loadError ? <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{loadError}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => referralCode && navigator.clipboard.writeText(referralCode)} disabled={!referralCode}>
              Copy code
            </Button>
            <Button variant="secondary" onClick={() => referralLink && navigator.clipboard.writeText(referralLink)} disabled={!referralLink}>
              Copy link
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-textSecondary">People referred</p>
            <p className="text-3xl font-semibold text-textPrimary">{data?.referrals?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-textSecondary">Bonus messages</p>
            <p className="text-3xl font-semibold text-textPrimary">{data?.profile?.bonus_messages || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-textSecondary">Daily total</p>
            <p className="text-3xl font-semibold text-textPrimary">
              {(data?.profile?.messages_limit || 30) + (data?.profile?.bonus_messages || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div
            id="share-card"
            className="overflow-hidden rounded-3xl p-6 text-center sm:p-8"
            style={{ background: "linear-gradient(135deg, #6C63FF, #4B44CC)" }}
          >
            <Logo variant="full" size="md" theme="dark" href={undefined} className="mb-4 justify-center" />
            <p className="mb-2 text-lg font-semibold text-white">Join me on ReachIQ</p>
            <p className="mb-4 text-sm text-white/75">Find clients automatically with WhatsApp outreach</p>
            <div className="inline-block max-w-full rounded-xl bg-white/10 px-6 py-3 font-mono text-[18px] tracking-[0.16em] text-white">
              {referralCode || "REFERRAL"}
            </div>
            <p className="mt-3 break-words text-sm text-accent">
              Use this code at {cleanAppLabel}. Both of us get +10 messages/day.
            </p>
          </div>
          <Button variant="secondary" onClick={handleScreenshot}>
            Save as Image to Share
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
