import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";

type Props = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

/** A link that looks like a Button (or, with variant="link", like an inline text link). */
export function ButtonLink({ variant = "primary", size = "md", className = "", ...rest }: Props) {
  return <Link {...rest} className={buttonClasses({ variant, size, className })} />;
}
