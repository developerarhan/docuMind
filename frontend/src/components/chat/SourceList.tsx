import { BookOpen } from "lucide-react";
import type { ChatSource } from "../../types/api";

interface SourceListProps {
  sources: ChatSource[];
  onSourceClick: (page: number) => void;
}

export function SourceList({ sources, onSourceClick }: SourceListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-line/80 pt-2.5">
      <p className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
        <BookOpen className="size-3" aria-hidden="true" />
        Sources used
        <span className="font-normal tracking-normal text-faint/80">({sources.length})</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {sources.map((source) => {
          const available = source.page !== null;
          return (
            <button
              key={source.sourceId}
              type="button"
              disabled={!available}
              onClick={() => {
                if (source.page !== null) onSourceClick(source.page);
              }}
              className="group inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-1 text-[9.5px] text-muted transition-colors hover:border-cobalt/30 hover:bg-cobalt-soft/40 hover:text-ink disabled:cursor-default disabled:hover:border-line disabled:hover:bg-surface disabled:hover:text-muted"
              title={
                available
                  ? `Open source ${source.sourceId} on page ${source.page} · relevance ${source.relevanceScore.toFixed(2)}`
                  : `Source ${source.sourceId} · page unavailable`
              }
            >
              <span className="grid size-4 place-items-center rounded bg-cobalt-soft text-[8px] font-semibold text-cobalt-dark">
                {source.sourceId}
              </span>
              {available ? `Page ${source.page}` : "Page unavailable"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
