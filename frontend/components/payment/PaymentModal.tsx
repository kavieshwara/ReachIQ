"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Clock3, Copy, Gift, ShieldCheck, Sparkles } from "lucide-react";
import api from "@/lib/api";
import { paymentPlanConfig, type CheckoutPlan, formatInr } from "@/lib/payment-plans";
import { LogoIcon } from "@/components/brand/Logo";
import { toast } from "sonner";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: CheckoutPlan;
  userEmail: string;
  userName: string;
}

const UPI_APPS = [
  { name: "GPay", badge: "G", color: "#1A73E8", textColor: "#FFFFFF" },
  { name: "PhonePe", badge: "P", color: "#5F259F", textColor: "#FFFFFF" },
  { name: "Paytm", badge: "P", color: "#002970", textColor: "#FFFFFF" },
  { name: "CRED", badge: "C", color: "#1C1C1C", textColor: "#FFFFFF" },
  { name: "BHIM", badge: "B", color: "#FF6B00", textColor: "#FFFFFF" }
] as const;

type PaymentCheckoutPayload = {
  payments_enabled?: boolean;
  upi_id?: string;
  upi_qr_url?: string;
  amount?: number;
  plan_label?: string;
  upi_intent_url?: string;
  dynamic_qr_data_url?: string;
};

