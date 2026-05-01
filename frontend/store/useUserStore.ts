"use client";

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { api, setApiAccessToken } from "@/lib/api";
import { isDemoMode, supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  referral_code?: string | null;
  role: string;
  plan: string;
  messages_sent_today: number;
  messages_limit: number;
  bonus_messages: number;
  whatsapp_connected: boolean;
};

const demoSession = {
  access_token: "demo-access-token",
  user: { id: "demo-user", email: "demo@reachiq.app" }
} as Session;

const demoProfile: Profile = {
  id: "demo-user",
    email: "demo@reachiq.app",
    full_name: "Kavie Demo",
    avatar_url: null,
    referral_code: "DEMO2026",
    role: "admin",
  plan: "free",
  messages_sent_today: 12,
  messages_limit: 30,
  bonus_messages: 20,
  whatsapp_connected: true
};

type UserState = {
  initialized: boolean;
  loading: boolean;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  session: Session | null;
  profile: Profile | null;
  boot: () => Promise<void>;
  syncSession: (session: Session | null) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

let authListenerAttached = false;
let bootPromise: Promise<void> | null = null;

function buildFallbackProfile(session: Session, existingProfile?: Profile | null): Profile {
  return {
    id: session.user.id,
    email: session.user.email || existingProfile?.email || "",
    full_name: (session.user.user_metadata?.full_name as string | undefined) || existingProfile?.full_name || null,
    avatar_url: existingProfile?.avatar_url || null,
    referral_code: existingProfile?.referral_code || null,
    role: existingProfile?.role || "user",
    plan: existingProfile?.plan || "free",
    messages_sent_today: existingProfile?.messages_sent_today || 0,
    messages_limit: existingProfile?.messages_limit || 30,
    bonus_messages: existingProfile?.bonus_messages || 0,
    whatsapp_connected: existingProfile?.whatsapp_connected || false
  };
}

async function loadProfileFromBackend(session: Session): Promise<Profile | null> {
  setApiAccessToken(session.access_token);
  const { data } = await api.get("/api/auth/me");
  return (data as Profile) || null;
}

export const useUserStore = create<UserState>((set, get) => ({
  initialized: false,
  loading: true,
  authStatus: "loading",
  session: null,
  profile: null,
  boot: async () => {
    if (get().initialized) {
      console.info("[ReachIQ][auth] boot skipped - already initialized");
      return;
    }

    if (bootPromise) {
      console.info("[ReachIQ][auth] boot reused existing promise");
      return bootPromise;
    }

    bootPromise = (async () => {
      console.info("[ReachIQ][auth] boot start");
      if (isDemoMode) {
        setApiAccessToken(null);
        set({
          initialized: true,
          loading: false,
          authStatus: "authenticated",
          session: demoSession,
          profile: demoProfile
        });
        console.info("[ReachIQ][auth] boot resolved in demo mode");
        return;
      }

      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error) {
      console.info("[ReachIQ][auth] boot session lookup failed", error.message);
      setApiAccessToken(null);
      set({
        initialized: true,
        loading: false,
          authStatus: "unauthenticated",
          session: null,
          profile: null
        });
        return;
      }

      await get().syncSession(session);

      if (!authListenerAttached) {
        authListenerAttached = true;
        supabase.auth.onAuthStateChange((event, nextSession) => {
          console.info("[ReachIQ][auth] onAuthStateChange", event, nextSession?.user?.id || "no-user");
          void get().syncSession(nextSession);
        });
      }
    })().finally(() => {
      console.info("[ReachIQ][auth] boot end");
      bootPromise = null;
    });

    return bootPromise;
  },
  syncSession: async (session) => {
    if (isDemoMode) {
      set({
        initialized: true,
        loading: false,
        authStatus: "authenticated",
        session: demoSession,
        profile: demoProfile
      });
      setApiAccessToken(null);
      return;
    }

    if (!session?.user) {
      console.info("[ReachIQ][auth] syncSession -> unauthenticated");
      setApiAccessToken(null);
      set({
        initialized: true,
        loading: false,
        authStatus: "unauthenticated",
        session: null,
        profile: null
      });
      return;
    }

    const currentSession = get().session;
    const currentProfile = get().profile;
    const sameUser = currentSession?.user?.id === session.user.id || currentProfile?.id === session.user.id;
    const sameAccessToken = currentSession?.access_token === session.access_token;

    if (sameUser && sameAccessToken && currentProfile) {
      console.info("[ReachIQ][auth] syncSession reused existing authenticated state", session.user.id);
      setApiAccessToken(session.access_token);
      set({
        initialized: true,
        loading: false,
        authStatus: "authenticated",
        session
      });
      return;
    }

    console.info("[ReachIQ][auth] syncSession loading profile", session.user.id);
    setApiAccessToken(session.access_token);
    set({
      initialized: true,
      loading: !sameUser || !currentProfile,
      authStatus: "loading",
      session,
      profile: sameUser ? currentProfile : null
    });

    try {
      const profile = await loadProfileFromBackend(session);

      if (!profile) {
        throw new Error("Profile response was empty");
      }

      console.info("[ReachIQ][auth] profile loaded", profile.id, profile.role);
      set({
        initialized: true,
        session,
        profile,
        authStatus: "authenticated",
        loading: false
      });
    } catch (backendError) {
      console.info("[ReachIQ][auth] backend profile sync failed, trying direct Supabase fallback", backendError);

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error || !profile) {
          console.info("[ReachIQ][auth] profile missing after session sync", session.user.id);
          set({
            initialized: true,
            loading: false,
            authStatus: "authenticated",
            session,
            profile: buildFallbackProfile(session, sameUser ? currentProfile : null)
          });
          return;
        }

        set({
          initialized: true,
          session,
          profile: profile as Profile,
          authStatus: "authenticated",
          loading: false
        });
      } catch (error) {
        console.info("[ReachIQ][auth] profile sync failed", error);
        set({
          initialized: true,
          loading: false,
          authStatus: "authenticated",
          session,
          profile: buildFallbackProfile(session, currentProfile)
        });
      }
    }
  },
  refreshProfile: async () => {
    try {
      if (isDemoMode) {
        setApiAccessToken(null);
        set({
          initialized: true,
          loading: false,
          authStatus: "authenticated",
          session: demoSession,
          profile: demoProfile
        });
        return;
      }

      const session = get().session;
      if (!session) {
        setApiAccessToken(null);
        set({ initialized: true, profile: null, loading: false, authStatus: "unauthenticated", session: null });
        return;
      }

      setApiAccessToken(session.access_token);

      let profile: Profile | null = null;

      try {
        profile = await loadProfileFromBackend(session);
      } catch (backendError) {
        console.info("[ReachIQ][auth] refreshProfile backend path failed, falling back to Supabase", backendError);
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        profile = (data as Profile) || null;
      }

      set({
        initialized: true,
        session,
        profile: profile || buildFallbackProfile(session, get().profile),
        authStatus: "authenticated",
        loading: false
      });
    } catch (error) {
      console.info("[ReachIQ][auth] refreshProfile failed", error);
      set({
        initialized: true,
        loading: false,
        authStatus: get().session?.user ? "authenticated" : "unauthenticated",
        profile: get().session?.user ? buildFallbackProfile(get().session as Session, get().profile) : null
      });
    }
  },
  signOut: async () => {
    if (isDemoMode) {
      console.info("[ReachIQ][auth] demo signout");
      setApiAccessToken(null);
      set({ initialized: true, session: null, profile: null, loading: false, authStatus: "unauthenticated" });
      return;
    }

    await supabase.auth.signOut();
    console.info("[ReachIQ][auth] signout completed");
    setApiAccessToken(null);
    set({ initialized: true, session: null, profile: null, loading: false, authStatus: "unauthenticated" });
  }
}));
