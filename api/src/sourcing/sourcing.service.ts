import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException
} from "@nestjs/common";
import type { SourcingConfig } from "../config.js";
import { toMicros } from "../payments/money.js";
import { RunsService, type RunView } from "./runs.service.js";
import {
  createSourcingRunSchema,
  type CreateSourcingRunInput,
  type PlannedSourcingRun,
  type SourcingPlanGenerator,
  type SupplierCandidate,
  type SupplierSearch,
  type SupplierSearchResult
} from "./sourcing.schemas.js";
import {
  SOURCING_CONFIG,
  SOURCING_PLAN_GENERATOR,
  SOURCING_SUPPLIER_SEARCH
} from "./sourcing.tokens.js";
import { RegistryActivityService } from "./registry-activity.service.js";

@Injectable()
export class SourcingService {
  constructor(
    @Inject(SOURCING_CONFIG) private readonly config: SourcingConfig,
    @Inject(SOURCING_PLAN_GENERATOR) private readonly generatePlan: SourcingPlanGenerator,
    @Inject(SOURCING_SUPPLIER_SEARCH) private readonly searchSuppliers: SupplierSearch,
    @Inject(RunsService) private readonly runs: RunsService,
    @Optional() @Inject(RegistryActivityService) private readonly registry?: RegistryActivityService
  ) {}

  /**
   * Plan a run, discover candidates, and persist it.
   *
   * Persistence matters here rather than later: the run is the ledger every
   * subsequent purchase attaches to, and a receipt held only in the browser
   * proves nothing.
   *
   * @param userId - Owner of the run.
   * @param rawInput - Goal, budget, and candidate minimum.
   */
  async planAndPersist(userId: string, rawInput: CreateSourcingRunInput): Promise<RunView> {
    const planned = await this.plan(userId, rawInput);

    const run = await this.runs.create({
      userId,
      goal: planned.goal,
      supplierMinimum: planned.supplierMinimum,
      budgetMicros: toMicros(planned.budget.limit).toString(),
      spentMicros: "0",
      status: "research_ready",
      plan: planned.plan,
      suppliers: planned.suppliers.map((supplier) => ({
        ...supplier,
        verified: false,
        verificationStatus: "unverified" as const,
        evidence: [],
        contacts: []
      })),
      purchases: [],
      outreach: [],
      contractActivities: [],
      verificationAttempts: 0,
      research: {
        provider: planned.research.provider,
        queriesExecuted: planned.research.queriesExecuted,
        creditsUsed: planned.research.creditsUsed
      }
    });
    await this.registry?.registerRun(run.id, userId);
    return run;
  }

  async plan(userId: string, rawInput: CreateSourcingRunInput): Promise<PlannedSourcingRun> {
    const input = createSourcingRunSchema.parse(rawInput);
    if (toMicros(input.budget) < toMicros(this.config.PRICE_FIRECRAWL_SCRAPE)) {
      throw new BadRequestException(
        `Budget must cover the first paid evidence check (${this.config.PRICE_FIRECRAWL_SCRAPE} USDC)`
      );
    }
    if (this.config.ORDIVA_UPSTREAM_MODE === "disabled") {
      return this.mockPlan(input);
    }

    let plan;
    try {
      plan = await this.generatePlan({ userId, ...input });
    } catch {
      throw new ServiceUnavailableException("The sourcing plan could not be prepared. Please try again.");
    }
    const firstQuery = plan.searchQueries[0];
    if (!firstQuery) {
      throw new ServiceUnavailableException("The sourcing plan could not be prepared. Please try again.");
    }

    const searched: Array<{ query: string; result: SupplierSearchResult }> = [];
    const initialQueries = plan.searchQueries.slice(0, 3);
    const initialResults = await Promise.allSettled(initialQueries.map(async (query) => ({
      query,
      result: await this.searchSuppliers({ query, limit: 10, country: "NL" })
    })));
    searched.push(...initialResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));

