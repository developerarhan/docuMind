import { ArrowUpRight, Sparkles } from "lucide-react";
import { SUGGESTED_ACTIONS } from "../../features/chat/suggestions";
import { cn } from "../../utils/format";

interface ChatEmptyStateProps {
  documentTitle: string;
  onSelect: (prompt: string) => void;
  disabled: boolean;
}

export function ChatEmptyState({ documentTitle, onSelect, disabled }: ChatEmptyStateProps) {
  return (
    <div className="animate-fade-up px-1">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-night text-cream">
          <Sparkles className="size-3.5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-faint">
            Ask the document
          </p>
          <p className="text-[12.5px] font-medium leading-4 text-ink">Start a new thread</p>
        </div>
      </div>

      <h2 className="mt-5 font-serif text-[26px] leading-[1.12] tracking-[-0.02em] text-ink">
        What would you like to understand?
      </h2>
      <p className="mt-2 text-[12.5px] leading-5.5 text-muted">
        DocuMind reads{" "}
        <span className="font-medium text-ink-soft">“{documentTitle}”</span> and answers with
        citations to the pages it used. Pick a starting point, or ask your own question below.
      </p>

      <div className="mt-5 space-y-1.5">
        {SUGGESTED_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(action.prompt)}
              className={cn(
                "group flex w-full items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left shadow-[0_1px_1px_rgba(25,28,37,0.02)] transition-[border-color,background-color,box-shadow] duration-150",
                disabled
                  ? "cursor-not-allowed opacity-55"
                  : "hover:border-cobalt/30 hover:bg-cobalt-soft/25 hover:shadow-soft",
              )}
            >
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-line bg-paper text-muted transition-colors group-hover:border-cobalt/20 group-hover:bg-surface group-hover:text-cobalt">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-[12.5px] font-medium text-ink">
                  {action.label}
                  <ArrowUpRight
                    className="size-3 text-faint opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-4 text-muted">
                  {action.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 flex items-center gap-1.5 px-1 text-[9.5px] text-faint">
        <span className="size-1 rounded-full bg-positive" aria-hidden="true" />
        Answers are generated from this PDF. Check the cited pages for context.
      </p>
    </div>
  );
}
