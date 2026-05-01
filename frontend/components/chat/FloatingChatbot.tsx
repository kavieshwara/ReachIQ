"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, MessageCircle, Minus, SendHorizonal, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useChatbotStore } from "@/store/useChatbotStore";
import { cn } from "@/lib/utils";

const starters = [
  "Write a cold pitch for dental clinics in Bangalore.",
  "How should I structure follow-ups for real estate leads?",
  "Which niche is best to target this month?"
];

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

export function FloatingChatbot() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { open, openWidget, closeWidget, unreadCount, incrementUnread, resetUnread } = useChatbotStore();

  const load = async () => {
    const { data } = await api.get("/api/chat/history");
    setMessages(data || []);
  };

  useEffect(() => {
    if (!open || hydrated) {
      return;
    }

    load()
      .then(() => setHydrated(true))
      .catch(() => null);
  }, [hydrated, open]);

  useEffect(() => {
    if (open) {
      resetUnread();
    }
  }, [open, resetUnread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (message = input) => {
    const text = message.trim();
    if (!text || loading) {
      return;
    }

    setMessages((current) => [...current, { role: "user", content: text, id: `${Date.now()}-user` }]);
    setInput("");
    setLoading(true);

    try {
      const { data } = await api.post("/api/chat/message", { message: text });
      setMessages((current) => [...current, { role: "assistant", content: data.reply, id: `${Date.now()}-assistant` }]);

      if (!open) {
        incrementUnread();
      }
    } catch {
      toast.error("ReachIQ Assistant is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-50 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <div className="pointer-events-auto flex w-[min(380px,calc(100vw-1rem))] max-h-[min(720px,calc(100dvh-8rem-env(safe-area-inset-bottom)))] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-surface/92 shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:max-h-[min(720px,calc(100dvh-3rem))]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-textPrimary">ReachIQ Assistant</p>
                <p className="text-xs text-textSecondary">Strategy, copywriting, and platform help</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded-xl p-2 text-textSecondary transition hover:bg-white/[0.06] hover:text-textPrimary"
                onClick={closeWidget}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                className="rounded-xl p-2 text-textSecondary transition hover:bg-white/[0.06] hover:text-textPrimary"
                onClick={closeWidget}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="border-b border-white/8 px-4 py-3">
            <div className="scrollbar-thin flex gap-2 overflow-x-auto">
              {starters.map((starter) => (
                <button
                  key={starter}
                  className="shrink-0 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-xs text-textSecondary transition hover:border-primary/30 hover:text-textPrimary"
                  onClick={() => send(starter)}
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {!messages.length ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center">
                <Sparkles className="mx-auto mb-3 h-6 w-6 text-primary" />
                <p className="text-sm font-medium text-textPrimary">Ask anything about leads, outreach, or templates.</p>
                <p className="mt-1 text-xs text-textSecondary">I can help with pitch copy, campaign strategy, and what to do next.</p>
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={cn(
                  "max-w-[88%] rounded-[24px] px-4 py-3 text-sm",
                  message.role === "assistant"
                    ? "mr-auto bg-white/[0.05] text-textPrimary"
                    : "ml-auto bg-primary/15 text-textPrimary"
                )}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-invert max-w-none text-sm">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            ))}

            {loading ? (
              <div className="mr-auto rounded-[24px] bg-white/[0.05] px-4 py-3 text-sm text-textSecondary">
                <div className="flex items-center gap-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/8 px-4 py-4">
            <div className="flex items-end gap-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                className="min-h-[72px] max-h-[140px] rounded-[22px]"
                placeholder="Ask ReachIQ Assistant for pitch ideas, follow-up strategy, or product help..."
              />
              <Button className="h-12 w-12 shrink-0 rounded-2xl p-0" onClick={() => send()} disabled={loading}>
                <SendHorizonal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        className="pointer-events-auto relative inline-flex items-center gap-3 rounded-full border border-primary/25 bg-cta-gradient px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(108,99,255,0.35)] transition hover:-translate-y-0.5 hover:scale-[1.01]"
        onClick={open ? closeWidget : openWidget}
      >
        <MessageCircle className="h-4 w-4" />
        ReachIQ Assistant
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-danger px-1 text-xs text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
