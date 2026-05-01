import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { buildPaginationPayload, paginate } from "../utils/helpers.js";
import {
  getPlanConfig,
  paymentsEnabled
} from "../services/paymentService.js";
import { createNotification } from "../services/notificationService.js";
import { sendPaymentSubmissionEmail } from "../services/emailService.js";
import {
  isDemoMode
} from "../utils/demo.js";
import { supabaseAdmin } from "../utils/supabase.js";

const router = express.Router();
router.use(requireAuth);

const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

let demoPaymentSubmissions = [];

function ensurePaymentsEnabledOrThrow(resolvedEnabled) {
  if (!resolvedEnabled) {
    const error = new Error("Payments are coming soon");
    error.status = 503;
    throw error;
  }
}

function normalizeTransactionId(value) {
  return String(value || "").trim();
}

function validateTransactionId(transactionId) {
  return TRANSACTION_ID_PATTERN.test(transactionId);
}

async function tryCreateNotification(payload) {
  try {
    await createNotification(payload);
  } catch (error) {
    console.error("[ReachIQ] Payment notification failed", error);
  }
}

async function runBestEffort(tasks) {
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[ReachIQ] Payment side effect failed", result.reason);
    }
  }
}

router.post("/submit", async (req, res, next) => {
  try {
    ensurePaymentsEnabledOrThrow(await paymentsEnabled());

    const plan = String(req.body?.plan || "").trim().toLowerCase();
    const planConfig = getPlanConfig(plan);
    if (!planConfig) {
      return res.status(400).json({ error: "Please choose a valid paid plan." });
    }

    const transactionId = normalizeTransactionId(req.body?.upi_transaction_id);
    if (!validateTransactionId(transactionId)) {
      return res.status(400).json({ error: "Please enter a valid UPI Transaction ID." });
    }

    if (isDemoMode) {
      const existingPending = demoPaymentSubmissions.find(
        (item) => item.user_id === req.user.id && item.plan === plan && item.status === "pending"
      );
      if (existingPending) {
        return res.status(409).json({ error: "A payment submission for this plan is already awaiting review." });
      }

      const duplicateTx = demoPaymentSubmissions.find(
        (item) => item.upi_transaction_id.toLowerCase() === transactionId.toLowerCase()
      );
      if (duplicateTx) {
        return res.status(409).json({ error: "This transaction ID has already been submitted." });
      }

      const submission = {
        id: `payment-${Date.now()}`,
        user_id: req.user.id,
        plan,
        amount: planConfig.price,
        upi_transaction_id: transactionId,
        status: "pending",
        reviewed_by: null,
        review_notes: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      demoPaymentSubmissions = [submission, ...demoPaymentSubmissions];
      return res.status(201).json(submission);
    }

    const [
      { data: existingPending, error: pendingError },
      { data: duplicateTx, error: duplicateError }
    ] = await Promise.all([
      supabaseAdmin
        .from("payment_submissions")
        .select("id")
        .eq("user_id", req.user.id)
        .eq("plan", plan)
        .eq("status", "pending")
        .maybeSingle(),
      supabaseAdmin
        .from("payment_submissions")
        .select("id")
        .ilike("upi_transaction_id", transactionId)
        .maybeSingle()
    ]);

    if (pendingError) throw pendingError;
    if (duplicateError) throw duplicateError;

    if (existingPending) {
      return res.status(409).json({ error: "A payment submission for this plan is already awaiting review." });
    }

    if (duplicateTx) {
      return res.status(409).json({ error: "This transaction ID has already been submitted." });
    }

    const { data, error } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        user_id: req.user.id,
        plan,
        amount: planConfig.price,
        upi_transaction_id: transactionId,
        status: "pending"
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "This transaction ID has already been submitted." });
      }
      throw error;
    }

    void runBestEffort([
      tryCreateNotification({
        userId: req.user.id,
        title: "Payment submitted",
        body: `${planConfig.label} payment submitted. ReachIQ will review and activate your plan soon.`,
        type: "info",
        metadata: { paymentSubmissionId: data.id, plan }
      }),
      sendPaymentSubmissionEmail({
        to: req.profile?.email || req.user?.email,
        fullName: req.profile?.full_name,
        planLabel: planConfig.label,
        amount: `Rs ${planConfig.price}`,
        transactionId
      })
    ]);

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (req, res, next) => {
  try {
    ensurePaymentsEnabledOrThrow(await paymentsEnabled());

    const pager = paginate(req.query.page, req.query.pageSize);

    if (isDemoMode) {
      const history = demoPaymentSubmissions
        .filter((item) => item.user_id === req.user.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return res.json({
        data: history.slice(pager.from, pager.to + 1),
        pagination: buildPaginationPayload(history.length, pager.page, pager.pageSize)
      });
    }

    const { data, error, count } = await supabaseAdmin
      .from("payment_submissions")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(pager.from, pager.to);

    if (error) throw error;

    res.json({
      data: data || [],
      pagination: buildPaginationPayload(count, pager.page, pager.pageSize)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/create-order", async (req, res, next) => {
  try {
    ensurePaymentsEnabledOrThrow(await paymentsEnabled());
    res.status(501).json({ error: "Automated payment orders are not enabled yet. Use manual UPI submission." });
  } catch (error) {
    next(error);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    ensurePaymentsEnabledOrThrow(await paymentsEnabled());
    res.status(501).json({ error: "Automated verification is not enabled yet. Submit the UPI transaction ID for review." });
  } catch (error) {
    next(error);
  }
});

export function getDemoPaymentSubmissions() {
  return [...demoPaymentSubmissions];
}

export function seedDemoPaymentSubmission(submission) {
  demoPaymentSubmissions = [
    {
      ...submission,
      created_at: submission.created_at || new Date().toISOString(),
      updated_at: submission.updated_at || new Date().toISOString()
    },
    ...demoPaymentSubmissions
  ];
}

export function updateDemoPaymentSubmission(id, updates) {
  let updatedSubmission = null;

  demoPaymentSubmissions = demoPaymentSubmissions.map((submission) => {
    if (submission.id !== id) {
      return submission;
    }

    updatedSubmission = {
      ...submission,
      ...updates,
      updated_at: new Date().toISOString()
    };

    return updatedSubmission;
  });

  return updatedSubmission;
}

export default router;
