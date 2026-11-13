"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Alert } from "./Alert";
import { FLASH_KEY } from "@/lib/authRole";

const SHOW_MS = 6000;

/** Shows a message that the previous page left behind (for example after sign-in), once, then lets it go. */
export function FlashToast() {
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(FLASH_KEY);
      if (stored) window.sessionStorage.removeItem(FLASH_KEY);
    } catch {
      // Storage can be blocked (private mode); the toast is a courtesy, the redirect already happened.
    }
    if (!stored) return;
    setMessage(stored);
    const timer = setTimeout(() => setMessage(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-md shadow-pop">
        <Alert variant="info">{message}</Alert>
      </div>
    </div>
  );
}
