import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../utils/format";

const controlClasses =
  "w-full rounded-lg border border-line-strong bg-surface text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-faint hover:border-[#c4bba7] focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/12 disabled:cursor-not-allowed disabled:bg-paper-deep disabled:text-muted";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClasses,
        "h-10 px-3",
        invalid && "border-danger/70 focus:border-danger focus:ring-danger/12",
        className,
      )}
      {...props}
    />
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClasses,
        "min-h-[92px] resize-y px-3 py-2.5 leading-6",
        invalid && "border-danger/70 focus:border-danger focus:ring-danger/12",
        className,
      )}
      {...props}
    />
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        controlClasses,
        "h-10 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23736e61%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_0.7rem_center] bg-no-repeat px-3 pr-9",
        invalid && "border-danger/70",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  label,
  className,
}: SearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          controlClasses,
          "h-9 pl-9 pr-8 text-[13px] [&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-faint transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
