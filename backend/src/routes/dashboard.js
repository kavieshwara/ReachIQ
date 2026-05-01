import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { getDemoCampaigns, getDemoFollowUps, getDemoLeads, getDemoSettings, isDemoMode } from "../utils/demo.js";

const router = express.Router();

router.use(requireAuth);

router.get("/summary", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const recentCampaigns = getDemoCampaigns().slice(0, 3);
      const demoCampaigns = getDemoCampaigns();
      const repliesReceived = demoCampaigns.reduce((sum, campaign) => sum + Number(campaign.replied_count || 0), 0);

      return res.json({
        recentCampaigns,
        settings: getDemoSettings(),
        stats: {
          totalLeads: getDemoLeads().length,
          totalFollowups: getDemoFollowUps().length,
          activeCampaigns: demoCampaigns.filter((item) => item.status === "running").length,
          repliesReceived,
          totalCampaigns: demoCampaigns.length
        }
      });
    }

    const [recentCampaignsResponse, campaignStatsResponse, leadsResponse, followUpsResponse, settingsResponse] =
      await Promise.all([
        supabaseAdmin
          .from("campaigns")
          .select("*")
          .eq("user_id", req.user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabaseAdmin
          .from("campaigns")
          .select("status, replied_count", { count: "exact" })
          .eq("user_id", req.user.id),
        supabaseAdmin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.user.id),
        supabaseAdmin
          .from("follow_ups")
          .select("id", { count: "exact", head: true })
          .eq("user_id", req.user.id),
        supabaseAdmin.from("admin_settings").select("*")
      ]);

    const errors = [
      recentCampaignsResponse.error,
      campaignStatsResponse.error,
      leadsResponse.error,
      followUpsResponse.error,
      settingsResponse.error
    ].filter(Boolean);

    if (errors.length) {
      throw errors[0];
    }

    const campaignStats = campaignStatsResponse.data || [];

    res.json({
      recentCampaigns: recentCampaignsResponse.data || [],
      settings: settingsResponse.data || [],
      stats: {
        totalLeads: Number(leadsResponse.count || 0),
        totalFollowups: Number(followUpsResponse.count || 0),
        activeCampaigns: campaignStats.filter((item) => item.status === "running").length,
        repliesReceived: campaignStats.reduce((sum, item) => sum + Number(item.replied_count || 0), 0),
        totalCampaigns: Number(campaignStatsResponse.count || campaignStats.length || 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
