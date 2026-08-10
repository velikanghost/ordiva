import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, UseFilters } from "@nestjs/common";
import type { Request } from "express";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AppConfig } from "../config.js";
import { ARC_TESTNET_CAIP2 } from "../config.js";
import { AdapterExceptionFilter } from "./adapter-exception.filter.js";
import { AdapterRegistry } from "./adapter.registry.js";
import { AdaptersService } from "./adapters.service.js";
import { ADAPTER_CONFIG } from "./adapters.tokens.js";

@Controller()
@UseFilters(AdapterExceptionFilter)
export class AdaptersController {
  constructor(
    @Inject(AdapterRegistry) private readonly registry: AdapterRegistry,
    @Inject(AdaptersService) private readonly adapters: AdaptersService,
    @Inject(ADAPTER_CONFIG) private readonly config: AppConfig
  ) {}

  @Get("v1/catalog")
  catalog() {
    return {
      operator: "ordiva",
      network: ARC_TESTNET_CAIP2,
      upstreamMode: this.config.ORDIVA_UPSTREAM_MODE,
      sellerAddress: this.config.ARC_ADAPTER_SELLER_ADDRESS,
      registryAddress: this.config.ARC_REGISTRY_ADDRESS ?? null,
      terms: "Arc Testnet x402 payment purchases access to an Ordiva-operated adapter backed by the disclosed conventional upstream.",
      adapters: this.registry.all().map((adapter) => ({
        id: adapter.id,
        method: adapter.method,
        path: adapter.path,
        capability: adapter.capability,
        upstreamProvider: adapter.upstreamProvider,
        description: adapter.description,
        price: adapter.price,
        configured: adapter.configured,
        inputSchema: zodToJsonSchema(adapter.inputSchema, { target: "openApi3" }),
        outputSchema: zodToJsonSchema(adapter.outputSchema, { target: "openApi3" })
      }))
    };
  }

  @Post("v1/suppliers/tavily-search")
  @HttpCode(HttpStatus.OK)
  tavily(@Req() request: Request) {
    return this.execute("tavily-search", request);
  }

  @Post("v1/suppliers/firecrawl-search")
  @HttpCode(HttpStatus.OK)
  firecrawlSearch(@Req() request: Request) {
    return this.execute("firecrawl-search", request);
  }

  @Post("v1/evidence/firecrawl-scrape")
  @HttpCode(HttpStatus.OK)
  firecrawlScrape(@Req() request: Request) {
    return this.execute("firecrawl-scrape", request);
  }

  @Post("v1/company/apollo-enrich")
  @HttpCode(HttpStatus.OK)
  apolloCompany(@Req() request: Request) {
    return this.execute("apollo-company-enrich", request);
  }

  @Post("v1/contacts/firecrawl-extract")
  @HttpCode(HttpStatus.OK)
  firecrawlContacts(@Req() request: Request) {
    return this.execute("firecrawl-contacts", request);
  }

  @Post("v1/email/resend-send")
  @HttpCode(HttpStatus.OK)
  resendEmail(@Req() request: Request) {
    return this.execute("resend-email", request);
  }

  private execute(id: string, request: Request) {
    return this.adapters.execute(id, request.body, request.payment);
  }
}
