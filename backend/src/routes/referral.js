import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { getDemoReferral, isDemoMode } from "../utils/demo.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(getDemoReferral());
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("referral_code, bonus_messages, messages_limit")
      .eq("id", req.user.id)
      .single();
    if (profileError) throw profileError;

    const { data: referrals, error: referralError } = await supabaseAdmin
      .from("referrals")
      .select("*, profiles!referrals_referred_id_fkey(full_name, email)")
      .eq("referrer_id", req.user.id)
      .order("created_at", { ascending: false });
    if (referralError) throw referralError;

    res.json({
      profile,
      referrals
    });
  } catch (error) {
    next(error);
  }
});

export default router;
