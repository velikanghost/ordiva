import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { CircleDcwClient } from "../agent-wallet/circle-dcw.client.js";
import { AgentWalletService } from "../agent-wallet/agent-wallet.service.js";
import { ARC_TESTNET_CAIP2, type SourcingConfig } from "../config.js";
import { WalletsService } from "../wallets/wallets.service.js";
import type {
  ContractActivityType,
  RunContractActivity,
  SourcingRunDocument
} from "./run.schema.js";
import { RunsService } from "./runs.service.js";
import { SOURCING_CONFIG } from "./sourcing.tokens.js";

const FINAL_STATUS: Partial<Record<SourcingRunDocument["status"], number>> = {
  verified: 1,
  partially_verified: 2,
  verification_failed: 3,
  budget_exhausted: 4
};

/** Executes and records the optional OrdivaRegistry lifecycle on Arc Testnet. */
@Injectable()
export class RegistryActivityService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RegistryActivityService.name);
  private readonly queues = new Map<string, Promise<void>>();

  constructor(
    @Inject(SOURCING_CONFIG) private readonly config: SourcingConfig,
    @Inject(RunsService) private readonly runs: RunsService,
    @Inject(AgentWalletService) private readonly agentWallets: AgentWalletService,
    @Inject(WalletsService) private readonly wallets: WalletsService,
    @Inject(CircleDcwClient) private readonly circle: CircleDcwClient
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.ARC_REGISTRY_ADDRESS) return;
    const pending = await this.runs.resumeableContractActivities();
    for (const item of pending) {
      this.enqueue(item.runId, () => this.execute(item.runId, item.userId, item.activityId));
    }
  }

  /** Persist registration immediately, then submit it without delaying run creation. */
  async registerRun(runId: string, userId: string): Promise<void> {
    if (!this.config.ARC_REGISTRY_ADDRESS) return;
    const activity = await this.ensureActivity(runId, userId, "run_registered");
    if (!activity || activity.state === "confirmed" || activity.state === "failed") return;
    this.enqueue(runId, () => this.execute(runId, userId, activity.id));
  }

  /** Anchor the final purchase ledger and close the registered run in order. */
  async finalizeRun(runId: string, userId: string): Promise<void> {
    if (!this.config.ARC_REGISTRY_ADDRESS) return;
    await this.registerRun(runId, userId);
    const anchor = await this.ensureActivity(runId, userId, "ledger_anchored");
    const close = await this.ensureActivity(runId, userId, "run_closed");
    if (!anchor || !close) return;

    await this.enqueue(runId, async () => {
      await this.execute(runId, userId, anchor.id);
      await this.execute(runId, userId, close.id);
    });
  }

  /** Await this process's queued writes; used by shutdown hooks and focused tests. */
  async whenSettled(runId: string): Promise<void> {
    await this.queues.get(runId);
  }

  private async ensureActivity(
    runId: string,
    userId: string,
    type: ContractActivityType
  ): Promise<RunContractActivity | null> {
    const run = await this.runs.getOwned(runId, userId);
    const existing = (run.contractActivities ?? []).find((activity) => activity.type === type);
    if (existing) return existing;
    if (!this.config.ARC_REGISTRY_ADDRESS) return null;

    const now = new Date();
    const activity: RunContractActivity = {
      id: randomUUID(),
      type,
      state: "pending",
      network: ARC_TESTNET_CAIP2,
      contractAddress: this.config.ARC_REGISTRY_ADDRESS,
      idempotencyKey: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    await this.runs.addContractActivity(runId, activity);
    return activity;
  }

  private enqueue(runId: string, operation: () => Promise<void>): Promise<void> {
    const previous = this.queues.get(runId) ?? Promise.resolve();
    const task = previous
      .catch(() => undefined)
      .then(operation)
      .finally(() => {
        if (this.queues.get(runId) === task) this.queues.delete(runId);
      });
    this.queues.set(runId, task);
    return task;
  }

  private async execute(runId: string, userId: string, activityId: string): Promise<void> {
    const run = await this.runs.getOwned(runId, userId);
    const activity = (run.contractActivities ?? []).find((item) => item.id === activityId);
    if (!activity || activity.state === "confirmed" || activity.state === "failed") return;

    try {
      let transactionId = activity.circleTransactionId;
      if (!transactionId) {
        const call = await this.callFor(run, userId, activity.type);
        const submitted = await this.circle.createContractExecution({
          ...call,
          idempotencyKey: activity.idempotencyKey,
          refId: `ordiva:${activity.type}:${runId}`
        });
        transactionId = submitted.id;
        await this.runs.updateContractActivity(runId, activityId, {
          state: "submitted",
          circleTransactionId: transactionId,
          failureReason: undefined
        });
      }

      const confirmed = await this.circle.waitForTransactionHash(transactionId);
      await this.runs.updateContractActivity(runId, activityId, {
        state: "confirmed",
        circleTransactionId: transactionId,
        transactionHash: confirmed.txHash,
        failureReason: undefined
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registry transaction failed.";
      this.logger.warn(`Run ${runId}: ${activity.type} failed — ${message}`);
      await this.runs.updateContractActivity(runId, activityId, {
        state: "failed",
        failureReason: message
      });
    }
  }

  private async callFor(
    run: SourcingRunDocument,
    userId: string,
    type: ContractActivityType
  ): Promise<{
    walletId: string;
    contractAddress: string;
    abiFunctionSignature: string;
    abiParameters: Array<string | number | boolean>;
  }> {
    const [agent, owner] = await Promise.all([
      this.agentWallets.ensureForUser(userId),
      this.wallets.findByUserId(userId)
    ]);
    if (!owner) throw new Error("The run owner has no Arc wallet.");
    if (!this.config.ARC_REGISTRY_ADDRESS) throw new Error("OrdivaRegistry is not configured.");

    const runId = hash(String(run._id));
    const common = { walletId: agent.id, contractAddress: this.config.ARC_REGISTRY_ADDRESS };

    if (type === "run_registered") {
      return {
        ...common,
        abiFunctionSignature: "registerRun(bytes32,address,address,uint96,bytes32)",
        abiParameters: [runId, owner.address, agent.address, run.budgetMicros, policyHash(run)]
      };
    }

    const registration = (run.contractActivities ?? []).find(
      (activity) => activity.type === "run_registered" && activity.state === "confirmed"
    );
    if (!registration) throw new Error("Run registration was not confirmed on Arc.");

    if (type === "ledger_anchored") {
      return {
        ...common,
        abiFunctionSignature: "anchorLedger(bytes32,bytes32,uint96,uint32)",
        abiParameters: [runId, purchaseRoot(run), run.spentMicros, run.purchases.length]
      };
    }

    const anchored = (run.contractActivities ?? []).find(
      (activity) => activity.type === "ledger_anchored" && activity.state === "confirmed"
    );
    if (!anchored) throw new Error("The purchase ledger was not anchored on Arc.");
    const status = FINAL_STATUS[run.status];
    if (!status) throw new Error(`Run status ${run.status} cannot be closed onchain.`);
    return {
      ...common,
      abiFunctionSignature: "closeRun(bytes32,bytes32,uint8)",
      abiParameters: [runId, resultHash(run), status]
    };
  }
}

function hash(value: string): `0x${string}` {
  return `0x${createHash("sha256").update(value).digest("hex")}`;
}

function policyHash(run: SourcingRunDocument): `0x${string}` {
  return hash(JSON.stringify({
    goal: run.goal,
    budgetMicros: run.budgetMicros,
    network: ARC_TESTNET_CAIP2,
    seller: "ordiva-adapter-catalog"
  }));
}

function purchaseRoot(run: SourcingRunDocument): `0x${string}` {
  let nodes = run.purchases.map((purchase) => hash(JSON.stringify({
    adapterId: purchase.adapterId,
    reason: purchase.reason,
    priceMicros: purchase.priceMicros,
    outcome: purchase.outcome,
    settlement: purchase.settlement ?? null,
    transactionHash: purchase.transactionHash ?? null,
    responseHash: purchase.responseHash ?? null,
    createdAt: purchase.createdAt.toISOString()
  })));
  if (nodes.length === 0) return hash("ordiva:empty-purchase-ledger");

  while (nodes.length > 1) {
    const next: Array<`0x${string}`> = [];
    for (let index = 0; index < nodes.length; index += 2) {
      const left = nodes[index]!;
      const right = nodes[index + 1] ?? left;
      next.push(hash(`${left}${right.slice(2)}`));
    }
    nodes = next;
  }
  return nodes[0]!;
}

function resultHash(run: SourcingRunDocument): `0x${string}` {
  return hash(JSON.stringify({
    status: run.status,
    suppliers: run.suppliers.map((supplier) => ({
      id: supplier.id,
      verificationStatus: supplier.verificationStatus,
      evidence: supplier.evidence
    })),
    outreach: (run.outreach ?? []).map((item) => ({ id: item.id, status: item.status }))
  }));
}
