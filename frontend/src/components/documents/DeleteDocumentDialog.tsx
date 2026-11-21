import { useState } from "react";
import type { Document } from "../../types/api";
import { useDocuments } from "../../context/DocumentContext";
import { useToast } from "../../context/ToastContext";
import { getErrorMessage } from "../../services/api/errors";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface DeleteDocumentDialogProps {
  document: Document | null;
  onClose: () => void;
  onDeleted?: (document: Document) => void;
}

export function DeleteDocumentDialog({ document, onClose, onDeleted }: DeleteDocumentDialogProps) {
  const { deleteDocument } = useDocuments();
  const { pushToast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!document) return;
    setDeleting(true);
    try {
      await deleteDocument(document.id);
      pushToast({
        title: "Document removed",
        description: `“${document.title}” and its conversations were deleted.`,
        variant: "success",
      });
      onClose();
      onDeleted?.(document);
    } catch (caught) {
      pushToast({
        title: "Couldn't delete document",
        description: getErrorMessage(caught),
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      open={document !== null}
      onClose={onClose}
      onConfirm={() => void handleConfirm()}
      title="Remove this document?"
      description={
        <>
          <span className="font-medium text-ink">{document?.title}</span> will be permanently
          removed, along with every conversation tied to it and its search index. This can't be
          undone.
        </>
      }
      confirmLabel="Delete document"
      loading={deleting}
    />
  );
}
