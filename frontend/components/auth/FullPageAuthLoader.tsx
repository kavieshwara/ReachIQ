"use client";

import { LoadingScreen } from "@/components/ui/LoadingScreen";

export function FullPageAuthLoader({
  title = "Loading ReachIQ",
  description = "Restoring your session and workspace."
}: {
  title?: string;
  description?: string;
}) {
  return <LoadingScreen title={title} description={description} />;
}
