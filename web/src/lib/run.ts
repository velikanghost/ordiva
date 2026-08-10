import { apiAuthJson } from "@/lib/api";

export type RunStatus =
  | "research_ready"
  | "verifying"
  | "verified"
  | "partially_verified"
  | "verification_failed"
  | "budget_exhausted";
export type PurchaseOutcome = "settled" | "declined" | "failed";

/** One economic decision, recorded whether or not money moved. */
export interface RunPurchase {
  adapterId: string;
  reason: string;
  price: string;
  outcome: PurchaseOutcome;
  supplierId?: string;
  /** Circle Gateway transfer UUID for batched nanopayments. */
  settlement?: string;
  /** Genuine EVM transaction hash for an onchain Arc transaction. */
  transactionHash?: string;
  payer?: string;
  network?: string;
  responseHash?: string;
  latencyMs?: number;
  failureReason?: string;
  createdAt: string;
}

export interface RunSupplier {
  id: string;
  name: string;
  url: string;
  domain: string;
  description: string;
  sourceQuery: string;
  verified: boolean;
  verificationStatus: "unverified" | "verifying" | "verified" | "insufficient_evidence" | "failed";
  evidence: string[];
  contacts: string[];
}

export interface RunOutreach {
  id: string;
  supplierId: string;
  recipient: string;
  subject: string;
  text: string;
  version: number;
  contentHash: string;
  status: "draft" | "approved" | "queued" | "sending" | "sent" | "failed";
  approvedAt?: string;
  messageId?: string;
  failureReason?: string;
  testStatus?: "sending" | "sent" | "failed";
  testVersion?: number;
  testRecipient?: string;
  testMessageId?: string;
  testFailureReason?: string;
  testSentAt?: string;
}

export interface RunContractActivity {
  id: string;
  type: "run_registered" | "ledger_anchored" | "run_closed";
  state: "pending" | "submitted" | "confirmed" | "failed";
  network: string;
  contractAddress: string;
  circleTransactionId?: string;
  transactionHash?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A run as the API serves it.
 *
 * Previously mirrored in `sessionStorage`, which could not carry receipts — a
 * payment record that vanishes on refresh proves nothing. The server is now the
 * only source of truth for a run.
 */
export interface SourcingRun {
  id: string;
  status: RunStatus;
  goal: string;
  supplierMinimum: number;
  budget: { limit: string; spent: string; remaining: string };
  plan: {
    summary: string;
    searchQueries: string[];
    supplierRequirements: string[];
    evidenceRequirements: string[];
    outreachQuestions: string[];
  };
  suppliers: RunSupplier[];
  purchases: RunPurchase[];
  outreach: RunOutreach[];
  contractActivities: RunContractActivity[];
  research: { provider: string; queriesExecuted: number; creditsUsed: number | null };
  createdAt: string;
}

export function fetchRun(runId: string, token: string): Promise<SourcingRun> {
  return apiAuthJson<SourcingRun>(`/v1/runs/${runId}`, token);
}

export function fetchRuns(token: string): Promise<SourcingRun[]> {
  return apiAuthJson<SourcingRun[]>("/v1/runs", token);
}

export function createOutreachDrafts(runId: string, token: string): Promise<SourcingRun> {
  return apiAuthJson<SourcingRun>(`/v1/runs/${runId}/outreach/drafts`, token, { method: "POST" });
}

export function updateOutreachDraft(
  runId: string,
  outreachId: string,
  token: string,
  input: { recipient: string; subject: string; text: string },
): Promise<SourcingRun> {
  return apiAuthJson<SourcingRun>(`/v1/runs/${runId}/outreach/${outreachId}`, token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function approveOutreach(runId: string, outreachId: string, token: string, contentHash: string): Promise<SourcingRun> {
  return apiAuthJson<SourcingRun>(`/v1/runs/${runId}/outreach/${outreachId}/approve`, token, {
    method: "POST",
    body: JSON.stringify({ contentHash }),
  });
}

export function sendOutreach(runId: string, outreachId: string, token: string): Promise<SourcingRun> {
  return apiAuthJson<SourcingRun>(`/v1/runs/${runId}/outreach/${outreachId}/send`, token, { method: "POST" });
}

export function sendTestOutreach(runId: string, outreachId: string, token: string): Promise<SourcingRun> {
  return apiAuthJson<SourcingRun>(`/v1/runs/${runId}/outreach/${outreachId}/send-test`, token, { method: "POST" });
}

/**
 * Parse a `$1.234567` string into a number, for meter proportions only.
 *
 * Display always uses the server's own string so no rounding is introduced.
 *
 * @param usd - Amount as served by the API.
 */
export function usdToNumber(usd: string): number {
  const parsed = Number(usd.replace("$", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
