import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../utils/format";

type AlertVariant = "error" | "info" | "success";

const config: Record<
  AlertVariant,
  { icon: typeof AlertCircle; className: string; iconClassName: string }
> = {
  error: {
    icon: AlertCircle,
    className: "border-danger/20 bg-danger-soft text-danger",
    iconClassName: "text-danger",
  },
  info: {
    icon: Info,
    className: "border-cobalt/15 bg-cobalt-soft text-ink-soft",
    iconClassName: "text-cobalt",
  },
  success: {
    icon: CheckCircle2,
    className: "border-positive/20 bg-positive-soft text-ink-soft",
    iconClassName: "text-positive",
  },
};

export function Alert({
  variant = "error",
  title,
  children,
  className,
}: {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const item = config[variant];
  const Icon = item.icon;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5", item.className, className)}
    >
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", item.iconClassName)} aria-hidden="true" />
      <div className="min-w-0 text-[12px] leading-5">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title && "mt-0.5 opacity-90")}>{children}</div>
      </div>
    </div>
  );
}
