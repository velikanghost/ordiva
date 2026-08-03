import { Module, type DynamicModule } from "@nestjs/common";
import type { SourcingConfig } from "../config.js";
import { createOpenAIPlanGenerator } from "./openai-plan.generator.js";
import { SourcingController } from "./sourcing.controller.js";
import type { SourcingPlanGenerator } from "./sourcing.schemas.js";
import { SourcingService } from "./sourcing.service.js";
import { SOURCING_CONFIG, SOURCING_PLAN_GENERATOR } from "./sourcing.tokens.js";

export interface SourcingModuleOptions {
  config: SourcingConfig;
  fetch?: typeof fetch;
  generator?: SourcingPlanGenerator;
}

@Module({})
export class SourcingModule {
  static register(options: SourcingModuleOptions): DynamicModule {
    return {
      module: SourcingModule,
      controllers: [SourcingController],
      providers: [
        { provide: SOURCING_CONFIG, useValue: options.config },
        {
          provide: SOURCING_PLAN_GENERATOR,
          useValue: options.generator ?? createOpenAIPlanGenerator(options.config, options.fetch)
        },
        SourcingService
      ]
    };
  }
}
