import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  FileWarning,
  LibraryBig,
  Loader2,
  MessageSquareText,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChatPanel } from "../components/chat/ChatPanel";
import { DeleteDocumentDialog } from "../components/documents/DeleteDocumentDialog";
import { Button, buttonClassName } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { FileGlyph } from "../components/ui/FileGlyph";
import { Skeleton } from "../components/ui/Skeleton";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useConversations } from "../context/ConversationContext";
import { useDocuments } from "../context/DocumentContext";
import { useToast } from "../context/ToastContext";
import { useDocumentChat } from "../features/chat/useDocumentChat";
import { usePageTitle } from "../hooks/usePageTitle";
import { resolveMediaUrl } from "../services/api/client";
import { getErrorMessage } from "../services/api/errors";
import type { Document } from "../types/api";
import { cn, formatDate, formatFileSize } from "../utils/format";
import { PdfReader } from "../components/documents/PdfReader";

type WorkspaceView = "reader" | "assistant";

export function DocumentWorkspacePage() {
  const { documentId } = useParams();
  const { documents, isLoading, hasLoaded, error, refresh } = useDocuments();
  const navigate = useNavigate();

  const numericId = Number(documentId);
  const isValidId = Number.isInteger(numericId) && numericId > 0;
  const document = isValidId
    ? (documents.find((item) => item.id === numericId) ?? null)
    : null;
  const isResolving = isValidId && !document && !hasLoaded && !error;

  usePageTitle(document?.title ?? "Document");

  if (!isValidId) {
    return <MissingDocument />;
  }

  if (isResolving) {
    return <WorkspaceSkeleton />;
  }

  if (!document) {
    return error ? (
      <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center px-5 py-10 lg:min-h-dvh">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl border border-danger/15 bg-danger-soft text-danger">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-serif text-[28px] leading-tight tracking-[-0.02em] text-ink">
            Couldn't load your library
          </h1>
          <p className="mt-2 text-[13px] leading-6 text-muted">{error}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void refresh()}
              disabled={isLoading}
            >
              <RotateCw
                className={cn("size-4", isLoading && "animate-spin")}
                aria-hidden="true"
              />
              Try again
            </Button>
            <Button onClick={() => navigate("/documents")}>
              <LibraryBig className="size-4" aria-hidden="true" />
              Library
            </Button>
          </div>
        </div>
      </div>
    ) : (
      <MissingDocument />
    );
  }

  return <Workspace document={document} />;
}

