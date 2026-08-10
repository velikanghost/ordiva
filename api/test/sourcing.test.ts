import { type CanActivate, type ExecutionContext, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionGuard } from "../src/auth/session.guard.js";
import { loadConfig, type SourcingConfig } from "../src/config.js";
import { SourcingController } from "../src/sourcing/sourcing.controller.js";
import type {
  SourcingPlan,
  SourcingPlanGenerator,
  SupplierSearch
} from "../src/sourcing/sourcing.schemas.js";
import { SourcingService } from "../src/sourcing/sourcing.service.js";
import { RunsService } from "../src/sourcing/runs.service.js";
import { formatUsdcExact } from "../src/payments/money.js";
import type { SourcingRun } from "../src/sourcing/run.schema.js";
import { VerificationService } from "../src/sourcing/verification.service.js";
import { OutreachService } from "../src/sourcing/outreach.service.js";
import {
  SOURCING_CONFIG,
  SOURCING_PLAN_GENERATOR,
  SOURCING_SUPPLIER_SEARCH
} from "../src/sourcing/sourcing.tokens.js";

const openApps: INestApplication[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function config(overrides: Partial<SourcingConfig> = {}): SourcingConfig {
  return {
    PORT: 4100,
    ORDIVA_UPSTREAM_MODE: "live",
    MONGODB_URI: "mongodb://127.0.0.1:27017/ordiva-test",
    AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
    CIRCLE_API_KEY: "circle-test-key",
    CIRCLE_APP_ID: "circle-app-id",
    OPENAI_API_KEY: "openai-test-key",
    OPENAI_MODEL: "gpt-5.6",
    FIRECRAWL_API_KEY: "firecrawl-test-key",
    CIRCLE_ENTITY_SECRET: "a".repeat(64),
    CIRCLE_WALLET_SET_ID: "wallet-set-id",
    CIRCLE_WALLETS_API_URL: "https://api.circle.com",
    ARC_RPC_URL: "https://rpc.testnet.arc.network",
    ORDIVA_SELF_URL: "http://127.0.0.1:4100",
    USDC_ADDRESS: "0x3600000000000000000000000000000000000000",
    GATEWAY_WALLET_ADDRESS: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111",
    CIRCLE_GATEWAY_FACILITATOR_URL: "https://gateway-api-testnet.circle.com",
    PRICE_TAVILY_SEARCH: "$0.01",
    PRICE_FIRECRAWL_SEARCH: "$0.02",
    PRICE_FIRECRAWL_SCRAPE: "$0.02",
    PRICE_FIRECRAWL_CONTACT: "$0.05",
    PRICE_APOLLO_COMPANY: "$0.03",
    PRICE_RESEND_EMAIL: "$0.01",
    ...overrides
  };
}

const generatedPlan: SourcingPlan = {
  summary: "Find qualified manufacturers and collect evidence before any outreach is prepared.",
  searchQueries: [
    "industrial pump manufacturers Rotterdam Netherlands",
    "ISO certified centrifugal pump suppliers Rotterdam",
    "Rotterdam industrial pump OEM quotation supplier"
  ],
  supplierRequirements: ["Industrial pump manufacturer", "Serves Rotterdam"],
  evidenceRequirements: ["Company website and relevant product page"],
  outreachQuestions: ["What is your lead time for a pilot order?"]
};

function supplierSearch(): SupplierSearch {
  return vi.fn<SupplierSearch>()
    .mockResolvedValueOnce({
      results: [
        { title: "Pump One", url: "https://pump-one.example/products", description: "Industrial pump manufacturer" },
        { title: "Pump Two", url: "https://pump-two.example", description: "Centrifugal pumps" }
      ],
      searchId: "search-1",
      creditsUsed: 1
    })
    .mockResolvedValueOnce({
      results: [
        { title: "Pump One duplicate", url: "https://www.pump-one.example/about", description: "Duplicate company" },
        { title: "Pump Three", url: "https://pump-three.example", description: "Rotterdam supplier" }
      ],
      searchId: "search-2",
      creditsUsed: 1
    })
    .mockResolvedValue({ results: [], searchId: "search-3", creditsUsed: 1 });
}

class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().auth = {
      kind: "session",
      sub: "user-1",
      circleUserId: "circle-user-1",
      email: "buyer@example.com"
    };
    return true;
  }
}

