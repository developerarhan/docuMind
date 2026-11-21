import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  FilePlus2,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  MessagesSquare,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useConversations } from "../../context/ConversationContext";
import { useDocuments } from "../../context/DocumentContext";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../services/api/errors";
import type { Conversation } from "../../types/api";
import { cn, formatDateTime, formatRelativeTime } from "../../utils/format";
import { Avatar } from "../ui/Avatar";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { FileGlyph } from "../ui/FileGlyph";
import { Logo } from "../ui/Logo";
import { StatusBadge, StatusDot } from "../ui/StatusBadge";

interface SidebarProps {
  onNavigate?: () => void;
  onClose?: () => void;
}

export function Sidebar({ onNavigate, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { documents } = useDocuments();
  const { conversations, removeConversation } = useConversations();
  const { pushToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const pathDocumentMatch = /^\/documents\/(\d+)\/?$/.exec(location.pathname);
  const activeDocumentId = pathDocumentMatch?.[1] ? Number(pathDocumentMatch[1]) : null;
  const activeConversationId = searchParams.get("c");
  const activeDocument = activeDocumentId
    ? (documents.find((document) => document.id === activeDocumentId) ?? null)
    : null;

  const documentConversations = useMemo(() => {
    if (!activeDocumentId) return [];
    return conversations.filter((conversation) => conversation.document.id === activeDocumentId);
  }, [conversations, activeDocumentId]);

  const recentDocuments = documents.slice(0, 5);

  const navItems = [
    { to: "/", label: "Overview", icon: LayoutDashboard, count: undefined, end: true },
    {
      to: "/documents",
      label: "Library",
      icon: LibraryBig,
      count: documents.length,
      end: false,
    },
    {
      to: "/conversations",
      label: "Conversations",
      icon: MessagesSquare,
      count: conversations.length,
      end: true,
    },
  ];

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await removeConversation(pendingDelete.id);
      const wasActive = pendingDelete.id === activeConversationId;
      pushToast({
        title: "Conversation deleted",
        description: "The thread and its assistant memory were removed.",
        variant: "success",
      });
      setPendingDelete(null);
      if (wasActive && activeDocumentId) {
        navigate(`/documents/${activeDocumentId}`, { replace: true });
      }
      onNavigate?.();
    } catch (caught) {
      pushToast({
        title: "Couldn't delete conversation",
        description: getErrorMessage(caught),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      onNavigate?.();
    }
  };

  return (
    <>
      <div className="flex h-full flex-col bg-night text-cream">
        <div className="flex items-start justify-between px-4 pb-4 pt-4">
          <div>
            <Link
              to="/"
              onClick={onNavigate}
              className="inline-flex rounded-md focus-visible:outline-cream"
              aria-label="DocuMind home"
            >
              <Logo tone="dark" />
            </Link>
            <p className="mt-3.5 text-[9px] font-medium uppercase tracking-[0.18em] text-cream-faint">
              Reading workspace
            </p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 inline-flex size-8 items-center justify-center rounded-md text-cream-dim transition-colors hover:bg-white/6 hover:text-cream"
              aria-label="Close navigation"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <nav className="px-2.5" aria-label="Primary">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors duration-150",
                      isActive
                        ? "bg-white/[0.07] text-cream"
                        : "text-cream-dim hover:bg-white/[0.04] hover:text-cream",
                    )}
                  >
                    {isActive ? (
                      <span
                        className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-[#8190ff]"
                        aria-hidden="true"
                      />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-[15px] shrink-0",
                        isActive ? "text-cream" : "text-cream-faint group-hover:text-cream-dim",
                      )}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span className="flex-1">{item.label}</span>
                    {typeof item.count === "number" ? (
                      <span className="text-[10px] font-normal tabular-nums text-cream-faint">
                        {item.count}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mx-4 my-3 h-px bg-white/[0.06]" aria-hidden="true" />

        <div className="scroll-dark min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
          {activeDocument ? (
            <div className="space-y-5">
              <section aria-labelledby="sidebar-current-document">
                <div className="flex items-center justify-between px-2.5 pb-1.5">
                  <h2
                    id="sidebar-current-document"
                    className="text-[9px] font-medium uppercase tracking-[0.17em] text-cream-faint"
                  >
                    Current document
                  </h2>
                  <Link
                    to="/documents"
                    onClick={onNavigate}
                    className="text-cream-faint transition-colors hover:text-cream-dim"
                    aria-label="Go to library"
                  >
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </Link>
                </div>
                <Link
                  to={`/documents/${activeDocument.id}`}
                  onClick={onNavigate}
                  className="group flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.035] p-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.055]"
                >
                  <FileGlyph size="sm" className="border-0 bg-cream/90" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[12px] font-medium leading-4.5 text-cream">
                      {activeDocument.title}
                    </span>
                    <StatusBadge status={activeDocument.status} className="mt-1.5 scale-90 origin-left" />
                  </span>
                </Link>
              </section>

              <section aria-labelledby="sidebar-threads">
                <div className="flex items-center justify-between px-2.5 pb-1.5">
                  <h2
                    id="sidebar-threads"
                    className="text-[9px] font-medium uppercase tracking-[0.17em] text-cream-faint"
                  >
                    Threads
                  </h2>
                  <Link
                    to={`/documents/${activeDocument.id}?new=1`}
                    onClick={onNavigate}
                    className="inline-flex size-5 items-center justify-center rounded text-cream-faint transition-colors hover:bg-white/6 hover:text-cream"
                    aria-label="Start a new conversation"
                    title="New conversation"
                  >
                    <Plus className="size-3" aria-hidden="true" />
                  </Link>
                </div>

                {documentConversations.length === 0 ? (
                  <p className="px-2.5 py-2 text-[11px] leading-4 text-cream-faint">
                    No conversations yet. Ask the first question from the assistant panel.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {documentConversations.map((conversation) => {
                      const isActive = conversation.id === activeConversationId;
                      return (
                        <li key={conversation.id} className="group relative">
                          <Link
                            to={`/documents/${activeDocument.id}?c=${conversation.id}`}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md py-1.5 pl-2.5 pr-7 text-[11.5px] transition-colors",
                              isActive
                                ? "bg-white/[0.075] text-cream"
                                : "text-cream-dim hover:bg-white/[0.04] hover:text-cream",
                            )}
                          >
                            <MessagesSquare
                              className={cn(
                                "size-3.5 shrink-0",
                                isActive ? "text-[#9aa6ff]" : "text-cream-faint",
                              )}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">Conversation</span>
                              <span className="block truncate text-[9.5px] text-cream-faint">
                                Updated {formatRelativeTime(conversation.updated_at)}
                              </span>
                            </span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(conversation)}
                            className="absolute right-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-cream-faint opacity-0 transition-[opacity,color,background-color] hover:bg-white/8 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label={`Delete conversation from ${formatDateTime(conversation.created_at)}`}
                            title="Delete conversation"
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <section aria-labelledby="sidebar-recent">
              <div className="flex items-center justify-between px-2.5 pb-1.5">
                <h2
                  id="sidebar-recent"
                  className="text-[9px] font-medium uppercase tracking-[0.17em] text-cream-faint"
                >
                  Recent documents
                </h2>
                <Link
                  to="/documents"
                  onClick={onNavigate}
                  className="text-cream-faint transition-colors hover:text-cream-dim"
                  aria-label="View all documents"
                >
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>

              {recentDocuments.length === 0 ? (
                <div className="px-2.5 py-2">
                  <p className="text-[11px] leading-4 text-cream-faint">
                    Your library is empty.
                  </p>
                  <Link
                    to="/documents"
                    onClick={onNavigate}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-cream-dim transition-colors hover:text-cream"
                  >
                    <FilePlus2 className="size-3" aria-hidden="true" />
                    Add your first PDF
                  </Link>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {recentDocuments.map((document) => (
                    <li key={document.id}>
                      <Link
                        to={`/documents/${document.id}`}
                        onClick={onNavigate}
                        className="group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[11.5px] text-cream-dim transition-colors hover:bg-white/[0.04] hover:text-cream"
                      >
                        <StatusDot status={document.status} />
                        <span className="min-w-0 flex-1 truncate">{document.title}</span>
                        <span className="shrink-0 text-[9px] tabular-nums text-cream-faint">
                          {formatRelativeTime(document.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {recentDocuments.length > 0 ? (
                <Link
                  to="/documents"
                  onClick={onNavigate}
                  className="mt-1.5 flex items-center gap-1 px-2.5 py-1 text-[10.5px] text-cream-faint transition-colors hover:text-cream-dim"
                >
                  View library
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              ) : null}
            </section>
          )}
        </div>

        <div className="border-t border-white/[0.07] p-2.5">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Avatar name={user?.username ?? "You"} tone="dark" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-medium text-cream">
                {user?.username ?? "Account"}
              </p>
              <p className="truncate text-[9.5px] text-cream-faint">Personal workspace</p>
            </div>
            <Link
              to="/settings"
              onClick={onNavigate}
              className="inline-flex size-7 items-center justify-center rounded-md text-cream-faint transition-colors hover:bg-white/6 hover:text-cream"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="size-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={signingOut}
              className="inline-flex size-7 items-center justify-center rounded-md text-cream-faint transition-colors hover:bg-white/6 hover:text-cream disabled:opacity-50"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
        title="Delete this conversation?"
        description={
          <>
            This removes the thread and its messages
            {pendingDelete ? ` from ${formatDateTime(pendingDelete.created_at)}` : ""}. The
            document itself stays in your library. This can't be undone.
          </>
        }
        confirmLabel="Delete conversation"
        loading={deleting}
      />
    </>
  );
}
