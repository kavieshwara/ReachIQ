"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { supportFallbackNumber } from "@/components/pricing/pricing-data";

const officialSupportEmail = "reachIQ.support@gmail.com";

export default function SupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [form, setForm] = useState({ subject: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supportWhatsappHref = `https://wa.me/${supportFallbackNumber}?text=${encodeURIComponent("Hi ReachIQ, I need help with my workspace.")}`;

  const load = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const { data } = await api.get("/api/support");
      setTickets(data || []);
    } catch (error: any) {
      console.error("[ReachIQ][support] failed to load tickets", error);
      setErrorMessage(error?.response?.data?.error || "Support tickets could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
      <Card>
        <CardContent className="space-y-4">
          <p className="text-lg font-semibold text-textPrimary">Submit a ticket</p>
          <Input placeholder="Subject" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
          <Textarea placeholder="How can we help?" value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
          <Button
            onClick={async () => {
              if (!form.subject.trim() || !form.message.trim()) {
                toast.error("Add both a subject and message before submitting.");
                return;
              }

              try {
                setSubmitting(true);
                await api.post("/api/support", form);
                toast.success("Ticket submitted");
                setForm({ subject: "", message: "" });
                await load();
              } catch (error: any) {
                console.error("[ReachIQ][support] failed to submit ticket", error);
                toast.error(error?.response?.data?.error || "Support ticket could not be submitted right now.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Submitting..." : "Submit"}
          </Button>
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-textSecondary">
            Official support email: <span className="text-textPrimary">{officialSupportEmail}</span>. Tickets are also saved inside ReachIQ and forwarded to the active inbox when email delivery is available.
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-textPrimary">Your tickets</p>
            <div className="flex gap-4 text-sm text-primary">
              <Link href="/pricing#faq">FAQ</Link>
              <a href={supportWhatsappHref} target="_blank" rel="noreferrer">WhatsApp Support</a>
            </div>
          </div>
          {errorMessage ? (
            <div className="rounded-2xl border border-danger/30 bg-danger/8 px-4 py-3 text-sm text-textSecondary">
              {errorMessage}
            </div>
          ) : null}
          {loading ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-6 text-sm text-textSecondary">
              Loading your support tickets...
            </div>
          ) : null}
          {!loading && !errorMessage && !tickets.length ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-6 text-sm text-textSecondary">
              No support tickets yet. Start with the form on the left and ReachIQ will keep the thread here for you.
            </div>
          ) : null}
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-xl border border-border bg-surface2 p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-textPrimary">{ticket.subject}</p>
                <span className="text-xs uppercase tracking-[0.2em] text-textMuted">{ticket.status}</span>
              </div>
              <p className="mt-2 text-sm text-textSecondary">{ticket.message}</p>
              {ticket.admin_reply ? <p className="mt-3 rounded-lg bg-primary/8 p-3 text-sm text-primary">{ticket.admin_reply}</p> : null}
              <p className="mt-3 text-xs text-textMuted">{formatDate(ticket.created_at)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
