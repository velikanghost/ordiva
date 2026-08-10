import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap
} from "@nestjs/common";
import { AgentWalletService } from "../agent-wallet/agent-wallet.service.js";
import { ARC_TESTNET_CAIP2, type SourcingConfig } from "../config.js";
import type { PurchaseOutcome, PurchaseRequest } from "../payments/arc-buyer.service.js";
import type { ArcPaymentSigner } from "../payments/arc-signer.js";
import { SOURCING_BUYER_FACTORY } from "./sourcing.tokens.js";
import type { SpendPolicy } from "../payments/budget.policy.js";
import { toMicros } from "../payments/money.js";
import type { RunPurchase, RunSupplier } from "./run.schema.js";
import { RunsService, type RunView } from "./runs.service.js";
import { SOURCING_CONFIG } from "./sourcing.tokens.js";
import { RegistryActivityService } from "./registry-activity.service.js";

/** The buying capability verification needs, narrowed so tests can supply a fake. */
export interface EvidenceBuyer {
  purchase(request: PurchaseRequest): Promise<PurchaseOutcome>;
}

/** Builds a buyer bound to a particular agent wallet's signer. */
export type BuyerFactory = (signer: ArcPaymentSigner) => EvidenceBuyer;

/** One paid evidence check the agent can run against a candidate. */
interface EvidenceStep {
  readonly adapterId: string;
  readonly path: string;
  readonly price: (config: SourcingConfig) => string;
  readonly reason: (supplier: RunSupplier) => string;
  readonly body: (supplier: RunSupplier) => unknown;
  /** Pull a human-readable note out of the adapter response for the ledger. */
  readonly evidence: (data: unknown) => string | null;
  readonly contacts?: (data: unknown) => string[];
}

const EVIDENCE_STEPS: readonly EvidenceStep[] = [
  {
    adapterId: "firecrawl-scrape",
    path: "/v1/evidence/firecrawl-scrape",
    price: (config) => config.PRICE_FIRECRAWL_SCRAPE,
    reason: (supplier) => `Confirm ${supplier.domain} is a live site describing real capability`,
    body: (supplier) => ({ url: supplier.url }),
    evidence: (data) => {
      const title = readString(data, "title");
      return title ? `Site reachable — "${title}"` : "Site reachable";
    }
  },
  {
    adapterId: "apollo-company-enrich",
    path: "/v1/company/apollo-enrich",
    price: (config) => config.PRICE_APOLLO_COMPANY,
    reason: (supplier) => `Establish that ${supplier.domain} is a registered company`,
    body: (supplier) => ({ domain: supplier.domain }),
    evidence: (data) => {
      const name = readString(data, "name");
      const industry = readString(data, "industry");
      if (!name) return null;
      return industry ? `Registered as ${name} (${industry})` : `Registered as ${name}`;
    }
  },
  {
    adapterId: "firecrawl-contacts",
    path: "/v1/contacts/firecrawl-extract",
    price: (config) => config.PRICE_FIRECRAWL_CONTACT,
    reason: (supplier) => `Find a public contact route for ${supplier.domain}`,
    body: (supplier) => ({ url: supplier.url }),
    evidence: (data) => {
      const contacts = readArray(data, "contacts");
      return contacts.length > 0 ? `${contacts.length} public contact route(s) found` : null;
    },
    contacts: (data) => readArray(data, "contacts")
      .map((item) => readString(item, "email"))
      .filter((email): email is string => Boolean(email))
  }
];

const VERIFICATION_LEASE_MS = 10 * 60 * 1000;
const REQUIRED_EVIDENCE = new Set(["firecrawl-scrape", "apollo-company-enrich"]);

/**
 * Runs the paid evidence stage of a sourcing run.
 *
 * This is the part of the product where the agent spends money with no human
 * present. It is deliberately mechanical: which purchases are permitted, in what
 * order, and against what budget is decided by code, not by the model.
 */
