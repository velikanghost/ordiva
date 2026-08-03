import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { RequestHandler } from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module.js";
import type { AppConfig } from "../src/config.js";
import { createCirclePaymentGate, type PaymentGate } from "../src/adapters/x402.payment.js";

const openApps: INestApplication[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

async function createTestApp(options: {
  config: AppConfig;
  paymentGate: PaymentGate;
  fetch?: typeof fetch;
}): Promise<INestApplication> {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule.register(options)]
  }).compile();
  const app = testingModule.createNestApplication();
  await app.init();
  openApps.push(app);
  return app;
}

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    PORT: 4100,
    CIRCLE_WALLETS_API_URL: "https://api.circle.com",
    ARC_ADAPTER_SELLER_ADDRESS: "0x1111111111111111111111111111111111111111",
    CIRCLE_GATEWAY_FACILITATOR_URL: "https://gateway-api-testnet.circle.com",
    TAVILY_API_KEY: "tavily-test",
    FIRECRAWL_API_KEY: "firecrawl-test",
    APOLLO_API_KEY: "apollo-test",
    RESEND_API_KEY: "resend-test",
    RESEND_FROM_EMAIL: "Ordiva <demo@ordiva.test>",
    EMAIL_ALLOWED_RECIPIENTS: "supplier@example.com",
    EMAIL_ALLOWED_DOMAINS: "example.org",
    PRICE_TAVILY_SEARCH: "$0.01",
    PRICE_FIRECRAWL_SEARCH: "$0.02",
    PRICE_FIRECRAWL_SCRAPE: "$0.02",
    PRICE_FIRECRAWL_CONTACT: "$0.05",
    PRICE_APOLLO_COMPANY: "$0.03",
    PRICE_RESEND_EMAIL: "$0.01",
    ...overrides
  };
}

function paymentGate(onRequire = vi.fn()): PaymentGate {
  return {
    require(price: string): RequestHandler {
      return (req, _res, next) => {
        onRequire(price);
        req.payment = {
          verified: true,
          payer: "0x2222222222222222222222222222222222222222",
          amount: "10000",
          network: "eip155:5042002",
          transaction: "settlement-test"
        };
        next();
      };
    }
  };
}

