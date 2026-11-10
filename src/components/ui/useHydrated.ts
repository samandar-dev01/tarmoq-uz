"use client";
import { useEffect, useState } from "react";

/**
 * False on the server and until React has attached its handlers. Keep the submit button of a form that is handled in
 * JavaScript disabled until this is true: a click before then would submit the form natively, which puts its fields
 * (a password, a card number) into the URL and loses the page's own query string.
 *
 * It also sets `data-hydrated="true"` on <html>, a signal the end-to-end tests wait for after a full page load
 * (anything typed or clicked before React is ready is lost).
 */
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    setReady(true);
  }, []);
  return ready;
}
