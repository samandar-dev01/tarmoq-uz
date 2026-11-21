"use client";
import { buttonClasses } from "@/components/ui/Button";
import { useT } from "@/i18n/client";
import type { EntryRole } from "@/lib/authRole";

// Google's own four-colour "G". It is a brand mark with fixed colours, so (unlike the icons in ui/Icon.tsx) it does not
// follow the text colour, and it is the one place in the project that writes these four values.
const GOOGLE_G = [
  ["#EA4335", "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"],
  ["#4285F4", "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"],
  ["#FBBC05", "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"],
  ["#34A853", "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"],
] as const;

/**
 * "or" and the "Continue with Google" button, for the end of the sign-in and sign-up forms (put it as the form's last
 * fields; the form spaces its children). `door` is the account the person is making or opening: a client or a creator.
 *
 * A plain link, not a Link and not a form: it leaves the site for Google's account chooser, and the site's
 * Content-Security-Policy only lets a form post to the site itself. It works without JavaScript.
 */
export function GoogleButton({ door, next }: { door: EntryRole; next: string | null }) {
  const t = useT();
  const query = new URLSearchParams({ role: door });
  if (next) query.set("next", next);
  return (
    <>
      <div className="flex items-center gap-3 text-sm text-ink-soft">
        <span aria-hidden="true" className="flex-1 border-t border-line" />
        {t("yoki")}
        <span aria-hidden="true" className="flex-1 border-t border-line" />
      </div>
      <a href={`/api/auth/google/start?${query}`} className={buttonClasses({ variant: "secondary", size: "lg", className: "w-full" })}>
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          {GOOGLE_G.map(([fill, d]) => (
            <path key={fill} fill={fill} d={d} />
          ))}
        </svg>
        {t("Google orqali davom etish")}
      </a>
    </>
  );
}
