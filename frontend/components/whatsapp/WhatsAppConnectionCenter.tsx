"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Loader2, MessageSquareMore, QrCode, RefreshCcw, ShieldCheck, Smartphone, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/PageHeader";
import { api } from "@/lib/api";
import { buildApiUrl } from "@/lib/api-base-url";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type ProviderType = "qr" | "meta" | "none";
type ConnectionStatus =
  | "waiting_for_scan"
  | "connecting"
  | "connected"
  | "disconnected"
  | "expired";

type Connection = {
  id?: string;
  connected: boolean;
  providerType: ProviderType;
  status: ConnectionStatus;
  phoneNumber?: string | null;
  phoneNumberId?: string | null;
  sessionData?: Record<string, any>;
  lastActiveAt?: string | null;
  updatedAt?: string | null;
};

type StatusPayload = Connection & {
  connections?: Connection[];
  metaVerified?: boolean;
};

type QrState = {
  status: ConnectionStatus;
  qrImage: string | null;
  expiresAt: number | null;
  phoneNumber: string | null;
  lastActiveAt: string | null;
};

const initialQrState: QrState = {
  status: "disconnected",
  qrImage: null,
  expiresAt: null,
  phoneNumber: null,
  lastActiveAt: null
};

function formatConnectionStatus(status: ConnectionStatus) {
  switch (status) {
    case "waiting_for_scan":
      return "Waiting for scan";
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "expired":
      return "Expired";
    default:
      return "Disconnected";
  }
}

