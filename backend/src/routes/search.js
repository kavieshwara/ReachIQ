import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { getDemoCampaigns, getDemoLeads, isDemoMode } from "../utils/demo.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.json({
        query: "",
        leads: [],
        campaigns: []
      });
    }

    if (isDemoMode) {
      const normalized = query.toLowerCase();
      const leads = getDemoLeads()
        .filter((lead) => lead.business_name.toLowerCase().includes(normalized))
        .slice(0, 5)
        .map((lead) => ({
          id: lead.id,
          title: lead.business_name,
          subtitle: [lead.city, lead.niche].filter(Boolean).join(" • "),
          href: `/leads?search=${encodeURIComponent(lead.business_name)}`,
          type: "lead"
        }));

      const campaigns = getDemoCampaigns()
        .filter((campaign) => campaign.name.toLowerCase().includes(normalized))
        .slice(0, 5)
        .map((campaign) => ({
          id: campaign.id,
          title: campaign.name,
          subtitle: `${campaign.status} • ${campaign.sent_count}/${campaign.total_leads} sent`,
          href: `/campaigns/${campaign.id}`,
          type: "campaign"
        }));

      return res.json({ query, leads, campaigns });
    }

    const [leadResult, campaignResult] = await Promise.all([
      supabaseAdmin
        .from("leads")
        .select("id, business_name, city, niche")
        .eq("user_id", req.user.id)
        .ilike("business_name", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("campaigns")
        .select("id, name, status, sent_count, total_leads")
        .eq("user_id", req.user.id)
        .ilike("name", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(5)
    ]);

    if (leadResult.error) {
      throw leadResult.error;
    }

    if (campaignResult.error) {
      throw campaignResult.error;
    }

    const leads = (leadResult.data || []).map((lead) => ({
      id: lead.id,
      title: lead.business_name,
      subtitle: [lead.city, lead.niche].filter(Boolean).join(" • "),
      href: `/leads?search=${encodeURIComponent(lead.business_name)}`,
      type: "lead"
    }));

    const campaigns = (campaignResult.data || []).map((campaign) => ({
      id: campaign.id,
      title: campaign.name,
      subtitle: `${campaign.status} • ${campaign.sent_count}/${campaign.total_leads} sent`,
      href: `/campaigns/${campaign.id}`,
      type: "campaign"
    }));

    res.json({ query, leads, campaigns });
  } catch (error) {
    next(error);
  }
});

export default router;
