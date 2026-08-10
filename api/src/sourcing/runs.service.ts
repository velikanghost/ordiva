import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { formatUsdcExact } from "../payments/money.js";
import {
  SourcingRun,
  type RunContractActivity,
  type RunOutreach,
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
    verificationStatus: SourcingRun["suppliers"][number]["verificationStatus"];
    evidence: string[];
    contacts: string[];
  }>;
  outreach: Array<{
    id: string;
    supplierId: string;
    recipient: string;
    subject: string;
    text: string;
    version: number;
    contentHash: string;
    status: RunOutreach["status"];
    approvedAt?: string;
    messageId?: string;
    failureReason?: string;
    testStatus?: RunOutreach["testStatus"];
    testVersion?: number;
    testRecipient?: string;
    testMessageId?: string;
    testFailureReason?: string;
    testSentAt?: string;
  }>;
  purchases: Array<{
    adapterId: string;
    reason: string;
    price: string;
    outcome: RunPurchase["outcome"];
    supplierId?: string;
    settlement?: string;
    transactionHash?: string;
    payer?: string;
    network?: string;
    responseHash?: string;
    latencyMs?: number;
    failureReason?: string;
    createdAt: string;
  }>;
  contractActivities: Array<{
    id: string;
    type: RunContractActivity["type"];
    state: RunContractActivity["state"];
    network: string;
    contractAddress: string;
    circleTransactionId?: string;
    transactionHash?: string;
    failureReason?: string;
    createdAt: string;
    updatedAt: string;
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
      verificationStatus: supplier.verificationStatus ?? (supplier.verified ? "verified" : "unverified"),
      evidence: supplier.evidence ?? [],
      contacts: supplier.contacts ?? []
    })),
    purchases: run.purchases.map((purchase) => ({
      adapterId: purchase.adapterId,
      reason: purchase.reason,
      price: formatUsdcExact(BigInt(purchase.priceMicros)),
      outcome: purchase.outcome,
      supplierId: purchase.supplierId,
      settlement: purchase.settlement,
      transactionHash: purchase.transactionHash,
      payer: purchase.payer,
      network: purchase.network,
      responseHash: purchase.responseHash,
      latencyMs: purchase.latencyMs,
      failureReason: purchase.failureReason,
      createdAt: purchase.createdAt.toISOString()
    })),
    outreach: (run.outreach ?? []).map((item) => ({
      id: item.id,
      supplierId: item.supplierId,
      recipient: item.recipient,
      subject: item.subject,
      text: item.text,
      version: item.version,
      contentHash: item.contentHash,
      status: item.status,
      approvedAt: item.approvedAt?.toISOString(),
      messageId: item.messageId,
      failureReason: item.failureReason,
      testStatus: item.testStatus,
      testVersion: item.testVersion,
      testRecipient: item.testRecipient,
      testMessageId: item.testMessageId,
      testFailureReason: item.testFailureReason,
      testSentAt: item.testSentAt?.toISOString()
    })),
    contractActivities: (run.contractActivities ?? []).map((activity) => ({
      id: activity.id,
      type: activity.type,
      state: activity.state,
      network: activity.network,
      contractAddress: activity.contractAddress,
      circleTransactionId: activity.circleTransactionId,
      transactionHash: activity.transactionHash,
      failureReason: activity.failureReason,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString()
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
    await this.runs.updateOne(
      { _id: runId },
      { $set: { status }, ...(status !== "verifying" ? { $unset: { verificationLeaseUntil: 1 } } : {}) }
    ).exec();
  }

  async addContractActivity(runId: string, activity: RunContractActivity): Promise<void> {
    await this.runs.updateOne(
      { _id: runId, "contractActivities.type": { $ne: activity.type } },
      { $push: { contractActivities: activity } }
    ).exec();
  }

  async updateContractActivity(
    runId: string,
    activityId: string,
    fields: Partial<RunContractActivity>
  ): Promise<void> {
    const updates = Object.fromEntries(
      Object.entries(fields)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [`contractActivities.$.${key}`, value])
    );
    await this.runs.updateOne(
      { _id: runId, "contractActivities.id": activityId },
      { $set: { ...updates, "contractActivities.$.updatedAt": new Date() } }
    ).exec();
  }

  async resumeableContractActivities(): Promise<
    Array<{ runId: string; userId: string; activityId: string }>
  > {
    const runs = await this.runs.find({
      contractActivities: { $elemMatch: { state: { $in: ["pending", "submitted"] } } }
    }).exec();
    return runs.flatMap((run) => (run.contractActivities ?? [])
      .filter((activity) => activity.state === "pending" || activity.state === "submitted")
      .map((activity) => ({
        runId: run._id.toString(),
        userId: run.userId,
        activityId: activity.id
      }))
    );
  }

  async claimVerification(runId: string, userId: string, leaseUntil: Date): Promise<boolean> {
    const now = new Date();
    const result = await this.runs.updateOne(
      {
        _id: runId,
        userId,
        status: { $in: ["research_ready", "partially_verified", "verification_failed", "verifying"] },
        $or: [
          { verificationLeaseUntil: { $exists: false } },
          { verificationLeaseUntil: { $lte: now } }
        ]
      },
      {
        $set: { status: "verifying", verificationLeaseUntil: leaseUntil },
        $inc: { verificationAttempts: 1 }
      }
    ).exec();
    return result.modifiedCount === 1;
  }

  async resumeableVerifications(): Promise<Array<{ id: string; userId: string }>> {
    const runs = await this.runs.find({
      status: "verifying",
      $or: [
        { verificationLeaseUntil: { $exists: false } },
        { verificationLeaseUntil: { $lte: new Date() } }
      ]
    }).select({ _id: 1, userId: 1 }).exec();
    return runs.map((run) => ({ id: run._id.toString(), userId: run.userId }));
  }

  async renewVerificationLease(runId: string, leaseUntil: Date): Promise<void> {
    await this.runs.updateOne(
      { _id: runId, status: "verifying" },
      { $set: { verificationLeaseUntil: leaseUntil } }
    ).exec();
  }

  /**
   * Mark a candidate verified and attach the evidence gathered about it.
   *
   * @param runId - Run the supplier belongs to.
   * @param supplierId - Candidate to update.
   * @param evidence - Human-readable notes drawn from paid responses.
   */
  async setSupplierVerification(
    runId: string,
    supplierId: string,
    result: {
      status: SourcingRun["suppliers"][number]["verificationStatus"];
      evidence: string[];
      contacts: string[];
    }
  ): Promise<void> {
    await this.runs
      .updateOne(
        { _id: runId, "suppliers.id": supplierId },
        {
          $set: {
            "suppliers.$.verified": result.status === "verified",
            "suppliers.$.verificationStatus": result.status,
            "suppliers.$.evidence": result.evidence,
            "suppliers.$.contacts": result.contacts
          }
        }
      )
      .exec();
  }

  async saveOutreachDrafts(runId: string, drafts: RunOutreach[]): Promise<void> {
    await this.runs.updateOne({ _id: runId }, { $set: { outreach: drafts } }).exec();
  }

  async updateOutreach(runId: string, outreachId: string, fields: Partial<RunOutreach>): Promise<void> {
    const updates = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [`outreach.$.${key}`, value])
    );
    await this.runs.updateOne(
      { _id: runId, "outreach.id": outreachId },
      { $set: { ...updates, "outreach.$.updatedAt": new Date() } }
    ).exec();
  }

  async claimOutreach(runId: string, outreachId: string, leaseUntil: Date): Promise<boolean> {
    const result = await this.runs.updateOne(
      {
        _id: runId,
        outreach: {
          $elemMatch: {
            id: outreachId,
            status: { $in: ["queued", "failed", "sending"] },
            $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: new Date() } }]
          }
        }
      },
      {
        $set: {
          "outreach.$.status": "sending",
          "outreach.$.leaseUntil": leaseUntil,
          "outreach.$.updatedAt": new Date()
        },
        $inc: { "outreach.$.attempts": 1 }
      }
    ).exec();
    return result.modifiedCount === 1;
  }

  async resumeableOutreach(): Promise<Array<{ runId: string; userId: string; outreachId: string }>> {
    const now = new Date();
    const runs = await this.runs.find({
      outreach: {
        $elemMatch: {
          status: { $in: ["queued", "sending"] },
          $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }]
        }
      }
    }).exec();
    return runs.flatMap((run) => (run.outreach ?? [])
      .filter((item) =>
        (item.status === "queued" || item.status === "sending") &&
        (!item.leaseUntil || item.leaseUntil <= now)
      )
      .map((item) => ({ runId: run._id.toString(), userId: run.userId, outreachId: item.id }))
    );
  }

  async listForUser(userId: string, limit = 20): Promise<RunView[]> {
    const runs = await this.runs.find({ userId }).sort({ createdAt: -1 }).limit(limit).exec();
    return runs.map(toView);
  }
}
