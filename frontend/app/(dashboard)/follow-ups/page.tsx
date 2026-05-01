"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { UsageStatusBanner } from "@/components/shared/UsageStatusBanner";
import { useUserStore } from "@/store/useUserStore";

type FollowUpStatus = "due" | "scheduled" | "sent";

type FollowUpItem = {
  id: string;
  campaign_id: string | null;
  lead_id: string;
  message: string;
  scheduled_at: string;
  sent: boolean;
  sent_at: string | null;
  step_number: number;
  status: FollowUpStatus;
  can_cancel: boolean;
  leads?: {
    business_name?: string | null;
    phone?: string | null;
  } | null;
  campaigns?: {
    name?: string | null;
  } | null;
};

type CampaignOption = {
  id: string;
  name: string;
  niche?: string | null;
  status?: string | null;
};

type LeadOption = {
  id: string;
  business_name: string;
  phone?: string | null;
  city?: string | null;
  niche?: string | null;
};

type FollowUpResponse = {
  items: FollowUpItem[];
  campaigns: CampaignOption[];
  leads: LeadOption[];
  summary: {
    total: number;
    due: number;
    scheduled: number;
    sent: number;
  };
};

type FollowUpFormState = {
  campaignId: string;
  leadId: string;
  message: string;
  scheduledAt: string;
  stepNumber: string;
};

const EMPTY_RESPONSE: FollowUpResponse = {
  items: [],
  campaigns: [],
  leads: [],
  summary: {
    total: 0,
    due: 0,
    scheduled: 0,
    sent: 0
  }
};

