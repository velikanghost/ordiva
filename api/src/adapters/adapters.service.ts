import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../config.js";
import { AdapterRegistry } from "./adapter.registry.js";
import { ADAPTER_CONFIG, ADAPTER_FETCH } from "./adapters.tokens.js";
import { getMockAdapterOutput } from "./mock-fixtures.js";

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

    const rawData = this.config.ORDIVA_UPSTREAM_MODE === "disabled"
      ? getMockAdapterOutput(id, input)
      : await adapter.execute(input, {
          config: this.config,
          fetch: this.fetchImpl
        });

    const data = adapter.outputSchema.parse(rawData);
    const responseHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");

    const effectivePayment = payment ?? (
      this.config.ORDIVA_UPSTREAM_MODE === "disabled"
        ? {
            verified: true,
            payer: "0x0000000000000000000000000000000000000000",
            amount: "10000",
            network: "eip155:5042002",
            transaction: "mock-settlement-tx"
          }
        : undefined
    );

    return {
      requestId: randomUUID(),
      adapter: {
        operator: adapter.operator,
        id: adapter.id,
        upstreamProvider: adapter.upstreamProvider,
        capability: adapter.capability
      },
      payment: effectivePayment
        ? {
            verified: effectivePayment.verified,
            payer: effectivePayment.payer,
            amountBaseUnits: effectivePayment.amount,
            network: effectivePayment.network,
            settlementId: effectivePayment.transaction ?? null
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
