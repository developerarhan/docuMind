import { useEffect, useRef, useState } from "react";
import { Menu, Settings2 } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../ui/Avatar";
import { Logo } from "../ui/Logo";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-dvh bg-paper">
      <a
        href="#main-content"
        className="sr-only z-[120] rounded-md bg-night px-3 py-2 text-sm text-cream focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[276px] border-r border-black/20 lg:block">
        <Sidebar />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-black/20 bg-night px-3 text-cream lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex size-9 items-center justify-center rounded-md text-cream-dim transition-colors hover:bg-white/6 hover:text-cream"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
        <Link to="/" className="inline-flex rounded-md" aria-label="DocuMind home">
          <Logo tone="dark" size="sm" />
        </Link>
        <div className="flex-1" />
        <Link
          to="/settings"
          className="inline-flex size-9 items-center justify-center rounded-md"
          aria-label="Open settings"
        >
          {user ? (
            <Avatar name={user.username} size="sm" tone="dark" />
          ) : (
            <Settings2 className="size-4 text-cream-dim" aria-hidden="true" />
          )}
        </Link>
      </header>

      <main id="main-content" className="min-h-dvh pt-14 lg:pl-[276px] lg:pt-0">
        <Outlet />
      </main>

      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  );
}

function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    }, 40);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = panelRef.current
        ? Array.from(
            panelRef.current.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((element) => element.offsetParent !== null)
        : [];

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-night/55 animate-fade-in"
        aria-label="Close navigation"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className="relative h-full w-[292px] max-w-[86vw] animate-drawer-in shadow-panel"
      >
        <Sidebar onNavigate={onClose} onClose={onClose} />
      </div>
    </div>
  );
}
