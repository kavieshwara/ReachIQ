import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function DisclaimerBanner() {
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="flex gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
        <p className="text-sm leading-6 text-textSecondary">
          ReachIQ is not affiliated with WhatsApp or Meta. You are responsible for message consent, legal compliance, and the health of your WhatsApp sender account.
        </p>
      </CardContent>
    </Card>
  );
}
