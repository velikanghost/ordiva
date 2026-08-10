import type { Metadata } from "next";
import { AgentWalletPanel } from "@/components/agent-wallet-panel";
import { GoalComposer } from "@/components/goal-composer";
import { RunHistory } from "@/components/run-history";
import { WorkspaceShell } from "@/components/workspace-shell";

export const metadata: Metadata = { title: "Start a sourcing run" };

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string; budget?: string }>;
}) {
  const query = await searchParams;
  return (
    <WorkspaceShell section="Workspace">
      <section className="border-b border-line px-5 py-7 sm:px-8 lg:px-10">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Sourcing workspace</h1>
        <p className="mt-2 max-w-[68ch] text-sm leading-6 text-muted">
          Define the outcome, set the service budget, and let the agent build the evidence trail.
        </p>
      </section>
      <div className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(23rem,0.8fr)]">
        <section className="px-5 py-8 sm:px-8 lg:px-10 xl:border-r xl:border-line">
          <GoalComposer initialGoal={query.goal} initialBudget={query.budget} />
        </section>
        <aside className="border-t border-line bg-canvas/55 px-5 py-8 sm:px-8 lg:px-10 xl:border-t-0">
          <AgentWalletPanel />
        </aside>
      </div>
      <RunHistory />
    </WorkspaceShell>
  );
}
