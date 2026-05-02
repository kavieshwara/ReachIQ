import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/adminOnly.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { buildGeneratedWebsitePreviewUrl, generateWebsite, resolveGeneratedWebsitePreviewUrl } from "../services/websiteService.js";
import { ensureStarterWebsiteTemplates } from "../data/starterWebsiteTemplates.js";
import { createDemoGeneratedWebsite, getDemoGeneratedWebsites, getDemoWebsiteTemplates, isDemoMode } from "../utils/demo.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const REQUIRED_PLACEHOLDERS = [
  "{{BUSINESS_NAME}}",
  "{{PHONE}}",
  "{{ADDRESS}}",
  "{{CITY}}"
];

const OPTIONAL_PLACEHOLDERS = [
  "{{TAGLINE}}",
  "{{SERVICES}}",
  "{{WHATSAPP_LINK}}"
];

function validateTemplateHtml(html = "") {
  const missing = REQUIRED_PLACEHOLDERS.filter((placeholder) => !String(html).includes(placeholder));
  if (missing.length) {
    const error = new Error(`Missing required placeholders: ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
}

function getTemplatePayload(req) {
  const htmlContent = req.body.html_content || req.file?.buffer?.toString("utf8") || "";
  validateTemplateHtml(htmlContent);

  return {
    name: req.body.name,
    niche: req.body.niche,
    html_content: htmlContent,
    preview_image_url: req.body.preview_image_url || null,
    is_active: true
  };
}

function normalizeGeneratedWebsiteLinks(rows = []) {
  return rows.map((item) => ({
    ...item,
    live_url: resolveGeneratedWebsitePreviewUrl({
      websiteId: item?.id,
      liveUrl: item?.live_url
    })
  }));
}

router.get("/preview/:id", async (req, res, next) => {
  try {
    if (isDemoMode) {
      const website = getDemoGeneratedWebsites().find((item) => item.id === req.params.id);
      if (!website?.html_content) {
        return res.status(404).send("Preview not found");
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.send(website.html_content);
    }

    const { data, error } = await supabaseAdmin
      .from("generated_websites")
      .select("html_content")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!data?.html_content) {
      return res.status(404).send("Preview not found");
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(data.html_content);
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(getDemoGeneratedWebsites());
    }

    const { data, error } = await supabaseAdmin
      .from("generated_websites")
      .select("*, leads(business_name)")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(normalizeGeneratedWebsiteLinks(data || []));
  } catch (error) {
    next(error);
  }
});

router.get("/templates", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(getDemoWebsiteTemplates());
    }

    await ensureStarterWebsiteTemplates();

    const { data, error } = await supabaseAdmin
      .from("website_templates")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/generate", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.status(201).json(
        createDemoGeneratedWebsite({
          lead_id: req.body.lead_id,
          template_id: req.body.template_id,
          business_name: req.body.business_name,
          phone: req.body.phone,
          address: req.body.address,
          city: req.body.city
        })
      );
    }

    const site = await generateWebsite({
      userId: req.user.id,
      leadId: req.body.lead_id,
      templateId: req.body.template_id,
      businessName: req.body.business_name,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city,
      tagline: req.body.tagline,
      services: req.body.services
    });

    res.status(201).json({
      ...site,
      live_url: buildGeneratedWebsitePreviewUrl(site.id)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/templates", upload.single("template_file"), async (req, res, next) => {
  try {
    if (!req.body?.name || !req.body?.niche) {
      return res.status(400).json({ error: "Template name and niche are required." });
    }

    const { data, error } = await supabaseAdmin
      .from("website_templates")
      .insert(getTemplatePayload(req))
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.patch("/templates/:id", requireAdmin, async (req, res, next) => {
  try {
    const payload = req.body.html_content
      ? getTemplatePayload(req)
      : {
          ...req.body,
          preview_image_url: req.body.preview_image_url || null
        };

    const { data, error } = await supabaseAdmin
      .from("website_templates")
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

router.delete("/templates/:id", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from("website_templates").delete().eq("id", req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
