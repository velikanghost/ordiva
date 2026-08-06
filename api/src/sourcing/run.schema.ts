import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

export type RunStatus = "research_ready" | "verifying" | "verified" | "budget_exhausted";

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

  /** Human-readable evidence notes, populated by the verification stage. */
  @Prop({ type: [String], required: true, default: [] })
  evidence!: string[];
}

export const RunSupplierSchema = SchemaFactory.createForClass(RunSupplier);

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
    enum: ["research_ready", "verifying", "verified", "budget_exhausted"]
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
