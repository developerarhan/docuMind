import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { UploadDialog } from "../components/documents/UploadDialog";

interface UploadContextValue {
  openUpload: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openUpload = useCallback(() => setOpen(true), []);
  const closeUpload = useCallback(() => setOpen(false), []);

  const value = useMemo<UploadContextValue>(() => ({ openUpload }), [openUpload]);

  return (
    <UploadContext.Provider value={value}>
      {children}
      <UploadDialog open={open} onClose={closeUpload} />
    </UploadContext.Provider>
  );
}

export function useUpload(): UploadContextValue {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used inside UploadProvider.");
  }
  return context;
}
