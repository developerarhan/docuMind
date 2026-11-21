import { cn } from "../../utils/format";

interface ProgressBarProps {
  value: number;
  label?: string;
  tone?: "cobalt" | "positive";
  className?: string;
}

export function ProgressBar({ value, label, tone = "cobalt", className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={className}>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-paper-deep"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        aria-label={label}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            tone === "cobalt" ? "bg-cobalt" : "bg-positive",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function IndeterminateBar({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-1 overflow-hidden rounded-full bg-paper-deep", className)}>
      <div className="absolute inset-y-0 w-1/3 animate-[shimmer_1.5s_linear_infinite] rounded-full bg-cobalt/60" />
    </div>
  );
}
