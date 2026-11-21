import type { AuthResponse, LoginPayload, RegisterPayload, User } from "../../types/api";
import { api } from "./client";

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/login/", payload);
    return response.data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>("/auth/register/", payload);
    return response.data;
  },

  async me(): Promise<User> {
    const response = await api.get<User>("/auth/me/");
    return response.data;
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout/");
  },
};
