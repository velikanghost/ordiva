import type { SourcingConfig } from "../config.js";
import { firecrawlAdapters } from "../adapters/firecrawl.js";
import {
  supplierSearchResultSchema,
  type SupplierSearch
} from "./sourcing.schemas.js";

export function createFirecrawlSupplierSearch(
  config: SourcingConfig,
  customFetch: typeof fetch = fetch
): SupplierSearch {
  const adapter = firecrawlAdapters(config).find((candidate) => candidate.id === "firecrawl-search");
  if (!adapter?.configured) throw new Error("Firecrawl supplier search is not configured");

  return async (input) => supplierSearchResultSchema.parse(await adapter.execute(input, {
    config,
    fetch: customFetch
  }));
}
