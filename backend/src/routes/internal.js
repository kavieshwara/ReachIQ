import express from "express";

import { runDueFollowUps } from "../services/followUpService.js";

const router = express.Router();

function requireCronSecret(req, res, next) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return res.status(503).json({
      error: "CRON_SECRET is not configured."
    });
  }

  const provided = req.get("x-cron-secret");
  if (!provided || provided !== expected) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  return next();
}

router.post("/run-followups", requireCronSecret, async (req, res, next) => {
  try {
    const summary = await runDueFollowUps({ source: "render-cron" });
    return res.json({
      ok: true,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
