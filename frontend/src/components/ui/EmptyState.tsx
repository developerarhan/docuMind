import type { ElementType, ReactNode } from "react";
import { cn } from "../../utils/format";

interface EmptyStateProps {
  icon: ElementType<{ className?: string; "aria-hidden"?: boolean }>;
  eyebrow?: string;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  variant?: "card" | "plain";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  variant = "plain",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-12 text-center",
        variant === "card" &&
          "rounded-xl border border-dashed border-line-strong bg-surface/55 py-14",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-xl border border-line bg-surface text-muted shadow-[0_1px_2px_rgba(25,28,37,0.04)]">
        <Icon className="size-4.5" aria-hidden={true} />
      </span>
      {eyebrow ? (
        <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.16em] text-faint">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-1.5 font-serif text-[22px] leading-tight tracking-[-0.02em] text-ink">
        {title}
      </h3>
      <div className="mt-2 max-w-sm text-[13px] leading-5.5 text-muted">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
