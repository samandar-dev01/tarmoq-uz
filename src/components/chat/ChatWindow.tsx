"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { formatMoment } from "@/lib/format";

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
        setError(json.fieldErrors?.body?.[0] ?? json.error ?? "Xabarni yuborib boʻlmadi.");
        return;
      }
      append([json.message]);
      setText("");
    } catch {
      setError("Internet aloqasida muammo. Xabaringiz yuborilmadi.");
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
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-card border-2 border-ink bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto bg-paper p-4" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-ink-soft">Hali xabarlar yoʻq. Salom yozing!</p>}
        {messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl border-2 border-ink px-4 py-2.5 ${
                  mine ? "rounded-br-md bg-cobalt text-white" : "rounded-bl-md bg-white text-ink"
                }`}
              >
                {m.body}
                <div className={`mt-1 text-xs ${mine ? "text-white/70" : "text-ink-mute"}`}>{formatMoment(new Date(m.createdAt))}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {pollError && <div className="border-t-2 border-ink px-4 py-2"><Alert variant="info">Aloqa muammosi. Qayta uriniladi…</Alert></div>}
      {error && <div className="border-t-2 border-ink px-4 py-2"><Alert variant="error">{error}</Alert></div>}
      <form onSubmit={send} className="flex items-end gap-3 border-t-2 border-ink bg-white p-3">
        <div className="flex-1">
          <Field
            as="textarea"
            hideLabel
            label="Xabar"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            placeholder="Xabar yozing (Enter: yuborish, Shift+Enter: yangi qator)"
            className="resize-none"
          />
        </div>
        <Button type="submit" loading={sending} disabled={!text.trim()}>Yuborish</Button>
      </form>
    </div>
  );
}
