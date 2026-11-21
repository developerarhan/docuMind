import { ArrowUpRight, RotateCw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Document } from "../../types/api";
import { cn, formatDate, formatFileSize, formatRelativeTime } from "../../utils/format";
import { FileGlyph } from "../ui/FileGlyph";
import { StatusBadge } from "../ui/StatusBadge";

interface DocumentRowProps {
  document: Document;
  onRequestDelete?: (document: Document) => void;
  onRetry?: (document: Document) => void;
  retrying?: boolean;
  className?: string;
}

export function DocumentRow({
  document,
  onRequestDelete,
  onRetry,
  retrying = false,
  className,
}: DocumentRowProps) {
  return (
    <li
      className={cn(
        "group relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-paper/55 sm:gap-3.5 sm:px-4",
        className,
      )}
    >
      <Link
        to={`/documents/${document.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md sm:gap-3.5"
        aria-label={`Open ${document.title}`}
      >
        <FileGlyph size="md" className="hidden sm:grid" />
        <FileGlyph size="sm" className="sm:hidden" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-5 tracking-[-0.01em] text-ink transition-colors group-hover:text-cobalt-dark">
            {document.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-muted">
            <span>{formatFileSize(document.file_size)}</span>
            <span className="text-line-strong" aria-hidden="true">
              /
            </span>
            <span className="truncate">Added {formatDate(document.created_at)}</span>
            <span className="hidden text-line-strong md:inline" aria-hidden="true">
              /
            </span>
            <span className="hidden md:inline">Updated {formatRelativeTime(document.updated_at)}</span>
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        {document.status === "failed" && onRetry ? (
          <button
            type="button"
            onClick={() => onRetry(document)}
            disabled={retrying}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong bg-surface px-2 text-[10.5px] font-medium text-ink transition-colors hover:bg-paper-deep disabled:opacity-50"
            aria-label={`Retry processing ${document.title}`}
          >
            <RotateCw className={cn("size-3", retrying && "animate-spin")} aria-hidden="true" />
            <span className="hidden sm:inline">Retry</span>
          </button>
        ) : null}

        <StatusBadge status={document.status} />

        <Link
          to={`/documents/${document.id}`}
          className="hidden size-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-paper-deep hover:text-ink sm:inline-flex"
          aria-label={`Open ${document.title}`}
          tabIndex={-1}
        >
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>

        {onRequestDelete ? (
          <button
            type="button"
            onClick={() => onRequestDelete(document)}
            className="inline-flex size-7 items-center justify-center rounded-md text-faint opacity-100 transition-[color,background-color,opacity] hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            aria-label={`Delete ${document.title}`}
            title="Delete document"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
