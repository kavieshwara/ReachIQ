"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { FullDisclaimer } from "@/components/shared/FullDisclaimer";
import { UsageStatusBanner } from "@/components/shared/UsageStatusBanner";

type CampaignLead = {
  id: string;
  business_name: string;
  niche?: string | null;
};

type CampaignTemplate = {
  id: string;
  content: string;
  name?: string;
  niche?: string | null;
};

type WebsiteTemplate = {
  id: string;
  name: string;
  niche?: string | null;
};

type CampaignBuilderProps = {
  leads?: CampaignLead[];
  templates?: CampaignTemplate[];
  websiteTemplates?: WebsiteTemplate[];
  initialTemplateId?: string;
  initialNiche?: string;
};

function normalizeNiche(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function matchesNiche(candidate?: string | null, filter?: string | null) {
  const current = normalizeNiche(candidate);
  const target = normalizeNiche(filter);
  if (!target) return true;
  if (!current) return false;
  return current === target || current.includes(target) || target.includes(current);
}

export function CampaignBuilder({
  leads = [],
  templates = [],
  websiteTemplates = [],
  initialTemplateId,
  initialNiche
}: CampaignBuilderProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId || "");
  const [nicheFilter, setNicheFilter] = useState(initialNiche || "");
  const [payload, setPayload] = useState({
    name: "",
    message_template: templates[0]?.content || "",
    delay_seconds: 10,
    lead_ids: [] as string[],
    website_template_id: "",
    auto_generate_assets: true,
    require_video_assets: false,
    niche: initialNiche || ""
  });

  useEffect(() => {
    if (!payload.message_template && templates[0]?.content) {
      setPayload((current) => ({ ...current, message_template: templates[0].content }));
    }
  }, [payload.message_template, templates]);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);
    if (!selectedTemplate) return;

    setPayload((current) => ({
      ...current,
      message_template: selectedTemplate.content || current.message_template,
      niche: selectedTemplate.niche || current.niche
    }));

    if (selectedTemplate.niche) {
      setNicheFilter(selectedTemplate.niche);
    }
  }, [selectedTemplateId, templates]);

  const uniqueLeadNiches = useMemo(
    () => Array.from(new Set(leads.map((lead) => String(lead.niche || "").trim()).filter(Boolean))).sort(),
    [leads]
  );

  const filteredLeads = useMemo(
    () => leads.filter((lead) => matchesNiche(lead.niche, nicheFilter)),
    [leads, nicheFilter]
  );

  const allFilteredLeadIds = useMemo(
    () => filteredLeads.map((lead) => lead.id),
    [filteredLeads]
  );

  const allFilteredSelected =
    allFilteredLeadIds.length > 0 &&
    allFilteredLeadIds.every((leadId) => payload.lead_ids.includes(leadId));

  useEffect(() => {
    if (!nicheFilter) return;
    setPayload((current) => ({
      ...current,
      niche: nicheFilter,
      lead_ids: current.lead_ids.filter((leadId) => filteredLeads.some((lead) => lead.id === leadId))
    }));
  }, [filteredLeads, nicheFilter]);

  const toggleLead = (id: string) => {
    setPayload((current) => ({
      ...current,
      lead_ids: current.lead_ids.includes(id) ? current.lead_ids.filter((leadId) => leadId !== id) : [...current.lead_ids, id]
    }));
  };

  const toggleAllFilteredLeads = () => {
    setPayload((current) => {
      if (!allFilteredLeadIds.length) {
        return current;
      }

      if (allFilteredSelected) {
        return {
          ...current,
          lead_ids: current.lead_ids.filter((leadId) => !allFilteredLeadIds.includes(leadId))
        };
      }

      return {
        ...current,
        lead_ids: Array.from(new Set([...current.lead_ids, ...allFilteredLeadIds]))
      };
    });
  };

  const submit = async () => {
    try {
      setSubmitting(true);
      if (payload.auto_generate_assets && !payload.website_template_id) {
        toast.error("Choose a website template for automated outreach.");
        return;
      }

      const { data } = await api.post("/api/campaigns", payload);
      try {
        await api.post(`/api/campaigns/${data.id}/launch`);
        toast.success("Campaign launched. ReachIQ is now preparing each lead.");
      } catch (launchError: any) {
        if (launchError?.response?.status === 409 && launchError?.response?.data?.connectRequired) {
          toast.error("Connect WhatsApp before launching. Your campaign draft is ready and waiting.");
        } else {
          toast.error(launchError?.response?.data?.error || "Campaign was created, but launch did not finish cleanly.");
        }
      }
      router.push(`/campaigns/${data.id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not create campaign");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <UsageStatusBanner context="campaigns" compact />

      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Step 1 - Campaign details</p>
          <Input placeholder="Campaign name" value={payload.name} onChange={(event) => setPayload((current) => ({ ...current, name: event.target.value }))} />
          <select
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-textPrimary"
          >
            <option value="">Select message template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name || "Untitled template"} {template.niche ? `- ${template.niche}` : ""}
              </option>
            ))}
          </select>
          <Textarea value={payload.message_template} onChange={(event) => setPayload((current) => ({ ...current, message_template: event.target.value }))} />
          <Input
            type="number"
            min={5}
            value={payload.delay_seconds}
            onChange={(event) => setPayload((current) => ({ ...current, delay_seconds: Number(event.target.value) }))}
          />
          <p className="text-sm text-warning">Lower delays increase ban risk. We recommend 10-30 seconds.</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Step 2 - Website + outreach automation</p>
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-textPrimary">Auto-generate a website for each lead</p>
                <p className="text-textSecondary">ReachIQ fills the chosen template with the lead's business details before sending.</p>
              </div>
              <input
                type="checkbox"
                checked={payload.auto_generate_assets}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, auto_generate_assets: event.target.checked }))
                }
              />
            </label>

            <select
              value={payload.website_template_id}
              onChange={(event) => {
                const templateId = event.target.value;
                const selectedTemplate = websiteTemplates.find((item) => item.id === templateId);
                setPayload((current) => ({ ...current, website_template_id: templateId }));
                if (selectedTemplate?.niche) {
                  setNicheFilter(selectedTemplate.niche);
                  setPayload((current) => ({ ...current, niche: selectedTemplate.niche || current.niche }));
                }
              }}
              className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-textPrimary"
            >
              <option value="">Select website template</option>
              {websiteTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.niche ? `- ${template.niche}` : ""}
                </option>
              ))}
            </select>

            <label className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-textPrimary">Prepare website video asset</p>
                <p className="text-textSecondary">The backend stores the video-preparation status per lead. Video capture setup can be enabled separately.</p>
              </div>
              <input
                type="checkbox"
                checked={payload.require_video_assets}
                onChange={(event) =>
                  setPayload((current) => ({ ...current, require_video_assets: event.target.checked }))
                }
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-textPrimary">Step 3 - Select leads</p>
            <p className="text-sm text-textSecondary">{payload.lead_ids.length} leads selected</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[220px,1fr] md:items-center">
            <p className="text-sm text-textSecondary">Filter leads by niche so dental campaigns show dental leads, car campaigns show car leads.</p>
            <select
              value={nicheFilter}
              onChange={(event) => setNicheFilter(event.target.value)}
              className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-textPrimary"
            >
              <option value="">All lead niches</option>
              {uniqueLeadNiches.map((niche) => (
                <option key={niche} value={niche}>
                  {niche}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {filteredLeads.length ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-textPrimary">
                    {allFilteredSelected ? "All filtered leads selected" : "Select all filtered leads"}
                  </p>
                  <p className="text-textSecondary">
                    {filteredLeads.length} lead{filteredLeads.length === 1 ? "" : "s"} in this filtered list
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={toggleAllFilteredLeads}>
                  {allFilteredSelected ? "Clear all" : "Select all"}
                </Button>
              </div>
            ) : null}
            {filteredLeads.map((lead) => (
              <label key={lead.id} className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-4 py-3 text-sm">
                <span>
                  {lead.business_name}
                  {lead.niche ? <span className="ml-2 text-xs uppercase tracking-[0.18em] text-textMuted">{lead.niche}</span> : null}
                </span>
                <input type="checkbox" checked={payload.lead_ids.includes(lead.id)} onChange={() => toggleLead(lead.id)} />
              </label>
            ))}
            {!filteredLeads.length ? (
              <div className="rounded-xl border border-dashed border-border bg-surface2 px-4 py-5 text-sm text-textSecondary">
                No leads match this niche yet. Find or add leads for <span className="font-medium text-textPrimary">{nicheFilter || "this campaign"}</span> first, then come back here.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Step 4 - Review & launch</p>
          <p className="text-sm text-textSecondary">
            ReachIQ will prepare each lead one by one: generate the website, prepare the personalized message, then send as soon as the lead is ready. If WhatsApp is not connected, the campaign will wait for connection first.
          </p>
          <FullDisclaimer />
          <Button disabled={submitting} onClick={submit}>
            {submitting ? "Preparing..." : "Create and launch campaign"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
