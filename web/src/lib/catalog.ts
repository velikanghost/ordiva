import { apiJson } from "@/lib/api";

export interface AdapterCatalog {
  upstreamMode: "disabled" | "live";
  network: string;
  registryAddress: string | null;
  adapters: Array<{
    id: string;
    capability: string;
    upstreamProvider: string;
    price: string;
    configured: boolean;
  }>;
}

export function fetchCatalog(): Promise<AdapterCatalog> {
  return apiJson<AdapterCatalog>("/v1/catalog");
}
