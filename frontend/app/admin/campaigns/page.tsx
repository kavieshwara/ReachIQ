"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Campaign = {
  id: string;
  name: string;
  status: string;
  total_leads: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null };
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const statusVariant = {
  draft: "muted",
  running: "success",
  paused: "warning",
  completed: "default"
} as const;

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadCampaigns = async (page = 1) => {
    setLoading(true);
    try {
      const response = await api.get("/api/admin/campaigns", {
        params: {
          page,
          pageSize: 8,
          search: search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined
        }
      });
      setCampaigns(response.data.data || []);
      setPagination(response.data.pagination || null);
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        toast.error("Your admin session expired before campaigns could load.");
      } else if (status === 403) {
        toast.error("This account does not currently have access to admin campaigns.");
      } else {
        toast.error(error?.response?.data?.error || "Could not load admin campaigns");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCampaigns(1);
  }, [search, statusFilter]);

  const campaignSummary = useMemo(() => ({
    total: pagination?.total || campaigns.length,
    running: campaigns.filter((campaign) => campaign.status === "running").length,
    replies: campaigns.reduce((sum, campaign) => sum + Number(campaign.replied_count || 0), 0)
  }), [campaigns, pagination?.total]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaign operations"
        description="Watch platform-wide outreach performance, understand send quality, and inspect ownership at a glance."
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Campaigns in view", value: campaignSummary.total },
              { label: "Currently running", value: campaignSummary.running },
              { label: "Replies captured", value: campaignSummary.replies }
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-sm text-textSecondary">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-textPrimary">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.5fr,0.8fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
                placeholder="Search campaign or owner"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-textPrimary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/8">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/8 bg-white/[0.03] text-left text-textSecondary">
                  <tr>
                    <th className="px-5 py-4 font-medium">Campaign</th>
                    <th className="px-5 py-4 font-medium">Owner</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Delivery</th>
                    <th className="px-5 py-4 font-medium">Replies</th>
                    <th className="px-5 py-4 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index} className="border-b border-white/6">
                        <td className="px-5 py-4" colSpan={6}>
                          <Skeleton className="h-12" />
                        </td>
                      </tr>
                    ))
                  ) : campaigns.length ? (
                    campaigns.map((campaign) => (
                      <tr key={campaign.id} className="border-b border-white/6 last:border-none">
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-medium text-textPrimary">{campaign.name}</p>
                            <p className="text-textSecondary">{campaign.total_leads} leads targeted</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-textSecondary">
                          {campaign.profiles?.full_name || campaign.profiles?.email || "Unknown owner"}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={statusVariant[campaign.status as keyof typeof statusVariant] || "muted"}>
                            {campaign.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-textSecondary">
                          {campaign.sent_count} sent · {campaign.delivered_count} delivered · {campaign.read_count} read
                        </td>
                        <td className="px-5 py-4 text-textSecondary">
                          {campaign.replied_count} replied · {campaign.failed_count} failed
                        </td>
                        <td className="px-5 py-4 text-textSecondary">{formatDate(campaign.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-16 text-center text-textSecondary" colSpan={6}>
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                            <Megaphone className="h-5 w-5" />
                          </div>
                          <p className="text-base font-medium text-textPrimary">No campaigns yet</p>
                          <p className="text-sm leading-6 text-textSecondary">Once users start launching campaigns, the full platform queue will become visible here.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls pagination={pagination} onChange={(nextPage) => void loadCampaigns(nextPage)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
