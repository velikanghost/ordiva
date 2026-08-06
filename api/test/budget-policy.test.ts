import { describe, expect, it, vi } from "vitest";
import { ARC_TESTNET_CAIP2 } from "../src/config.js";
import {
  createBudgetGate,
  evaluatePayment,
  type QuotedPayment,
  type SpendPolicy
} from "../src/payments/budget.policy.js";

const SELLER = "0x1111111111111111111111111111111111111111";

function policy(overrides: Partial<SpendPolicy> = {}): SpendPolicy {
  return {
    budgetMicros: 2_000_000n,
    spentMicros: 0n,
    allowedAdapterIds: new Set(["firecrawl-scrape", "apollo-company-enrich"]),
    sellerAddress: SELLER,
    network: ARC_TESTNET_CAIP2,
    ...overrides
  };
}

function quote(overrides: Partial<QuotedPayment> = {}): QuotedPayment {
  return {
    adapterId: "firecrawl-scrape",
    network: ARC_TESTNET_CAIP2,
    payTo: SELLER,
    amountMicros: 10_000n,
    ...overrides
  };
}

describe("evaluatePayment", () => {
  it("allows a quote that satisfies every check", () => {
    expect(evaluatePayment(policy(), quote())).toEqual({ allowed: true });
  });

  it("rejects an adapter outside the run's capability set", () => {
    const decision = evaluatePayment(policy(), quote({ adapterId: "resend-email" }));
    expect(decision).toMatchObject({ allowed: false });
    expect(decision).toHaveProperty("reason", expect.stringContaining("resend-email"));
  });

  it("rejects any network other than Arc", () => {
    const decision = evaluatePayment(policy(), quote({ network: "eip155:8453" }));
    expect(decision).toMatchObject({ allowed: false });
    expect(decision).toHaveProperty("reason", expect.stringContaining("eip155:8453"));
  });

  it("rejects a payment redirected to another recipient", () => {
    const attacker = "0x2222222222222222222222222222222222222222";
    expect(evaluatePayment(policy(), quote({ payTo: attacker }))).toMatchObject({
      allowed: false
    });
  });

  it("accepts the seller address in any capitalisation", () => {
    expect(evaluatePayment(policy(), quote({ payTo: SELLER.toUpperCase().replace("0X", "0x") })))
      .toEqual({ allowed: true });
  });

  it("rejects a zero or negative price", () => {
    expect(evaluatePayment(policy(), quote({ amountMicros: 0n }))).toMatchObject({
      allowed: false
    });
  });

  it("allows a purchase that exactly exhausts the budget", () => {
    const remaining = policy({ budgetMicros: 100_000n, spentMicros: 90_000n });
    expect(evaluatePayment(remaining, quote({ amountMicros: 10_000n }))).toEqual({
      allowed: true
    });
  });

  it("rejects a purchase one micro beyond the budget", () => {
    const remaining = policy({ budgetMicros: 100_000n, spentMicros: 90_000n });
    const decision = evaluatePayment(remaining, quote({ amountMicros: 10_001n }));
    expect(decision).toMatchObject({ allowed: false });
    expect(decision).toHaveProperty("reason", expect.stringContaining("exceed the run budget"));
  });
});

describe("createBudgetGate", () => {
  const requirements = {
    scheme: "exact",
    network: ARC_TESTNET_CAIP2,
    asset: "0x3600000000000000000000000000000000000000",
    amount: "10000",
    payTo: SELLER,
    maxTimeoutSeconds: 60
  };

  const paymentRequired = { x402Version: 2, accepts: [requirements] };

  it("returns undefined so signing proceeds when the policy allows", async () => {
    const gate = createBudgetGate(policy(), "firecrawl-scrape");
    await expect(
      gate({ paymentRequired, selectedRequirements: requirements })
    ).resolves.toBeUndefined();
  });

  it("aborts before signing when the budget is exhausted", async () => {
    const onDecline = vi.fn();
    const gate = createBudgetGate(
      policy({ budgetMicros: 5_000n }),
      "firecrawl-scrape",
      onDecline
    );

    const result = await gate({ paymentRequired, selectedRequirements: requirements });

    expect(result).toMatchObject({ abort: true });
    expect(onDecline).toHaveBeenCalledOnce();
    expect(onDecline.mock.calls[0]?.[0]).toContain("exceed the run budget");
  });

  it("reads the price from the seller's quote, not the caller's claim", async () => {
    // Seller quotes $1.00 while the run has only $0.50 left. The gate must use the quote.
    const gate = createBudgetGate(policy({ budgetMicros: 500_000n }), "firecrawl-scrape");
    const result = await gate({
      paymentRequired,
      selectedRequirements: { ...requirements, amount: "1000000" }
    });

    expect(result).toMatchObject({ abort: true });
  });
});
