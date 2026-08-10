"use client";

import { Ban, Check, ExternalLink, TriangleAlert } from "lucide-react";
import type { RunPurchase } from "@/lib/run";

const ARC_TESTNET_NETWORK = "eip155:5042002";
const ARC_TESTNET_EXPLORER = "https://testnet.arcscan.app";

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
        No purchases yet. Automatic evidence checks will appear here as the agent evaluates candidates.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
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
              Gateway ref
            </th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((purchase, index) => {
            const { label, Icon, tone, wash } = OUTCOME[purchase.outcome];
            const transactionUrl = arcTransactionUrl(purchase);
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
                  {purchase.settlement || transactionUrl ? (
                    <div className="flex flex-col items-start gap-1.5">
                      {purchase.settlement ? (
                        <span
                          className="max-w-44 truncate"
                          title={`Circle Gateway payment reference: ${purchase.settlement}`}
                        >
                          {shortIdentifier(purchase.settlement)}
                        </span>
                      ) : null}
                      {transactionUrl ? (
                        <a
                          href={transactionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-sans font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:text-violet focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                          aria-label={`View transaction ${purchase.transactionHash} on Arcscan (opens in a new tab)`}
                        >
                          View on Arc
                          <ExternalLink aria-hidden="true" className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <span aria-label="No payment was made">—</span>
                  )}
                  {purchase.latencyMs ? (
                    <span className="mt-1.5 block opacity-70">{purchase.latencyMs}ms</span>
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

/** Build an explorer URL only for a full transaction hash on Arc Testnet. */
function arcTransactionUrl(purchase: RunPurchase): string | null {
  if (purchase.network !== ARC_TESTNET_NETWORK || !isEvmTransactionHash(purchase.transactionHash)) {
    return null;
  }

  return `${ARC_TESTNET_EXPLORER}/tx/${purchase.transactionHash}`;
}

function isEvmTransactionHash(value: string | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function shortIdentifier(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}
