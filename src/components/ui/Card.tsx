import type { ElementType, HTMLAttributes } from "react";

export type CardTone = "white" | "tint" | "ink" | "cobalt" | "saffron" | "turquoise" | "pomegranate";
export type CardPadding = "none" | "sm" | "md" | "lg";

const TONES: Record<CardTone, string> = {
  white: "bg-white text-ink",
  tint: "bg-paper-deep text-ink",
  ink: "on-ink bg-ink text-paper",
  cobalt: "bg-cobalt-tint text-ink",
  saffron: "bg-saffron-tint text-ink",
  turquoise: "bg-turquoise-tint text-ink",
  pomegranate: "bg-pomegranate-tint text-ink",
};
const PADDING: Record<CardPadding, string> = { none: "", sm: "p-4", md: "p-5", lg: "p-6 sm:p-8" };
// Only cards that open something lift; plain panels stay flat.
const LIFT =
  "transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-pop active:translate-x-0 active:translate-y-0 active:shadow-none";

/** Card looks as a string, for elements that are not a <div> (a Link that is a card, an <li> row). */
export function cardClasses({
  tone = "white",
  padding = "md",
  radius = "card",
  interactive = false,
  className = "",
}: { tone?: CardTone; padding?: CardPadding; radius?: "card" | "hero"; interactive?: boolean; className?: string } = {}) {
  return `${radius === "hero" ? "rounded-hero" : "rounded-card"} border-2 border-ink ${TONES[tone]} ${PADDING[padding]} ${interactive ? LIFT : ""} ${className}`.replace(/\s+/g, " ").trim();
}

const TAGS = {
  paper: "bg-paper-deep",
  white: "bg-white",
  cobalt: "bg-cobalt-tint",
  saffron: "bg-saffron",
  turquoise: "bg-turquoise-tint",
  pomegranate: "bg-pomegranate-tint",
  lilac: "bg-lilac-tint",
} as const;

/** Small non-clickable pill for facts such as a city or a category. */
export const tagClasses = (tone: keyof typeof TAGS = "paper") =>
  `inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-semibold leading-5 text-ink ${TAGS[tone]}`;

type Props = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "li" | "aside";
  tone?: CardTone;
  padding?: CardPadding;
  radius?: "card" | "hero";
  interactive?: boolean;
};

export function Card({ as = "div", tone, padding, radius, interactive, className = "", ...rest }: Props) {
  const Tag = as as ElementType;
  return <Tag {...rest} className={cardClasses({ tone, padding, radius, interactive, className })} />;
}
