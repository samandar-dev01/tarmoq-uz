"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { buttonClasses } from "./Button";

// A panel that slides over the page: from the bottom on a phone, from the right edge from `sm` up. It is the platform's own
// modal <dialog>, so the browser holds the focus inside it, closes it on Esc and puts the page behind it out of reach.
// A press on the dimmed page behind it closes it too. While it is open the page behind does not scroll.
// Colours come from the theme, so it is right in both colour schemes.

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The close button's name (it shows only a cross). */
  closeLabel: string;
  children: ReactNode;
};

export function Sheet({ open, onClose, title, closeLabel, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = was;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // only the dimmed page, not anything inside the panel
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 flex max-h-[88dvh] w-full max-w-none flex-col overflow-hidden rounded-t-card border border-line-strong bg-surface p-0 text-ink shadow-lift-lg backdrop:bg-night/60 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-card"
    >
      {open && (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 id={titleId} className="text-xl">{title}</h2>
            <button type="button" onClick={onClose} aria-label={closeLabel} className={buttonClasses({ variant: "ghost", size: "icon" })}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </>
      )}
    </dialog>
  );
}
