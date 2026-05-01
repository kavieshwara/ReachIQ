import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export function LeadTable({
  leads = [] as any[],
  onDelete
}: {
  leads?: any[];
  onDelete?: (id: string) => void;
}) {
  const hasContactablePhone = (value?: string) => String(value || "").replace(/\D/g, "").length >= 10;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4 sm:p-0">
        {!leads.length ? (
          <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm text-textSecondary sm:m-4">
            No leads match the current filters yet. Try a broader search, import a CSV, or add leads from the finder.
          </div>
        ) : null}

        <div className="space-y-3 sm:hidden">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-textPrimary">{lead.business_name}</p>
                  <p className="mt-1 text-sm text-textSecondary">{lead.city || "No city saved"}</p>
                </div>
                <Badge variant={lead.has_website ? "muted" : "danger"}>
                  {lead.has_website ? "Has Website" : "No Website"}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-textSecondary">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Phone</p>
                  <p className="mt-1">
                    {hasContactablePhone(lead.phone) ? lead.phone : <span className="text-warning">Phone missing</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Niche</p>
                  <p className="mt-1">{lead.niche || "Uncategorized"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Status</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="default">{lead.status}</Badge>
                    {hasContactablePhone(lead.phone) ? (
                      <Badge variant="success">Campaign ready</Badge>
                    ) : (
                      <Badge variant="warning">Needs phone lookup</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Added</p>
                  <p className="mt-1">{formatDate(lead.created_at)}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="danger" className="px-3 py-1 text-xs" onClick={() => onDelete?.(lead.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-surface2 text-left text-textSecondary">
              <tr>
                <th className="px-4 py-3">Business Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Niche</th>
                <th className="px-4 py-3">Website</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-surface2/60">
                  <td className="px-4 py-3 text-textPrimary">{lead.business_name}</td>
                  <td className="px-4 py-3">
                    {hasContactablePhone(lead.phone) ? (
                      <span className="text-textSecondary">{lead.phone}</span>
                    ) : (
                      <span className="text-warning">Phone missing</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-textSecondary">{lead.city || "N/A"}</td>
                  <td className="px-4 py-3 text-textSecondary">{lead.niche || "N/A"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={lead.has_website ? "muted" : "danger"}>
                      {lead.has_website ? "Has Website" : "No Website"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="default">{lead.status}</Badge>
                      {hasContactablePhone(lead.phone) ? (
                        <Badge variant="success">Campaign ready</Badge>
                      ) : (
                        <Badge variant="warning">Needs phone lookup</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-textSecondary">{formatDate(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <Button variant="danger" className="px-3 py-1 text-xs" onClick={() => onDelete?.(lead.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
