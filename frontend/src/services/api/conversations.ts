import type {
  Conversation,
  ConversationMessagesResponse,
} from "../../types/api";
import { api } from "./client";

export const conversationsApi = {
  async list(): Promise<Conversation[]> {
    const response = await api.get<Conversation[]>("/conversations/");
    return response.data;
  },

  async get(id: string): Promise<Conversation> {
    const response = await api.get<Conversation>(`/conversations/${id}/`);
    return response.data;
  },

  async messages(id: string, signal?: AbortSignal): Promise<ConversationMessagesResponse> {
    const response = await api.get<ConversationMessagesResponse>(
      `/conversations/${id}/messages/`,
      { signal },
    );
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/conversations/${id}/`);
  },
};
