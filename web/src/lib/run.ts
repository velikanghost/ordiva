const RUN_KEY_PREFIX = "ordiva.run.v1.";

export interface PlannedSourcingRun {
  id: string;
  status: "research_ready";
  goal: string;
  supplierMinimum: number;
  budget: {
    limit: string;
    spent: "$0.00";
  };
  plan: {
    summary: string;
    searchQueries: string[];
    supplierRequirements: string[];
    evidenceRequirements: string[];
    outreachQuestions: string[];
  };
  suppliers: Array<{
    id: string;
    name: string;
    url: string;
    domain: string;
    description: string;
    sourceQuery: string;
  }>;
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

export function savePlannedRun(run: PlannedSourcingRun): void {
  sessionStorage.setItem(`${RUN_KEY_PREFIX}${run.id}`, JSON.stringify(run));
}

export function readPlannedRun(runId: string): PlannedSourcingRun | null {
  const value = sessionStorage.getItem(`${RUN_KEY_PREFIX}${runId}`);
  if (!value) return null;
  try {
    const run = JSON.parse(value) as Partial<PlannedSourcingRun>;
    if (
      run.id !== runId ||
      run.status !== "research_ready" ||
      !run.plan ||
      !run.nextAction ||
      !Array.isArray(run.suppliers) ||
      !run.research
    ) return null;
    return run as PlannedSourcingRun;
  } catch {
    sessionStorage.removeItem(`${RUN_KEY_PREFIX}${runId}`);
    return null;
  }
}
