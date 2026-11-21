import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/format";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "subtle";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-cobalt bg-cobalt text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(25,28,37,0.18)] hover:border-cobalt-dark hover:bg-cobalt-dark",
  secondary:
    "border border-line-strong bg-surface text-ink shadow-[0_1px_1px_rgba(25,28,37,0.03)] hover:border-line-strong hover:bg-paper-deep",
  ghost: "border border-transparent text-muted hover:bg-paper-deep hover:text-ink",
  danger:
    "border border-danger bg-danger text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#963a31]",
  dark: "border border-night bg-night text-cream hover:border-night-line hover:bg-night-raised",
  subtle: "border border-transparent bg-paper-deep text-ink hover:bg-[#e7e1d4]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-[12.5px]",
  md: "h-[38px] gap-2 rounded-lg px-3.5 text-[13px]",
  lg: "h-11 gap-2 rounded-lg px-5 text-sm",
  icon: "size-[38px] rounded-lg",
  "icon-sm": "size-8 rounded-md",
};

export function buttonClassName(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center font-medium tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-45",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClassName(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
