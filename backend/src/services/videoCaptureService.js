import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import ffmpegStatic from "ffmpeg-static";
import { supabaseAdmin } from "../utils/supabase.js";
import { findCompatLeadPreparationByCampaignLeadId } from "./campaignAutomationCompatService.js";
import {
  buildPreviewBaseUrl,
  getGeneratedWebsitePreviewHtml,
  resolveGeneratedWebsitePreviewUrl
} from "./websiteService.js";

const VIDEO_ROOT = path.resolve(process.cwd(), process.env.WEBSITE_VIDEO_DIR || ".runtime/generated-videos");
const RUNTIME_BIN_ROOT = path.resolve(process.cwd(), ".runtime/bin");
const RUNTIME_FFMPEG_PATH = path.join(RUNTIME_BIN_ROOT, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const LOCAL_FFMPEG_STATIC_PATH = typeof ffmpegStatic === "string" ? ffmpegStatic : null;
const BUNDLED_PLAYWRIGHT_INDEX = process.env.PLAYWRIGHT_PACKAGE_PATH
  ? pathToFileURL(path.resolve(process.cwd(), process.env.PLAYWRIGHT_PACKAGE_PATH)).href
  : null;
const CAPTURE_WIDTH = 1280;
const CAPTURE_HEIGHT = 720;
const WEBSITE_VIDEO_ENABLED = String(process.env.ENABLE_WEBSITE_VIDEO || "true").toLowerCase() !== "false";
const MAX_CONCURRENT_CAPTURES = Math.max(1, Number(process.env.MAX_VIDEO_CAPTURE_CONCURRENCY || 1));
const VIDEO_STORAGE_BUCKET = process.env.WEBSITE_VIDEO_BUCKET || "platform-assets";
const VIDEO_STORAGE_PREFIX = (process.env.WEBSITE_VIDEO_STORAGE_PREFIX || "generated-videos").replace(/^\/+|\/+$/g, "");
const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH,
].filter(Boolean);
const inFlightCaptures = new Map();
let activeCaptures = 0;
const captureWaitQueue = [];

async function ensureVideoRoot() {
  await fs.mkdir(VIDEO_ROOT, { recursive: true });
}

async function acquireCaptureSlot() {
  if (activeCaptures < MAX_CONCURRENT_CAPTURES) {
    activeCaptures += 1;
    return;
  }

  await new Promise((resolve) => {
    captureWaitQueue.push(resolve);
  });
  activeCaptures += 1;
}

function releaseCaptureSlot() {
  activeCaptures = Math.max(0, activeCaptures - 1);
  const next = captureWaitQueue.shift();
  if (next) {
    next();
  }
}

