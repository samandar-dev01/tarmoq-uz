/** The two colour schemes. Dark is the default for a first visit; light is a warm paper look. Both live in globals.css. */
export type Theme = "dark" | "light";

/**
 * The visitor's choice. Holds no secret and is not httpOnly: the toggle writes it in the browser, and the root layout
 * reads it on the server to put `data-theme` on <html>, so the first byte of every page is already in the right scheme.
 */
export const THEME_COOKIE = "theme";
export const DEFAULT_THEME: Theme = "dark";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Only the exact words "light" and "dark" are a choice; anything else (no cookie, a stray value) is the default. */
export const parseTheme = (value: string | null | undefined): Theme => (value === "light" || value === "dark" ? value : DEFAULT_THEME);

export const otherTheme = (theme: Theme): Theme => (theme === "dark" ? "light" : "dark");

/** The text to assign to `document.cookie`. */
export const themeCookie = (theme: Theme): string => `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;

/**
 * The browser bar colour cannot read CSS variables, so it mirrors --c-paper of each scheme in globals.css
 * (tests/unit/themeContrast.test.ts keeps the two equal).
 */
export const THEME_BROWSER_COLOR: Record<Theme, string> = { dark: "#090D16", light: "#F7F3EC" };
