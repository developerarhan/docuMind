import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  MessageSquareText,
  Plus,
  SearchX,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConversations } from "../context/ConversationContext";
import { useDocuments } from "../context/DocumentContext";
import { useToast } from "../context/ToastContext";
import { useUpload } from "../context/UploadContext";
import { getErrorMessage } from "../services/api/errors";
import type { Document } from "../types/api";
import { formatDate, formatFileSize, formatGreeting, formatLongDate, formatRelativeTime, pluralize } from "../utils/format";
import { Button, buttonClassName } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { SearchField } from "../components/ui/Input";
import { StatusBadge } from "../components/ui/StatusBadge";
import { FileGlyph } from "../components/ui/FileGlyph";
import { EmptyState } from "../components/ui/EmptyState";
import { Alert } from "../components/ui/Alert";
import { Skeleton } from "../components/ui/Skeleton";
import { IndeterminateBar } from "../components/ui/ProgressBar";
import { DocumentRow } from "../components/documents/DocumentRow";
import { DeleteDocumentDialog } from "../components/documents/DeleteDocumentDialog";
import {
  DocumentFilterTabs,
  getFilterCounts,
  type DocumentFilter,
} from "../components/documents/DocumentFilterTabs";
import { DocumentListSkeleton } from "../components/documents/DocumentListSkeleton";
import { filterDocuments } from "../features/documents/filterDocuments";

