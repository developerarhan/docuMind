import type { Document, DocumentStatus } from "../../types/api";

export interface DocumentQuery {
  query: string;
  status: "all" | DocumentStatus;
}

export function filterDocuments(documents: Document[], { query, status }: DocumentQuery): Document[] {
  const normalizedQuery = query.trim().toLowerCase();

  return documents.filter((document) => {
    const matchesStatus = status === "all" || document.status === status;
    const matchesQuery =
      !normalizedQuery || document.title.toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
}
