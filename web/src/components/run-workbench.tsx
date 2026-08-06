"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CircleAlert,
  CircleDashed,
  CircleDot,
  ExternalLink,
  LoaderCircle,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { DecisionLedger } from "@/components/decision-ledger";
import { SessionControls } from "@/components/session-controls";
import { SpendMeter } from "@/components/spend-meter";
import { fetchRun, verifyRun, type SourcingRun } from "@/lib/run";
import { useSessionStore } from "@/lib/session-store";

/** Poll cadence while the agent is spending. Generous enough for ~5 minutes of work. */
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150;

const STATUS_LABEL: Record<SourcingRun["status"], string> = {
  research_ready: "Candidates discovered — not yet verified",
  verifying: "Buying evidence…",
  verified: "Verified",
  budget_exhausted: "Stopped — budget exhausted",
};

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-t border-line py-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-3 text-sm leading-6 text-muted">
        {items.map((item) => (
          <li key={item} className="flex min-w-0 gap-3">
            <Check aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-success" />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RunWorkbench({ runId }: { runId: string }) {
  const { hydrated, session, hydrate } = useSessionStore();
  const [run, setRun] = useState<SourcingRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  const load = useCallback(async () => {
    if (!session?.token) return;
    try {
      setRun(await fetchRun(runId, session.token));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "This run could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [runId, session?.token]);

  useEffect(() => {
    if (!hydrated) return;
    if (session) void load();
    else setLoading(false);
  }, [hydrated, load, session]);

  /**
   * Kick off verification, then poll while the agent spends.
   *
   * The request returns immediately; the run does not. Polling lets the ledger
   * and spend meter fill in as each purchase settles, rather than jumping from
   * empty to complete after a long silence.
   */
  async function runVerification() {
    if (!session?.token) return;
    setError(null);
    setVerifying(true);

    try {
      setRun(await verifyRun(runId, session.token));

      for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
        const next = await fetchRun(runId, session.token);
        setRun(next);
        if (next.status !== "verifying") return;
      }

      setError("Verification is taking longer than expected. Refresh to see the latest state.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Verification could not be completed.");
      // The agent may have paid for some evidence before failing; re-read so the
      // ledger reflects whatever actually happened.
      await load();
    } finally {
      setVerifying(false);
    }
  }

  if (!hydrated || loading) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-muted" role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          Loading sourcing run…
        </p>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <p className="text-sm leading-6 text-muted">
          <Link href="/sign-in" className="font-semibold text-violet underline">
            Sign in
          </Link>{" "}
          to view this run.
        </p>
      </Shell>
    );
  }

  if (!run) {
    return (
      <Shell>
        <p role="alert" className="text-sm leading-6 text-danger">
          {error ?? "This run could not be found."}
        </p>
      </Shell>
    );
  }

  const settled = run.purchases.filter((purchase) => purchase.outcome === "settled");
  const verifiedCount = run.suppliers.filter((supplier) => supplier.verified).length;
  const canVerify = run.status === "research_ready" && !verifying;

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[60ch]">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" /> Workspace
          </Link>
          <h1 className="mt-3 text-2xl font-semibold leading-8 tracking-[-0.025em]">{run.goal}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            {run.status === "verified" ? (
              <BadgeCheck aria-hidden="true" className="size-4 text-success" />
            ) : run.status === "verifying" || verifying ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <CircleDot aria-hidden="true" className="size-4" />
            )}
            {verifying ? STATUS_LABEL.verifying : STATUS_LABEL[run.status]}
          </p>
        </div>

        <div className="w-full max-w-xs shrink-0 rounded-[12px] border border-line p-4">
          <SpendMeter
            limit={run.budget.limit}
            spent={run.budget.spent}
            remaining={run.budget.remaining}
          />
          <p className="mt-3 border-t border-line pt-3 font-mono text-xs text-muted">
            {settled.length} paid Arc {settled.length === 1 ? "call" : "calls"}
          </p>
        </div>
      </div>

      {canVerify ? (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-[12px] border border-line bg-canvas p-5">
          <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-violet" />
          <p className="min-w-[18rem] flex-1 text-sm leading-6">
            The agent will buy evidence for each of the {run.suppliers.length} candidates, spending
            from its own escrowed balance within your budget — no further approvals.
          </p>
          <button
            type="button"
            onClick={() => void runVerification()}
            className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-ink px-5 font-semibold text-paper transition-colors hover:bg-violet"
          >
            Verify candidates
          </button>
        </div>
      ) : null}

      {verifying ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-8 flex items-center gap-3 rounded-[12px] border border-line bg-canvas p-5 text-sm leading-6"
        >
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
          The agent is buying evidence. Each candidate costs several paid calls on Arc.
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-[12px] bg-danger-wash px-4 py-3 text-sm leading-6 text-danger"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.6fr)]">
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">
            Candidates{" "}
            <span className="font-normal text-muted">
              ({verifiedCount} of {run.suppliers.length} verified)
            </span>
          </h2>
          <ul className="mt-4 grid gap-3">
            {run.suppliers.map((supplier) => (
              <li key={supplier.id} className="rounded-[12px] border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{supplier.name}</p>
                    <a
                      href={supplier.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 font-mono text-xs text-muted underline underline-offset-2"
                    >
                      {supplier.domain}
                      <ExternalLink aria-hidden="true" className="size-3" />
                    </a>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                      supplier.verified ? "bg-success-wash text-success" : "bg-canvas text-muted"
                    }`}
                  >
                    {supplier.verified ? (
                      <BadgeCheck aria-hidden="true" className="size-3" />
                    ) : (
                      <CircleDashed aria-hidden="true" className="size-3" />
                    )}
                    {supplier.verified ? "Verified" : "Unverified"}
                  </span>
                </div>
                {supplier.evidence.length > 0 ? (
                  <ul className="mt-3 grid gap-1 border-t border-line pt-3 text-sm leading-6 text-muted">
                    {supplier.evidence.map((note) => (
                      <li key={note}>· {note}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <aside>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">Plan</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{run.plan.summary}</p>
          <div className="mt-5 rounded-[12px] border border-line px-4 py-1">
            <PlanList title="Supplier requirements" items={run.plan.supplierRequirements} />
            <PlanList title="Evidence requirements" items={run.plan.evidenceRequirements} />
            <PlanList title="Outreach questions" items={run.plan.outreachQuestions} />
          </div>
          <p className="mt-4 font-mono text-xs text-muted">
            {run.research.queriesExecuted} discovery queries via {run.research.provider} — no wallet
            charge
          </p>
        </aside>
      </div>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
          <ReceiptText aria-hidden="true" className="size-4 text-muted" />
          Decision ledger
        </h2>
        <p className="mt-1 max-w-[62ch] text-sm leading-6 text-muted">
          Every purchase the agent attempted, including the ones policy refused.
        </p>
        <div className="mt-4">
          <DecisionLedger purchases={run.purchases} />
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-canvas px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[16px] border border-line bg-paper shadow-ledger-lg">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-[1.15rem] font-semibold tracking-[-0.03em]">
            <span className="grid size-8 place-items-center rounded-lg bg-violet font-mono text-sm font-bold text-white shadow-ledger-sm">
              O
            </span>
            Ordiva
          </Link>
          <SessionControls />
        </header>
        <div className="px-5 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</div>
      </div>
    </main>
  );
}
