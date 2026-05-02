import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
process.env.BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || "https://reachiq-api.onrender.com";
process.env.API_PUBLIC_URL = process.env.API_PUBLIC_URL || process.env.BACKEND_PUBLIC_URL;
process.env.WEBSITE_PREVIEW_BASE_URL = process.env.WEBSITE_PREVIEW_BASE_URL || process.env.BACKEND_PUBLIC_URL;

const { supabaseAdmin } = await import("../src/utils/supabase.js");
const { resolveGeneratedWebsitePreviewUrl } = await import("../src/services/websiteService.js");
const { resolveGeneratedWebsiteVideoUrl } = await import("../src/services/videoCaptureService.js");

function isMissingOutreachPreparationsTable(error) {
  const message = String(error?.message || "");
  return (
    message.includes("public.outreach_preparations") ||
    message.includes('relation "public.outreach_preparations" does not exist') ||
    message.includes("schema cache")
  );
}

async function repairGeneratedWebsites() {
  const { data, error } = await supabaseAdmin.from("generated_websites").select("id, live_url");
  if (error) {
    throw error;
  }

  let repaired = 0;
  for (const row of data || []) {
    const nextUrl = resolveGeneratedWebsitePreviewUrl({
      websiteId: row.id,
      liveUrl: row.live_url
    });

    if (nextUrl && nextUrl !== row.live_url) {
      const { error: updateError } = await supabaseAdmin
        .from("generated_websites")
        .update({ live_url: nextUrl })
        .eq("id", row.id);

      if (updateError) {
        throw updateError;
      }

      repaired += 1;
    }
  }

  return repaired;
}

async function repairOutreachPreparations() {
  const { data, error } = await supabaseAdmin
    .from("outreach_preparations")
    .select("id, generated_website_id, website_live_url, video_url");

  if (error) {
    if (isMissingOutreachPreparationsTable(error)) {
      return { skipped: true, repaired: 0 };
    }
    throw error;
  }

  let repaired = 0;
  for (const row of data || []) {
    const nextWebsiteUrl = resolveGeneratedWebsitePreviewUrl({
      websiteId: row.generated_website_id,
      liveUrl: row.website_live_url
    }) || null;
    const nextVideoUrl = resolveGeneratedWebsiteVideoUrl({
      videoId: row.id,
      videoUrl: row.video_url
    }) || null;

    if (nextWebsiteUrl !== row.website_live_url || nextVideoUrl !== row.video_url) {
      const { error: updateError } = await supabaseAdmin
        .from("outreach_preparations")
        .update({
          website_live_url: nextWebsiteUrl,
          video_url: nextVideoUrl
        })
        .eq("id", row.id);

      if (updateError) {
        throw updateError;
      }

      repaired += 1;
    }
  }

  return { skipped: false, repaired };
}

async function main() {
  const websitesRepaired = await repairGeneratedWebsites();
  const prepResult = await repairOutreachPreparations();

  console.log(
    JSON.stringify(
      {
        generated_websites_repaired: websitesRepaired,
        outreach_preparations_repaired: prepResult.repaired,
        outreach_preparations_skipped: prepResult.skipped
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
