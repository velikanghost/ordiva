import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ARC_TESTNET_CAIP2, type SourcingConfig } from "../src/config.js";
import type { PurchaseOutcome, PurchaseRequest } from "../src/payments/arc-buyer.service.js";
import { VerificationService } from "../src/sourcing/verification.service.js";

const SELLER = "0x1516135a6BdD0B76488CF3a6567Db32f4BFFA563";

const config = {
  ARC_ADAPTER_SELLER_ADDRESS: SELLER,
  ORDIVA_SELF_URL: "http://127.0.0.1:4100",
  PRICE_FIRECRAWL_SCRAPE: "$0.005",
  PRICE_APOLLO_COMPANY: "$0.0075",
  PRICE_FIRECRAWL_CONTACT: "$0.01"
} as unknown as SourcingConfig;

function settled(amountMicros: bigint, data: unknown = {}): PurchaseOutcome {
  return {
    status: "settled",
    data,
    receipt: {
      payer: "0xagent",
      network: ARC_TESTNET_CAIP2,
      amountMicros,
      settlement: "settle-ref",
      success: true
    },
    responseHash: "a".repeat(64),
    latencyMs: 1200
  };
}

const declined: PurchaseOutcome = { status: "declined", reason: "would exceed the run budget" };
const failed: PurchaseOutcome = { status: "failed", reason: "upstream 503", latencyMs: 800 };

interface BuildOptions {
  outcomes?: PurchaseOutcome[];
  supplierCount?: number;
  status?: string;
  /** How long ago the run was last written — drives stale-verification recovery. */
  updatedAt?: Date;
}

function build({
  outcomes = [],
  supplierCount = 2,
  status = "research_ready",
  updatedAt = new Date()
}: BuildOptions = {}) {
  const suppliers = Array.from({ length: supplierCount }, (_, index) => ({
    id: `sup-${index + 1}`,
    name: `Supplier ${index + 1}`,
    url: `https://supplier-${index + 1}.example`,
    domain: `supplier-${index + 1}.example`,
    description: "candidate",
    sourceQuery: "q",
    verified: false,
    evidence: []
  }));

  const run = {
    _id: "run-1",
    userId: "user-1",
    status,
    supplierMinimum: supplierCount,
    budgetMicros: "2000000",
    spentMicros: "0",
    updatedAt,
    suppliers,
    purchases: []
  };

  const recorded: Array<Record<string, unknown>> = [];
  const statuses: string[] = [];
  const verified: Array<{ supplierId: string; evidence: string[] }> = [];

  const runs = {
    getOwned: vi.fn(async () => run),
    claimVerification: vi.fn(async () => {
      if (run.status === "verifying" && Date.now() - updatedAt.getTime() <= 10 * 60 * 1000) return false;
      statuses.push("verifying");
      return true;
    }),
    resumeableVerifications: vi.fn(async () => []),
    renewVerificationLease: vi.fn(async () => undefined),
    setStatus: vi.fn(async (_id: string, next: string) => {
      statuses.push(next);
    }),
    recordPurchase: vi.fn(async (_id: string, purchase: Record<string, unknown>) => {
      recorded.push(purchase);
    }),
    setSupplierVerification: vi.fn(async (_id: string, supplierId: string, result: { status: string; evidence: string[] }) => {
      if (result.status === "verified") verified.push({ supplierId, evidence: result.evidence });
    }),
    view: vi.fn(async () => ({ id: "run-1" }))
  };

  const requests: PurchaseRequest[] = [];
  let index = 0;
  const buyer = {
    purchase: vi.fn(async (request: PurchaseRequest) => {
      requests.push(request);
      return outcomes[Math.min(index++, outcomes.length - 1)] ?? settled(5_000n);
    })
  };

  const agentWallets = {
    ensureForUser: vi.fn(async () => ({ address: "0xagent", id: "wallet-1" })),
    signerFor: vi.fn(() => ({ address: "0xagent", signTypedData: vi.fn() }))
  };

  const service = new VerificationService(
    config,
    runs as never,
    agentWallets as never,
    () => buyer
  );

  return { service, runs, recorded, statuses, verified, requests, buyer };
}

