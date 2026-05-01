"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply?: string | null;
  created_at: string;
  profiles?: { full_name?: string | null; email?: string | null };
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadTickets = async (page = 1) => {
    setLoading(true);
    try {
      const response = await api.get("/api/admin/tickets", { params: { page, pageSize: 6 } });
      setTickets(response.data.data || []);
      setPagination(response.data.pagination || null);
    } catch {
      toast.error("Could not load support tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Support tickets"
        description="Reply to customer issues, close the loop quickly, and keep the queue visible for the whole team."
      />

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-24" />
              </CardContent>
            </Card>
          ))
        ) : tickets.length ? (
          tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-textPrimary">{ticket.subject}</p>
                      <Badge variant={ticket.status === "closed" ? "success" : ticket.status === "in_progress" ? "warning" : "default"}>
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-textSecondary">
                      {ticket.profiles?.full_name || "Unknown user"} • {ticket.profiles?.email || "No email"} • {formatDate(ticket.created_at)}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-textSecondary">
                  {ticket.message}
                </div>

                {ticket.admin_reply ? (
                  <div className="rounded-[24px] border border-success/20 bg-success/8 p-4 text-sm leading-6 text-textSecondary">
                    <p className="mb-2 font-medium text-success">Last admin reply</p>
                    {ticket.admin_reply}
                  </div>
                ) : null}

                <Textarea
                  placeholder="Write an admin reply"
                  value={reply[ticket.id] || ""}
                  onChange={(event) => setReply((current) => ({ ...current, [ticket.id]: event.target.value }))}
                />

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={async () => {
                      try {
                        await api.patch(`/api/admin/tickets/${ticket.id}`, {
                          admin_reply: reply[ticket.id],
                          status: "closed"
                        });
                        toast.success("Reply sent");
                        await loadTickets(pagination?.page || 1);
                      } catch {
                        toast.error("Could not send reply");
                      }
                    }}
                  >
                    Send reply and close
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await api.patch(`/api/admin/tickets/${ticket.id}`, {
                          admin_reply: reply[ticket.id] || ticket.admin_reply,
                          status: "in_progress"
                        });
                        toast.success("Ticket moved to in progress");
                        await loadTickets(pagination?.page || 1);
                      } catch {
                        toast.error("Could not update ticket");
                      }
                    }}
                  >
                    Mark in progress
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                  <Inbox className="h-5 w-5" />
                </div>
                <p className="text-base font-medium text-textPrimary">No support tickets</p>
                <p className="text-sm leading-6 text-textSecondary">When customers ask for help, the queue will appear here with reply tools and status controls.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Card>
        <PaginationControls pagination={pagination} onChange={(nextPage) => void loadTickets(nextPage)} />
      </Card>
    </div>
  );
}
