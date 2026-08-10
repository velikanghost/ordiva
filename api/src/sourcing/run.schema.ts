import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export type RunStatus =
  | "research_ready"
  | "verifying"
  | "verified"
  | "partially_verified"
  | "verification_failed"
  | "budget_exhausted";
export type SupplierVerificationStatus =
  | "unverified"
  | "verifying"
  | "verified"
  | "insufficient_evidence"
  | "failed";
export type OutreachStatus = "draft" | "approved" | "queued" | "sending" | "sent" | "failed";
export type OutreachTestStatus = "sending" | "sent" | "failed";
export type ContractActivityType = "run_registered" | "ledger_anchored" | "run_closed";
export type ContractActivityState = "pending" | "submitted" | "confirmed" | "failed";

/** What became of one attempted purchase. */
export type PurchaseOutcomeStatus = "settled" | "declined" | "failed";

/**
 * One economic decision, recorded whether or not money moved.
 *
 * Declined attempts are kept deliberately: "what the agent chose not to buy, and
 * why" is as much a part of the product as what it did buy.
 */
@Schema({ _id: false })
export class RunPurchase {
  @Prop({ type: String, required: true })
  adapterId!: string;

  /** The agent's justification, captured before the outcome was known. */
  @Prop({ type: String, required: true })
  reason!: string;

  /** Quoted price in integer micros, stored as a string — Mongo has no uint64. */
  @Prop({ type: String, required: true })
  priceMicros!: string;

  @Prop({ type: String, required: true, enum: ["settled", "declined", "failed"] })
  outcome!: PurchaseOutcomeStatus;

  /** Which candidate this purchase gathered evidence about, when applicable. */
  @Prop({ type: String, required: false })
  supplierId?: string;

  @Prop({ type: String, required: false })
  settlement?: string;

  /** A genuine EVM transaction hash; never a Circle Gateway transfer UUID. */
  @Prop({ type: String, required: false })
  transactionHash?: string;

  @Prop({ type: String, required: false })
  payer?: string;

  @Prop({ type: String, required: false })
  network?: string;

  /** SHA-256 of the adapter response, so the evidence can be shown to be unaltered. */
  @Prop({ type: String, required: false })
  responseHash?: string;

  @Prop({ type: Number, required: false })
  latencyMs?: number;

  /** Why a purchase was refused or failed. Never set on a settled purchase. */
  @Prop({ type: String, required: false })
  failureReason?: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date;
}

export const RunPurchaseSchema = SchemaFactory.createForClass(RunPurchase);

@Schema({ _id: false })
export class RunSupplier {
  @Prop({ type: String, required: true })
  id!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  url!: string;

  @Prop({ type: String, required: true })
  domain!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: String, required: true })
  sourceQuery!: string;

  /** Stays false until paid evidence has actually been gathered and checked. */
  @Prop({ type: Boolean, required: true, default: false })
  verified!: boolean;

  @Prop({
    type: String,
    required: true,
    enum: ["unverified", "verifying", "verified", "insufficient_evidence", "failed"],
    default: "unverified"
  })
  verificationStatus!: SupplierVerificationStatus;

  /** Human-readable evidence notes, populated by the verification stage. */
  @Prop({ type: [String], required: true, default: [] })
  evidence!: string[];

  @Prop({ type: [String], required: true, default: [] })
  contacts!: string[];
}

export const RunSupplierSchema = SchemaFactory.createForClass(RunSupplier);

@Schema({ _id: false })
export class RunOutreach {
  @Prop({ type: String, required: true })
  id!: string;

  @Prop({ type: String, required: true })
  supplierId!: string;

  @Prop({ type: String, required: true })
  recipient!: string;

  @Prop({ type: String, required: true })
  subject!: string;

  @Prop({ type: String, required: true })
  text!: string;

  @Prop({ type: Number, required: true, default: 1 })
  version!: number;

  @Prop({ type: String, required: true })
  contentHash!: string;

  @Prop({ type: String, required: true, enum: ["draft", "approved", "queued", "sending", "sent", "failed"] })
  status!: OutreachStatus;

  @Prop({ type: String, required: false })
  approvedHash?: string;

  @Prop({ type: Date, required: false })
  approvedAt?: Date;

