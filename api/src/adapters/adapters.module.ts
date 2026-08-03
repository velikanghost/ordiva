import {
  Inject,
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule
} from "@nestjs/common";
import type { AppConfig } from "../config.js";
import { AdapterRegistry } from "./adapter.registry.js";
import { adapterValidationMiddleware } from "./adapter-validation.middleware.js";
import { AdaptersController } from "./adapters.controller.js";
import { AdaptersService } from "./adapters.service.js";
import { ADAPTER_CONFIG, ADAPTER_FETCH, PAYMENT_GATE } from "./adapters.tokens.js";
import { createCirclePaymentGate, type PaymentGate } from "./x402.payment.js";

export interface AdaptersModuleOptions {
  config: AppConfig;
  fetch?: typeof fetch;
  paymentGate?: PaymentGate;
}

@Module({})
export class AdaptersModule implements NestModule {
  constructor(
    @Inject(AdapterRegistry) private readonly registry: AdapterRegistry,
    @Inject(PAYMENT_GATE) private readonly paymentGate: PaymentGate
  ) {}

  static register(options: AdaptersModuleOptions): DynamicModule {
    return {
      module: AdaptersModule,
      controllers: [AdaptersController],
      providers: [
        { provide: ADAPTER_CONFIG, useValue: options.config },
        { provide: ADAPTER_FETCH, useValue: options.fetch ?? fetch },
        {
          provide: PAYMENT_GATE,
          useValue: options.paymentGate ?? createCirclePaymentGate(options.config)
        },
        AdapterRegistry,
        AdaptersService
      ]
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    for (const adapter of this.registry.all()) {
      consumer
        .apply(adapterValidationMiddleware(adapter), this.paymentGate.require(adapter.price))
        .forRoutes({ path: adapter.path.slice(1), method: RequestMethod.POST });
    }
  }
}
