import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatSource } from "../../types/api";

interface MarkdownAnswerProps {
  content: string;
  sources: ChatSource[];
  onSourceClick: (page: number) => void;
}

export function MarkdownAnswer({ content, sources, onSourceClick }: MarkdownAnswerProps) {
  const sourceIds = useMemo(
    () => new Set(sources.map((source) => source.sourceId)),
    [sources],
  );

  const sourcePages = useMemo(() => {
    const pages = new Map<number, number | null>();
    for (const source of sources) pages.set(source.sourceId, source.page);
    return pages;
  }, [sources]);

  const transformed = useMemo(() => {
    if (sources.length === 0) return content;
    return content.replace(/\[Source\s+(\d+)\]/gi, (match, rawId: string) => {
      const id = Number(rawId);
      if (!sourceIds.has(id)) return match;
      return `[${id}](#citation-${id})`;
    });
  }, [content, sources.length, sourceIds]);

  const components = useMemo<Components>(
    () => ({
      a: ({ href, children, ...props }) => {
        if (href?.startsWith("#citation-")) {
          const id = Number(href.replace("#citation-", ""));
          const page = sourcePages.get(id) ?? null;
          return (
            <button
              type="button"
              className="citation-ref"
              disabled={page === null}
              onClick={() => {
                if (page !== null) onSourceClick(page);
              }}
              title={page !== null ? `Open source ${id} on page ${page}` : "Page unavailable"}
              aria-label={
                page !== null
                  ? `Open source ${id} on page ${page}`
                  : `Source ${id}, page unavailable`
              }
            >
              {children}
            </button>
          );
        }

        return (
          <a href={href} target="_blank" rel="noreferrer" {...props}>
            {children}
          </a>
        );
      },
      table: ({ children }) => (
        <div className="overflow-x-auto">
          <table>{children}</table>
        </div>
      ),
    }),
    [onSourceClick, sourcePages],
  );

  return (
    <div className="prose-doc">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {transformed}
      </ReactMarkdown>
    </div>
  );
}
