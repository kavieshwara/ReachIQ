import express from "express";
import { supabaseAdmin } from "../utils/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { getActiveWhatsAppConnection } from "../services/whatsappConnectionService.js";
import { getQRSessionSnapshot, scheduleQRSessionRestore, tryRestoreQRSessionIfAvailable } from "../services/whatsappQRService.js";

const router = express.Router();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const connection = await getActiveWhatsAppConnection(req.user.id);
    let qrSnapshot = getQRSessionSnapshot(req.user.id);
    if (connection?.provider_type === "qr" && qrSnapshot.status !== "connected") {
      const restoredQr = await tryRestoreQRSessionIfAvailable(req.user.id, {
        timeoutMs: 1500,
        reason: "auth_me"
      }).catch(() => null);
      if (restoredQr) {
        qrSnapshot = restoredQr;
      } else {
        scheduleQRSessionRestore(req.user.id, { reason: "auth_me_retry" });
      }
    }
    const whatsappConnected = Boolean(
      connection?.status === "connected" ||
      qrSnapshot.status === "connected"
    );

    res.json({
      ...req.profile,
      whatsapp_connected: whatsappConnected
    });
  } catch (error) {
    next(error);
  }
});

router.post("/bootstrap-profile", async (req, res, next) => {
  try {
    const { userId, email, fullName } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: "User ID and email are required" });
    }

    let authUser = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!authUserError && authUserData?.user) {
        authUser = authUserData.user;
        break;
      }

      await sleep(250);
    }

    if (!authUser) {
      return res.status(409).json({
        error: "Auth user not found. This usually means the email is already registered or the signup session is stale.",
        code: "AUTH_USER_NOT_FOUND"
      });
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfileError) {
      throw existingProfileError;
    }

    if (existingProfile) {
      return res.status(200).json(existingProfile);
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email: authUser.email || email,
        full_name: fullName || null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/verify-referral", async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ valid: false, error: "Referral code is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, referral_code")
      .eq("referral_code", code)
      .single();

    if (error || !data) {
      return res.json({ valid: false });
    }

    res.json({ valid: true, referrer: data });
  } catch (error) {
    next(error);
  }
});

router.post("/apply-referral", async (req, res, next) => {
  try {
    const { referralCode, referredUserId } = req.body;
    if (!referralCode || !referredUserId) {
      return res.status(400).json({ error: "Referral code and referred user ID are required" });
    }

    const { data: referrer, error: referrerError } = await supabaseAdmin
      .from("profiles")
      .select("id, bonus_messages")
      .eq("referral_code", referralCode)
      .single();

    if (referrerError || !referrer) {
      return res.status(404).json({ error: "Referral code not found" });
    }

    const { data: referred, error: referredError } = await supabaseAdmin
      .from("profiles")
      .select("id, bonus_messages, referred_by")
      .eq("id", referredUserId)
      .single();

    if (referredError || !referred) {
      return res.status(404).json({ error: "New user profile not found" });
    }

    if (referrer.id === referred.id) {
      return res.status(400).json({ error: "You cannot refer yourself" });
    }

    if (referred.referred_by) {
      return res.status(409).json({ error: "A referral was already applied to this account" });
    }

    const { data: existingReferral, error: existingReferralError } = await supabaseAdmin
      .from("referrals")
      .select("id")
      .eq("referred_id", referred.id)
      .maybeSingle();

    if (existingReferralError) {
      throw existingReferralError;
    }

    if (existingReferral) {
      return res.status(409).json({ error: "A referral was already applied to this account" });
    }

    const { error: insertReferralError } = await supabaseAdmin.from("referrals").insert({
      referrer_id: referrer.id,
      referred_id: referred.id,
      bonus_given: 10
    });

    if (insertReferralError) {
      throw insertReferralError;
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        bonus_messages: Number(referrer.bonus_messages || 0) + 10
      })
      .eq("id", referrer.id);

    await supabaseAdmin
      .from("profiles")
      .update({
        bonus_messages: Number(referred.bonus_messages || 0) + 10,
        referred_by: referrer.id
      })
      .eq("id", referred.id);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
