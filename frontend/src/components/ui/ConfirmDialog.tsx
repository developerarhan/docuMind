import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { cn } from "../../utils/format";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: "danger" | "primary";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  tone = "danger",
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <span
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
            tone === "danger" ? "bg-danger-soft text-danger" : "bg-cobalt-soft text-cobalt",
          )}
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
        </span>
        <div className="pt-1 text-[13px] leading-6 text-muted">{description}</div>
      </div>
    </Dialog>
  );
}
