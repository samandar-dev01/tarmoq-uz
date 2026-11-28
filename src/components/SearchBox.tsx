"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Field } from "@/components/ui/Field";
import { useT } from "@/i18n/client";
import { tk } from "@/i18n/dictionary";
import type { Suggestion } from "@/lib/suggestMatch";

const KIND: Record<Suggestion["kind"], string> = { category: tk("Yoʻnalish"), creator: tk("Ijodkor"), service: tk("Paket") };

type Props = { label: string; placeholder: string; defaultValue?: string; hideLabel?: boolean; big?: boolean; bare?: boolean };

/**
 * The search field with suggestions under it while typing (the WAI-ARIA combobox pattern). It stays a plain field of its
 * form: with nothing picked, Enter sends the form as before, and without JavaScript it is simply the field.
 */
export function SearchBox({ defaultValue = "", ...field }: Props) {
  const t = useT();
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [typed, setTyped] = useState(false);
  const [list, setList] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    // Only what the visitor types asks for suggestions, never the value the page arrived with.
    if (!typed || value.trim().length < 2) {
      setList([]);
      return;
    }
    const stop = new AbortController();
    const wait = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(value.trim())}`, { signal: stop.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: Suggestion[] };
        setList(data.suggestions);
        setActive(-1);
        setOpen(true);
      } catch {
        // A lost connection or a newer keystroke: the form still works.
      }
    }, 200);
    return () => {
      clearTimeout(wait);
      stop.abort();
    };
  }, [value, typed]);

  const shown = open && list.length > 0;
  const go = (s: Suggestion) => {
    setOpen(false);
    router.push(s.href);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!shown) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // -1 is the field itself: the arrows go round through it.
      setActive((a) => ((a + step + list.length + 1 + 1) % (list.length + 1)) - 1);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      go(list[active]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Field
        {...field}
        name="q"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setTyped(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
      />
      <ul id={listId} role="listbox" aria-label={t("Takliflar")} hidden={!shown} className="absolute inset-x-0 top-full z-30 mt-2 min-w-64 overflow-hidden rounded-card border border-line-strong bg-surface p-2 text-left text-ink shadow-lift-lg">
        {list.map((s, i) => (
          <li
            key={`${s.kind}-${s.href}-${s.label}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            // Pressing must not take the focus from the field first (that would close the list before the click lands).
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => go(s)}
            onMouseEnter={() => setActive(i)}
            className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-ctl px-3 text-[0.9375rem] ${i === active ? "bg-ink/10" : ""}`}
          >
            <span data-user-content className="truncate font-semibold">{s.label}</span>
            <span className="shrink-0 text-sm text-ink-soft">{t(KIND[s.kind])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
