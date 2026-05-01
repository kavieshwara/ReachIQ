"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useState } from "react";
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
import { api } from "@/lib/api";
import { isDemoMode, isSupabaseConfigured, supabase, supabaseConfigMessage } from "@/lib/supabase";
import { useUserStore } from "@/store/useUserStore";

const schema = z
  .object({
    full_name: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm your password"),
    referralCode: z.string().optional(),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms and disclaimer" })
    })
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { authStatus } = useUserStore();
  const [strength, setStrength] = useState(0);
  const [pendingEmail, setPendingEmail] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      referralCode: search?.get("ref") || ""
    }
  });

  const strengthLabel = strength < 2 ? "Weak" : strength < 4 ? "Good" : "Strong";
  const redirectedFrom = search?.get("redirectedFrom");
  const destination = redirectedFrom && redirectedFrom.startsWith("/") ? redirectedFrom : "/dashboard";

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.replace(destination);
    }
  }, [authStatus, destination, router]);

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    form.register("password").onChange(event);
    const value = event.target.value;
    let nextStrength = 0;
    if (value.length >= 8) nextStrength += 1;
    if (/[A-Z]/.test(value)) nextStrength += 1;
    if (/[0-9]/.test(value)) nextStrength += 1;
    if (/[^A-Za-z0-9]/.test(value)) nextStrength += 1;
    setStrength(nextStrength);
  };

  if (authStatus === "loading") {
    return <FullPageAuthLoader description="Checking your saved session before we show the signup form." />;
  }

  if (authStatus === "authenticated") {
    return <FullPageAuthLoader description="You're already signed in. Opening your ReachIQ workspace now." />;
  }

  const onSubmit = async (values: FormValues) => {
    try {
      if (isDemoMode) {
        toast.success("Demo mode active. Opening the dashboard without creating an account.");
        router.push("/dashboard");
        return;
      }

      if (!isSupabaseConfigured) {
        toast.error(supabaseConfigMessage);
        return;
      }

      const referralCode = values.referralCode?.trim();
      if (referralCode) {
        const { data } = await api.post("/api/auth/verify-referral", { code: referralCode });
        if (!data.valid) {
          toast.error("Referral code is invalid");
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
          data: {
            full_name: values.full_name
          }
        }
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("already registered") || message.includes("user already registered")) {
          toast.error("Email already registered");
          return;
        }

        if (message.includes("password")) {
          toast.error("Password must be at least 6 characters");
          return;
        }

        if (message.includes("email rate limit exceeded")) {
          toast.error("Supabase email sending is temporarily throttled. Use Login if this account was already created, or wait a few minutes and try signup again.");
          return;
        }

        toast.error(error.message);
        return;
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        toast.error("Email already registered");
        return;
      }

      setPendingEmail(values.email);

      if (data.user?.id) {
        try {
          await api.post("/api/auth/bootstrap-profile", {
            userId: data.user.id,
            email: values.email,
            fullName: values.full_name
          });
        } catch (bootstrapError: any) {
          const code = bootstrapError?.response?.data?.code;
          const message = String(bootstrapError?.response?.data?.error || "");

          if (code === "AUTH_USER_NOT_FOUND") {
            toast.error("Email already registered");
            return;
          }

          console.error("[ReachIQ][signup] bootstrap profile failed", bootstrapError);
          toast.error(message || "Your account was created, but ReachIQ could not finish setup. Please try logging in.");
          return;
        }
      }

      if (referralCode && data.user?.id) {
        try {
          await api.post("/api/auth/apply-referral", {
            referralCode,
            referredUserId: data.user.id
          });
        } catch (referralError: any) {
          console.error("[ReachIQ][signup] referral application failed", referralError);
          toast.error(String(referralError?.response?.data?.error || "Referral could not be applied right now, but your account can still continue normally."));
        }
      }

      toast.success("Please check your inbox for verification email");
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      console.error("[ReachIQ][signup] signup failed", error);
      toast.error("Signup could not be completed right now. Please try again in a moment.");
    }
  };

  const signInWithGoogle = async () => {
    try {
      setGoogleLoading(true);
      if (!isSupabaseConfigured) {
        toast.error(supabaseConfigMessage);
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/dashboard")}`
        }
      });

      if (error) {
        toast.error(error.message);
      }
    } catch (error) {
      console.error("[ReachIQ][signup] google sign-in failed", error);
      toast.error("Google signup could not start right now.");
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
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-6 p-8">
          <div className="space-y-2 text-center">
            <p className="text-3xl font-semibold text-textPrimary">Start free</p>
            <p className="text-sm text-textSecondary">Create your ReachIQ account and launch your first campaign.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-textSecondary">
            Your first-time setup after signup is simple: verify email, connect WhatsApp, add leads, then launch one small campaign to validate your flow.
          </div>
          {!isSupabaseConfigured ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Demo mode is active. You can open the app now, or add the real Supabase project URL later to enable saved accounts.
            </div>
          ) : null}
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-1.5">
              <Input placeholder="Full name" {...form.register("full_name")} />
              {form.formState.errors.full_name ? (
                <p className="text-xs text-danger">{form.formState.errors.full_name.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Input placeholder="Email" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-xs text-danger">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <PasswordInput placeholder="Password" {...form.register("password")} onChange={handlePasswordChange} />
              <p className="text-xs text-textSecondary">Password strength: {strengthLabel}</p>
              {form.formState.errors.password ? (
                <p className="text-xs text-danger">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <PasswordInput placeholder="Confirm password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword ? (
                <p className="text-xs text-danger">{form.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>
            <Input placeholder="Referral code (optional)" {...form.register("referralCode")} />
            <label className="flex gap-3 text-sm text-textSecondary">
              <input type="checkbox" {...form.register("acceptedTerms")} />
              <span>I agree to Terms of Service and acknowledge the WhatsApp usage disclaimer.</span>
            </label>
            {form.formState.errors.acceptedTerms ? (
              <p className="text-xs text-danger">{form.formState.errors.acceptedTerms.message}</p>
            ) : null}
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting || googleLoading}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : isDemoMode ? "Continue to demo" : "Create account"}
            </Button>
            <Button className="w-full gap-2" type="button" variant="secondary" onClick={signInWithGoogle} disabled={!isSupabaseConfigured || googleLoading || form.formState.isSubmitting}>
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
              {googleLoading ? "Redirecting to Google..." : "Continue with Google"}
            </Button>
            {!isDemoMode && pendingEmail ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={async () => {
                  try {
                    const { error } = await supabase.auth.resend({
                      type: "signup",
                      email: pendingEmail,
                      options: {
                        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
                      }
                    });

                    if (error) {
                      toast.error(error.message);
                      return;
                    }

                    toast.success("Verification email resent successfully");
                  } catch {
                    toast.error("Could not resend verification email right now");
                  }
                }}
              >
                Resend verification email
              </Button>
            ) : null}
          </form>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-textSecondary">
            After signup, ReachIQ will guide you through WhatsApp connection, leads, and your first outreach flow inside the dashboard.
          </div>
          <p className="text-center text-sm text-textSecondary">
            Already have an account? <Link href="/login">Login</Link>
          </p>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 text-sm text-primary transition hover:text-primary/80">
            Go back to login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
