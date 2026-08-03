const RUN_KEY_PREFIX = "ordiva.run.v1.";

export interface PlannedSourcingRun {
  id: string;
  status: "plan_ready";
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

export function savePlannedRun(run: PlannedSourcingRun): void {
  sessionStorage.setItem(`${RUN_KEY_PREFIX}${run.id}`, JSON.stringify(run));
}

export function readPlannedRun(runId: string): PlannedSourcingRun | null {
  const value = sessionStorage.getItem(`${RUN_KEY_PREFIX}${runId}`);
  if (!value) return null;
  try {
    const run = JSON.parse(value) as Partial<PlannedSourcingRun>;
    if (run.id !== runId || run.status !== "plan_ready" || !run.plan || !run.nextAction) return null;
    return run as PlannedSourcingRun;
  } catch {
    sessionStorage.removeItem(`${RUN_KEY_PREFIX}${runId}`);
    return null;
  }
}
