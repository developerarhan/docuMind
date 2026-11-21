import { useMemo, useState } from "react";
import {
  FileUp,
  LibraryBig,
  Plus,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { useDocuments } from "../context/DocumentContext";
import { useToast } from "../context/ToastContext";
import { useUpload } from "../context/UploadContext";
import { getErrorMessage } from "../services/api/errors";
import type { Document } from "../types/api";
import { formatFileSize, pluralize } from "../utils/format";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { SearchField } from "../components/ui/Input";
import { DocumentFilterTabs, getFilterCounts, type DocumentFilter } from "../components/documents/DocumentFilterTabs";
import { DocumentListSkeleton } from "../components/documents/DocumentListSkeleton";
import { DocumentRow } from "../components/documents/DocumentRow";
import { DeleteDocumentDialog } from "../components/documents/DeleteDocumentDialog";
import { filterDocuments } from "../features/documents/filterDocuments";

export function DocumentsPage() {
  const { documents, isLoading, hasLoaded, error, refresh, retryProcessing } = useDocuments();
  const { openUpload } = useUpload();
  const { pushToast } = useToast();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DocumentFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const counts = useMemo(() => getFilterCounts(documents), [documents]);
  const filteredDocuments = useMemo(
    () => filterDocuments(documents, { query, status: filter }),
    [documents, query, filter],
  );
  const totalSize = useMemo(
    () => documents.reduce((sum, document) => sum + document.file_size, 0),
    [documents],
  );
  const activeCount = counts.processing + counts.pending;
  const isFiltering = query.trim().length > 0 || filter !== "all";

  const handleRetry = async (document: Document) => {
    setRetryingId(document.id);
    try {
      await retryProcessing(document.id);
      pushToast({
        title: "Processing restarted",
        description: `“${document.title}” is back in the queue.`,
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

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-11">
      <PageHeader
        eyebrow="Library"
        title="Your documents"
        description="Every PDF you've added, with its processing state and workspace. Indexing happens in the background."
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void refresh()}
              disabled={isLoading}
              aria-label="Refresh library"
            >
              <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
              Refresh
            </Button>
            <Button onClick={openUpload}>
              <Plus className="size-4" aria-hidden="true" />
              Add document
            </Button>
          </>
        }
      />

      {error ? (
        <Alert className="mt-6" title="Couldn't refresh the library">
          <div className="flex flex-wrap items-center gap-2">
            {error}
            <button type="button" onClick={() => void refresh()} className="font-medium underline underline-offset-2">
              Try again
            </button>
          </div>
        </Alert>
      ) : null}

      {!hasLoaded && isLoading ? (
        <div className="mt-8 overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
          <DocumentListSkeleton rows={6} />
        </div>
      ) : documents.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            variant="card"
            icon={LibraryBig}
            eyebrow="A clean desk"
            title="Your library is empty"
            description="Add your first PDF. DocuMind will index it in the background, then you can read, summarize, and ask questions with page-level citations."
            action={
              <Button onClick={openUpload} size="lg">
                <FileUp className="size-4" aria-hidden="true" />
                Upload a PDF
              </Button>
            }
            className="paper-grid"
          />
          <div className="mx-auto mt-5 flex max-w-xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10.5px] text-faint">
            <span>PDF only</span>
            <span className="size-1 rounded-full bg-line-strong" aria-hidden="true" />
            <span>Up to 10 MB</span>
            <span className="size-1 rounded-full bg-line-strong" aria-hidden="true" />
            <span>Existing PDFs are not encrypted</span>
          </div>
        </div>
      ) : (
        <div className="mt-7">
          <div className="flex flex-col gap-3 border-y border-line/80 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted">
              <span className="font-medium text-ink">
                {counts.all} {pluralize(counts.all, "document")}
              </span>
              <span className="text-line-strong" aria-hidden="true">
                /
              </span>
              <span>{formatFileSize(totalSize)} stored</span>
              {activeCount > 0 ? (
                <>
                  <span className="text-line-strong" aria-hidden="true">
                    /
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 animate-pulse-dot rounded-full bg-cobalt" aria-hidden="true" />
                    {activeCount} {pluralize(activeCount, "document")} processing
                  </span>
                </>
              ) : null}
            </p>
            {activeCount > 0 ? (
              <p className="text-[10px] text-faint">Status updates automatically.</p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <SearchField
              value={query}
              onChange={setQuery}
              label="Search documents"
              placeholder="Search documents by title…"
              className="w-full sm:max-w-[300px]"
            />
            <DocumentFilterTabs
              value={filter}
              onChange={setFilter}
              counts={counts}
              className="sm:ml-auto"
            />
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
            {filteredDocuments.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No documents match"
                description={
                  isFiltering
                    ? "Try a different title, or clear the filters to see your whole library."
                    : "There's nothing here yet."
                }
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
                className="py-12"
              />
            ) : (
              <ul className="divide-y divide-line/80">
                {filteredDocuments.map((document) => (
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-[10.5px] text-faint">
              Showing {filteredDocuments.length} of {documents.length}{" "}
              {pluralize(documents.length, "document")}
              {isFiltering ? " after filtering" : ""}.
            </p>
            <button
              type="button"
              onClick={openUpload}
              className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-muted transition-colors hover:text-ink"
            >
              <FileUp className="size-3" aria-hidden="true" />
              Add another PDF
            </button>
          </div>
        </div>
      )}

      <DeleteDocumentDialog
        document={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