async function createApp(
  generator: SourcingPlanGenerator,
  search: SupplierSearch = supplierSearch(),
  currentConfig: SourcingConfig = config()
) {
  // Persistence and the paid verification stage are exercised by their own suites;
  // here they are stubbed so these tests stay focused on planning and discovery.
  let persistedRun: Record<string, unknown> | null = null;
  const runs = {
    // Mirrors the shape `RunsService.create` returns, so assertions here still
    // describe the contract the browser actually receives.
    create: vi.fn(async (run: Omit<SourcingRun, "createdAt" | "updatedAt">) => {
      persistedRun = {
        id: "6a739b60e915db8c861f5af3",
        status: run.status,
        goal: run.goal,
        supplierMinimum: run.supplierMinimum,
        budget: {
          limit: formatUsdcExact(BigInt(run.budgetMicros)),
          spent: formatUsdcExact(0n),
          remaining: formatUsdcExact(BigInt(run.budgetMicros))
        },
        plan: run.plan,
        suppliers: run.suppliers,
        purchases: [],
        research: run.research,
        createdAt: new Date().toISOString()
      };
      return persistedRun;
    }),
    listForUser: vi.fn(async () => []),
    view: vi.fn(async () => null),
    getOwned: vi.fn(async () => null)
  };
  const verification = {
    startVerification: vi.fn(async () => {
      if (!persistedRun) throw new Error("Run was not persisted before verification");
      return { ...persistedRun, status: "verifying" };
    })
  };

  const builder = Test.createTestingModule({
    controllers: [SourcingController],
    providers: [
      { provide: SOURCING_CONFIG, useValue: currentConfig },
      { provide: SOURCING_PLAN_GENERATOR, useValue: generator },
      { provide: SOURCING_SUPPLIER_SEARCH, useValue: search },
      { provide: RunsService, useValue: runs },
      { provide: VerificationService, useValue: verification },
      { provide: OutreachService, useValue: {} },
      SourcingService
    ]
  });
  const module = await builder.overrideGuard(SessionGuard).useClass(AuthenticatedGuard).compile();
  const app = module.createNestApplication();
  await app.init();
  openApps.push(app);
  return app;
}

