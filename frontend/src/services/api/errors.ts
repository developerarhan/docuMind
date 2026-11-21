import axios from "axios";

interface ErrorPayload {
  [key: string]: unknown;
}

function flattenPayload(payload: unknown): string | null {
  if (!payload) return null;

  if (typeof payload === "string") {
    return payload.trim() || null;
  }

  if (Array.isArray(payload)) {
    const parts = payload
      .map((entry) => flattenPayload(entry))
      .filter((entry): entry is string => Boolean(entry));
    return parts.length ? parts.join(" ") : null;
  }

  if (typeof payload === "object") {
    const record = payload as ErrorPayload;

    for (const key of ["detail", "error", "message", "non_field_errors"]) {
      const message = flattenPayload(record[key]);
      if (message) return message;
    }

    const fieldMessages: string[] = [];
    for (const [field, value] of Object.entries(record)) {
      const message = flattenPayload(value);
      if (!message) continue;
      const label = humanizeField(field);
      fieldMessages.push(label ? `${label}: ${message}` : message);
    }
    return fieldMessages.length ? fieldMessages.join(" ") : null;
  }

  return null;
}

function humanizeField(field: string): string {
  if (!field) return "";
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ERR_CANCELED") {
      return "The request was cancelled.";
    }

    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        return "The request took too long. Please try again.";
      }
      return "Can't reach DocuMind right now. Check that the API server is running and try again.";
    }

    const payloadMessage = flattenPayload(error.response.data);
    if (payloadMessage) return payloadMessage;

    switch (error.response.status) {
      case 400:
        return "Some of the information provided isn't valid. Please check it and try again.";
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "You don't have permission to do that.";
      case 404:
        return "We couldn't find what you were looking for.";
      case 413:
        return "That file is too large.";
      case 429:
        return "Too many requests. Give it a moment and try again.";
      case 503:
        return "The processing service is unavailable right now. Please try again shortly.";
      default:
        if (error.response.status >= 500) {
          return "DocuMind hit a server error. Please try again in a moment.";
        }
        return fallback;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error) || !error.response?.data) return {};
  const data = error.response.data;
  if (typeof data !== "object" || Array.isArray(data)) return {};

  const result: Record<string, string> = {};
  for (const [field, value] of Object.entries(data as ErrorPayload)) {
    const message = flattenPayload(value);
    if (message) result[field] = message;
  }
  return result;
}
