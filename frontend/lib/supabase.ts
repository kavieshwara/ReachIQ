"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  !supabaseUrl.includes("your-project-ref.supabase.co") &&
  !supabaseUrl.includes("placeholder.supabase.co");

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const supabaseConfigMessage =
  "Supabase is not configured yet. Add your real NEXT_PUBLIC_SUPABASE_URL in frontend/.env.local and restart the app.";

let browserSupabase: SupabaseClient | null = null;

function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured) {
    return createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder", {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  return createClientComponentClient();
}

export function getSupabaseBrowserClient() {
  if (!browserSupabase) {
    browserSupabase = createBrowserSupabaseClient();
  }

  return browserSupabase;
}

export const supabase = getSupabaseBrowserClient();
