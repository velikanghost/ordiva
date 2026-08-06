import { apiAuthJson } from "@/lib/api";

export type RunStatus = "research_ready" | "verifying" | "verified" | "budget_exhausted";
export type PurchaseOutcome = "settled" | "declined" | "failed";

/** One economic decision, recorded whether or not money moved. */
export interface RunPurchase {
  adapterId: string;
  reason: string;
  price: string;
  outcome: PurchaseOutcome;
  supplierId?: string;
  settlement?: string;
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
  evidence: string[];
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
  research: { provider: string; queriesExecuted: number; creditsUsed: number | null };
  createdAt: string;
}

export function fetchRun(runId: string, token: string): Promise<SourcingRun> {
  return apiAuthJson<SourcingRun>(`/v1/runs/${runId}`, token);
}

/**
 * Buy evidence for every candidate in the run.
 *
 * Long-running: each candidate costs several paid Arc calls, and the promise
 * resolves only once the agent has finished spending.
 */
export function verifyRun(runId: string, token: string): Promise<SourcingRun> {
  return apiAuthJson<SourcingRun>(`/v1/runs/${runId}/verify`, token, { method: "POST" });
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
