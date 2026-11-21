import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { FileUp, UploadCloud, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../../context/DocumentContext";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../services/api/errors";
import { cn, formatFileSize, stripPdfExtension } from "../../utils/format";
import { Dialog } from "../../components/ui/Dialog";
import { FileGlyph } from "../../components/ui/FileGlyph";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { validatePdfFile } from "../../features/documents/uploadValidation";

type UploadPhase = "idle" | "uploading" | "finalizing";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UploadDialog({ open, onClose }: UploadDialogProps) {
  const { uploadDocument } = useDocuments();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const isBusy = phase !== "idle";

  useEffect(() => {
    if (!open) {
      setFile(null);
      setTitle("");
      setTitleTouched(false);
      setFileError(null);
      setTitleError(null);
      setFormError(null);
      setPhase("idle");
      setProgress(0);
      setDragActive(false);
    }
  }, [open]);

  const guardClose = () => {
    if (isBusy) return;
    onClose();
  };

  const chooseFile = (candidate: File) => {
    const validationError = validatePdfFile(candidate);
    if (validationError) {
      setFileError(validationError);
      setFile(null);
      return;
    }

    setFile(candidate);
    setFileError(null);
    setFormError(null);
    if (!titleTouched) {
      setTitle(stripPdfExtension(candidate.name) || "Untitled document");
      setTitleError(null);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (isBusy) return;
    const dropped = event.dataTransfer.files[0];
    if (dropped) chooseFile(dropped);
  };

  const removeFile = () => {
    setFile(null);
    setProgress(0);
    setPhase("idle");
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;

    if (!file) {
      setFileError("Choose a PDF to upload.");
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError("Give this document a title.");
      return;
    }

    setFileError(null);
    setTitleError(null);
    setFormError(null);
    setPhase("uploading");
    setProgress(0);

    try {
      const { document, processingError } = await uploadDocument(
        { title: trimmedTitle, file },
        (percentage) => {
          setProgress(percentage);
          if (percentage >= 100) setPhase("finalizing");
        },
      );

      if (processingError) {
        pushToast({
          title: "Uploaded, but processing didn't start",
          description: "Open the document to retry processing.",
          variant: "error",
        });
      } else {
        pushToast({
          title: "Document uploaded",
          description: "Processing has started. Chat unlocks when it's ready.",
          variant: "success",
        });
      }

      onClose();
      navigate(`/documents/${document.id}`);
    } catch (caught) {
      setFormError(getErrorMessage(caught, "We couldn't upload that PDF."));
      setPhase("idle");
      setProgress(0);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={guardClose}
      title="Add a document"
      description="Upload a PDF to read, search, and discuss. Files are processed in the background."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={guardClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="upload-document-form"
            size="sm"
            loading={isBusy}
            disabled={!file}
          >
            {isBusy ? "Uploading…" : "Upload & process"}
          </Button>
        </>
      }
    >
      <form id="upload-document-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {formError ? <Alert className="mb-4">{formError}</Alert> : null}

        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!isBusy) setDragActive(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setDragActive(false);
          }}
          onDrop={handleDrop}
          className={cn(
            "relative rounded-lg border border-dashed px-5 py-8 text-center transition-[border-color,background-color]",
            dragActive
              ? "border-cobalt bg-cobalt-soft/60"
              : file
                ? "border-line-strong bg-paper/50"
                : "border-line-strong bg-paper/40 hover:border-[#bfb5a2] hover:bg-paper/70",
            isBusy && "pointer-events-none",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) chooseFile(selected);
            }}
            tabIndex={-1}
            aria-hidden="true"
          />

          {file ? (
            <div className="flex items-center gap-3 text-left">
              <FileGlyph size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-ink">{file.name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {formatFileSize(file.size)} · PDF
                </p>
              </div>
              <button
                type="button"
                onClick={removeFile}
                className="inline-flex size-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-paper-deep hover:text-ink"
                aria-label="Remove selected file"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <span className="mx-auto grid size-10 place-items-center rounded-lg border border-line bg-surface text-cobalt shadow-[0_1px_2px_rgba(25,28,37,0.05)]">
                <UploadCloud className="size-4.5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-[13px] font-medium text-ink">
                {dragActive ? "Drop the PDF here" : "Drag a PDF here"}
              </p>
              <p className="mt-1 text-[11.5px] text-muted">
                or{" "}
                <button
                  type="button"
                  data-autofocus
                  onClick={() => inputRef.current?.click()}
                  className="font-medium text-cobalt underline decoration-cobalt/30 underline-offset-2 hover:decoration-cobalt"
                >
                  choose a file
                </button>{" "}
                from your device
              </p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-faint">
                PDF only · up to 10 MB
              </p>
            </>
          )}

          {file ? (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-paper-deep"
              >
                <FileUp className="size-3" aria-hidden="true" />
                Replace file
              </button>
            </div>
          ) : null}
        </div>

        {fileError ? (
          <p role="alert" className="mt-2 text-[11.5px] text-danger">
            {fileError}
          </p>
        ) : null}

        <FormField label="Document title" htmlFor="document-title" error={titleError ?? undefined} className="mt-5">
          <Input
            id="document-title"
            name="title"
            value={title}
            maxLength={255}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleTouched(true);
              setTitleError(null);
            }}
            invalid={Boolean(titleError)}
            placeholder="e.g. Attention Is All You Need"
            disabled={isBusy}
          />
        </FormField>

        {isBusy ? (
          <div className="mt-5 rounded-lg border border-line bg-paper/60 p-3.5" aria-live="polite">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11.5px]">
              <span className="flex items-center gap-2 text-muted">
                <Spinner className="size-3 text-cobalt" />
                {phase === "finalizing"
                  ? "Starting document processing…"
                  : "Uploading your PDF…"}
              </span>
              <span className="tabular-nums text-faint">
                {phase === "finalizing" ? "Upload complete" : `${progress}%`}
              </span>
            </div>
            <ProgressBar value={phase === "finalizing" ? 100 : progress} label="Upload progress" />
            <p className="mt-2 text-[10.5px] leading-4 text-faint">
              You'll be taken to the document while it's indexed.
            </p>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
