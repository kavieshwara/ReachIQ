import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { createDemoTemplate, getDemoTemplates, isDemoMode } from "../utils/demo.js";

const router = express.Router();
router.use(requireAuth);

const systemTemplates = [
  {
    id: "system-cafe-signature",
    name: "Cafe Launch Teaser",
    niche: "cafe",
    content:
      "Hi {{name}}, I recorded a short demo video for {{business}} in {{city}} showing how a sharper online presence could help customers feel the vibe, spot your best-selling items, and message you straight on WhatsApp. If it looks useful, I can build the full site for you.",
    variables: ["{{name}}", "{{business}}", "{{city}}"]
  },
  {
    id: "system-dental-modern",
    name: "Dental Studio Pitch",
    niche: "dental clinic",
    content:
      "Hi {{name}}, I recorded a short demo video for {{business}} so patients in {{city}} can see how a cleaner clinic website could build trust before they call. If you like the direction, I can turn it into the full site for you.",
    variables: ["{{name}}", "{{business}}", "{{city}}"]
  },
  {
    id: "system-real-estate",
    name: "Real Estate Presence Pitch",
    niche: "real_estate",
    content:
      "Hi {{name}}, I recorded a quick demo video for {{business}} in {{city}} showing a cleaner property website with direct WhatsApp enquiries. If it feels right for your brand, I can build the full version for you.",
    variables: ["{{name}}", "{{business}}", "{{city}}"]
  },
  {
    id: "system-auto-showroom",
    name: "Auto Showroom Pitch",
    niche: "car showroom",
    content:
      "Hi {{name}}, I recorded a short showroom demo for {{business}} so buyers can explore featured cars, ask for finance details, and book a test drive on WhatsApp. If you like it, I can build the full version for your team.",
    variables: ["{{name}}", "{{business}}"]
  },
  {
    id: "system-restaurant-growth",
    name: "Restaurant Growth Pitch",
    niche: "restaurant",
    content:
      "Hi {{name}}, I recorded a short restaurant demo for {{business}} in {{city}} with a richer menu presentation, reservation prompt, and direct WhatsApp table booking. If it looks useful, I can build the full website for you.",
    variables: ["{{name}}", "{{business}}", "{{city}}"]
  }
];

router.get("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.json(getDemoTemplates());
    }

    const { data, error } = await supabaseAdmin
      .from("templates")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ userTemplates: data, systemTemplates });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (isDemoMode) {
      return res.status(201).json(createDemoTemplate(req.body));
    }

    const { data, error } = await supabaseAdmin
      .from("templates")
      .insert({
        user_id: req.user.id,
        name: req.body.name,
        content: req.body.content,
        variables: req.body.variables || [],
        niche: req.body.niche || null
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("templates")
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
    const { error } = await supabaseAdmin
      .from("templates")
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
