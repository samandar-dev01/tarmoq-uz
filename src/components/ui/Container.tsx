import type { ElementType, HTMLAttributes } from "react";

export type ContainerSize = "sm" | "md" | "lg" | "xl" | "2xl";

const WIDTH: Record<ContainerSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  "2xl": "max-w-6xl",
};
const PAD = { page: "py-8 sm:py-12", section: "py-12 sm:py-16", none: "" } as const;

type Props = HTMLAttributes<HTMLElement> & {
  size?: ContainerSize;
  pad?: keyof typeof PAD;
  as?: "div" | "section" | "header" | "nav";
};

/** The page holder: centred, a readable width per page, the same side gutter everywhere. */
export function Container({ size = "2xl", pad = "page", as = "div", className = "", ...rest }: Props) {
  const Tag = as as ElementType;
  return <Tag {...rest} className={`mx-auto w-full px-4 sm:px-6 ${WIDTH[size]} ${PAD[pad]} ${className}`.trim()} />;
}
