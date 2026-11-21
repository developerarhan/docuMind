import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpenCheck, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "../ui/Logo";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(430px,0.82fr)]">
      <div className="flex min-h-dvh flex-col px-5 py-5 sm:px-10 lg:px-14 lg:py-7">
        <header className="flex items-center justify-between">
          <Link to="/" className="inline-flex rounded-md" aria-label="DocuMind home">
            <Logo />
          </Link>
          <p className="hidden text-[11px] text-muted sm:block">
            A quieter way to read research.
          </p>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[382px] animate-fade-up">{children}</div>
        </div>

        <footer className="flex items-center justify-between gap-4 text-[10.5px] text-faint">
          <span>© {new Date().getFullYear()} DocuMind</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Private by default
          </span>
        </footer>
      </div>

      <AuthAside />
    </div>
  );
}

function AuthAside() {
  return (
    <aside className="night-grid relative hidden flex-col justify-between overflow-hidden border-l border-black/30 bg-night px-12 py-14 text-cream lg:flex xl:px-16">
      <div>
        <p className="flex items-center gap-2 text-[9.5px] font-medium uppercase tracking-[0.2em] text-cream-faint">
          <span className="h-px w-5 bg-[#8190ff]" aria-hidden="true" />
          Document intelligence
        </p>
        <h2 className="mt-5 max-w-[25rem] font-serif text-[38px] leading-[1.08] tracking-[-0.03em] text-cream xl:text-[44px]">
          Read less.
          <br />
          Understand more.
        </h2>
        <p className="mt-4 max-w-[24rem] text-[13px] leading-6 text-cream-dim">
          Bring a PDF. Ask it what matters. Every answer stays tied to the page it came
          from, so you can keep your footing.
        </p>
      </div>

      <div className="relative mx-auto my-10 w-full max-w-[26rem]" aria-hidden="true">
        <div className="relative rounded-lg border border-line bg-[#fbf8f1] p-5 shadow-panel">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">
              Research paper
            </span>
            <span className="text-[9px] tabular-nums text-faint">14 / 28</span>
          </div>
          <div className="space-y-2 py-4">
            <div className="h-2 w-[86%] rounded-full bg-[#e9e3d6]" />
            <div className="h-2 w-full rounded-full bg-[#eee9de]" />
            <div className="h-2 w-[93%] rounded-full bg-[#eee9de]" />
            <div className="my-3 h-2 w-[72%] rounded-full bg-[#dcdffb]" />
            <div className="h-2 w-full rounded-full bg-[#eee9de]" />
            <div className="h-2 w-[81%] rounded-full bg-[#eee9de]" />
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2.5">
            <span className="text-[8.5px] uppercase tracking-[0.16em] text-faint">Source page</span>
            <BookOpenCheck className="size-3.5 text-faint" />
          </div>
        </div>

        <div className="relative -mt-3 ml-8 rounded-lg border border-[#343d50] bg-[#1b2231] p-4 shadow-panel sm:ml-12">
          <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-[0.16em] text-[#9aa6ff]">
            <Sparkles className="size-3" aria-hidden="true" />
            Assistant
          </div>
          <p className="mt-2 text-[12px] leading-5 text-cream">
            The methodology rests on three stages, each validated against the reported
            results.
            <span className="ml-1.5 inline-flex items-center rounded border border-[#3a4bb5] bg-[#26317a]/60 px-1 py-px align-middle text-[8px] font-semibold text-[#c3caff]">
              Source 2 · p. 14
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-3.5 border-t border-white/[0.07] pt-6">
        {[
          { icon: Sparkles, text: "Answers grounded in the document itself" },
          { icon: Quote, text: "Page-level citations for every claim" },
          { icon: BookOpenCheck, text: "Context that carries across your reading" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.text} className="flex items-center gap-2.5 text-[11.5px] text-cream-dim">
              <Icon className="size-3.5 shrink-0 text-[#8190ff]" aria-hidden="true" />
              {item.text}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
