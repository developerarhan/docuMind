import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { conversationsApi } from "../services/api/conversations";
import { getErrorMessage } from "../services/api/errors";
import type { Conversation } from "../types/api";
import { useAuth } from "./AuthContext";
import { DOCUMENTS_CHANGED_EVENT } from "./DocumentContext";

interface RefreshOptions {
  silent?: boolean;
  signal?: AbortSignal;
}

interface ConversationContextValue {
  conversations: Conversation[];
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  removeConversation: (id: string) => Promise<void>;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    const { silent = false, signal } = options;
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const data = await conversationsApi.list();
      if (signal?.aborted) return;
      setConversations(data);
      setError(null);
      setHasLoaded(true);
    } catch (caught) {
      if (signal?.aborted) return;
      if (!silent) {
        setError(getErrorMessage(caught, "Couldn't load your conversations."));
      }
    } finally {
      if (!silent && !signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setConversations([]);
      setHasLoaded(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    void refresh({ signal: controller.signal });
    return () => controller.abort();
  }, [status, refresh]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const handleDocumentsChanged = () => {
      void refresh({ silent: true });
    };
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, handleDocumentsChanged);
    return () => window.removeEventListener(DOCUMENTS_CHANGED_EVENT, handleDocumentsChanged);
  }, [status, refresh]);

  const removeConversation = useCallback(async (id: string) => {
    await conversationsApi.remove(id);
    setConversations((current) => current.filter((conversation) => conversation.id !== id));
  }, []);

  const value = useMemo<ConversationContextValue>(
    () => ({
      conversations,
      isLoading,
      hasLoaded,
      error,
      refresh,
      removeConversation,
    }),
    [conversations, isLoading, hasLoaded, error, refresh, removeConversation],
  );

  return (
    <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>
  );
}

export function useConversations(): ConversationContextValue {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error("useConversations must be used inside ConversationProvider.");
  }
  return context;
}
