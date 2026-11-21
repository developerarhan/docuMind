import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../ui/Logo";
import { Spinner } from "../ui/Spinner";

export function BootstrapScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper">
      <div className="flex flex-col items-center gap-5">
        <Logo />
        <div className="flex items-center gap-2 text-[11.5px] text-muted">
          <Spinner className="size-3.5 text-cobalt" />
          Opening your workspace…
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <BootstrapScreen />;

  if (status === "anonymous") {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") return <BootstrapScreen />;
  if (status === "authenticated") return <Navigate to="/" replace />;

  return <>{children}</>;
}
