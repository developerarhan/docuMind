import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import type { ChatMessage } from "../../types/api";
import { cn } from "../../utils/format";
import { MarkdownAnswer } from "./MarkdownAnswer";
import { SourceList } from "./SourceList";

interface ChatMessageItemProps {
  message: ChatMessage;
  onSourceClick: (page: number) => void;
}

export function ChatMessageItem({ message, onSourceClick }: ChatMessageItemProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[88%] whitespace-pre-wrap rounded-lg rounded-br-[3px] border border-line-strong/80 bg-[#f0ebdf] px-3 py-2 text-[12.5px] leading-5 text-ink shadow-[0_1px_1px_rgba(25,28,37,0.03)]">
          {message.content}
        </div>
      </div>
    );
  }

  return <AssistantMessage message={message} onSourceClick={onSourceClick} />;
}

function AssistantMessage({ message, onSourceClick }: ChatMessageItemProps) {
  const { pushToast } = useToast();
  const [copied, setCopied] = useState(false);

  const hasCitationMarkers = /\[Source\s+\d+\]/i.test(message.content);
  const sourcesMissing = message.sources.length === 0 && hasCitationMarkers;

  const handleCopy = async () => {
    const sourceSummary = message.sources.length
      ? `\n\nSources: ${message.sources
          .map((source) => `[Source ${source.sourceId}] page ${source.page ?? "unknown"}`)
          .join(", ")}`
      : "";
    try {
      await navigator.clipboard.writeText(`${message.content}${sourceSummary}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      pushToast({
        title: "Couldn't copy answer",
        description: "Your browser blocked clipboard access.",
        variant: "error",
      });
    }
  };

  return (
    <article className="group/assistant animate-fade-up">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="grid size-5 place-items-center rounded-[5px] bg-night text-cream">
          <Sparkles className="size-2.5" aria-hidden="true" />
        </span>
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
          DocuMind
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={cn(
            "ml-auto inline-flex size-6 items-center justify-center rounded text-faint transition-[color,background-color,opacity] hover:bg-paper-deep hover:text-ink focus-visible:opacity-100",
            copied ? "opacity-100" : "opacity-0 group-hover/assistant:opacity-100",
          )}
          aria-label={copied ? "Answer copied" : "Copy answer"}
          title={copied ? "Copied" : "Copy answer"}
        >
          {copied ? (
            <Check className="size-3 text-positive" aria-hidden="true" />
          ) : (
            <Copy className="size-3" aria-hidden="true" />
          )}
        </button>
      </div>

      <MarkdownAnswer
        content={message.content}
        sources={message.sources}
        onSourceClick={onSourceClick}
      />

      <SourceList sources={message.sources} onSourceClick={onSourceClick} />

      {sourcesMissing ? (
        <p className="mt-2 text-[9px] italic text-faint">
          Source details aren't available for earlier messages.
        </p>
      ) : null}
    </article>
  );
}
