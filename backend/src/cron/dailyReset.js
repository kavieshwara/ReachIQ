import cron from "node-cron";
import { supabaseAdmin } from "../utils/supabase.js";
import { isDemoMode } from "../utils/demo.js";

export function startDailyResetCron() {
  if (isDemoMode) {
    console.log(`[${new Date().toISOString()}] Daily reset cron skipped in demo mode.`);
    return;
  }

  cron.schedule("0 0 * * *", async () => {
    try {
      await supabaseAdmin.rpc("reset_daily_message_counts");
      console.log(`[${new Date().toISOString()}] Daily usage reset completed.`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Daily usage reset failed`, error);
    }
  }, {
    timezone: process.env.DAILY_RESET_TIMEZONE || "Asia/Kolkata"
  });
}
