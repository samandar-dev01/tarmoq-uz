"use client";
import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export function Field({ label, error, id, className = "", ...rest }: Props) {
  const autoId = useId();
  const fieldId = id ?? rest.name ?? autoId;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
          error ? "border-red-500" : "border-slate-300"
        } ${className}`}
        {...rest}
      />
      {error && (
        <p id={`${fieldId}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
