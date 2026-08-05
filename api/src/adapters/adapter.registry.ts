import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "../config.js";
import { createAdapters } from "./index.js";
import type { AdapterDefinition } from "./types.js";
import { ADAPTER_CONFIG } from "./adapters.tokens.js";

@Injectable()
export class AdapterRegistry {
  private readonly adapters: AdapterDefinition<unknown, unknown>[];

  constructor(@Inject(ADAPTER_CONFIG) config: AppConfig) {
    this.adapters = createAdapters(config).map((adapter) => ({
      ...adapter,
      configured: config.ORDIVA_UPSTREAM_MODE === "disabled" || adapter.configured
    }));
  }

  all(): readonly AdapterDefinition<unknown, unknown>[] {
    return this.adapters;
  }

  get(id: string): AdapterDefinition<unknown, unknown> {
    const adapter = this.adapters.find((candidate) => candidate.id === id);
    if (!adapter) throw new Error(`Unknown adapter: ${id}`);
    return adapter;
  }
}
