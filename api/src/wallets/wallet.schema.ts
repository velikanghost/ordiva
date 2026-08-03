import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

@Schema({ collection: "wallets", timestamps: true })
export class Wallet {
  @Prop({ type: String, required: true, unique: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  circleWalletId!: string;

  @Prop({ type: String, required: true, lowercase: true, unique: true, index: true })
  address!: string;

  @Prop({ type: String, required: true, enum: ["ARC-TESTNET"] })
  blockchain!: "ARC-TESTNET";

  @Prop({ type: String, required: true, enum: ["EOA"] })
  accountType!: "EOA";

  @Prop({ type: String, required: true })
  state!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type WalletDocument = HydratedDocument<Wallet>;
export const WalletSchema = SchemaFactory.createForClass(Wallet);
