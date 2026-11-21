import type { DocumentStatus } from "../../types/api";
import { cn } from "../../utils/format";

const statusConfig: Record<
  DocumentStatus,
  { label: string; dot: string; badge: string; pulse?: boolean }
> = {
  pending: {
    label: "Pending",
    dot: "bg-warning",
    badge: "border-warning/20 bg-warning-soft text-warning",
  },
  processing: {
    label: "Processing",
    dot: "bg-cobalt",
    badge: "border-cobalt/20 bg-cobalt-soft text-cobalt-dark",
    pulse: true,
  },
  ready: {
    label: "Ready",
    dot: "bg-positive",
    badge: "border-positive/20 bg-positive-soft text-positive",
  },
  failed: {
    label: "Failed",
    dot: "bg-danger",
    badge: "border-danger/20 bg-danger-soft text-danger",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px] text-[10.5px] font-medium tracking-[0.01em]",
        config.badge,
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          config.dot,
          config.pulse && "animate-pulse-dot",
        )}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: DocumentStatus; className?: string }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        config.dot,
        config.pulse && "animate-pulse-dot",
        className,
      )}
      title={config.label}
      aria-label={`Status: ${config.label}`}
    />
  );
}
