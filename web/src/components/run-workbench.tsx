"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDot,
  FileSearch,
  ListChecks,
  Mail,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect } from "react";
import { SessionControls } from "@/components/session-controls";
import { readPlannedRun, type PlannedSourcingRun } from "@/lib/run";
import { useSessionStore } from "@/lib/session-store";

const stages = [
  { name: "Plan", detail: "Ready", state: "complete" },
  { name: "Search", detail: "Next", state: "current" },
  { name: "Verify", detail: "Waiting", state: "upcoming" },
  { name: "Approve", detail: "Email", state: "upcoming" },
  { name: "Send", detail: "Waiting", state: "upcoming" },
] as const;

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

export function RunWorkbench({ runId }: { runId: string; initialGoal?: string; initialBudget?: string }) {
  const { hydrated, session, hydrate } = useSessionStore();
  const run: PlannedSourcingRun | null | undefined = hydrated && session ? readPlannedRun(runId) : undefined;

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  if (!hydrated || (session && run === undefined)) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-5">
        <span className="text-sm font-semibold text-muted">Loading sourcing plan…</span>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
        <section className="w-full max-w-xl rounded-[16px] border border-line bg-paper p-7 sm:p-10">
          <WalletCards aria-hidden="true" className="size-7 text-violet" />
          <h1 className="mt-7 text-balance text-4xl font-semibold leading-tight tracking-[-0.04em]">Connect your wallet to continue.</h1>
          <p className="mt-4 max-w-[52ch] leading-7 text-muted">
            Your Arc wallet identifies your account and authorizes paid sourcing services. Ordiva asks again before email is sent.
          </p>
          <Link href={`/sign-in?returnTo=${encodeURIComponent(`/runs/${runId}`)}`} className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-violet px-5 font-semibold text-white hover:bg-violet-dark">
            <WalletCards aria-hidden="true" className="size-4" /> Connect wallet
          </Link>
        </section>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10">
        <section className="w-full max-w-xl rounded-[16px] border border-line bg-paper p-7 sm:p-10">
          <FileSearch aria-hidden="true" className="size-7 text-violet" />
          <h1 className="mt-7 text-balance text-4xl font-semibold leading-tight tracking-[-0.04em]">This sourcing plan is no longer available.</h1>
          <p className="mt-4 max-w-[52ch] leading-7 text-muted">Plans stay in the browser session that created them. Start a new run to prepare another plan.</p>
          <Link href="/" className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-[12px] bg-violet px-5 font-semibold text-white hover:bg-violet-dark">Start a new run</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-3 py-3 sm:px-5 lg:px-7">
      <div className="mx-auto max-w-[1600px] overflow-hidden rounded-[16px] border border-line bg-paper">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="Back to sourcing goals" className="grid size-9 shrink-0 place-items-center rounded-full border border-line transition-colors hover:border-ink hover:bg-ink hover:text-paper">
              <ArrowLeft aria-hidden="true" className="size-4" />
            </Link>
            <div className="min-w-0">
              <span className="block max-w-[36rem] truncate text-sm font-semibold">{run.goal}</span>
              <span className="block truncate text-xs text-muted">{run.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden items-center gap-2 text-xs font-semibold sm:inline-flex"><CircleDot aria-hidden="true" className="size-3.5 text-violet" /> Plan ready</span>
            <span className="text-xs text-muted"><strong className="font-semibold text-ink">{run.budget.limit}</strong> available</span>
            <SessionControls compact />
          </div>
        </header>

        <nav aria-label="Run progress" className="overflow-x-auto border-b border-line bg-canvas">
          <ol className="grid min-w-[720px] grid-cols-5">
            {stages.map((stage, index) => (
              <li key={stage.name} className={`relative flex min-h-20 items-center gap-3 border-r border-line px-5 last:border-r-0 ${stage.state === "current" ? "bg-violet-wash" : ""}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${stage.state === "complete" ? "border-ink bg-ink text-paper" : stage.state === "current" ? "border-violet bg-violet text-white" : "border-line-strong text-muted"}`}>
                  {stage.state === "complete" ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
                </span>
                <span><span className="block text-sm font-semibold">{stage.name}</span><span className="mt-0.5 block text-xs text-muted">{stage.detail}</span></span>
                {index < stages.length - 1 ? <ChevronRight aria-hidden="true" className="absolute right-2 size-3.5 text-line-strong" /> : null}
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid lg:grid-cols-[minmax(0,1.12fr)_minmax(24rem,0.88fr)]">
          <section className="min-w-0 border-b border-line px-5 py-8 sm:px-8 lg:border-r lg:border-b-0 lg:px-10 lg:py-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm font-semibold"><ListChecks aria-hidden="true" className="size-4 text-violet" /> Sourcing plan</span>
              <span className="rounded-full bg-violet-wash px-3 py-1.5 text-xs font-semibold text-violet-dark">{run.supplierMinimum}+ suppliers required</span>
            </div>
            <h1 className="mt-8 max-w-[18ch] text-balance text-[clamp(2.2rem,4.4vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em]">{run.plan.summary}</h1>

            <div className="mt-10 border-y border-line">
              <div className="grid gap-2 border-b border-line py-4 sm:grid-cols-[10rem_1fr]"><span className="text-sm text-muted">First service</span><span className="text-sm font-semibold">{run.nextAction.provider} supplier search</span></div>
              <div className="grid gap-2 border-b border-line py-4 sm:grid-cols-[10rem_1fr]"><span className="text-sm text-muted">Planned query</span><span className="min-w-0 break-words text-sm font-semibold">{run.nextAction.input.query}</span></div>
              <div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr]"><span className="text-sm text-muted">Service cost</span><span className="text-sm font-semibold tabular-nums">{run.nextAction.price} USDC on Arc testnet</span></div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-[12px] bg-success-wash px-4 py-4 text-sm leading-6 text-success"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span><strong className="block">Payment remains unapproved</strong>Budget and service policy are checked before any purchase.</span></div>
              <div className="flex items-start gap-3 rounded-[12px] bg-canvas px-4 py-4 text-sm leading-6 text-muted"><Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span><strong className="block text-ink">Email remains unapproved</strong>Every draft still needs recipient-level review.</span></div>
            </div>
          </section>

          <aside aria-labelledby="plan-details-heading" className="min-w-0 bg-[#f8f7f3] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
            <h2 id="plan-details-heading" className="text-2xl font-semibold tracking-[-0.03em]">Research instructions</h2>
            <p className="mt-2 text-sm leading-6 text-muted">The plan is structured; it does not contain supplier claims.</p>
            <div className="mt-7">
              <PlanList title="Discovery queries" items={run.plan.searchQueries} />
              <PlanList title="Supplier requirements" items={run.plan.supplierRequirements} />
              <PlanList title="Evidence to collect" items={run.plan.evidenceRequirements} />
              <PlanList title="Questions for approved outreach" items={run.plan.outreachQuestions} />
            </div>
          </aside>
        </div>

        <section className="border-t border-line px-5 py-10 sm:px-8 lg:px-10" aria-labelledby="supplier-results-heading">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <span className="grid size-12 place-items-center rounded-full border border-line bg-canvas"><Search aria-hidden="true" className="size-5 text-violet" /></span>
            <h2 id="supplier-results-heading" className="mt-5 text-2xl font-semibold tracking-[-0.03em]">No supplier results yet</h2>
            <p className="mt-3 max-w-[54ch] text-sm leading-6 text-muted">The plan is ready. No supplier search has been purchased, and no evidence has been presented as verified.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
