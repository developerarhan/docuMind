import type { ReactNode } from "react";
import { cn } from "../../utils/format";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  optional,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[12.5px] font-medium tracking-[-0.01em] text-ink"
        >
          {label}
        </label>
        {optional ? (
          <span className="text-[11px] text-faint">Optional</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-[11.5px] leading-4 text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] leading-4 text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
