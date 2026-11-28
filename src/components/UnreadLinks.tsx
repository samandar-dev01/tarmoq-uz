"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { NavLink } from "@/components/ui/NavLink";
import { Icon } from "@/components/ui/Icon";
import { useT } from "@/i18n/client";
import { badge } from "@/lib/notificationsPure";

const EVERY_MS = 30_000;
/** The bell asks the server; the messages link hears the answer through this event, so there is one question, not two. */
const FRESH = "tarmoq:unread";
export type Unread = { messages: number; notices: number };

/** The counts for the header, kept fresh while the tab is open; a browser alert (when allowed) says something new came. */
function useUnread(initial: Unread) {
  const [unread, setUnread] = useState(initial);
  const t = useT();
  const path = usePathname();
  const last = useRef(initial.messages + initial.notices);
  useEffect(() => {
    setUnread(initial);
    last.current = initial.messages + initial.notices;
  }, [initial.messages, initial.notices]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ask = async () => {
      try {
        const res = await fetch("/api/notifications/count", { cache: "no-store" });
        if (!res.ok) return;
        const now = (await res.json()) as Unread;
        setUnread(now);
        window.dispatchEvent(new CustomEvent<Unread>(FRESH, { detail: now }));
        const total = now.messages + now.notices;
        if (total > last.current && document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification("Tarmoq.uz", { body: t("Sizda yangi xabar yoki bildirishnoma bor."), tag: "tarmoq-unread" });
        }
        last.current = total;
      } catch {
        // Offline for a moment: the next round asks again.
      }
    };
    const timer = setInterval(ask, EVERY_MS);
    // Opening the messages or notifications page changes the counts at once.
    if (path.startsWith("/messages") || path === "/notifications") void ask();
    return () => clearInterval(timer);
  }, [path, t]);
  return unread;
}

/** A count on a corner, drawn by CSS so that the link's own text stays its name. */
const COUNT = "relative after:absolute after:right-0 after:top-0 after:min-w-5 after:rounded-full after:bg-pomegranate after:px-1 after:text-center after:text-xs after:font-bold after:leading-5 after:text-on-accent after:content-[attr(data-count)]";

/** The "Xabarlar" link of the wide bar, with the number of unread messages. */
export function MessagesLink({ href, label, count: initial }: { href: string; label: string; count: number }) {
  const [count, setCount] = useState(initial);
  useEffect(() => setCount(initial), [initial]);
  useEffect(() => {
    const hear = (e: Event) => setCount((e as CustomEvent<Unread>).detail.messages);
    window.addEventListener(FRESH, hear);
    return () => window.removeEventListener(FRESH, hear);
  }, []);
  const shown = badge(count);
  return (
    <NavLink href={href} className={shown ? `${COUNT} pr-6` : ""} data-count={shown || undefined}>
      {label}
    </NavLink>
  );
}

/** The notifications bell. */
export function HeaderBell({ initial }: { initial: Unread }) {
  const t = useT();
  const unread = useUnread(initial);
  const shown = badge(unread.notices);
  return (
      <NavLink
        href="/notifications"
        variant="plain"
        aria-label={unread.notices > 0 ? t("Bildirishnomalar: {n} ta yangi", { n: unread.notices }) : t("Bildirishnomalar")}
        data-count={shown || undefined}
        className={buttonClasses({ variant: "ghost", size: "icon", className: `max-[419px]:hidden ${shown ? COUNT : ""}` })}
      >
        <Icon name="bell" />
      </NavLink>
  );
}
