import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileWarning,
  Loader2,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import { getDocument, type PDFDocumentProxy } from "../../features/pdf/pdf";
import type { Document } from "../../types/api";
import { cn, formatFileSize } from "../../utils/format";
import { buttonClassName } from "../ui/Button";

interface PdfReaderProps {
  document: Document;
  fileUrl: string;
  page: number;
  onPageChange: (page: number) => void;
}

const PAGE_PADDING = 48;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

export function PdfReader({ document: doc, fileUrl, page, onPageChange }: PdfReaderProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [effectiveScale, setEffectiveScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageInput, setPageInput] = useState("1");

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void; promise: Promise<unknown> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setLoadError(null);
    setRenderError(null);
    setPdf(null);
    setNumPages(0);
    setZoomMode("fit");

    const loadingTask = getDocument({ url: fileUrl });

    loadingTask.promise
      .then((loaded) => {
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }
        setPdf(loaded);
        setNumPages(loaded.numPages);
        setLoadState("ready");
        if (page > loaded.numPages) onPageChange(1);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState("error");
        setLoadError(
          "The PDF preview couldn't be loaded. The document may still be processing, or the file isn't reachable from this browser.",
        );
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
    // The reader intentionally reloads only when the source file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (!pdf || page < 1) return;

    let cancelled = false;
    const renderPage = async () => {
      setRendering(true);
      setRenderError(null);

      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth =
          containerWidth > 0 ? containerWidth : (containerRef.current?.clientWidth ?? 640);
        const fitScale = Math.max(
          MIN_ZOOM,
          (availableWidth - PAGE_PADDING) / baseViewport.width,
        );
        const scale = zoomMode === "fit" ? fitScale : zoomMode;
        setEffectiveScale(scale);

        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable.");

        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        renderTaskRef.current?.cancel();
        const task = pdfPage.render({
          canvas,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        });
        renderTaskRef.current = task;
        await task.promise;

        if (!cancelled) setRendering(false);
      } catch (caught) {
        const name =
          caught && typeof caught === "object" && "name" in caught
            ? String((caught as { name: unknown }).name)
            : "";
        if (name === "RenderingCancelledException" || cancelled) return;
        setRendering(false);
        setRenderError("This page couldn't be rendered. Try another page or open the original PDF.");
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, page, zoomMode, containerWidth]);

  useEffect(() => {
    if (loadState !== "ready") return;
    containerRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [page, loadState]);

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const zoomIn = () => {
    const base = zoomMode === "fit" ? effectiveScale : zoomMode;
    setZoomMode(clampZoom(Number((base + 0.15).toFixed(2))));
  };

  const zoomOut = () => {
    const base = zoomMode === "fit" ? effectiveScale : zoomMode;
    setZoomMode(clampZoom(Number((base - 0.15).toFixed(2))));
  };

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageInput(String(page));
      return;
    }
    const next = Math.min(Math.max(1, parsed), numPages || 1);
    if (next !== page) onPageChange(next);
    else setPageInput(String(page));
  };

  const goToPrevious = () => {
    if (page > 1) onPageChange(page - 1);
  };

  const goToNext = () => {
    if (numPages > 0 && page < numPages) onPageChange(page + 1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, button, a")) return;

    if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goToPrevious();
    } else if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      goToNext();
    } else if (event.key === "Home") {
      event.preventDefault();
      onPageChange(1);
    } else if (event.key === "End" && numPages > 0) {
      event.preventDefault();
      onPageChange(numPages);
    }
  };

  const pageLabel = numPages > 0 ? `${Math.min(page, numPages)} / ${numPages}` : "—";

  return (
    <section
      aria-label={`Document preview: ${doc.title}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex min-h-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cobalt/50"
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-2.5 sm:px-3">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={page <= 1 || loadState !== "ready"}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-paper-deep hover:text-ink disabled:pointer-events-none disabled:opacity-35"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-1 rounded-md border border-line bg-paper/60 px-1 py-0.5">
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ""))}
              onBlur={commitPageInput}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitPageInput();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setPageInput(String(page));
                  event.currentTarget.blur();
                }
              }}
              aria-label="Current page"
              className="h-5 w-7 rounded bg-transparent text-center text-[10.5px] font-medium tabular-nums text-ink outline-none focus:bg-surface focus:ring-1 focus:ring-cobalt/40"
              disabled={loadState !== "ready"}
            />
            <span className="text-[9.5px] tabular-nums text-faint">/ {numPages || "—"}</span>
          </div>
          <button
            type="button"
            onClick={goToNext}
            disabled={page >= numPages || loadState !== "ready"}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-paper-deep hover:text-ink disabled:pointer-events-none disabled:opacity-35"
            aria-label="Next page"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        <span className="ml-1 hidden text-[9.5px] text-faint md:inline">
          PDF · {formatFileSize(doc.file_size)} · Page {pageLabel}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <div className="hidden items-center gap-0.5 sm:flex">
            <button
              type="button"
              onClick={zoomOut}
              disabled={loadState !== "ready"}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-paper-deep hover:text-ink disabled:pointer-events-none disabled:opacity-35"
              aria-label="Zoom out"
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <span className="min-w-8 text-center text-[9.5px] tabular-nums text-muted">
              {Math.round(effectiveScale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={loadState !== "ready"}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-paper-deep hover:text-ink disabled:pointer-events-none disabled:opacity-35"
              aria-label="Zoom in"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setZoomMode("fit")}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors",
              zoomMode === "fit"
                ? "bg-paper-deep text-ink"
                : "text-muted hover:bg-paper-deep hover:text-ink",
            )}
            aria-label="Fit page to width"
            aria-pressed={zoomMode === "fit"}
            title="Fit width"
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />
          </button>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-muted transition-colors hover:bg-paper-deep hover:text-ink"
            title="Open the original PDF"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">Original</span>
          </a>
        </div>
      </div>

      <div
        ref={containerRef}
        className="paper-grid scroll-thin relative min-h-0 flex-1 overflow-auto bg-[#e9e3d7]"
      >
        {loadState === "loading" ? (
          <div className="grid min-h-full place-items-center p-6">
            <div className="relative aspect-[0.72] w-full max-w-[520px] overflow-hidden rounded-sm bg-white shadow-[0_18px_50px_-26px_rgba(25,28,37,0.5)]">
              <div className="skeleton absolute inset-0 opacity-70" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex items-center gap-2 rounded-md border border-line bg-surface/90 px-3 py-2 text-[11px] text-muted shadow-soft">
                  <Loader2 className="size-3.5 animate-spin text-cobalt" aria-hidden="true" />
                  Loading PDF…
                </div>
              </div>
            </div>
          </div>
        ) : loadState === "error" ? (
          <div className="grid min-h-full place-items-center p-6">
            <div className="max-w-sm rounded-xl border border-line bg-surface p-6 text-center shadow-soft">
              <span className="mx-auto grid size-10 place-items-center rounded-lg border border-warning/20 bg-warning-soft text-warning">
                <FileWarning className="size-4.5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 font-serif text-[21px] leading-tight text-ink">
                Preview unavailable
              </h3>
              <p className="mt-2 text-[11.5px] leading-5 text-muted">{loadError}</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClassName("secondary", "sm", "mt-4")}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Open original PDF
              </a>
            </div>
          </div>
        ) : (
          <div className="scroll-thin min-h-full w-max min-w-full">
            <div className="flex flex-col items-center px-3 py-5 sm:px-6 sm:py-6">
              <div className="relative bg-white shadow-[0_20px_55px_-28px_rgba(25,28,37,0.55)] ring-1 ring-black/[0.04]">
                <canvas
                  ref={canvasRef}
                  className="block"
                  role="img"
                  aria-label={`Page ${page} of ${numPages}`}
                />
                {rendering ? (
                  <div className="absolute inset-0 grid place-items-center bg-white/55">
                    <Loader2 className="size-5 animate-spin text-cobalt/70" aria-hidden="true" />
                  </div>
                ) : null}
              </div>
              {renderError ? (
                <p className="mt-3 rounded-md border border-danger/20 bg-danger-soft px-3 py-1.5 text-[10.5px] text-danger">
                  {renderError}
                </p>
              ) : null}
              <p className="mt-3 text-[9.5px] uppercase tracking-[0.14em] text-ink/35">
                Page {page} of {numPages}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
