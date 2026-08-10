"use client";

import { Check, CircleDashed, ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import type { RunContractActivity } from "@/lib/run";

const ARC_TESTNET_NETWORK = "eip155:5042002";
const ARC_TESTNET_EXPLORER = "https://testnet.arcscan.app";

const ACTIVITY_LABEL: Record<RunContractActivity["type"], string> = {
  run_registered: "Run registered",
  ledger_anchored: "Purchase ledger anchored",
  run_closed: "Run closed",
};

const STATE = {
  pending: { label: "Pending", Icon: CircleDashed, tone: "text-muted", wash: "bg-canvas" },
  submitted: { label: "Confirming", Icon: LoaderCircle, tone: "text-violet-dark", wash: "bg-violet-wash" },
  confirmed: { label: "Confirmed", Icon: Check, tone: "text-success", wash: "bg-success-wash" },
  failed: { label: "Failed", Icon: TriangleAlert, tone: "text-danger", wash: "bg-danger-wash" },
} as const;

/** Onchain writes are separate from Gateway purchases because only these have per-action tx hashes. */
export function ContractActivityLedger({ activities }: { activities: RunContractActivity[] }) {
  if (activities.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted">
        No registry activity. Contract anchoring is available when an OrdivaRegistry address is configured.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-line border-y border-line">
      {activities.map((activity) => {
        const { label, Icon, tone, wash } = STATE[activity.state];
        const transactionUrl = arcTransactionUrl(activity);
        return (
          <li key={activity.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold">{ACTIVITY_LABEL[activity.type]}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full ${wash} px-2.5 py-1 text-[0.68rem] font-semibold ${tone}`}>
                <Icon
                  aria-hidden="true"
                  className={`size-3 ${activity.state === "submitted" ? "animate-spin motion-reduce:animate-none" : ""}`}
                />
                {label}
              </span>
            </div>

            {transactionUrl ? (
              <a
                href={transactionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 font-mono text-xs font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:text-violet"
                aria-label={`View ${ACTIVITY_LABEL[activity.type]} transaction on Arcscan (opens in a new tab)`}
              >
                {shortHash(activity.transactionHash!)}
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            ) : activity.circleTransactionId ? (
              <p className="mt-2 truncate font-mono text-xs text-muted" title={activity.circleTransactionId}>
                Circle tx {shortIdentifier(activity.circleTransactionId)}
              </p>
            ) : null}

            {activity.failureReason ? (
              <p className="mt-2 break-words text-xs leading-5 text-danger">{activity.failureReason}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function arcTransactionUrl(activity: RunContractActivity): string | null {
  if (activity.network !== ARC_TESTNET_NETWORK || !isEvmTransactionHash(activity.transactionHash)) {
    return null;
  }
  return `${ARC_TESTNET_EXPLORER}/tx/${activity.transactionHash}`;
}

function isEvmTransactionHash(value: string | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

function shortHash(value: string): string {
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

function shortIdentifier(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}