describe("Arc adapter service", () => {
  it("publishes six disclosed Arc adapters", async () => {
    const app = await createTestApp({ config: config(), paymentGate: paymentGate() });
    const response = await request(app.getHttpServer()).get("/v1/catalog").expect(200);

    expect(response.body.network).toBe("eip155:5042002");
    expect(response.body.adapters).toHaveLength(6);
    expect(response.body.adapters.map((item: { upstreamProvider: string }) => item.upstreamProvider))
      .toEqual(expect.arrayContaining(["Tavily", "Firecrawl", "Apollo", "Resend"]));
  });

  it("issues a real Arc-only GatewayWalletBatched challenge", async () => {
    const currentConfig = config();
    const app = await createTestApp({
      config: currentConfig,
      paymentGate: createCirclePaymentGate(currentConfig)
    });

    const response = await request(app.getHttpServer())
      .post("/v1/suppliers/tavily-search")
      .send({ query: "industrial pump suppliers Rotterdam" })
      .expect(402);
    const encoded = response.headers["payment-required"];
    expect(encoded).toBeTypeOf("string");
    if (typeof encoded !== "string") throw new Error("Missing PAYMENT-REQUIRED header");
    const challenge = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));

    expect(challenge.resource.description).toBe("Ordiva conventional API adapter");
    expect(challenge.accepts).toHaveLength(1);
    expect(challenge.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "eip155:5042002",
      asset: "0x3600000000000000000000000000000000000000",
      amount: "10000",
      payTo: currentConfig.ARC_ADAPTER_SELLER_ADDRESS,
      extra: {
        name: "GatewayWalletBatched",
        version: "1",
        verifyingContract: "0x0077777d7eba4688bdef3e311b846f25870a19b9"
      }
    });
  });

  it("rejects an unavailable adapter before requesting payment", async () => {
    const charged = vi.fn();
    const app = await createTestApp({
      config: config({ TAVILY_API_KEY: undefined }),
      paymentGate: paymentGate(charged)
    });

    await request(app.getHttpServer())
      .post("/v1/suppliers/tavily-search")
      .send({ query: "industrial pump suppliers Rotterdam" })
      .expect(503);
    expect(charged).not.toHaveBeenCalled();
  });

  it("rejects invalid input before requesting payment", async () => {
    const charged = vi.fn();
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(charged) });

    await request(app.getHttpServer()).post("/v1/suppliers/tavily-search").send({ query: "x" }).expect(400);
    expect(charged).not.toHaveBeenCalled();
  });

  it("normalizes a paid Tavily response and emits a receipt", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      query: "industrial pump suppliers Rotterdam",
      request_id: "tavily-1",
      results: [{ title: "Pump BV", url: "https://pump.example", content: "Industrial pump supplier", score: 0.91 }]
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(), fetch: fetchMock });

    const response = await request(app.getHttpServer())
      .post("/v1/suppliers/tavily-search")
      .send({ query: "industrial pump suppliers Rotterdam" })
      .expect(200);

    expect(response.body.adapter).toMatchObject({ operator: "ordiva", upstreamProvider: "Tavily" });
    expect(response.body.payment).toMatchObject({ network: "eip155:5042002", settlementId: "settlement-test" });
    expect(response.body.receipt.responseHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(response.body.data.results[0].url).toBe("https://pump.example");
  });

  it("normalizes Firecrawl supplier discovery", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        web: [{ title: "Pump BV", url: "https://pump.example", description: "Industrial pump supplier" }]
      },
      id: "search-1",
      creditsUsed: 1
    }), { status: 200 }));
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(), fetch: fetchMock });

    const response = await request(app.getHttpServer())
      .post("/v1/suppliers/firecrawl-search")
      .send({ query: "industrial pump suppliers in Rotterdam", limit: 5, country: "NL" })
      .expect(200);

    expect(response.body.data).toEqual({
      results: [{ title: "Pump BV", url: "https://pump.example", description: "Industrial pump supplier" }],
      searchId: "search-1",
      creditsUsed: 1
    });
  });

  it("normalizes Firecrawl company evidence and bounds the returned content", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        markdown: "x".repeat(2_000),
        links: ["https://pump.example/about"],
        metadata: { sourceURL: "https://pump.example", title: "Pump BV", scrapeId: "scrape-1" }
      }
    }), { status: 200 }));
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(), fetch: fetchMock });

    const response = await request(app.getHttpServer())
      .post("/v1/evidence/firecrawl-scrape")
      .send({ url: "https://pump.example", maxCharacters: 1_000 })
      .expect(200);

    expect(response.body.data.markdown).toHaveLength(1_000);
    expect(response.body.data.truncated).toBe(true);
    expect(response.body.data.scrapeId).toBe("scrape-1");
  });

  it("normalizes Apollo company enrichment", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      organization: {
        id: "org-1",
        name: "Pump BV",
        website_url: "https://pump.example",
        industry: "Industrial Machinery",
        estimated_num_employees: 42,
        founded_year: 1998,
        city: "Rotterdam",
        country: "Netherlands"
      }
    }), { status: 200 }));
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(), fetch: fetchMock });

    const company = await request(app.getHttpServer())
      .post("/v1/company/apollo-enrich")
      .send({ domain: "pump.example" })
      .expect(200);
    expect(company.body.data).toMatchObject({ name: "Pump BV", estimatedEmployees: 42, city: "Rotterdam" });
  });

  it("extracts and deduplicates public contacts with Firecrawl", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        links: [
          { url: "https://pump.example/contact", title: "Contact" },
          { url: "https://pump.example/about", title: "About" }
        ]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          markdown: "Email sales@pump.example for quotations.",
          links: [],
          metadata: { sourceURL: "https://pump.example/contact", title: "Contact" }
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        data: {
          markdown: "Sales: SALES@pump.example. Support: help@pump.example",
          links: [],
          metadata: { sourceURL: "https://pump.example/about", title: "About" }
        }
      }), { status: 200 }));
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(), fetch: fetchMock });

    const response = await request(app.getHttpServer())
      .post("/v1/contacts/firecrawl-extract")
      .send({ url: "https://pump.example", maxPages: 2 })
      .expect(200);

    expect(response.body.data.pagesScanned).toHaveLength(2);
    expect(response.body.data.contacts).toEqual([
      { email: "sales@pump.example", sourceUrl: "https://pump.example/contact" },
      { email: "help@pump.example", sourceUrl: "https://pump.example/about" }
    ]);
  });

  it("rejects a non-allowlisted email before requesting payment", async () => {
    const charged = vi.fn();
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(charged) });

    await request(app.getHttpServer())
      .post("/v1/email/resend-send")
      .send({
        to: "stranger@outside.test",
        subject: "Request for quotation",
        text: "Please send a quotation.",
        idempotencyKey: "goal-1-supplier-1"
      })
      .expect(403);
    expect(charged).not.toHaveBeenCalled();
  });

  it("passes an idempotency key when sending an allowlisted email", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(), fetch: fetchMock });

    const response = await request(app.getHttpServer())
      .post("/v1/email/resend-send")
      .send({
        to: "supplier@example.com",
        subject: "Request for quotation",
        text: "Please send a quotation.",
        idempotencyKey: "goal-1-supplier-1"
      })
      .expect(200);

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get("idempotency-key")).toBe("goal-1-supplier-1");
    expect(response.body.data).toEqual({ messageId: "email-1", to: "supplier@example.com", accepted: true });
  });

  it("keeps the Arc receipt when a paid upstream request fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      message: "rate limited"
    }), { status: 429 }));
    const app = await createTestApp({ config: config(), paymentGate: paymentGate(), fetch: fetchMock });

    const response = await request(app.getHttpServer())
      .post("/v1/suppliers/tavily-search")
      .send({ query: "industrial pump suppliers Rotterdam" })
      .expect(502);

    expect(response.body).toMatchObject({
      error: "upstream_failed",
      provider: "Tavily",
      upstreamStatus: 429,
      retryable: true,
      payment: { network: "eip155:5042002", settlementId: "settlement-test" }
    });
  });
});
