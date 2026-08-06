import { Inject, Injectable } from "@nestjs/common";
import { createPublicClient, defineChain, http, parseAbi, type Address, type PublicClient } from "viem";
import { z } from "zod";
import type { AgentWalletConfig } from "../config.js";
import { toMicros } from "../payments/money.js";
import { AGENT_WALLET_CONFIG } from "./agent-wallet.tokens.js";

/** Arc Testnet. Gas is denominated in USDC, so the native currency is USDC. */
export const ARC_TESTNET_CHAIN_ID = 5042002;

/** Circle Gateway's domain identifier for Arc Testnet. */
export const ARC_TESTNET_GATEWAY_DOMAIN = 26;

const gatewayBalancesSchema = z.object({
  balances: z
    .array(
      z.object({
        depositor: z.string(),
        balance: z.string(),
        pendingBatch: z.string().optional()
      })
    )
    .default([])
});

const GATEWAY_ABI = parseAbi([
  "function availableBalance(address token, address depositor) view returns (uint256)"
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)"
]);

export interface GatewayFunding {
  /** Spendable Gateway balance credited to the agent, in micros. */
  readonly availableMicros: bigint;
  /** USDC sitting in the owner's own wallet, in micros. */
  readonly ownerUsdcMicros: bigint;
  /** How much the owner has approved the Gateway contract to pull, in micros. */
  readonly ownerAllowanceMicros: bigint;
}

/**
 * Reads the external truth behind a run's spending power.
 *
 * The workbench must never infer a balance from its own ledger — the claim of the
 * product is that spend is independently verifiable, so it is read from outside.
 *
 * Two different sources, deliberately:
 * - the **agent's spendable balance** comes from Circle's Gateway API, because
 *   x402 payments are off-chain authorisations settled in batches. The
 *   `availableBalance` on the Gateway contract lags by a whole batch and would
 *   show a spend meter frozen at the deposit amount while the agent is spending.
 * - the **owner's balance and allowance** come from Arc directly, because those
 *   are ordinary ERC-20 state and the chain is authoritative.
 */
@Injectable()
export class GatewayBalanceReader {
  private readonly client: PublicClient;

  constructor(@Inject(AGENT_WALLET_CONFIG) private readonly config: AgentWalletConfig) {
    const chain = defineChain({
      id: ARC_TESTNET_CHAIN_ID,
      name: "Arc Testnet",
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: { default: { http: [config.ARC_RPC_URL] } }
    });

    this.client = createPublicClient({ chain, transport: http() });
  }

  /**
   * Read the agent's Gateway balance alongside the owner's wallet position.
   *
   * @param agentAddress - The agent wallet whose Gateway balance is credited.
   * @param ownerAddress - The user wallet that funds it.
   */
  async read(agentAddress: string, ownerAddress: string): Promise<GatewayFunding> {
    const usdc = this.config.USDC_ADDRESS as Address;
    const gateway = this.config.GATEWAY_WALLET_ADDRESS as Address;

    try {
      const [availableMicros, ownerUsdcMicros, ownerAllowanceMicros] = await Promise.all([
        this.readGatewayBalance(agentAddress),
        this.client.readContract({
          address: usdc,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [ownerAddress as Address]
        }),
        this.client.readContract({
          address: usdc,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [ownerAddress as Address, gateway]
        })
      ]);

      return { availableMicros, ownerUsdcMicros, ownerAllowanceMicros };
    } catch (error) {
      throw new Error(
        `Could not read Arc balances: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Ask Circle Gateway what the agent can actually spend right now.
   *
   * An unknown depositor returns no row rather than an error, which correctly
   * reads as a zero balance for a wallet that has never been funded.
   *
   * @param agentAddress - Depositor whose Gateway balance to read.
   */
  private async readGatewayBalance(agentAddress: string): Promise<bigint> {
    const response = await fetch(
      new URL("/v1/balances", this.config.CIRCLE_GATEWAY_FACILITATOR_URL),
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          token: "USDC",
          sources: [{ domain: ARC_TESTNET_GATEWAY_DOMAIN, depositor: agentAddress }]
        }),
        signal: AbortSignal.timeout(15_000)
      }
    );

    if (!response.ok) {
      throw new Error(`Circle Gateway returned HTTP ${response.status}`);
    }

    const { balances } = gatewayBalancesSchema.parse(await response.json());
    const row = balances.find(
      (entry) => entry.depositor.toLowerCase() === agentAddress.toLowerCase()
    );

    return row ? toMicros(row.balance) : 0n;
  }
}
