import type { ReactNode } from "react";

const STYLES = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function Alert({ variant = "info", children }: { variant?: keyof typeof STYLES; children: ReactNode }) {
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${STYLES[variant]}`}>
      {children}
    </div>
  );
}
