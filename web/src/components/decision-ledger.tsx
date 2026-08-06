"use client";

import { Ban, Check, TriangleAlert } from "lucide-react";
import type { RunPurchase } from "@/lib/run";

const OUTCOME = {
  settled: { label: "Paid", Icon: Check, tone: "text-success", wash: "bg-success-wash" },
  declined: { label: "Declined", Icon: Ban, tone: "text-muted", wash: "bg-canvas" },
  failed: { label: "Failed", Icon: TriangleAlert, tone: "text-danger", wash: "bg-danger-wash" }
} as const;

/**
 * Every economic decision the agent made, in order.
 *
 * Declines and failures are shown alongside payments on purpose: a ledger that
 * only lists successes is marketing, not evidence.
 */
export function DecisionLedger({ purchases }: { purchases: RunPurchase[] }) {
  if (purchases.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted">
        No purchases yet. Verifying the run lets the agent buy evidence for each candidate.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <caption className="sr-only">
          Every purchase the agent attempted, with its reason, price, and outcome
        </caption>
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="py-2 pr-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Outcome
            </th>
            <th scope="col" className="py-2 pr-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Capability
            </th>
            <th scope="col" className="py-2 pr-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Why the agent bought it
            </th>
            <th scope="col" className="py-2 pr-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Price
            </th>
            <th scope="col" className="py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Proof
            </th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase, index) => {
            const { label, Icon, tone, wash } = OUTCOME[purchase.outcome];
            return (
              <tr key={`${purchase.adapterId}-${index}`} className="border-b border-line align-top">
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full ${wash} px-2.5 py-1 text-[0.68rem] font-semibold ${tone}`}
                  >
                    <Icon aria-hidden="true" className="size-3" />
                    {label}
                  </span>
                </td>
                <td className="py-3 pr-4 font-mono text-xs">{purchase.adapterId}</td>
                <td className="max-w-[26rem] py-3 pr-4 leading-6 text-muted">
                  {purchase.reason}
                  {purchase.failureReason ? (
                    <span className="mt-1 block text-xs text-danger">{purchase.failureReason}</span>
                  ) : null}
                </td>
                <td className="py-3 pr-4 text-right font-mono">{purchase.price}</td>
                <td className="py-3 font-mono text-xs text-muted">
                  {purchase.settlement ? (
                    <span title="Circle Gateway settlement reference">
                      {purchase.settlement.slice(0, 8)}…
                    </span>
                  ) : (
                    <span aria-label="No payment was made">—</span>
                  )}
                  {purchase.latencyMs ? (
                    <span className="ml-2 opacity-70">{purchase.latencyMs}ms</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
