import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { followUpQueue } from "../queues/followUpQueue.js";
import { runDueFollowUps } from "../services/followUpService.js";
import { getLiveMessageAllowance } from "../services/campaignService.js";
import { deleteDemoFollowUp, getDemoFollowUps, isDemoMode } from "../utils/demo.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const items = getDemoFollowUps().map((item) => ({
        ...item,
        status: item.sent ? "sent" : new Date(item.scheduled_at).getTime() <= Date.now() ? "due" : "scheduled",
        can_cancel: !item.sent
      }));
      return res.json({
        items,
        campaigns: [],
        leads: [],
        summary: buildSummary(items)
      });
    }

    if (!followUpQueue) {
      await runDueFollowUps({ userId: req.user.id });
    }

    const { data, error } = await supabaseAdmin
      .from("follow_ups")
      .select("*, leads(business_name, phone), campaigns(name)")
      .eq("user_id", req.user.id)
      .order("scheduled_at", { ascending: true });
    if (error) throw error;

    const [{ data: campaigns, error: campaignsError }, { data: leads, error: leadsError }] = await Promise.all([
      supabaseAdmin
        .from("campaigns")
        .select("id, name, status")
        .eq("user_id", req.user.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("leads")
        .select("id, business_name, phone, city, niche")
        .eq("user_id", req.user.id)
        .order("business_name", { ascending: true })
    ]);

    if (campaignsError) throw campaignsError;
    if (leadsError) throw leadsError;

    const items = (data || []).map((item) => ({
      ...item,
      status: item.sent ? "sent" : new Date(item.scheduled_at).getTime() <= Date.now() ? "due" : "scheduled",
      can_cancel: !item.sent
    }));

    res.json({
      items,
      campaigns: campaigns || [],
      leads: leads || [],
      summary: buildSummary(items)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const message = String(req.body.message || "").trim();
    const leadId = req.body.lead_id;
    const scheduledAt = req.body.scheduled_at;
    const scheduledDate = new Date(scheduledAt);

    if (!leadId) {
      return res.status(400).json({ error: "Select a lead before scheduling a follow-up." });
    }

    if (!message) {
      return res.status(400).json({ error: "Add the follow-up message you want to send." });
    }

    if (!scheduledAt || Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: "Choose a valid date and time for the follow-up." });
    }

    if (scheduledDate.getTime() <= Date.now()) {
      const allowance = await getLiveMessageAllowance(req.user.id);
      if (allowance.used >= allowance.total) {
        return res.status(403).json({
          error: "Daily message limit reached",
          totalLimit: allowance.total
        });
      }
    }

    if (isDemoMode) {
      return res.status(201).json({
        id: `fu-${Date.now()}`,
        campaign_id: req.body.campaign_id,
        user_id: req.user.id,
        lead_id: leadId,
        message,
        scheduled_at: scheduledAt,
        step_number: req.body.step_number || 1,
        sent: false,
        sent_at: null
      });
    }

    const payload = {
      campaign_id: req.body.campaign_id,
      user_id: req.user.id,
      lead_id: leadId,
      message,
      scheduled_at: scheduledDate.toISOString(),
      step_number: Math.max(1, Number(req.body.step_number) || 1)
    };
    const { data, error } = await supabaseAdmin.from("follow_ups").insert(payload).select().single();
    if (error) throw error;
    if (followUpQueue) {
      await followUpQueue.add(`follow-up-${data.id}`, { followUpId: data.id }, { delay: 1000 });
    } else if (scheduledDate.getTime() <= Date.now()) {
      await runDueFollowUps({ userId: req.user.id, followUpId: data.id });
    }
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      deleteDemoFollowUp(req.params.id);
      return res.status(204).send();
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("follow_ups")
      .select("id, sent")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      return res.status(404).json({ error: "Follow-up not found." });
    }
    if (existing.sent) {
      return res.status(400).json({ error: "Sent follow-ups stay in history and cannot be canceled." });
    }

    const { error } = await supabaseAdmin
      .from("follow_ups")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

function buildSummary(items) {
  return {
    total: items.length,
    due: items.filter((item) => item.status === "due").length,
    scheduled: items.filter((item) => item.status === "scheduled").length,
    sent: items.filter((item) => item.status === "sent").length
  };
}

export default router;
