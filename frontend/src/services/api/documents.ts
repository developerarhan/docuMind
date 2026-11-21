import type {
  ChatRequest,
  ChatResponse,
  Document,
  DocumentUploadResponse,
  ProcessDocumentResponse,
} from "../../types/api";
import { api } from "./client";

export interface UploadDocumentPayload {
  title: string;
  file: File;
}

export const documentsApi = {
  async list(signal?: AbortSignal): Promise<Document[]> {
    const response = await api.get<Document[]>("/documents/", { signal });
    return response.data;
  },

  async upload(
    payload: UploadDocumentPayload,
    onProgress?: (percentage: number) => void,
  ): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append("title", payload.title);
    formData.append("file", payload.file);

    const response = await api.post<DocumentUploadResponse>("/documents/", formData, {
      timeout: 120_000,
      onUploadProgress: (event) => {
        if (!onProgress) return;
        const total = event.total ?? payload.file.size;
        if (!total) return;
        const percentage = Math.min(100, Math.round((event.loaded / total) * 100));
        onProgress(percentage);
      },
    });

    return response.data;
  },

  async process(id: number): Promise<ProcessDocumentResponse> {
    const response = await api.post<ProcessDocumentResponse>(`/documents/${id}/process/`);
    return response.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/documents/${id}/`);
  },

  async chat(
    documentId: number,
    request: ChatRequest,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>(
      `/documents/${documentId}/chat/`,
      request,
      { timeout: 180_000, signal },
    );
    return response.data;
  },
};
