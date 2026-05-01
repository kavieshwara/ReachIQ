import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export function StatsCard({
  label,
  value,
  hint,
  icon
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative space-y-4">
        <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <p className="text-sm font-medium text-textSecondary">{label}</p>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-primary">
            {icon}
          </div>
        </div>
        <p className="relative text-3xl font-semibold tracking-tight text-textPrimary">
          {typeof value === "number" ? formatNumber(value) : value}
        </p>
        {hint ? <p className="relative text-sm text-textMuted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
