import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap
} from "@nestjs/common";
import { AgentWalletService } from "../agent-wallet/agent-wallet.service.js";
import { ARC_TESTNET_CAIP2, type SourcingConfig } from "../config.js";
import type { PurchaseOutcome } from "../payments/arc-buyer.service.js";
import type { SpendPolicy } from "../payments/budget.policy.js";
import { toMicros } from "../payments/money.js";
import type { RunOutreach, RunPurchase } from "./run.schema.js";
import { RunsService, type RunView } from "./runs.service.js";
import { SOURCING_BUYER_FACTORY, SOURCING_CONFIG } from "./sourcing.tokens.js";
import type { BuyerFactory } from "./verification.service.js";

const OUTREACH_LEASE_MS = 5 * 60 * 1000;

@Injectable()
export class OutreachService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OutreachService.name);
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    @Inject(SOURCING_CONFIG) private readonly config: SourcingConfig,
    @Inject(RunsService) private readonly runs: RunsService,
    @Inject(AgentWalletService) private readonly agentWallets: AgentWalletService,
    @Inject(SOURCING_BUYER_FACTORY) private readonly createBuyer: BuyerFactory
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const jobs = await this.runs.resumeableOutreach();
    for (const job of jobs) this.schedule(job.runId, job.userId, job.outreachId);
  }

  async createDrafts(runId: string, userId: string): Promise<RunView> {
    const run = await this.runs.getOwned(runId, userId);
    if (run.outreach?.length) return this.runs.view(runId, userId);

    const now = new Date();
    const drafts: RunOutreach[] = run.suppliers.flatMap((supplier) => {
      const recipient = supplier.contacts?.[0];
      if (!supplier.verified || !recipient) return [];
      const id = randomUUID();
      const subject = `Request for quotation — ${run.goal.slice(0, 90)}`;
      const questions = run.plan.outreachQuestions.map((question) => `- ${question}`).join("\n");
      const text = [
        `Hello ${supplier.name} team,`,
        "",
        `We are sourcing against the following requirement: ${run.goal}`,
        "",
        "Please provide a quotation and address these questions:",
        questions,
        "",
        "Please include pricing, minimum order quantity, lead time, and delivery terms.",
        "",
        "Regards,",
        "Ordiva sourcing operator"
      ].join("\n");
      return [{
        id,
        supplierId: supplier.id,
        recipient,
        subject,
        text,
        version: 1,
        contentHash: contentHash(runId, id, supplier.id, recipient, subject, text, 1),
        status: "draft" as const,
        attempts: 0,
        createdAt: now,
        updatedAt: now
      }];
    });

    if (!drafts.length) {
      throw new BadRequestException("No verified supplier has a public contact available for outreach");
    }
    await this.runs.saveOutreachDrafts(runId, drafts);
    return this.runs.view(runId, userId);
  }

  async updateDraft(
    runId: string,
    outreachId: string,
    userId: string,
    input: { recipient: string; subject: string; text: string }
  ): Promise<RunView> {
    const run = await this.runs.getOwned(runId, userId);
    const draft = run.outreach?.find((item) => item.id === outreachId);
    if (!draft) throw new NotFoundException("Outreach draft not found");
    if (["queued", "sending", "sent"].includes(draft.status)) {
      throw new ConflictException("This outreach can no longer be edited");
    }
    const version = draft.version + 1;
    await this.runs.updateOutreach(runId, outreachId, {
      ...input,
      version,
      contentHash: contentHash(runId, outreachId, draft.supplierId, input.recipient, input.subject, input.text, version),
      status: "draft",
      approvedHash: undefined,
      approvedAt: undefined,
      failureReason: undefined
    });
    return this.runs.view(runId, userId);
  }

  async approve(runId: string, outreachId: string, userId: string, expectedHash: string): Promise<RunView> {
    const run = await this.runs.getOwned(runId, userId);
    const draft = run.outreach?.find((item) => item.id === outreachId);
    if (!draft) throw new NotFoundException("Outreach draft not found");
    if (draft.status !== "draft" && draft.status !== "failed") {
      throw new ConflictException("Only a draft can be approved");
    }
    if (draft.contentHash !== expectedHash) {
      throw new ConflictException("The draft changed before approval; review the latest version");
    }
    await this.runs.updateOutreach(runId, outreachId, {
      status: "approved",
      approvedHash: draft.contentHash,
      approvedAt: new Date(),
      failureReason: undefined
    });
    return this.runs.view(runId, userId);
  }

  async send(runId: string, outreachId: string, userId: string): Promise<RunView> {
    const run = await this.runs.getOwned(runId, userId);
    const draft = run.outreach?.find((item) => item.id === outreachId);
    if (!draft) throw new NotFoundException("Outreach draft not found");
    if (draft.status === "sent") return this.runs.view(runId, userId);
    if (draft.status !== "approved" || draft.approvedHash !== draft.contentHash) {
      throw new ConflictException("Approve this exact draft before sending it");
    }
    await this.runs.updateOutreach(runId, outreachId, { status: "queued", failureReason: undefined });
    this.schedule(runId, userId, outreachId);
    return this.runs.view(runId, userId);
  }

  async sendTest(runId: string, outreachId: string, userId: string, verifiedEmail: string): Promise<RunView> {
    const run = await this.runs.getOwned(runId, userId);
    const draft = run.outreach?.find((item) => item.id === outreachId);
    if (!draft) throw new NotFoundException("Outreach draft not found");
    if (draft.status !== "approved" || draft.approvedHash !== draft.contentHash) {
      throw new ConflictException("Approve this exact draft before sending a test");
    }

    const testRecipient = verifiedEmail.trim().toLowerCase();
    await this.runs.updateOutreach(runId, outreachId, {
      testStatus: "sending",
      testVersion: draft.version,
      testRecipient,
      testMessageId: undefined,
      testFailureReason: undefined,
      testSentAt: undefined
    });

    const subject = `[ORDIVA TEST] ${draft.subject}`.slice(0, 200);
    const text = [
      "ORDIVA DEMONSTRATION COPY — NOT SENT TO THE SUPPLIER",
      `This test was delivered only to your verified sign-in address (${testRecipient}).`,
      `The real RFQ remains approved for ${draft.recipient} and has not been sent.`,
      "",
      "--- Approved RFQ preview ---",
      "",
      draft.text
    ].join("\n").slice(0, 10_000);
    const idempotencyKey = `ordiva/test/${runId}/${outreachId}/v${draft.version}`;
    const body = {
      to: testRecipient,
      subject,
      text,
      idempotencyKey
    };
    const agent = await this.agentWallets.ensureForUser(userId);
    const buyer = this.createBuyer(this.agentWallets.signerFor(agent));
    const priceMicros = toMicros(this.config.PRICE_RESEND_EMAIL);
    let outcome: PurchaseOutcome;
    try {
      outcome = await buyer.purchase({
        adapterId: "resend-email",
        url: new URL("/v1/email/resend-send", this.config.ORDIVA_SELF_URL).toString(),
        body,
        reason: `Send RFQ v${draft.version} test copy to the signed-in user`,
        policy: this.policy(BigInt(run.budgetMicros), BigInt(run.spentMicros))
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.runs.updateOutreach(runId, outreachId, { testStatus: "failed", testFailureReason: reason });
      throw error;
    }

    await this.runs.recordPurchase(runId, this.ledgerEntry(draft, priceMicros, outcome, {
      reason: `Send RFQ v${draft.version} test copy to the signed-in user`
    }));
    if (outcome.status !== "settled") {
      await this.runs.updateOutreach(runId, outreachId, {
        testStatus: "failed",
        testFailureReason: outcome.reason
      });
      return this.runs.view(runId, userId);
    }

    const data = unwrapAdapterData(outcome.data);
    await this.runs.updateOutreach(runId, outreachId, {
      testStatus: "sent",
      testMessageId: readString(data, "messageId") ?? undefined,
      testFailureReason: undefined,
      testSentAt: new Date()
    });
    return this.runs.view(runId, userId);
  }

  async whenSettled(outreachId: string): Promise<void> {
    await this.inFlight.get(outreachId);
  }

  private schedule(runId: string, userId: string, outreachId: string): void {
    if (this.inFlight.has(outreachId)) return;
    const task = this.deliver(runId, userId, outreachId)
      .catch(async (error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Outreach ${outreachId}: ${reason}`);
        await this.runs.updateOutreach(runId, outreachId, { status: "failed", failureReason: reason });
      })
      .finally(() => this.inFlight.delete(outreachId));
    this.inFlight.set(outreachId, task);
  }

  private async deliver(runId: string, userId: string, outreachId: string): Promise<void> {
    const claimed = await this.runs.claimOutreach(
      runId,
      outreachId,
      new Date(Date.now() + OUTREACH_LEASE_MS)
    );
    if (!claimed) return;

    const run = await this.runs.getOwned(runId, userId);
    const draft = run.outreach.find((item) => item.id === outreachId);
    if (!draft) throw new NotFoundException("Outreach draft not found");
    if (draft.approvedHash !== draft.contentHash) throw new ConflictException("Outreach approval is stale");

    const agent = await this.agentWallets.ensureForUser(userId);
    const buyer = this.createBuyer(this.agentWallets.signerFor(agent));
    const priceMicros = toMicros(this.config.PRICE_RESEND_EMAIL);
    const outcome = await buyer.purchase({
      adapterId: "resend-email",
      url: new URL("/v1/email/resend-send", this.config.ORDIVA_SELF_URL).toString(),
      body: {
        to: draft.recipient,
        subject: draft.subject,
        text: draft.text,
        idempotencyKey: `ordiva/${runId}/${outreachId}/v${draft.version}`
      },
      reason: `Send user-approved RFQ v${draft.version} to ${draft.recipient}`,
      policy: this.policy(BigInt(run.budgetMicros), BigInt(run.spentMicros))
    });

    await this.runs.recordPurchase(runId, this.ledgerEntry(draft, priceMicros, outcome));
    if (outcome.status !== "settled") {
      await this.runs.updateOutreach(runId, outreachId, {
        status: "failed",
        failureReason: outcome.reason
      });
      return;
    }

    const data = unwrapAdapterData(outcome.data);
    await this.runs.updateOutreach(runId, outreachId, {
      status: "sent",
      messageId: readString(data, "messageId") ?? undefined,
      failureReason: undefined,
      leaseUntil: undefined
    });
  }

  private policy(budgetMicros: bigint, spentMicros: bigint): SpendPolicy {
    return {
      budgetMicros,
      spentMicros,
      allowedAdapterIds: new Set(["resend-email"]),
      sellerAddress: this.config.ARC_ADAPTER_SELLER_ADDRESS,
      network: ARC_TESTNET_CAIP2
    };
  }

  private ledgerEntry(
    draft: RunOutreach,
    quotedMicros: bigint,
    outcome: PurchaseOutcome,
    override?: { reason: string }
  ): RunPurchase {
    const base = {
      adapterId: "resend-email",
      supplierId: draft.supplierId,
      reason: override?.reason ?? `Send user-approved RFQ v${draft.version} to ${draft.recipient}`,
      priceMicros: quotedMicros.toString(),
      createdAt: new Date()
    };
    if (outcome.status === "settled") return {
      ...base,
      outcome: "settled",
      priceMicros: outcome.receipt.amountMicros.toString(),
      settlement: outcome.receipt.settlement,
      transactionHash: outcome.receipt.transactionHash,
      payer: outcome.receipt.payer,
      network: outcome.receipt.network,
      responseHash: outcome.responseHash,
      latencyMs: outcome.latencyMs
    };
    if (outcome.status === "declined") return { ...base, outcome: "declined", failureReason: outcome.reason };
    return {
      ...base,
      outcome: "failed",
      failureReason: outcome.reason,
      latencyMs: outcome.latencyMs,
      settlement: outcome.receipt?.settlement,
      transactionHash: outcome.receipt?.transactionHash,
      payer: outcome.receipt?.payer,
      network: outcome.receipt?.network
    };
  }
}

export function contentHash(
  runId: string,
  outreachId: string,
  supplierId: string,
  recipient: string,
  subject: string,
  text: string,
  version: number
): string {
  return createHash("sha256")
    .update(JSON.stringify({ runId, outreachId, supplierId, recipient, subject, text, version }))
    .digest("hex");
}

function unwrapAdapterData(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  return "data" in body ? (body as Record<string, unknown>).data : body;
}

function readString(data: unknown, key: string): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
