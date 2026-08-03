import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ARC_TESTNET_CAIP2, type SourcingConfig } from "../config.js";
import {
  createSourcingRunSchema,
  type CreateSourcingRunInput,
  type PlannedSourcingRun,
  type SourcingPlanGenerator
} from "./sourcing.schemas.js";
import { SOURCING_CONFIG, SOURCING_PLAN_GENERATOR } from "./sourcing.tokens.js";

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
    @Inject(SOURCING_PLAN_GENERATOR) private readonly generatePlan: SourcingPlanGenerator
  ) {}

  async plan(userId: string, rawInput: CreateSourcingRunInput): Promise<PlannedSourcingRun> {
    const input = createSourcingRunSchema.parse(rawInput);
    if (toMicros(input.budget) < toMicros(this.config.PRICE_FIRECRAWL_SEARCH)) {
      throw new BadRequestException(
        `Budget must cover the first supplier search (${this.config.PRICE_FIRECRAWL_SEARCH} USDC)`
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

    return {
      id: `run-${randomUUID()}`,
      status: "plan_ready",
      goal: input.goal,
      supplierMinimum: input.supplierMinimum,
      budget: {
        limit: `$${input.budget}`,
        spent: "$0.00"
      },
      plan,
      nextAction: {
        type: "service_approval_required",
        adapterId: "firecrawl-search",
        provider: "Firecrawl",
        price: this.config.PRICE_FIRECRAWL_SEARCH,
        network: ARC_TESTNET_CAIP2,
        description: "Search for supplier candidates using the first planned query",
        input: {
          query: firstQuery,
          limit: Math.max(6, input.supplierMinimum * 2)
        }
      },
      permissions: {
        paymentAuthorized: false,
        emailAuthorized: false
      }
    };
  }
}
