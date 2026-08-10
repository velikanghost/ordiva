import { Module, type DynamicModule } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AgentWalletModule } from "../agent-wallet/agent-wallet.module.js";
import { WalletsModule } from "../wallets/wallets.module.js";
import type { SourcingConfig } from "../config.js";
import { createOpenAIPlanGenerator } from "./openai-plan.generator.js";
import { createFirecrawlSupplierSearch } from "./firecrawl-supplier-search.js";
import { SourcingRun, SourcingRunSchema } from "./run.schema.js";
import { RunsService } from "./runs.service.js";
import { SourcingController } from "./sourcing.controller.js";
import type { SourcingPlanGenerator, SupplierSearch } from "./sourcing.schemas.js";
import { SourcingService } from "./sourcing.service.js";
import { VerificationService, type BuyerFactory } from "./verification.service.js";
import { OutreachService } from "./outreach.service.js";
import { RegistryActivityService } from "./registry-activity.service.js";
import { ArcBuyerService } from "../payments/arc-buyer.service.js";
import type { ArcPaymentSigner } from "../payments/arc-signer.js";
import {
  SOURCING_BUYER_FACTORY,
  SOURCING_CONFIG,
  SOURCING_PLAN_GENERATOR,
  SOURCING_SUPPLIER_SEARCH
} from "./sourcing.tokens.js";

export interface SourcingModuleOptions {
  config: SourcingConfig;
  fetch?: typeof fetch;
  generator?: SourcingPlanGenerator;
  supplierSearch?: SupplierSearch;
  buyerFactory?: BuyerFactory;
}

@Module({})
export class SourcingModule {
  static register(options: SourcingModuleOptions): DynamicModule {
    return {
      module: SourcingModule,
      imports: [
        MongooseModule.forFeature([{ name: SourcingRun.name, schema: SourcingRunSchema }]),
        AgentWalletModule.register({ config: options.config }),
        WalletsModule
      ],
      controllers: [SourcingController],
      providers: [
        { provide: SOURCING_CONFIG, useValue: options.config },
        {
          provide: SOURCING_PLAN_GENERATOR,
          useValue: options.generator ?? createOpenAIPlanGenerator(options.config, options.fetch)
        },
        {
          provide: SOURCING_SUPPLIER_SEARCH,
          useValue: options.supplierSearch ?? createFirecrawlSupplierSearch(options.config, options.fetch)
        },
        {
          provide: SOURCING_BUYER_FACTORY,
          useValue: options.buyerFactory ?? ((signer: ArcPaymentSigner) => new ArcBuyerService(signer))
        },
        RunsService,
        SourcingService,
        VerificationService,
        OutreachService,
        RegistryActivityService
      ]
    };
  }
}
