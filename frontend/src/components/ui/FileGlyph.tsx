import { cn } from "../../utils/format";

export function FileGlyph({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-md border border-line bg-surface shadow-[0_1px_2px_rgba(25,28,37,0.05)]",
        size === "sm" && "size-8",
        size === "md" && "size-10",
        size === "lg" && "size-14 rounded-lg",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={cn(
          size === "sm" && "size-4",
          size === "md" && "size-5",
          size === "lg" && "size-7",
        )}
      >
        <path
          d="M6.2 3.2h7.1l4.5 4.5v13.1H6.2z"
          stroke="currentColor"
          className="text-ink/55"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M13.3 3.2v4.5h4.5"
          stroke="currentColor"
          className="text-ink/35"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <path
          d="M9 12h6M9 14.6h6M9 17.2h3.6"
          stroke="currentColor"
          className="text-ink/25"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          "absolute font-semibold tracking-[0.08em] text-danger/80",
          size === "lg" ? "bottom-2 text-[7px]" : "bottom-1 text-[5.5px]",
        )}
      >
        PDF
      </span>
    </span>
  );
}
