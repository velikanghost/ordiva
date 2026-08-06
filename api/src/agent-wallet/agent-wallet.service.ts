import { Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { Address } from "viem";
import { CircleDcwSigner } from "../payments/circle-dcw.signer.js";
import type { ArcPaymentSigner } from "../payments/arc-signer.js";
import { AgentWallet, type AgentWalletDocument } from "./agent-wallet.schema.js";
import { CircleDcwClient } from "./circle-dcw.client.js";

export interface AgentWalletView {
  readonly userId: string;
  readonly id: string;
  readonly address: string;
  readonly blockchain: "ARC-TESTNET";
  readonly accountType: "EOA";
  readonly state: string;
}

function toView(wallet: AgentWalletDocument): AgentWalletView {
  return {
    userId: wallet.userId,
    id: wallet.circleWalletId,
    address: wallet.address,
    blockchain: wallet.blockchain,
    accountType: wallet.accountType,
    state: wallet.state
  };
}

/**
 * Provisions and resolves the one agent wallet each user's runs spend from.
 *
 * Mirrors the one-wallet-per-user guarantee in `WalletsService`, on a separate
 * collection: a user has exactly one identity wallet and exactly one agent wallet,
 * and neither can silently become two.
 */
@Injectable()
export class AgentWalletService {
  constructor(
    @InjectModel(AgentWallet.name) private readonly wallets: Model<AgentWalletDocument>,
    @Inject(CircleDcwClient) private readonly circle: CircleDcwClient
  ) {}

  /**
   * Return the user's agent wallet, creating it on first use.
   *
   * Reads before writing so a repeated call never mints a second Circle wallet —
   * an orphaned funded wallet is not recoverable through the product.
   *
   * @param userId - Ordiva user id.
   */
  async ensureForUser(userId: string): Promise<AgentWalletView> {
    const existing = await this.wallets.findOne({ userId }).exec();
    if (existing) return toView(existing);

    const provisioned = await this.circle.createArcEoa(userId);

    const wallet = await this.wallets
      .findOneAndUpdate(
        { userId },
        {
          $setOnInsert: {
            userId,
            circleWalletId: provisioned.id,
            address: provisioned.address.toLowerCase(),
            blockchain: "ARC-TESTNET",
            accountType: "EOA",
            state: provisioned.state
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
      .exec();

    if (!wallet) throw new Error("MongoDB did not return the upserted agent wallet");
    return toView(wallet);
  }

  /**
   * Find a user's agent wallet without creating one.
   *
   * @param userId - Ordiva user id.
   */
  async findByUserId(userId: string): Promise<AgentWalletView | null> {
    const wallet = await this.wallets.findOne({ userId }).exec();
    return wallet ? toView(wallet) : null;
  }

  /**
   * Build the signer that authorises payments from a user's agent wallet.
   *
   * @param wallet - The agent wallet to sign with.
   */
  signerFor(wallet: AgentWalletView): ArcPaymentSigner {
    return new CircleDcwSigner(wallet.address as Address, wallet.id, this.circle);
  }
}
