"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { apiJson, ApiError } from "@/lib/api";
import { savePlannedRun, type PlannedSourcingRun } from "@/lib/run";
import { useSessionStore } from "@/lib/session-store";

export function GoalComposer({ initialGoal, initialBudget }: { initialGoal?: string; initialBudget?: string }) {
  const router = useRouter();
  const { hydrated, session, hydrate, signOut } = useSessionStore();
  const [goal, setGoal] = useState(
    initialGoal?.trim() ||
      "Find at least three ISO-certified molded-fiber packaging suppliers that can handle a 5,000-unit pilot.",
  );
  const [budget, setBudget] = useState(initialBudget || "0.25");
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!goal.trim() || isPreparing) return;
        const query = new URLSearchParams({ goal: goal.trim(), budget });
        if (!session) {
          router.push(`/sign-in?returnTo=${encodeURIComponent(`/?${query.toString()}`)}`);
          return;
        }

        setError(null);
        setIsPreparing(true);
        try {
          const run = await apiJson<PlannedSourcingRun>("/v1/runs/plan", {
            method: "POST",
            headers: { authorization: `Bearer ${session.token}` },
            body: JSON.stringify({ goal: goal.trim(), budget, supplierMinimum: 3 }),
          });
          savePlannedRun(run);
          router.push(`/runs/${run.id}`);
        } catch (caught) {
          if (caught instanceof ApiError && caught.status === 401) {
            signOut();
            router.push(`/sign-in?returnTo=${encodeURIComponent(`/?${query.toString()}`)}`);
            return;
          }
          setError(caught instanceof Error ? caught.message : "The sourcing plan could not be prepared. Please try again.");
        } finally {
          setIsPreparing(false);
        }
      }}
    >
      <h2 className="text-2xl font-semibold tracking-[-0.025em]">Start a sourcing run</h2>
      <label className="mt-8 text-sm font-semibold" htmlFor="sourcing-goal">
        Sourcing goal
      </label>
      <textarea
        id="sourcing-goal"
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        rows={7}
        maxLength={800}
        className="mt-3 w-full resize-y rounded-[14px] border border-line-strong bg-white px-4 py-4 text-base leading-7 outline-none transition-shadow focus:border-violet focus:ring-4 focus:ring-violet-wash"
      />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold" htmlFor="run-budget">
            Service budget
          </label>
          <div className="mt-3 flex min-h-12 items-center rounded-[12px] border border-line-strong bg-white px-4 focus-within:border-violet focus-within:ring-4 focus-within:ring-violet-wash">
            <span className="text-sm text-muted">$</span>
            <input
              id="run-budget"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?"
              required
              className="min-w-0 flex-1 bg-transparent px-2 outline-none"
              aria-describedby="budget-help"
            />
            <span className="text-xs font-semibold text-muted">USDC</span>
          </div>
        </div>
        <div>
          <span className="text-sm font-semibold">Supplier minimum</span>
          <div className="mt-3 flex min-h-12 items-center rounded-[12px] border border-line bg-canvas px-4 text-sm">
            At least 3 verified results
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <div className="flex items-start gap-3 border-t border-line pt-5 text-sm leading-6 text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          Deterministic policy checks authorize every paid service. Email always waits for your final approval.
        </div>
        {error ? (
          <p className="mt-4 rounded-[12px] bg-danger-wash px-4 py-3 text-sm leading-6 text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={!hydrated || !goal.trim() || isPreparing}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-violet px-5 font-semibold text-white transition-colors hover:bg-violet-dark disabled:cursor-not-allowed disabled:bg-line-strong"
        >
          {!session ? <WalletCards aria-hidden="true" className="size-4" /> : null}
          {session ? (isPreparing ? "Preparing plan…" : "Prepare run") : "Connect wallet to continue"}
          {session && !isPreparing ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
        </button>
      </div>
    </form>
  );
}
