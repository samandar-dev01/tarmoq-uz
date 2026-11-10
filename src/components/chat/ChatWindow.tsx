"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export type ChatMessage = { id: string; senderId: string; body: string; createdAt: string };

const POLL_MS = 5000;

export function ChatWindow({ conversationId, meId, initialMessages }: { conversationId: string; meId: string; initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const lastId = useRef<string | undefined>(initialMessages.at(-1)?.id);
  const bottom = useRef<HTMLDivElement>(null);

  const append = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      lastId.current = merged.at(-1)?.id;
      return merged;
    });
  }, []);

  useEffect(() => {
    const tick = async () => {
      if (document.hidden) return;
      try {
        const q = lastId.current ? `?after=${encodeURIComponent(lastId.current)}` : "";
        const res = await fetch(`/api/conversations/${conversationId}/messages${q}`, { cache: "no-store" });
        if (!res.ok) throw new Error("poll failed");
        append((await res.json()).messages);
        setPollError(false);
      } catch {
        setPollError(true);
      }
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [conversationId, append]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.fieldErrors?.body?.[0] ?? json.error ?? "Could not send your message.");
        return;
      }
      append([json.message]);
      setText("");
    } catch {
      setError("Network error. Your message was not sent.");
    } finally {
      setSending(false);
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No messages yet. Say hello!</p>}
        {messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900"}`}>
                {m.body}
                <div className={`mt-1 text-[10px] ${mine ? "text-indigo-200" : "text-slate-400"}`}>
                  {new Date(m.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {pollError && <div className="px-4 pb-2"><Alert variant="info">Connection problem. Retrying…</Alert></div>}
      {error && <div className="px-4 pb-2"><Alert variant="error">{error}</Alert></div>}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 p-3">
        <textarea
          aria-label="Message"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Write a message (Enter to send, Shift+Enter for a new line)"
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Button type="submit" loading={sending} disabled={!text.trim()}>Send</Button>
      </form>
    </div>
  );
}
