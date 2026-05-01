"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

const starters = [
  "Help me write a pitch for dental clinics",
  "How many follow-ups should I send?",
  "What niche should I target in Mumbai?"
];

export function AIChatBox() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get("/api/chat/history");
    setMessages(data || []);
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const send = async (text = input) => {
    if (!text.trim()) return;
    try {
      setLoading(true);
      const { data } = await api.post("/api/chat/message", { message: text });
      setMessages((current) => [
        ...current,
        { role: "user", content: text, id: `${Date.now()}-user` },
        { role: "assistant", content: data.reply, id: `${Date.now()}-assistant` }
      ]);
      setInput("");
    } catch {
      toast.error("AI assistant is unavailable right now");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[280px,1fr]">
      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-textSecondary">Starter prompts</p>
          {starters.map((prompt) => (
            <button key={prompt} className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-left text-sm text-textSecondary transition hover:border-primary/40 hover:text-textPrimary" onClick={() => send(prompt)}>
              {prompt}
            </button>
          ))}
          <Button variant="secondary" className="w-full" onClick={async () => {
            await api.delete("/api/chat/history");
            setMessages([]);
          }}>
            New chat
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex h-[70vh] flex-col gap-4">
          <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto">
            {messages.map((message, index) => (
              <div key={message.id || index} className={message.role === "assistant" ? "mr-10 rounded-2xl bg-surface2 p-4" : "ml-10 rounded-2xl bg-primary/15 p-4"}>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-textMuted">{message.role}</p>
                <div className="prose prose-invert max-w-none text-sm">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading ? <div className="rounded-2xl bg-surface2 p-4 text-sm text-textSecondary">ReachIQ Assistant is thinking...</div> : null}
          </div>
          <div className="space-y-3">
            <Textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask ReachIQ Assistant anything about lead generation or outreach..." />
            <div className="flex justify-end">
              <Button onClick={() => send()} disabled={loading}>
                Send message
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
