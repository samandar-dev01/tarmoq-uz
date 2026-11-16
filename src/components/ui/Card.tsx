import type { ElementType, HTMLAttributes } from "react";

export type CardTone = "white" | "tint" | "ink" | "cobalt" | "saffron" | "turquoise" | "pomegranate";
export type CardPadding = "none" | "sm" | "md" | "lg";

// "ink" keeps its name for the callers, but it is the accent block in both schemes: a blue glow fading into the card colour.
// "white" keeps its name too: it is the plain card, which is white in the light scheme and slate in the dark one.
const TONES: Record<CardTone, string> = {
  white: "bg-surface text-ink",
  tint: "bg-paper-deep text-ink",
  ink: "border-cobalt/40 bg-gradient-to-br from-cobalt-tint via-surface to-surface text-ink",
  cobalt: "border-cobalt/30 bg-cobalt-tint text-ink",
  saffron: "border-saffron/30 bg-saffron-tint text-ink",
  turquoise: "border-turquoise/30 bg-turquoise-tint text-ink",
  pomegranate: "border-pomegranate/30 bg-pomegranate-tint text-ink",
};
const PADDING: Record<CardPadding, string> = { none: "", sm: "p-4", md: "p-5", lg: "p-6 sm:p-8" };
// Only cards that open something lift; plain panels stay flat.
const LIFT =
  "transition-[transform,box-shadow,border-color] duration-200 ease-snap hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift active:translate-y-0 active:shadow-lift-sm";

/** Card looks as a string, for elements that are not a <div> (a Link that is a card, an <li> row). */
export function cardClasses({
  tone = "white",
  padding = "md",
  radius = "card",
  interactive = false,
  className = "",
}: { tone?: CardTone; padding?: CardPadding; radius?: "card" | "hero"; interactive?: boolean; className?: string } = {}) {
  return `${radius === "hero" ? "rounded-hero" : "rounded-card"} border ${TONES[tone]} ${PADDING[padding]} ${interactive ? LIFT : ""} ${className}`.replace(/\s+/g, " ").trim();
}

// Each tag pairs its fill with the text that reads on it.
const TAGS = {
  paper: "bg-paper-deep text-ink-soft",
  white: "bg-surface text-ink",
  cobalt: "bg-cobalt-tint text-cobalt-dark",
  saffron: "bg-saffron text-night",
  turquoise: "bg-turquoise-tint text-turquoise-deep",
  pomegranate: "bg-pomegranate-tint text-pomegranate-deep",
  lilac: "bg-lilac-tint text-ink",
} as const;

/** Small non-clickable pill for facts such as a city or a category. */
export const tagClasses = (tone: keyof typeof TAGS = "paper") =>
  `inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold leading-5 ${TAGS[tone]}`;

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
