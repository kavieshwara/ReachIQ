"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCcw, Search, ShieldCheck, Trash2, UserCog, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

type AdminUser = {
  id: string;
  full_name?: string | null;
  email: string;
  plan: string;
  role: string;
  messages_sent_today: number;
  messages_limit: number;
  bonus_messages: number;
  whatsapp_connected: boolean;
  created_at?: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const loadUsers = async (nextPage = page) => {
    setLoading(true);
    try {
      const response = await api.get("/api/admin/users", {
        params: {
          page: nextPage,
          pageSize: 10,
          search: search || undefined,
          plan: planFilter !== "all" ? planFilter : undefined,
          role: roleFilter !== "all" ? roleFilter : undefined
        }
      });
      setUsers(response.data.data || []);
      setPagination(response.data.pagination || null);
      setPage(nextPage);
    } catch {
      toast.error("Could not load admin users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers(1);
  }, [search, planFilter, roleFilter]);

  const patchUser = async (userId: string, payload: Partial<AdminUser>) => {
    await api.patch(`/api/admin/users/${userId}`, payload);
    await loadUsers(page);
  };

  const usageSummary = useMemo(() => {
    return {
      total: pagination?.total || users.length,
      premium: users.filter((user) => user.plan === "premium").length,
      connected: users.filter((user) => user.whatsapp_connected).length
    };
  }, [pagination?.total, users]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Accounts"
        title="User management"
        description="Review account health, promote plans, and reset usage without leaving the operations console."
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Accounts in view", value: usageSummary.total },
              { label: "Premium users", value: usageSummary.premium },
              { label: "WhatsApp connected", value: usageSummary.connected }
            ].map((item) => (
              <div key={item.label} className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-sm text-textSecondary">{item.label}</p>
                <p className="mt-3 text-2xl font-semibold text-textPrimary">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.5fr,0.7fr,0.7fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
              <Input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                className="pl-10"
                placeholder="Search by name or email"
              />
            </div>
            <select
              value={planFilter}
              onChange={(event) => {
                setPage(1);
                setPlanFilter(event.target.value);
              }}
              className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-textPrimary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
            <select
              value={roleFilter}
              onChange={(event) => {
                setPage(1);
                setRoleFilter(event.target.value);
              }}
              className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-textPrimary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white/8">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/8 bg-white/[0.03] text-left text-textSecondary">
                <tr>
                  <th className="px-5 py-4 font-medium">User</th>
                  <th className="px-5 py-4 font-medium">Plan</th>
                  <th className="px-5 py-4 font-medium">Role</th>
                  <th className="px-5 py-4 font-medium">Daily usage</th>
                  <th className="px-5 py-4 font-medium">WhatsApp</th>
                  <th className="px-5 py-4 font-medium">Joined</th>
                  <th className="px-5 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-b border-white/6">
                      <td className="px-5 py-4" colSpan={7}>
                        <Skeleton className="h-12" />
                      </td>
                    </tr>
                  ))
                ) : users.length ? (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-white/6 last:border-none">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-textPrimary">{user.full_name || "Unnamed user"}</p>
                          <p className="text-textSecondary">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4"><PlanBadge plan={user.plan} /></td>
                      <td className="px-5 py-4">
                        <Badge variant={user.role === "admin" ? "warning" : "muted"}>{user.role}</Badge>
                      </td>
                      <td className="px-5 py-4 text-textSecondary">
                        {user.messages_sent_today} / {user.messages_limit + (user.bonus_messages || 0)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={user.whatsapp_connected ? "success" : "muted"}>
                          {user.whatsapp_connected ? "Connected" : "Not connected"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-textSecondary">{formatDate(user.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            className="h-10 px-3"
                            onClick={async () => {
                              try {
                                await patchUser(user.id, { plan: user.plan === "premium" ? "free" : "premium" });
                                toast.success("User plan updated");
                              } catch {
                                toast.error("Could not update plan");
                              }
                            }}
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            {user.plan === "premium" ? "Set free" : "Upgrade"}
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-10 px-3"
                            onClick={async () => {
                              try {
                                await patchUser(user.id, { role: user.role === "admin" ? "user" : "admin" });
                                toast.success("User role updated");
                              } catch {
                                toast.error("Could not update role");
                              }
                            }}
                          >
                            <UserRoundCog className="mr-2 h-4 w-4" />
                            {user.role === "admin" ? "Make user" : "Make admin"}
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-10 px-3"
                            onClick={async () => {
                              try {
                                await patchUser(user.id, { messages_sent_today: 0 });
                                toast.success("Daily message usage reset");
                              } catch {
                                toast.error("Could not reset daily usage");
                              }
                            }}
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Reset
                          </Button>
                          <Button
                            variant="danger"
                            className="h-10 px-3"
                            onClick={async () => {
                              const confirmed = window.confirm(`Delete ${user.email}? This removes both the profile and auth account.`);
                              if (!confirmed) return;
                              try {
                                await api.delete(`/api/admin/users/${user.id}`);
                                toast.success("User deleted");
                                await loadUsers(page);
                              } catch {
                                toast.error("Could not delete user");
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-16 text-center text-textSecondary" colSpan={7}>
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-primary">
                          <UserCog className="h-5 w-5" />
                        </div>
                        <p className="text-base font-medium text-textPrimary">No users yet</p>
                        <p className="text-sm leading-6 text-textSecondary">User accounts will appear here after the first real signups land in Supabase.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls pagination={pagination} onChange={(nextPage) => void loadUsers(nextPage)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
