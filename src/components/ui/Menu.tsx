"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { menuMoveFor, menuNextIndex } from "@/lib/menuNav";
import { buttonClasses } from "./Button";

// A dropdown menu: a button that opens a panel of actions and links (the WAI-ARIA "menu button" pattern).
// Mouse: a press opens it; a press outside, Esc or choosing an item closes it.
// Keyboard: Enter, Space and the Down arrow open it on the first item, the Up arrow on the last; Up, Down, Home and End
// move between the items (and wrap), Esc closes it and gives the focus back to the button, Tab closes it and moves on.
// The panel hangs under the button, right edge to right edge, and floats (no layout shift). Colours come from the theme,
// so it is right in both colour schemes.

type MenuApi = { close: (opts?: { returnFocus?: boolean }) => void };
const MenuContext = createContext<MenuApi | null>(null);
function useMenu(): MenuApi {
  const menu = useContext(MenuContext);
  if (!menu) throw new Error("A menu item has to be placed inside <Menu>.");
  return menu;
}

// An item looks like the header's nav links (NavLink "nav"), but is at least 44px high at every width: a menu is used with a thumb.
const ITEM = "flex min-h-11 w-full items-center rounded-ctl px-3 text-left text-[0.9375rem] font-semibold transition-colors duration-150";
const ITEM_IDLE = "text-ink-soft hover:bg-ink/10 hover:text-ink";
const ITEM_CURRENT = "bg-saffron/15 text-saffron-deep";
const ITEM_BUSY = "aria-busy:cursor-progress";

type MenuProps = {
  /** The button's accessible name (it usually shows only a picture). */
  label: string;
  /** What the button shows. Decorative: `label` names the button. */
  trigger: ReactNode;
  /** The button's look; a square icon button like the colour-scheme button when left out. */
  triggerClassName?: string;
  /** A note at the top of the panel that cannot be chosen (who is signed in). It is outside the list of items. */
  header?: ReactNode;
  /** `MenuLink`, `MenuButton` and `MenuSeparator`. */
  children: ReactNode;
};

export function Menu({ label, trigger, triggerClassName = buttonClasses({ variant: "secondary", size: "icon" }), header, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const startAt = useRef<"first" | "last">("first");
  const id = useId();
  const triggerId = `${id}-button`;
  const panelId = `${id}-panel`;

  const items = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const close = ({ returnFocus = false } = {}) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // Opening puts the focus on an item, so the arrow keys work at once. (After a press with the mouse it shows no ring: the
  // browser draws the keyboard ring only when the keyboard was used last.)
  useEffect(() => {
    if (!open) return;
    const list = items();
    list[startAt.current === "last" ? list.length - 1 : 0]?.focus();
  }, [open]);

  // A press, or the focus, landing anywhere outside closes it (the press that lands on the button is the button's own toggle).
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
    };
  }, [open]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (e.target === triggerRef.current && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        startAt.current = e.key === "ArrowUp" ? "last" : "first";
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close({ returnFocus: true });
    } else if (e.key === "Tab") {
      // Focus goes back to the button first, so the Tab that is on its way carries on from there, past the menu.
      close({ returnFocus: true });
    } else if (menuMoveFor(e.key)) {
      e.preventDefault();
      const list = items();
      list[menuNextIndex(menuMoveFor(e.key)!, list.indexOf(document.activeElement as HTMLElement), list.length)]?.focus();
    } else if (e.key === " " && (e.target as HTMLElement).getAttribute("role") === "menuitem") {
      // A link does not react to Space by itself; a menu item should (the matching keyup is held back below).
      e.preventDefault();
      (e.target as HTMLElement).click();
    }
  }

  return (
    <MenuContext.Provider value={{ close }}>
      <div ref={rootRef} className="relative" onKeyDown={onKeyDown} onKeyUp={(e) => open && e.key === " " && e.preventDefault()}>
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => {
            if (open) return close();
            startAt.current = "first";
            setOpen(true);
          }}
          className={triggerClassName}
        >
          {trigger}
        </button>
        {open && (
          // Above the header's own content (z-50 over its links); never wider than the screen less the page's side gutters.
          <div id={panelId} className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] origin-top-right animate-menu-in rounded-card border border-line-strong bg-surface p-3 shadow-lift-lg motion-reduce:animate-none">
            {header && <div className="mb-2 border-b border-line px-3 pb-3 pt-1">{header}</div>}
            <div ref={listRef} role="menu" aria-labelledby={triggerId} className="flex flex-col gap-1">
              {children}
            </div>
          </div>
        )}
      </div>
    </MenuContext.Provider>
  );
}

/**
 * An item that goes to a page. `current` marks the page you are on, the way the header's nav links do. Choosing it closes the
 * menu. `external` is for an address outside the site: it opens in a new tab and the new page gets no handle back to this one.
 */
export function MenuLink({ href, current = false, external = false, children }: { href: string; current?: boolean; external?: boolean; children: ReactNode }) {
  const menu = useMenu();
  return (
    <Link href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} role="menuitem" tabIndex={-1} aria-current={current ? "page" : undefined} onClick={() => menu.close({ returnFocus: true })} className={`${ITEM} ${current ? ITEM_CURRENT : ITEM_IDLE}`}>
      {children}
    </Link>
  );
}

/**
 * An item that does something. Choosing it closes the menu, unless `closeOnSelect` is false (the item shows its own
 * progress: set `busy`, and a press does nothing until it is false again; the item keeps the focus).
 */
export function MenuButton({ onSelect, closeOnSelect = true, busy = false, children }: { onSelect: () => void; closeOnSelect?: boolean; busy?: boolean; children: ReactNode }) {
  const menu = useMenu();
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={() => {
        if (busy) return;
        onSelect();
        if (closeOnSelect) menu.close({ returnFocus: true });
      }}
      className={`${ITEM} ${ITEM_IDLE} ${ITEM_BUSY}`}
    >
      {children}
    </button>
  );
}

/** A hairline between two groups of items. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-line" />;
}
