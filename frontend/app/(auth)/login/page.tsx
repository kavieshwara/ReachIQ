"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Chrome, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FullPageAuthLoader } from "@/components/auth/FullPageAuthLoader";
import { buildAuthCallbackUrl, canonicalizeAppUrl, preferredHostedAppUrl, resolveStaticAppUrl } from "@/lib/public-url";
import { isDemoMode, isSupabaseConfigured, supabase, supabaseConfigMessage } from "@/lib/supabase";
import { useUserStore } from "@/store/useUserStore";

const AUTH_REDIRECT_STORAGE_KEY = "reachiq_auth_redirect_to";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password should be at least 6 characters")
});

type FormValues = z.infer<typeof schema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authStatus, syncSession } = useUserStore();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const authError = searchParams?.get("authError");
  const redirectedFrom = searchParams?.get("redirectedFrom");
  const destination = redirectedFrom && redirectedFrom.startsWith("/") ? redirectedFrom : "/dashboard";
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.replace(destination);
    }
  }, [authStatus, destination, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentOrigin = canonicalizeAppUrl(window.location.origin);
    const canonicalOrigin = resolveStaticAppUrl();
    const isHostedMismatch = currentOrigin !== canonicalOrigin && /vercel\.app$/i.test(window.location.hostname);

    if (isHostedMismatch) {
      window.location.replace(`${preferredHostedAppUrl}${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, []);

  if (authStatus === "loading") {
    return <FullPageAuthLoader description="Checking your saved session before we open the auth screen." />;
  }

  if (authStatus === "authenticated") {
    return <FullPageAuthLoader description="You're already signed in. Opening your ReachIQ workspace now." />;
  }

  const onSubmit = async (values: FormValues) => {
    try {
      if (isDemoMode) {
        toast.success("Demo mode active. Opening the dashboard.");
        router.push("/dashboard");
        return;
      }

      if (!isSupabaseConfigured) {
        toast.error(supabaseConfigMessage);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        toast.error(error.message);
        return;
      }

      await syncSession(data.session);
      toast.success("Welcome back");
      console.info("[ReachIQ][auth] LoginPage sign-in succeeded, client navigating ->", destination);
      window.location.replace(destination);
    } catch (error) {
      console.error("[ReachIQ][login] login failed", error);
      toast.error("Login request failed. Check that the backend and Supabase connection are available, then try again.");
    }
  };

  const signInWithGoogle = async () => {
    try {
      setGoogleLoading(true);
      if (!isSupabaseConfigured) {
        toast.error(supabaseConfigMessage);
        return;
      }

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, destination);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAuthCallbackUrl(destination)
        }
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      console.error("[ReachIQ][login] google sign-in failed", error);
      toast.error("Google login could not start right now.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" theme="dark" href="/" />
        <p className="text-sm text-textSecondary">Find leads. Pitch smart. Get clients.</p>
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <div className="space-y-2 text-center">
            <p className="text-3xl font-semibold text-textPrimary">Login</p>
            <p className="text-sm text-textSecondary">Access your outreach dashboard.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-textSecondary">
            ReachIQ works best when you test in this order: connect WhatsApp, pull a small lead batch, send one campaign, then scale after the first replies come in.
          </div>
          {!isSupabaseConfigured ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Demo mode is active. You can open the app now, or add the real Supabase project URL later to enable real login.
            </div>
          ) : null}
          {authError ? (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {authError}
            </div>
          ) : null}
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <Input placeholder="Email" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-xs text-danger">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <PasswordInput placeholder="Password" {...form.register("password")} />
              {form.formState.errors.password ? (
                <p className="text-xs text-danger">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting || googleLoading}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening workspace...
                </>
              ) : isDemoMode ? "Open demo" : "Login to ReachIQ"}
            </Button>
            <Button className="w-full gap-2" type="button" variant="secondary" onClick={signInWithGoogle} disabled={!isSupabaseConfigured || googleLoading || form.formState.isSubmitting}>
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
              {googleLoading ? "Redirecting to Google..." : "Continue with Google"}
            </Button>
          </form>
          <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-textSecondary">
            Need a quick route back in? ReachIQ keeps your last protected route and sends you there right after login.
          </div>
          <div className="flex items-center justify-between text-sm text-textSecondary">
            <Link href="/forgot-password">Forgot password?</Link>
            <Link href="/signup">Create account</Link>
          </div>
          <Link href="/signup" className="inline-flex items-center justify-center gap-2 text-sm text-primary transition hover:text-primary/80">
            New here? Start your free setup
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullPageAuthLoader description="Loading ReachIQ login..." />}>
      <LoginPageContent />
    </Suspense>
  );
}
