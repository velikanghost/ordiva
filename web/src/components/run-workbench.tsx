"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  CircleDashed,
  CircleDot,
  ExternalLink,
  LoaderCircle,
  ReceiptText,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { DecisionLedger } from "@/components/decision-ledger";
import { ContractActivityLedger } from "@/components/contract-activity-ledger";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SpendMeter } from "@/components/spend-meter";
import { OutreachPanel } from "@/components/outreach-panel";
import { SourcingPlanDrawer } from "@/components/sourcing-plan-drawer";
import { fetchRun, type SourcingRun } from "@/lib/run";
import { useSessionStore } from "@/lib/session-store";

/** Poll cadence while the agent is spending. Generous enough for ~5 minutes of work. */
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150;

const STATUS_LABEL: Record<SourcingRun["status"], string> = {
  research_ready: "Automatic verification queued…",
  verifying: "Buying evidence…",
  verified: "Verified",
  partially_verified: "Some suppliers need more evidence",
  verification_failed: "Verification did not establish a supplier",
  budget_exhausted: "Stopped — budget exhausted",
};

export function RunWorkbench({ runId }: { runId: string }) {
  const { hydrated, session, hydrate } = useSessionStore();
  const token = session?.token;
  const [run, setRun] = useState<SourcingRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setRun(await fetchRun(runId, token));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "This run could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [runId, token]);

  useEffect(() => {
    if (!hydrated) return;
    // The persisted run is external server state and is synchronized after session hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session) void load();
    else setLoading(false);
  }, [hydrated, load, session]);

  useEffect(() => {
    if (!token || run?.status !== "verifying") return;
    const authToken = token;
    let cancelled = false;

    async function pollVerification() {
      for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
        if (cancelled) return;
        try {
          const next = await fetchRun(runId, authToken);
          if (cancelled) return;
          setRun(next);
          setError(null);
          if (next.status !== "verifying") return;
        } catch (caught) {
          if (!cancelled) {
            setError(caught instanceof ApiError ? caught.message : "Verification progress could not be loaded.");
          }
          return;
        }
      }
      if (!cancelled) {
        setError("Verification is taking longer than expected. Refresh to see the latest state.");
      }
    }

    void pollVerification();
    return () => {
      cancelled = true;
    };
  }, [run?.status, runId, token]);

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
            ) : run.status === "verifying" ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <CircleDot aria-hidden="true" className="size-4" />
            )}
            {STATUS_LABEL[run.status]}
          </p>
        </div>

        <div className="flex w-full max-w-xs shrink-0 flex-col gap-3">
          <SourcingPlanDrawer run={run} />
          <div className="rounded-[12px] border border-line p-4">
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
      </div>

      {run.status === "verifying" ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-8 flex items-center gap-3 rounded-[12px] border border-line bg-canvas p-5 text-sm leading-6"
        >
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
          The agent is automatically buying evidence within your budget. Each candidate costs several paid calls on Arc.
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

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(18rem,0.65fr)_minmax(0,1.35fr)]">
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
                    {supplier.verified ? "Verified" : supplier.verificationStatus.replace("_", " ")}
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

        <aside className="min-w-0">
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
          <div className="mt-8 border-t border-line pt-6">
            <h3 className="text-sm font-semibold">Registry activity</h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              State-changing OrdivaRegistry calls, with their Arc transaction proof.
            </p>
            <div className="mt-4">
              <ContractActivityLedger activities={run.contractActivities} />
            </div>
          </div>
        </aside>
      </div>

      <OutreachPanel run={run} token={session.token} email={session.email} onRun={setRun} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell section="Sourcing run">
      <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</div>
    </WorkspaceShell>
  );
}
