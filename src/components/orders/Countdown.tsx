"use client";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { remaining } from "@/lib/deadline";

/**
 * "3 days 4 hours left" until the delivery deadline, or how long it is overdue; it moves on by itself every minute.
 * `now` is the server's time for the first drawing, so the server and the browser write the same words.
 */
export function Countdown({ dueAt, now }: { dueAt: string; now: string }) {
  const t = useT();
  const [at, setAt] = useState(() => new Date(now));
  useEffect(() => {
    setAt(new Date());
    const timer = setInterval(() => setAt(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const r = remaining(new Date(dueAt), at);
  const time = t("{days} kun {hours} soat {minutes} daqiqa", { days: r.days, hours: r.hours, minutes: r.minutes });
  return (
    <p data-testid="countdown" className={`font-bold tabular-nums ${r.late ? "text-pomegranate-deep" : ""}`}>
      {r.late ? t("Muddat oʻtdi: {time}", { time }) : t("Topshirishga {time} qoldi", { time })}
    </p>
  );
}
