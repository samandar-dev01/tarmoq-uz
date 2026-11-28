"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Field } from "@/components/ui/Field";
import { useHydrated } from "@/components/ui/useHydrated";
import { useT } from "@/i18n/client";
import { tk } from "@/i18n/dictionary";
import type { Suggestion } from "@/lib/suggestMatch";

const KIND: Record<Suggestion["kind"], string> = { category: tk("Yoʻnalish"), creator: tk("Ijodkor"), service: tk("Paket") };

type Props = {
  label: string;
  placeholder: string;
  defaultValue?: string;
  hideLabel?: boolean;
  big?: boolean;
  bare?: boolean;
  /** Example searches that take turns with the placeholder while the field is empty and not in use. Already translated. */
  examples?: readonly string[];
};

const TURN_MS = 3500;

/**
 * The placeholder and the examples, one at a time, drawn over the empty field (it never takes a click or a keystroke,
 * and screen readers hear only the field's own placeholder). It is mounted only while the field is idle, so every visit
 * starts again at the placeholder. A visitor who asked for less motion keeps the placeholder.
 */
function Turns({ texts }: { texts: readonly string[] }) {
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setTurn((n) => n + 1), TURN_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <span aria-hidden="true" data-search-turns className="pointer-events-none absolute inset-0 grid grid-cols-1 items-center overflow-hidden px-4 text-base text-ink-mute">
      {turn > 0 && (
        <span key={turn - 1} className="col-start-1 row-start-1 animate-swap-out truncate">
          {texts[(turn - 1) % texts.length]}
        </span>
      )}
      <span key={turn} data-current className={`col-start-1 row-start-1 truncate ${turn > 0 ? "animate-swap-in" : ""}`}>
        {texts[turn % texts.length]}
      </span>
    </span>
  );
}

/**
 * The search field with suggestions under it while typing (the WAI-ARIA combobox pattern). It stays a plain field of its
 * form: with nothing picked, Enter sends the form as before, and without JavaScript it is simply the field.
 */
export function SearchBox({ defaultValue = "", examples, ...field }: Props) {
  const t = useT();
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [typed, setTyped] = useState(false);
  const [list, setList] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  // Without JavaScript, and until it has loaded, the field shows its own placeholder.
  const takingTurns = !!examples?.length && hydrated && !focused && value === "";

  // Whatever was typed, or focused, before the script loaded is kept: the examples must not lie over it.
  useEffect(() => {
    const input = box.current?.querySelector("input");
    if (!input) return;
    if (document.activeElement === input) setFocused(true);
    if (input.value !== defaultValue) {
      setValue(input.value);
      setTyped(true);
    }
    // Once, when the script arrives: later changes come through onChange.
  }, []);

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
    <div ref={box} className="relative">
      <Field
        {...field}
        className={takingTurns ? "placeholder:!text-transparent" : ""}
        name="q"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setTyped(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          setFocused(false);
        }}
        onFocus={() => {
          setOpen(true);
          setFocused(true);
        }}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
      />
      {takingTurns && <Turns texts={[field.placeholder, ...examples]} />}
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
