import { Badge } from "@/components/ui/badge";

export function PlanBadge({ plan }: { plan?: string | null }) {
  return <Badge variant={plan === "premium" ? "success" : "default"}>{plan || "free"}</Badge>;
}
