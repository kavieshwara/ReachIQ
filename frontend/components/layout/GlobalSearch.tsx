"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/useUIStore";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  type: "lead" | "campaign";
};

type SearchResponse = {
  query: string;
  leads: SearchItem[];
  campaigns: SearchItem[];
};

export function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>({ query: "", leads: [], campaigns: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const { searchOpen, setSearchOpen, closePanels } = useUIStore();

  const flattenedResults = useMemo(
    () => [
      ...results.leads.map((item) => ({ ...item, group: "Leads" })),
      ...results.campaigns.map((item) => ({ ...item, group: "Campaigns" }))
    ],
    [results.campaigns, results.leads]
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults({ query: "", leads: [], campaigns: [] });
      setLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/api/search", { params: { q: query } });
        setResults(data);
        setActiveIndex(0);
      } catch {
        setResults({ query, leads: [], campaigns: [] });
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closePanels();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [closePanels]);

  const open = searchOpen && (query.trim().length > 0 || loading);

  const handleSelect = (item: SearchItem) => {
    closePanels();
    setQuery("");
    router.push(item.href);
  };

  return (
    <div className="relative hidden min-w-[320px] md:block" ref={containerRef}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-textSecondary transition",
          searchOpen && "border-primary/30 bg-white/[0.06] shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
        )}
      >
        <Search className="h-4 w-4 text-primary" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (!open || !flattenedResults.length) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % flattenedResults.length);
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + flattenedResults.length) % flattenedResults.length);
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const target = flattenedResults[activeIndex];
              if (target) {
                handleSelect(target);
              }
            }

            if (event.key === "Escape") {
              closePanels();
            }
          }}
          className="w-full bg-transparent text-textPrimary outline-none placeholder:text-textSecondary"
          placeholder="Search leads and campaigns"
        />
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-textSecondary" /> : null}
      </div>

      {open ? (
        <div className="glass-panel absolute right-0 top-[calc(100%+0.75rem)] z-30 w-full overflow-hidden rounded-[24px] border border-white/10 bg-surface/95 p-2 shadow-[0_32px_80px_rgba(0,0,0,0.4)]">
          {!flattenedResults.length && !loading ? (
            <div className="rounded-2xl px-4 py-6 text-center text-sm text-textSecondary">
              No leads or campaigns matched “{query}”.
            </div>
          ) : null}

          {[
            { label: "Leads", items: results.leads },
            { label: "Campaigns", items: results.campaigns }
          ].map((group) =>
            group.items.length ? (
              <div key={group.label} className="mb-1 last:mb-0">
                <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-textMuted">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const index = flattenedResults.findIndex((entry) => entry.id === item.id && entry.type === item.type);
                    const active = index === activeIndex;

                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        className={cn(
                          "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition",
                          active ? "bg-primary/12 text-textPrimary" : "hover:bg-white/[0.05]"
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => handleSelect(item)}
                      >
                        <div>
                          <p className="text-sm font-medium text-textPrimary">{item.title}</p>
                          <p className="text-xs text-textSecondary">{item.subtitle || "Open result"}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-textMuted" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}
