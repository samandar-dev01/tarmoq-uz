import { initials } from "@/lib/format";

// Creator art takes its colours from the theme, so a re-skin reaches it too. The accent fills and the cover-ink and
// cover-night strokes are the same in both colour schemes, so a creator's art looks the same in either.
const PALETTE = ["rgb(var(--c-cobalt))", "rgb(var(--c-turquoise))", "rgb(var(--c-saffron))", "rgb(var(--c-pomegranate))", "rgb(var(--c-lilac))"] as const;

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
    // A flat dimmer on top keeps the weave rich but never neon against the dark ground.
    "linear-gradient(rgb(var(--c-cover-night) / .44), rgb(var(--c-cover-night) / .44))",
    `linear-gradient(135deg, rgb(var(--c-cover-ink) / .16) 25%, transparent 25%) ${-half}px 0/${cell}px ${cell}px`,
    `linear-gradient(225deg, rgb(var(--c-cover-ink) / .16) 25%, transparent 25%) ${-half}px 0/${cell}px ${cell}px`,
    `linear-gradient(315deg, rgb(var(--c-cover-night) / .22) 25%, transparent 25%) 0 0/${cell}px ${cell}px`,
    `linear-gradient(45deg, rgb(var(--c-cover-night) / .22) 25%, transparent 25%) 0 0/${cell}px ${cell}px`,
    `repeating-linear-gradient(90deg, ${a} 0 ${w * 2}px, ${b} ${w * 2}px ${w * 3}px, ${c} ${w * 3}px ${w * 5}px, ${b} ${w * 5}px ${w * 6}px)`,
  ].join(", ");
}

const SIZES = {
  sm: { box: "h-8 w-8", text: "text-xs" },
  md: { box: "h-12 w-12", text: "text-sm" },
  lg: { box: "h-16 w-16", text: "text-lg" },
  xl: { box: "h-24 w-24", text: "text-2xl" },
} as const;

/** A creator's initials on a plain disc. Decorative: the name is always written next to it. */
export function Avatar({ name, size = "md", className = "" }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span aria-hidden="true" className={`relative inline-grid shrink-0 place-items-center rounded-full border border-line-strong bg-paper-deep font-display font-bold text-ink ${s.box} ${s.text} ${className}`}>
      {initials(name)}
    </span>
  );
}
