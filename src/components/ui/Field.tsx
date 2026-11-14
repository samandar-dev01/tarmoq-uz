"use client";
import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Shared = {
  label: string;
  error?: string;
  hint?: string;
  /** Keep the label for screen readers only (for a field whose purpose is clear from its place, such as the hero search). */
  hideLabel?: boolean;
  /** A taller control, for the one field a page is built around. */
  big?: boolean;
  /** No border or fill of its own, for a control that sits inside a bar which draws them (the hero search). The bar shows focus. */
  bare?: boolean;
};
type InputProps = Shared & { as?: "input" } & InputHTMLAttributes<HTMLInputElement>;
type TextAreaProps = Shared & { as: "textarea" } & TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = Shared & { as: "select" } & SelectHTMLAttributes<HTMLSelectElement>;
export type FieldProps = InputProps | TextAreaProps | SelectProps;

/** A labelled control with its hint and error tied to it. `as` picks an input (default), a textarea or a select. */
export function Field(props: FieldProps) {
  const { label, error, hint, hideLabel, big, bare, as = "input", id, className = "", ...rest } = props;
  const height = big ? "h-14" : "h-12";
  const autoId = useId();
  const fieldId = id ?? (rest as { name?: string }).name ?? autoId;
  const describedBy = [error ? `${fieldId}-error` : null, hint ? `${fieldId}-hint` : null].filter(Boolean).join(" ") || undefined;

  const control = bare
    ? `block w-full rounded-ctl bg-transparent px-4 text-base text-ink transition-colors duration-150 ease-snap placeholder:text-ink-mute hover:bg-ink/5 focus:outline-none focus-visible:bg-ink/10 ${className}`
    : `block w-full rounded-ctl border bg-surface px-4 text-base text-ink transition-[border-color,box-shadow,background-color] duration-150 ease-snap placeholder:text-ink-mute focus:outline-none focus-visible:border-cobalt focus-visible:shadow-[0_0_0_3px_rgb(var(--c-cobalt)/0.35)] ${
        error ? "border-pomegranate" : "border-line-strong hover:border-ink-mute/50"
      } ${className}`;
  const aria = { id: fieldId, "aria-invalid": !!error, "aria-describedby": describedBy };

  return (
    <div>
      <label htmlFor={fieldId} className={hideLabel ? "sr-only" : "mb-1.5 block text-sm font-bold text-ink"}>
        {label}
      </label>
      {as === "textarea" ? (
        <textarea {...aria} className={`${control} py-3`} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : as === "select" ? (
        <select {...aria} className={`${control} ${height} pr-11`} {...(rest as SelectHTMLAttributes<HTMLSelectElement>)} />
      ) : (
        <input {...aria} className={`${control} ${height}`} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && !error && (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="mt-1.5 text-sm font-semibold text-pomegranate-deep">
          {error}
        </p>
      )}
    </div>
  );
}