describe("OpenAI sourcing plan boundary", () => {
  it("defaults metered upstreams to disabled and permits an explicit live override in development", () => {
    const disabled = loadConfig({
      ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111"
    });
    const live = loadConfig({
      NODE_ENV: "development",
      ORDIVA_UPSTREAM_MODE: "live",
      ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111"
    });

    expect(disabled.ORDIVA_UPSTREAM_MODE).toBe("disabled");
    expect(live.ORDIVA_UPSTREAM_MODE).toBe("live");
  });

  it("accepts the existing OPENAI environment name as the API key", () => {
    const loaded = loadConfig({
      ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111",
      OPENAI: "openai-test-key"
    });

    expect(loaded.OPENAI_API_KEY).toBe("openai-test-key");
  });

  it("plans, discovers, and automatically schedules verification while keeping email unauthorized", async () => {
    const generator = vi.fn<SourcingPlanGenerator>().mockResolvedValue(generatedPlan);
    const search = supplierSearch();
    const app = await createApp(generator, search);

    const response = await request(app.getHttpServer())
      .post("/v1/runs/plan")
      .send({
        goal: "Find at least three industrial pump suppliers in Rotterdam",
        budget: "0.25",
        supplierMinimum: 3
      })
      .expect(201);

    expect(generator).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      supplierMinimum: 3
    }));
    expect(response.body).toMatchObject({
      status: "verifying",
      budget: { limit: "$0.250000", spent: "$0.000000", remaining: "$0.250000" },
      research: { provider: "Firecrawl", queriesExecuted: 3, creditsUsed: 3 }
    });
    expect(response.body.suppliers).toHaveLength(3);
    expect(response.body.suppliers.map((supplier: { domain: string }) => supplier.domain)).toEqual([
      "pump-one.example",
      "pump-two.example",
      "pump-three.example"
    ]);
    // Scheduling is immediate; candidates stay unverified until paid evidence arrives.
    expect(response.body.suppliers.every((supplier: { verified: boolean }) => !supplier.verified)).toBe(true);
    expect(response.body.purchases).toEqual([]);
    expect(search).toHaveBeenCalledTimes(3);
    expect(app.get(VerificationService).startVerification).toHaveBeenCalledWith(
      "6a739b60e915db8c861f5af3",
      "user-1"
    );
  });

  it("returns mock plan and candidate suppliers without calling OpenAI or Firecrawl when live upstreams are disabled", async () => {
    const generator = vi.fn<SourcingPlanGenerator>().mockResolvedValue(generatedPlan);
    const search = supplierSearch();
    const app = await createApp(generator, search, config({ ORDIVA_UPSTREAM_MODE: "disabled" }));

    const response = await request(app.getHttpServer())
      .post("/v1/runs/plan")
      .send({
        goal: "Find at least three industrial pump suppliers in Rotterdam",
        budget: "0.25",
        supplierMinimum: 3
      })
      .expect(201);

    expect(response.body.status).toBe("verifying");
    expect(response.body.suppliers).toHaveLength(3);
    expect(generator).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("keeps only as many candidates as the run asked for", async () => {
    // Discovery routinely returns far more than requested. Every extra candidate
    // costs three paid evidence checks, so the surplus must not reach the run.
    const generator = vi.fn<SourcingPlanGenerator>().mockResolvedValue(generatedPlan);
    const generous = vi.fn<SupplierSearch>().mockResolvedValue({
      results: Array.from({ length: 12 }, (_, index) => ({
        title: `Pump ${index}`,
        url: `https://pump-${index}.example`,
        description: "Industrial pump supplier"
      })),
      searchId: "search-wide",
      creditsUsed: 1
    });

    const response = await request((await createApp(generator, generous)).getHttpServer())
      .post("/v1/runs/plan")
      .send({ goal: "Find pump suppliers in Rotterdam", budget: "2", supplierMinimum: 3 })
      .expect(201);

    expect(response.body.suppliers).toHaveLength(3);
  });

  it("rejects fewer than three suppliers before calling the model", async () => {
    const generator = vi.fn<SourcingPlanGenerator>().mockResolvedValue(generatedPlan);
    const app = await createApp(generator);

    await request(app.getHttpServer())
      .post("/v1/runs/plan")
      .send({ goal: "Find pump suppliers in Rotterdam", budget: "0.25", supplierMinimum: 2 })
      .expect(400);

    expect(generator).not.toHaveBeenCalled();
  });

  it("rejects a budget that cannot cover the deterministic first paid evidence check", async () => {
    const generator = vi.fn<SourcingPlanGenerator>().mockResolvedValue(generatedPlan);
    const app = await createApp(generator);

    const response = await request(app.getHttpServer())
      .post("/v1/runs/plan")
      .send({ goal: "Find pump suppliers in Rotterdam", budget: "0.01", supplierMinimum: 3 })
      .expect(400);

    expect(response.body.message).toContain("$0.02");
    expect(generator).not.toHaveBeenCalled();
  });

  it("returns a recoverable error when plan generation fails", async () => {
    const generator = vi.fn<SourcingPlanGenerator>().mockRejectedValue(new Error("provider unavailable"));
    const app = await createApp(generator);

    const response = await request(app.getHttpServer())
      .post("/v1/runs/plan")
      .send({ goal: "Find pump suppliers in Rotterdam", budget: "0.25", supplierMinimum: 3 })
      .expect(503);

    expect(response.body.message).toContain("Please try again");
  });

  it("does not advance when autonomous discovery finds fewer than three distinct suppliers", async () => {
    const generator = vi.fn<SourcingPlanGenerator>().mockResolvedValue(generatedPlan);
    const search = vi.fn<SupplierSearch>().mockResolvedValue({
      results: [{ title: "Only Supplier", url: "https://only.example", description: "One result" }],
      searchId: "search-only",
      creditsUsed: 1
    });
    const app = await createApp(generator, search);

    const response = await request(app.getHttpServer())
      .post("/v1/runs/plan")
      .send({ goal: "Find pump suppliers in Rotterdam", budget: "0.25", supplierMinimum: 3 })
      .expect(503);

    expect(response.body.message).toContain("fewer than 3");
  });
});
