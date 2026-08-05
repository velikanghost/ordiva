import type { Metadata } from "next";
import Link from "next/link";
import { CircleDot } from "lucide-react";
import { GoalComposer } from "@/components/goal-composer";
import { SessionControls } from "@/components/session-controls";

export const metadata: Metadata = { title: "Start a sourcing run" };

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string; budget?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="min-h-screen bg-canvas px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[16px] border border-line bg-paper shadow-ledger-lg">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-5 sm:px-8">
          <Link href="/" className="text-[1.15rem] font-semibold tracking-[-0.03em] flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-violet text-white font-mono text-sm font-bold shadow-ledger-sm">O</span>
            Ordiva
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-muted sm:flex">
              <CircleDot aria-hidden="true" className="size-4 text-success" /> Arc Testnet
            </span>
            <SessionControls />
          </div>
        </header>

        <section className="grid min-h-[34rem] border-b border-line lg:grid-cols-[1.12fr_0.88fr]">
          <div className="flex flex-col justify-between gap-16 px-5 py-12 sm:px-8 lg:border-r lg:border-line lg:px-12 lg:py-16">
            <div className="max-w-3xl proof-enter">
              <h1 className="text-balance max-w-[15ch] text-[clamp(2.6rem,6vw,5.6rem)] font-semibold leading-[0.94] tracking-[-0.04em]">
                Give the agent a sourcing outcome.
              </h1>
              <p className="mt-7 max-w-[62ch] text-base leading-7 text-muted sm:text-lg">
                Start with autonomous planning and public supplier discovery. Paid evidence
                on Arc stays policy-controlled, and no outreach leaves without your approval.
              </p>
            </div>
          </div>
          <div className="border-t border-line p-5 sm:p-8 lg:border-t-0 lg:p-12">
            <GoalComposer initialGoal={query.goal} initialBudget={query.budget} />
          </div>
        </section>

        <section className="grid gap-8 px-5 py-8 sm:px-8 lg:grid-cols-3 lg:px-12 lg:py-10">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em]">Plan the work</h2>
            <p className="mt-2 max-w-[42ch] text-sm leading-6 text-muted">The sourcing goal becomes focused discovery queries and evidence requirements.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em]">Control every purchase</h2>
            <p className="mt-2 max-w-[42ch] text-sm leading-6 text-muted">Arc service requests remain subject to budget and allowlist checks.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em]">Approve outreach</h2>
            <p className="mt-2 max-w-[42ch] text-sm leading-6 text-muted">Recipient, subject, and draft stay visible before an email can be sent.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
