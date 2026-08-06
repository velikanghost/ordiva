import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { formatUsdcExact } from "../payments/money.js";
import {
  SourcingRun,
  type RunPurchase,
  type RunStatus,
  type SourcingRunDocument
} from "./run.schema.js";

/** A run as the API presents it: micros rendered as money, nothing raw. */
export interface RunView {
  id: string;
  status: RunStatus;
  goal: string;
  supplierMinimum: number;
  budget: { limit: string; spent: string; remaining: string };
  plan: SourcingRun["plan"];
  suppliers: Array<{
    id: string;
    name: string;
    url: string;
    domain: string;
    description: string;
    sourceQuery: string;
    verified: boolean;
    evidence: string[];
  }>;
  purchases: Array<{
    adapterId: string;
    reason: string;
    price: string;
    outcome: RunPurchase["outcome"];
    supplierId?: string;
    settlement?: string;
    payer?: string;
    network?: string;
    responseHash?: string;
    latencyMs?: number;
    failureReason?: string;
    createdAt: string;
  }>;
  research: SourcingRun["research"];
  createdAt: string;
}

function toView(run: SourcingRunDocument): RunView {
  const budget = BigInt(run.budgetMicros);
  const spent = BigInt(run.spentMicros);

  return {
    id: run._id.toString(),
    status: run.status,
    goal: run.goal,
    supplierMinimum: run.supplierMinimum,
    budget: {
      limit: formatUsdcExact(budget),
      spent: formatUsdcExact(spent),
      remaining: formatUsdcExact(budget > spent ? budget - spent : 0n)
    },
    plan: run.plan,
    suppliers: run.suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      url: supplier.url,
      domain: supplier.domain,
      description: supplier.description,
      sourceQuery: supplier.sourceQuery,
      verified: supplier.verified,
      evidence: supplier.evidence
    })),
    purchases: run.purchases.map((purchase) => ({
      adapterId: purchase.adapterId,
      reason: purchase.reason,
      price: formatUsdcExact(BigInt(purchase.priceMicros)),
      outcome: purchase.outcome,
      supplierId: purchase.supplierId,
      settlement: purchase.settlement,
      payer: purchase.payer,
      network: purchase.network,
      responseHash: purchase.responseHash,
      latencyMs: purchase.latencyMs,
      failureReason: purchase.failureReason,
      createdAt: purchase.createdAt.toISOString()
    })),
    research: run.research,
    createdAt: run.createdAt.toISOString()
  };
}

@Injectable()
export class RunsService {
  constructor(@InjectModel(SourcingRun.name) private readonly runs: Model<SourcingRunDocument>) {}

  async create(run: Omit<SourcingRun, "createdAt" | "updatedAt">): Promise<RunView> {
    return toView(await this.runs.create(run));
  }

  /**
   * Load a run, refusing anyone but its owner.
   *
   * Answers "not found" rather than "forbidden" for a nonexistent id so the API
   * does not confirm the existence of other users' runs.
   *
   * @param runId - Run identifier.
   * @param userId - The authenticated caller.
   */
  async getOwned(runId: string, userId: string): Promise<SourcingRunDocument> {
    const run = await this.runs.findById(runId).exec().catch(() => null);
    if (!run) throw new NotFoundException("Run not found");
    if (run.userId !== userId) throw new ForbiddenException("This run belongs to another account");
    return run;
  }

  async view(runId: string, userId: string): Promise<RunView> {
    return toView(await this.getOwned(runId, userId));
  }

  /**
   * Append a purchase and advance the spend total atomically.
   *
   * Only settled purchases move `spentMicros` — a declined or failed attempt is
   * recorded for the ledger but must never consume budget.
   *
   * @param runId - Run to append to.
   * @param purchase - The attempt to record.
   */
  async recordPurchase(runId: string, purchase: RunPurchase): Promise<void> {
    const spend = purchase.outcome === "settled" ? BigInt(purchase.priceMicros) : 0n;

    // Re-read inside the update so concurrent purchases cannot clobber the total;
    // `$inc` is unavailable because micros are stored as strings.
    const run = await this.runs.findById(runId).exec();
    if (!run) throw new NotFoundException("Run not found");

    run.purchases.push(purchase);
    run.spentMicros = (BigInt(run.spentMicros) + spend).toString();
    await run.save();
  }

  async setStatus(runId: string, status: RunStatus): Promise<void> {
    await this.runs.updateOne({ _id: runId }, { $set: { status } }).exec();
  }

  /**
   * Mark a candidate verified and attach the evidence gathered about it.
   *
   * @param runId - Run the supplier belongs to.
   * @param supplierId - Candidate to update.
   * @param evidence - Human-readable notes drawn from paid responses.
   */
  async markSupplierVerified(runId: string, supplierId: string, evidence: string[]): Promise<void> {
    await this.runs
      .updateOne(
        { _id: runId, "suppliers.id": supplierId },
        { $set: { "suppliers.$.verified": true, "suppliers.$.evidence": evidence } }
      )
      .exec();
  }

  async listForUser(userId: string, limit = 20): Promise<RunView[]> {
    const runs = await this.runs.find({ userId }).sort({ createdAt: -1 }).limit(limit).exec();
    return runs.map(toView);
  }
}
