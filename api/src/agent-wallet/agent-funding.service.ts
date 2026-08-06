import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { AgentWalletConfig } from "../config.js";
import { formatUsdcExact, toMicros } from "../payments/money.js";
import { WalletsService } from "../wallets/wallets.service.js";
import { AgentWalletService } from "./agent-wallet.service.js";
import { AGENT_WALLET_CONFIG } from "./agent-wallet.tokens.js";
import { CircleUcwClient } from "./circle-ucw.client.js";
import { GatewayBalanceReader } from "./gateway-balance.reader.js";

/**
 * A PIN-approved step the browser must complete, in order.
 *
 * `approve` is omitted when the existing allowance already covers the deposit, so
 * repeat top-ups cost the user a single prompt instead of two.
 */
export interface FundingChallenge {
  readonly step: "approve" | "deposit";
  readonly challengeId: string;
  readonly description: string;
}

export interface AgentWalletStatus {
  readonly address: string;
  readonly blockchain: "ARC-TESTNET";
  readonly accountType: "EOA";
  /** Agent's spendable Gateway balance, e.g. `"$2.000000"`. */
  readonly gatewayBalance: string;
  /** USDC held by the owner's own wallet. */
  readonly ownerBalance: string;
  readonly ownerAddress: string;
  /** How much the owner has approved the Gateway to move, as confirmed on Arc. */
  readonly allowance: string;
}

/** Ceiling on a single funding action — a testnet demo has no reason to exceed it. */
const MAX_FUNDING_MICROS = 20_000_000n;

@Injectable()
export class AgentFundingService {
  constructor(
    @Inject(AGENT_WALLET_CONFIG) private readonly config: AgentWalletConfig,
    @Inject(AgentWalletService) private readonly agentWallets: AgentWalletService,
    @Inject(WalletsService) private readonly wallets: WalletsService,
    @Inject(CircleUcwClient) private readonly ucw: CircleUcwClient,
    @Inject(GatewayBalanceReader) private readonly balances: GatewayBalanceReader
  ) {}

  /**
   * Provision the agent wallet if needed and report live on-chain funding state.
   *
   * @param userId - Owner of the agent wallet.
   */
  async status(userId: string): Promise<AgentWalletStatus> {
    const { agent, owner, funding } = await this.resolve(userId);

    return {
      address: agent.address,
      blockchain: agent.blockchain,
      accountType: agent.accountType,
      gatewayBalance: formatUsdcExact(funding.availableMicros),
      ownerBalance: formatUsdcExact(funding.ownerUsdcMicros),
      ownerAddress: owner.address,
      allowance: formatUsdcExact(funding.ownerAllowanceMicros)
    };
  }

  /**
   * Build the challenges that move `amount` from the owner's wallet into the
   * agent's Gateway balance.
   *
   * This is the single point where a human grants spending authority. Everything
   * after it — every purchase the agent makes — happens with no human present, which
   * is precisely why the amount is validated against the owner's real balance here
   * rather than trusted from the client.
   *
   * @param userId - Owner of the agent wallet.
   * @param circleUserToken - Short-lived Circle token from the browser.
   * @param amount - USDC amount, e.g. `"2"` or `"$2.00"`.
   */
  async createApproveChallenge(
    userId: string,
    circleUserToken: string,
    amount: string
  ): Promise<{ challenge: FundingChallenge | null; allowance: string }> {
    const amountMicros = this.parseAmount(amount);
    const { owner, funding } = await this.resolve(userId);

    if (funding.ownerUsdcMicros < amountMicros) {
      throw new BadRequestException(
        `Your wallet holds ${formatUsdcExact(funding.ownerUsdcMicros)}, which cannot fund ` +
          `${formatUsdcExact(amountMicros)}. Request testnet USDC from the Circle faucet first.`
      );
    }

    // Already sufficient: skip the prompt entirely.
    if (funding.ownerAllowanceMicros >= amountMicros) {
      return { challenge: null, allowance: formatUsdcExact(funding.ownerAllowanceMicros) };
    }

    return {
      challenge: {
        step: "approve",
        challengeId: await this.ucw.createContractExecutionChallenge({
          userToken: circleUserToken,
          walletId: owner.id,
          // `approve` lives on the USDC token, not on the Gateway. Sending it to the
          // Gateway leaves the allowance at zero and `depositFor` reverts with
          // "transfer amount exceeds allowance".
          contractAddress: this.config.USDC_ADDRESS,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [this.config.GATEWAY_WALLET_ADDRESS, amountMicros.toString()]
        }),
        description: `Allow the Gateway contract to move ${formatUsdcExact(amountMicros)} from your wallet`
      },
      allowance: formatUsdcExact(funding.ownerAllowanceMicros)
    };
  }

  /**
   * Create the deposit challenge that credits the agent's Gateway balance.
   *
   * Refuses unless the allowance is *already visible on-chain*. Circle reporting a
   * challenge as complete only means it accepted the request — the approval may
   * still be unmined, and depositing against an unmined approval reverts.
   *
   * @param userId - Owner of the agent wallet.
   * @param circleUserToken - Short-lived Circle token from the browser.
   * @param amount - USDC amount, matching the approved figure.
   */
  async createDepositChallenge(
    userId: string,
    circleUserToken: string,
    amount: string
  ): Promise<{ challenge: FundingChallenge; agentAddress: string }> {
    const amountMicros = this.parseAmount(amount);
    const { agent, owner, funding } = await this.resolve(userId);

    if (funding.ownerAllowanceMicros < amountMicros) {
      throw new ConflictException({
        error: "allowance_not_ready",
        message:
          `The approval for ${formatUsdcExact(amountMicros)} has not confirmed on Arc yet ` +
          `(currently ${formatUsdcExact(funding.ownerAllowanceMicros)}). Wait a moment and retry.`
      });
    }

    return {
      challenge: {
        step: "deposit",
        challengeId: await this.ucw.createContractExecutionChallenge({
          userToken: circleUserToken,
          walletId: owner.id,
          contractAddress: this.config.GATEWAY_WALLET_ADDRESS,
          abiFunctionSignature: "depositFor(address,address,uint256)",
          abiParameters: [this.config.USDC_ADDRESS, agent.address, amountMicros.toString()]
        }),
        description: `Fund your agent with ${formatUsdcExact(amountMicros)} of spending authority`
      },
      agentAddress: agent.address
    };
  }

  /**
   * Load both wallets and their current on-chain position.
   *
   * @param userId - Owner of the agent wallet.
   */
  private async resolve(userId: string) {
    const [agent, owner] = await Promise.all([
      this.agentWallets.ensureForUser(userId),
      this.wallets.findByUserId(userId)
    ]);

    if (!owner) throw new NotFoundException("No Arc wallet is linked to this account");

    return { agent, owner, funding: await this.balances.read(agent.address, owner.address) };
  }

  /**
   * Validate and convert a requested funding amount.
   *
   * @param amount - USDC amount as supplied by the client.
   */
  private parseAmount(amount: string): bigint {
    let micros: bigint;
    try {
      micros = toMicros(amount);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid amount");
    }

    if (micros <= 0n) throw new BadRequestException("Funding amount must be greater than zero.");
    if (micros > MAX_FUNDING_MICROS) {
      throw new BadRequestException(
        `Funding is capped at ${formatUsdcExact(MAX_FUNDING_MICROS)} per action.`
      );
    }

    return micros;
  }
}
