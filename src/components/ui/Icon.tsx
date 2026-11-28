// A tiny icon set: hand-drawn strokes on a 24x24 grid, drawn in the text colour (`currentColor`), so an icon follows its
// button's colour in both schemes. Add an icon by adding a name and its path(s) here. If you borrow path data from an
// icon library, note its licence next to it (Lucide is ISC); the ones below are drawn here and need none.
const PATHS = {
  // A disc with eight short rays.
  sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"],
  // A bell.
  bell: ["M6 10a6 6 0 1 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7Z", "M10 20.5a2.2 2.2 0 0 0 4 0"],
  // A heart.
  heart: ["M12 20.5 4.2 12.9a4.9 4.9 0 0 1 6.9-6.9l.9.9.9-.9a4.9 4.9 0 0 1 6.9 6.9Z"],
  // A crescent.
  moon: ["M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2Z"],
  // A camera: the body with its hump, and the lens.
  camera: ["M4 8h3l1.8-2.5h6.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z", "M12 9.8a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"],
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
