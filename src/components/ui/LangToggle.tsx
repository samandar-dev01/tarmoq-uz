"use client";
import { usePathname, useRouter } from "next/navigation";
import { buttonClasses } from "./Button";
import { useT } from "@/i18n/client";
import { langCookie, LOCALE_CODE, LOCALE_NAME, otherLocale, type Locale } from "@/i18n/config";
import { localHref, stripLocalePrefix } from "@/i18n/paths";

/**
 * The one language button. `initial` is the language the server already wrote the page in, so the first render matches
 * the HTML. The button shows the OTHER language's code and its name says what a press does, ending with that language's
 * own name («Tilni almashtirish: Русский» / «Сменить язык: Oʻzbekcha»), so a reader of either can find it.
 *
 * A press remembers the choice in the `lang` cookie. A page that has a Russian address (home, search, a creator's page)
 * is then opened at its other address (`/search` <-> `/ru/search`); every other page is drawn again in place.
 * The admin area is Uzbek only, so the button is not there. The header draws it only when Russian is on.
 */
export function LangToggle({ initial }: { initial: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  const next = otherLocale(initial);
  const label = t("Tilni almashtirish: {language}", { language: LOCALE_NAME[next] });
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        document.cookie = langCookie(next);
        const here = window.location.pathname;
        const there = localHref(next, stripLocalePrefix(here));
        // A full load for a new address: the whole page, <html lang> included, is written again in the new language.
        if (there !== here) window.location.assign(there + window.location.search + window.location.hash);
        else router.refresh();
      }}
      className={buttonClasses({ variant: "ghost", size: "icon", className: "text-sm" })}
    >
      {LOCALE_CODE[next]}
    </button>
  );
}
