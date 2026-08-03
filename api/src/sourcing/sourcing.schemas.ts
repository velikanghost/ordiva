import { z } from "zod";

export const createSourcingRunSchema = z.object({
  goal: z.string().trim().min(10).max(800),
  budget: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/),
  supplierMinimum: z.coerce.number().int().min(3).max(10).default(3)
}).strict();

export const sourcingPlanSchema = z.object({
  summary: z.string().trim().min(20).max(500),
  searchQueries: z.array(z.string().trim().min(8).max(180)).min(3).max(5),
  supplierRequirements: z.array(z.string().trim().min(3).max(180)).min(2).max(8),
  evidenceRequirements: z.array(z.string().trim().min(3).max(180)).min(1).max(6),
  outreachQuestions: z.array(z.string().trim().min(3).max(180)).min(1).max(6)
}).strict();

export type CreateSourcingRunInput = z.infer<typeof createSourcingRunSchema>;
export type SourcingPlan = z.infer<typeof sourcingPlanSchema>;

export interface SourcingPlanGeneratorInput extends CreateSourcingRunInput {
  userId: string;
}

export type SourcingPlanGenerator = (input: SourcingPlanGeneratorInput) => Promise<SourcingPlan>;

export const supplierSearchResultSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    description: z.string()
  })),
  searchId: z.string().nullable(),
  creditsUsed: z.number().int().nonnegative().nullable()
});

export type SupplierSearchResult = z.infer<typeof supplierSearchResultSchema>;
export type SupplierSearch = (input: {
  query: string;
  limit: number;
  country: string;
}) => Promise<SupplierSearchResult>;

export interface SupplierCandidate {
  id: string;
  name: string;
  url: string;
  domain: string;
  description: string;
  sourceQuery: string;
}

export interface PlannedSourcingRun {
  id: string;
  status: "research_ready";
  goal: string;
  supplierMinimum: number;
  budget: {
    limit: string;
    spent: "$0.00";
  };
  plan: SourcingPlan;
  suppliers: SupplierCandidate[];
  research: {
    provider: "Firecrawl";
    queriesExecuted: number;
    creditsUsed: number | null;
    arcPayment: null;
  };
  nextAction: {
    type: "supplier_verification_pending";
    description: string;
    supplierCount: number;
  };
  permissions: {
    paymentAuthorized: false;
    emailAuthorized: false;
  };
}
