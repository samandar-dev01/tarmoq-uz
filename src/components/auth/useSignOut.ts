"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Signs the person out: POST /api/auth/logout, then home, then a refresh so the header and the footer are drawn for a
 * visitor. `signingOut` is true from the press until the page changes (or until the request fails, when it goes back to
 * false so the person can try again).
 */
export function useSignOut() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error(`Sign-out failed: HTTP ${res.status}`);
    } catch {
      setSigningOut(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }
  return { signOut, signingOut };
}
