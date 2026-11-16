// A tiny icon set: hand-drawn strokes on a 24x24 grid, drawn in the text colour (`currentColor`), so an icon follows its
// button's colour in both schemes. Add an icon by adding a name and its path(s) here. If you borrow path data from an
// icon library, note its licence next to it (Lucide is ISC); the two below are drawn here and need none.
const PATHS = {
  // A disc with eight short rays.
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"],
  // A crescent.
  moon: ["M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2Z"],
} as const;

export type IconName = keyof typeof PATHS;

/** Decorative: the control or the text beside it carries the name, so the icon is hidden from assistive technology. */
export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className || undefined}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
