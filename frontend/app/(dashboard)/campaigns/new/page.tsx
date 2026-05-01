"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CampaignBuilder } from "@/components/campaigns/CampaignBuilder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function NewCampaignPage() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [websiteTemplates, setWebsiteTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadBuilderResources = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const [leadResponse, templateResponse, websiteTemplateResponse] = await Promise.all([
          api.get("/api/leads", { params: { page: 1, pageSize: 100 } }),
          api.get("/api/templates"),
          api.get("/api/websites/templates")
        ]);

        setLeads((leadResponse.data.data || []).filter((lead: any) => lead.phone));
        setTemplates([...(templateResponse.data.systemTemplates || []), ...(templateResponse.data.userTemplates || [])]);
        setWebsiteTemplates(websiteTemplateResponse.data || []);
      } catch (error: any) {
        console.error("[ReachIQ][campaign-builder] failed to load setup data", error);
        setLoadError(error?.response?.data?.error || "Campaign setup data could not be loaded right now.");
      } finally {
        setLoading(false);
      }
    };

    void loadBuilderResources();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="text-lg font-semibold text-textPrimary">Preparing your campaign builder</p>
          <p className="text-sm text-textSecondary">
            ReachIQ is loading your leads, message templates, and website templates so you can launch cleanly.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-danger/30 bg-danger/8">
        <CardContent className="space-y-4 p-6">
          <p className="text-lg font-semibold text-textPrimary">Campaign builder unavailable</p>
          <p className="text-sm text-textSecondary">{loadError}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry loading
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <CampaignBuilder
      leads={leads}
      templates={templates}
      websiteTemplates={websiteTemplates}
      initialTemplateId={searchParams?.get("templateId") || undefined}
      initialNiche={searchParams?.get("niche") || undefined}
    />
  );
}
