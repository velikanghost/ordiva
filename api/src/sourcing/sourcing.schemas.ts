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

export interface PlannedSourcingRun {
  id: string;
  status: "plan_ready";
  goal: string;
  supplierMinimum: number;
  budget: {
    limit: string;
    spent: "$0.00";
  };
  plan: SourcingPlan;
  nextAction: {
    type: "service_approval_required";
    adapterId: "firecrawl-search";
    provider: "Firecrawl";
    price: string;
    network: "eip155:5042002";
    description: string;
    input: {
      query: string;
      limit: number;
    };
  };
  permissions: {
    paymentAuthorized: false;
    emailAuthorized: false;
  };
}
