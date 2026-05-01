import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { getDemoNotifications, isDemoMode, markDemoNotificationRead } from "../utils/demo.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(getDemoNotifications());
    }

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(markDemoNotificationRead(req.params.id));
    }

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.patch("/read-all", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const items = getDemoNotifications().map((item) => markDemoNotificationRead(item.id));
      return res.json(items);
    }

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", req.user.id)
      .eq("read", false)
      .select();

    if (error) {
      throw error;
    }

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

export default router;
