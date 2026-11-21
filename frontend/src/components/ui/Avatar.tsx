import { getInitials } from "../../utils/format";
import { cn } from "../../utils/format";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "cobalt" | "dark";
  className?: string;
}

export function Avatar({ name, size = "md", tone = "cobalt", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tracking-[-0.02em] select-none",
        size === "sm" && "size-6 text-[9px]",
        size === "md" && "size-7 text-[10px]",
        size === "lg" && "size-10 text-xs",
        tone === "cobalt" && "bg-cobalt-soft text-cobalt-dark ring-1 ring-cobalt/12",
        tone === "dark" && "bg-white/8 text-cream ring-1 ring-white/10",
        className,
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}