function formatTimestamp(value?: string | null) {
  if (!value) return "Just now";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function WhatsAppConnectionCenter() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [qrState, setQrState] = useState<QrState>(initialQrState);
  const [qrStarting, setQrStarting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<ProviderType | null>(null);
  const [metaForm, setMetaForm] = useState({
    phoneNumberId: "",
    accessToken: ""
  });
  const [verifyingMeta, setVerifyingMeta] = useState(false);
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [verifiedMeta, setVerifiedMeta] = useState<{ senderNumber?: string | null; verifiedName?: string | null } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const streamRef = useRef<EventSource | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);

  const activeProvider = status?.connected ? status.providerType : "none";
  const qrDisabled = activeProvider === "meta";
  const metaDisabled = activeProvider === "qr";

  const loadStatus = useCallback(async () => {
    const response = await api.get("/api/whatsapp/status");
    const data = response.data as StatusPayload;
    setStatus(data);

    if (data.providerType === "qr") {
      const nextStatus = data.status || "disconnected";
      setQrState({
        status: nextStatus,
        qrImage: nextStatus === "connected" ? null : (data as any).qrImage ?? null,
        expiresAt: nextStatus === "connected" ? null : (data as any).expiresAt ?? null,
        phoneNumber: data.phoneNumber ?? null,
        lastActiveAt: data.lastActiveAt ?? null
      });
      return;
    }

    if (data.providerType === "meta" || !data.connected) {
      setQrState(initialQrState);
    }
  }, []);

  useEffect(() => {
    loadStatus()
      .catch((error: any) => {
        toast.error(error?.response?.data?.error || "Could not load WhatsApp connection status");
      })
      .finally(() => setLoading(false));

    return () => {
      streamRef.current?.close();
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [loadStatus]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refresh = () => {
      void loadStatus().catch(() => null);
    };

    const intervalId = window.setInterval(refresh, 15000);
    const handleFocus = () => refresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadStatus]);

  const connectQrStream = useCallback(async () => {
    streamRef.current?.close();

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your session token is missing. Please sign in again.");
    }

    const source = new EventSource(buildApiUrl(`/api/whatsapp/qr-stream?token=${encodeURIComponent(session.access_token)}`));
    streamRef.current = source;

    source.addEventListener("snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}");
      setQrState((current) => ({
        ...current,
        status: payload.status || current.status,
        qrImage: payload.qrImage || current.qrImage,
        expiresAt: payload.expiresAt || current.expiresAt,
        phoneNumber: payload.phoneNumber || current.phoneNumber,
        lastActiveAt: payload.lastActiveAt || current.lastActiveAt
      }));
    });

    source.addEventListener("qr", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}");
      setQrState({
        status: "waiting_for_scan",
        qrImage: payload.qrImage || null,
        expiresAt: payload.expiresAt || null,
        phoneNumber: null,
        lastActiveAt: null
      });
    });

    source.addEventListener("status", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}");
      setQrState((current) => ({
        ...current,
        status: payload.status || current.status
      }));
      if (payload.status === "expired") {
        if (refreshTimeoutRef.current) {
          window.clearTimeout(refreshTimeoutRef.current);
        }
        refreshTimeoutRef.current = window.setTimeout(() => {
          void startQrConnection(true);
        }, 1200);
      }
    });

    source.addEventListener("connected", (event) => {
      const payload = JSON.parse((event as MessageEvent).data || "{}");
      setQrState({
        status: "connected",
        qrImage: null,
        expiresAt: null,
        phoneNumber: payload.phoneNumber || null,
        lastActiveAt: payload.lastActiveAt || null
      });
      toast.success("WhatsApp connected with QR");
      void loadStatus();
    });

    source.onerror = () => {
      source.close();
    };
  }, [loadStatus]);

  useEffect(() => {
    if (
      status?.providerType === "qr" &&
      status.status !== "disconnected" &&
      !streamRef.current
    ) {
      void connectQrStream().catch(() => null);
    }

    if (status?.providerType !== "qr" && streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
  }, [connectQrStream, status?.providerType, status?.status]);

  useEffect(() => {
    if (!qrState.expiresAt || qrState.status !== "waiting_for_scan") {
      setCountdown(0);
      return;
    }

    const expiresAt = qrState.expiresAt;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        setQrState((current) => ({ ...current, status: "expired", qrImage: null, expiresAt: null }));
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [qrState.expiresAt, qrState.status]);

  const startQrConnection = useCallback(async (forceFresh = false) => {
    try {
      setQrStarting(true);
      await api.post("/api/whatsapp/qr/start", { forceFresh });
      setQrState((current) => ({
        ...current,
        status: "connecting"
      }));
      await connectQrStream();
      await loadStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not start QR connection");
    } finally {
      setQrStarting(false);
    }
  }, [connectQrStream, loadStatus]);

  const verifyMeta = useCallback(async () => {
    if (!metaForm.phoneNumberId || !metaForm.accessToken) {
      toast.error("Enter Phone Number ID and Access Token first");
      return;
    }

    try {
      setVerifyingMeta(true);
      const response = await api.post("/api/whatsapp/meta/verify", metaForm);
      setVerifiedMeta({
        senderNumber: response.data?.senderNumber,
        verifiedName: response.data?.verifiedName
      });
      toast.success("Meta credentials verified");
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Meta verification failed");
    } finally {
      setVerifyingMeta(false);
    }
  }, [metaForm]);

  const connectMeta = useCallback(async () => {
    if (!metaForm.phoneNumberId || !metaForm.accessToken) {
      toast.error("Enter Phone Number ID and Access Token first");
      return;
    }

    try {
      setConnectingMeta(true);
      const response = await api.post("/api/whatsapp/meta/connect", metaForm);
      setStatus(response.data?.connection ? {
        ...response.data.connection,
        connections: status?.connections || []
      } : status);
      setVerifiedMeta({
        senderNumber: response.data?.senderNumber,
        verifiedName: response.data?.verifiedName
      });
      streamRef.current?.close();
      setQrState(initialQrState);
      toast.success("Meta WhatsApp connected");
      await loadStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not connect Meta WhatsApp");
    } finally {
      setConnectingMeta(false);
    }
  }, [loadStatus, metaForm, status]);

  const disconnectProvider = useCallback(async (providerType: ProviderType) => {
    if (providerType === "none") return;

    try {
      setDisconnecting(providerType);
      const endpoint = providerType === "qr" ? "/api/whatsapp/qr/disconnect" : "/api/whatsapp/meta/disconnect";
      await api.post(endpoint);
      if (providerType === "qr") {
        streamRef.current?.close();
        setQrState(initialQrState);
      }
      toast.success("WhatsApp connection removed");
      await loadStatus();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Could not disconnect WhatsApp");
    } finally {
      setDisconnecting(null);
    }
  }, [loadStatus]);

  const qrStatusLabel = formatConnectionStatus(qrState.status);
  const metaStatusLabel = activeProvider === "meta" && status?.connected ? "Connected" : "Not connected";

  const summaryBadge = useMemo(() => {
    if (!status?.connected) {
      return <Badge className="w-full justify-center rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-warning md:w-auto">No active sender connected</Badge>;
    }

    return (
      <Badge className="w-full justify-center rounded-full border border-success/20 bg-success/10 px-3 py-1 text-success md:w-auto">
        Active connection: {status.providerType === "qr" ? "Quick Connect (QR)" : "Meta API"}
      </Badge>
    );
  }, [status]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="WhatsApp"
        title="Connection Center"
        description="Choose one active WhatsApp sender for ReachIQ. Quick Connect gives you a live QR scan flow, while Meta API is the official business route."
        actions={summaryBadge}
      />

      <Card className="border-white/8 bg-white/[0.03]">
        <CardContent className="flex flex-col gap-3 p-5 text-sm text-textSecondary md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium text-textPrimary">Only one connection can be active per workspace.</p>
            <p className="mt-1">If Quick Connect is active, Meta is locked until you disconnect. If Meta is active, Quick Connect is locked until you disconnect.</p>
          </div>
          <div className="flex w-full items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-center text-primary md:w-auto md:justify-start">
            <Smartphone className="h-4 w-4" />
            <span>Ready for campaigns, follow-ups, and automated sends</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/8 bg-white/[0.03]">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:h-14 sm:w-14">
                  <QrCode className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-textPrimary sm:text-2xl">Quick Connect (QR Scanner)</p>
                  <p className="mt-1 text-sm leading-6 text-textSecondary">Generate a live QR, scan it from WhatsApp Linked Devices, and ReachIQ will keep the session alive for automated sending.</p>
                </div>
              </div>
              <Badge
                variant={qrState.status === "connected" ? "success" : qrState.status === "expired" ? "warning" : "default"}
                className="self-start sm:self-auto"
              >
                {qrStatusLabel}
              </Badge>
            </div>

            {qrState.qrImage && qrState.status !== "connected" ? (
              <div className="flex flex-col items-center gap-4 rounded-[28px] border border-white/8 bg-surface2/70 p-4 sm:p-6">
                <img
                  src={qrState.qrImage}
                  alt="WhatsApp QR code"
                  className="aspect-square w-full max-w-[15rem] rounded-[24px] bg-white p-3 shadow-[0_20px_80px_rgba(0,0,0,0.32)] sm:max-w-[18rem] sm:p-4"
                />
                <div className="flex w-full max-w-fit items-center justify-center gap-2 rounded-full border border-warning/20 bg-warning/10 px-4 py-2 text-center text-sm text-warning">
                  <Clock3 className="h-4 w-4" />
                  {countdown > 0 ? `Expires in ${countdown}s` : "Refreshing code..."}
                </div>
                <p className="max-w-md text-center text-sm text-textSecondary">Open WhatsApp on your phone, go to Linked Devices, and scan this QR code.</p>
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-white/10 bg-surface2/70 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-textMuted">
                    {qrStarting ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquareMore className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-textPrimary">
                      {qrState.status === "connected"
                        ? "QR connection is live"
                        : qrState.status === "connecting"
                          ? "Preparing a fresh QR session"
                          : "No live QR generated yet"}
                    </p>
                    <p className="text-sm text-textSecondary">
                      {qrState.status === "connected"
                        ? `Connected phone: ${qrState.phoneNumber || "unknown"}`
                        : "Generate a QR and ReachIQ will keep updating this card automatically."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <InfoTile label="Connected phone" value={qrState.phoneNumber || "Not connected"} />
              <InfoTile label="Last active" value={formatTimestamp(qrState.lastActiveAt)} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="w-full justify-center sm:w-auto" onClick={() => startQrConnection(true)} disabled={qrStarting || qrDisabled}>
                {qrStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                {qrState.status === "connected" ? "Refresh QR session" : "Connect with QR"}
              </Button>
              <Button className="w-full justify-center sm:w-auto" variant="secondary" onClick={() => startQrConnection(true)} disabled={qrStarting || qrDisabled}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Regenerate QR
              </Button>
              <Button
                className="w-full justify-center sm:w-auto"
                variant="danger"
                onClick={() => disconnectProvider("qr")}
                disabled={disconnecting === "qr" || activeProvider !== "qr"}
              >
                {disconnecting === "qr" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
                Disconnect
              </Button>
            </div>

            {qrDisabled ? (
              <p className="text-sm text-warning">Meta API is already connected. Disconnect it before starting a QR session.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-white/8 bg-white/[0.03]">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent sm:h-14 sm:w-14">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-textPrimary sm:text-2xl">Meta WhatsApp Business API</p>
                  <p className="mt-1 text-sm leading-6 text-textSecondary">Paste your Phone Number ID and Access Token, verify them with Meta, and save them securely for production sending.</p>
                </div>
              </div>
              <Badge
                variant={activeProvider === "meta" && status?.connected ? "success" : "default"}
                className="self-start sm:self-auto"
              >
                {metaStatusLabel}
              </Badge>
            </div>

            <div className="grid gap-4">
              <Input
                placeholder="Phone Number ID"
                value={metaForm.phoneNumberId}
                onChange={(event) => setMetaForm((current) => ({ ...current, phoneNumberId: event.target.value }))}
                disabled={metaDisabled}
              />
              <Input
                placeholder="Access Token"
                value={metaForm.accessToken}
                onChange={(event) => setMetaForm((current) => ({ ...current, accessToken: event.target.value }))}
                disabled={metaDisabled}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InfoTile label="Sender number" value={verifiedMeta?.senderNumber || status?.phoneNumber || "Not verified yet"} />
              <InfoTile label="Verified name" value={verifiedMeta?.verifiedName || "Waiting for verify"} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="w-full justify-center sm:w-auto" variant="secondary" onClick={verifyMeta} disabled={verifyingMeta || metaDisabled}>
                {verifyingMeta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify
              </Button>
              <Button className="w-full justify-center sm:w-auto" onClick={connectMeta} disabled={connectingMeta || metaDisabled}>
                {connectingMeta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Connect
              </Button>
              <Button
                className="w-full justify-center sm:w-auto"
                variant="danger"
                onClick={() => disconnectProvider("meta")}
                disabled={disconnecting === "meta" || activeProvider !== "meta"}
              >
                {disconnecting === "meta" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
                Disconnect
              </Button>
            </div>

            {metaDisabled ? (
              <p className="text-sm text-warning">Quick Connect is already active. Disconnect it before using Meta API.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-surface2/70 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-textMuted">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-textPrimary">{value}</p>
    </div>
  );
}

export default WhatsAppConnectionCenter;
