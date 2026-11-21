import { AlertTriangle, Clock3, Loader2, RotateCw } from "lucide-react";
import type { DocumentStatus } from "../../types/api";
import { Button } from "../ui/Button";
import { IndeterminateBar } from "../ui/ProgressBar";

interface ChatNotReadyProps {
  status: DocumentStatus;
  onStartProcessing: () => void;
  isStarting: boolean;
}

export function ChatNotReady({ status, onStartProcessing, isStarting }: ChatNotReadyProps) {
  if (status === "processing") {
    return (
      <div className="animate-fade-up rounded-xl border border-line bg-surface px-5 py-6 text-center shadow-soft">
        <span className="mx-auto grid size-11 place-items-center rounded-xl border border-cobalt/15 bg-cobalt-soft text-cobalt-dark">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </span>
        <p className="mt-4 text-[9px] font-medium uppercase tracking-[0.16em] text-faint">
          Indexing
        </p>
        <h2 className="mt-1 font-serif text-[23px] leading-tight tracking-[-0.02em] text-ink">
          Preparing this document
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-[12px] leading-5 text-muted">
          DocuMind is extracting the text and building the search index. You can keep reading
          the PDF — questions unlock automatically when indexing finishes.
        </p>
        <IndeterminateBar className="mx-auto mt-5 max-w-[220px]" />
        <p className="mt-3 text-[9.5px] text-faint">This page updates automatically.</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="animate-fade-up rounded-xl border border-danger/20 bg-surface px-5 py-6 text-center shadow-soft">
        <span className="mx-auto grid size-11 place-items-center rounded-xl border border-danger/15 bg-danger-soft text-danger">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-[9px] font-medium uppercase tracking-[0.16em] text-faint">
          Processing failed
        </p>
        <h2 className="mt-1 font-serif text-[23px] leading-tight tracking-[-0.02em] text-ink">
          The assistant can't read this document yet
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-[12px] leading-5 text-muted">
          Indexing stopped before the document was ready. You can still read the PDF, or try
          processing it again.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onStartProcessing}
          loading={isStarting}
        >
          {isStarting ? null : <RotateCw className="size-3.5" aria-hidden="true" />}
          Retry processing
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-up rounded-xl border border-line bg-surface px-5 py-6 text-center shadow-soft">
      <span className="mx-auto grid size-11 place-items-center rounded-xl border border-warning/15 bg-warning-soft text-warning">
        <Clock3 className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-[9px] font-medium uppercase tracking-[0.16em] text-faint">
        Not indexed yet
      </p>
      <h2 className="mt-1 font-serif text-[23px] leading-tight tracking-[-0.02em] text-ink">
        This document is waiting to be processed
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-[12px] leading-5 text-muted">
        Start indexing to extract the text and enable grounded answers with page citations.
        The PDF is readable in the meantime.
      </p>
      <Button size="sm" className="mt-5" onClick={onStartProcessing} loading={isStarting}>
        {isStarting ? null : <RotateCw className="size-3.5" aria-hidden="true" />}
        Start processing
      </Button>
    </div>
  );
}
