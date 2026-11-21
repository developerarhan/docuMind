import type { CreateMemoryPayload, UserMemory } from "../../types/api";
import { api } from "./client";

export const memoriesApi = {
  async list(): Promise<UserMemory[]> {
    const response = await api.get<UserMemory[]>("/memories/");
    return response.data;
  },

  async create(payload: CreateMemoryPayload): Promise<UserMemory> {
    const response = await api.post<UserMemory>("/memories/", payload);
    return response.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/memories/${id}/`);
  },
};
