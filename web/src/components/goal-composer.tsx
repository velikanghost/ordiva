"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Check, LoaderCircle, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { apiJson, ApiError } from "@/lib/api";
import type { SourcingRun } from "@/lib/run";
import { useSessionStore } from "@/lib/session-store";

export function GoalComposer({ initialGoal, initialBudget }: { initialGoal?: string; initialBudget?: string }) {
  const router = useRouter();
  const { hydrated, session, hydrate, signOut } = useSessionStore();
  const [goal, setGoal] = useState(
    initialGoal?.trim() ||
      "Find at least three industrial pump suppliers in Rotterdam, verify they are real companies, and prepare an RFQ for each.",
  );
  const [budget, setBudget] = useState(initialBudget || "2.00");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  return (
    <form
      className="flex h-full flex-col"
      aria-busy={isRunning}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!goal.trim() || isRunning) return;
        const query = new URLSearchParams({ goal: goal.trim(), budget });
        if (!session) {
          router.push(`/sign-in?returnTo=${encodeURIComponent(`/app?${query.toString()}`)}`);
          return;
        }

        setError(null);
        setIsRunning(true);
        try {
          // The run is persisted server-side, so the workbench reads it back by id
          // rather than carrying it through the browser.
          const run = await apiJson<SourcingRun>("/v1/runs/plan", {
            method: "POST",
            headers: { authorization: `Bearer ${session.token}` },
            body: JSON.stringify({ goal: goal.trim(), budget, supplierMinimum: 3 }),
          });
          router.push(`/runs/${run.id}`);
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 401) {
            signOut();
            router.push(`/sign-in?returnTo=${encodeURIComponent(`/app?${query.toString()}`)}`);
            return;
          }
          setError(caught instanceof Error ? caught.message : "The sourcing plan could not be prepared. Please try again.");
        } finally {
          setIsRunning(false);
        }
      }}
    >
      <h2 className="text-2xl font-semibold tracking-[-0.025em]">Start a sourcing run</h2>
      <div className="mt-8 flex items-center justify-between">
        <label className="text-sm font-semibold" htmlFor="sourcing-goal">
          Sourcing goal
        </label>
        <span className="text-xs text-muted font-mono">⌘ + Enter to run</span>
      </div>

      {/* Preset Quick-Fill Chips */}
      <div className="mt-2 flex flex-wrap gap-2">
        {[
          "Find 3 industrial pump suppliers in Rotterdam",
          "Source precision CNC machining suppliers in Germany",
          "Discover certified molded-fiber packaging manufacturers",
        ].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setGoal(preset)}
            className="rounded-full border border-line bg-canvas px-3 py-1 text-xs text-muted hover:border-violet hover:text-ink cursor-pointer transition-colors"
          >
            + {preset}
          </button>
        ))}
      </div>

      <textarea
        id="sourcing-goal"
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        rows={6}
        maxLength={800}
        className="mt-3 w-full resize-y rounded-[14px] border border-line-strong bg-paper dark:bg-paper px-4 py-4 text-base leading-7 outline-none transition-all focus:border-violet focus:ring-2 focus:ring-violet/30"
      />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold" htmlFor="run-budget">
            Service budget
          </label>
          <div className="mt-3 flex min-h-12 items-center rounded-[12px] border border-line-strong bg-paper px-4 focus-within:border-violet focus-within:ring-2 focus-within:ring-violet/30">
            <span className="text-sm text-muted font-mono">$</span>
            <input
              id="run-budget"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?"
              required
              className="min-w-0 flex-1 bg-transparent px-2 font-mono text-sm font-semibold outline-none"
              aria-describedby="budget-help"
            />
            <span className="text-xs font-semibold text-muted font-mono">USDC</span>
          </div>
          <p id="budget-help" className="mt-2 text-xs leading-5 text-muted">
            Maximum paid-service spend; discovery does not charge the wallet.
          </p>
        </div>
        <div>
          <span className="text-sm font-semibold">Metered Adapters</span>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 min-h-12 rounded-[12px] border border-line bg-canvas px-3 py-2 text-xs">
            <span className="rounded-md bg-paper border border-line px-2 py-0.5 font-mono text-ink">Tavily ($0.01)</span>
            <span className="rounded-md bg-paper border border-line px-2 py-0.5 font-mono text-ink">Firecrawl ($0.02)</span>
            <span className="rounded-md bg-paper border border-line px-2 py-0.5 font-mono text-ink">Apollo ($0.03)</span>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <div className="flex items-start gap-3 border-t border-line pt-5 text-sm leading-6 text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          Planning and public supplier discovery run automatically. Paid Arc verification remains policy-controlled, and email always waits for your approval.
        </div>
        {isRunning ? (
          <div
            className="mt-5 border-y border-line bg-canvas px-4 py-4"
            role="status"
            aria-live="polite"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none text-violet" />
              Autonomous discovery is running
            </span>
            <ol className="mt-3 grid gap-2 text-xs leading-5 text-muted sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <Check aria-hidden="true" className="size-3.5 shrink-0 text-success" /> Goal accepted
              </li>
              <li className="flex items-center gap-2">
                <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none text-violet" /> Planning and searching suppliers
              </li>
            </ol>
          </div>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-[12px] bg-danger-wash px-4 py-3 text-sm leading-6 text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!hydrated || !goal.trim() || isRunning}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-violet px-5 font-semibold text-white transition-colors hover:bg-violet-dark disabled:cursor-not-allowed disabled:bg-line-strong"
        >
          {!session ? <WalletCards aria-hidden="true" className="size-4" /> : null}
          {session ? (isRunning ? "Planning and searching suppliers…" : "Start autonomous run") : "Connect wallet to continue"}
          {session && !isRunning ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
        </button>
      </div>
    </form>
  );
}
