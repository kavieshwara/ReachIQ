import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { buildPaginationPayload, nowIso, paginate } from "../utils/helpers.js";
import { messageQueue } from "../queues/messageQueue.js";
import { refreshCampaignMetrics } from "../services/campaignService.js";
import { getCampaignAutomationConfig, removeCampaignAutomationConfig, setCampaignAutomationConfig, upsertCompatLeadPreparation } from "../services/campaignAutomationCompatService.js";
import { createNotification } from "../services/notificationService.js";
import { getCampaignPreparations } from "../services/outreachPreparationService.js";
import { resumeAwaitingWhatsAppCampaigns } from "../services/campaignQueueService.js";
import { getActiveWhatsAppConnection } from "../services/whatsappConnectionService.js";
import { getVerifiedQrSessionState } from "../services/whatsappQRService.js";
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

function isMissingOutreachPreparationsTable(error) {
  const message = String(error?.message || "");
  return (
    message.includes("public.outreach_preparations") ||
    message.includes("relation \"public.outreach_preparations\" does not exist")
  );
}

async function queueCampaignProcessing(campaignId, userId, reason = "launch") {
  if (messageQueue) {
    await messageQueue.add(`campaign-${campaignId}-${reason}`, { campaignId, userId });
    return;
  }

  const { processCampaignMessages } = await import("../services/campaignService.js");
  void processCampaignMessages({ campaignId, userId }).catch((queueError) => {
    console.error(`[Campaign ${reason}] ${queueError.message}`);
  });
}

async function hasLiveCampaignSenderConnection(userId) {
  const activeConnection = await getActiveWhatsAppConnection(userId).catch(() => null);
  if (activeConnection?.provider_type === "meta" && activeConnection.status === "connected") {
    return true;
  }

  const qrState = await getVerifiedQrSessionState(userId, {
    timeoutMs: 1800,
    reason: "campaign_gate",
    scheduleRetryReason: "campaign_gate_retry",
    attemptRestore: true
  });

  return qrState.connected;
}

