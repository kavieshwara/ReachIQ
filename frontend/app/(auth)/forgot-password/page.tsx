"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FullPageAuthLoader } from "@/components/auth/FullPageAuthLoader";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "@/lib/supabase";
import { useUserStore } from "@/store/useUserStore";

export default function ForgotPasswordPage() {
  const { authStatus } = useUserStore();
  const [email, setEmail] = useState("");

  if (authStatus === "loading") {
    return <FullPageAuthLoader description="Checking your session before opening password recovery." />;
  }

  if (authStatus === "authenticated") {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0F] px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo variant="full" size="lg" theme="dark" href="/" />
        <p className="text-sm text-textSecondary">Find leads. Pitch smart. Get clients.</p>
      </div>
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-8">
          <div className="space-y-2 text-center">
            <p className="text-3xl font-semibold text-textPrimary">Reset password</p>
            <p className="text-sm text-textSecondary">We'll email you a password reset link.</p>
          </div>
          {!isSupabaseConfigured ? (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Auth is in setup mode. Add the real Supabase project URL to enable password resets.
            </div>
          ) : null}
          <Input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Button
            className="w-full"
            onClick={async () => {
              if (!isSupabaseConfigured) {
                toast.error(supabaseConfigMessage);
                return;
              }

              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
              });
              if (error) {
                toast.error(error.message);
                return;
              }
              toast.success("Password reset email sent");
            }}
          >
            Send reset link
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
