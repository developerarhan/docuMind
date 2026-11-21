import { useEffect } from "react";

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · DocuMind` : "DocuMind";
    return () => {
      document.title = "DocuMind";
    };
  }, [title]);
}
