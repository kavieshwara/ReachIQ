"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useUIStore } from "@/store/useUIStore";
import { useUserStore } from "@/store/useUserStore";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  metadata?: { href?: string };
  created_at: string;
};

export function NotificationsDropdown() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const autoMarkTimerRef = useRef<number | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [hiddenUnreadIds, setHiddenUnreadIds] = useState<string[]>([]);
  const { notificationsOpen, setNotificationsOpen, closePanels } = useUIStore();
  const profile = useUserStore((state) => state.profile);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/notifications");
      const nextItems = data || [];
      setItems(nextItems);
      setHiddenUnreadIds((current) =>
        current.filter((id) => nextItems.some((item: NotificationItem) => item.id === id && !item.read))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const hideUnreadLocally = useCallback(() => {
    setHiddenUnreadIds((current) => {
      const next = new Set(current);
      items.forEach((item) => {
        if (!item.read) {
          next.add(item.id);
        }
      });
      return Array.from(next);
    });
  }, [items]);

  useEffect(() => {
    if (!profile?.id) {
      return;
    }

    loadNotifications().catch(() => null);

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`
        },
        () => {
          void loadNotifications();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [setNotificationsOpen]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read && !hiddenUnreadIds.includes(item.id)).length,
    [hiddenUnreadIds, items]
  );

  const markAllRead = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      setMarkingAll(true);
      hideUnreadLocally();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      await api.patch("/api/notifications/read-all");
      await loadNotifications();
      if (!silent) {
        toast.success("All notifications marked as read");
      }
    } catch (error: any) {
      setHiddenUnreadIds([]);
      await loadNotifications().catch(() => null);
      if (!silent) {
        toast.error(error?.response?.data?.error || "Notifications could not be updated right now.");
      }
    } finally {
      setMarkingAll(false);
    }
  };

  const markRead = async (id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setHiddenUnreadIds((current) => current.filter((itemId) => itemId !== id));
    await api.patch(`/api/notifications/${id}/read`);
  };

  useEffect(() => {
    if (autoMarkTimerRef.current) {
      window.clearTimeout(autoMarkTimerRef.current);
      autoMarkTimerRef.current = null;
    }

    if (!notificationsOpen || !unreadCount) {
      return;
    }

    hideUnreadLocally();
    autoMarkTimerRef.current = window.setTimeout(() => {
      void markAllRead({ silent: true });
    }, 300);

    return () => {
      if (autoMarkTimerRef.current) {
        window.clearTimeout(autoMarkTimerRef.current);
        autoMarkTimerRef.current = null;
      }
    };
  }, [hideUnreadLocally, notificationsOpen, unreadCount]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="glass-panel relative rounded-2xl border border-white/8 p-2.5 text-textSecondary transition hover:border-primary/30 hover:text-textPrimary"
        onClick={() => {
          if (!notificationsOpen && unreadCount) {
            hideUnreadLocally();
          }
          setNotificationsOpen(!notificationsOpen);
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {notificationsOpen ? (
        <div className="fixed inset-x-3 top-[4.75rem] z-[70] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.75rem)] sm:w-[360px]">
          <div className="rounded-[24px] border border-white/12 bg-[#171723] p-3 shadow-[0_32px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div className="mb-3 flex items-start justify-between gap-3 px-2">
            <div>
              <p className="text-sm font-semibold text-textPrimary">Notifications</p>
              <p className="text-xs text-textSecondary">Campaign updates, sends, and support activity.</p>
            </div>
            <button
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/8 px-2.5 py-1 text-xs text-textSecondary transition hover:border-primary/30 hover:text-textPrimary disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => markAllRead().catch(() => null)}
              disabled={markingAll || !unreadCount}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {markingAll ? "Updating..." : "Mark all"}
            </button>
          </div>

          <div className="scrollbar-thin max-h-[min(70vh,420px)] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-2xl bg-white/[0.04] px-4 py-8 text-center text-sm text-textSecondary">
                Loading notifications...
              </div>
            ) : null}

            {!loading && !items.length ? (
              <div className="rounded-2xl bg-white/[0.04] px-4 py-8 text-center text-sm text-textSecondary">
                You're all caught up. Fresh campaign events will land here in real time.
              </div>
            ) : null}

            {items.map((item) => {
              const classes = cn(
                "block rounded-2xl border px-4 py-3 text-left transition",
                item.read
                  ? "border-white/6 bg-white/[0.03] hover:border-white/10"
                  : "border-primary/20 bg-primary/10 hover:border-primary/35"
              );

              if (item.metadata?.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.metadata.href}
                    className={classes}
                    onClick={async () => {
                      await markRead(item.id).catch(() => null);
                      closePanels();
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-textPrimary">{item.title}</p>
                      <span className="text-[11px] text-textMuted">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="text-sm text-textSecondary">{item.body}</p>
                  </Link>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  className={classes}
                  onClick={async () => {
                    await markRead(item.id).catch(() => null);
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-textPrimary">{item.title}</p>
                    <span className="text-[11px] text-textMuted">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm text-textSecondary">{item.body}</p>
                </button>
              );
            })}
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}
