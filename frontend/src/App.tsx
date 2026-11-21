import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute, PublicOnlyRoute } from "./components/layout/RouteGuards";
import { Spinner } from "./components/ui/Spinner";
import { AuthProvider } from "./context/AuthContext";
import { ConversationProvider } from "./context/ConversationContext";
import { DocumentProvider } from "./context/DocumentContext";
import { ToastProvider } from "./context/ToastContext";
import { UploadProvider } from "./context/UploadContext";
import { ConversationsPage } from "./pages/ConversationsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SettingsPage } from "./pages/SettingsPage";

// PDF.js is heavy; the reader (and its worker) only load with the workspace.
const DocumentWorkspacePage = lazy(() =>
  import("./pages/DocumentWorkspacePage").then((module) => ({
    default: module.DocumentWorkspacePage,
  })),
);


export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <DocumentProvider>
            <ConversationProvider>
              <UploadProvider>
                <ScrollToTop />
                <Routes>
                  <Route
                    path="/login"
                    element={
                      <PublicOnlyRoute>
                        <LoginPage />
                      </PublicOnlyRoute>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <PublicOnlyRoute>
                        <RegisterPage />
                      </PublicOnlyRoute>
                    }
                  />

                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppShell />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="/documents" element={<DocumentsPage />} />
                      <Route
                        path="/documents/:documentId"
                        element={
                          <Suspense fallback={<RouteLoading label="Opening workspace…" />}>
                            <DocumentWorkspacePage />
                          </Suspense>
                        }
                      />
                      <Route path="/conversations" element={<ConversationsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Route>
                </Routes>
              </UploadProvider>
            </ConversationProvider>
          </DocumentProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return null;
}

function RouteLoading({ label }: { label: string }) {
  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] place-items-center lg:min-h-dvh">
      <div className="flex items-center gap-2.5 text-[12px] text-muted">
        <Spinner className="size-4 text-cobalt" />
        {label}
      </div>
    </div>
  );
}

