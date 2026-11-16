"use client";
import { useT } from "@/i18n/client";

export function Spinner({ size = 20 }: { size?: number }) {
  const t = useT();
  return (
    <svg role="status" aria-label={t("Yuklanmoqda")} width={size} height={size} viewBox="0 0 24 24" className="animate-spin" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
