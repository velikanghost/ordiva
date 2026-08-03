import type { z } from "zod";
import type { AppConfig } from "../config.js";

export type Capability = "supplier_search" | "company_evidence" | "contact_discovery" | "email_send";

export interface AdapterContext {
  config: AppConfig;
  fetch: typeof fetch;
}

export interface AdapterDefinition<Input, Output> {
  id: string;
  operator: "ordiva";
  upstreamProvider: string;
  capability: Capability;
  description: string;
  method: "POST";
  path: string;
  price: string;
  inputSchema: z.ZodType<Input, z.ZodTypeDef, unknown>;
  outputSchema: z.ZodType<Output, z.ZodTypeDef, unknown>;
  configured: boolean;
  preflight?(input: Input): void;
  execute(input: Input, context: AdapterContext): Promise<Output>;
}

export class PreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PreflightError";
  }
}
