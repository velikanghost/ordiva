import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/**
 * The Ordiva-operated wallet that signs an owner's agent payments.
 *
 * Distinct from `Wallet`, which records the user's own Circle user-controlled
 * wallet. That one is identity and funding; this one is spend authority. Both are
 * one-per-user, and they must never be conflated — the user holds the keys to the
 * first, Ordiva operates the second.
 */
@Schema({ collection: "agentwallets", timestamps: true })
export class AgentWallet {
  @Prop({ type: String, required: true, unique: true, index: true })
  userId!: string;

  /** Circle developer-controlled wallet id, used for signing requests. */
  @Prop({ type: String, required: true, unique: true, index: true })
  circleWalletId!: string;

  @Prop({ type: String, required: true, lowercase: true, unique: true, index: true })
  address!: string;

  @Prop({ type: String, required: true, enum: ["ARC-TESTNET"] })
  blockchain!: "ARC-TESTNET";

  /**
   * Always `EOA`. EIP-3009 authorisations are verified with `ecrecover`, which a
   * smart-contract account cannot satisfy.
   */
  @Prop({ type: String, required: true, enum: ["EOA"] })
  accountType!: "EOA";

  @Prop({ type: String, required: true })
  state!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AgentWalletDocument = HydratedDocument<AgentWallet>;
export const AgentWalletSchema = SchemaFactory.createForClass(AgentWallet);
