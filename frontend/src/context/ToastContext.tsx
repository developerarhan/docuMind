import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { UNAUTHORIZED_EVENT, getStoredToken } from "../services/api/client";
import { cn } from "../utils/format";

export type ToastVariant = "success" | "error" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (options: ToastOptions) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const toast: ToastItem = {
        ...options,
        id,
        variant: options.variant ?? "info",
      };

      setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), toast]);

      const timer = window.setTimeout(() => {
        dismiss(id);
      }, options.duration ?? 5200);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!getStoredToken()) return;
      pushToast({
        title: "Session expired",
        description: "Please sign in again to continue.",
        variant: "error",
      });
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [pushToast]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) {
        window.clearTimeout(timer);
      }
      activeTimers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-100 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const Icon =
    toast.variant === "success"
      ? CheckCircle2
      : toast.variant === "error"
        ? AlertTriangle
        : Info;

  return (
    <div
      className="pointer-events-auto flex w-full max-w-[24rem] animate-toast-in gap-3 rounded-lg border border-night-line bg-night-raised/98 px-3.5 py-3 text-cream shadow-panel backdrop-blur-sm"
      role={toast.variant === "error" ? "alert" : "status"}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          toast.variant === "success" && "text-emerald-400",
          toast.variant === "error" && "text-red-300",
          toast.variant === "info" && "text-indigo-300",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-5 text-cream">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-5 text-cream-dim">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="-mr-1 -mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-cream-faint transition-colors hover:bg-white/6 hover:text-cream"
        aria-label="Dismiss notification"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }
  return context;
}
