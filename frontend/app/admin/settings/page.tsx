"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  BellRing,
  CreditCard,
  ImageUp,
  QrCode,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

type SearchSource = {
  status: string;
  note: string;
};

const qrStoragePath = "upi-qr.png";

type SettingsErrorState = {
  title: string;
  message: string;
  canRetry?: boolean;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [searchSources, setSearchSources] = useState<Record<string, SearchSource>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrInputKey, setQrInputKey] = useState(0);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState("");
  const [errorState, setErrorState] = useState<SettingsErrorState | null>(null);

  const paymentsEnabled = settings.payments_enabled === "true";
  const upiId = settings.upi_id || "";

  const loadSettings = async () => {
    setLoading(true);
    setErrorState(null);

    try {
      const response = await api.get("/api/admin/settings");
      const next = Object.fromEntries((response.data?.settings || []).map((item: any) => [item.key, item.value]));
      setSettings(next);
      setSearchSources(response.data?.searchSources || {});
      setQrPreviewUrl(next.upi_qr_url || "");
    } catch (error: any) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.error;

      if (status === 401) {
        setErrorState({
          title: "Your admin session expired before settings could load",
          message:
            "ReachIQ could not verify your admin session for the settings request. Refresh the page or sign in again, then the UPI and payment controls will load normally.",
          canRetry: true
        });
      } else if (status === 403) {
        setErrorState({
          title: "This account cannot open admin settings",
          message:
            "The backend rejected the admin settings request. Double-check that this account still has the admin role in the live profiles table.",
          canRetry: true
        });
      } else {
        setErrorState({
          title: "Admin settings are temporarily unavailable",
          message: backendMessage || "ReachIQ could not load the payment and platform settings just now. You can retry without losing the rest of the app.",
          canRetry: true
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    setQrPreviewUrl(settings.upi_qr_url || "");
  }, [settings.upi_qr_url]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/api/admin/settings", settings);
      setErrorState(null);
      toast.success("Admin settings updated");
    } catch (error: any) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.error;

      if (status === 401 || status === 403) {
        setErrorState({
          title: "Save blocked by admin access",
          message:
            status === 401
              ? "Your admin session expired while saving. Sign in again or refresh, then retry the save."
              : "The backend denied this admin settings update. Confirm this account still has admin access.",
          canRetry: true
        });
      }

      toast.error(backendMessage || "Could not save admin settings");
    } finally {
      setSaving(false);
    }
  };

  const handleQRUpload = async () => {
    if (!qrFile) {
      toast.error("Choose a QR image first");
      return;
    }

    if (!isSupabaseConfigured) {
      toast.error("Supabase storage is not configured in this environment yet.");
      return;
    }

    setQrUploading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage.from("platform-assets").upload(qrStoragePath, qrFile, {
        upsert: true,
        cacheControl: "3600",
        contentType: qrFile.type || "image/png"
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl }
      } = supabase.storage.from("platform-assets").getPublicUrl(qrStoragePath);

      await api.patch("/api/admin/settings", {
        upi_qr_url: publicUrl
      });

      setErrorState(null);
      setSettings((current) => ({ ...current, upi_qr_url: publicUrl }));
      setQrPreviewUrl(publicUrl);
      setQrFile(null);
      setQrInputKey((current) => current + 1);
      toast.success("UPI QR updated. The new QR will appear in the payment modal.");
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        setErrorState({
          title: "QR upload finished, but admin save was blocked",
          message:
            status === 401
              ? "The QR image upload completed, but ReachIQ could not attach it to admin settings because your session expired."
              : "The QR image upload completed, but the backend denied the admin settings update for this account.",
          canRetry: true
        });
      }
      toast.error(error?.message || "Could not upload the UPI QR image");
    } finally {
      setQrUploading(false);
    }
  };

  const sourceCards = useMemo(
    () => [
      { key: "overpass", label: "OpenStreetMap (Overpass)" },
      { key: "serper", label: "Serper.dev (Google Maps)" },
      { key: "outscraper", label: "Outscraper" }
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Platform controls"
        description="Tune growth levers, manage the manual checkout setup, and control the operational messaging shown to users."
        actions={<Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>}
      />

      {errorState ? (
        <Card className="border-danger/20 bg-danger/6">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-danger/12 text-danger">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-textPrimary">{errorState.title}</p>
                <p className="max-w-3xl text-sm leading-6 text-textSecondary">{errorState.message}</p>
              </div>
            </div>
            {errorState.canRetry ? (
              <Button variant="secondary" onClick={() => void loadSettings()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Retry settings
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-[36rem]" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                    <BellRing className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-textPrimary">Platform messaging</p>
                    <p className="text-sm text-textSecondary">Control the announcement banner and daily free plan limits.</p>
                  </div>
                </div>
                <Badge variant={settings.maintenance_mode === "true" ? "warning" : "success"}>
                  {settings.maintenance_mode === "true" ? "Maintenance on" : "Live"}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-textPrimary">Announcement banner</p>
                <Textarea
                  value={settings.platform_announcement || ""}
                  onChange={(event) => setSettings((current) => ({ ...current, platform_announcement: event.target.value }))}
                  placeholder="Write a short announcement for all user dashboards"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-textPrimary">Free messages per day</p>
                  <Input
                    value={settings.free_messages_per_day || ""}
                    onChange={(event) => setSettings((current) => ({ ...current, free_messages_per_day: event.target.value }))}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-textPrimary">Premium messages per day</p>
                  <Input
                    value={settings.premium_messages_per_day || ""}
                    onChange={(event) => setSettings((current) => ({ ...current, premium_messages_per_day: event.target.value }))}
                    placeholder="200"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-textPrimary">Referral bonus messages</p>
                  <Input
                    value={settings.referral_bonus_messages || ""}
                    onChange={(event) => setSettings((current) => ({ ...current, referral_bonus_messages: event.target.value }))}
                    placeholder="10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-textPrimary">Support WhatsApp number</p>
                <Input
                  value={settings.support_whatsapp_number || ""}
                  onChange={(event) => setSettings((current) => ({ ...current, support_whatsapp_number: event.target.value }))}
                  placeholder="919025929032"
                />
                <p className="text-xs text-textMuted">Used by the floating public support button and any pricing waitlist fallbacks.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-textPrimary">Maintenance mode</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant={settings.maintenance_mode === "true" ? "primary" : "secondary"}
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        maintenance_mode: current.maintenance_mode === "true" ? "false" : "true"
                      }))
                    }
                  >
                    {settings.maintenance_mode === "true" ? "Disable maintenance" : "Enable maintenance"}
                  </Button>
                  <p className="text-sm text-textSecondary">Non-admin users will see a maintenance state when enabled.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-textPrimary">Manual payments setup</p>
                  <p className="text-sm text-textSecondary">Configure the UPI details used by the ReachIQ checkout modal and review queue.</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-textPrimary">Premium payments</p>
                    <p className="mt-1 text-sm text-textSecondary">Turn this on only when your manual UPI review flow is staffed and ready.</p>
                  </div>
                  <Badge variant={paymentsEnabled ? "success" : "warning"}>
                    {paymentsEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="mt-4 flex gap-3">
                  <Button
                    variant={paymentsEnabled ? "secondary" : "primary"}
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        payments_enabled: current.payments_enabled === "true" ? "false" : "true"
                      }))
                    }
                  >
                    {paymentsEnabled ? "Turn payments off" : "Turn payments on"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr,0.8fr]">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-textPrimary">UPI ID</p>
                  <Input
                    value={upiId}
                    onChange={(event) => setSettings((current) => ({ ...current, upi_id: event.target.value }))}
                    placeholder="reachiq@upi"
                  />
                  <p className="text-xs text-textMuted">This ID is shown in the payment modal and is what users copy if they prefer not to scan the QR.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-textPrimary">Current QR public URL</p>
                  <Input
                    value={settings.upi_qr_url || ""}
                    onChange={(event) => setSettings((current) => ({ ...current, upi_qr_url: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/12 text-success">
                      <QrCode className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-textPrimary">UPI QR preview</p>
                      <p className="text-sm text-textSecondary">Users will see this inside the ReachIQ checkout modal.</p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[20px] border border-white/8 bg-surface2">
                    {qrPreviewUrl ? (
                      <img src={qrPreviewUrl} alt="ReachIQ UPI QR preview" className="h-64 w-full object-contain bg-white p-4" />
                    ) : (
                      <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                          <ImageUp className="h-5 w-5" />
                        </div>
                        <p className="text-base font-medium text-textPrimary">No QR uploaded yet</p>
                        <p className="max-w-sm text-sm leading-6 text-textSecondary">
                          Upload the QR screenshot from GPay, PhonePe, Paytm, or BHIM so the manual UPI checkout can show it to users.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-textPrimary">Upload a new UPI QR image</p>
                      <p className="mt-1 text-sm text-textSecondary">We store a single public QR image in the shared `platform-assets` bucket and reuse it across the product.</p>
                    </div>
                    <Badge variant="default">Admin only</Badge>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] px-4 py-4 text-sm text-textSecondary">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                        <Upload className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-textPrimary">{qrFile ? qrFile.name : "Choose QR image"}</p>
                        <p>PNG or JPEG screenshot from your payment app</p>
                      </div>
                    </div>
                    <input
                      key={qrInputKey}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(event) => setQrFile(event.target.files?.[0] || null)}
                    />
                  </label>

                  <div className="rounded-[22px] border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-textSecondary">
                    <p className="mb-2 font-medium text-textPrimary">How to get the QR image</p>
                    <ol className="list-decimal space-y-1 pl-5">
                      <li>Open GPay, PhonePe, Paytm, BHIM, or your preferred UPI app.</li>
                      <li>Open your “Receive money” or “Your QR code” screen.</li>
                      <li>Take a clean screenshot that clearly includes the QR and UPI handle.</li>
                      <li>Upload it here, then click “Upload QR image”.</li>
                    </ol>
                  </div>

                  <div className="rounded-[22px] border border-success/15 bg-success/8 p-4 text-sm leading-6 text-textSecondary">
                    <div className="mb-2 flex items-center gap-2 text-success">
                      <ShieldCheck className="h-4 w-4" />
                      <p className="font-medium">Checkout disclaimer for admins</p>
                    </div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Only upload the QR that belongs to the official ReachIQ payment account.</li>
                      <li>The manual review queue should verify the UPI transaction ID before approving any upgrade.</li>
                      <li>If you replace the QR, users will immediately see the new version the next time they open the payment modal.</li>
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => void handleQRUpload()} disabled={qrUploading || !qrFile}>
                      {qrUploading ? "Uploading..." : "Upload QR image"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={qrUploading || !qrPreviewUrl}
                      onClick={() => {
                        setSettings((current) => ({ ...current, upi_qr_url: "" }));
                        setQrPreviewUrl("");
                        toast.success("QR preview cleared locally. Click Save changes to keep it removed.");
                      }}
                    >
                      Clear preview
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-textPrimary">Settings health</p>
                <div className="flex items-center gap-3 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                    <Settings2 className="h-4 w-4" />
                  </div>
                  <p className="text-sm text-textSecondary">All admin settings save into the `admin_settings` table and are available to the frontend payment surfaces after refresh.</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-textPrimary">Lead search sources</p>
                <p className="text-sm text-textSecondary">These are backend-owned search providers. Users never see or configure these keys.</p>
                <div className="space-y-3">
                  {sourceCards.map((item) => {
                    const source = searchSources[item.key];
                    const status =
                      source?.status === "active"
                        ? "success"
                        : source?.status === "always_active"
                          ? "default"
                          : "warning";

                    return (
                      <div key={item.key} className="flex items-center justify-between rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                        <div>
                          <p className="font-medium text-textPrimary">{item.label}</p>
                          <p className="text-sm text-textSecondary">{source?.note || "Not configured"}</p>
                        </div>
                        <Badge variant={status as "default" | "success" | "warning"}>
                          {source?.status === "always_active"
                            ? "Always active"
                            : source?.status === "active"
                              ? "Configured"
                              : "Not configured"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-textMuted">ReachIQ tries OpenStreetMap first, then Serper, then Outscraper.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
