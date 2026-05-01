import { Globe2, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function LeadCard({ lead }: { lead: any }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-textPrimary">{lead.business_name}</p>
            <p className="text-sm text-textSecondary">{lead.niche || "General business"}</p>
          </div>
          <Badge variant={lead.has_website ? "muted" : "danger"}>{lead.has_website ? "Has Website" : "No Website"}</Badge>
        </div>
        <div className="space-y-2 text-sm text-textSecondary">
          <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {lead.phone || "No phone"}</p>
          <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {lead.address || lead.city || "No address"}</p>
          <p className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> {lead.website_url || "No website detected"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
