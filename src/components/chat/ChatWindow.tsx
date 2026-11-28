"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useLocale, useT } from "@/i18n/client";
import { formatMoment } from "@/lib/format";

export type ChatMessage = { id: string; senderId: string; body: string; createdAt: string };
/** The other person right now: whether they are around, whether they are typing, and the last of my messages they opened. */
export type ChatStatus = { online: boolean; lastSeenAt: string | null; typing: boolean; seenId: string | null };

const POLL_MS = 5000;
/** "I am typing" is said at most this often. */
const TYPING_EVERY_MS = 3000;

export function ChatWindow({ conversationId, meId, initialMessages, initialStatus }: { conversationId: string; meId: string; initialMessages: ChatMessage[]; initialStatus: ChatStatus }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const typedAt = useRef(0);
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
        const data = await res.json();
        append(data.messages);
        // Something new from the other side may carry an offer: the page above the chat is drawn again.
        if ((data.messages as ChatMessage[]).some((m) => m.senderId !== meId)) router.refresh();
        setStatus({ online: data.presence.online, lastSeenAt: data.presence.lastSeenAt, typing: data.typing, seenId: data.seenId });
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
  }, [conversationId, append, meId, router]);

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
        setError(json.fieldErrors?.body?.[0] ?? json.error ?? t("Xabarni yuborib boʻlmadi."));
        return;
      }
      append([json.message]);
      // Only what was sent is cleared: whatever has been typed since (the answer can be slow) stays in the field.
      setText((current) => (current.trim() === body ? "" : current));
    } catch {
      setError(t("Internet aloqasida muammo. Xabaringiz yuborilmadi."));
    } finally {
      setSending(false);
    }
  }

  const type = (value: string) => {
    setText(value);
    if (!value.trim() || Date.now() - typedAt.current < TYPING_EVERY_MS) return;
    typedAt.current = Date.now();
    // A courtesy only: when it fails, nothing is lost.
    void fetch(`/api/conversations/${conversationId}/typing`, { method: "POST" }).catch(() => {});
  };

  // "Read" goes under the newest of my messages that the other person has opened.
  const seenIndex = messages.findIndex((m) => m.id === status.seenId);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-card border border-line bg-surface">
      <p className="flex min-h-11 items-center gap-2 border-b border-line px-4 text-sm font-semibold text-ink-soft">
        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${status.online ? "bg-turquoise" : "bg-ink-mute/40"}`} />
        {status.typing ? t("yozmoqda…") : status.online ? t("Onlayn") : status.lastSeenAt ? t("Oxirgi faollik: {when}", { when: formatMoment(new Date(status.lastSeenAt), locale) }) : t("Oflayn")}
      </p>
      <div className="flex-1 space-y-3 overflow-y-auto bg-paper p-4" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-ink-soft">{t("Hali xabarlar yoʻq. Salom yozing!")}</p>}
        {messages.map((m, index) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl border px-4 py-2.5 ${
                  mine ? "rounded-br-md border-on-accent/10 bg-cobalt text-on-accent" : "rounded-bl-md border-line-strong bg-paper-deep text-ink"
                }`}
              >
                <span data-user-content>{m.body}</span>
                <div className={`mt-1 text-xs ${mine ? "text-on-accent" : "text-ink-mute"}`}>
                  {formatMoment(new Date(m.createdAt), locale)}
                  {mine && index === seenIndex && <span className="font-bold"> · {t("Oʻqildi")}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {pollError && <div className="border-t border-line px-4 py-2"><Alert variant="info">{t("Aloqa muammosi. Qayta uriniladi…")}</Alert></div>}
      {error && <div className="border-t border-line px-4 py-2"><Alert variant="error">{error}</Alert></div>}
      <form onSubmit={send} className="flex items-end gap-3 border-t border-line bg-surface p-3">
        <div className="flex-1">
          <Field
            as="textarea"
            hideLabel
            label={t("Xabar")}
            rows={2}
            value={text}
            onChange={(e) => type(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("Xabar yozing (Enter: yuborish, Shift+Enter: yangi qator)")}
            className="resize-none"
          />
        </div>
        <Button type="submit" loading={sending} disabled={!text.trim()}>{t("Yuborish")}</Button>
      </form>
    </div>
  );
}
