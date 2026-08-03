export type SupplierOutreachState = "ready" | "blocked" | "approved";

export interface SupplierResult {
  id: string;
  name: string;
  location: string;
  fit: "Strong" | "Review";
  evidence: string;
  sources: number;
  contact: string;
  outreach: SupplierOutreachState;
}

export const demoSuppliers: SupplierResult[] = [
  {
    id: "aster",
    name: "Aster Fiberworks",
    location: "Portugal",
    fit: "Strong",
    evidence: "ISO 9001 listed · pilot volume confirmed in public catalog",
    sources: 4,
    contact: "yoxago5578@amupx.com",
    outreach: "ready",
  },
  {
    id: "northline",
    name: "Northline Pulp Systems",
    location: "Poland",
    fit: "Strong",
    evidence: "Molded-fiber capability · export documentation found",
    sources: 3,
    contact: "yoxago5578@amupx.com",
    outreach: "ready",
  },
  {
    id: "morrow",
    name: "Morrow Formed Packaging",
    location: "Türkiye",
    fit: "Review",
    evidence: "Capability match · ISO certificate requires direct confirmation",
    sources: 2,
    contact: "supplier@example.invalid",
    outreach: "blocked",
  },
];