describe("VerificationService", () => {
  it("buys three evidence checks per candidate", async () => {
    const { service, recorded, requests } = build({ supplierCount: 2 });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(requests).toHaveLength(6);
    expect(requests.map((r) => r.adapterId)).toEqual([
      "firecrawl-scrape",
      "apollo-company-enrich",
      "firecrawl-contacts",
      "firecrawl-scrape",
      "apollo-company-enrich",
      "firecrawl-contacts"
    ]);
    expect(recorded).toHaveLength(6);
  });

  it("scopes each purchase to the single adapter it needs", async () => {
    const { service, requests } = build({ supplierCount: 1 });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    for (const request of requests) {
      expect([...request.policy.allowedAdapterIds]).toEqual([request.adapterId]);
      expect(request.policy.sellerAddress).toBe(SELLER);
      expect(request.policy.network).toBe(ARC_TESTNET_CAIP2);
    }
  });

  it("accumulates spend across purchases so the budget tightens as it goes", async () => {
    const { service, requests } = build({ supplierCount: 1, outcomes: [settled(5_000n)] });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(requests.map((r) => r.policy.spentMicros)).toEqual([0n, 5_000n, 10_000n]);
  });

  it("records a settled purchase with its receipt", async () => {
    const { service, recorded } = build({ supplierCount: 1, outcomes: [settled(5_000n)] });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(recorded[0]).toMatchObject({
      adapterId: "firecrawl-scrape",
      outcome: "settled",
      priceMicros: "5000",
      settlement: "settle-ref",
      payer: "0xagent",
      supplierId: "sup-1"
    });
    expect(recorded[0]?.reason).toContain("supplier-1.example");
  });

  it("stops the run when the budget gate declines, and records why", async () => {
    const { service, recorded, statuses } = build({ supplierCount: 2, outcomes: [declined] });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      outcome: "declined",
      failureReason: "would exceed the run budget"
    });
    expect(statuses).toEqual(["verifying", "budget_exhausted"]);
  });

  it("keeps going after a failed purchase, since the next may still succeed", async () => {
    const { service, recorded, statuses } = build({ supplierCount: 1, outcomes: [failed] });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(recorded).toHaveLength(3);
    expect(recorded.every((entry) => entry.outcome === "failed")).toBe(true);
    expect(statuses).toEqual(["verifying", "verification_failed"]);
  });

  it("marks a candidate verified with evidence drawn from the paid responses", async () => {
    // Adapters answer with an envelope; the evidence lives under `data`.
    const { service, verified } = build({
      supplierCount: 1,
      outcomes: [
        settled(5_000n, { requestId: "r1", data: { title: "Pump One BV" } }),
        settled(7_500n, { requestId: "r2", data: { name: "Pump One BV", industry: "machinery" } }),
        settled(10_000n, {
          requestId: "r3",
          data: { contacts: [{ email: "sales@pump-one.example" }] }
        })
      ]
    });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(verified).toHaveLength(1);
    expect(verified[0]?.evidence).toEqual([
      'Site reachable — "Pump One BV"',
      "Registered as Pump One BV (machinery)",
      "1 public contact route(s) found"
    ]);
  });

  it("leaves a candidate unverified when no evidence was obtained", async () => {
    const { service, verified } = build({ supplierCount: 1, outcomes: [failed] });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(verified).toHaveLength(0);
  });

  it("refuses a run that is already verifying", async () => {
    const { service } = build({ status: "verifying" });

    await expect(service.startVerification("run-1", "user-1")).rejects.toThrow(ConflictException);
  });

  it("recovers a run left verifying by a process that died", async () => {
    // Without this the run would be wedged in `verifying` forever, unretryable.
    const { service, recorded } = build({
      status: "verifying",
      updatedAt: new Date(Date.now() - 11 * 60 * 1000),
      supplierCount: 1
    });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(recorded).toHaveLength(3);
  });

  it("returns before the agent has finished spending", async () => {
    const { service, recorded } = build({ supplierCount: 2 });

    await service.startVerification("run-1", "user-1");

    // The HTTP response must not wait for tens of seconds of purchasing.
    expect(recorded.length).toBeLessThan(6);

    await service.whenSettled("run-1");
    expect(recorded).toHaveLength(6);
  });

  it("spends nothing on an already-verified run", async () => {
    const { service, recorded } = build({ status: "verified" });

    await service.startVerification("run-1", "user-1");
    await service.whenSettled("run-1");

    expect(recorded).toHaveLength(0);
  });
});
