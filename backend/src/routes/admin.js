import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/adminOnly.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { buildPaginationPayload, paginate } from "../utils/helpers.js";
import { sendPaymentReviewEmail, sendSupportReplyEmail } from "../services/emailService.js";
import { createNotification } from "../services/notificationService.js";
import {
  getMessageLimitForPlan,
  getPlanConfig,
  isPaidPlan
} from "../services/paymentService.js";
import { getDemoPaymentSubmissions, updateDemoPaymentSubmission } from "./payments.js";
import { getDemoAdminCampaigns, getDemoAdminStats, getDemoAdminTickets, getDemoAdminUsers, getDemoSettings, isDemoMode } from "../utils/demo.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

async function runBestEffort(tasks) {
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[ReachIQ] Admin payment side effect failed", result.reason);
    }
  }
}

async function attachPaymentSubmissionProfiles(submissions = []) {
  const userIds = [...new Set(submissions.map((submission) => submission.user_id).filter(Boolean))];
  if (!userIds.length) {
    return submissions;
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  if (error) {
    throw error;
  }

  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return submissions.map((submission) => ({
    ...submission,
    user_profile: profileMap.get(submission.user_id) || null
  }));
}

router.get("/stats", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(getDemoAdminStats());
    }

    const [users, campaigns, leads, websites, tickets, settings] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, plan, created_at", { count: "exact" }),
      supabaseAdmin.from("campaigns").select("id, status, created_at, sent_count", { count: "exact" }),
      supabaseAdmin.from("leads").select("id", { count: "exact" }),
      supabaseAdmin.from("generated_websites").select("id", { count: "exact" }),
      supabaseAdmin.from("support_tickets").select("id, status", { count: "exact" }),
      supabaseAdmin.from("admin_settings").select("key, value")
    ]);

    const userRows = users.data || [];
    const campaignRows = campaigns.data || [];
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const settingsMap = Object.fromEntries((settings.data || []).map((item) => [item.key, item.value]));

    res.json({
      users: users.count || 0,
      campaigns: campaigns.count || 0,
      leads: leads.count || 0,
      websites: websites.count || 0,
      activeCampaigns: campaignRows.filter((item) => item.status === "running").length,
      premiumUsers: userRows.filter((item) => isPaidPlan(item.plan)).length,
      newToday: userRows.filter((item) => item.created_at && new Date(item.created_at) >= dayAgo).length,
      newThisWeek: userRows.filter((item) => item.created_at && new Date(item.created_at) >= weekAgo).length,
      totalMessagesSent: campaignRows.reduce((sum, item) => sum + Number(item.sent_count || 0), 0),
      openTickets: (tickets.data || []).filter((item) => item.status !== "closed").length,
      paymentsEnabled: settingsMap.payments_enabled === "true"
    });
  } catch (error) {
    next(error);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const pager = paginate(req.query.page, req.query.pageSize);
      const data = getDemoAdminUsers();
      return res.json({ data: data.slice(pager.from, pager.to + 1), pagination: buildPaginationPayload(data.length, pager.page, pager.pageSize) });
    }

    const pager = paginate(req.query.page, req.query.pageSize);
    const search = String(req.query.search || "").trim().toLowerCase();
    const plan = String(req.query.plan || "").trim().toLowerCase();
    const role = String(req.query.role || "").trim().toLowerCase();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const filtered = (data || []).filter((user) => {
      const matchesSearch = !search || [user.full_name, user.email].filter(Boolean).join(" ").toLowerCase().includes(search);
      const matchesPlan = !plan || String(user.plan || "").toLowerCase() === plan;
      const matchesRole = !role || String(user.role || "").toLowerCase() === role;
      return matchesSearch && matchesPlan && matchesRole;
    });

    res.json({
      data: filtered.slice(pager.from, pager.to + 1),
      pagination: buildPaginationPayload(filtered.length, pager.page, pager.pageSize)
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ id: req.params.id, ...req.body });
    }

    const payload = { ...req.body };
    if (payload.plan && payload.messages_limit === undefined) {
      payload.messages_limit = await getMessageLimitForPlan(payload.plan);
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(payload)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.status(204).send();
    }

    if (req.profile?.id === req.params.id) {
      return res.status(400).json({ error: "Admins cannot delete their own account from the console." });
    }

    const [{ error: profileError }, authResult] = await Promise.all([
      supabaseAdmin.from("profiles").delete().eq("id", req.params.id),
      supabaseAdmin.auth.admin.deleteUser(req.params.id)
    ]);

    if (profileError) throw profileError;
    if (authResult?.error) throw authResult.error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/tickets", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const pager = paginate(req.query.page, req.query.pageSize);
      const data = getDemoAdminTickets();
      return res.json({ data: data.slice(pager.from, pager.to + 1), pagination: buildPaginationPayload(data.length, pager.page, pager.pageSize) });
    }

    const pager = paginate(req.query.page, req.query.pageSize);
    const { data, error, count } = await supabaseAdmin
      .from("support_tickets")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    res.json({
      data: (data || []).slice(pager.from, pager.to + 1),
      pagination: buildPaginationPayload(count || data?.length || 0, pager.page, pager.pageSize)
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/tickets/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ success: true });
    }

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .update({
        admin_reply: req.body.admin_reply,
        status: req.body.status || "closed",
        updated_at: new Date().toISOString()
      })
      .eq("id", req.params.id)
      .select("*, profiles(email)")
      .single();
    if (error) throw error;

    if (data?.profiles?.email && req.body.admin_reply) {
      await sendSupportReplyEmail({
        to: data.profiles.email,
        subject: `ReachIQ Support: ${data.subject}`,
        reply: req.body.admin_reply
      });
    }

    await createNotification({
      userId: data.user_id,
      title: "Support replied",
      body: `Your ticket "${data.subject}" has a new reply from the ReachIQ team.`,
      type: "info",
      metadata: { ticketId: data.id }
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/settings", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({
        settings: getDemoSettings(),
        searchSources: {
          overpass: { status: "always_active", note: "Free forever, no key needed" },
          serper: { status: process.env.SERPER_API_KEY ? "active" : "not_configured", note: "2500 free searches/month at serper.dev" },
          outscraper: { status: process.env.OUTSCRAPER_API_KEY ? "active" : "not_configured", note: "25 free/month at outscraper.com" }
        }
      });
    }

    const { data, error } = await supabaseAdmin.from("admin_settings").select("*");
    if (error) throw error;
    res.json({
      settings: data,
      searchSources: {
        overpass: { status: "always_active", note: "Free forever, no key needed" },
        serper: { status: process.env.SERPER_API_KEY ? "active" : "not_configured", note: "2500 free searches/month at serper.dev" },
        outscraper: { status: process.env.OUTSCRAPER_API_KEY ? "active" : "not_configured", note: "25 free/month at outscraper.com" }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/settings", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(Object.entries(req.body || {}).map(([key, value]) => ({ key, value: String(value) })));
    }

    const updates = Object.entries(req.body || {});
    const results = [];
    for (const [key, value] of updates) {
      const { data, error } = await supabaseAdmin
        .from("admin_settings")
        .upsert({
          key,
          value: String(value),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      results.push(data);
    }
    res.json(results);
  } catch (error) {
    next(error);
  }
});

router.get("/campaigns", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const pager = paginate(req.query.page, req.query.pageSize);
      const data = getDemoAdminCampaigns();
      return res.json({ data: data.slice(pager.from, pager.to + 1), pagination: buildPaginationPayload(data.length, pager.page, pager.pageSize) });
    }

    const pager = paginate(req.query.page, req.query.pageSize);
    const search = String(req.query.search || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("*, profiles(full_name, email)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const filtered = (data || []).filter((campaign) => {
      const owner = [campaign.profiles?.full_name, campaign.profiles?.email].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !search || [campaign.name, owner].filter(Boolean).join(" ").toLowerCase().includes(search);
      const matchesStatus = !status || String(campaign.status || "").toLowerCase() === status;
      return matchesSearch && matchesStatus;
    });

    res.json({
      data: filtered.slice(pager.from, pager.to + 1),
      pagination: buildPaginationPayload(filtered.length, pager.page, pager.pageSize)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/payments/submissions", async (req, res, next) => {
  try {
    const pager = paginate(req.query.page, req.query.pageSize);
    const statusFilter = String(req.query.status || "").trim().toLowerCase();

    if (isDemoMode) {
      const submissions = getDemoPaymentSubmissions().filter((submission) => {
        return !statusFilter || String(submission.status || "").toLowerCase() === statusFilter;
      });

      const summary = submissions.reduce(
        (acc, submission) => {
          const status = String(submission.status || "").toLowerCase();
          if (status === "pending") acc.pending += 1;
          if (status === "approved") acc.approved += 1;
          if (status === "rejected") acc.rejected += 1;
          acc.totalAmount += Number(submission.amount || 0);
          return acc;
        },
        {
          pending: 0,
          approved: 0,
          rejected: 0,
          totalAmount: 0
        }
      );

      return res.json({
        data: submissions.slice(pager.from, pager.to + 1),
        pagination: buildPaginationPayload(submissions.length, pager.page, pager.pageSize),
        summary
      });
    }

    const { data, error } = await supabaseAdmin
      .from("payment_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const withProfiles = await attachPaymentSubmissionProfiles(data || []);

    const filtered = withProfiles.filter((submission) => {
      return !statusFilter || String(submission.status || "").toLowerCase() === statusFilter;
    });

    const summary = filtered.reduce(
      (acc, submission) => {
        const status = String(submission.status || "").toLowerCase();
        if (status === "pending") acc.pending += 1;
        if (status === "approved") acc.approved += 1;
        if (status === "rejected") acc.rejected += 1;
        acc.totalAmount += Number(submission.amount || 0);
        return acc;
      },
      {
        pending: 0,
        approved: 0,
        rejected: 0,
        totalAmount: 0
      }
    );

    res.json({
      data: filtered.slice(pager.from, pager.to + 1),
      pagination: buildPaginationPayload(filtered.length, pager.page, pager.pageSize),
      summary
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/payments/submissions/:id", async (req, res, next) => {
  try {
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const reviewNotes = String(req.body?.review_notes || "").trim() || null;

    if (!["approved", "rejected"].includes(nextStatus)) {
      return res.status(400).json({ error: "Please choose an approval action." });
    }

    if (isDemoMode) {
      const existingSubmission = getDemoPaymentSubmissions().find((submission) => submission.id === req.params.id);
      if (!existingSubmission) {
        return res.status(404).json({ error: "Payment submission not found." });
      }

      if (String(existingSubmission.status || "").toLowerCase() !== "pending") {
        return res.status(409).json({ error: "This payment submission has already been reviewed." });
      }

      const updatedSubmission = updateDemoPaymentSubmission(req.params.id, {
        status: nextStatus,
        review_notes: reviewNotes,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString()
      });

      return res.json(updatedSubmission);
    }

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from("payment_submissions")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (submissionError) throw submissionError;
    if (!submission) {
      return res.status(404).json({ error: "Payment submission not found." });
    }

    if (String(submission.status || "").toLowerCase() !== "pending") {
      return res.status(409).json({ error: "This payment submission has already been reviewed." });
    }

    const updatePayload = {
      status: nextStatus,
      review_notes: reviewNotes,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabaseAdmin
      .from("payment_submissions")
      .update(updatePayload)
      .eq("id", req.params.id);

    if (updateError) throw updateError;

    const [reviewedSubmission] = await attachPaymentSubmissionProfiles([{
      ...submission,
      ...updatePayload
    }]);

    if (nextStatus === "approved") {
      const plan = String(submission.plan || "").toLowerCase();
      const nextMessagesLimit = await getMessageLimitForPlan(plan);
      const planConfig = getPlanConfig(plan);

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          plan,
          messages_limit: nextMessagesLimit,
          updated_at: new Date().toISOString()
        })
        .eq("id", submission.user_id);

      if (profileError) throw profileError;

      void runBestEffort([
        createNotification({
          userId: submission.user_id,
          title: "Plan activated",
          body: `${planConfig?.label || "Your ReachIQ plan"} has been approved. You can start using the upgraded quota right away.`,
          type: "success",
          metadata: {
            paymentSubmissionId: submission.id,
            plan
          }
        }),
        sendPaymentReviewEmail({
          to: reviewedSubmission.user_profile?.email,
          fullName: reviewedSubmission.user_profile?.full_name,
          planLabel: planConfig?.label,
          amount: `Rs ${submission.amount || planConfig?.price || ""}`,
          transactionId: submission.upi_transaction_id,
          approvedAt: new Date(updatePayload.reviewed_at).toLocaleString("en-IN", { timeZone: "Asia/Calcutta" }),
          invoiceNumber: `RQ-${String(submission.id).slice(0, 8).toUpperCase()}`,
          status: nextStatus,
          reviewNotes
        })
      ]);
    } else {
      void runBestEffort([
        createNotification({
          userId: submission.user_id,
          title: "Payment review update",
          body: "Your manual UPI submission needs another look. Please review the note from the ReachIQ team and resubmit if needed.",
          type: "warning",
          metadata: {
            paymentSubmissionId: submission.id,
            reviewNotes
          }
        }),
        sendPaymentReviewEmail({
          to: reviewedSubmission.user_profile?.email,
          fullName: reviewedSubmission.user_profile?.full_name,
          planLabel: getPlanConfig(submission.plan)?.label,
          status: nextStatus,
          reviewNotes
        })
      ]);
    }

    res.json(reviewedSubmission);
  } catch (error) {
    next(error);
  }
});

export default router;