  @Prop({ type: String, required: false })
  messageId?: string;

  @Prop({ type: String, required: false })
  failureReason?: string;

  @Prop({ type: String, required: false, enum: ["sending", "sent", "failed"] })
  testStatus?: OutreachTestStatus;

  @Prop({ type: Number, required: false })
  testVersion?: number;

  @Prop({ type: String, required: false })
  testRecipient?: string;

  @Prop({ type: String, required: false })
  testMessageId?: string;

  @Prop({ type: String, required: false })
  testFailureReason?: string;

  @Prop({ type: Date, required: false })
  testSentAt?: Date;

  @Prop({ type: Date, required: false })
  leaseUntil?: Date;

  @Prop({ type: Number, required: true, default: 0 })
  attempts!: number;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Date, required: true, default: () => new Date() })
  updatedAt!: Date;
}

export const RunOutreachSchema = SchemaFactory.createForClass(RunOutreach);

/** One state-changing call made against OrdivaRegistry on Arc. */
@Schema({ _id: false })
export class RunContractActivity {
  @Prop({ type: String, required: true })
  id!: string;

  @Prop({ type: String, required: true, enum: ["run_registered", "ledger_anchored", "run_closed"] })
  type!: ContractActivityType;

  @Prop({ type: String, required: true, enum: ["pending", "submitted", "confirmed", "failed"] })
  state!: ContractActivityState;

  @Prop({ type: String, required: true })
  network!: "eip155:5042002";

  @Prop({ type: String, required: true })
  contractAddress!: string;

  /** UUIDv4 reused with Circle so retries cannot create duplicate writes. */
  @Prop({ type: String, required: true })
  idempotencyKey!: string;

  @Prop({ type: String, required: false })
  circleTransactionId?: string;

  @Prop({ type: String, required: false })
  transactionHash?: string;

  @Prop({ type: String, required: false })
  failureReason?: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date;

  @Prop({ type: Date, required: true, default: () => new Date() })
  updatedAt!: Date;
}

export const RunContractActivitySchema = SchemaFactory.createForClass(RunContractActivity);

/**
 * A sourcing run and its complete spend history.
 *
 * Previously held in browser `sessionStorage`, which cannot carry receipts: a
 * payment record that disappears on refresh proves nothing.
 */
@Schema({ collection: "sourcingruns", timestamps: true })
export class SourcingRun {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true })
  goal!: string;

  @Prop({ type: Number, required: true })
  supplierMinimum!: number;

  /** Authorised spend for this run, in integer micros, as a string. */
  @Prop({ type: String, required: true })
  budgetMicros!: string;

  /** Committed so far, in integer micros, as a string. */
  @Prop({ type: String, required: true, default: "0" })
  spentMicros!: string;

  @Prop({
    type: String,
    required: true,
    enum: [
      "research_ready",
      "verifying",
      "verified",
      "partially_verified",
      "verification_failed",
      "budget_exhausted"
    ]
  })
  status!: RunStatus;

  @Prop({ type: Object, required: true })
  plan!: {
    summary: string;
    searchQueries: string[];
    supplierRequirements: string[];
    evidenceRequirements: string[];
    outreachQuestions: string[];
  };

  @Prop({ type: [RunSupplierSchema], required: true, default: [] })
  suppliers!: RunSupplier[];

  @Prop({ type: [RunPurchaseSchema], required: true, default: [] })
  purchases!: RunPurchase[];

  @Prop({ type: [RunOutreachSchema], required: true, default: [] })
  outreach!: RunOutreach[];

  @Prop({ type: [RunContractActivitySchema], required: true, default: [] })
  contractActivities!: RunContractActivity[];

  /** Persistent lease for restart-safe background verification work. */
  @Prop({ type: Date, required: false })
  verificationLeaseUntil?: Date;

  @Prop({ type: Number, required: true, default: 0 })
  verificationAttempts!: number;

  @Prop({ type: Object, required: true })
  research!: {
    provider: string;
    queriesExecuted: number;
    creditsUsed: number | null;
  };

  createdAt!: Date;
  updatedAt!: Date;
}

export type SourcingRunDocument = HydratedDocument<SourcingRun>;
export const SourcingRunSchema = SchemaFactory.createForClass(SourcingRun);
