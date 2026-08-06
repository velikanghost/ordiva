import { Inject, Injectable } from "@nestjs/common";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { AgentWalletConfig } from "../config.js";
import { AGENT_WALLET_CONFIG } from "./agent-wallet.tokens.js";
import type { CircleTypedDataSigner } from "../payments/circle-dcw.signer.js";

/** An Arc EOA provisioned under Ordiva's Circle developer account. */
export interface ProvisionedAgentWallet {
  readonly id: string;
  readonly address: string;
  readonly accountType: "EOA";
  readonly state: string;
}

export class CircleDcwApiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "CircleDcwApiError";
  }
}

/**
 * Thin wrapper over Circle's developer-controlled wallets SDK.
 *
 * The SDK derives a fresh entity-secret ciphertext per request, so the plaintext
 * secret never leaves this process and is never hand-encrypted.
 */
@Injectable()
export class CircleDcwClient implements CircleTypedDataSigner {
  private readonly client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;

  constructor(@Inject(AGENT_WALLET_CONFIG) private readonly config: AgentWalletConfig) {
    this.client = initiateDeveloperControlledWalletsClient({
      apiKey: config.CIRCLE_API_KEY,
      entitySecret: config.CIRCLE_ENTITY_SECRET
    });
  }

  /**
   * Create one Arc Testnet EOA in Ordiva's wallet set.
   *
   * @param refId - Correlation id recorded on the wallet, so a Circle-side wallet
   *   can be traced back to its Ordiva owner.
   */
  async createArcEoa(refId: string): Promise<ProvisionedAgentWallet> {
    let wallet;
    try {
      const response = await this.client.createWallets({
        walletSetId: this.config.CIRCLE_WALLET_SET_ID,
        blockchains: ["ARC-TESTNET"],
        accountType: "EOA",
        count: 1,
        metadata: [{ refId }]
      });
      wallet = response.data?.wallets?.[0];
    } catch (error) {
      throw new CircleDcwApiError("Circle could not create the agent wallet.", error);
    }

    if (!wallet) throw new CircleDcwApiError("Circle returned no agent wallet.");

    if (wallet.accountType !== "EOA") {
      throw new CircleDcwApiError(
        `Circle returned a ${wallet.accountType} wallet; Arc x402 payments require an EOA.`
      );
    }

    return {
      id: wallet.id,
      address: wallet.address,
      accountType: "EOA",
      state: wallet.state
    };
  }

  /**
   * Sign EIP-712 typed data with a developer-controlled wallet.
   *
   * Shaped to satisfy {@link CircleTypedDataSigner} so `CircleDcwSigner` can consume
   * this client directly.
   *
   * @param params - Circle wallet id and the serialised typed data.
   */
  async signTypedData(params: { walletId: string; data: string }) {
    return this.client.signTypedData(params);
  }
}