function Workspace({ document: doc }: { document: Document }) {
  const { retryProcessing, refresh } = useDocuments();
  const { conversations, refresh: refreshConversations } = useConversations();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [view, setView] = useState<WorkspaceView>("reader");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const isNewThread = searchParams.get("new") === "1";
  const requestedConversationId = isNewThread ? null : searchParams.get("c");

  const belongsToAnotherDocument = useMemo(
    () =>
      requestedConversationId !== null &&
      conversations.some(
        (conversation) =>
          conversation.id === requestedConversationId && conversation.document.id !== doc.id,
      ),
    [conversations, requestedConversationId, doc.id],
  );

  const conversationId =
    requestedConversationId && !belongsToAnotherDocument ? requestedConversationId : null;

  const onConversationCreated = useCallback(
    (createdId: string) => {
      navigate(`/documents/${doc.id}?c=${createdId}`, { replace: true });
    },
    [doc.id, navigate],
  );

  const onConversationsChanged = useCallback(() => {
    void refreshConversations({ silent: true });
  }, [refreshConversations]);

  const {
    messages,
    input,
    setInput,
    isLoadingHistory,
    historyError,
    isSending,
    sendError,
    send,
    retry,
    reloadHistory,
    startNewConversation,
    dismissError,
  } = useDocumentChat({
    document: doc,
    conversationId,
    onConversationCreated,
    onConversationsChanged,
  });

  useEffect(() => {
    if (!isNewThread) return;
    startNewConversation();
    navigate(`/documents/${doc.id}`, { replace: true });
  }, [isNewThread, startNewConversation, navigate, doc.id]);

  useEffect(() => {
    if (!belongsToAnotherDocument) return;
    setSearchParams({}, { replace: true });
  }, [belongsToAnotherDocument, setSearchParams]);

  const fileUrl = resolveMediaUrl(doc.file);

  const handleSourceClick = useCallback((targetPage: number) => {
    setPage(targetPage);
    if (!window.matchMedia("(min-width: 1280px)").matches) {
      setView("reader");
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  const handleNewThread = useCallback(() => {
    startNewConversation();
    setView("assistant");
    navigate(`/documents/${doc.id}`, { replace: true });
  }, [startNewConversation, navigate, doc.id]);

  const handleStartProcessing = async () => {
    setIsStarting(true);
    try {
      await retryProcessing(doc.id);
      pushToast({
        title: doc.status === "failed" ? "Processing restarted" : "Processing started",
        description: "The assistant will unlock when indexing finishes.",
        variant: "info",
      });
    } catch (caught) {
      pushToast({
        title: "Couldn't start processing",
        description: getErrorMessage(caught),
        variant: "error",
      });
      void refresh({ silent: true });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-paper lg:h-dvh">
      <header className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4">
        <Link
          to="/documents"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-paper-deep hover:text-ink"
          aria-label="Back to library"
          title="Back to library"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>

        <FileGlyph size="sm" className="shrink-0" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-[17px] leading-tight tracking-[-0.015em] text-ink sm:text-[19px]">
            {doc.title}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[9.5px] text-faint">
            <span>PDF</span>
            <span className="size-0.5 rounded-full bg-line-strong" aria-hidden="true" />
            <span>{formatFileSize(doc.file_size)}</span>
            <span className="size-0.5 rounded-full bg-line-strong" aria-hidden="true" />
            <span className="hidden sm:inline">Added {formatDate(doc.created_at)}</span>
            <span className="sm:hidden">{formatDate(doc.created_at)}</span>
          </p>
        </div>

        <StatusBadge status={doc.status} className="hidden sm:inline-flex" />

        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-soft hover:text-danger"
          aria-label={`Delete ${doc.title}`}
          title="Delete document"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </header>

      {doc.status !== "ready" ? (
        <StatusBanner
          document={doc}
          isStarting={isStarting}
          onStartProcessing={() => void handleStartProcessing()}
        />
      ) : null}

      <div className="flex shrink-0 border-b border-line bg-surface xl:hidden">
        <ViewTab
          active={view === "reader"}
          icon={BookOpen}
          label="Reader"
          onClick={() => setView("reader")}
        />
        <ViewTab
          active={view === "assistant"}
          icon={Sparkles}
          label="Assistant"
          badge={messages.length > 0 ? messages.length : undefined}
          onClick={() => setView("assistant")}
        />
      </div>

      <div className="min-h-0 flex-1 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,34vw)]">
        <div
          className={cn(
            "min-h-0 flex-col",
            view === "reader" ? "flex" : "hidden",
            "xl:flex",
          )}
          aria-label="Document reader"
        >
          <PdfReader
            document={doc}
            fileUrl={fileUrl}
            page={page}
            onPageChange={setPage}
          />
        </div>

        <div
          className={cn(
            "min-h-0 flex-col border-line",
            view === "assistant" ? "flex" : "hidden",
            "xl:flex xl:border-l",
          )}
          aria-label="Document assistant"
        >
          <ChatPanel
            document={doc}
            messages={messages}
            conversationId={conversationId}
            input={input}
            isLoadingHistory={isLoadingHistory}
            historyError={historyError}
            isSending={isSending}
            sendError={sendError}
            isStartingProcessing={isStarting}
            onInputChange={setInput}
            onSend={(question) => void send(question)}
            onRetry={() => void retry()}
            onReloadHistory={reloadHistory}
            onNewThread={handleNewThread}
            onSourceClick={handleSourceClick}
            onStartProcessing={() => void handleStartProcessing()}
            onDismissError={dismissError}
          />
        </div>
      </div>

      <DeleteDocumentDialog
        document={deleteOpen ? doc : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => navigate("/documents", { replace: true })}
      />
    </div>
  );
}

function ViewTab({
  active,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: typeof BookOpen;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex h-10 flex-1 items-center justify-center gap-1.5 text-[11.5px] font-medium transition-colors",
        active ? "text-ink" : "text-muted hover:text-ink",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      {typeof badge === "number" ? (
        <span className="rounded-full bg-paper-deep px-1.5 text-[9px] tabular-nums text-muted">
          {badge}
        </span>
      ) : null}
      {active ? (
        <span
          className="absolute inset-x-6 bottom-0 h-[2px] rounded-t-full bg-cobalt"
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}

function StatusBanner({
  document: doc,
  isStarting,
  onStartProcessing,
}: {
  document: Document;
  isStarting: boolean;
  onStartProcessing: () => void;
}) {
  const canStart = doc.status === "pending" || doc.status === "failed";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-[10.5px] sm:px-4",
        doc.status === "failed"
          ? "border-danger/15 bg-danger-soft/70 text-danger"
          : doc.status === "processing"
            ? "border-cobalt/15 bg-cobalt-soft/60 text-cobalt-dark"
            : "border-warning/15 bg-warning-soft/70 text-warning",
      )}
    >
      {doc.status === "processing" ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
      ) : doc.status === "failed" ? (
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <FileWarning className="size-3.5 shrink-0" aria-hidden="true" />
      )}

      <p className="min-w-0 flex-1 truncate">
        {doc.status === "processing"
          ? "Indexing this document. The assistant unlocks automatically when it's ready."
          : doc.status === "failed"
            ? "Indexing failed. Retry processing to enable the assistant."
            : "This document is waiting to be processed."}
      </p>

      {canStart ? (
        <button
          type="button"
          onClick={onStartProcessing}
          disabled={isStarting}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-current/25 bg-surface/70 px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-surface disabled:opacity-55"
        >
          {isStarting ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCw className="size-3" aria-hidden="true" />
          )}
          {doc.status === "failed" ? "Retry" : "Start"}
        </button>
      ) : (
        <span className="hidden shrink-0 items-center gap-1 text-[9.5px] opacity-80 sm:inline-flex">
          <MessageSquareText className="size-3" aria-hidden="true" />
          Updates automatically
        </span>
      )}
    </div>
  );
}

function MissingDocument() {
  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center px-5 py-10 lg:min-h-dvh">
      <div className="w-full max-w-md">
        <EmptyState
          variant="card"
          icon={FileWarning}
          eyebrow="Not in your library"
          title="We couldn't find that document"
          description="It may have been deleted, or the link points to a document that belongs to another account. Pick a PDF from your library to continue."
          action={
            <Link to="/documents" className={buttonClassName("primary", "md")}>
              <LibraryBig className="size-4" aria-hidden="true" />
              Back to library
            </Link>
          }
          className="paper-grid"
        />
      </div>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden lg:h-dvh">
      <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-48 max-w-[55%]" />
          <Skeleton className="h-2 w-32 opacity-70" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,34vw)]">
        <div className="paper-grid grid place-items-center bg-[#e9e3d7] p-6">
          <div className="aspect-[0.72] w-full max-w-[420px] overflow-hidden rounded-sm bg-white shadow-[0_18px_50px_-26px_rgba(25,28,37,0.5)]">
            <Skeleton className="size-full rounded-none opacity-60" />
          </div>
        </div>
        <div className="hidden min-h-0 flex-col border-l border-line bg-surface xl:flex">
          <div className="flex h-11 items-center gap-2 border-b border-line px-3">
            <Skeleton className="size-5 rounded-[5px]" />
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="ml-auto h-4 w-16 rounded-full" />
          </div>
          <div className="flex-1 space-y-4 p-4">
            <Skeleton className="h-3 w-[88%]" />
            <Skeleton className="h-3 w-[72%]" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-3 w-[64%]" />
            <Skeleton className="h-3 w-[80%]" />
          </div>
        </div>
      </div>
    </div>
  );
}
