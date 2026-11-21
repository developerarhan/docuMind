export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface User {
  id: number;
  username: string;
  email: string;
  date_joined: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email?: string;
  password: string;
  password_confirm: string;
}

export interface Document {
  id: number;
  title: string;
  file: string;
  file_size: number;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

/**
 * The upload endpoint returns the upload serializer, which does not include
 * the document id. The client resolves the id from the library listing.
 */
export interface DocumentUploadResponse {
  title: string;
  file: string;
  file_size: number;
  status: DocumentStatus;
  created_at: string;
}

export interface ProcessDocumentResponse {
  message: string;
  document_id: number;
  status: DocumentStatus;
}

export interface DocumentSource {
  source_id: number;
  page: number | null;
  relevance_score: number;
}

export interface ChatRequest {
  question: string;
  conversation_id?: string;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  document_id: number;
  question: string;
  answer: string;
  sources: DocumentSource[];
}

export interface ConversationDocument {
  id: number;
  title: string;
}

export interface Conversation {
  id: string;
  document: ConversationDocument;
  created_at: string;
  updated_at: string;
}

export interface RawConversationMessage {
  role: string;
  content: string;
}

export interface ConversationMessagesResponse {
  conversation_id: string;
  messages: RawConversationMessage[];
}

export type MemoryCategory =
  | "preference"
  | "learning_goal"
  | "personal_context"
  | "interest"
  | "other";

export interface UserMemory {
  id: number;
  memory: string;
  category: MemoryCategory;
  created_at: string;
}

export interface CreateMemoryPayload {
  memory: string;
  category: MemoryCategory;
}

/* ---- Frontend-only view models ---- */

export type ChatRole = "user" | "assistant";

export interface ChatSource {
  sourceId: number;
  page: number | null;
  relevanceScore: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  sources: ChatSource[];
  createdAt: string;
}

export interface UploadResult {
  document: Document;
  processingError: string | null;
}