async function loadCampaignById(campaignId, userId) {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("*, campaign_leads(*, leads(*)), follow_ups(*)")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
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

    let data = await loadCampaignById(req.params.id, req.user.id);
    if (data.status === "awaiting_whatsapp" && (await hasLiveCampaignSenderConnection(req.user.id))) {
      await resumeAwaitingWhatsAppCampaigns(req.user.id, "campaign_detail_connected").catch((resumeError) => {
        console.warn(`[ReachIQ][campaigns] could not resume awaiting campaign ${req.params.id} for ${req.user.id}: ${resumeError.message}`);
      });
      data = await loadCampaignById(req.params.id, req.user.id);
    }

    await refreshCampaignMetrics(req.params.id);
    data = await loadCampaignById(req.params.id, req.user.id);
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

    const { data: failedLeadRows, error: failedLeadLookupError } = await supabaseAdmin
      .from("campaign_leads")
      .select("id, lead_id")
      .eq("campaign_id", req.params.id)
      .eq("status", "failed");

    if (failedLeadLookupError) throw failedLeadLookupError;

    const failedLeadIds = (failedLeadRows || []).map((item) => item.id).filter(Boolean);

    if (failedLeadIds.length) {
      const { error: resetLeadError } = await supabaseAdmin
        .from("campaign_leads")
        .update({
          status: "pending",
          error_message: null
        })
        .in("id", failedLeadIds);

      if (resetLeadError) throw resetLeadError;

      const sendResetPayload = {
        send_status: "pending",
        generation_error: null,
        updated_at: nowIso()
      };

      const { error: resetPreparationError } = await supabaseAdmin
        .from("outreach_preparations")
        .update(sendResetPayload)
        .in("campaign_lead_id", failedLeadIds);

      if (resetPreparationError) {
        if (isMissingOutreachPreparationsTable(resetPreparationError)) {
          for (const leadRow of failedLeadRows) {
            await upsertCompatLeadPreparation(req.params.id, leadRow.id, {
              user_id: req.user.id,
              campaign_id: req.params.id,
              lead_id: leadRow.lead_id,
              ...sendResetPayload
            });
          }
        } else {
          throw resetPreparationError;
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: "running", updated_at: nowIso() })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .single();
    if (error) throw error;

    await queueCampaignProcessing(data.id, req.user.id, "launch");
    await refreshCampaignMetrics(data.id).catch(() => null);

    await createNotification({
      userId: req.user.id,
      title: "Campaign launched",
      body: `${data.name} is now preparing websites, messages, and sends for ${data.total_leads} lead${data.total_leads === 1 ? "" : "s"}.`,
      type: "success",
      metadata: { campaignId: data.id, href: `/campaigns/${data.id}` }
    });

    res.json({ success: true, campaign: data });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/repair-assets", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const campaign = updateDemoCampaign(req.params.id, { status: "running" });
      return res.json({ success: true, campaign });
    }

    const { campaignLeadId = null, website_template_id = null } = req.body || {};

    let { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("id, user_id, name, website_template_id, auto_generate_assets, require_video_assets")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (campaignError && isMissingCampaignAutomationSchema(campaignError)) {
      const fallbackCampaignLookup = await supabaseAdmin
        .from("campaigns")
        .select("id, user_id, name")
        .eq("id", req.params.id)
        .eq("user_id", req.user.id)
        .single();

      campaign = fallbackCampaignLookup.data
        ? {
            ...fallbackCampaignLookup.data,
            website_template_id: null,
            auto_generate_assets: null,
            require_video_assets: null
          }
        : null;
      campaignError = fallbackCampaignLookup.error;
    }

    if (campaignError) throw campaignError;

    const automationConfig = await getCampaignAutomationConfig(campaign.id);
    const selectedTemplateId = website_template_id || automationConfig?.websiteTemplateId || campaign.website_template_id || null;

    const { data: campaignLeads, error: campaignLeadsError } = await supabaseAdmin
      .from("campaign_leads")
      .select("id, lead_id, status, sent_at, delivered_at, read_at, replied_at")
      .eq("campaign_id", campaign.id);

    if (campaignLeadsError) throw campaignLeadsError;

    const repairableLeadRows = (campaignLeads || []).filter((item) => {
      if (campaignLeadId && item.id !== campaignLeadId) {
        return false;
      }

      const finalStatus = new Set(["sent", "delivered", "read", "replied"]);
      if (finalStatus.has(String(item.status || "").trim())) {
        return false;
      }

      return true;
    });

    if (!repairableLeadRows.length) {
      return res.status(400).json({ error: "ReachIQ could not find any non-sent leads to repair for this campaign." });
    }

    const repairedLeadIds = repairableLeadRows.map((item) => item.id);

    const nextCampaignPayload = {
      status: "running",
      updated_at: nowIso(),
      website_template_id: selectedTemplateId,
      auto_generate_assets: true,
      require_video_assets: true
    };

    let updateCampaignError = null;
    const fullCampaignUpdate = await supabaseAdmin
      .from("campaigns")
      .update(nextCampaignPayload)
      .eq("id", campaign.id)
      .eq("user_id", req.user.id)
      .select()
      .single();
    let updatedCampaign = fullCampaignUpdate.data;
    updateCampaignError = fullCampaignUpdate.error;

    if (updateCampaignError && isMissingCampaignAutomationSchema(updateCampaignError)) {
      const fallbackCampaignUpdate = await supabaseAdmin
        .from("campaigns")
        .update({
          status: "running",
          updated_at: nowIso()
        })
        .eq("id", campaign.id)
        .eq("user_id", req.user.id)
        .select()
        .single();

      updatedCampaign = fallbackCampaignUpdate.data;
      updateCampaignError = fallbackCampaignUpdate.error;
    }

    if (updateCampaignError) throw updateCampaignError;

    await setCampaignAutomationConfig(campaign.id, {
      userId: req.user.id,
      websiteTemplateId: selectedTemplateId,
      autoGenerateAssets: true,
      requireVideoAssets: true
    });

    const { error: leadResetError } = await supabaseAdmin
      .from("campaign_leads")
      .update({
        status: "pending",
        error_message: null,
        sent_at: null,
        delivered_at: null,
        read_at: null,
        replied_at: null
      })
      .in("id", repairedLeadIds);

    if (leadResetError) throw leadResetError;

    const preparationResetPayload = {
      website_template_id: selectedTemplateId,
      website_status: "pending",
      message_status: "pending",
      video_status: "pending",
      send_status: "pending",
      generation_error: null,
      generated_website_id: null,
      website_live_url: null,
      personalized_message: null,
      video_url: null,
      updated_at: nowIso()
    };

    const { error: preparationResetError } = await supabaseAdmin
      .from("outreach_preparations")
      .update(preparationResetPayload)
      .in("campaign_lead_id", repairedLeadIds);

    if (preparationResetError) {
      if (isMissingOutreachPreparationsTable(preparationResetError)) {
        for (const leadRow of repairableLeadRows) {
          await upsertCompatLeadPreparation(campaign.id, leadRow.id, {
            user_id: req.user.id,
            campaign_id: campaign.id,
            lead_id: leadRow.lead_id,
            ...preparationResetPayload
          });
        }
      } else {
        throw preparationResetError;
      }
    }

    await refreshCampaignMetrics(campaign.id);
    await queueCampaignProcessing(campaign.id, req.user.id, "repair");

    await createNotification({
      userId: req.user.id,
      title: "Campaign assets rebuilding",
      body: `${updatedCampaign.name} is regenerating website, message, and video assets on the live backend for ${repairableLeadRows.length} lead${repairableLeadRows.length === 1 ? "" : "s"}.`,
      type: "success",
      metadata: { campaignId: campaign.id, href: `/campaigns/${campaign.id}` }
    });

    return res.json({
      success: true,
      repairedLeadIds,
      campaign: updatedCampaign
    });
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
