"use client";
import { useEffect } from "react";
import { addSeen, parseSeen, SEEN_COOKIE, seenCookie } from "@/lib/recentPure";

/** Notes, in the visitor's own browser, that this creator's page was opened. Draws nothing. */
export function RememberCreator({ slug }: { slug: string }) {
  useEffect(() => {
    const current = document.cookie.split("; ").find((c) => c.startsWith(`${SEEN_COOKIE}=`))?.slice(SEEN_COOKIE.length + 1);
    document.cookie = seenCookie(addSeen(parseSeen(current), slug));
  }, [slug]);
  return null;
}
