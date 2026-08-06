import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import type { AgentWalletConfig } from "../config.js";
import { AGENT_WALLET_CONFIG } from "./agent-wallet.tokens.js";

const challengeSchema = z.object({
  data: z.object({ challengeId: z.string().min(1) })
});

const circleErrorSchema = z
  .object({
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional()
  })
  .passthrough();

/** Circle's code for an expired or otherwise unusable user token. */
const USER_TOKEN_EXPIRED_CODES = new Set(["155104", "155103"]);

export class CircleUcwApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | string | undefined,
    message: string
  ) {
    super(message);
    this.name = "CircleUcwApiError";
  }

  /** True when the browser must re-authenticate before retrying. */
  get requiresReauth(): boolean {
    return this.status === 401 || USER_TOKEN_EXPIRED_CODES.has(String(this.code));
  }
}

export interface ContractExecutionRequest {
  /** Short-lived Circle user token, supplied by the browser per request. */
  readonly userToken: string;
  readonly walletId: string;
  readonly contractAddress: string;
  /** e.g. `approve(address,uint256)` — preferred over raw calldata for auditability. */
  readonly abiFunctionSignature: string;
  readonly abiParameters: ReadonlyArray<string>;
}

/**
 * Creates contract-execution challenges against a user's own Circle wallet.
 *
 * Ordiva never holds the user token: the browser passes it per request and it is
 * used once and discarded, matching how `/v1/auth/session` already treats it.
 */
@Injectable()
export class CircleUcwClient {
  constructor(@Inject(AGENT_WALLET_CONFIG) private readonly config: AgentWalletConfig) {}

  /**
   * Ask Circle for a challenge the user completes with their PIN.
   *
   * @param request - Target contract, function, and the user's wallet.
   * @returns The challenge id the browser SDK must execute.
   */
  async createContractExecutionChallenge(request: ContractExecutionRequest): Promise<string> {
    const raw = await this.post(
      "/v1/w3s/user/transactions/contractExecution",
      {
        idempotencyKey: randomUUID(),
        walletId: request.walletId,
        contractAddress: request.contractAddress,
        abiFunctionSignature: request.abiFunctionSignature,
        abiParameters: [...request.abiParameters],
        feeLevel: "MEDIUM"
      },
      request.userToken
    );

    return challengeSchema.parse(raw).data.challengeId;
  }

  /**
   * POST to Circle with the caller's user token attached.
   *
   * @param path - API path.
   * @param body - JSON request body.
   * @param userToken - The end user's short-lived Circle token.
   */
  private async post(path: string, body: unknown, userToken: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.config.CIRCLE_WALLETS_API_URL), {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.CIRCLE_API_KEY}`,
          "x-user-token": userToken,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000)
      });
    } catch (error) {
      throw new CircleUcwApiError(
        0,
        undefined,
        error instanceof Error ? error.message : "Circle Wallets request failed"
      );
    }

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      throw new CircleUcwApiError(response.status, undefined, "Circle Wallets returned non-JSON data");
    }

    if (!response.ok) {
      const error = circleErrorSchema.safeParse(parsed);
      throw new CircleUcwApiError(
        response.status,
        error.success ? error.data.code : undefined,
        error.success
          ? (error.data.message ?? `Circle Wallets returned HTTP ${response.status}`)
          : `Circle Wallets returned HTTP ${response.status}`
      );
    }

    return parsed;
  }
}
