import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { isPaidPlan } from "../services/paymentService.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { buildPaginationPayload, paginate, parseBool, toCsv } from "../utils/helpers.js";
import { createDemoLead, deleteDemoLead, getDemoLeads, isDemoMode, updateDemoLead } from "../utils/demo.js";

const router = express.Router();
const FREE_DAILY_LEAD_LIMIT = 30;

router.use(requireAuth);

function isPremiumPlan(profile) {
  return isPaidPlan(profile?.plan);
}

async function getLeadCreationAllowance(profile, userId) {
  if (!profile?.id || isPremiumPlan(profile)) {
    return { limit: null, remaining: null };
  }

  const startOfDayIso = new Date();
  startOfDayIso.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDayIso.toISOString());

  if (error) {
    throw error;
  }

  const used = Number(count || 0);
  return {
    limit: FREE_DAILY_LEAD_LIMIT,
    remaining: Math.max(FREE_DAILY_LEAD_LIMIT - used, 0)
  };
}

router.get("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const { page = 1, pageSize = 20, search = "", niche, status, hasWebsite } = req.query;
      const pager = paginate(page, pageSize);
      let data = getDemoLeads();

      if (search) data = data.filter((item) => item.business_name.toLowerCase().includes(String(search).toLowerCase()));
      if (niche) data = data.filter((item) => item.niche === niche);
      if (status) data = data.filter((item) => item.status === status);
      if (hasWebsite !== undefined && hasWebsite !== "") data = data.filter((item) => Boolean(item.has_website) === parseBool(hasWebsite));

      return res.json({
        data: data.slice(pager.from, pager.to + 1),
        pagination: buildPaginationPayload(data.length, pager.page, pager.pageSize)
      });
    }

    const { page = 1, pageSize = 20, search = "", niche, status, hasWebsite } = req.query;
    const pager = paginate(page, pageSize);
    let query = supabaseAdmin
      .from("leads")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (search) query = query.ilike("business_name", `%${search}%`);
    if (niche) query = query.eq("niche", niche);
    if (status) query = query.eq("status", status);
    if (hasWebsite !== undefined) query = query.eq("has_website", parseBool(hasWebsite));

    const { data, error, count } = await query.range(pager.from, pager.to);
    if (error) throw error;

    res.json({
      data,
      pagination: buildPaginationPayload(count, pager.page, pager.pageSize)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.status(201).json(
        createDemoLead({
          business_name: req.body.business_name,
          phone: req.body.phone,
          address: req.body.address || null,
          city: req.body.city || null,
          niche: req.body.niche || null,
          has_website: parseBool(req.body.has_website),
          website_url: req.body.website_url || null,
          email: req.body.email || null,
          notes: req.body.notes || null,
          status: req.body.status || "new",
          source: req.body.source || "manual"
        })
      );
    }

    const allowance = await getLeadCreationAllowance(req.profile, req.user.id);
    if (allowance.remaining !== null && allowance.remaining <= 0) {
      return res.status(403).json({
        error: "Daily lead limit reached for the free plan.",
        totalLimit: allowance.limit,
        upgradeRequired: true
      });
    }

    const payload = {
      user_id: req.user.id,
      business_name: req.body.business_name,
      phone: req.body.phone,
      address: req.body.address || null,
      city: req.body.city || null,
      niche: req.body.niche || null,
      has_website: parseBool(req.body.has_website),
      website_url: req.body.website_url || null,
      email: req.body.email || null,
      notes: req.body.notes || null,
      status: req.body.status || "new",
      source: req.body.source || "manual"
    };

    const { data, error } = await supabaseAdmin.from("leads").insert(payload).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/bulk", async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    if (isDemoMode) {
      const created = rows.map((row) =>
        createDemoLead({
          business_name: row.Name || row.business_name || row.Business || row.name,
          phone: row.Phone || row.phone || "",
          address: row.Address || row.address || null,
          city: row.City || row.city || null,
          niche: row.Niche || row.niche || null,
          has_website: Boolean(row.Website || row.website || row.website_url),
          website_url: row.Website || row.website || row.website_url || null,
          email: row.Email || row.email || null,
          source: "csv"
        })
      );
      return res.status(201).json({ count: created.length, data: created });
    }

    const allowance = await getLeadCreationAllowance(req.profile, req.user.id);

    if (allowance.remaining !== null && allowance.remaining <= 0) {
      return res.status(403).json({
        error: "Daily lead limit reached for the free plan.",
        totalLimit: allowance.limit,
        upgradeRequired: true
      });
    }

    const acceptedRows =
      allowance.remaining === null ? rows : rows.slice(0, Math.max(allowance.remaining, 0));

    const payload = acceptedRows.map((row) => ({
      user_id: req.user.id,
      business_name: row.Name || row.business_name || row.Business || row.business_name,
      phone: row.Phone || row.phone,
      address: row.Address || row.address || null,
      city: row.City || row.city || null,
      niche: row.Niche || row.niche || null,
      has_website: Boolean(row.Website || row.website || row.website_url),
      website_url: row.Website || row.website || row.website_url || null,
      email: row.Email || row.email || null,
      source: "csv"
    }));

    const { data, error } = await supabaseAdmin.from("leads").insert(payload).select();
    if (error) throw error;
    res.status(201).json({
      count: data.length,
      data,
      partial: allowance.remaining !== null && acceptedRows.length < rows.length,
      message:
        allowance.remaining !== null && acceptedRows.length < rows.length
          ? `Added ${data.length} leads. Free plan allows ${allowance.limit} new leads per day.`
          : `Added ${data.length} leads successfully.`
    });
  } catch (error) {
    next(error);
  }
});

router.get("/export", async (req, res, next) => {
  try {
    if (isDemoMode) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="reachiq-demo-leads.csv"');
      return res.send(toCsv(getDemoLeads()));
    }

    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="reachiq-leads.csv"');
    res.send(toCsv(data || []));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(updateDemoLead(req.params.id, req.body));
    }

    const { data, error } = await supabaseAdmin
      .from("leads")
      .update(req.body)
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      deleteDemoLead(req.params.id);
      return res.status(204).send();
    }

    const { error } = await supabaseAdmin
      .from("leads")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
