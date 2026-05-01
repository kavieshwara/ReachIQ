import { Card, CardContent } from "@/components/ui/card";

export function DemoVideoPlayer({ url }: { url?: string | null }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <p className="text-lg font-semibold text-textPrimary">Watch how ReachIQ works</p>
          <p className="text-sm text-textSecondary">Your walkthrough video is controlled from admin settings.</p>
        </div>
        {url ? (
          <div className="aspect-video overflow-hidden rounded-2xl border border-border">
            <iframe className="h-full w-full" src={url} allow="autoplay; encrypted-media" allowFullScreen title="ReachIQ demo" />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border bg-surface2 text-textSecondary">
            Demo coming soon
          </div>
        )}
      </CardContent>
    </Card>
  );
}
