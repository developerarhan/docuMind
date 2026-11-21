import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Brain,
  CalendarDays,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { memoriesApi } from "../services/api/memories";
import { getErrorMessage } from "../services/api/errors";
import type { MemoryCategory, UserMemory } from "../types/api";
import { formatDate, formatRelativeTime, pluralize } from "../utils/format";
import { Alert } from "../components/ui/Alert";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { Select, Textarea } from "../components/ui/Input";
import { FormField } from "../components/ui/FormField";
import { Skeleton } from "../components/ui/Skeleton";

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  preference: "Preference",
  learning_goal: "Learning goal",
  personal_context: "Personal context",
  interest: "Interest",
  other: "Other",
};

const CATEGORY_OPTIONS: MemoryCategory[] = [
  "preference",
  "learning_goal",
  "personal_context",
  "interest",
  "other",
];

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { pushToast } = useToast();

  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("preference");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserMemory | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadMemories = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await memoriesApi.list();
      setMemories(data);
    } catch (caught) {
      setLoadError(getErrorMessage(caught, "Couldn't load assistant memory."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    memoriesApi
      .list()
      .then((data) => {
        if (!cancelled) {
          setMemories(data);
          setLoading(false);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setLoadError(getErrorMessage(caught, "Couldn't load assistant memory."));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const groupedCount = useMemo(() => {
    const counts = new Map<MemoryCategory, number>();
    for (const memory of memories) {
      counts.set(memory.category, (counts.get(memory.category) ?? 0) + 1);
    }
    return counts;
  }, [memories]);

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newMemory.trim();
    if (!trimmed) {
      setFormError("Write something the assistant should remember.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const saved = await memoriesApi.create({ memory: trimmed, category });
      setMemories((current) => [saved, ...current]);
      setNewMemory("");
      pushToast({
        title: "Memory saved",
        variant: "success",
        description: "The assistant can use this in future conversations.",
      });
    } catch (caught) {
      setFormError(getErrorMessage(caught, "Couldn't save that memory."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await memoriesApi.remove(deleteTarget.id);
      setMemories((current) => current.filter((memory) => memory.id !== deleteTarget.id));
      pushToast({ title: "Memory removed", variant: "success" });
      setDeleteTarget(null);
    } catch (caught) {
      pushToast({
        title: "Couldn't remove memory",
        description: getErrorMessage(caught),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1060px] px-5 py-8 sm:px-8 lg:px-10 lg:py-11">
      <PageHeader
        eyebrow="Settings"
        title="Account & memory"
        description="Your profile details and the context DocuMind carries into future conversations."
      />

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-8">
          <section className="rounded-xl border border-line bg-surface p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <Avatar name={user?.username ?? "Account"} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
                  {user?.username}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {user?.email || "Personal workspace"}
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-3 border-t border-line pt-4">
              <div className="flex items-center gap-2.5">
                <UserRound className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                <dt className="w-24 text-[10.5px] uppercase tracking-[0.1em] text-faint">Username</dt>
                <dd className="min-w-0 flex-1 truncate text-right text-[11.5px] text-ink">
                  {user?.username}
                </dd>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                <dt className="w-24 text-[10.5px] uppercase tracking-[0.1em] text-faint">Email</dt>
                <dd className="min-w-0 flex-1 truncate text-right text-[11.5px] text-ink">
                  {user?.email || "Not added"}
                </dd>
              </div>
              <div className="flex items-center gap-2.5">
                <CalendarDays className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                <dt className="w-24 text-[10.5px] uppercase tracking-[0.1em] text-faint">Joined</dt>
                <dd className="min-w-0 flex-1 text-right text-[11.5px] text-ink">
                  {user ? formatDate(user.date_joined) : "—"}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-[10px] leading-4 text-faint">
              Profile details are read-only. Contact your workspace administrator to change
              account information.
            </p>

            <Button
              variant="secondary"
              size="sm"
              className="mt-4 w-full"
              onClick={() => void handleSignOut()}
              loading={signingOut}
            >
              {!signingOut ? <LogOut className="size-3.5" aria-hidden="true" /> : null}
              Sign out of DocuMind
            </Button>
          </section>

          <section className="rounded-xl border border-dashed border-line-strong/80 p-4">
            <p className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
              <Sparkles className="size-3 text-cobalt" aria-hidden="true" />
              Good to know
            </p>
            <p className="mt-1.5 text-[10.5px] leading-4.5 text-muted">
              Memory is separate from your documents. Removing a memory never deletes a PDF or
              a conversation.
            </p>
          </section>
        </aside>

        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-soft">
          <div className="border-b border-line px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-cobalt/15 bg-cobalt-soft text-cobalt">
                  <Brain className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
                    Assistant memory
                  </h2>
                  <p className="mt-1 max-w-lg text-[11.5px] leading-5 text-muted">
                    Durable preferences and context the assistant can draw on beyond the current
                    thread. Some memories are extracted after conversations; you can add or
                    remove them at any time.
                  </p>
                </div>
              </div>
              <span className="hidden shrink-0 rounded-full border border-line bg-paper px-2 py-0.5 text-[9.5px] tabular-nums text-muted sm:inline">
                {memories.length} {pluralize(memories.length, "memory", "memories")}
              </span>
            </div>

            {memories.length > 0 ? (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.filter((option) => groupedCount.has(option)).map((option) => (
                  <span
                    key={option}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-paper/70 px-2 py-0.5 text-[9.5px] text-muted"
                  >
                    {CATEGORY_LABELS[option]}
                    <span className="text-faint">{groupedCount.get(option)}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-b border-line bg-paper/35 px-5 py-4 sm:px-6">
            <form onSubmit={(event) => void handleAdd(event)}>
              {formError ? <Alert className="mb-3">{formError}</Alert> : null}
              <FormField label="Add a note" htmlFor="new-memory" hint="Write it in the first person, as you'd want the assistant to know it.">
                <Textarea
                  id="new-memory"
                  value={newMemory}
                  onChange={(event) => {
                    setNewMemory(event.target.value);
                    setFormError(null);
                  }}
                  placeholder="e.g. I prefer short, structured summaries with the key takeaway first."
                  rows={2}
                  className="min-h-[70px] bg-surface"
                />
              </FormField>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:items-end sm:justify-between">
                <FormField label="Category" htmlFor="memory-category" className="sm:max-w-[190px] sm:flex-1">
                  <Select
                    id="memory-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as MemoryCategory)}
                    className="h-9 bg-surface text-[12px]"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {CATEGORY_LABELS[option]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <Button type="submit" size="sm" loading={saving} disabled={!newMemory.trim()}>
                  {!saving ? <Plus className="size-3.5" aria-hidden="true" /> : null}
                  Save memory
                </Button>
              </div>
            </form>
          </div>

          {loadError ? (
            <div className="p-5 sm:p-6">
              <Alert title="Couldn't load memory">
                <div className="flex flex-wrap items-center gap-2">
                  {loadError}
                  <button
                    type="button"
                    onClick={() => void loadMemories()}
                    className="font-medium underline underline-offset-2"
                  >
                    Try again
                  </button>
                </div>
              </Alert>
            </div>
          ) : loading ? (
            <div className="space-y-3 p-5 sm:p-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-[85%]" />
            </div>
          ) : memories.length === 0 ? (
            <EmptyState
              icon={Brain}
              title="Nothing remembered yet"
              description="As you chat, DocuMind may save useful preferences and context here. You can also add the first note above."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-line/80">
              {memories.map((memory) => (
                <li
                  key={memory.id}
                  className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-paper/40 sm:px-6"
                >
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-cobalt/60" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-5 text-ink-soft">{memory.memory}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] text-faint">
                      <span className="rounded border border-line bg-paper px-1.5 py-px text-[9px] text-muted">
                        {CATEGORY_LABELS[memory.category]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Saved {formatRelativeTime(memory.created_at)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(memory)}
                    className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-faint opacity-100 transition-[color,background-color,opacity] hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Remove memory"
                    title="Remove memory"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-line bg-paper/35 px-5 py-3 text-[9.5px] text-faint sm:px-6">
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="size-3" aria-hidden="true" />
              Memory is refreshed in the background after conversations
            </span>
            <button
              type="button"
              onClick={() => void loadMemories()}
              disabled={loading}
              className="font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              Reload
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Remove this memory?"
        description={
          <>
            “{deleteTarget?.memory.slice(0, 140)}
            {deleteTarget && deleteTarget.memory.length > 140 ? "…" : ""}” will be removed from
            the assistant's context. This doesn't affect your documents or conversations.
          </>
        }
        confirmLabel="Remove memory"
        loading={deleting}
      />
    </div>
  );
}
