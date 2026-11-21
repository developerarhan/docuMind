import { cn } from "../../utils/format";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-[1.5px] border-current border-r-transparent opacity-70",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