@Injectable()
export class VerificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(VerificationService.name);

  /** Verifications running in this process, keyed by run id. */
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(
    @Inject(SOURCING_CONFIG) private readonly config: SourcingConfig,
    @Inject(RunsService) private readonly runs: RunsService,
    @Inject(AgentWalletService) private readonly agentWallets: AgentWalletService,
    @Inject(SOURCING_BUYER_FACTORY) private readonly createBuyer: BuyerFactory,
    @Optional() @Inject(RegistryActivityService) private readonly registry?: RegistryActivityService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const jobs = await this.runs.resumeableVerifications();
    for (const job of jobs) this.schedule(job.id, job.userId);
  }

  /**
   * Begin verification and return immediately.
   *
   * Buying evidence for every candidate takes tens of seconds to minutes — far
   * longer than an HTTP proxy will hold a connection open, and longer than most
   * serverless request limits. So the work runs in the background and the caller
   * polls `GET /v1/runs/:id`, which also lets the ledger fill in progressively
   * instead of appearing all at once at the end.
   *
   * @param runId - Run to verify.
   * @param userId - Authenticated owner.
   */
  async startVerification(runId: string, userId: string): Promise<RunView> {
    const run = await this.runs.getOwned(runId, userId);

    if (run.status === "verified") return this.runs.view(runId, userId);
    const claimed = await this.runs.claimVerification(
      runId,
      userId,
      new Date(Date.now() + VERIFICATION_LEASE_MS)
    );
    if (!claimed) throw new ConflictException("This run is already being verified");

    this.schedule(runId, userId);
    return this.runs.view(runId, userId);
  }

  private schedule(runId: string, userId: string): void {
    if (this.inFlight.has(runId)) return;
    const task = this.runEvidencePurchases(runId, userId)
      .catch((error: unknown) => {
        this.logger.error(
          `Run ${runId}: verification aborted — ${error instanceof Error ? error.message : String(error)}`
        );
        // Automatic verification has no human checkpoint to return to. Record a
        // terminal failure instead of leaving the run looking ready for a click.
        return this.runs.setStatus(runId, "verification_failed");
      })
      .finally(() => this.inFlight.delete(runId));

    this.inFlight.set(runId, task);
  }

  /**
   * Wait for an in-flight verification to finish.
   *
   * Resolves immediately when nothing is running for the run. Lets callers that
   * genuinely need completion — tests, and an orderly shutdown — observe it,
   * without the HTTP path having to wait.
   *
   * @param runId - Run to wait on.
   */
  async whenSettled(runId: string): Promise<void> {
    await this.inFlight.get(runId);
  }

  /**
   * Buy evidence for every candidate until the run is verified or the budget stops it.
   *
   * @param runId - Run being verified.
   * @param userId - Owner, used to resolve the agent wallet.
   */
  private async runEvidencePurchases(runId: string, userId: string): Promise<void> {
    const run = await this.runs.getOwned(runId, userId);
    const agent = await this.agentWallets.ensureForUser(userId);
    const buyer = this.createBuyer(this.agentWallets.signerFor(agent));

    let spentMicros = BigInt(run.spentMicros);
    const budgetMicros = BigInt(run.budgetMicros);
    let stoppedForBudget = false;
    let verifiedCount = 0;

    for (const supplier of run.suppliers) {
      if (stoppedForBudget) break;
      const evidence: string[] = [];
      const contacts: string[] = [];
      const successful = new Set<string>();

      for (const step of EVIDENCE_STEPS) {
        const existing = (run.purchases ?? []).find((purchase) =>
          purchase.supplierId === supplier.id &&
          purchase.adapterId === step.adapterId &&
          purchase.outcome === "settled"
        );
        if (existing) {
          successful.add(step.adapterId);
          continue;
        }
        const priceMicros = toMicros(step.price(this.config));

        const outcome = await buyer.purchase({
          adapterId: step.adapterId,
          url: new URL(step.path, this.config.ORDIVA_SELF_URL).toString(),
          body: step.body(supplier),
          reason: step.reason(supplier),
          policy: this.policy(budgetMicros, spentMicros, step.adapterId)
        });

        await this.runs.recordPurchase(
          runId,
          this.toLedgerEntry(step, supplier, priceMicros, outcome)
        );
        await this.runs.renewVerificationLease(
          runId,
          new Date(Date.now() + VERIFICATION_LEASE_MS)
        );

        if (outcome.status === "settled") {
          spentMicros += outcome.receipt.amountMicros;
          const data = unwrapAdapterData(outcome.data);
          const note = step.evidence(data);
          if (note) evidence.push(note);
          contacts.push(...(step.contacts?.(data) ?? []));
          successful.add(step.adapterId);
          continue;
        }

        if (outcome.status === "declined") {
          // The gate refuses only for policy reasons; an exhausted budget means
          // every remaining purchase would be refused too, so stop cleanly.
          this.logger.log(`Run ${runId}: declined ${step.adapterId} — ${outcome.reason}`);
          stoppedForBudget = true;
          break;
        }

        this.logger.warn(`Run ${runId}: ${step.adapterId} failed — ${outcome.reason}`);
      }

      const hasRequiredEvidence = [...REQUIRED_EVIDENCE].every((id) => successful.has(id));
      const status = hasRequiredEvidence
        ? "verified"
        : successful.size > 0
          ? "insufficient_evidence"
          : "failed";
      if (status === "verified") verifiedCount += 1;
      await this.runs.setSupplierVerification(runId, supplier.id, {
        status,
        evidence,
        contacts: [...new Set(contacts)]
      });
    }

    const required = run.supplierMinimum ?? run.suppliers.length;
    const finalStatus = stoppedForBudget
      ? "budget_exhausted"
      : verifiedCount >= required
        ? "verified"
        : verifiedCount > 0
          ? "partially_verified"
          : "verification_failed";
    await this.runs.setStatus(runId, finalStatus);
    await this.registry?.finalizeRun(runId, userId);
  }

  /**
   * Build the spend authority for a single purchase.
   *
   * Scoped to one adapter at a time so a run can never buy a capability its
   * current step did not call for.
   *
   * @param budgetMicros - Total authorised for the run.
   * @param spentMicros - Committed so far.
   * @param adapterId - The only adapter this purchase may use.
   */
  private policy(budgetMicros: bigint, spentMicros: bigint, adapterId: string): SpendPolicy {
    return {
      budgetMicros,
      spentMicros,
      allowedAdapterIds: new Set([adapterId]),
      sellerAddress: this.config.ARC_ADAPTER_SELLER_ADDRESS,
      network: ARC_TESTNET_CAIP2
    };
  }

  /**
   * Convert a purchase outcome into its ledger entry.
   *
   * @param step - The evidence step attempted.
   * @param supplier - Candidate the evidence concerns.
   * @param priceMicros - Quoted price.
   * @param outcome - What happened.
   */
  private toLedgerEntry(
    step: EvidenceStep,
    supplier: RunSupplier,
    priceMicros: bigint,
    outcome: PurchaseOutcome
  ): RunPurchase {
    const base = {
      adapterId: step.adapterId,
      reason: step.reason(supplier),
      supplierId: supplier.id,
      priceMicros: priceMicros.toString(),
      createdAt: new Date()
    };

    if (outcome.status === "settled") {
      return {
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
    }

    if (outcome.status === "declined") {
      return { ...base, outcome: "declined", failureReason: outcome.reason };
    }

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

/**
 * Unwrap the adapter envelope to reach the upstream payload.
 *
 * Paid routes answer with `{ requestId, adapter, payment, receipt, data }`; the
 * evidence we care about lives under `data`, not at the top level.
 *
 * @param body - The adapter response body.
 */
function unwrapAdapterData(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const envelope = body as Record<string, unknown>;
  return "data" in envelope ? envelope.data : body;
}

/**
 * Read a string field from an unknown adapter response.
 *
 * @param data - Parsed adapter response.
 * @param key - Field to read.
 */
function readString(data: unknown, key: string): string | null {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Read an array field from an unknown adapter response.
 *
 * @param data - Parsed adapter response.
 * @param key - Field to read.
 */
function readArray(data: unknown, key: string): unknown[] {
  if (!data || typeof data !== "object") return [];
  const value = (data as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}
