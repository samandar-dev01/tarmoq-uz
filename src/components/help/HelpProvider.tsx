"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { HelpSheet } from "./HelpSheet";

export type HelpRole = "CLIENT" | "PROVIDER" | "ADMIN" | null;
type HelpApi = { open: () => void; unread: number };

// Outside the provider (a test, a page rendered alone) pressing Help does nothing and there is nothing unread.
const HelpContext = createContext<HelpApi>({ open: () => {}, unread: 0 });
export const useHelp = () => useContext(HelpContext);

const CHECK_MS = 60_000;

/**
 * Holds the one Help sheet for the whole site, so the buttons that open it (the account menu, the footer, the header for a
 * visitor) need no state of their own. For a client or a creator it also asks, once a minute while the tab is in view,
 * whether the support team has answered; `unread` is what the dot on the account button and on "Yordam" shows.
 */
export function HelpProvider({ role, children }: { role: HelpRole; children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const writes = role === "CLIENT" || role === "PROVIDER";

  useEffect(() => {
    if (!writes || isOpen) return;
    let alive = true;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/support/unread", { cache: "no-store" });
        if (res.ok && alive) setUnread((await res.json()).unread ?? 0);
      } catch {
        // offline: the dot just stays as it was
      }
    };
    void check();
    const timer = setInterval(check, CHECK_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [writes, isOpen]);

  const open = useCallback(() => {
    setOpen(true);
    setUnread(0); // opening the thread marks the answers as read on the server
  }, []);
  const api = useMemo(() => ({ open, unread }), [open, unread]);

  return (
    <HelpContext.Provider value={api}>
      {children}
      <HelpSheet open={isOpen} onClose={() => setOpen(false)} role={role} />
    </HelpContext.Provider>
  );
}