function buildLocalDateTime(minutesFromNow = 30) {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function statusLabel(status: FollowUpStatus) {
  if (status === "due") return "Due now";
  if (status === "sent") return "Sent";
  return "Scheduled";
}

function statusClass(status: FollowUpStatus) {
  if (status === "due") {
    return "border border-amber-500/25 bg-amber-500/10 text-amber-200";
  }
  if (status === "sent") {
    return "border border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }
  return "border border-primary/20 bg-primary/10 text-primary";
}

export default function FollowUpsPage() {
  const refreshProfile = useUserStore((state) => state.refreshProfile);
  const [data, setData] = useState<FollowUpResponse>(EMPTY_RESPONSE);
  const [tab, setTab] = useState<"all" | FollowUpStatus>("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [form, setForm] = useState<FollowUpFormState>({
    campaignId: "",
    leadId: "",
    message: "",
    scheduledAt: buildLocalDateTime(30),
    stepNumber: "1"
  });

  const load = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const { data: response } = await api.get<FollowUpResponse>("/api/followups");
      setData(response || EMPTY_RESPONSE);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not load follow-ups right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile().catch(() => null);
    load(true).catch(() => null);
    const interval = window.setInterval(() => {
      refreshProfile().catch(() => null);
      load(false).catch(() => null);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [refreshProfile]);

  const filteredItems = useMemo(() => {
    if (tab === "all") return data.items;
    return data.items.filter((item) => item.status === tab);
  }, [data.items, tab]);

  const selectedLead = useMemo(
    () => data.leads.find((lead) => lead.id === form.leadId) || null,
    [data.leads, form.leadId]
  );
  const profile = useUserStore((state) => state.profile);
  const totalAllowance = Number(profile?.messages_limit || 0) + Number(profile?.bonus_messages || 0);
  const hasReachedDailyLimit = totalAllowance > 0 && Number(profile?.messages_sent_today || 0) >= totalAllowance;
  const selectedLeadMissingPhone = Boolean(selectedLead && !selectedLead.phone);

  const createFollowUp = async (sendNow = false) => {
    if (!form.leadId) {
      toast.error("Pick a lead before scheduling the follow-up.");
      return;
    }

    if (!form.message.trim()) {
      toast.error("Write the follow-up message first.");
      return;
    }

    if (selectedLeadMissingPhone) {
      toast.error("This lead does not have a phone number yet.");
      return;
    }

    if (sendNow && hasReachedDailyLimit) {
      toast.error("Today's message allowance is already used up.");
      return;
    }

    setSubmitting(true);

    try {
      const scheduledAt = sendNow ? buildLocalDateTime(0) : form.scheduledAt;

      await api.post("/api/followups", {
        campaign_id: form.campaignId || null,
        lead_id: form.leadId,
        message: form.message.trim(),
        scheduled_at: new Date(scheduledAt).toISOString(),
        step_number: Number(form.stepNumber || "1") || 1
      });

      toast.success(sendNow ? "Follow-up is queued for immediate sending." : "Follow-up scheduled.");
      await refreshProfile().catch(() => null);
      setForm((current) => ({
        ...current,
        message: "",
        scheduledAt: buildLocalDateTime(30),
        stepNumber: "1"
      }));
      await load(false);
      setTab(sendNow ? "due" : "scheduled");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not schedule the follow-up.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelFollowUp = async (id: string) => {
    setCancelingId(id);

    try {
      await api.delete(`/api/followups/${id}`);
      toast.success("Follow-up canceled.");
      await load(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not cancel that follow-up.");
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-textPrimary">Follow-ups</h1>
        <p className="max-w-3xl text-sm text-textSecondary">
          Schedule the next nudge for any saved lead. Due follow-ups are checked whenever this page loads, so the flow still works even when the background queue is off locally.
        </p>
      </div>

      <UsageStatusBanner context="followups" />

      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-textPrimary">1. Pick a lead</p>
            <p className="mt-2 text-sm leading-6 text-textSecondary">
              Choose any saved lead, optionally link it to a campaign, and keep the follow-up message short and natural.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-textPrimary">2. Schedule or send now</p>
            <p className="mt-2 text-sm leading-6 text-textSecondary">
              Use a future time for a planned follow-up, or choose <span className="text-textPrimary">Send as soon as possible</span> to test the connected WhatsApp sender immediately.
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-textPrimary">3. Watch the queue</p>
            <p className="mt-2 text-sm leading-6 text-textSecondary">
              The queue below shows what is due now, what is still scheduled, and what has already been sent from ReachIQ.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total" value={data.summary.total} detail="All follow-ups in your workspace" />
        <SummaryCard label="Due now" value={data.summary.due} detail="Ready to send as soon as ReachIQ syncs" accent="amber" />
        <SummaryCard label="Scheduled" value={data.summary.scheduled} detail="Waiting for their scheduled time" />
        <SummaryCard label="Sent" value={data.summary.sent} detail="Already delivered by your connected sender" accent="emerald" />
      </div>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-textPrimary">Schedule a follow-up</h2>
              <p className="text-sm text-textSecondary">
                Pick the lead, write the message, and decide whether it goes out later or right now.
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-surface2 px-4 py-2 text-xs text-textMuted">
              ReachIQ sends the saved text from your active WhatsApp connection.
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <FieldGroup label="Campaign (optional)">
              <select
                value={form.campaignId}
                onChange={(event) => setForm((current) => ({ ...current, campaignId: event.target.value }))}
                className="w-full rounded-2xl border border-white/8 bg-surface2 px-4 py-3 text-sm text-textPrimary outline-none transition focus:border-primary/40"
              >
                <option value="">Standalone follow-up</option>
                {data.campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                    {campaign.niche ? ` - ${campaign.niche}` : ""}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Lead">
              <select
                value={form.leadId}
                onChange={(event) => setForm((current) => ({ ...current, leadId: event.target.value }))}
                className="w-full rounded-2xl border border-white/8 bg-surface2 px-4 py-3 text-sm text-textPrimary outline-none transition focus:border-primary/40"
              >
                <option value="">Select a lead</option>
                {data.leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.business_name}
                    {lead.city ? ` - ${lead.city}` : ""}
                    {lead.niche ? ` - ${lead.niche}` : ""}
                  </option>
                ))}
              </select>
              {selectedLead ? (
                <div className="mt-2 space-y-1 text-xs text-textMuted">
                  <p>
                    {[selectedLead.phone || "No phone saved", selectedLead.city, selectedLead.niche].filter(Boolean).join(" - ")}
                  </p>
                  {selectedLeadMissingPhone ? (
                    <p className="text-warning">
                      ReachIQ can save this follow-up, but it cannot send until a phone number is added.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </FieldGroup>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <FieldGroup label="Message">
              <textarea
                rows={5}
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Hi {{business}}, just checking back in on the website preview I made for you..."
                className="w-full rounded-2xl border border-white/8 bg-surface2 px-4 py-3 text-sm text-textPrimary outline-none transition placeholder:text-textMuted focus:border-primary/40"
              />
            </FieldGroup>

            <div className="space-y-4">
              <FieldGroup label="Send at">
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                  className="w-full rounded-2xl border border-white/8 bg-surface2 px-4 py-3 text-sm text-textPrimary outline-none transition focus:border-primary/40"
                />
              </FieldGroup>

              <FieldGroup label="Step number">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.stepNumber}
                  onChange={(event) => setForm((current) => ({ ...current, stepNumber: event.target.value }))}
                  className="w-full rounded-2xl border border-white/8 bg-surface2 px-4 py-3 text-sm text-textPrimary outline-none transition focus:border-primary/40"
                />
              </FieldGroup>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={() => setForm((current) => ({ ...current, scheduledAt: buildLocalDateTime(30) }))}>
              +30 min
            </Button>
            <Button variant="secondary" type="button" onClick={() => setForm((current) => ({ ...current, scheduledAt: buildLocalDateTime(120) }))}>
              +2 hours
            </Button>
            <Button variant="secondary" type="button" onClick={() => setForm((current) => ({ ...current, scheduledAt: buildLocalDateTime(24 * 60) }))}>
              Tomorrow
            </Button>
            <Button variant="ghost" type="button" onClick={() => setForm((current) => ({ ...current, scheduledAt: buildLocalDateTime(0) }))}>
              Set to now
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={submitting || selectedLeadMissingPhone} onClick={() => createFollowUp(false)}>
              {submitting ? "Saving..." : "Schedule follow-up"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting || selectedLeadMissingPhone || hasReachedDailyLimit}
              onClick={() => createFollowUp(true)}
            >
              Send as soon as possible
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-textPrimary">Follow-up queue</h2>
              <p className="text-sm text-textSecondary">
                Track what is due now, what is waiting, and what has already gone out.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "due", "scheduled", "sent"] as const).map((value) => (
                <Button key={value} variant={tab === value ? "primary" : "secondary"} onClick={() => setTab(value)}>
                  {value === "all" ? "All" : statusLabel(value)}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/8 bg-surface2 px-6 py-12 text-center text-sm text-textSecondary">
              Loading follow-ups...
            </div>
          ) : filteredItems.length ? (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-surface2 px-5 py-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-textPrimary">{item.leads?.business_name || "Unknown lead"}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                      <span className="rounded-full border border-white/8 px-2.5 py-1 text-xs text-textMuted">
                        Step {item.step_number || 1}
                      </span>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-textSecondary">{item.message}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-textMuted">
                      <span>Campaign: {item.campaigns?.name || "Standalone"}</span>
                      <span>Scheduled: {formatDate(item.scheduled_at)}</span>
                      <span>Sent: {formatDate(item.sent_at)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.can_cancel ? (
                      <Button
                        variant="danger"
                        disabled={cancelingId === item.id}
                        onClick={() => cancelFollowUp(item.id)}
                      >
                        {cancelingId === item.id ? "Canceling..." : "Cancel"}
                      </Button>
                    ) : (
                      <Button variant="secondary" disabled>
                        Sent
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-surface2 px-6 py-12 text-center">
              <p className="text-base font-medium text-textPrimary">No follow-ups in this view yet.</p>
              <p className="mt-2 text-sm text-textSecondary">
                Schedule one above and ReachIQ will keep it in the queue until it is due or sent.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FieldGroup({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-textPrimary">{label}</span>
      {children}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  accent = "primary"
}: {
  label: string;
  value: number;
  detail: string;
  accent?: "primary" | "amber" | "emerald";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-200"
      : accent === "emerald"
        ? "text-emerald-200"
        : "text-textPrimary";

  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-textMuted">{label}</p>
        <p className={`text-3xl font-semibold ${accentClass}`}>{value}</p>
        <p className="text-sm text-textSecondary">{detail}</p>
      </CardContent>
    </Card>
  );
}

