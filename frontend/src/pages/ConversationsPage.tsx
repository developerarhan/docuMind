import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  LibraryBig,
  MessagesSquare,
  SearchX,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useConversations } from "../context/ConversationContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../services/api/errors";
import type { Conversation } from "../types/api";
import { formatDateTime, formatRelativeTime, pluralize } from "../utils/format";
import { Alert } from "../components/ui/Alert";
import { Button, buttonClassName } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { SearchField } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";

export function ConversationsPage() {
  const { conversations, isLoading, hasLoaded, error, refresh, removeConversation } =
    useConversations();
  const { pushToast } = useToast();

  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      conversation.document.title.toLowerCase().includes(normalized),
    );
  }, [conversations, query]);

  const documentCount = useMemo(
    () => new Set(conversations.map((conversation) => conversation.document.id)).size,
    [conversations],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeConversation(deleteTarget.id);
      pushToast({
        title: "Conversation deleted",
        description: "The thread and its messages were removed.",
        variant: "success",
      });
      setDeleteTarget(null);
    } catch (caught) {
      pushToast({
        title: "Couldn't delete conversation",
        description: getErrorMessage(caught),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 py-8 sm:px-8 lg:px-10 lg:py-11">
      <PageHeader
        eyebrow="Conversations"
        title="Threads across your library"
        description="Each conversation stays tied to the document it began with. Open one to continue from the saved history."
        actions={
          <Link to="/documents" className={buttonClassName("secondary", "md")}>
            <LibraryBig className="size-4" aria-hidden="true" />
            Choose a document
          </Link>
        }
      />

      {conversations.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-line/80 py-2.5 text-[10.5px] text-muted">
          <span className="font-medium text-ink">
            {conversations.length} {pluralize(conversations.length, "conversation")}
          </span>
          <span className="text-line-strong" aria-hidden="true">
            /
          </span>
          <span>
            across {documentCount} {pluralize(documentCount, "document")}
          </span>
        </div>
      ) : null}

      {error ? (
        <Alert className="mt-6" title="Couldn't load conversations">
          <div className="flex flex-wrap items-center gap-2">
            {error}
            <button type="button" onClick={() => void refresh()} className="font-medium underline underline-offset-2">
              Try again
            </button>
          </div>
        </Alert>
      ) : null}

      {isLoading && !hasLoaded ? (
        <div className="mt-8 overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-line/80 px-4 py-4 last:border-b-0">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-[35%]" />
                <Skeleton className="h-2.5 w-[25%]" />
              </div>
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            variant="card"
            icon={MessagesSquare}
            eyebrow="No threads yet"
            title="Conversations begin with a document"
            description="Open a ready document and ask your first question. The thread appears here with its document and history."
            action={
              <Link to="/documents" className={buttonClassName("primary", "md")}>
                Go to the library
              </Link>
            }
            className="paper-grid"
          />
        </div>
      ) : (
        <div className="mt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SearchField
              value={query}
              onChange={setQuery}
              label="Search conversations by document"
              placeholder="Search by document title…"
              className="w-full sm:max-w-[300px]"
            />
            <p className="text-[10.5px] text-faint">
              {filtered.length} of {conversations.length} shown
            </p>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
            {filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No threads match"
                description="Try another document title, or clear the search."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
                className="py-12"
              />
            ) : (
              <ul className="divide-y divide-line/80">
                {filtered.map((conversation) => (
                  <li
                    key={conversation.id}
                    className="group flex items-center gap-3 px-3 py-3.5 transition-colors hover:bg-paper/55 sm:px-4"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-paper/70 text-muted">
                      <MessagesSquare className="size-3.5" aria-hidden="true" />
                    </span>

                    <Link
                      to={`/documents/${conversation.document.id}?c=${conversation.id}`}
                      className="min-w-0 flex-1 rounded-md"
                    >
                      <p className="truncate text-[12.5px] font-medium text-ink transition-colors group-hover:text-cobalt-dark">
                        {conversation.document.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                        <span>Started {formatDateTime(conversation.created_at)}</span>
                        <span className="text-line-strong" aria-hidden="true">
                          /
                        </span>
                        <span>Updated {formatRelativeTime(conversation.updated_at)}</span>
                      </p>
                    </Link>

                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        to={`/documents/${conversation.document.id}?c=${conversation.id}`}
                        className="hidden h-7 items-center gap-1 rounded-md border border-line-strong bg-surface px-2 text-[10.5px] font-medium text-ink transition-colors hover:bg-paper-deep sm:inline-flex"
                      >
                        Open
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(conversation)}
                        className="inline-flex size-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                        aria-label={`Delete conversation about ${conversation.document.title}`}
                        title="Delete conversation"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete this conversation?"
        description={
          <>
            This removes the thread about{" "}
            <span className="font-medium text-ink">{deleteTarget?.document.title}</span> and all
            of its messages. The document stays in your library. This can't be undone.
          </>
        }
        confirmLabel="Delete conversation"
        loading={deleting}
      />
    </div>
  );
}
