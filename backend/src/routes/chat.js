import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../utils/supabase.js";
import { generateChatResponse } from "../services/geminiService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/history", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.post("/message", async (req, res, next) => {
  try {
    const prompt = req.body.message;
    await supabaseAdmin.from("chat_messages").insert({
      user_id: req.user.id,
      role: "user",
      content: prompt
    });

    const reply = await generateChatResponse(req.user.id, prompt);

    await supabaseAdmin.from("chat_messages").insert({
      user_id: req.user.id,
      role: "assistant",
      content: reply
    });

    res.json({ reply });
  } catch (error) {
    next(error);
  }
});

router.delete("/history", async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin.from("chat_messages").delete().eq("user_id", req.user.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