    let suppliers = this.uniqueSuppliers(searched, input.supplierMinimum);
    if (suppliers.length < input.supplierMinimum) {
      const remainingResults = await Promise.allSettled(plan.searchQueries.slice(3).map(async (query) => ({
        query,
        result: await this.searchSuppliers({ query, limit: 10, country: "NL" })
      })));
      searched.push(...remainingResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
      suppliers = this.uniqueSuppliers(searched, input.supplierMinimum);
    }

    if (suppliers.length < input.supplierMinimum) {
      throw new ServiceUnavailableException(
        `Supplier discovery returned fewer than ${input.supplierMinimum} distinct candidates. Refine the goal and try again.`
      );
    }

    const credits = searched.map(({ result }) => result.creditsUsed);
    const knownCredits = credits.filter((credit): credit is number => credit !== null);

    return {
      id: `run-${randomUUID()}`,
      status: "research_ready",
      goal: input.goal,
      supplierMinimum: input.supplierMinimum,
      budget: {
        limit: `$${input.budget}`,
        spent: "$0.00"
      },
      plan,
      suppliers,
      research: {
        provider: "Firecrawl",
        queriesExecuted: searched.length,
        creditsUsed: knownCredits.length === credits.length
          ? knownCredits.reduce((total, credit) => total + credit, 0)
          : null,
        arcPayment: null
      },
      nextAction: {
        type: "supplier_verification_automatic",
        description: "Automatically verify public evidence for discovered candidates before outreach",
        supplierCount: suppliers.length
      },
      permissions: {
        paymentAuthorized: false,
        emailAuthorized: false
      }
    };
  }

  /**
   * Deduplicate discovery results by domain, keeping only as many as the run asked for.
   *
   * Capped at `limit` because every extra candidate costs three paid evidence
   * checks at verification. Discovering more than the operator requested would
   * spend their budget on work they did not ask for.
   *
   * @param searches - Raw results from each executed query.
   * @param limit - Maximum candidates to keep.
   */
  private uniqueSuppliers(
    searches: Array<{ query: string; result: SupplierSearchResult }>,
    limit: number
  ): SupplierCandidate[] {
    const byDomain = new Map<string, SupplierCandidate>();
    for (const search of searches) {
      for (const result of search.result.results) {
        const url = new URL(result.url);
        const domain = url.hostname.toLowerCase().replace(/^www\./, "");
        if (byDomain.has(domain)) continue;
        const name = result.title.split(/[|–—]/)[0]?.trim() || domain;
        byDomain.set(domain, {
          id: createHash("sha256").update(domain).digest("hex").slice(0, 16),
          name: name.slice(0, 160),
          url: result.url,
          domain,
          description: (result.description.trim() || "Supplier candidate discovered from the public web.").slice(0, 500),
          sourceQuery: search.query
        });
      }
    }
    return [...byDomain.values()].slice(0, limit);
  }

  private mockPlan(input: CreateSourcingRunInput): PlannedSourcingRun {
    const goalSummary = input.goal.length > 80 ? `${input.goal.slice(0, 80)}...` : input.goal;
    const queryStem = input.goal.slice(0, 35).trim();
    return {
      id: `run-${randomUUID()}`,
      status: "research_ready",
      goal: input.goal,
      supplierMinimum: input.supplierMinimum,
      budget: {
        limit: `$${input.budget}`,
        spent: "$0.00"
      },
      plan: {
        summary: `Sourcing plan for "${goalSummary}". Autonomous discovery identifies candidates before evidence purchase.`,
        searchQueries: [
          `${queryStem} supplier manufacturer`,
          `${queryStem} ISO certified supplier`,
          `${queryStem} distributor quotation`
        ],
        supplierRequirements: [
          "Verified business entity and active domain",
          "Capability matching requested product specification",
          "Export / delivery capabilities for target region"
        ],
        evidenceRequirements: [
          "Public catalog or technical spec sheet URL",
          "ISO or industry quality accreditation details"
        ],
        outreachQuestions: [
          "What is your standard lead time for a pilot order?",
          "Can you provide volume pricing for trial quantities?"
        ]
      },
      suppliers: [
        {
          id: "mock-sup-1",
          name: "Aster Fiberworks & Pump Systems",
          url: "https://aster-fiberworks.example",
          domain: "aster-fiberworks.example",
          description: "Leading industrial pump manufacturer specializing in chemical and marine fluid handling solutions in Rotterdam.",
          sourceQuery: `${queryStem} supplier manufacturer`
        },
        {
          id: "mock-sup-2",
          name: "Northline Fluid Solutions",
          url: "https://northline-pulp.example",
          domain: "northline-pulp.example",
          description: "Custom industrial pump assemblies and high-pressure fluid displacement equipment.",
          sourceQuery: `${queryStem} ISO certified supplier`
        },
        {
          id: "mock-sup-3",
          name: "Morrow Engineering BV",
          url: "https://morrow-formed.example",
          domain: "morrow-formed.example",
          description: "Rotterdam-based industrial pump distributor and certified OEM service provider.",
          sourceQuery: `${queryStem} distributor quotation`
        }
      ],
      research: {
        provider: "Firecrawl",
        queriesExecuted: 3,
        creditsUsed: 3,
        arcPayment: null
      },
      nextAction: {
        type: "supplier_verification_automatic",
        description: "Automatically verify public evidence for discovered candidates before outreach",
        supplierCount: 3
      },
      permissions: {
        paymentAuthorized: false,
        emailAuthorized: false
      }
    };
  }
}
