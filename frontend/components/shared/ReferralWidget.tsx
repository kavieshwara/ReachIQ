import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ReferralWidget({ code }: { code?: string | null }) {
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="flex items-center justify-between gap-6 p-6">
        <div>
          <p className="text-lg font-semibold text-textPrimary">Invite a friend. Grow your daily limit.</p>
          <p className="text-sm text-textSecondary">Both of you get 10 extra free messages per day with every successful referral.</p>
        </div>
        <Button variant="secondary">{code ? `Code: ${code}` : "Open referrals"}</Button>
      </CardContent>
    </Card>
  );
}
