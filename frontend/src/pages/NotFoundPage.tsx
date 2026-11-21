import { FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";
import { buttonClassName } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[80dvh] place-items-center px-5 py-12">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl border border-line bg-surface text-muted shadow-soft">
          <FileQuestion className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.18em] text-cobalt">
          404 · Not found
        </p>
        <h1 className="mt-2 font-serif text-[34px] leading-[1.1] tracking-[-0.03em] text-ink">
          This page isn't on the shelf.
        </h1>
        <p className="mt-3 text-[12.5px] leading-5.5 text-muted">
          The document or page may have been moved or removed. Your library is still where you
          left it.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link to="/" className={buttonClassName("primary", "md")}>
            Back to overview
          </Link>
          <Link to="/documents" className={buttonClassName("secondary", "md")}>
            Open library
          </Link>
        </div>
      </div>
    </div>
  );
}
