"use client";
import { useState } from "react";
import { buttonClasses } from "./Button";
import { Icon } from "./Icon";
import { useT } from "@/i18n/client";
import { tk } from "@/i18n/dictionary";
import { otherTheme, parseTheme, themeCookie, type Theme } from "@/lib/themePure";

// The name says what a press will do. Sun in the dark scheme (go light), moon in the light one (go dark).
const LABEL: Record<Theme, string> = { dark: tk("Yorugʻ rejimga oʻtish"), light: tk("Qorongʻi rejimga oʻtish") };

/**
 * The one colour-scheme button. `initial` is what the server already painted (from the `theme` cookie), so the first render
 * matches the HTML and nothing is guessed in an effect. A press flips `data-theme` on <html> and remembers it in the cookie
 * at once: no navigation, no refresh.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  // After a refresh the server may hand over a different value (the choice was changed in another tab): follow it.
  const [seen, setSeen] = useState<Theme>(initial);
  if (initial !== seen) {
    setSeen(initial);
    setTheme(initial);
  }
  const t = useT();
  const label = t(LABEL[theme]);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        // The page is the truth (another tab may have changed the cookie since this one loaded).
        const next = otherTheme(parseTheme(document.documentElement.dataset.theme));
        document.documentElement.dataset.theme = next;
        document.cookie = themeCookie(next);
        setTheme(next);
      }}
      className={buttonClasses({ variant: "secondary", size: "icon" })}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
