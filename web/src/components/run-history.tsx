"use client";

import Link from "next/link";
import { ArrowRight, CircleDashed, History } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchRuns, type RunStatus, type SourcingRun } from "@/lib/run";
import { useSessionStore } from "@/lib/session-store";

const LABEL: Record<RunStatus, string> = {
  research_ready: "Verification queued",
  verifying: "Verifying",
  verified: "Verified",
  partially_verified: "Partially verified",
  verification_failed: "Verification failed",
  budget_exhausted: "Budget exhausted",
};

export function RunHistory() {
  const { hydrated, session, hydrate } = useSessionStore();
  const [runs, setRuns] = useState<SourcingRun[] | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (!session?.token) return;
    void fetchRuns(session.token).then(setRuns).catch(() => setRuns([]));
  }, [session?.token]);

  if (!hydrated || !session) return null;

  return (
    <section className="border-t border-line px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <div className="flex items-center gap-2">
        <History aria-hidden="true" className="size-4 text-muted" />
        <h2 className="text-xl font-semibold tracking-[-0.025em]">Recent sourcing runs</h2>
      </div>
      {runs === null ? (
        <div className="mt-5 h-20 animate-pulse rounded-[12px] bg-canvas motion-reduce:animate-none" aria-label="Loading recent runs" />
      ) : runs.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm leading-6 text-muted">
          <CircleDashed aria-hidden="true" className="size-4" /> Your completed and active runs will appear here.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-line border-y border-line">
          {runs.map((run) => {
            const verified = run.suppliers.filter((supplier) => supplier.verified).length;
            return (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="grid gap-2 py-4 outline-none transition-colors hover:bg-canvas focus-visible:bg-violet-wash focus-visible:ring-2 focus-visible:ring-violet sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:px-3"
              >
                <span className="min-w-0 truncate font-semibold">{run.goal}</span>
                <span className="text-xs text-muted">{verified}/{run.suppliers.length} verified</span>
                <span className="font-mono text-xs text-muted">{run.budget.spent} / {run.budget.limit}</span>
                <span className="flex items-center justify-between gap-2 text-xs font-semibold sm:justify-end">
                  {LABEL[run.status]} <ArrowRight aria-hidden="true" className="size-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
