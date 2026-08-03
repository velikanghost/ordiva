import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../config.js";
import { AdapterRegistry } from "./adapter.registry.js";
import { ADAPTER_CONFIG, ADAPTER_FETCH } from "./adapters.tokens.js";

export interface VerifiedPayment {
  verified: boolean;
  payer: string;
  amount: string;
  network: string;
  transaction?: string;
}

@Injectable()
export class AdaptersService {
  constructor(
    @Inject(AdapterRegistry) private readonly registry: AdapterRegistry,
    @Inject(ADAPTER_CONFIG) private readonly config: AppConfig,
    @Inject(ADAPTER_FETCH) private readonly fetchImpl: typeof fetch
  ) {}

  async execute(id: string, input: unknown, payment?: VerifiedPayment) {
    const adapter = this.registry.get(id);
    const startedAt = performance.now();
    const data = adapter.outputSchema.parse(await adapter.execute(input, {
      config: this.config,
      fetch: this.fetchImpl
    }));
    const responseHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");

    return {
      requestId: randomUUID(),
      adapter: {
        operator: adapter.operator,
        id: adapter.id,
        upstreamProvider: adapter.upstreamProvider,
        capability: adapter.capability
      },
      payment: payment
        ? {
            verified: payment.verified,
            payer: payment.payer,
            amountBaseUnits: payment.amount,
            network: payment.network,
            settlementId: payment.transaction ?? null
          }
        : null,
      receipt: {
        responseHash: `sha256:${responseHash}`,
        latencyMs: Math.round(performance.now() - startedAt)
      },
      data
    };
  }
}
