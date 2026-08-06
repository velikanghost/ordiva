import { formatUsdcExact } from "./money.js";
import { normalizeAddress } from "./arc-signer.js";

/**
 * The slice of a pre-signature hook context this gate actually reads.
 *
 * Circle's batching SDK and `@x402/core` each declare their own structurally
 * incompatible copies of this context. Depending on neither keeps the gate — the
 * part that must never silently break — testable in isolation.
 */
export interface PaymentGateContext {
  readonly selectedRequirements: {
    readonly network: string;
    readonly payTo: string;
    /** Price in integer micros, as a decimal string. */
    readonly amount: string;
  };
  readonly paymentRequired?: unknown;
}

/** Pre-signature hook: returning `{ abort: true }` prevents any signature being produced. */
export type PaymentGate = (
  context: PaymentGateContext
) => Promise<void | { abort: true; reason: string }>;

/**
 * Deterministic spend policy, evaluated before any signature exists.
 *
 * The model may recommend a purchase; this decides whether one may happen. Every
 * check runs on the payment requirements the seller actually quoted, not on what
 * the agent claimed it was buying.
 */
export interface SpendPolicy {
  /** Total the run is authorised to spend, in micros. */
  readonly budgetMicros: bigint;
  /** Already committed by this run, in micros. */
  readonly spentMicros: bigint;
  /** Adapter ids this run is permitted to buy from. */
  readonly allowedAdapterIds: ReadonlySet<string>;
  /** The only address permitted to receive payment. */
  readonly sellerAddress: string;
  /** CAIP-2 identifier of the only permitted settlement network. */
  readonly network: string;
}

/** The quoted terms a payment would be signed against. */
export interface QuotedPayment {
  readonly adapterId: string;
  readonly network: string;
  readonly payTo: string;
  /** Price in integer micros, as quoted by the seller. */
  readonly amountMicros: bigint;
}

export type PolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

/**
 * Decide whether a quoted payment may proceed.
 *
 * Pure and synchronous so it can be exhaustively tested without a network, a
 * wallet, or a seller.
 *
 * @param policy - The run's spend authority.
 * @param quote - Terms quoted by the seller in its 402 response.
 */
export function evaluatePayment(policy: SpendPolicy, quote: QuotedPayment): PolicyDecision {
  if (!policy.allowedAdapterIds.has(quote.adapterId)) {
    return {
      allowed: false,
      reason: `Adapter "${quote.adapterId}" is not in this run's allowed capability set.`
    };
  }

  if (quote.network !== policy.network) {
    return {
      allowed: false,
      reason: `Payment network ${quote.network} is not the required ${policy.network}.`
    };
  }

  if (normalizeAddress(quote.payTo) !== normalizeAddress(policy.sellerAddress)) {
    return {
      allowed: false,
      reason: `Payment recipient ${quote.payTo} is not the expected Ordiva seller address.`
    };
  }

  if (quote.amountMicros <= 0n) {
    return { allowed: false, reason: "Quoted price must be greater than zero." };
  }

  const projected = policy.spentMicros + quote.amountMicros;
  if (projected > policy.budgetMicros) {
    return {
      allowed: false,
      reason:
        `Purchase of ${formatUsdcExact(quote.amountMicros)} would exceed the run budget ` +
        `(${formatUsdcExact(policy.spentMicros)} of ${formatUsdcExact(policy.budgetMicros)} already committed).`
    };
  }

  return { allowed: true };
}

/**
 * Adapt {@link evaluatePayment} into Circle's pre-signature hook.
 *
 * Returning `{ abort: true }` stops the SDK before it builds or signs a payload,
 * so a rejected purchase never produces an authorisation the agent could replay.
 *
 * @param policy - The run's spend authority.
 * @param adapterId - Adapter this purchase attempt targets.
 * @param onDecline - Invoked with the reason when a payment is refused.
 */
export function createBudgetGate(
  policy: SpendPolicy,
  adapterId: string,
  onDecline?: (reason: string) => void
): PaymentGate {
  return async ({ selectedRequirements }) => {
    const decision = evaluatePayment(policy, {
      adapterId,
      network: selectedRequirements.network,
      payTo: selectedRequirements.payTo,
      amountMicros: BigInt(selectedRequirements.amount)
    });

    if (decision.allowed) return;

    onDecline?.(decision.reason);
    return { abort: true, reason: decision.reason };
  };
}
