"use client";

import { Check, ListChecks, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { SourcingRun } from "@/lib/run";

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

/** Keeps the generated sourcing plan available without competing with live run evidence. */
export function SourcingPlanDrawer({ run }: { run: SourcingRun }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const summaryId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  function close() {
    dialog.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-line-strong px-4 text-sm font-semibold transition-colors hover:border-ink hover:bg-ink hover:text-paper"
      >
        <ListChecks aria-hidden="true" className="size-4" />
        View sourcing plan
      </button>

      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden border-0 bg-transparent p-0 text-ink backdrop:bg-ink/70"
      >
        <aside className="plan-drawer ml-auto flex h-full w-[min(32rem,calc(100vw-1rem))] flex-col bg-paper shadow-ledger-lg">
          <header className="flex items-start justify-between gap-6 border-b border-line px-5 py-5 sm:px-7">
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em]">
                Sourcing plan
              </h2>
              <p className="mt-1 text-xs text-muted">
                {run.research.queriesExecuted} discovery queries via {run.research.provider} — no wallet charge
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close sourcing plan"
              className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-line transition-colors hover:border-ink hover:bg-ink hover:text-paper"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
            <p id={summaryId} className="text-sm leading-6 text-muted">
              {run.plan.summary}
            </p>
            <div className="mt-7">
              <PlanList title="Discovery queries" items={run.plan.searchQueries} />
              <PlanList title="Supplier requirements" items={run.plan.supplierRequirements} />
              <PlanList title="Evidence requirements" items={run.plan.evidenceRequirements} />
              <PlanList title="Outreach questions" items={run.plan.outreachQuestions} />
            </div>
          </div>
        </aside>
      </dialog>
    </>
  );
}
