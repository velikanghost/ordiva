"use client";

import { Check, CircleAlert, Mail, ShieldX } from "lucide-react";
import { useState } from "react";
import type { SupplierResult, SupplierOutreachState } from "@/lib/demo-run";

interface SupplierResultsProps {
  suppliers: SupplierResult[];
  selectedId: string;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  outreach: Record<string, SupplierOutreachState>;
  decisionApproved: boolean;
}

function OutreachAction({
  state,
  decisionApproved,
  onApprove,
}: {
  state: SupplierOutreachState;
  decisionApproved: boolean;
  onApprove: () => void;
}) {
  if (state === "blocked") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
        <ShieldX aria-hidden="true" className="size-3.5" /> Not allowlisted
      </span>
    );
  }
  if (state === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
        <Check aria-hidden="true" className="size-3.5" /> Approved for send
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={!decisionApproved}
      onClick={onApprove}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-xs font-semibold transition-colors hover:border-ink hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line disabled:text-muted"
      title={decisionApproved ? "Approve this email" : "Approve the verification decision first"}
    >
      <Mail aria-hidden="true" className="size-3.5" /> Review email
    </button>
  );
}

export function SupplierResults({ suppliers, selectedId, onSelect, onApprove, outreach, decisionApproved }: SupplierResultsProps) {
  const selected = suppliers.find((supplier) => supplier.id === selectedId) ?? suppliers[0];
  const [reviewId, setReviewId] = useState<string | null>(null);
  const reviewSupplier = suppliers.find((supplier) => supplier.id === reviewId) ?? null;

  return (
    <section aria-labelledby="supplier-results-heading" className="border-t border-line bg-paper">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-8">
        <div>
          <h2 id="supplier-results-heading" className="text-xl font-semibold tracking-[-0.025em]">Supplier outcomes</h2>
          <p className="mt-1.5 text-sm text-muted">Three candidates · outreach requires individual approval</p>
        </div>
        {!decisionApproved ? (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
            <CircleAlert aria-hidden="true" className="size-3.5" /> Verification decision pending
          </span>
        ) : null}
      </div>

      <div className="hidden overflow-x-auto border-t border-line md:block">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-canvas text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            <tr>
              <th className="px-8 py-3">Supplier</th>
              <th className="px-5 py-3">Fit</th>
              <th className="px-5 py-3">Evidence</th>
              <th className="px-5 py-3">Sources</th>
              <th className="px-8 py-3 text-right">Outreach</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="border-t border-line align-middle">
                <td className="px-8 py-5">
                  <span className="font-semibold">{supplier.name}</span>
                  <span className="mt-1 block text-xs text-muted">{supplier.location}</span>
                </td>
                <td className="px-5 py-5"><span className={supplier.fit === "Strong" ? "text-success" : "text-muted"}>{supplier.fit}</span></td>
                <td className="max-w-[34rem] px-5 py-5 leading-6 text-muted">{supplier.evidence}</td>
                <td className="px-5 py-5 tabular-nums">{supplier.sources}</td>
                <td className="px-8 py-5 text-right">
                  <OutreachAction state={outreach[supplier.id]} decisionApproved={decisionApproved} onApprove={() => setReviewId(supplier.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-line md:hidden">
        <div className="flex gap-2 overflow-x-auto px-5 py-4" role="tablist" aria-label="Supplier results">
          {suppliers.map((supplier) => (
            <button
              key={supplier.id}
              type="button"
              role="tab"
              aria-selected={selected.id === supplier.id}
              aria-controls={`supplier-panel-${supplier.id}`}
              id={`supplier-tab-${supplier.id}`}
              tabIndex={selected.id === supplier.id ? 0 : -1}
              onClick={() => onSelect(supplier.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const currentIndex = suppliers.findIndex((item) => item.id === supplier.id);
                const offset = event.key === "ArrowRight" ? 1 : -1;
                const next = suppliers[(currentIndex + offset + suppliers.length) % suppliers.length];
                onSelect(next.id);
                document.getElementById(`supplier-tab-${next.id}`)?.focus();
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${selected.id === supplier.id ? "border-violet bg-violet text-white" : "border-line-strong bg-paper"}`}
            >
              {supplier.name}
            </button>
          ))}
        </div>
        <div
          id={`supplier-panel-${selected.id}`}
          aria-labelledby={`supplier-tab-${selected.id}`}
          role="tabpanel"
          className="border-t border-line px-5 py-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">{selected.name}</h3>
              <p className="mt-1 text-sm text-muted">{selected.location} · {selected.fit} fit</p>
            </div>
            <span className="text-xs font-semibold text-muted">{selected.sources} sources</span>
          </div>
          <p className="mt-5 text-sm leading-6 text-muted">{selected.evidence}</p>
          <div className="mt-6">
            <OutreachAction state={outreach[selected.id]} decisionApproved={decisionApproved} onApprove={() => setReviewId(selected.id)} />
          </div>
        </div>
      </div>

      {reviewSupplier && outreach[reviewSupplier.id] === "ready" ? (
        <section aria-labelledby="email-review-heading" className="grid gap-6 border-t border-line bg-violet-wash px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <h3 id="email-review-heading" className="text-lg font-semibold tracking-[-0.02em]">Review outreach to {reviewSupplier.name}</h3>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[6rem_1fr]">
              <dt className="text-muted">Recipient</dt><dd className="font-semibold">{reviewSupplier.contact}</dd>
              <dt className="text-muted">Subject</dt><dd className="font-semibold">Pilot inquiry: molded-fiber packaging</dd>
              <dt className="text-muted">Draft</dt><dd className="max-w-[68ch] leading-6 text-muted">We are evaluating suppliers for a 5,000-unit molded-fiber packaging pilot. Could you confirm certification status, tooling lead time, and pilot pricing?</dd>
            </dl>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => {
                onApprove(reviewSupplier.id);
                setReviewId(null);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-violet px-5 text-sm font-semibold text-white hover:bg-violet-dark"
            >
              <Check aria-hidden="true" className="size-4" /> Approve final email
            </button>
            <button type="button" onClick={() => setReviewId(null)} className="min-h-10 px-4 text-sm font-semibold text-muted hover:text-ink">Cancel review</button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
