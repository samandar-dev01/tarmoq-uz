import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { translator } from "@/i18n/dictionary";
import { localHref } from "@/i18n/paths";
import { getLocale } from "@/i18n/server";
import { canBrowseCreators, getCurrentUser } from "@/lib/auth";
import { CATALOG, catalogName } from "@/lib/catalog";
import { footerLinks, HELP } from "@/lib/shellNav";

const COLUMN_TITLE = "mb-1 text-sm font-bold";
// Quiet text until pointed at, so the columns read as lists.
const LINK = "inline-flex min-h-11 items-center rounded-sm text-[0.9375rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline md:min-h-9";

/** The large footer: the name, the directions, the links that fit the visitor, and the small print. */
export async function Footer() {
  const viewer = await getCurrentUser();
  const locale = await getLocale();
  const t = translator(locale);
  // A creator never gets the creator list, and an admin works from the admin area: neither is offered the directions.
  const directions = canBrowseCreators(viewer) && viewer?.role !== "ADMIN";
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <Container pad="none" className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight">
            tarmoq<span className="text-cobalt-dark">.uz</span>
          </p>
          <p className="mt-2 max-w-sm text-ink-soft">{t("Oʻzbekiston ijodkorlari bir tarmoqda: videograf, fotograf va montajchilarni toping.")}</p>
        </div>

        {directions && (
          <nav aria-label={t("Yoʻnalishlar")}>
            <p className={COLUMN_TITLE}>{t("Yoʻnalishlar")}</p>
            <ul>
              {CATALOG.map((c) => (
                <li key={c.slug}>
                  <Link href={localHref(locale, `/search?category=${c.slug}`)} className={LINK}>{catalogName(locale, c)}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div>
          <p className={COLUMN_TITLE}>{t("Havolalar")}</p>
          <nav aria-label={t("Pastki menyu")} className="flex flex-col items-start">
            {footerLinks(viewer).map((link) => (
              <Link key={link.href} href={localHref(locale, link.href)} className={LINK}>{t(link.label)}</Link>
            ))}
            {/* Help: the support team's Telegram, in a new tab. An admin answers from the admin area and is not given it. */}
            {viewer?.role !== "ADMIN" && (
              <Link href={HELP.href} target="_blank" rel="noopener noreferrer" className={LINK}>{t(HELP.label)}</Link>
            )}
          </nav>
        </div>
      </Container>
      <div className="border-t border-line">
        <Container pad="none" className="flex flex-wrap items-center justify-between gap-x-6 py-3 text-sm text-ink-soft">
          <span>© {new Date().getFullYear()} Tarmoq.uz.</span>
          <Link href="/maxfiylik" className={LINK}>{t("Maxfiylik siyosati")}</Link>
        </Container>
      </div>
    </footer>
  );
}
