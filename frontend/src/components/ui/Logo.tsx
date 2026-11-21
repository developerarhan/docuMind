import { cn } from "../../utils/format";

interface LogoProps {
  tone?: "light" | "dark";
  showWordmark?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function Logo({ tone = "light", showWordmark = true, className, size = "md" }: LogoProps) {
  return (
    <span className={cn("inline-flex select-none items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative grid shrink-0 place-items-center rounded-[8px] bg-cobalt shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(25,28,37,0.18)]",
          size === "md" ? "size-7" : "size-6",
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 20 20" className={size === "md" ? "size-[17px]" : "size-[15px]"}>
          <path d="M4.6 2.4h7.1l3.3 3.3v11.9H4.6z" fill="#F4F0E6" />
          <path d="M11.7 2.4v3.3h3.3" fill="#C9C2B2" />
          <circle cx="9.8" cy="10.8" r="1.45" fill="#131824" />
          <path d="M9.8 12.25v1.85" stroke="#131824" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </span>
      {showWordmark ? (
        <span
          className={cn(
            "text-[15px] font-semibold tracking-[-0.03em]",
            tone === "dark" ? "text-cream" : "text-ink",
          )}
        >
          DocuMind
        </span>
      ) : null}
    </span>
  );
}