async function fileExists(targetPath) {
  if (!targetPath) {
    return false;
  }

  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromeExecutablePath() {
  for (const candidate of CHROME_CANDIDATES) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

let cachedChromium = null;

async function loadChromium() {
  if (cachedChromium) {
    return cachedChromium;
  }

  try {
    const localPlaywright = await import("playwright");
    if (localPlaywright?.chromium) {
      cachedChromium = localPlaywright.chromium;
      return cachedChromium;
    }
  } catch {
    // fall through to bundled runtime Playwright
  }

  if (BUNDLED_PLAYWRIGHT_INDEX) {
    const bundledPlaywright = await import(BUNDLED_PLAYWRIGHT_INDEX);
    if (bundledPlaywright?.chromium) {
      cachedChromium = bundledPlaywright.chromium;
      return cachedChromium;
    }
  }

  throw new Error("Playwright is not available, so ReachIQ cannot record website videos yet.");
}

async function createScrollPlan(page) {
  const metrics = await page.evaluate(() => ({
    scrollHeight: Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ),
    viewportHeight: window.innerHeight
  }));

  const maxScroll = Math.max(metrics.scrollHeight - metrics.viewportHeight, 0);
  if (maxScroll <= 20) {
    return [
      { delay: 800, y: 0 },
      { delay: 800, y: 0 }
    ];
  }

  return [0, 0.3, 0.62, 1, 0].map((progress, index) => ({
    delay: index === 0 ? 800 : 1050,
    y: Math.round(maxScroll * progress)
  }));
}

async function smoothScrollTo(page, targetY, durationMs) {
  await page.evaluate(
    ({ y, duration }) =>
      new Promise((resolve) => {
        const startY = window.scrollY;
        const delta = y - startY;
        const start = performance.now();

        const step = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          window.scrollTo(0, startY + delta * eased);

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(step);
      }),
    { y: targetY, duration: durationMs }
  );
}

async function animatePreview(page) {
  const scrollPlan = await createScrollPlan(page);

  await page.waitForTimeout(650);

  for (const step of scrollPlan) {
    await page.waitForTimeout(step.delay);
    await smoothScrollTo(page, step.y, 1800);
  }

  await page.waitForTimeout(900);
}

function injectPreviewBase(html, previewUrl) {
  const baseTag = `<base href="${previewUrl.replace(/"/g, "&quot;")}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }

  return `${baseTag}${html}`;
}

async function openPreviewPage(page, previewUrl, previewHtml = "") {
  page.setDefaultTimeout(30000);

  let html = String(previewHtml || "").trim();

  if (!html) {
    const response = await fetch(previewUrl);
    if (!response.ok) {
      throw new Error(`ReachIQ could not load the generated website preview for video capture. ${response.status} ${response.statusText}`.trim());
    }

    html = await response.text();
  }

  await page.setContent(injectPreviewBase(html, previewUrl), {
    waitUntil: "domcontentloaded",
    timeout: 25000
  });

  await page.addStyleTag({
    content: `
      html, body {
        min-width: 100%;
        width: 100%;
        min-height: 100%;
        margin: 0 !important;
        overflow-x: hidden !important;
        scrollbar-width: none !important;
        overscroll-behavior: none !important;
      }
      body {
        position: relative;
        max-width: 100vw;
      }
      html::-webkit-scrollbar,
      body::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
    `
  });

  await page.evaluate(() => {
    const bodyStyles = window.getComputedStyle(document.body);
    const rootStyles = window.getComputedStyle(document.documentElement);
    const background =
      bodyStyles.backgroundColor && bodyStyles.backgroundColor !== "rgba(0, 0, 0, 0)"
        ? bodyStyles.backgroundColor
        : rootStyles.backgroundColor && rootStyles.backgroundColor !== "rgba(0, 0, 0, 0)"
          ? rootStyles.backgroundColor
          : "#0b0b12";

    document.documentElement.style.background = background;
    document.body.style.background = background;
    document.body.style.minWidth = "100%";
    document.body.style.width = "100%";
    document.documentElement.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";
    window.scrollTo(0, 0);
  });

  await page.evaluate(async () => {
    try {
      await document.fonts?.ready;
    } catch {
      // ignore font readiness errors
    }

    const images = Array.from(document.images || []);
    await Promise.all(
      images.map(async (image) => {
        try {
          if ("decode" in image) {
            await image.decode();
          }
        } catch {
          // ignore decode failures
        }
      })
    );
  });

  await page.waitForTimeout(1800);
}

let cachedFfmpegPath = null;

async function resolveFfmpegBinaryPath() {
  if (cachedFfmpegPath && (await fileExists(cachedFfmpegPath))) {
    return cachedFfmpegPath;
  }

  const candidatePaths = [
    process.env.FFMPEG_BIN,
    LOCAL_FFMPEG_STATIC_PATH,
    RUNTIME_FFMPEG_PATH
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (await fileExists(candidate)) {
      cachedFfmpegPath = candidate;
      return candidate;
    }
  }

  throw new Error("ReachIQ could not find ffmpeg. Set FFMPEG_BIN or install ffmpeg for this environment.");
}

async function convertWebmToMp4(inputPath, outputPath) {
  const ffmpegPath = await resolveFfmpegBinaryPath();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const trimSeconds = Number(process.env.WEBSITE_VIDEO_TRIM_START_SECONDS || 1.2);

  const args = [
    "-y",
    "-i",
    inputPath,
    "-ss",
    String(trimSeconds),
    "-vf",
    `fps=30,scale=${CAPTURE_WIDTH}:${CAPTURE_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${CAPTURE_WIDTH}:${CAPTURE_HEIGHT}`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-preset",
    "slow",
    "-crf",
    "20",
    "-an",
    outputPath
  ];

  const child = spawn(ffmpegPath, args, {
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const [code] = await once(child, "close");
  if (code !== 0) {
    throw new Error(`ffmpeg failed to create the website video. ${stderr || `Exit code ${code}`}`.trim());
  }
}

function buildVideoTempDir(videoId) {
  return path.join(os.tmpdir(), "reachiq-video-capture", videoId);
}

export function buildGeneratedWebsiteVideoUrl(videoId) {
  return `${buildPreviewBaseUrl()}/preview-video/${videoId}`;
}

export function resolveGeneratedWebsiteVideoUrl({ videoId, videoUrl }) {
  if (videoId) {
    return buildGeneratedWebsiteVideoUrl(videoId);
  }

  const normalizedVideoUrl = String(videoUrl || "").trim();
  if (!normalizedVideoUrl) {
    return "";
  }

  try {
    const parsed = new URL(normalizedVideoUrl);
    const previewVideoPath = parsed.pathname.replace(/^\/api\/websites(?=\/preview-video\/)/i, "");
    if (previewVideoPath.startsWith("/preview-video/")) {
      return `${buildPreviewBaseUrl()}${previewVideoPath}${parsed.search}`;
    }
  } catch {
    // Ignore invalid URLs and fall back to the stored value.
  }

  return normalizedVideoUrl;
}

export function getGeneratedWebsiteVideoFilePath(videoId) {
  return path.join(VIDEO_ROOT, `${videoId}.mp4`);
}

export function isWebsiteVideoEnabled() {
  return WEBSITE_VIDEO_ENABLED;
}

export async function releaseGeneratedWebsiteVideo(videoId, { removeStorage = false } = {}) {
  const finalVideoPath = getGeneratedWebsiteVideoFilePath(videoId);
  await fs.rm(finalVideoPath, { force: true }).catch(() => null);

  if (!removeStorage) {
    return;
  }

  const { error } = await supabaseAdmin.storage
    .from(VIDEO_STORAGE_BUCKET)
    .remove([getStorageObjectPath(videoId)]);

  if (error) {
    throw error;
  }
}

export async function cleanupStaleVideoArtifacts() {
  const captureRoot = path.join(os.tmpdir(), "reachiq-video-capture");
  const maxArtifactAgeMs = Number(process.env.WEBSITE_VIDEO_TEMP_TTL_MS || 1000 * 60 * 30);
  const cutoff = Date.now() - maxArtifactAgeMs;

  const cleanupEntries = async (rootDir) => {
    let entries = [];
    try {
      entries = await fs.readdir(rootDir, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const targetPath = path.join(rootDir, entry.name);
        try {
          const stats = await fs.stat(targetPath);
          if (stats.mtimeMs < cutoff) {
            await fs.rm(targetPath, { recursive: entry.isDirectory(), force: true }).catch(() => null);
          }
        } catch {
          // Ignore cleanup races and continue.
        }
      })
    );
  };

  await cleanupEntries(captureRoot);
}

function getStorageObjectPath(videoId) {
  return `${VIDEO_STORAGE_PREFIX}/${videoId}.mp4`;
}

async function uploadVideoToStorage(videoId, filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const objectPath = getStorageObjectPath(videoId);
  const { error } = await supabaseAdmin.storage
    .from(VIDEO_STORAGE_BUCKET)
    .upload(objectPath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true
    });

  if (error) {
    throw error;
  }

  return objectPath;
}

async function restoreVideoFromStorage(videoId, targetPath) {
  const objectPath = getStorageObjectPath(videoId);
  const { data, error } = await supabaseAdmin.storage
    .from(VIDEO_STORAGE_BUCKET)
    .download(objectPath);

  if (error || !data) {
    return false;
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, bytes);
  return true;
}

async function findPreparationByVideoId(videoId) {
  const { data, error } = await supabaseAdmin
    .from("outreach_preparations")
    .select("*")
    .eq("campaign_lead_id", videoId)
    .maybeSingle();

  if (!error && data) {
    return data;
  }

  if (error) {
    const message = String(error.message || "");
    const isMissingTable =
      message.includes("public.outreach_preparations") ||
      message.includes("relation \"public.outreach_preparations\" does not exist");

    if (!isMissingTable) {
      throw error;
    }
  }

  return findCompatLeadPreparationByCampaignLeadId(videoId);
}

export async function ensureGeneratedWebsiteVideoAvailable(videoId) {
  await ensureVideoRoot();
  const finalVideoPath = getGeneratedWebsiteVideoFilePath(videoId);

  if (await fileExists(finalVideoPath)) {
    return {
      videoPath: finalVideoPath,
      videoUrl: buildGeneratedWebsiteVideoUrl(videoId)
    };
  }

  const restored = await restoreVideoFromStorage(videoId, finalVideoPath).catch(() => false);
  if (restored && (await fileExists(finalVideoPath))) {
    return {
      videoPath: finalVideoPath,
      videoUrl: buildGeneratedWebsiteVideoUrl(videoId)
    };
  }

  const preparation = await findPreparationByVideoId(videoId);
  if (!preparation) {
    throw new Error("ReachIQ could not find the video preparation for this lead.");
  }

  const previewUrl = resolveGeneratedWebsitePreviewUrl({
    websiteId: preparation.generated_website_id,
    liveUrl: preparation.website_live_url
  });

  if (!previewUrl) {
    throw new Error("ReachIQ needs a generated website preview before it can rebuild the video.");
  }

  const previewHtml = preparation.generated_website_id
    ? await getGeneratedWebsitePreviewHtml(preparation.generated_website_id).catch(() => "")
    : "";

  return captureGeneratedWebsiteVideo({
    videoId,
    previewUrl,
    previewHtml
  });
}

export async function captureGeneratedWebsiteVideo({ videoId, previewUrl, previewHtml = "" }) {
  if (!WEBSITE_VIDEO_ENABLED) {
    throw new Error("Website video capture is disabled in this environment.");
  }

  if (!previewUrl) {
    throw new Error("ReachIQ needs a generated website preview URL before it can record the video.");
  }

  await ensureVideoRoot();
  const finalVideoPath = getGeneratedWebsiteVideoFilePath(videoId);

  try {
    await fs.access(finalVideoPath);
    return {
      videoPath: finalVideoPath,
      videoUrl: buildGeneratedWebsiteVideoUrl(videoId)
    };
  } catch {
    // continue and create the file
  }

  const existingCapture = inFlightCaptures.get(videoId);
  if (existingCapture) {
    return existingCapture;
  }

  const capturePromise = (async () => {
    await acquireCaptureSlot();
    const tempVideoDir = buildVideoTempDir(videoId);
    let browser = null;
    let webmPath = "";

    try {
      await fs.rm(tempVideoDir, { recursive: true, force: true }).catch(() => null);
      await fs.mkdir(tempVideoDir, { recursive: true });

      const chromium = await loadChromium();
      const executablePath = await resolveChromeExecutablePath();
      browser = await chromium.launch({
        headless: true,
        executablePath: executablePath || undefined
      });

      const context = await browser.newContext({
        viewport: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
        screen: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT },
        deviceScaleFactor: 1,
        recordVideo: {
          dir: tempVideoDir,
          size: { width: CAPTURE_WIDTH, height: CAPTURE_HEIGHT }
        }
      });

      const page = await context.newPage();
      const recordedVideo = page.video();
      await openPreviewPage(page, previewUrl, previewHtml);
      await animatePreview(page);

      await page.close();
      await context.close();
      webmPath = await recordedVideo.path();

      if (!webmPath) {
        throw new Error("ReachIQ recorded the website preview, but could not find the video file.");
      }

      await convertWebmToMp4(webmPath, finalVideoPath);
      await uploadVideoToStorage(videoId, finalVideoPath).catch((error) => {
        console.error("[ReachIQ][video] Failed to upload generated video to storage", error);
      });

      return {
        videoPath: finalVideoPath,
        videoUrl: buildGeneratedWebsiteVideoUrl(videoId)
      };
    } finally {
      await browser?.close().catch(() => null);
      await fs.rm(tempVideoDir, { recursive: true, force: true }).catch(() => null);
      releaseCaptureSlot();
    }
  })();

  inFlightCaptures.set(videoId, capturePromise);

  try {
    return await capturePromise;
  } catch (error) {
    await fs.rm(finalVideoPath, { force: true }).catch(() => null);
    throw error;
  } finally {
    inFlightCaptures.delete(videoId);
  }
}
