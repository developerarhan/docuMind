import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../utils/format";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
}

export function PasswordInput({ className, invalid, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 pr-10 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-[border-color,box-shadow] placeholder:text-faint hover:border-[#c4bba7] focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/12",
          invalid && "border-danger/70 focus:border-danger focus:ring-danger/12",
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-faint transition-colors hover:bg-paper-deep hover:text-ink"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={0}
      >
        {visible ? (
          <EyeOff className="size-3.5" aria-hidden="true" />
        ) : (
          <Eye className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
