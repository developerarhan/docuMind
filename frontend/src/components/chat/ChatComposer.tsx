import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "../../utils/format";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (question: string) => void;
  disabled: boolean;
  isSending: boolean;
  placeholder: string;
}

const MAX_HEIGHT = 148;
const MIN_HEIGHT = 38;

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  isSending,
  placeholder,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();
  const canSubmit = value.trim().length > 0 && !disabled && !isSending;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    if (textarea.scrollHeight === 0) {
      textarea.style.height = "";
      return;
    }
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
  }, [value]);

  const submit = () => {
    const question = value.trim();
    if (!question || disabled || isSending) return;
    onSubmit(question);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface px-3 pb-3 pt-2.5">
      <div
        className={cn(
          "rounded-xl border bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition-[border-color,box-shadow] duration-150",
          disabled
            ? "border-line bg-paper/60"
            : "border-line-strong focus-within:border-cobalt/70 focus-within:ring-2 focus-within:ring-cobalt/10",
        )}
      >
        <label htmlFor="chat-question" className="sr-only">
          Ask a question about this document
        </label>
        <textarea
          ref={textareaRef}
          id="chat-question"
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={hintId}
          className="scroll-thin block max-h-[148px] min-h-[38px] w-full resize-none bg-transparent px-3 pb-1 pt-2.5 text-[13px] leading-6 text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed disabled:text-muted"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <p id={hintId} className="truncate pl-1 text-[9.5px] text-faint">
            {isSending
              ? "Reading the document…"
              : "Enter to send · Shift + Enter for a new line"}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            aria-label="Send question"
            title="Send question"
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,opacity] duration-150",
              canSubmit
                ? "bg-cobalt text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-cobalt-dark"
                : "bg-paper-deep text-faint",
            )}
          >
            {isSending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <p className="mt-1.5 px-1 text-[9px] leading-4 text-faint">
        Answers come from this document only, with page-level citations where available.
      </p>
    </div>
  );
}
