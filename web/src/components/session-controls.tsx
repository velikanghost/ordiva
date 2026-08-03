"use client";

import Link from "next/link";
import { LogOut, WalletCards } from "lucide-react";
import { useEffect } from "react";
import { useSessionStore } from "@/lib/session-store";

export function SessionControls({ compact = false }: { compact?: boolean }) {
  const { hydrated, session, hydrate, signOut } = useSessionStore();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  if (!hydrated) {
    return <span className="h-10 w-32 animate-pulse rounded-[10px] bg-line" aria-label="Loading account" />;
  }

  if (!session) {
    return (
      <Link
        href="/sign-in"
        className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-line-strong px-4 text-sm font-semibold transition-colors hover:border-ink hover:bg-ink hover:text-paper"
      >
        <WalletCards aria-hidden="true" className="size-4" /> {compact ? "Sign in" : "Connect wallet"}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-right sm:block">
        <span className="block text-xs font-semibold">{session.email}</span>
        <span className="block font-mono text-[0.68rem] text-muted">
          {session.wallet.address.slice(0, 6)}…{session.wallet.address.slice(-4)}
        </span>
      </span>
      <button
        type="button"
        onClick={signOut}
        aria-label="Sign out"
        title="Sign out"
        className="grid size-10 place-items-center rounded-[10px] border border-line transition-colors hover:border-ink hover:bg-ink hover:text-paper"
      >
        <LogOut aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
