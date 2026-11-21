import type { ReactNode } from "react";
import { cn } from "../../utils/format";

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.17em] text-muted">
            <span className="h-px w-5 bg-line-strong" aria-hidden="true" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-[34px] leading-[1.06] tracking-[-0.025em] text-ink sm:text-[40px]">
          {title}
        </h1>
        {description ? (
          <div className="mt-2.5 max-w-2xl text-[13.5px] leading-6 text-muted">{description}</div>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
