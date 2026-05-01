"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type CampaignCardProps = {
  campaign: any;
  deleting?: boolean;
  onDelete?: (campaign: any) => void;
};

export function CampaignCard({ campaign, deleting = false, onDelete }: CampaignCardProps) {
  const progress = campaign.total_leads ? Math.round(((campaign.sent_count || 0) / campaign.total_leads) * 100) : 0;

  return (
    <Card className="transition hover:border-primary/40">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-textPrimary">{campaign.name}</p>
            <p className="text-sm text-textSecondary">{formatDate(campaign.created_at)}</p>
          </div>
          <Badge variant={campaign.status === "running" ? "success" : campaign.status === "paused" ? "warning" : "muted"}>
            {campaign.status}
          </Badge>
        </div>

        <div className="h-2 rounded-full bg-surface2">
          <div className="h-2 rounded-full bg-cta-gradient" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-textSecondary md:grid-cols-4">
          <p>Sent {campaign.sent_count || 0}</p>
          <p>Delivered {campaign.delivered_count || 0}</p>
          <p>Read {campaign.read_count || 0}</p>
          <p>Replies {campaign.replied_count || 0}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/campaigns/${campaign.id}`} className="inline-flex">
            <Button variant="secondary">Open campaign</Button>
          </Link>

          <Button
            type="button"
            variant="danger"
            disabled={deleting}
            onClick={() => onDelete?.(campaign)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
