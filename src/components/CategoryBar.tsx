"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type BarCategory = { name: string; href: string; items: { name: string; href: string }[] };

// The public pages that browse creators. The Russian address of a page is the same page (src/proxy.ts shows it at `/ru`),
// so both forms are matched and the server and the browser always agree.
const BROWSE = /^(\/ru)?(\/|\/search|\/providers\/[^/]+)?$/;

// A press must close the panel: it is shown while the pointer is over it or the focus is inside it.
const letGo = () => (document.activeElement as HTMLElement | null)?.blur();

/**
 * The row of directions under the header. On a wide screen each opens its subdirections when pointed at or reached with
 * Tab; on a phone the row scrolls sideways and a direction opens its own search page (the subdirections are there).
 */
export function CategoryBar({ label, categories }: { label: string; categories: BarCategory[] }) {
  if (!BROWSE.test(usePathname())) return null;
  return (
    <nav aria-label={label} className="border-b border-line">
      <ul className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6 md:justify-between md:overflow-visible">
        {categories.map((c) => (
          <li key={c.href} className="group relative shrink-0">
            <Link href={c.href} onClick={letGo} className="flex min-h-11 items-center whitespace-nowrap rounded-sm px-2 text-[0.9375rem] font-semibold text-ink-soft transition-colors duration-150 hover:text-ink md:group-focus-within:text-ink">
              {c.name}
            </Link>
            <ul className="invisible absolute left-0 top-full z-30 hidden min-w-60 rounded-card border border-line-strong bg-surface p-2 opacity-0 shadow-lift-lg transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 group-last:left-auto group-last:right-0 md:block">
              {c.items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={letGo} className="flex min-h-11 items-center whitespace-nowrap rounded-ctl px-3 text-[0.9375rem] font-semibold text-ink-soft hover:bg-ink/10 hover:text-ink">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
