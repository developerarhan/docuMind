import { useCallback, useEffect, useRef, useState } from "react";
import { conversationsApi } from "../../services/api/conversations";
import { documentsApi } from "../../services/api/documents";
import { getErrorMessage } from "../../services/api/errors";
import type {
  ChatMessage,
  ChatSource,
  Document,
  DocumentSource,
  RawConversationMessage,
} from "../../types/api";

const DRAFT_KEY = "draft";
const EMPTY_MESSAGES: ChatMessage[] = [];

export interface ChatRequestError {
  message: string;
  question: string;
}

interface UseDocumentChatOptions {
  document: Document;
  conversationId: string | null;
  onConversationCreated: (conversationId: string) => void;
  onConversationsChanged: () => void;
}

interface UseDocumentChatResult {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isLoadingHistory: boolean;
  historyError: string | null;
  isSending: boolean;
  sendError: ChatRequestError | null;
  send: (question: string) => Promise<void>;
  retry: () => Promise<void>;
  reloadHistory: () => void;
  startNewConversation: () => void;
  dismissError: () => void;
}

export function useDocumentChat({
  document,
  conversationId,
  onConversationCreated,
  onConversationsChanged,
}: UseDocumentChatOptions): UseDocumentChatResult {
  const currentKey = conversationId ?? DRAFT_KEY;

  const [messagesByKey, setMessagesByKey] = useState<Record<string, ChatMessage[]>>({});
  const messagesRef = useRef<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendError, setSendError] = useState<ChatRequestError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const commitMessages = useCallback(
    (updater: (current: Record<string, ChatMessage[]>) => Record<string, ChatMessage[]>) => {
      const next = updater(messagesRef.current);
      messagesRef.current = next;
      setMessagesByKey(next);
    },
    [],
  );

  const cancelActiveRequest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    setIsSending(false);
  }, []);

  useEffect(() => {
    cancelActiveRequest();
    messagesRef.current = {};
    setMessagesByKey({});
    setInput("");
    setSendError(null);
    setHistoryError(null);
    setIsLoadingHistory(false);
  }, [document.id, cancelActiveRequest]);

  useEffect(() => {
    cancelActiveRequest();
    setSendError(null);
  }, [conversationId, cancelActiveRequest]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setIsLoadingHistory(false);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(messagesRef.current, conversationId)) {
      setIsLoadingHistory(false);
      return;
    }

    const controller = new AbortController();
    setIsLoadingHistory(true);
    setHistoryError(null);

    conversationsApi
      .messages(conversationId, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const mapped = response.messages
          .map((message, index) => mapHistoryMessage(message, conversationId, index))
          .filter((message): message is ChatMessage => message !== null);
        commitMessages((current) => ({ ...current, [conversationId]: mapped }));
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setHistoryError(
          getErrorMessage(caught, "Couldn't load this conversation's messages."),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingHistory(false);
      });

    return () => controller.abort();
  }, [conversationId, historyVersion, commitMessages]);

  const runRequest = useCallback(
    async (rawQuestion: string, appendUserMessage: boolean) => {
      const question = rawQuestion.trim();
      if (!question || sendingRef.current || document.status !== "ready") return;
      if (isLoadingHistory || historyError) return;

      const key = conversationId ?? DRAFT_KEY;
      const controller = new AbortController();
      abortRef.current = controller;
      sendingRef.current = true;
      setIsSending(true);
      setSendError(null);
      setInput("");

      if (appendUserMessage) {
        const userMessage: ChatMessage = {
          id: makeId(),
          role: "user",
          content: question,
          sources: [],
          createdAt: new Date().toISOString(),
        };
        commitMessages((current) => ({
          ...current,
          [key]: [...(current[key] ?? []), userMessage],
        }));
      }

      try {
        const response = await documentsApi.chat(
          document.id,
          {
            question,
            conversation_id: conversationId ?? undefined,
          },
          controller.signal,
        );

        if (controller.signal.aborted) return;

        const assistantMessage: ChatMessage = {
          id: makeId(),
          role: "assistant",
          content: response.answer,
          sources: mapSources(response.sources),
          createdAt: new Date().toISOString(),
        };

        const targetKey = conversationId ?? response.conversation_id;

        commitMessages((current) => {
          const next = { ...current };
          const baseMessages = current[key] ?? [];

          if (key === DRAFT_KEY && targetKey !== DRAFT_KEY) {
            delete next[DRAFT_KEY];
            next[targetKey] = [...baseMessages, assistantMessage];
          } else {
            next[targetKey] = [...(next[targetKey] ?? []), assistantMessage];
          }

          return next;
        });

        if (!conversationId) {
          onConversationCreated(response.conversation_id);
        }
        onConversationsChanged();
      } catch (caught) {
        if (controller.signal.aborted) return;
        setSendError({
          message: getErrorMessage(caught, "The assistant couldn't answer that question."),
          question,
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        sendingRef.current = false;
        setIsSending(false);
      }
    },
    [
      conversationId,
      document.id,
      document.status,
      historyError,
      isLoadingHistory,
      commitMessages,
      onConversationCreated,
      onConversationsChanged,
    ],
  );

  const send = useCallback(
    async (question: string) => {
      await runRequest(question, true);
    },
    [runRequest],
  );

  const retry = useCallback(async () => {
    if (!sendError) return;
    await runRequest(sendError.question, false);
  }, [runRequest, sendError]);

  const reloadHistory = useCallback(() => {
    if (!conversationId) return;
    commitMessages((current) => {
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
    setHistoryVersion((version) => version + 1);
  }, [conversationId, commitMessages]);

  const startNewConversation = useCallback(() => {
    cancelActiveRequest();
    setInput("");
    setSendError(null);
    setHistoryError(null);
    commitMessages((current) => {
      const next = { ...current };
      delete next[DRAFT_KEY];
      return next;
    });
  }, [cancelActiveRequest, commitMessages]);

  const dismissError = useCallback(() => setSendError(null), []);

  return {
    messages: messagesByKey[currentKey] ?? EMPTY_MESSAGES,
    input,
    setInput,
    isLoadingHistory,
    historyError,
    isSending,
    sendError,
    send,
    retry,
    reloadHistory,
    startNewConversation,
    dismissError,
  };
}

function mapSources(sources: DocumentSource[]): ChatSource[] {
  return sources.map((source) => ({
    sourceId: source.source_id,
    page: source.page,
    relevanceScore: source.relevance_score,
  }));
}

function mapHistoryMessage(
  message: RawConversationMessage,
  conversationId: string,
  index: number,
): ChatMessage | null {
  const role = message.role.toLowerCase();
  const normalizedRole =
    role === "user" || role === "human" ? "user" : role === "assistant" || role === "ai" ? "assistant" : null;

  if (!normalizedRole) return null;
  if (typeof message.content !== "string" || !message.content.trim()) return null;

  return {
    id: `history-${conversationId}-${index}`,
    role: normalizedRole,
    content: message.content,
    sources: [],
    createdAt: "",
  };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `message-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
