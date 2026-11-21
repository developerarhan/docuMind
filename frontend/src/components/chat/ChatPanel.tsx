import { useEffect, useRef } from "react";
import { History, Loader2, MessageSquarePlus, RotateCw, Sparkles } from "lucide-react";
import type { ChatRequestError } from "../../features/chat/useDocumentChat";
import type { ChatMessage, Document } from "../../types/api";
import { Alert } from "../ui/Alert";
import { Skeleton } from "../ui/Skeleton";
import { ChatComposer } from "./ChatComposer";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatNotReady } from "./ChatNotReady";

interface ChatPanelProps {
  document: Document;
  messages: ChatMessage[];
  conversationId: string | null;
  input: string;
  isLoadingHistory: boolean;
  historyError: string | null;
  isSending: boolean;
  sendError: ChatRequestError | null;
  isStartingProcessing: boolean;
  onInputChange: (value: string) => void;
  onSend: (question: string) => void;
  onRetry: () => void;
  onReloadHistory: () => void;
  onNewThread: () => void;
  onSourceClick: (page: number) => void;
  onStartProcessing: () => void;
  onDismissError: () => void;
}

export function ChatPanel({
  document,
  messages,
  conversationId,
  input,
  isLoadingHistory,
  historyError,
  isSending,
  sendError,
  isStartingProcessing,
  onInputChange,
  onSend,
  onRetry,
  onReloadHistory,
  onNewThread,
  onSourceClick,
  onStartProcessing,
  onDismissError,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastConversationKey = useRef<string>(conversationId ?? "draft");

  const isReady = document.status === "ready";
  const showEmpty = isReady && !isLoadingHistory && !historyError && messages.length === 0;

  useEffect(() => {
    const key = conversationId ?? "draft";
    const element = scrollRef.current;
    if (!element) return;

    const conversationChanged = lastConversationKey.current !== key;
    lastConversationKey.current = key;
    const behavior: ScrollBehavior = conversationChanged ? "auto" : "smooth";

    const frame = window.requestAnimationFrame(() => {
      element.scrollTo({ top: element.scrollHeight, behavior });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [conversationId, messages.length, isSending, isLoadingHistory, historyError]);

  return (
    <section
      aria-label="DocuMind assistant"
      className="flex h-full min-h-0 flex-col bg-paper/40"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <span className="grid size-5 place-items-center rounded-[5px] bg-night text-cream">
          <Sparkles className="size-2.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Assistant
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/70 px-1.5 py-0.5 text-[9px] font-medium text-muted">
          <History className="size-2.5" aria-hidden="true" />
          {conversationId ? "Saved thread" : "New thread"}
        </span>
        <button
          type="button"
          onClick={onNewThread}
          className="inline-flex size-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label="Start a new conversation"
          title="New conversation"
        >
          <MessageSquarePlus className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
        aria-live="polite"
        aria-busy={isLoadingHistory || isSending || undefined}
      >
        {!isReady ? (
          <div className="py-2">
            <ChatNotReady
              status={document.status}
              onStartProcessing={onStartProcessing}
              isStarting={isStartingProcessing}
            />
          </div>
        ) : isLoadingHistory ? (
          <HistorySkeleton />
        ) : historyError ? (
          <div className="py-2">
            <Alert title="Couldn't load this thread">
              <p>{historyError}</p>
              <button
                type="button"
                onClick={onReloadHistory}
                className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-2"
              >
                <RotateCw className="size-3" aria-hidden="true" />
                Try again
              </button>
            </Alert>
          </div>
        ) : showEmpty ? (
          <ChatEmptyState
            documentTitle={document.title}
            onSelect={onSend}
            disabled={isSending}
          />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
                {conversationId ? "Earlier in this thread" : "This conversation"}
              </span>
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
            </div>

            {messages.map((message) => (
              <ChatMessageItem
                key={message.id}
                message={message}
                onSourceClick={onSourceClick}
              />
            ))}

            {isSending ? <ThinkingIndicator /> : null}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 px-3 pt-0">
        {sendError ? (
          <div className="pt-2.5">
            <Alert variant="error" title="That question didn't go through">
              <p>{sendError.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                >
                  <RotateCw className="size-3" aria-hidden="true" />
                  Retry question
                </button>
                <button
                  type="button"
                  onClick={onDismissError}
                  className="text-[11px] text-muted underline underline-offset-2 hover:text-ink"
                >
                  Dismiss
                </button>
              </div>
            </Alert>
          </div>
        ) : null}
      </div>

      <ChatComposer
        value={input}
        onChange={onInputChange}
        onSubmit={onSend}
        disabled={!isReady || isLoadingHistory || Boolean(historyError)}
        isSending={isSending}
        placeholder={
          !isReady
            ? "Chat unlocks when this document is ready"
            : conversationId
              ? "Ask a follow-up question…"
              : "Ask anything about this document…"
        }
      />
    </section>
  );
}

function ThinkingIndicator() {
  return (
    <div className="animate-fade-up" aria-label="DocuMind is reading the document">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="grid size-5 place-items-center rounded-[5px] bg-night text-cream">
          <Sparkles className="size-2.5" aria-hidden="true" />
        </span>
        <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
          DocuMind
        </span>
      </div>
      <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] text-muted shadow-[0_1px_1px_rgba(25,28,37,0.03)]">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="size-1 animate-blink rounded-full bg-cobalt" />
          <span className="size-1 animate-blink rounded-full bg-cobalt [animation-delay:160ms]" />
          <span className="size-1 animate-blink rounded-full bg-cobalt [animation-delay:320ms]" />
        </span>
        Reading the document and checking sources…
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-24" />
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-14 w-[68%] rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-5 rounded-[5px]" />
          <Skeleton className="h-2 w-16" />
        </div>
        <Skeleton className="h-3 w-[92%]" />
        <Skeleton className="h-3 w-[86%]" />
        <Skeleton className="h-3 w-[55%]" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-[58%] rounded-lg" />
      </div>
      <div className="flex items-center gap-2 text-[10px] text-faint">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        Loading earlier messages…
      </div>
    </div>
  );
}
