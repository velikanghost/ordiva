import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { Wallet, type WalletDocument } from "./wallet.schema.js";

export interface CircleArcWallet {
  id: string;
  address: string;
  blockchain: "ARC-TESTNET";
  accountType: "EOA";
  state: string;
}

export interface WalletView extends CircleArcWallet {
  userId: string;
}

function toView(wallet: WalletDocument): WalletView {
  return {
    userId: wallet.userId,
    id: wallet.circleWalletId,
    address: wallet.address,
    blockchain: wallet.blockchain,
    accountType: wallet.accountType,
    state: wallet.state
  };
}

@Injectable()
export class WalletsService {
  constructor(@InjectModel(Wallet.name) private readonly wallets: Model<WalletDocument>) {}

  async syncOneForUser(userId: string, circleWallet: CircleArcWallet): Promise<WalletView> {
    const existing = await this.wallets.findOne({ userId }).exec();
    if (existing && existing.circleWalletId !== circleWallet.id) {
      throw new ConflictException("Ordiva permits only one Arc wallet per user");
    }

    const wallet = await this.wallets.findOneAndUpdate(
      { userId },
      {
        $set: {
          circleWalletId: circleWallet.id,
          address: circleWallet.address.toLowerCase(),
          blockchain: circleWallet.blockchain,
          accountType: circleWallet.accountType,
          state: circleWallet.state
        },
        $setOnInsert: { userId }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    if (!wallet) throw new Error("MongoDB did not return the upserted wallet");
    return toView(wallet);
  }

  async findByUserId(userId: string): Promise<WalletView | null> {
    const wallet = await this.wallets.findOne({ userId }).exec();
    return wallet ? toView(wallet) : null;
  }
}
