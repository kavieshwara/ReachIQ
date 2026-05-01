import { supabaseAdmin } from "../utils/supabase.js";
import { createDemoNotification, isDemoMode } from "../utils/demo.js";

export async function createNotification({
  userId,
  title,
  body,
  type = "info",
  metadata = {}
}) {
  if (!userId || !title || !body) {
    return null;
  }

  if (isDemoMode) {
    return createDemoNotification({
      user_id: userId,
      title,
      body,
      type,
      metadata
    });
  }

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      title,
      body,
      type,
      metadata
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
