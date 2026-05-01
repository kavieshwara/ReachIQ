import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { createNotification } from "../services/notificationService.js";
import { notifySupportInboxEmail } from "../services/emailService.js";
import { createDemoSupportTicket, getDemoSupportTickets, isDemoMode } from "../utils/demo.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(getDemoSupportTickets());
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.status(201).json(createDemoSupportTicket(req.body));
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: req.user.id,
        subject: req.body.subject,
        message: req.body.message
      })
      .select()
      .single();
    if (error) throw error;

    await createNotification({
      userId: req.user.id,
      title: "Support ticket submitted",
      body: `We received "${data.subject}" and the ReachIQ team will review it soon.`,
      type: "info",
      metadata: { ticketId: data.id }
    });

    try {
      await notifySupportInboxEmail({
        subject: data.subject,
        message: data.message,
        fromEmail: req.profile?.email,
        fromName: req.profile?.full_name
      });
    } catch (emailError) {
      console.error(`[${new Date().toISOString()}] support inbox email failed`, emailError);
    }

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
