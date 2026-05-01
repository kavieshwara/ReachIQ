import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const placeholders = [
  "{{BUSINESS_NAME}}",
  "{{PHONE}}",
  "{{ADDRESS}}",
  "{{CITY}}",
];

const optionalPlaceholders = [
  "{{TAGLINE}}",
  "{{SERVICES}}",
  "{{WHATSAPP_LINK}}"
];

export function TemplateUploadGuide({
  title = "How template upload works",
  showOpenSourceNote = true
}: {
  title?: string;
  showOpenSourceNote?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="space-y-2">
          <p className="text-lg font-semibold text-textPrimary">{title}</p>
          <p className="text-sm leading-6 text-textSecondary">
            Upload one complete HTML file with inline CSS. ReachIQ swaps the placeholders below when a user generates a live website.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-[22px] border border-primary/20 bg-primary/8 p-4 text-sm leading-6 text-textSecondary">
            <p className="font-medium text-textPrimary">Quick user guide</p>
            <ol className="mt-3 space-y-2">
              <li>1. Build one complete HTML landing page for a local business niche.</li>
              <li>2. Add the required placeholder tokens exactly as shown below.</li>
              <li>3. Keep CSS inside the same file so the preview works instantly in ReachIQ.</li>
              <li>4. Upload the `.html` file or paste the full HTML source into the form.</li>
              <li>5. ReachIQ will validate the placeholders and then make the template available in the shared library.</li>
            </ol>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-textMuted">Required placeholders</p>
            <div className="flex flex-wrap gap-2">
              {placeholders.map((placeholder) => (
                <Badge key={placeholder} variant="muted">
                  {placeholder}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-textMuted">Optional placeholders</p>
            <div className="flex flex-wrap gap-2">
              {optionalPlaceholders.map((placeholder) => (
                <Badge key={placeholder} variant="muted">
                  {placeholder}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
            <p className="font-medium text-textPrimary">Recommended format</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-textSecondary">
              <li>Single `.html` file</li>
              <li>Inline CSS inside <code>&lt;style&gt;</code></li>
              <li>Keep images optional or externally hosted</li>
              <li>Responsive layout for phone + desktop</li>
            </ul>
          </div>
          <div className="rounded-[22px] border border-warning/20 bg-warning/5 p-4">
            <p className="font-medium text-textPrimary">Upload disclaimer</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-textSecondary">
              <li>Templates are intended for business demo pages, not custom app backends.</li>
              <li>No external scripts, tracking pixels, or malicious code</li>
              <li>No backend forms that require custom servers</li>
              <li>Use the required placeholder tokens exactly as written</li>
              <li>Tagline, services, and WhatsApp link can be added if the layout needs them</li>
              {showOpenSourceNote ? <li>Uploaded templates become part of the shared ReachIQ open template library</li> : null}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
