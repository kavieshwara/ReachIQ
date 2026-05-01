"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, CreditCard, IndianRupee, RefreshCcw, WalletCards, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type PaymentSubmission = {
  id: string;
  user_id?: string | null;
  plan: string;
  amount?: number | string | null;
  upi_transaction_id: string;
  status: "pending" | "approved" | "rejected" | string;
  review_notes?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
  };
  user_profile?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type QueueSummary = {
  pending: number;
  approved: number;
  rejected: number;
  totalAmount?: number;
};

type EndpointResult<T> = {
  path: string;
  response: { data: T };
};

const listEndpointCandidates = [
  "/api/admin/payments/submissions",
  "/api/admin/payments",
  "/api/admin/revenue/submissions"
];

async function requestFirstSuccess<T>(paths: string[], config?: Record<string, unknown>): Promise<EndpointResult<T>> {
  let lastError: any = null;

  for (const path of paths) {
    try {
      const response = await api.get<T>(path, config);
      return { path, response };
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404 || status === 405 || status === 501) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("Manual payment review endpoints are not available yet.");
}

async function runReviewMutation(
  submissionId: string,
  action: "approve" | "reject",
  reviewNotes: string
) {
  const candidates =
    action === "approve"
      ? [
          () => api.post(`/api/admin/payments/submissions/${submissionId}/approve`, { review_notes: reviewNotes }),
          () => api.post(`/api/admin/payments/${submissionId}/approve`, { review_notes: reviewNotes }),
          () => api.patch(`/api/admin/payments/submissions/${submissionId}`, { status: "approved", review_notes: reviewNotes }),
          () => api.patch(`/api/admin/payments/${submissionId}`, { status: "approved", review_notes: reviewNotes })
        ]
      : [
          () => api.post(`/api/admin/payments/submissions/${submissionId}/reject`, { review_notes: reviewNotes }),
          () => api.post(`/api/admin/payments/${submissionId}/reject`, { review_notes: reviewNotes }),
          () => api.patch(`/api/admin/payments/submissions/${submissionId}`, { status: "rejected", review_notes: reviewNotes }),
          () => api.patch(`/api/admin/payments/${submissionId}`, { status: "rejected", review_notes: reviewNotes })
        ];

  let lastError: any = null;

  for (const attempt of candidates) {
    try {
      return await attempt();
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 404 || status === 405 || status === 501) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("Manual payment review actions are not available yet.");
}

function normalizeResponse(payload: any) {
  if (Array.isArray(payload)) {
    return {
      data: payload as PaymentSubmission[],
      pagination: null as Pagination | null,
      summary: null as QueueSummary | null
    };
  }

  return {
    data: (payload?.data || payload?.submissions || []) as PaymentSubmission[],
    pagination: (payload?.pagination || null) as Pagination | null,
    summary: (payload?.summary || null) as QueueSummary | null
  };
}

function formatPlanLabel(plan: string) {
  const normalized = String(plan || "").toLowerCase();
  if (normalized === "starter") return "Starter";
  if (normalized === "pro") return "Pro";
  if (normalized === "premium") return "Premium";
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Unknown";
}

function formatAmount(amount: number | string | null | undefined, plan: string) {
  const parsed = Number(amount);
  const fallback = String(plan).toLowerCase() === "pro" ? 999 : 499;
  const finalAmount = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(finalAmount);
}

function getSubmissionProfile(submission: PaymentSubmission) {
  return submission.user_profile || submission.profiles || null;
}

export default function AdminRevenuePage() {
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [summary, setSummary] = useState<QueueSummary>({ pending: 0, approved: 0, rejected: 0, totalAmount: 0 });

  const loadQueue = async (page = 1, nextFilter = filter) => {
    const shouldShowMainLoader = submissions.length === 0 && !refreshing;
    if (shouldShowMainLoader) setLoading(true);
    setRefreshing(true);
    setErrorState(null);

    try {
      const [settingsResponse, queueResult] = await Promise.all([
        api.get("/api/admin/settings").catch(() => null),
        requestFirstSuccess<any>(listEndpointCandidates, {
          params: {
            page,
            pageSize: 8,
            status: nextFilter !== "all" ? nextFilter : undefined
          }
        })
      ]);

      const nextSettings = Object.fromEntries(((settingsResponse?.data?.settings || []) as any[]).map((item) => [item.key, item.value]));
      setPaymentsEnabled(nextSettings.payments_enabled === "true");

      const normalized = normalizeResponse(queueResult.response.data);
      setSubmissions(normalized.data);
      setPagination(normalized.pagination);
      setSummary(
        normalized.summary || {
          pending: normalized.data.filter((item) => item.status === "pending").length,
          approved: normalized.data.filter((item) => item.status === "approved").length,
          rejected: normalized.data.filter((item) => item.status === "rejected").length,
          totalAmount: normalized.data.reduce((acc, item) => acc + Number(item.amount || 0), 0)
        }
      );
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        status === 401
          ? "ReachIQ could not verify your admin session for the payment queue. Refresh the page or sign in again, then retry."
          : status === 403
            ? "This account does not currently have permission to open the payment review queue."
            : status === 404 || status === 501
              ? "The manual payment review API is not available yet. The frontend is ready and waiting for the backend review endpoints."
              : error?.response?.data?.error || "Could not load the manual payment review queue.";
      setErrorState(message);
      if (!submissions.length) {
        setSubmissions([]);
        setPagination(null);
      }
      setSummary({ pending: 0, approved: 0, rejected: 0, totalAmount: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadQueue(1, filter);
  }, [filter]);

  const visibleCount = useMemo(() => submissions.length, [submissions]);

  const reviewSubmission = async (submissionId: string, action: "approve" | "reject") => {
    setBusyId(submissionId);
    try {
      await runReviewMutation(submissionId, action, reviewNotes[submissionId] || "");
      toast.success(action === "approve" ? "Payment approved" : "Payment rejected");
      await loadQueue(pagination?.page || 1, filter);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || `Could not ${action} this payment submission`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payments"
        title="Manual payment review"
        description="Review incoming UPI transaction IDs, approve valid upgrades, and reject anything that needs a second look."
        actions={
          <Button variant="secondary" onClick={() => void loadQueue(pagination?.page || 1, filter)} disabled={refreshing}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {refreshing ? "Refreshing..." : "Refresh queue"}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Pending review", value: summary.pending, icon: WalletCards, variant: "warning" as const },
          { label: "Approved", value: summary.approved, icon: CheckCircle2, variant: "success" as const },
          { label: "Rejected", value: summary.rejected, icon: XCircle, variant: "danger" as const },
          { label: "Rows in view", value: visibleCount, icon: IndianRupee, variant: "default" as const }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-textSecondary">{item.label}</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold text-textPrimary">{item.value}</p>
                <Badge variant={item.variant}>{item.label}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium text-textPrimary">Review queue controls</p>
              <p className="text-sm text-textSecondary">Filter the queue by review state and process upgrades in the order they came in.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={paymentsEnabled ? "success" : "warning"}>
                {paymentsEnabled ? "Payments enabled" : "Payments disabled"}
              </Badge>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-textPrimary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="pending">Pending only</option>
                <option value="approved">Approved only</option>
                <option value="rejected">Rejected only</option>
                <option value="all">All submissions</option>
              </select>
            </div>
          </div>

          {!paymentsEnabled ? (
            <div className="flex items-start gap-3 rounded-[22px] border border-warning/20 bg-warning/10 p-4 text-sm text-textSecondary">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                Payments are currently turned off in admin settings. Users will still be blocked from accessing checkout until you enable the
                `payments_enabled` flag.
              </p>
            </div>
          ) : null}

          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="space-y-4 p-5">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-24" />
                </CardContent>
              </Card>
            ))
          ) : errorState ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/12 text-danger">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <p className="text-base font-medium text-textPrimary">Queue not available yet</p>
                <p className="max-w-2xl text-sm leading-6 text-textSecondary">{errorState}</p>
              </CardContent>
            </Card>
          ) : submissions.length ? (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <Card key={submission.id}>
                  <CardContent className="space-y-4 p-5">
                    {(() => {
                      const profile = getSubmissionProfile(submission);
                      return (
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-semibold text-textPrimary">
                            {profile?.full_name || profile?.email || "Unknown user"}
                          </p>
                          <Badge
                            variant={
                              submission.status === "approved"
                                ? "success"
                                : submission.status === "rejected"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {submission.status}
                          </Badge>
                          <Badge variant="default">{formatPlanLabel(submission.plan)}</Badge>
                        </div>
                        <p className="text-sm text-textSecondary">
                          {profile?.email || "No email available"} • {formatDate(submission.created_at)}
                        </p>
                      </div>

                      <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-3 text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Claimed amount</p>
                        <p className="mt-2 text-xl font-semibold text-textPrimary">{formatAmount(submission.amount, submission.plan)}</p>
                      </div>
                    </div>
                      );
                    })()}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-textMuted">UPI transaction ID</p>
                        <p className="mt-2 font-mono text-sm text-textPrimary">{submission.upi_transaction_id || "Not provided"}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-textMuted">Existing review note</p>
                        <p className="mt-2 text-sm leading-6 text-textSecondary">
                          {submission.review_notes || "No note has been attached yet."}
                        </p>
                      </div>
                    </div>

                    <Textarea
                      placeholder="Add an internal note before approving or rejecting this payment"
                      value={reviewNotes[submission.id] ?? submission.review_notes ?? ""}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [submission.id]: event.target.value
                        }))
                      }
                    />

                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => void reviewSubmission(submission.id, "approve")}
                        disabled={busyId === submission.id || submission.status === "approved"}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {busyId === submission.id ? "Processing..." : "Approve upgrade"}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void reviewSubmission(submission.id, "reject")}
                        disabled={busyId === submission.id || submission.status === "rejected"}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject payment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <p className="text-base font-medium text-textPrimary">No manual payments in this view</p>
                  <p className="text-sm leading-6 text-textSecondary">
                    New UPI submissions will appear here once users submit a transaction ID from the checkout modal.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <PaginationControls pagination={pagination} onChange={(nextPage) => void loadQueue(nextPage, filter)} />
      </Card>
    </div>
  );
}
