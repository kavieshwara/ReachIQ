import "./utils/loadEnv.js";

import cors from "cors";
import express from "express";

import { startDailyResetCron } from "./cron/dailyReset.js";
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import dashboardRoutes from "./routes/dashboard.js";
import leadRoutes from "./routes/leads.js";
import templateRoutes from "./routes/templates.js";
import websiteRoutes from "./routes/websites.js";
import referralRoutes from "./routes/referral.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import mapsRoutes from "./routes/maps.js";
import paymentRoutes from "./routes/payments.js";
import supportRoutes from "./routes/support.js";
import platformRoutes from "./routes/platform.js";
import searchRoutes from "./routes/search.js";
import notificationRoutes from "./routes/notifications.js";
import internalRoutes from "./routes/internal.js";
import { supabaseAdmin } from "./utils/supabase.js";

const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "FRONTEND_URL"
];

const missing = requiredEnvVars.filter((key) => !process.env[key]);
if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
  missing.push("GROQ_API_KEY or GEMINI_API_KEY");
}

if (missing.length > 0) {
  console.error("FATAL: Missing environment variables:", missing.join(", "));
  process.exit(1);
}

console.log("[ReachIQ] Required environment variables present");

process.on("unhandledRejection", (reason) => {
  console.error("[ReachIQ] Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[ReachIQ] Uncaught exception", error);
});

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...String(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  "http://localhost:3000",
  "https://localhost:3000",
  "http://localhost:3002",
  "https://localhost:3002"
].filter(Boolean);

function createLazyRouter(importer) {
  let routerPromise = null;

  return async (req, res, next) => {
    try {
      if (!routerPromise) {
        routerPromise = importer().then((module) => module.default);
      }

      const router = await routerPromise;
      return router(req, res, next);
    } catch (error) {
      return next(error);
    }
  };
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(apiRateLimiter);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV,
    memory: process.memoryUsage()
  });
});

app.get("/health/deep", async (req, res) => {
  try {
    const startedAt = Date.now();
    const { error } = await supabaseAdmin.from("admin_settings").select("key").limit(1);
    res.json({
      status: error ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: error ? "error" : "connected",
      latencyMs: Date.now() - startedAt,
      error: error?.message || null
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: "unreachable",
      message: err.message
    });
  }
});

app.get("/ping", (req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString()
  });
});

app.get("/preview/:id", async (req, res) => {
  try {
    const { getGeneratedWebsitePreviewHtml } = await import("./services/websiteService.js");
    const html = await getGeneratedWebsitePreviewHtml(req.params.id);
    if (!html) {
      return res.status(404).send("Preview not found");
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.send(html);
  } catch (error) {
    return res.status(500).send(error.message || "Could not load preview");
  }
});

app.get("/preview-video/:id", async (req, res) => {
  try {
    const { ensureGeneratedWebsiteVideoAvailable } = await import("./services/videoCaptureService.js");
    const { videoPath: filePath } = await ensureGeneratedWebsiteVideoAvailable(req.params.id);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "video/mp4");
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(error.statusCode || 404).send("Video not found");
      }
    });
  } catch (error) {
    return res.status(500).send(error.message || "Could not load video");
  }
});

app.use("/api/auth", createLazyRouter(() => import("./routes/auth.js")));
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/campaigns", createLazyRouter(() => import("./routes/campaigns.js")));
app.use("/api/whatsapp", createLazyRouter(() => import("./routes/whatsapp.js")));
app.use("/api/followups", createLazyRouter(() => import("./routes/followups.js")));
app.use("/api/templates", templateRoutes);
app.use("/api/websites", websiteRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/maps", mapsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/internal", internalRoutes);

app.use((error, req, res, next) => {
  console.error(`[${new Date().toISOString()}]`, error);
  res.status(error.status || 500).json({
    error: error.message || "Internal server error"
  });
});

app.listen(port, async () => {
  console.log(`ReachIQ backend running on port ${port}`);
  startDailyResetCron();

  const scheduleVideoCleanup = async () => {
    try {
      const { cleanupStaleVideoArtifacts } = await import("./services/videoCaptureService.js");
      const result = await cleanupStaleVideoArtifacts();
      if (result?.removedTempArtifacts || result?.removedFinalVideos) {
        console.info(
          `[ReachIQ] cleaned stale video artifacts: temp=${result.removedTempArtifacts || 0}, final=${result.removedFinalVideos || 0}`
        );
      }
    } catch (error) {
      console.error("[ReachIQ] stale video cleanup failed", error);
    }
  };

  try {
    await scheduleVideoCleanup();
    const cleanupIntervalMs = Math.max(60_000, Number(process.env.WEBSITE_VIDEO_CLEANUP_INTERVAL_MS || 1000 * 60 * 15));
    const cleanupTimer = setInterval(() => {
      void scheduleVideoCleanup();
    }, cleanupIntervalMs);
    cleanupTimer.unref?.();
  } catch (error) {
    console.error("[ReachIQ] stale video cleanup scheduling failed on boot", error);
  }

  const shouldRestoreQrSessions =
    String(process.env.RESTORE_QR_SESSIONS_ON_BOOT || "false").toLowerCase() === "true";

  if (shouldRestoreQrSessions) {
    try {
      const { restoreSavedQRSessionsOnBoot } = await import("./services/whatsappQRService.js");
      await restoreSavedQRSessionsOnBoot();
    } catch (error) {
      console.error("[ReachIQ] QR session restore failed on boot", error);
    }
  } else {
    console.info("[ReachIQ] Skipping QR session restore on boot; sessions will restore lazily when needed.");
  }

  const shouldWarmProviders =
    String(process.env.WARM_AI_PROVIDERS_ON_BOOT || "false").toLowerCase() === "true";

  if (!shouldWarmProviders) {
    return;
  }

  try {
    const { warmProviders } = await import("./services/geminiService.js");
    await warmProviders?.();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] AI warm-up failed`, error);
  }
});
