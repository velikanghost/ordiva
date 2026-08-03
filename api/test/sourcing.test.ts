import { type CanActivate, type ExecutionContext, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionGuard } from "../src/auth/session.guard.js";
import { loadConfig, type SourcingConfig } from "../src/config.js";
import { SourcingController } from "../src/sourcing/sourcing.controller.js";
import type { SourcingPlan, SourcingPlanGenerator } from "../src/sourcing/sourcing.schemas.js";
import { SourcingService } from "../src/sourcing/sourcing.service.js";
import { SOURCING_CONFIG, SOURCING_PLAN_GENERATOR } from "../src/sourcing/sourcing.tokens.js";

const openApps: INestApplication[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

function config(): SourcingConfig {
  return {
    PORT: 4100,
    MONGODB_URI: "mongodb://127.0.0.1:27017/ordiva-test",
    AUTH_JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
    CIRCLE_API_KEY: "circle-test-key",
    CIRCLE_APP_ID: "circle-app-id",
    OPENAI_API_KEY: "openai-test-key",
    OPENAI_MODEL: "gpt-5.6",
    CIRCLE_WALLETS_API_URL: "https://api.circle.com",
    ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111",
    CIRCLE_GATEWAY_FACILITATOR_URL: "https://gateway-api-testnet.circle.com",
    EMAIL_ALLOWED_RECIPIENTS: "",
    EMAIL_ALLOWED_DOMAINS: "",
    PRICE_TAVILY_SEARCH: "$0.01",
    PRICE_FIRECRAWL_SEARCH: "$0.02",
    PRICE_FIRECRAWL_SCRAPE: "$0.02",
    PRICE_FIRECRAWL_CONTACT: "$0.05",
    PRICE_APOLLO_COMPANY: "$0.03",
    PRICE_RESEND_EMAIL: "$0.01"
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

class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().auth = {
      kind: "session",
      sub: "user-1",
      circleUserId: "circle-user-1"
    };
    return true;
  }
}

async function createApp(generator: SourcingPlanGenerator) {
  const builder = Test.createTestingModule({
    controllers: [SourcingController],
    providers: [
      { provide: SOURCING_CONFIG, useValue: config() },
      { provide: SOURCING_PLAN_GENERATOR, useValue: generator },
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
  it("accepts the existing OPENAI environment name as the API key", () => {
    const loaded = loadConfig({
      ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111",
      OPENAI: "openai-test-key"
    });

    expect(loaded.OPENAI_API_KEY).toBe("openai-test-key");
  });

  it("creates a plan while keeping payment and email unauthorized", async () => {
    const generator = vi.fn<SourcingPlanGenerator>().mockResolvedValue(generatedPlan);
    const app = await createApp(generator);

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
      status: "plan_ready",
      budget: { limit: "$0.25", spent: "$0.00" },
      nextAction: {
        type: "service_approval_required",
        adapterId: "firecrawl-search",
        provider: "Firecrawl",
        price: "$0.02",
        network: "eip155:5042002"
      },
      permissions: {
        paymentAuthorized: false,
        emailAuthorized: false
      }
    });
    expect(response.body.id).toMatch(/^run-[0-9a-f-]+$/);
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

  it("rejects a budget that cannot cover the deterministic first service", async () => {
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
});
