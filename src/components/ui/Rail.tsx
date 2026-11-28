"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonClasses } from "./Button";

/**
 * A row that slides sideways: a swipe or the scroll wheel moves it, and on a wide screen two arrow buttons move it most of
 * its width. The children are `<li>`s.
 */
export function Rail({ label, prevLabel, nextLabel, children }: { label: string; prevLabel: string; nextLabel: string; children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  // The arrows are drawn only when there is more than fits.
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [children]);
  const move = (direction: 1 | -1) => {
    const el = list.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const arrow = buttonClasses({ variant: "secondary", size: "icon", className: "rounded-full" });
  return (
    <div>
      <ul ref={list} data-rail aria-label={label} tabIndex={0} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-1 px-1 pb-3 pt-1">
        {children}
      </ul>
      <div className={`mt-2 hidden justify-end gap-2 ${overflows ? "md:flex" : ""}`}>
        <button type="button" className={arrow} aria-label={prevLabel} onClick={() => move(-1)}>
          <span aria-hidden="true">←</span>
        </button>
        <button type="button" className={arrow} aria-label={nextLabel} onClick={() => move(1)}>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