export function DashboardPage() {
  const { user } = useAuth();
  const {
    documents,
    isLoading,
    hasLoaded,
    error,
    refresh,
    retryProcessing,
  } = useDocuments();
  const { conversations, isLoading: conversationsLoading } = useConversations();
  const { openUpload } = useUpload();
  const { pushToast } = useToast();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DocumentFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const filteredDocuments = useMemo(
    () => filterDocuments(documents, { query, status: filter }),
    [documents, query, filter],
  );

  const counts = useMemo(() => getFilterCounts(documents), [documents]);
  const readyDocument = useMemo(
    () => documents.find((document) => document.status === "ready") ?? null,
    [documents],
  );
  const activeDocuments = useMemo(
    () => documents.filter((doc) => doc.status === "processing" || doc.status === "pending"),
    [documents],
  );

  const recentDocuments = filteredDocuments.slice(0, 5);
  const recentConversations = conversations.slice(0, 4);

  const handleRetry = async (document: Document) => {
    setRetryingId(document.id);
    try {
      await retryProcessing(document.id);
      pushToast({
        title: "Processing restarted",
        description: "The document will be ready shortly.",
        variant: "info",
      });
    } catch (caught) {
      pushToast({
        title: "Couldn't restart processing",
        description: getErrorMessage(caught),
        variant: "error",
      });
    } finally {
      setRetryingId(null);
    }
  };

  const greeting = formatGreeting();
  const username = user?.username ?? "there";

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-11">
      <PageHeader
        eyebrow={formatLongDate()}
        title={
          <>
            {greeting}, <span className="text-ink">{username}</span>.
          </>
        }
        description={
          documents.length === 0
            ? "Your reading desk is ready. Add a PDF to begin asking questions with answers grounded in the page."
            : `${counts.ready} ${pluralize(counts.ready, "document")} ready to explore. Your library, recent threads, and active processing live here.`
        }
        actions={
          <>
            <Link to="/documents" className={buttonClassName("secondary", "md")}>
              Browse library
            </Link>
            <Button onClick={openUpload}>
              <Plus className="size-4" aria-hidden="true" />
              Add document
            </Button>
          </>
        }
      />

      {documents.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-line/80 py-2.5">
          <Metric value={counts.all} label={pluralize(counts.all, "document")} />
          <Metric value={counts.ready} label="ready" />
          <Metric value={counts.processing + counts.pending} label="in queue" />
          <Metric value={conversations.length} label={pluralize(conversations.length, "conversation")} />
          <span className="ml-auto hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.13em] text-faint sm:flex">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-positive" aria-hidden="true" />
            Live status
          </span>
        </div>
      ) : null}

      {error ? (
        <Alert
          className="mt-6"
          title="Couldn't load your library"
        >
          <div className="flex flex-wrap items-center gap-2">
            {error}
            <button
              type="button"
              onClick={() => void refresh()}
              className="font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        </Alert>
      ) : null}

      {isLoading && !hasLoaded ? (
        <DashboardLoading />
      ) : documents.length === 0 ? (
        <DashboardEmpty onUpload={openUpload} />
      ) : (
        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="min-w-0 space-y-6">
            {readyDocument ? <ReadySpotlight document={readyDocument} /> : null}

            <section aria-labelledby="library-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2
                    id="library-heading"
                    className="text-[13px] font-semibold tracking-[-0.01em] text-ink"
                  >
                    Your library
                  </h2>
                  <p className="mt-0.5 text-[11.5px] text-muted">
                    Recently added documents and their processing state.
                  </p>
                </div>
                <Link
                  to="/documents"
                  className="inline-flex items-center gap-1 self-start text-[11.5px] font-medium text-muted transition-colors hover:text-ink sm:self-auto"
                >
                  View all
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <SearchField
                  value={query}
                  onChange={setQuery}
                  label="Search documents"
                  placeholder="Search by title…"
                  className="w-full sm:max-w-[240px]"
                />
                <DocumentFilterTabs
                  value={filter}
                  onChange={setFilter}
                  counts={counts}
                  className="sm:ml-auto"
                />
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
                {recentDocuments.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No documents match"
                    description="Try a different title or clear the status filter."
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                    className="py-10"
                  />
                ) : (
                  <ul className="divide-y divide-line/80">
                    {recentDocuments.map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        onRequestDelete={setDeleteTarget}
                        onRetry={(doc) => void handleRetry(doc)}
                        retrying={retryingId === document.id}
                      />
                    ))}
                  </ul>
                )}
              </div>
              {filteredDocuments.length > 5 ? (
                <p className="mt-2 px-1 text-[10.5px] text-faint">
                  Showing 5 of {filteredDocuments.length} {pluralize(filteredDocuments.length, "document")}.{" "}
                  <Link to="/documents" className="text-muted underline underline-offset-2 hover:text-ink">
                    Open the library
                  </Link>
                </p>
              ) : null}
            </section>
          </div>

          <aside className="space-y-4" aria-label="Workspace utilities">
            <UploadCard onUpload={openUpload} />

            {activeDocuments.length > 0 ? (
              <section className="rounded-xl border border-line bg-surface p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <h2 className="text-[12px] font-semibold text-ink">In the queue</h2>
                  <span className="text-[9.5px] uppercase tracking-[0.12em] text-faint">
                    {activeDocuments.length} active
                  </span>
                </div>
                <ul className="mt-3 space-y-3">
                  {activeDocuments.slice(0, 3).map((document) => (
                    <li key={document.id}>
                      <Link
                        to={`/documents/${document.id}`}
                        className="group block"
                      >
                        <div className="flex items-start gap-2.5">
                          <FileGlyph size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11.5px] font-medium text-ink group-hover:text-cobalt-dark">
                              {document.title}
                            </p>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <StatusBadge status={document.status} />
                              <span className="text-[9px] text-faint">
                                {formatRelativeTime(document.updated_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <IndeterminateBar className="mt-2 h-0.5 opacity-70" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {activeDocuments.length > 3 ? (
                  <Link
                    to="/documents"
                    className="mt-3 inline-flex items-center gap-1 text-[10.5px] text-muted hover:text-ink"
                  >
                    View the full queue
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </Link>
                ) : null}
              </section>
            ) : null}

            <section className="rounded-xl border border-line bg-surface p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="text-[12px] font-semibold text-ink">Recent conversations</h2>
                <Link
                  to="/conversations"
                  className="text-faint transition-colors hover:text-ink"
                  aria-label="View all conversations"
                >
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>

              {conversationsLoading && conversations.length === 0 ? (
                <div className="mt-3 space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-[85%]" />
                </div>
              ) : recentConversations.length === 0 ? (
                <p className="mt-2 text-[11px] leading-4.5 text-muted">
                  No conversations yet. Open a ready document and ask the first question.
                </p>
              ) : (
                <ul className="mt-2.5 space-y-0.5">
                  {recentConversations.map((conversation) => (
                    <li key={conversation.id}>
                      <Link
                        to={`/documents/${conversation.document.id}?c=${conversation.id}`}
                        className="group -mx-1.5 flex items-start gap-2.5 rounded-md px-1.5 py-2 transition-colors hover:bg-paper/70"
                      >
                        <MessageSquareText
                          className="mt-0.5 size-3.5 shrink-0 text-faint"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] font-medium text-ink group-hover:text-cobalt-dark">
                            {conversation.document.title}
                          </span>
                          <span className="mt-0.5 block text-[9.5px] text-faint">
                            Updated {formatRelativeTime(conversation.updated_at)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="rounded-xl border border-dashed border-line-strong/80 px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
                <Sparkles className="size-3 text-cobalt" aria-hidden="true" />
                Reading tip
              </p>
              <p className="mt-1.5 text-[11px] leading-4.5 text-muted">
                Select a citation in an assistant answer to jump straight to the page it came
                from.
              </p>
            </div>
          </aside>
        </div>
      )}

      <DeleteDocumentDialog
        document={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
        {value}
      </span>
      <span className="text-[10.5px] uppercase tracking-[0.1em] text-muted">{label}</span>
    </span>
  );
}

function ReadySpotlight({ document }: { document: Document }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
      <div className="relative z-10 max-w-[70%] p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[9.5px] font-medium uppercase tracking-[0.16em] text-cobalt">
          <BookOpen className="size-3" aria-hidden="true" />
          Ready to read
        </p>
        <h2 className="mt-2 line-clamp-2 font-serif text-[25px] leading-[1.14] tracking-[-0.02em] text-ink">
          {document.title}
        </h2>
        <p className="mt-2 text-[11px] text-muted">
          {formatFileSize(document.file_size)} · Added {formatDate(document.created_at)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link to={`/documents/${document.id}`} className={buttonClassName("primary", "sm")}>
            Open workspace
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <StatusBadge status={document.status} />
        </div>
      </div>

      <div
        className="absolute -right-3 top-1/2 hidden h-[168px] w-[190px] -translate-y-1/2 md:block"
        aria-hidden="true"
      >
        <div className="absolute right-3 top-2 h-full w-[140px] rotate-[2.5deg] rounded-md border border-line bg-[#f3eee3]" />
        <div className="absolute right-6 top-4 h-full w-[140px] rotate-[-1.5deg] rounded-md border border-line bg-[#fbf8f1] p-4 shadow-[0_8px_24px_-16px_rgba(25,28,37,0.35)]">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="h-1.5 w-12 rounded-full bg-[#ddd6c7]" />
            <span className="text-[7px] uppercase tracking-[0.14em] text-faint">PDF</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-[#e8e2d5]" />
            <div className="h-1.5 w-[88%] rounded-full bg-[#ece7db]" />
            <div className="h-1.5 w-[94%] rounded-full bg-[#ece7db]" />
            <div className="my-2 h-1.5 w-[65%] rounded-full bg-[#dce0fb]" />
            <div className="h-1.5 w-full rounded-full bg-[#ece7db]" />
            <div className="h-1.5 w-[76%] rounded-full bg-[#ece7db]" />
          </div>
          <div className="absolute bottom-3 right-3 rounded border border-line bg-white px-1.5 py-0.5 text-[6px] font-medium uppercase tracking-[0.12em] text-cobalt">
            Cited
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-r from-surface to-transparent md:w-[45%]" aria-hidden="true" />
    </section>
  );
}

function UploadCard({ onUpload }: { onUpload: () => void }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-soft">
      <h2 className="text-[12px] font-semibold text-ink">Add a document</h2>
      <p className="mt-1 text-[11px] leading-4.5 text-muted">
        Upload a PDF to index it and open a conversation.
      </p>
      <button
        type="button"
        onClick={onUpload}
        className="group mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-line-strong bg-paper/45 px-3 py-3 text-left transition-colors hover:border-cobalt/40 hover:bg-cobalt-soft/30"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface text-cobalt transition-transform group-hover:-translate-y-0.5">
          <UploadCloud className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-medium text-ink">Choose a PDF</span>
          <span className="mt-0.5 block text-[9.5px] text-faint">PDF · up to 10 MB</span>
        </span>
        <Plus className="size-3.5 text-faint" aria-hidden="true" />
      </button>
    </section>
  );
}

function DashboardEmpty({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
      <section className="relative overflow-hidden rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-8">
        <p className="flex items-center gap-2 text-[9.5px] font-medium uppercase tracking-[0.18em] text-cobalt">
          <span className="h-px w-5 bg-cobalt/40" aria-hidden="true" />
          Start here
        </p>
        <h2 className="mt-4 max-w-md font-serif text-[30px] leading-[1.12] tracking-[-0.025em] text-ink sm:text-[34px]">
          Put a document on the desk.
        </h2>
        <p className="mt-3 max-w-md text-[13px] leading-6 text-muted">
          Upload a research paper, report, or handbook. DocuMind indexes it in the background,
          then answers your questions with references back to the page.
        </p>

        <button
          type="button"
          onClick={onUpload}
          className="group mt-6 flex w-full max-w-md items-center gap-3 rounded-lg border border-dashed border-line-strong bg-paper/50 px-4 py-4 text-left transition-colors hover:border-cobalt/40 hover:bg-cobalt-soft/30"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-cobalt shadow-[0_1px_2px_rgba(25,28,37,0.05)] transition-transform group-hover:-translate-y-0.5">
            <FileText className="size-4.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium text-ink">Drag a PDF here</span>
            <span className="mt-0.5 block text-[10.5px] text-muted">
              or click to choose a file · up to 10 MB
            </span>
          </span>
          <span className="inline-flex size-8 items-center justify-center rounded-md bg-cobalt text-white">
            <Plus className="size-4" aria-hidden="true" />
          </span>
        </button>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] text-faint">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-positive" aria-hidden="true" />
            Private to your account
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-cobalt" aria-hidden="true" />
            Page-level citations
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
            Conversation memory
          </span>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-night-line bg-night p-5 text-cream shadow-soft sm:p-6">
        <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-cream-faint">
          How it works
        </p>
        <ol className="mt-4 space-y-4">
          {[
            {
              title: "Upload and index",
              description: "Your PDF is parsed, chunked, and embedded in the background.",
            },
            {
              title: "Ask with intent",
              description: "Summarize, extract concepts, or ask a specific question.",
            },
            {
              title: "Follow the citations",
              description: "Each answer points to the pages it used. Jump there in one click.",
            },
          ].map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[8.5px] tabular-nums text-cream-dim">
                0{index + 1}
              </span>
              <div>
                <p className="text-[11.5px] font-medium text-cream">{step.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-4.5 text-cream-faint">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <Link
            to="/documents"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-cream-dim transition-colors hover:text-cream"
          >
            Go to the library
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_318px]">
      <div className="space-y-6">
        <Skeleton className="h-[176px] w-full rounded-xl" />
        <div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-40 rounded-lg" />
          </div>
          <div className="mt-3 rounded-xl border border-line bg-surface">
            <DocumentListSkeleton rows={5} />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-[152px] w-full rounded-xl" />
        <Skeleton className="h-[180px] w-full rounded-xl" />
      </div>
    </div>
  );
}
