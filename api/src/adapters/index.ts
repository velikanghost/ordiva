import type { AppConfig } from "../config.js";
import type { AdapterDefinition } from "./types.js";
import { apolloAdapters } from "./apollo.js";
import { firecrawlAdapters } from "./firecrawl.js";
import { resendAdapter } from "./resend.js";
import { tavilyAdapter } from "./tavily.js";

export function createAdapters(config: AppConfig): AdapterDefinition<unknown, unknown>[] {
  return [
    tavilyAdapter(config) as AdapterDefinition<unknown, unknown>,
    ...firecrawlAdapters(config),
    ...apolloAdapters(config),
    resendAdapter(config) as AdapterDefinition<unknown, unknown>
  ];
}
