"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { parseSaved, SAVED_COOKIE, savedCookie, toggleSaved } from "@/lib/recentPure";

const read = () => parseSaved(document.cookie.split("; ").find((c) => c.startsWith(`${SAVED_COOKIE}=`))?.slice(SAVED_COOKIE.length + 1));

/** The heart on a package card: saves it in this browser (the home page lists what is saved). */
export function SaveButton({ id, title, saved: initial }: { id: string; title: string; saved: boolean }) {
  const t = useT();
  const ready = useHydrated();
  const [saved, setSaved] = useState(initial);
  return (
    <button
      type="button"
      disabled={!ready}
      aria-pressed={saved}
      aria-label={t("Saqlash: {title}", { title })}
      onClick={() => {
        const next = toggleSaved(read(), id);
        document.cookie = savedCookie(next);
        setSaved(next.includes(id));
      }}
      className="grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-surface/90 text-ink shadow-lift-sm transition-colors duration-150 hover:bg-surface aria-pressed:text-pomegranate"
    >
      <Icon name="heart" className={saved ? "fill-current" : ""} />
    </button>
  );
}
