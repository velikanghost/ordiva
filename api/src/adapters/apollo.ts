import { z } from "zod";
import type { AppConfig } from "../config.js";
import { requestJson } from "./http.js";
import type { AdapterDefinition } from "./types.js";

const companyInputSchema = z.object({
  domain: z.string().trim().toLowerCase().regex(/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/).optional(),
  name: z.string().trim().min(2).max(200).optional(),
  website: z.string().url().optional()
}).refine((value) => value.domain || value.name || value.website, "Provide domain, name, or website");

const companyOutputSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  estimatedEmployees: z.number().int().nullable(),
  foundedYear: z.number().int().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable()
});

const organizationSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  website_url: z.string().nullish(),
  industry: z.string().nullish(),
  estimated_num_employees: z.number().int().nullish(),
  founded_year: z.number().int().nullish(),
  phone: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish()
}).passthrough();

const companyRawSchema = z.object({ organization: organizationSchema.nullish() }).passthrough();

export function apolloAdapters(config: AppConfig): AdapterDefinition<unknown, unknown>[] {
  const configured = Boolean(config.APOLLO_API_KEY);
  return [
    {
      id: "apollo-company-enrich",
      operator: "ordiva",
      upstreamProvider: "Apollo",
      capability: "company_evidence",
      description: "Firmographic evidence for an identified supplier.",
      method: "POST",
      path: "/v1/company/apollo-enrich",
      price: config.PRICE_APOLLO_COMPANY,
      inputSchema: companyInputSchema,
      outputSchema: companyOutputSchema,
      configured,
      async execute(rawInput, context) {
        const input = companyInputSchema.parse(rawInput);
        const url = new URL("https://api.apollo.io/api/v1/organizations/enrich");
        if (input.domain) url.searchParams.set("domain", input.domain);
        if (input.name) url.searchParams.set("name", input.name);
        if (input.website) url.searchParams.set("website", input.website);
        const raw = await requestJson("Apollo", url, {
          method: "GET",
          headers: { "x-api-key": context.config.APOLLO_API_KEY!, accept: "application/json" }
        }, context.fetch);
        const organization = companyRawSchema.parse(raw).organization;
        return {
          id: organization?.id ?? null,
          name: organization?.name ?? null,
          website: organization?.website_url ?? null,
          industry: organization?.industry ?? null,
          estimatedEmployees: organization?.estimated_num_employees ?? null,
          foundedYear: organization?.founded_year ?? null,
          phone: organization?.phone ?? null,
          linkedinUrl: organization?.linkedin_url ?? null,
          city: organization?.city ?? null,
          country: organization?.country ?? null
        };
      }
    }
  ];
}
