import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "accent" | "danger" | "ghost" | "chip" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-bold transition-[transform,box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";
const BOX = "rounded-ctl border-2 border-ink";
// Things you can press have a hard shadow: it lifts on hover and collapses when pressed.
const PRESS =
  "shadow-pop-sm hover:-translate-x-px hover:-translate-y-px hover:shadow-pop active:translate-x-0.5 active:translate-y-0.5 active:shadow-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${BOX} ${PRESS} bg-cobalt text-white hover:bg-cobalt-dark`,
  secondary: `${BOX} ${PRESS} bg-white text-ink hover:bg-paper-deep`,
  accent: `${BOX} ${PRESS} bg-saffron text-ink hover:bg-saffron-deep`,
  danger: `${BOX} ${PRESS} bg-pomegranate text-white hover:bg-pomegranate-deep`,
  ghost: "rounded-ctl text-ink hover:bg-ink/10",
  chip: "rounded-full border-2 border-ink bg-white text-ink hover:bg-saffron active:translate-y-px",
  link: "rounded-sm font-semibold text-cobalt underline decoration-2 underline-offset-4 transition-colors hover:bg-cobalt-tint hover:text-cobalt-dark",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 text-sm",
  md: "min-h-11 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-7 text-base",
};
const CHIP_SIZE = "min-h-10 px-3.5 text-sm";

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
