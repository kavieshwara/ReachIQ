"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CampaignStats } from "@/components/campaigns/CampaignStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { api } from "@/lib/api";

function resolvePreviewUrl(preparation: any) {
  if (preparation?.website_live_url) {
    return preparation.website_live_url;
  }

  if (!preparation?.generated_website_id) {
    return "";
  }

  return `${process.env.NEXT_PUBLIC_API_URL}/preview/${preparation.generated_website_id}`;
}

function formatPreparationStatus(kind: "website" | "message" | "video", value?: string | null) {
  if (!value || value === "pending") {
    return "pending";
  }

  if (value === "skipped") {
    if (kind === "website") return "skipped (text-only)";
    if (kind === "video") return "skipped (video disabled for this campaign)";
    return "skipped";
  }

  return value;
}

function getDraftAssetHint(kind: "website" | "message" | "video", preparation: any) {
  if (kind === "website") {
    if (resolvePreviewUrl(preparation)) {
      return null;
    }
    if (preparation?.website_status === "skipped") {
      return "Website generation is off for this campaign.";
    }
    return "Website draft not ready yet";
  }

  if (kind === "video") {
    if (preparation?.video_url) {
      return null;
    }
    if (preparation?.video_status === "skipped") {
      return "Video capture was turned off when this campaign was created.";
    }
    return "Video draft not ready yet";
  }

  if (preparation?.personalized_message) {
    return null;
  }

  return "Message draft not ready yet";
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params?.id ?? "";
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data } = await api.get(`/api/campaigns/${campaignId}`);
      setCampaign(data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!campaignId) {
      return;
    }
    load().catch(() => null);
  }, [campaignId]);

  useEffect(() => {
    if (!campaign?.id) {
      return;
    }

    if (!["running", "awaiting_whatsapp", "draft"].includes(campaign.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      load().catch(() => null);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [campaign?.id, campaign?.status]);

  if (!campaign) {
    return <div className="text-textSecondary">Loading campaign...</div>;
  }

  const preparationByLead = new Map<string, any>(
    (campaign.outreach_preparations || []).map((item: any) => [item.campaign_lead_id, item])
  );
  const statusHelper =
    campaign.status === "draft"
      ? "This campaign is still a draft. Click Launch to start generating websites, preparing messages, and sending."
      : campaign.status === "awaiting_whatsapp"
        ? "WhatsApp must be connected before ReachIQ can continue. Connect WhatsApp, then resume the campaign."
        : campaign.status === "running"
          ? "ReachIQ is preparing each lead one by one. Pending means the website or message is still being generated."
          : campaign.status === "paused"
            ? "This campaign is paused. Resume it to continue preparing and sending lead outreach."
            : "This campaign finished its current send run.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-2xl font-semibold text-textPrimary">{campaign.name}</p>
          <p className="text-textSecondary">Created {formatDate(campaign.created_at)}</p>
        </div>
        <div className="flex gap-3">
          <Badge variant={campaign.status === "running" ? "success" : campaign.status === "paused" ? "warning" : "muted"}>
            {campaign.status}
          </Badge>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await api.patch(`/api/campaigns/${campaignId}/${campaign.status === "paused" ? "resume" : "pause"}`);
                toast.success(campaign.status === "paused" ? "Campaign resumed" : "Campaign paused");
                load().catch(() => null);
              } catch (error: any) {
                toast.error(error?.response?.data?.error || "Could not update campaign status");
              }
            }}
          >
            {campaign.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <Button
            onClick={async () => {
              try {
                await api.post(`/api/campaigns/${campaignId}/launch`);
                toast.success("Campaign queued. ReachIQ will now prepare and send leads one by one.");
              } catch (error: any) {
                toast.error(error?.response?.data?.error || "Could not launch campaign");
              }
              load().catch(() => null);
            }}
          >
            Launch
          </Button>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={async () => {
              const confirmed = window.confirm(`Delete "${campaign.name}"? This removes the saved campaign and its current run history from your workspace.`);
              if (!confirmed) {
                return;
              }

              try {
                setDeleting(true);
                await api.delete(`/api/campaigns/${campaignId}`);
                toast.success("Campaign deleted");
                router.replace("/campaigns");
              } catch (error: any) {
                toast.error(error?.response?.data?.error || "Could not delete campaign");
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-textPrimary">Campaign status guide</p>
            <p className="text-xs text-textMuted">{refreshing ? "Refreshing..." : "Auto-refresh every 5s while active"}</p>
          </div>
          <p className="text-sm leading-6 text-textSecondary">{statusHelper}</p>
          {campaign.status === "awaiting_whatsapp" ? (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              ReachIQ has this campaign paused until WhatsApp is connected again. If your phone still shows the linked device,
              the local backend session was likely lost and needs a fresh reconnect before you click Launch again.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["Sent", campaign.sent_count],
          ["Delivered", campaign.delivered_count],
          ["Read", campaign.read_count],
          ["Replied", campaign.replied_count],
          ["Failed", campaign.failed_count]
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="space-y-2 p-5">
              <p className="text-sm text-textSecondary">{label as string}</p>
              <p className="text-3xl font-semibold text-textPrimary">{value as number}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <CampaignStats campaign={campaign} />

      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Lead status</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border text-left text-textSecondary">
                <tr>
                  <th className="px-3 py-2">Lead</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Website</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Video</th>
                  <th className="px-3 py-2">Draft assets</th>
                  <th className="px-3 py-2">Sent</th>
                  <th className="px-3 py-2">Delivered</th>
                  <th className="px-3 py-2">Read</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {(campaign.campaign_leads || []).map((item: any) => {
                  const preparation = preparationByLead.get(item.id);
                  return (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="px-3 py-2 text-textPrimary">{item.leads?.business_name}</td>
                      <td className="px-3 py-2 text-textSecondary">{item.status}</td>
                      <td className="px-3 py-2 text-textSecondary">{formatPreparationStatus("website", preparation?.website_status)}</td>
                      <td className="px-3 py-2 text-textSecondary">{formatPreparationStatus("message", preparation?.message_status)}</td>
                      <td className="px-3 py-2 text-textSecondary">{formatPreparationStatus("video", preparation?.video_status)}</td>
                      <td className="px-3 py-2">
                        <div className="space-y-2">
                          {resolvePreviewUrl(preparation) ? (
                            <a
                              href={resolvePreviewUrl(preparation)}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-xs font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Open generated website
                            </a>
                          ) : (
                            <p className="text-xs text-textMuted">{getDraftAssetHint("website", preparation)}</p>
                          )}
                          {preparation?.video_url ? (
                            <a
                              href={preparation.video_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-xs font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Open recorded video
                            </a>
                          ) : (
                            <p className="text-xs text-textMuted">{getDraftAssetHint("video", preparation)}</p>
                          )}
                          {preparation?.personalized_message ? (
                            <details className="rounded-lg border border-border/70 bg-surface2 p-2 text-xs text-textSecondary">
                              <summary className="cursor-pointer select-none text-textPrimary">View drafted message</summary>
                              <p className="mt-2 whitespace-pre-wrap leading-5">{preparation.personalized_message}</p>
                            </details>
                          ) : (
                            <p className="text-xs text-textMuted">{getDraftAssetHint("message", preparation)}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-textSecondary">{formatDate(item.sent_at)}</td>
                      <td className="px-3 py-2 text-textSecondary">{formatDate(item.delivered_at)}</td>
                      <td className="px-3 py-2 text-textSecondary">{formatDate(item.read_at)}</td>
                      <td className="px-3 py-2 text-danger">{item.error_message || preparation?.generation_error || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Follow-up schedule</p>
          <div className="space-y-3">
            {(campaign.follow_ups || []).map((followUp: any) => (
              <div key={followUp.id} className="rounded-xl border border-border bg-surface2 px-4 py-3">
                <p className="text-sm text-textPrimary">Step {followUp.step_number}</p>
                <p className="mt-1 text-sm text-textSecondary">{followUp.message}</p>
                <p className="mt-2 text-xs text-textMuted">{formatDate(followUp.scheduled_at)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