export function PaymentModal({ isOpen, onClose, plan, userEmail, userName }: PaymentModalProps) {
  const [activeTab, setActiveTab] = useState<"upi" | "cards" | "netbanking">("upi");
  const [transactionId, setTransactionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [upiId, setUpiId] = useState("reachiq@upi");
  const [upiQrUrl, setUpiQrUrl] = useState("");
  const [upiIntentUrl, setUpiIntentUrl] = useState("");
  const [qrTimer, setQrTimer] = useState(600);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const config = paymentPlanConfig[plan];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsMobile(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    setSettingsLoaded(false);
    setSettingsError(null);
    setPaymentsEnabled(false);
    setUpiIntentUrl("");

    api
      .get<PaymentCheckoutPayload>("/api/platform/payment-checkout", { params: { plan } })
      .then(({ data }) => {
        if (cancelled) {
          return;
        }

        if (data.upi_id) {
          setUpiId(data.upi_id);
        }
        setUpiQrUrl(data.dynamic_qr_data_url || data.upi_qr_url || "");
        setUpiIntentUrl(data.upi_intent_url || "");
        setPaymentsEnabled(Boolean(data.payments_enabled));
        setSettingsLoaded(true);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const responseError = error as { response?: { status?: number; data?: { error?: string } } };
        const message =
          responseError.response?.data?.error ||
          (responseError.response?.status === 404
            ? "Payment checkout settings are not available on the backend yet."
            : "Could not load the live ReachIQ payment setup.");
        setSettingsError(message);
        setPaymentsEnabled(false);
        setSettingsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, plan]);

  useEffect(() => {
    if (!isOpen) {
      setSubmitted(false);
      setTransactionId("");
      setCopied(false);
      setActiveTab("upi");

      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    setQrTimer(600);
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      setQrTimer((previous) => {
        if (previous <= 1) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen]);

  const offerCopy = useMemo(() => {
    const name = userName.trim();
    if (name) {
      return `Hi ${name}, invite 1 friend with your referral link and unlock Rs 50 off your next renewal.`;
    }

    return "Invite 1 friend with your referral link and unlock Rs 50 off your next renewal.";
  }, [userName]);

  const formatTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const refreshQr = () => {
    setQrTimer(600);

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      setQrTimer((previous) => {
        if (previous <= 1) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }

        return previous - 1;
      });
    }, 1000);
  };

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      toast.success("UPI ID copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy the UPI ID");
    }
  };

  const openUpiApp = () => {
    if (!upiIntentUrl) {
      toast.error("ReachIQ could not build the UPI payment link yet.");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    window.location.href = upiIntentUrl;
  };

  const handleSubmit = async () => {
    if (!userEmail) {
      toast.error("Please sign in before submitting a payment.");
      return;
    }

    if (!paymentsEnabled) {
      toast.error("Payments are temporarily disabled. Please try again later.");
      return;
    }

    if (!transactionId.trim() || transactionId.trim().length < 6) {
      toast.error("Please enter a valid UPI Transaction ID.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/api/payments/submit", {
        plan,
        upi_transaction_id: transactionId.trim()
      });
      setSubmitted(true);
      toast.success("Payment submitted for review.");
    } catch (error: unknown) {
      const responseError = error as { response?: { status?: number; data?: { error?: string } } };
      const status = responseError.response?.status;
      const backendMessage = responseError.response?.data?.error;

      if (status === 401) {
        toast.error("Please sign in before submitting a payment.");
      } else if (status === 404 || status === 501) {
        toast.error("Payment submission is not live on the backend yet.");
      } else {
        toast.error(backendMessage || "Submission failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="payment-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            key="payment-modal-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[121] flex items-end justify-center p-0 sm:items-center sm:p-4"
          >
            <motion.div
              initial={isMobile ? { opacity: 0, y: 60 } : { opacity: 0, scale: 0.95, y: 20 }}
              animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { opacity: 0, y: 60 } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 260 }}
              className="flex h-[100dvh] w-full max-w-[960px] overflow-hidden bg-white shadow-[0_32px_80px_rgba(0,0,0,0.6)] sm:h-auto sm:max-h-[90vh] sm:rounded-[24px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="relative hidden w-[320px] flex-shrink-0 flex-col overflow-hidden border-r border-white/6 px-7 py-7 sm:flex"
                style={{ background: "linear-gradient(160deg, #0A0A0F 0%, #12121A 60%, #0D0D18 100%)" }}
              >
                <div
                  className="pointer-events-none absolute left-[-40px] top-[-40px] h-[220px] w-[220px] rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(108,99,255,0.18) 0%, transparent 70%)" }}
                />

                <div className="relative z-[1] flex items-center gap-3">
                  <LogoIcon size="md" />
                  <span className="text-[22px] font-semibold tracking-[-0.04em]">
                    <span className="text-white">reach</span>
                    <span className="text-[#00D9A6]">iq</span>
                  </span>
                </div>

                <div className="relative z-[1] mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#00D9A6]/20 bg-[#00D9A6]/10 px-3 py-1 text-[12px] font-medium text-[#00D9A6]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  ReachIQ Trusted Platform
                </div>

                <div className="relative z-[1] mt-6 rounded-[14px] border border-[#6C63FF]/20 bg-[#6C63FF]/10 px-4 py-3 text-[13px] text-[#B8B8D4]">
                  <span className="mr-1 text-white">500+</span>
                  freelancers use ReachIQ
                </div>

                <div className="relative z-[1] mt-5 rounded-[16px] border border-white/8 bg-white/[0.05] p-4">
                  <p className="mb-2 text-[12px] uppercase tracking-[0.16em] text-[#9898B8]">Price Summary</p>
                  <p className="text-[34px] font-semibold tracking-[-0.04em] text-white">{formatInr(config.price)}</p>
                  <p className="mt-1 text-[12px] text-[#66667A] line-through">{formatInr(config.originalPrice)}/month</p>
                  <p className="mt-4 text-[14px] font-medium text-[#F3F3FF]">{config.label}</p>
                  <div className="mt-3 space-y-2">
                    {config.features.map((feature) => (
                      <p key={feature} className="text-[12px] text-[#A6A6C8]">
                        <span className="mr-2 text-[#00D9A6]">+</span>
                        {feature}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="relative z-[1] mt-4 rounded-[14px] border border-white/6 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] text-[#9898B8]">Paying as</p>
                  <p className="mt-1 text-[13px] font-medium text-[#F0F0FF]">{userEmail || "Sign in to complete your upgrade"}</p>
                </div>

                <div className="flex-1" />

                <div className="relative z-[1] mb-4 opacity-70">
                  <svg viewBox="0 0 240 120" width="100%" fill="none">
                    <circle cx="120" cy="80" r="50" stroke="#6C63FF" strokeWidth="0.5" strokeDasharray="4 4" />
                    <circle cx="120" cy="80" r="35" stroke="#6C63FF" strokeWidth="0.5" strokeDasharray="4 4" />
                    <circle cx="120" cy="80" r="20" stroke="#00D9A6" strokeWidth="0.5" />
                    <circle cx="120" cy="80" r="6" fill="#6C63FF" />
                    <line x1="120" y1="30" x2="160" y2="50" stroke="#6C63FF" strokeWidth="0.5" />
                    <line x1="120" y1="30" x2="80" y2="50" stroke="#6C63FF" strokeWidth="0.5" />
                    <circle cx="120" cy="28" r="4" fill="#00D9A6" />
                    <circle cx="162" cy="50" r="3" fill="#6C63FF" opacity="0.6" />
                    <circle cx="78" cy="50" r="3" fill="#6C63FF" opacity="0.6" />
                    <rect x="170" y="20" width="50" height="30" rx="8" fill="#6C63FF" opacity="0.15" stroke="#6C63FF" strokeWidth="0.5" />
                    <rect x="20" y="30" width="40" height="24" rx="6" fill="#00D9A6" opacity="0.1" stroke="#00D9A6" strokeWidth="0.5" />
                  </svg>
                </div>

                <div className="relative z-[1] flex items-center gap-2 text-[11px] text-[#8E8EA8]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#00D9A6]" />
                  Secured by ReachIQ
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col bg-white">
                <div className="flex items-center justify-between border-b border-[#F0F0F5] px-5 py-4 sm:px-7">
                  <div>
                    <h2 className="text-[18px] font-semibold text-[#1A1A2E]">Payment Options</h2>
                    <p className="mt-1 text-[12px] text-[#7D7D96]">Manual UPI checkout with admin verification.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full p-2 text-[#9898B8] transition hover:bg-[#F7F7FC] hover:text-[#1A1A2E]"
                    aria-label="Close checkout"
                  >
                    x
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
                  {settingsError ? (
                    <div className="rounded-[14px] border border-[#FFD4C7] bg-[#FFF6F1] px-4 py-3 text-[13px] text-[#A1431E]">
                      {settingsError}
                    </div>
                  ) : null}

                  {!paymentsEnabled && settingsLoaded ? (
                    <div className="rounded-[14px] border border-[#FFD4C7] bg-[#FFF6F1] px-4 py-3 text-[13px] text-[#A1431E]">
                      ReachIQ payments are temporarily unavailable. You can still review plans, but submission is paused right now.
                    </div>
                  ) : null}

                  {!userEmail ? (
                    <div className="rounded-[14px] border border-[#E5DBFF] bg-[#F7F4FF] px-4 py-3 text-[13px] text-[#4B44CC]">
                      Sign in or create your account first, then come back here to submit the transaction ID for activation.
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#66667E]">Available Offers</p>
                    <div className="flex items-center gap-3 rounded-[14px] border border-[#E0E0FF] bg-[#F8F8FF] px-4 py-3">
                      <Gift className="h-5 w-5 text-[#6C63FF]" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#3C3489]">{offerCopy}</p>
                        <p className="mt-1 text-[12px] text-[#7D7D96]">Referral rewards show up on your next ReachIQ renewal.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#66667E]">Payment Methods</p>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("upi")}
                        className="flex w-full items-center justify-between rounded-[14px] border px-4 py-4 text-left transition"
                        style={{
                          borderColor: activeTab === "upi" ? "#6C63FF" : "#E8E8F0",
                          background: activeTab === "upi" ? "#F8F8FF" : "#FFFFFF"
                        }}
                      >
                        <div>
                          <p className="text-[14px] font-semibold text-[#1A1A2E]">UPI</p>
                          <span className="mt-1 inline-flex rounded-full bg-[#EEF6EE] px-2 py-1 text-[11px] font-semibold text-[#2E7D32]">5 apps available</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {UPI_APPS.map((app) => (
                            <span
                              key={app.name}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold"
                              style={{ backgroundColor: app.color, color: app.textColor }}
                            >
                              {app.badge}
                            </span>
                          ))}
                        </div>
                      </button>

                      {[
                        { key: "cards", label: "Cards" },
                        { key: "netbanking", label: "Netbanking" }
                      ].map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between rounded-[14px] border border-[#E8E8F0] bg-[#FAFAFA] px-4 py-4 opacity-60"
                        >
                          <div>
                            <p className="text-[14px] font-semibold text-[#1A1A2E]">{item.label}</p>
                            <span className="mt-1 inline-flex rounded-full bg-[#FFF3E0] px-2 py-1 text-[11px] font-semibold text-[#E65100]">Coming Soon</span>
                          </div>
                          <Sparkles className="h-4 w-4 text-[#E65100]" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {activeTab === "upi" && !submitted ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#66667E]">UPI QR</p>
                        <div
                          className="flex items-center gap-1 text-[13px] font-semibold"
                          style={{ color: qrTimer < 60 ? "#E53935" : "#6C63FF" }}
                        >
                          <Clock3 className="h-4 w-4" />
                          {formatTimer(qrTimer)}
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-[#E8E8F0] p-5">
                        <div className="flex flex-col gap-5 md:flex-row md:items-center">
                          <div className="relative flex h-[160px] w-[160px] items-center justify-center overflow-hidden rounded-[16px] border border-[#E8E8F0] bg-[#F8F8FF]">
                            {upiQrUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={upiQrUrl} alt="ReachIQ UPI QR" className="h-full w-full object-contain" />
                            ) : (
                              <div className="space-y-3 text-center">
                                <div className="mx-auto h-12 w-12 rounded-[12px] border border-dashed border-[#A5A5BA]" />
                                <p className="text-[11px] text-[#8A8AA1]">
                                  {settingsLoaded ? "ReachIQ could not generate a live payment QR for this plan yet." : "Loading live payment QR..."}
                                </p>
                              </div>
                            )}

                            {qrTimer === 0 ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90">
                                <Clock3 className="h-8 w-8 text-[#6C63FF]" />
                                <button
                                  type="button"
                                  onClick={refreshQr}
                                  className="rounded-[10px] bg-[#6C63FF] px-3 py-2 text-[11px] font-semibold text-white"
                                >
                                  Refresh QR
                                </button>
                              </div>
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold text-[#1A1A2E]">Scan the QR with any UPI app</p>
                            <p className="mt-2 text-[12px] leading-6 text-[#7D7D96]">
                              Complete the payment in your preferred app, then paste the transaction ID below so the ReachIQ team can verify and activate the plan.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-3">
                              {UPI_APPS.map((app) => (
                                <div key={app.name} className="flex flex-col items-center gap-1">
                                  <div
                                    className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[14px] font-bold"
                                    style={{ backgroundColor: app.color, color: app.textColor }}
                                  >
                                    {app.badge}
                                  </div>
                                  <span className="text-[10px] text-[#8A8AA1]">{app.name}</span>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4">
                              <button
                                type="button"
                                onClick={openUpiApp}
                                disabled={!upiIntentUrl || !paymentsEnabled}
                                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,#6C63FF_0%,#4B44CC_100%)] px-4 py-2.5 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#C8C8D8]"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                                Pay {formatInr(config.price)} in UPI app
                              </button>
                              <p className="mt-2 text-[11px] text-[#8A8AA1]">
                                ReachIQ pre-fills the exact {formatInr(config.price)} amount for the {config.label}.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-3 border-t border-[#F0F0F5] pt-4 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-[#9898B8]">UPI ID</p>
                            <p className="mt-1 truncate font-mono text-[14px] font-semibold text-[#1A1A2E]">{upiId}</p>
                          </div>
                          <button
                            type="button"
                            onClick={copyUpi}
                            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#6C63FF] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#4B44CC]"
                          >
                            <Copy className="h-4 w-4" />
                            {copied ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[13px] font-medium text-[#55556A]">After paying, enter your Transaction ID</p>
                        <p className="text-[12px] text-[#9898B8]">Open your UPI app payment history and paste the UTR or transaction reference number here.</p>
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(event) => setTransactionId(event.target.value)}
                          placeholder="e.g. 411234567890"
                          className="w-full rounded-[12px] border border-[#E0E0FF] bg-[#FAFAFF] px-4 py-3 font-mono text-[14px] text-[#1A1A2E] outline-none transition placeholder:text-[#A5A5BA] focus:border-[#6C63FF]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || !transactionId.trim() || !paymentsEnabled || !settingsLoaded}
                        className="w-full rounded-[14px] px-4 py-3.5 text-[15px] font-bold text-white transition disabled:cursor-not-allowed disabled:bg-[#C8C8D8]"
                        style={{
                          background:
                            loading || !transactionId.trim() || !paymentsEnabled
                              ? "#C8C8D8"
                              : "linear-gradient(135deg, #6C63FF 0%, #4B44CC 100%)"
                        }}
                      >
                        {loading ? "Submitting..." : `Pay ${formatInr(config.price)} - I've Sent the Money`}
                      </button>
                    </div>
                  ) : null}

                  {submitted ? (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center px-2 py-8 text-center"
                    >
                      <CheckCircle2 className="h-16 w-16 text-[#00D9A6]" />
                      <h3 className="mt-5 text-[22px] font-semibold text-[#1A1A2E]">Payment Submitted</h3>
                      <p className="mt-2 max-w-[420px] text-[14px] leading-7 text-[#55556A]">
                        We&apos;ve logged your payment request for manual review. ReachIQ will verify the transaction and activate your plan as soon as it is approved.
                      </p>
                      <p className="mt-3 text-[13px] text-[#7D7D96]">
                        Confirmation will be tied to <span className="font-medium text-[#1A1A2E]">{userEmail || "your account email"}</span>.
                      </p>
                      <button
                        type="button"
                        onClick={onClose}
                        className="mt-6 rounded-[12px] bg-[linear-gradient(135deg,#6C63FF_0%,#4B44CC_100%)] px-6 py-3 text-[14px] font-semibold text-white"
                      >
                        Back to pricing
                      </button>
                    </motion.div>
                  ) : null}
                </div>

                <div className="border-t border-[#F0F0F5] px-5 py-4 text-center sm:px-7">
                  <p className="text-[11px] text-[#9898B8]">
                    By proceeding, you agree to ReachIQ&apos;s <a href="/terms" className="text-[#6C63FF]">Terms of Service</a> /{" "}
                    <a href="/privacy" className="text-[#6C63FF]">Privacy Policy</a>
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
