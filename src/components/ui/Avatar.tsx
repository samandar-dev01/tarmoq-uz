import { initials } from "@/lib/format";

const PALETTE = ["#2A3BEA", "#10B5A3", "#FFC42E", "#E8365D", "#B6A5FF"] as const;

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Woven, ikat-like colour art for a creator: always the same for the same seed (use the profile slug).
 * It is a CSS `background` value. Put it on an element with the `ikat` class (which feathers the edges)
 * inside a parent with `overflow-hidden`, and make the element a little bigger than the parent.
 */
export function coverArt(seed: string): string {
  const h = hash(seed);
  const next = (i: number, taken: string[]) => {
    let idx = i % PALETTE.length;
    while (taken.includes(PALETTE[idx]!)) idx = (idx + 1) % PALETTE.length;
    return PALETTE[idx]!;
  };
  const a = next(h, []);
  const b = next(h >>> 5, [a]);
  const c = next(h >>> 11, [a, b]);
  const w = 14 + (h % 12); // thread band width
  const cell = 26 + ((h >>> 3) % 14); // diamond size
  const half = cell / 2;
  return [
    `linear-gradient(135deg, rgba(255,255,255,.24) 25%, transparent 25%) ${-half}px 0/${cell}px ${cell}px`,
    `linear-gradient(225deg, rgba(255,255,255,.24) 25%, transparent 25%) ${-half}px 0/${cell}px ${cell}px`,
    `linear-gradient(315deg, rgba(27,18,53,.18) 25%, transparent 25%) 0 0/${cell}px ${cell}px`,
    `linear-gradient(45deg, rgba(27,18,53,.18) 25%, transparent 25%) 0 0/${cell}px ${cell}px`,
    `repeating-linear-gradient(90deg, ${a} 0 ${w * 2}px, ${b} ${w * 2}px ${w * 3}px, ${c} ${w * 3}px ${w * 5}px, ${b} ${w * 5}px ${w * 6}px)`,
  ].join(", ");
}

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-[9px]" },
  md: { box: "h-12 w-12", text: "text-[11px]" },
  lg: { box: "h-16 w-16", text: "text-sm" },
  xl: { box: "h-24 w-24", text: "text-xl" },
} as const;

/** Initials on creator colour art. Decorative: the name is always written next to it. */
export function Avatar({ name, seed, size = "md", className = "" }: { name: string; seed?: string; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span aria-hidden="true" className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink bg-white ${s.box} ${className}`}>
      <span className="ikat absolute -inset-2" style={{ background: coverArt(seed ?? name) }} />
      <span className={`relative grid h-[62%] w-[62%] place-items-center rounded-full border-2 border-ink bg-white font-display font-bold text-ink ${s.text}`}>
        {initials(name)}
      </span>
    </span>
  );
}
