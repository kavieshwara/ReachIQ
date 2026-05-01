"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Campaign = {
  id: string;
  name: string;
  created_at?: string | null;
  status: string;
  total_leads?: number | null;
  sent_count?: number | null;
  delivered_count?: number | null;
  read_count?: number | null;
  replied_count?: number | null;
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/campaigns", { params: { page: 1, pageSize: 20 } });
      setCampaigns(response.data.data || []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || "Campaigns could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const handleDelete = async (campaign: Campaign) => {
    const confirmed = window.confirm(`Delete "${campaign.name}"? This removes the campaign record from your workspace.`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(campaign.id);
      await api.delete(`/api/campaigns/${campaign.id}`);
      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      toast.success("Campaign deleted");
    } catch (requestError: any) {
      toast.error(requestError?.response?.data?.error || "Campaign could not be deleted right now.");
      await loadCampaigns();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold text-textPrimary">Campaigns</p>
          <p className="text-textSecondary">Pause, resume, monitor, and clean up every outreach flow.</p>
        </div>
        <Link href="/campaigns/new">
          <Button>New Campaign</Button>
        </Link>
      </div>

      {loading ? (
        <div className="rounded-[28px] border border-white/8 bg-white/[0.03] px-6 py-10 text-sm text-textSecondary">
          Loading campaigns...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-[28px] border border-danger/20 bg-danger/10 px-6 py-6">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={() => void loadCampaigns()}>
            Try again
          </Button>
        </div>
      ) : null}

      {!loading && !error && !campaigns.length ? (
        <div className="rounded-[28px] border border-white/8 bg-white/[0.03] px-6 py-10">
          <p className="text-lg font-semibold text-textPrimary">No campaigns yet</p>
          <p className="mt-2 text-sm text-textSecondary">Create your first outreach flow and ReachIQ will track every send from here.</p>
          <Link href="/campaigns/new" className="mt-5 inline-flex">
            <Button>Build first campaign</Button>
          </Link>
        </div>
      ) : null}

      {!loading && !error && campaigns.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              deleting={deletingId === campaign.id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
