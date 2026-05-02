import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { buildPaginationPayload, nowIso, paginate } from "../utils/helpers.js";
import { messageQueue } from "../queues/messageQueue.js";
import { refreshCampaignMetrics } from "../services/campaignService.js";
import { getCampaignAutomationConfig, removeCampaignAutomationConfig, setCampaignAutomationConfig } from "../services/campaignAutomationCompatService.js";
import { createNotification } from "../services/notificationService.js";
import { getCampaignPreparations } from "../services/outreachPreparationService.js";
import { getActiveWhatsAppConnection } from "../services/whatsappConnectionService.js";
import { restoreQRSessionIfAvailable } from "../services/whatsappQRService.js";
import { createDemoCampaign, getDemoCampaignById, getDemoCampaigns, isDemoMode, launchDemoCampaign, updateDemoCampaign } from "../utils/demo.js";

const router = express.Router();

router.use(requireAuth);

function isMissingCampaignAutomationSchema(error) {
  const message = String(error?.message || "");
  return (
    message.includes("column campaigns.auto_generate_assets does not exist") ||
    message.includes("column campaigns.require_video_assets does not exist") ||
    message.includes("column campaigns.website_template_id does not exist") ||
    message.includes("schema cache")
  );
}

router.get("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const pager = paginate(req.query.page, req.query.pageSize);
      const data = getDemoCampaigns();
      return res.json({ data: data.slice(pager.from, pager.to + 1), pagination: buildPaginationPayload(data.length, pager.page, pager.pageSize) });
    }

    const pager = paginate(req.query.page, req.query.pageSize);
    const { data, error, count } = await supabaseAdmin
      .from("campaigns")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(pager.from, pager.to);

    if (error) throw error;
    res.json({ data, pagination: buildPaginationPayload(count, pager.page, pager.pageSize) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.status(201).json(createDemoCampaign(req.body));
    }

    const defaultVideoAssets = process.env.ENABLE_WEBSITE_VIDEO === "true";
    const {
      name,
      message_template,
      delay_seconds = 10,
      lead_ids = [],
      followUps = [],
      website_template_id = null,
      auto_generate_assets = true,
      require_video_assets = defaultVideoAssets,
      niche = null
    } = req.body;

    let campaign;
    let campaignError;

    const fullInsert = await supabaseAdmin
      .from("campaigns")
      .insert({
        user_id: req.user.id,
        name,
        message_template,
        delay_seconds,
        website_template_id,
        auto_generate_assets,
        require_video_assets,
        total_leads: lead_ids.length,
        status: "draft"
      })
      .select()
      .single();
    campaign = fullInsert.data;
    campaignError = fullInsert.error;

    if (campaignError && isMissingCampaignAutomationSchema(campaignError)) {
      const fallbackInsert = await supabaseAdmin
        .from("campaigns")
        .insert({
          user_id: req.user.id,
          name,
          message_template,
          delay_seconds,
          total_leads: lead_ids.length,
          status: "draft"
        })
        .select()
        .single();

      campaign = fallbackInsert.data;
      campaignError = fallbackInsert.error;
    }

    if (campaignError) throw campaignError;

    if (lead_ids.length) {
      const links = lead_ids.map((leadId) => ({
        campaign_id: campaign.id,
        lead_id: leadId
      }));
      const { data: insertedLinks, error: linksError } = await supabaseAdmin.from("campaign_leads").insert(links).select();
      if (linksError) throw linksError;

      await setCampaignAutomationConfig(campaign.id, {
        userId: req.user.id,
        websiteTemplateId: website_template_id || null,
        autoGenerateAssets: Boolean(auto_generate_assets),
        requireVideoAssets: Boolean(require_video_assets),
        nicheHint: niche || null,
        leadPreparations: Object.fromEntries(
          (insertedLinks || []).map((item) => [
            item.id,
            {
              user_id: req.user.id,
              campaign_id: campaign.id,
              campaign_lead_id: item.id,
              lead_id: item.lead_id,
              website_template_id: website_template_id || null,
              website_status: auto_generate_assets ? "pending" : "skipped",
              message_status: "pending",
              video_status: require_video_assets ? "pending" : "skipped",
              send_status: "pending",
              created_at: nowIso(),
              updated_at: nowIso()
            }
          ])
        )
      });
    } else {
      await setCampaignAutomationConfig(campaign.id, {
        userId: req.user.id,
        websiteTemplateId: website_template_id || null,
        autoGenerateAssets: Boolean(auto_generate_assets),
        requireVideoAssets: Boolean(require_video_assets),
        nicheHint: niche || null
      });
    }

    if (followUps.length) {
      const rows = followUps.map((step, index) => ({
        campaign_id: campaign.id,
        user_id: req.user.id,
        lead_id: step.lead_id,
        message: step.message,
        scheduled_at: step.scheduled_at,
        step_number: index + 1
      }));
      await supabaseAdmin.from("follow_ups").insert(rows);
    }

    await createNotification({
      userId: req.user.id,
      title: "Campaign draft created",
      body: `${campaign.name} was saved with ${lead_ids.length} selected lead${lead_ids.length === 1 ? "" : "s"}.`,
      type: "info",
      metadata: { campaignId: campaign.id, href: `/campaigns/${campaign.id}` }
    });

    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const campaign = getDemoCampaignById(req.params.id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      return res.json(campaign);
    }

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .select("*, campaign_leads(*, leads(*)), follow_ups(*)")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (error) throw error;
    await refreshCampaignMetrics(req.params.id);
    const preparations = await getCampaignPreparations(req.params.id);
    const automationConfig = await getCampaignAutomationConfig(req.params.id);
    res.json({
      ...data,
      automation_config: automationConfig,
      outreach_preparations: preparations
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/pause", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(updateDemoCampaign(req.params.id, { status: "paused" }));
    }

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: "paused", updated_at: nowIso() })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();
    if (error) throw error;

    await createNotification({
      userId: req.user.id,
      title: "Campaign paused",
      body: `${data.name} is paused. Messages will stay on hold until you resume it.`,
      type: "warning",
      metadata: { campaignId: data.id, href: `/campaigns/${data.id}` }
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/resume", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(updateDemoCampaign(req.params.id, { status: "running" }));
    }

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: "running", updated_at: nowIso() })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();
    if (error) throw error;

    if (messageQueue) {
      await messageQueue.add(`campaign-${data.id}-resume`, { campaignId: data.id, userId: req.user.id });
    } else {
      const { processCampaignMessages } = await import("../services/campaignService.js");
      void processCampaignMessages({ campaignId: data.id, userId: req.user.id }).catch((queueError) => {
        console.error(`[Campaign Resume Fallback] ${queueError.message}`);
      });
    }

    await createNotification({
      userId: req.user.id,
      title: "Campaign resumed",
      body: `${data.name} is back in motion and queued to continue sending.`,
      type: "success",
      metadata: { campaignId: data.id, href: `/campaigns/${data.id}` }
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/launch", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json({ success: true, campaign: launchDemoCampaign(req.params.id) });
    }

    let activeConnection = await getActiveWhatsAppConnection(req.user.id);
    if (!activeConnection || activeConnection.status !== "connected") {
      const restoredQr = await restoreQRSessionIfAvailable(req.user.id).catch(() => null);
      if (restoredQr?.status === "connected") {
        activeConnection = {
          provider_type: "qr",
          status: "connected",
          phone_number: restoredQr.phoneNumber,
          session_data: {
            socketUser: restoredQr.socketUser,
            restoredFromDisk: true
          }
        };
      }
    }

    if (!activeConnection || activeConnection.status !== "connected") {
      await supabaseAdmin
        .from("campaigns")
        .update({ status: "awaiting_whatsapp", updated_at: nowIso() })
        .eq("id", req.params.id)
        .eq("user_id", req.user.id);

      return res.status(409).json({
        error: "Connect WhatsApp before launching this campaign.",
        connectRequired: true
      });
    }

    await supabaseAdmin
      .from("campaign_leads")
      .update({
        status: "pending",
        error_message: null
      })
      .eq("campaign_id", req.params.id)
      .eq("status", "failed");

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: "running", updated_at: nowIso() })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();
    if (error) throw error;

    if (messageQueue) {
      await messageQueue.add(`campaign-${data.id}`, { campaignId: data.id, userId: req.user.id });
    } else {
      const { processCampaignMessages } = await import("../services/campaignService.js");
      void processCampaignMessages({ campaignId: data.id, userId: req.user.id }).catch((queueError) => {
        console.error(`[Campaign Launch Fallback] ${queueError.message}`);
      });
    }

    await createNotification({
      userId: req.user.id,
      title: "Campaign launched",
      body: `${data.name} is now running with ${data.total_leads} lead${data.total_leads === 1 ? "" : "s"} in queue.`,
      type: "success",
      metadata: { campaignId: data.id, href: `/campaigns/${data.id}` }
    });

    res.json({ success: true, campaign: data });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      updateDemoCampaign(req.params.id, { status: "completed" });
      return res.status(204).send();
    }

    const { error } = await supabaseAdmin
      .from("campaigns")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);
    if (error) throw error;
    await removeCampaignAutomationConfig(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
