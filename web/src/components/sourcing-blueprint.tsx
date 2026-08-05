"use client";

import { Check, Lock, Search, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";

const nodes = [
  {
    id: "discovery",
    step: "01",
    label: "Public Web Search",
    subtitle: "Firecrawl Multi-Query & Deduplication",
    cost: "$0.00",
    costBadge: "bg-success-wash text-success border-success/30",
    icon: Search,
    metrics: [
      { key: "Upstream", val: "Firecrawl Search API" },
      { key: "Cost", val: "$0.00 (Zero Charge)" },
      { key: "Filter", val: "Domain Deduplication" },
    ],
  },
  {
    id: "verification",
    step: "02",
    label: "x402 Micropayment Verification",
    subtitle: "Arc Adapter Metered Scraping & Enrichment",
    cost: "$0.02 USDC",
    costBadge: "bg-violet-wash text-violet border-violet/30",
    icon: Zap,
    metrics: [
      { key: "Protocol", val: "x402 Micropayments" },
      { key: "Network", val: "Arc Testnet (CAIP-2)" },
      { key: "Adapters", val: "Tavily / Firecrawl / Apollo" },
    ],
  },
  {
    id: "outreach",
    step: "03",
    label: "Human Email Approval",
    subtitle: "Recipient, Subject & Draft Sign-off",
    cost: "Human Required",
    costBadge: "bg-paper text-ink border-line-strong",
    icon: ShieldCheck,
    metrics: [
      { key: "Dispatch", val: "Resend Email Adapter" },
      { key: "Allowlist", val: "Enforced Allowlist Check" },
      { key: "Sign-Off", val: "One-Click Human Approval" },
    ],
  },
];

export function SourcingBlueprint() {
  const [activeNode, setActiveNode] = useState(0);

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-line bg-paper p-6 sm:p-8 shadow-ledger-lg">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-[0.12em] text-violet">
            Vector Architecture Schematic
          </span>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
            Agentic Sourcing & x402 Micropayment Flow
          </h3>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-wash px-3 py-1 font-semibold text-success shadow-ledger-sm">
            <span className="size-2 rounded-full bg-success pulse-badge" /> Arc Gateway Connected
          </span>
          <span className="hidden sm:inline-block text-muted">eip155:5042002</span>
        </div>
      </div>

      {/* Interactive Vector Flow Nodes */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3 relative">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isActive = activeNode === index;
          return (
            <div
              key={node.id}
              onClick={() => setActiveNode(index)}
              className={`group relative flex flex-col justify-between rounded-[14px] border p-6 transition-all cursor-pointer ${
                isActive
                  ? "border-violet bg-canvas shadow-violet-glow"
                  : "border-line bg-paper hover:border-violet/40 hover:shadow-ledger-md"
              }`}
            >
              <div>
                {/* Node Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`grid size-9 place-items-center rounded-lg font-mono text-xs font-bold transition-colors ${
                      isActive ? "bg-violet text-white" : "bg-violet-wash text-violet"
                    }`}
                  >
                    {node.step}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${node.costBadge}`}
                  >
                    {node.cost}
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-2.5">
                  <Icon className={`size-5 ${isActive ? "text-violet" : "text-ink"}`} />
                  <h4 className="text-base font-semibold tracking-[-0.02em]">{node.label}</h4>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted">{node.subtitle}</p>

                {/* Vector Micro Telemetry Table */}
                <div className="mt-5 space-y-2 rounded-lg border border-line/80 bg-paper p-3 font-mono text-[11px]">
                  {node.metrics.map((m) => (
                    <div key={m.key} className="flex items-center justify-between">
                      <span className="text-muted">{m.key}</span>
                      <span className="font-semibold text-ink">{m.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status footer */}
              <div className="mt-6 flex items-center justify-between border-t border-line/60 pt-4 text-xs">
                <span className="flex items-center gap-1.5 text-muted">
                  <Check className="size-3.5 text-success" /> Enforced by policy
                </span>
                <span className="font-mono text-[11px] text-violet font-semibold group-hover:translate-x-0.5 transition-transform">
                  Inspect &rarr;
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Telemetry Inspector Footer */}
      <div className="mt-8 rounded-[12px] border border-line bg-canvas p-5 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-line/80 pb-3">
          <span className="font-semibold text-ink uppercase tracking-wider text-[11px] flex items-center gap-2">
            <Lock className="size-3.5 text-success" /> Active Node Spec: {nodes[activeNode].label}
          </span>
          <span className="text-muted text-[11px]">Node {activeNode + 1} of 3</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 text-muted leading-5">
          <div>
            <span className="block text-[10px] uppercase text-muted">Execution Mode</span>
            <span className="font-semibold text-ink">{activeNode === 0 ? "Zero Charge Public Search" : activeNode === 1 ? "Metered Arc x402 Micropayment" : "Mandatory Human Review"}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted">Safety Guarantee</span>
            <span className="font-semibold text-ink">{activeNode === 0 ? "Zero Wallet Depletion" : activeNode === 1 ? "Strict User Budget Cap" : "No Auto-Email Dispatch"}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted">Evidence Verification</span>
            <span className="font-semibold text-ink">Deterministic Validation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
