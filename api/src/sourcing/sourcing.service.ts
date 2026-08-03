import { createHash, randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import type { SourcingConfig } from "../config.js";
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

function toMicros(value: string): bigint {
  const normalized = value.startsWith("$") ? value.slice(1) : value;
  const [whole, fraction = ""] = normalized.split(".");
  if (whole === undefined) throw new Error("Invalid USDC amount");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

@Injectable()
export class SourcingService {
  constructor(
    @Inject(SOURCING_CONFIG) private readonly config: SourcingConfig,
    @Inject(SOURCING_PLAN_GENERATOR) private readonly generatePlan: SourcingPlanGenerator,
    @Inject(SOURCING_SUPPLIER_SEARCH) private readonly searchSuppliers: SupplierSearch
  ) {}

  async plan(userId: string, rawInput: CreateSourcingRunInput): Promise<PlannedSourcingRun> {
    const input = createSourcingRunSchema.parse(rawInput);
    if (toMicros(input.budget) < toMicros(this.config.PRICE_FIRECRAWL_SCRAPE)) {
      throw new BadRequestException(
        `Budget must cover the first paid evidence check (${this.config.PRICE_FIRECRAWL_SCRAPE} USDC)`
      );
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

    let suppliers = this.uniqueSuppliers(searched);
    if (suppliers.length < input.supplierMinimum) {
      const remainingResults = await Promise.allSettled(plan.searchQueries.slice(3).map(async (query) => ({
        query,
        result: await this.searchSuppliers({ query, limit: 10, country: "NL" })
      })));
      searched.push(...remainingResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []));
      suppliers = this.uniqueSuppliers(searched);
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
        type: "supplier_verification_pending",
        description: "Verify public evidence for the discovered supplier candidates before outreach",
        supplierCount: suppliers.length
      },
      permissions: {
        paymentAuthorized: false,
        emailAuthorized: false
      }
    };
  }

  private uniqueSuppliers(searches: Array<{ query: string; result: SupplierSearchResult }>): SupplierCandidate[] {
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
    return [...byDomain.values()].slice(0, 10);
  }
}
