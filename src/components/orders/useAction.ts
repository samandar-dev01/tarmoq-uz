"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

export type Issue = { path: string; message: string };
type RunInit = { json?: unknown; form?: FormData; method?: string };

/** Shared loading/error handling for "click a button, call the API, refresh the page". */
export function useAction() {
  const router = useRouter();
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  async function run(url: string, init: RunInit = {}, onDone?: (data: any) => void): Promise<boolean> {
    setLoading(true);
    setError(null);
    setIssues([]);
    try {
      const res = await fetch(url, {
        method: init.method ?? "POST",
        headers: init.form ? undefined : { "Content-Type": "application/json" },
        body: init.form ?? JSON.stringify(init.json ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // `data.error` is already in the reader's language (the server translates it); the fallback is for an answer with no body.
        setError(data.error ?? `${t("Nimadir xato ketdi.")} ${t("Qayta urinib koʻring.")}`);
        setIssues(data.issues ?? []);
        return false;
      }
      onDone?.(data);
      router.refresh();
      return true;
    } catch {
      setError(t("Internet aloqasida muammo. Qayta urinib koʻring."));
      return false;
    } finally {
      setLoading(false);
    }
  }

  const fe = (path: string) => issues.find((i) => i.path === path)?.message;
  return { run, loading, error, fe, router };
}
