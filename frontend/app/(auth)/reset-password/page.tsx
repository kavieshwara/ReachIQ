"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { FullPageAuthLoader } from "@/components/auth/FullPageAuthLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/lib/supabase";
import { useUserStore } from "@/store/useUserStore";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { authStatus, syncSession } = useUserStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      if (data.session) {
        await syncSession(data.session);
        setSessionReady(true);
        return;
      }

      setSessionReady(false);
    };

    initialize().catch(() => setSessionReady(false));

    return () => {
      mounted = false;
    };
  }, [syncSession]);

  if (authStatus === "loading") {
    return <FullPageAuthLoader description="Preparing your password reset session." />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" theme="dark" href="/" />
        <p className="text-sm text-textSecondary">Set a fresh password, then go straight back into ReachIQ.</p>
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <div className="space-y-2 text-center">
            <p className="text-3xl font-semibold text-textPrimary">Choose a new password</p>
            <p className="text-sm text-textSecondary">
              Use the recovery link from your email, then set the password you want to use from now on.
            </p>
          </div>

          {!sessionReady ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              This recovery link is not active right now. Open the latest password reset email again and come back through that link.
            </div>
          ) : null}

          <div className="space-y-4">
            <PasswordInput
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordInput
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              disabled={!sessionReady || submitting}
              onClick={async () => {
                if (password.length < 6) {
                  toast.error("Password should be at least 6 characters.");
                  return;
                }

                if (password !== confirmPassword) {
                  toast.error("Passwords do not match.");
                  return;
                }

                try {
                  setSubmitting(true);
                  const { error } = await supabase.auth.updateUser({ password });
                  if (error) {
                    toast.error(error.message);
                    return;
                  }

                  toast.success("Password updated. Please log in with your new password.");
                  await supabase.auth.signOut();
                  router.replace("/login");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? "Saving..." : "Save new password"}
            </Button>
            <Button variant="secondary" onClick={() => router.replace("/login")}>
              Back to login
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
