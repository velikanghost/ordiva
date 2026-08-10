"use client";

import Link from "next/link";
import { ArrowUpRight, CircleDot, LayoutDashboard, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SessionControls } from "@/components/session-controls";
import { useSessionStore } from "@/lib/session-store";

export function WorkspaceShell({ children, section }: { children: React.ReactNode; section: string }) {
  const router = useRouter();
  const { hydrated, session, hydrate } = useSessionStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (!hydrated || session) return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  }, [hydrated, router, session]);

  if (!hydrated || !session) {
    return (
      <main className="grid min-h-screen place-items-center bg-ink text-paper">
        <p className="flex items-center gap-3 text-sm text-white/75" role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          Opening your workspace…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <aside className="hidden w-60 shrink-0 flex-col px-6 py-7 text-paper lg:flex">
          <Link href="/app" className="flex w-fit items-center gap-2 text-lg font-semibold tracking-[-0.03em]">
            <span className="grid size-8 place-items-center rounded-[9px] bg-violet font-mono text-sm font-bold text-white">O</span>
            Ordiva
          </Link>
          <nav aria-label="Workspace navigation" className="mt-12">
            <Link href="/app" className="flex min-h-11 items-center gap-3 rounded-[10px] bg-paper/10 px-3 text-sm font-semibold text-paper">
              <LayoutDashboard aria-hidden="true" className="size-4" /> Workspace
            </Link>
          </nav>
          <div className="mt-auto border-t border-white/15 pt-5">
            <p className="flex items-center gap-2 text-xs font-semibold text-white/75">
              <CircleDot aria-hidden="true" className="size-3.5 text-[#56d48a]" /> Arc Testnet
            </p>
            <Link href="/" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white/75 hover:text-white">
              Public site <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </aside>

        <section className="min-w-0 flex-1 bg-paper lg:my-3 lg:mr-3 lg:overflow-hidden lg:rounded-[16px]">
          <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/app" aria-label="Ordiva workspace" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink font-mono text-sm font-bold text-paper lg:hidden">O</Link>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{section}</p>
                <p className="hidden text-xs text-muted sm:block">Policy-controlled sourcing operations</p>
              </div>
            </div>
            <SessionControls showWorkspace={false} />
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
