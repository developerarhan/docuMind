import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { documentsApi, type UploadDocumentPayload } from "../services/api/documents";
import { getErrorMessage } from "../services/api/errors";
import type { Document, UploadResult } from "../types/api";
import { useAuth } from "./AuthContext";

export const DOCUMENTS_CHANGED_EVENT = "documind:documents-changed";

interface RefreshOptions {
  silent?: boolean;
  signal?: AbortSignal;
}

interface DocumentContextValue {
  documents: Document[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  uploadDocument: (
    payload: UploadDocumentPayload,
    onProgress?: (percentage: number) => void,
  ) => Promise<UploadResult>;
  deleteDocument: (id: number) => Promise<void>;
  retryProcessing: (id: number) => Promise<void>;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    const { silent = false, signal } = options;
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const data = await documentsApi.list(signal);
      if (signal?.aborted) return;
      setDocuments(data);
      setError(null);
      setHasLoaded(true);
    } catch (caught) {
      if (signal?.aborted) return;
      if (!silent) {
        setError(getErrorMessage(caught, "Couldn't load your document library."));
      }
    } finally {
      if (!silent && !signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setDocuments([]);
      setHasLoaded(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    void refresh({ signal: controller.signal });
    return () => controller.abort();
  }, [status, refresh]);

  const hasActiveProcessing = documents.some(
    (document) => document.status === "pending" || document.status === "processing",
  );

  useEffect(() => {
    if (status !== "authenticated" || !hasActiveProcessing) return;

    const timer = window.setTimeout(() => {
      void refresh({ silent: true });
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [status, hasActiveProcessing, documents, refresh]);

  const uploadDocument = useCallback(
    async (
      payload: UploadDocumentPayload,
      onProgress?: (percentage: number) => void,
    ): Promise<UploadResult> => {
      const uploaded = await documentsApi.upload(payload, onProgress);

      const freshDocuments = await documentsApi.list();
      setDocuments(freshDocuments);
      setHasLoaded(true);

      const matched =
        freshDocuments.find((document) => document.file === uploaded.file) ??
        freshDocuments.find(
          (document) =>
            document.title === uploaded.title &&
            document.file_size === uploaded.file_size &&
            document.created_at === uploaded.created_at,
        );

      if (!matched) {
        throw new Error(
          "Your PDF was uploaded, but we couldn't locate it in the library. Refresh the library to find it.",
        );
      }

      let processingError: string | null = null;
      let resolved: Document = matched;

      try {
        const response = await documentsApi.process(matched.id);
        resolved = { ...matched, status: response.status };
        setDocuments((current) =>
          current.map((document) => (document.id === matched.id ? resolved : document)),
        );
      } catch (caught) {
        processingError = getErrorMessage(
          caught,
          "The upload succeeded, but processing couldn't start.",
        );
        try {
          const refreshed = await documentsApi.list();
          setDocuments(refreshed);
          resolved = refreshed.find((document) => document.id === matched.id) ?? matched;
        } catch {
          resolved = { ...matched, status: "failed" };
          setDocuments((current) =>
            current.map((document) => (document.id === matched.id ? resolved : document)),
          );
        }
      }

      return { document: resolved, processingError };
    },
    [],
  );

  const deleteDocument = useCallback(async (id: number) => {
    await documentsApi.remove(id);
    setDocuments((current) => current.filter((document) => document.id !== id));
    window.dispatchEvent(new CustomEvent(DOCUMENTS_CHANGED_EVENT));
  }, []);

  const retryProcessing = useCallback(
    async (id: number) => {
      try {
        const response = await documentsApi.process(id);
        setDocuments((current) =>
          current.map((document) =>
            document.id === id ? { ...document, status: response.status } : document,
          ),
        );
      } catch (caught) {
        void refresh({ silent: true });
        throw caught;
      }
    },
    [refresh],
  );

  const value = useMemo<DocumentContextValue>(
    () => ({
      documents,
      isLoading,
      hasLoaded,
      error,
      refresh,
      uploadDocument,
      deleteDocument,
      retryProcessing,
    }),
    [
      documents,
      isLoading,
      hasLoaded,
      error,
      refresh,
      uploadDocument,
      deleteDocument,
      retryProcessing,
    ],
  );

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocuments(): DocumentContextValue {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("useDocuments must be used inside DocumentProvider.");
  }
  return context;
}
