import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { SourcingConfig } from "../src/config.js";
import type { PurchaseRequest } from "../src/payments/arc-buyer.service.js";
import { OutreachService } from "../src/sourcing/outreach.service.js";

const config = {
  ORDIVA_SELF_URL: "http://127.0.0.1:4100",
  PRICE_RESEND_EMAIL: "$0.01",
  ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111",
  AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters-long"
} as SourcingConfig;

function build() {
  const run: any = {
    _id: "run-1",
    userId: "user-1",
    goal: "Source industrial pumps for a Rotterdam pilot order",
    budgetMicros: "2000000",
    spentMicros: "0",
    plan: { outreachQuestions: ["What is the lead time?", "What is the MOQ?"] },
    suppliers: [{
      id: "sup-1",
      name: "Pump One BV",
      verified: true,
      contacts: ["sales@pump-one.example"]
    }],
    outreach: [],
    purchases: []
  };
  const requests: PurchaseRequest[] = [];
  const runs = {
    getOwned: vi.fn(async () => run),
    view: vi.fn(async () => ({ ...run, id: run._id })),
    resumeableOutreach: vi.fn(async () => []),
    saveOutreachDrafts: vi.fn(async (_runId: string, drafts: any[]) => { run.outreach = drafts; }),
    updateOutreach: vi.fn(async (_runId: string, id: string, fields: Record<string, unknown>) => {
      Object.assign(run.outreach.find((item: any) => item.id === id), fields);
    }),
    claimOutreach: vi.fn(async () => true),
    recordPurchase: vi.fn(async (_runId: string, purchase: any) => { run.purchases.push(purchase); })
  };
  const buyer = {
    purchase: vi.fn(async (request: PurchaseRequest) => {
      requests.push(request);
      return {
        status: "settled" as const,
        data: { data: { messageId: "msg-1", accepted: true } },
        receipt: {
          payer: "0xagent",
          network: "eip155:5042002",
          amountMicros: 10_000n,
          settlement: "settlement-1",
          success: true
        },
        responseHash: "a".repeat(64),
        latencyMs: 50
      };
    })
  };
  const wallets = {
    ensureForUser: vi.fn(async () => ({ id: "agent-1", address: "0xagent" })),
    signerFor: vi.fn(() => ({ address: "0xagent", signTypedData: vi.fn() }))
  };
  const service = new OutreachService(config, runs as never, wallets as never, () => buyer);
  return { service, run, runs, requests };
}

describe("OutreachService", () => {
  it("creates an editable RFQ only for a verified supplier with a contact", async () => {
    const { service, run } = build();
    await service.createDrafts("run-1", "user-1");
    expect(run.outreach).toHaveLength(1);
    expect(run.outreach[0]).toMatchObject({
      supplierId: "sup-1",
      recipient: "sales@pump-one.example",
      status: "draft",
      version: 1
    });
    expect(run.outreach[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects approval when the reviewed hash is stale", async () => {
    const { service, run } = build();
    await service.createDrafts("run-1", "user-1");
    await expect(service.approve("run-1", run.outreach[0].id, "user-1", "0".repeat(64)))
      .rejects.toThrow(ConflictException);
  });

  it("editing creates a new version and clears the previous approval", async () => {
    const { service, run } = build();
    await service.createDrafts("run-1", "user-1");
    const draft = run.outreach[0];
    await service.approve("run-1", draft.id, "user-1", draft.contentHash);
    const originalHash = draft.contentHash;
    await service.updateDraft("run-1", draft.id, "user-1", {
      recipient: draft.recipient,
      subject: `${draft.subject} — revised`,
      text: draft.text
    });
    expect(draft.version).toBe(2);
    expect(draft.contentHash).not.toBe(originalHash);
    expect(draft.status).toBe("draft");
    expect(draft.approvedHash).toBeUndefined();
  });

  it("sends only the approved version through the budget-gated Resend adapter", async () => {
    const { service, run, requests } = build();
    await service.createDrafts("run-1", "user-1");
    const draft = run.outreach[0];
    await service.approve("run-1", draft.id, "user-1", draft.contentHash);
    await service.send("run-1", draft.id, "user-1");
    await service.whenSettled(draft.id);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ adapterId: "resend-email" });
    expect(requests[0]?.body).toMatchObject({
      to: "sales@pump-one.example",
      idempotencyKey: `ordiva/run-1/${draft.id}/v1`
    });
    expect([...requests[0]!.policy.allowedAdapterIds]).toEqual(["resend-email"]);
    expect(draft.status).toBe("sent");
    expect(draft.messageId).toBe("msg-1");
    expect(run.purchases[0]).toMatchObject({ outcome: "settled", settlement: "settlement-1" });
  });

  it("sends a labeled test to the verified account email without changing supplier delivery state", async () => {
    const { service, run, requests } = build();
    await service.createDrafts("run-1", "user-1");
    const draft = run.outreach[0];
    await service.approve("run-1", draft.id, "user-1", draft.contentHash);

    await service.sendTest("run-1", draft.id, "user-1", "Judge@Outside.test");

    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toMatchObject({
      to: "judge@outside.test",
      subject: expect.stringMatching(/^\[ORDIVA TEST\]/),
      idempotencyKey: `ordiva/test/run-1/${draft.id}/v1`
    });
    expect(String((requests[0]?.body as { text?: string }).text)).toContain("NOT SENT TO THE SUPPLIER");
    expect(draft.status).toBe("approved");
    expect(draft.testStatus).toBe("sent");
    expect(draft.testRecipient).toBe("judge@outside.test");
    expect(draft.testMessageId).toBe("msg-1");
    expect(run.purchases[0].reason).toContain("signed-in user");
  });
});
