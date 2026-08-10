import { createHash } from "node:crypto";
import { BatchEvmScheme } from "@circle-fin/x402-batching/client";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { ArcPaymentSigner } from "./arc-signer.js";
import { createBudgetGate, type SpendPolicy } from "./budget.policy.js";

/** A purchase the agent wants to make, with the reason it believes it is worthwhile. */
export interface PurchaseRequest {
  /** Adapter id, matched against the run's allowed capability set. */
  readonly adapterId: string;
  /** Absolute URL of the paid adapter route. */
  readonly url: string;
  /** Request body for the adapter. */
  readonly body: unknown;
  /** The agent's stated justification, recorded on the ledger either way. */
  readonly reason: string;
  /** Spend authority in force for this attempt. */
  readonly policy: SpendPolicy;
}

/** Confirmed payment metadata, only ever produced by a real settlement. */
export interface PaymentReceipt {
  readonly payer?: string;
  readonly network: string;
  readonly amountMicros: bigint;
  /** Circle Gateway transfer UUID for a batched nanopayment. */
  readonly settlement?: string;
  /** Genuine EVM transaction hash, present only for an onchain settlement. */
  readonly transactionHash?: string;
  readonly success: boolean;
}

export type PurchaseOutcome =
  | {
      readonly status: "settled";
      readonly data: unknown;
      readonly receipt: PaymentReceipt;
      readonly responseHash: string;
      readonly latencyMs: number;
    }
  | {
      /** Refused by deterministic policy. No signature was ever produced. */
      readonly status: "declined";
      readonly reason: string;
    }
  | {
      /** Payment may have settled, but the purchase did not yield usable evidence. */
      readonly status: "failed";
      readonly reason: string;
      readonly receipt?: PaymentReceipt;
      readonly latencyMs: number;
    };

/** Circle's SDK signals a hook abort by prefixing the reason. */
const ABORT_PREFIX = "Payment creation aborted: ";

/**
 * Buys evidence from Arc x402 seller routes on behalf of a run.
 *
 * The agent chooses *what* to buy; this class is the only thing that can make a
 * purchase happen, and it refuses before signing whenever the run's spend policy
 * says no.
 */
export class ArcBuyerService {
  constructor(
    private readonly signer: ArcPaymentSigner,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  /**
   * Attempt one paid purchase, honouring the run's spend policy.
   *
   * Never throws for an expected outcome — a refused or failed purchase is a
   * result to record, not an exception to unwind.
   *
   * @param request - What to buy, why, and under what authority.
   */
  async purchase(request: PurchaseRequest): Promise<PurchaseOutcome> {
    const startedAt = Date.now();

    try {
      const challenge = await this.post(request.url, request.body);

      if (challenge.status !== 402) {
        return this.unpaidOutcome(challenge, startedAt);
      }

      const http = this.createHttpClient(request);
      const paymentRequired = http.getPaymentRequiredResponse(
        (name) => challenge.headers.get(name),
        challenge.body
      );

      const payload = await http.createPaymentPayload(paymentRequired);
      const paid = await this.post(
        request.url,
        request.body,
        http.encodePaymentSignatureHeader(payload)
      );

      const { settleResponse } = await http.processPaymentResult(
        payload,
        (name) => paid.headers.get(name),
        paid.status
      );

      const receipt = this.toReceipt(settleResponse, paymentRequired);
      const latencyMs = Date.now() - startedAt;

      if (paid.status < 200 || paid.status >= 300) {
        return {
          status: "failed",
          reason: `Adapter returned HTTP ${paid.status} after payment.`,
          receipt,
          latencyMs
        };
      }

      return {
        status: "settled",
        data: paid.body,
        receipt,
        responseHash: hashResponse(paid.body),
        latencyMs
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // A policy abort is a decision, not a failure: no payload was signed.
      if (message.startsWith(ABORT_PREFIX)) {
        return { status: "declined", reason: message.slice(ABORT_PREFIX.length) };
      }

      return {
        status: "failed",
        reason: message,
        latencyMs: Date.now() - startedAt
      };
    }
  }

  /**
   * Build a payment client whose budget gate is bound to this attempt.
   *
   * Hooks are registered on the `x402Client` rather than on the scheme — the SDK
   * fires scheme hooks only when the scheme is used standalone, and registering in
   * both places would double-fire.
   *
   * @param request - The purchase this client is scoped to.
   */
  private createHttpClient(request: PurchaseRequest): x402HTTPClient {
    // Circle's SDK vendors its own minimal copies of `SchemeNetworkClient` and the
    // hook context. They are structurally incompatible with `@x402/core`'s real
    // types (`BatchPayload` has no index signature; `resource.description` differs
    // in optionality) even though both sides agree at runtime. Two narrow casts at
    // this boundary keep that friction from leaking into the gate or the scheme.
    const scheme = new BatchEvmScheme(this.signer) as unknown as Parameters<
      x402Client["register"]
    >[1];
    const gate = createBudgetGate(request.policy, request.adapterId) as unknown as Parameters<
      x402Client["onBeforePaymentCreation"]
    >[0];

    const client = new x402Client().register("eip155:*", scheme).onBeforePaymentCreation(gate);

    return new x402HTTPClient(client);
  }

  /**
   * A route that answered without demanding payment never produces a receipt.
   *
   * @param response - The unpaid response.
   * @param startedAt - Epoch millis when the attempt began.
   */
  private unpaidOutcome(response: RawResponse, startedAt: number): PurchaseOutcome {
    const latencyMs = Date.now() - startedAt;

    if (response.status >= 200 && response.status < 300) {
      return {
        status: "failed",
        reason: `Adapter answered HTTP ${response.status} without an x402 challenge; no payment was made.`,
        latencyMs
      };
    }

    return {
      status: "failed",
      reason: `Adapter rejected the request with HTTP ${response.status} before payment.`,
      latencyMs
    };
  }

  /**
   * Convert the facilitator's settlement into Ordiva's receipt shape.
   *
   * @param settleResponse - Settlement decoded from the paid response.
   * @param paymentRequired - The challenge the payment answered.
   */
  private toReceipt(
    settleResponse: { success?: boolean; payer?: string; transaction?: string } | undefined,
    paymentRequired: { accepts: Array<{ network: string; amount: string }> }
  ): PaymentReceipt {
    const [terms] = paymentRequired.accepts;
    const transaction = settleResponse?.transaction;
    const transactionHash = isEvmTransactionHash(transaction) ? transaction : undefined;

    return {
      payer: settleResponse?.payer,
      network: terms?.network ?? "unknown",
      amountMicros: terms ? BigInt(terms.amount) : 0n,
      settlement: transactionHash ? undefined : transaction,
      transactionHash,
      success: settleResponse?.success ?? false
    };
  }

  /**
   * POST JSON and normalise the response for header and body inspection.
   *
   * @param url - Target adapter route.
   * @param body - JSON request body.
   * @param extraHeaders - Payment headers, when retrying after a 402.
   */
  private async post(
    url: string,
    body: unknown,
    extraHeaders: Record<string, string> = {}
  ): Promise<RawResponse> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000)
    });

    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    return { status: response.status, headers: response.headers, body: parsed };
  }
}

/** An Arcscan transaction route accepts only a full EVM transaction hash. */
function isEvmTransactionHash(value: string | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);
}

interface RawResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: unknown;
}

/**
 * Hash the adapter response so the ledger can prove what was received.
 *
 * @param body - Parsed response body.
 */
function hashResponse(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body) ?? "null").digest("hex");
}
