import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export function CampaignList({ campaigns = [] as any[] }) {
  if (!campaigns.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-textSecondary">
          No campaigns yet. Launch your first outreach flow from the campaign builder.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <Link href={`/campaigns/${campaign.id}`} key={campaign.id}>
          <Card className="transition hover:border-primary/40">
            <CardContent className="flex items-center justify-between gap-6">
              <div>
                <p className="text-base font-semibold text-textPrimary">{campaign.name}</p>
                <p className="mt-1 text-sm text-textSecondary">{formatDate(campaign.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={campaign.status === "running" ? "success" : campaign.status === "paused" ? "warning" : "muted"}>
                  {campaign.status}
                </Badge>
                <p className="text-sm text-textSecondary">{campaign.sent_count || 0} sent</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
