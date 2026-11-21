"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/i18n/client";
import { formatMoment } from "@/lib/format";
import { SUPPORT_MAX_CHARS } from "@/lib/support";

export type SupportMsg = { id: string; fromStaff: boolean; body: string; createdAt: string };

/** Every text the thread shows, already in the reader's language: the person's sheet is translated, the admin page is Uzbek. */
export type SupportLabels = { empty: string; field: string; placeholder: string; send: string; notSent: string; offline: string; reconnecting: string };

const POLL_MS = 5000;

/**
 * One conversation with the support team, for either side. The person's own messages are on the right (blue), the other
 * side's on the left, as in a chat between two people. `endpoint` answers GET (the thread, or only what is after ?after=)
 * and POST ({ body }). With `initialMessages` null the thread is loaded when it appears (the sheet does that).
 */
export function SupportThread({ side, endpoint, initialMessages, labels }: { side: "user" | "staff"; endpoint: string; initialMessages: SupportMsg[] | null; labels: SupportLabels }) {
  const locale = useLocale();
  const [messages, setMessages] = useState<SupportMsg[]>(initialMessages ?? []);
  const [loaded, setLoaded] = useState(initialMessages !== null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const lastId = useRef<string | undefined>(initialMessages?.at(-1)?.id);
  const scroller = useRef<HTMLDivElement>(null);

  const append = useCallback((incoming: SupportMsg[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      lastId.current = merged.at(-1)?.id;
      return merged;
    });
  }, []);

  // The first load (the sheet), then a poll while the thread is on screen and the tab is in view.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.hidden && lastId.current !== undefined) return;
      try {
        const q = lastId.current ? `?after=${encodeURIComponent(lastId.current)}` : "";
        const res = await fetch(`${endpoint}${q}`, { cache: "no-store" });
        if (!res.ok) throw new Error("poll failed");
        const data = await res.json();
        if (!alive) return;
        append(data.messages);
        setLoaded(true);
        setPollError(false);
      } catch {
        if (alive) setPollError(true);
      }
    };
    if (initialMessages === null) void tick();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endpoint, append, initialMessages]);

  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length, loaded]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // `error` and field messages come already in the reader's language (the server translates them).
        setError(json.fieldErrors?.body?.[0] ?? json.error ?? labels.notSent);
        return;
      }
      append([json.message]);
      setText("");
    } catch {
      setError(labels.offline);
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-paper p-4" aria-live="polite">
        {!loaded && <div className="flex justify-center py-10 text-ink-soft"><Spinner size={24} /></div>}
        {loaded && messages.length === 0 && <p className="py-10 text-center text-ink-soft">{labels.empty}</p>}
        {messages.map((m) => {
          const mine = (side === "staff") === m.fromStaff;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                data-testid={m.fromStaff ? "support-from-staff" : "support-from-user"}
                className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl border px-4 py-2.5 ${
                  mine ? "rounded-br-md border-on-accent/10 bg-cobalt text-on-accent" : "rounded-bl-md border-line-strong bg-paper-deep text-ink"
                }`}
              >
                <span data-user-content>{m.body}</span>
                <div className={`mt-1 text-xs ${mine ? "text-on-accent" : "text-ink-mute"}`}>{formatMoment(new Date(m.createdAt), locale)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {pollError && <div className="border-t border-line px-4 py-2"><Alert variant="info">{labels.reconnecting}</Alert></div>}
      {error && <div className="border-t border-line px-4 py-2"><Alert variant="error">{error}</Alert></div>}
      <form onSubmit={send} className="flex items-end gap-3 border-t border-line bg-surface p-3">
        <div className="flex-1">
          <Field as="textarea" hideLabel label={labels.field} rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder={labels.placeholder} maxLength={SUPPORT_MAX_CHARS} className="resize-none" />
        </div>
        <Button type="submit" loading={sending} disabled={!text.trim()}>{labels.send}</Button>
      </form>
    </div>
  );
}
