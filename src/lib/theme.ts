import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "./themePure";

/** The visitor's colour scheme, from the `theme` cookie. Missing or unknown means dark. For server components. */
export async function getTheme(): Promise<Theme> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
