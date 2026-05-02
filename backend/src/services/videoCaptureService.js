import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import ffmpegStatic from "ffmpeg-static";
import { buildPreviewBaseUrl } from "./websiteService.js";

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
const CHROME_CANDIDATES = [
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH,
].filter(Boolean);

async function ensureVideoRoot() {
  await fs.mkdir(VIDEO_ROOT, { recursive: true });
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

  const tempVideoDir = buildVideoTempDir(videoId);
  await fs.rm(tempVideoDir, { recursive: true, force: true }).catch(() => null);
  await fs.mkdir(tempVideoDir, { recursive: true });

  const chromium = await loadChromium();
  const executablePath = await resolveChromeExecutablePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath: executablePath || undefined
  });

  let webmPath = "";

  try {
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
  } finally {
    await browser.close().catch(() => null);
  }

  if (!webmPath) {
    throw new Error("ReachIQ recorded the website preview, but could not find the video file.");
  }

  await convertWebmToMp4(webmPath, finalVideoPath);
  await fs.rm(tempVideoDir, { recursive: true, force: true }).catch(() => null);

  return {
    videoPath: finalVideoPath,
    videoUrl: buildGeneratedWebsiteVideoUrl(videoId)
  };
}
