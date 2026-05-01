import { Card, CardContent } from "@/components/ui/card";

export function FullDisclaimer({ includeApiNote = false }: { includeApiNote?: boolean }) {
  return (
    <Card className="border-warning/25 bg-warning/5">
      <CardContent className="space-y-4 p-6">
        <p className="text-lg font-semibold text-textPrimary">Important Disclaimer</p>
        <div className="space-y-2 text-sm leading-6 text-textSecondary">
          <p>ReachIQ is an independent platform and is not affiliated with, endorsed by, or officially connected to WhatsApp LLC or Meta Platforms, Inc.</p>
          <p>By using ReachIQ&apos;s messaging features, you agree to the following:</p>
          <p>1. WhatsApp Terms of Service. Sending bulk unsolicited messages may violate WhatsApp&apos;s Terms of Service and can result in your phone number being permanently banned.</p>
          <p>2. Message Delays. Always use minimum 5 to 10 second delays between messages. ReachIQ enforces a minimum delay to reduce ban risk, but cannot guarantee your number will not be banned.</p>
          <p>3. Consent. Only send messages to people who have given consent or whom you have a legitimate business reason to contact. Never use ReachIQ for spam.</p>
          <p>4. Legal Compliance. You are responsible for complying with all applicable laws including TRAI regulations in India, GDPR if applicable, and any local anti-spam laws.</p>
          <p>5. Account Responsibility. You are solely responsible for your WhatsApp account. ReachIQ is not liable for any bans, restrictions, or legal consequences resulting from your use of the platform.</p>
          <p>6. No Guarantee. ReachIQ does not guarantee message delivery, client conversions, or any business results.</p>
          <p>By continuing, you acknowledge you have read and accept these terms.</p>
        </div>
        {includeApiNote ? (
          <p className="rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-textSecondary">
            Your WhatsApp Phone Number ID and Access Token are stored securely and encrypted. ReachIQ never shares your credentials with third parties. You can disconnect and delete your credentials at any time from Settings.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
