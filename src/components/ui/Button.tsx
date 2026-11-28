import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "accent" | "danger" | "ghost" | "outline" | "chip" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const BASE =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-bold transition-[transform,box-shadow,background-color,border-color,color,filter] duration-150 ease-snap disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
const BOX = "rounded-ctl border";
// Things you can press lift a little on hover and settle when pressed.
const PRESS = "shadow-lift-sm hover:-translate-y-px hover:shadow-lift hover:brightness-110 active:translate-y-px active:shadow-lift-sm active:brightness-95";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${BOX} ${PRESS} border-on-accent/10 bg-cobalt text-on-accent`,
  secondary: `${BOX} ${PRESS} border-line-strong bg-surface text-ink hover:bg-paper-deep`,
  accent: `${BOX} ${PRESS} border-transparent bg-saffron text-night`,
  danger: `${BOX} ${PRESS} border-on-accent/10 bg-pomegranate text-on-accent`,
  ghost: "rounded-ctl text-ink-soft hover:bg-ink/10 hover:text-ink",
  // The header's way in: a flat, tight-cornered frame that fills on hover.
  outline: "rounded-md border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
  // A pill. When it stands for a choice that is on (aria-current or aria-pressed), it fills with amber.
  chip: "rounded-full border border-line-strong bg-surface text-ink-soft hover:border-ink-mute/50 hover:bg-paper-deep hover:text-ink active:translate-y-px aria-[current=true]:border-transparent aria-[current=true]:bg-saffron aria-[current=true]:text-night aria-pressed:border-transparent aria-pressed:bg-saffron aria-pressed:text-night",
  link: "rounded-sm font-semibold text-cobalt-dark underline decoration-1 underline-offset-4 transition-colors hover:bg-cobalt-tint hover:text-ink",
};
// 44px is the touch minimum; the compact size steps down to 40px once a mouse is likely.
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm md:min-h-10",
  md: "min-h-11 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-7 text-base",
  // A square icon-only button: 44px at every width, with no padding, so the icon stays centred.
  icon: "h-11 w-11 p-0",
};
const CHIP_SIZE = "min-h-11 px-4 text-sm";

/** The one source of button looks. `Button` (a <button>) and `ButtonLink` (a link) both use it. */
export function buttonClasses({ variant = "primary", size = "md", className = "" }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  if (variant === "link") return `${VARIANTS.link} ${className}`.trim();
  return `${BASE} ${VARIANTS[variant]} ${variant === "chip" ? CHIP_SIZE : SIZES[size]} ${className}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, disabled, children, className = "", ...rest }: Props) {
  return (
    <button {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClasses({ variant, size, className })}>
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
}
