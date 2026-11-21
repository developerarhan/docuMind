import type { DocumentStatus } from "../../types/api";
import { cn } from "../../utils/format";

export type DocumentFilter = "all" | DocumentStatus;

const filters: Array<{ value: DocumentFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

interface DocumentFilterTabsProps {
  value: DocumentFilter;
  onChange: (value: DocumentFilter) => void;
  counts: Record<DocumentFilter, number>;
  className?: string;
}

export function DocumentFilterTabs({
  value,
  onChange,
  counts,
  className,
}: DocumentFilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter documents by status"
      className={cn(
        "hide-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-paper-deep/70 p-0.5",
        className,
      )}
    >
      {filters.map((filter) => {
        const active = filter.value === value;
        const count = counts[filter.value];
        return (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter.value)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 text-[11.5px] font-medium transition-[background-color,color,box-shadow] duration-150",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(25,28,37,0.08)]"
                : "text-muted hover:text-ink",
            )}
          >
            {filter.label}
            <span
              className={cn(
                "text-[9.5px] tabular-nums",
                active ? "text-faint" : "text-faint/80",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function getFilterCounts(
  documents: Array<{ status: DocumentStatus }>,
): Record<DocumentFilter, number> {
  const counts: Record<DocumentFilter, number> = {
    all: documents.length,
    ready: 0,
    processing: 0,
    pending: 0,
    failed: 0,
  };

  for (const document of documents) {
    counts[document.status] += 1;
  }

  return counts;
}
