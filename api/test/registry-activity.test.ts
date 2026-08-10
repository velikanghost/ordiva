import { describe, expect, it, vi } from "vitest";
import type { SourcingConfig } from "../src/config.js";
import type { RunContractActivity } from "../src/sourcing/run.schema.js";
import { RegistryActivityService } from "../src/sourcing/registry-activity.service.js";

const REGISTRY = "0x1234567890123456789012345678901234567890";
const TX_HASH = `0x${"a".repeat(64)}`;

function build(registryAddress: string | null = REGISTRY) {
  const run: any = {
    _id: "run-1",
    userId: "user-1",
    goal: "Find industrial pump suppliers",
    budgetMicros: "2000000",
    spentMicros: "15000",
    status: "verified",
    suppliers: [{ id: "sup-1", verificationStatus: "verified", evidence: ["Site reachable"] }],
    purchases: [{
      adapterId: "firecrawl-scrape",
      reason: "Verify supplier",
      priceMicros: "15000",
      outcome: "settled",
      settlement: "gateway-transfer-id",
      responseHash: "b".repeat(64),
      createdAt: new Date("2026-08-10T00:00:00Z")
    }],
    outreach: [],
    contractActivities: [] as RunContractActivity[]
  };
  const runs = {
    getOwned: vi.fn(async () => run),
    addContractActivity: vi.fn(async (_runId: string, activity: RunContractActivity) => {
      if (!run.contractActivities.some((item: RunContractActivity) => item.type === activity.type)) {
        run.contractActivities.push(activity);
      }
    }),
    updateContractActivity: vi.fn(async (_runId: string, id: string, fields: Partial<RunContractActivity>) => {
      Object.assign(run.contractActivities.find((item: RunContractActivity) => item.id === id), fields);
    }),
    resumeableContractActivities: vi.fn(async () => [])
  };
  let transaction = 0;
  const circle = {
    createContractExecution: vi.fn(async (input: { abiFunctionSignature: string }) => {
      if (!input.abiFunctionSignature) throw new Error("Missing contract function signature");
      return {
        id: `circle-${++transaction}`,
        state: "INITIATED"
      };
    }),
    waitForTransactionHash: vi.fn(async () => ({ txHash: TX_HASH, state: "CONFIRMED" }))
  };
  const service = new RegistryActivityService(
    { ARC_REGISTRY_ADDRESS: registryAddress ?? undefined } as SourcingConfig,
    runs as never,
    { ensureForUser: vi.fn(async () => ({ id: "agent-wallet", address: "0x2222222222222222222222222222222222222222" })) } as never,
    { findByUserId: vi.fn(async () => ({ id: "owner-wallet", address: "0x1111111111111111111111111111111111111111" })) } as never,
    circle as never
  );
  return { service, run, circle, runs };
}

describe("OrdivaRegistry activity trail", () => {
  it("records confirmed hashes for registration, ledger anchoring, and closure", async () => {
    const { service, run, circle } = build();

    await service.registerRun("run-1", "user-1");
    await service.whenSettled("run-1");
    await service.finalizeRun("run-1", "user-1");

    expect(circle.createContractExecution.mock.calls.map(([input]) => input.abiFunctionSignature)).toEqual([
      "registerRun(bytes32,address,address,uint96,bytes32)",
      "anchorLedger(bytes32,bytes32,uint96,uint32)",
      "closeRun(bytes32,bytes32,uint8)"
    ]);
    expect(run.contractActivities).toHaveLength(3);
    expect(run.contractActivities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "run_registered", state: "confirmed", transactionHash: TX_HASH }),
      expect.objectContaining({ type: "ledger_anchored", state: "confirmed", transactionHash: TX_HASH }),
      expect.objectContaining({ type: "run_closed", state: "confirmed", transactionHash: TX_HASH })
    ]));
  });

  it("does nothing when no registry address is configured", async () => {
    const { service, run, circle } = build(null);
    await service.registerRun("run-1", "user-1");
    await service.finalizeRun("run-1", "user-1");

    expect(circle.createContractExecution).not.toHaveBeenCalled();
    expect(run.contractActivities).toEqual([]);
  });
});
