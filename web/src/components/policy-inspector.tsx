"use client";

import { Check, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";

const steps = [
  {
    id: "discovery",
    step: "STEP 1 · DISCOVERY",
    title: "Autonomous Multi-Query Search",
    cost: "$0.00 (Zero Charge)",
    badgeColor: "bg-success-wash text-success",
    description: "Firecrawl web search returns candidates across distinct supplier domains with zero wallet charge.",
    spec: {
      provider: "Firecrawl Search API",
      price: "$0.00 USDC",
      walletAuthorized: false,
      deduplication: "Domain-level unique filter",
      minCandidates: 3,
    },
  },
  {
    id: "verification",
    step: "STEP 2 · EVIDENCE VERIFICATION",
    title: "x402 Metered Adapter Execution",
    cost: "$0.01 - $0.05 USDC",
    badgeColor: "bg-violet-wash text-violet",
    description: "Deterministic budget check before requesting Arc Gateway signature for scraping or enrichment.",
    spec: {
      adapters: ["Tavily ($0.01)", "Firecrawl ($0.02)", "Apollo ($0.03)"],
      network: "Arc Testnet (eip155:5042002)",
      paymentProtocol: "x402 Micropayments",
      budgetLimit: "Max set by user per run",
    },
  },
  {
    id: "outreach",
    step: "STEP 3 · OUTREACH APPROVAL",
    title: "Recipient & Draft Inspection",
    cost: "Human Mandatory",
    badgeColor: "bg-canvas text-ink border border-line-strong",
    description: "Email outreach is never dispatched without explicit user review of the recipient, subject, and draft.",
    spec: {
      dispatchAdapter: "Resend Email ($0.01 USDC)",
      recipientValidation: "Any valid email address",
      signOffRequired: "One-click human approval",
      autoSend: "Blocked by default",
    },
  },
];

export function PolicyInspector() {
  const [activeTab, setActiveTab] = useState(0);
  const active = steps[activeTab];

  return (
    <div className="flex flex-col justify-between border-t border-line bg-canvas p-6 sm:p-8 lg:border-t-0 lg:p-10">
      <div>
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-violet" />
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              Interactive Execution Policy
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-wash px-2.5 py-1 text-xs font-semibold text-success pulse-badge">
            <Check className="size-3" /> Policy Active
          </span>
        </div>

        {/* Step Selector Tabs */}
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-[12px] border border-line bg-paper p-1">
          {steps.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`rounded-[9px] py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === idx
                  ? "bg-violet text-white shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              Step {idx + 1}
            </button>
          ))}
        </div>

        {/* Active Step Panel */}
        <div className="mt-5 rounded-[14px] border border-line bg-paper p-5 transition-all">
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span>{active.step}</span>
            <span className={`rounded-full px-2.5 py-0.5 font-mono ${active.badgeColor}`}>
              {active.cost}
            </span>
          </div>

          <h3 className="mt-3 text-base font-semibold text-ink">{active.title}</h3>
          <p className="mt-1.5 text-xs leading-5 text-muted">{active.description}</p>

          {/* Technical Spec Box */}
          <div className="mt-4 rounded-[10px] border border-line bg-canvas p-3.5 font-mono text-[11px] leading-5">
            <span className="block font-semibold text-muted uppercase tracking-wider text-[10px]">
              Deterministic Parameters
            </span>
            <div className="mt-2 space-y-1 text-ink">
              {Object.entries(active.spec).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-muted">{key}:</span>
                  <span className="font-semibold">{Array.isArray(val) ? val.join(", ") : String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex items-center gap-3 text-xs leading-5 text-muted">
          <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
          <span>Deterministic rules enforce network, exact prices, input validation, and response schemas.</span>
        </div>
      </div>
    </div>
  );
}
