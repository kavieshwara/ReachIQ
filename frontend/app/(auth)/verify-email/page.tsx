"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FullPageAuthLoader } from "@/components/auth/FullPageAuthLoader";
import { buildAuthCallbackUrl } from "@/lib/public-url";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "@/lib/supabase";
import { useUserStore } from "@/store/useUserStore";

function VerifyEmailPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params?.get("email") || "your email";
  const { authStatus, session } = useUserStore();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    const timer = setInterval(async () => {
        if (redirectedRef.current) {
          return;
        }

        const {
          data: { session }
        } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          redirectedRef.current = true;
          console.info("[ReachIQ][auth] VerifyEmailPage detected confirmed email during polling");
          toast.success("Email verified. Opening your dashboard...");
          router.replace("/dashboard");
        }
      }, 3000);

    return () => clearInterval(timer);
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus === "authenticated" || session?.user?.email_confirmed_at) {
      router.replace("/dashboard");
    }
  }, [authStatus, router, session?.user?.email_confirmed_at]);

  if (authStatus === "loading") {
    return <FullPageAuthLoader description="Checking whether your account is already confirmed." />;
  }

  if (authStatus === "authenticated") {
    return <FullPageAuthLoader description="Your account is already confirmed. Opening ReachIQ now." />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" theme="dark" href="/" />
        <p className="text-sm text-textSecondary">Find leads. Pitch smart. Get clients.</p>
      </div>
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-6 p-8 text-center">
          <div className="space-y-2">
            <p className="text-3xl font-semibold text-textPrimary">Verify your email</p>
            <p className="text-sm text-textSecondary">We sent a verification email to {email}. Please check your inbox and click the link.</p>
          </div>
          {!isSupabaseConfigured ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Auth is in setup mode. Add the real Supabase project URL before email verification can work.
            </div>
          ) : null}
          <div className="flex justify-center gap-3">
            <Button
              variant="secondary"
              onClick={async () => {
                if (!isSupabaseConfigured) {
                  toast.error(supabaseConfigMessage);
                  return;
                }

                const { error } = await supabase.auth.resend({
                  type: "signup",
                  email,
                  options: {
                    emailRedirectTo: buildAuthCallbackUrl("/dashboard")
                  }
                });
                if (error) {
                  toast.error(error.message);
                  return;
                }
                toast.success("Verification email resent successfully");
              }}
            >
              Resend email
            </Button>
            <Link href="/login">
              <Button>Back to login</Button>
            </Link>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-textSecondary">
            Tip: once your email is confirmed, ReachIQ will open the dashboard automatically. If nothing changes after a minute, refresh once and we'll recover the session.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<FullPageAuthLoader description="Loading email verification..." />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
