import axios from "axios";

export const TOKEN_STORAGE_KEY = "documind.auth.token";
export const UNAUTHORIZED_EVENT = "documind:unauthorized";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";
const apiBaseUrl = rawBaseUrl.replace(/\/+$/, "");
const rawMediaBaseUrl = import.meta.env.VITE_MEDIA_BASE_URL?.trim() || "";

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 45_000,
  headers: { Accept: "application/json" },
});

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage may be unavailable in private browsing; the in-memory session
    // still works for the current tab.
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  },
);

/**
 * Media URLs from Django may be absolute (built from the request host). We
 * normalise them to the local proxy so PDF.js can fetch them same-origin.
 */
export function resolveMediaUrl(fileUrl: string): string {
  if (!fileUrl) return "";

  // If already an external cloud storage URL (e.g. Supabase Storage, S3, CDN), preserve it directly
  if (/^https?:\/\//i.test(fileUrl)) {
    try {
      const url = new URL(fileUrl);
      if (
        url.hostname.includes("supabase.co") ||
        url.hostname.includes("amazonaws.com") ||
        url.hostname.includes("storage.googleapis.com")
      ) {
        return fileUrl;
      }
      // For general remote hosts when no local media proxy override is set, preserve the cloud URL
      if (!rawMediaBaseUrl && !url.hostname.includes("localhost") && !url.hostname.includes("127.0.0.1")) {
        return fileUrl;
      }
      const path = `${url.pathname}${url.search}`;
      const mediaBase = rawMediaBaseUrl.replace(/\/+$/, "");
      return mediaBase ? `${mediaBase}${path}` : path;
    } catch {
      return fileUrl;
    }
  }

  const path = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
  const mediaBase = rawMediaBaseUrl.replace(/\/+$/, "");
  return mediaBase ? `${mediaBase}${path}` : path;
}
