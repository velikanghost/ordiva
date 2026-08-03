import Link from "next/link";
import { ArrowRight, Check, CircleDot, Lock, ShieldCheck } from "lucide-react";
import { SessionControls } from "@/components/session-controls";

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[16px] border border-line bg-paper">
        {/* Header */}
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-5 sm:px-8">
          <Link href="/" className="text-[1.15rem] font-semibold tracking-[-0.03em]">
            Ordiva
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-muted sm:flex">
              <CircleDot aria-hidden="true" className="size-4 text-success" /> Arc Testnet
            </span>
            <Link
              href="/app"
              className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-violet px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-dark"
            >
              Start sourcing run <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <SessionControls compact />
          </div>
        </header>

        {/* Hero Section */}
        <section className="grid min-h-[38rem] border-b border-line lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col justify-between gap-12 px-5 py-12 sm:px-8 lg:border-r lg:border-line lg:px-12 lg:py-16">
            <div className="max-w-3xl proof-enter">
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-wash px-3 py-1 text-xs font-semibold text-violet-dark">
                Agentic Sourcing on Arc
              </span>
              <h1 className="mt-6 text-balance max-w-[16ch] text-[clamp(2.6rem,5.5vw,5.2rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
                Your agent spends well, and you can see why.
              </h1>
              <p className="mt-7 max-w-[60ch] text-base leading-7 text-muted sm:text-lg">
                Delegate supplier research, evidence verification, and outreach to an autonomous agent on Arc — backed by deterministic policy and transparent on-chain micropayments.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/app"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[12px] bg-violet px-6 text-base font-semibold text-white transition-colors hover:bg-violet-dark"
                >
                  Start a sourcing run <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-13 items-center justify-center rounded-[12px] border border-line-strong bg-paper px-6 text-base font-semibold text-ink transition-colors hover:bg-ink hover:text-paper"
                >
                  How it works
                </a>
              </div>
            </div>

            <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted">Network</span>
                <span className="mt-1 block font-mono text-sm font-semibold">Arc Testnet (USDC)</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted">Payment Protocol</span>
                <span className="mt-1 font-mono text-sm font-semibold">x402 Micropayments</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted">Account Model</span>
                <span className="mt-1 font-mono text-sm font-semibold">Circle User EOA</span>
              </div>
            </div>
          </div>

          {/* Interactive Hero Technical Spec Panel */}
          <div className="flex flex-col justify-between border-t border-line bg-canvas p-6 sm:p-8 lg:border-t-0 lg:p-12">
            <div>
              <div className="flex items-center justify-between border-b border-line pb-4">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Live Execution Policy</span>
                <span className="rounded-full bg-success-wash px-2.5 py-1 text-xs font-semibold text-success">
                  Policy Active
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-[12px] border border-line bg-paper p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted">
                    <span>STEP 1 · DISCOVERY</span>
                    <span className="text-success">$0.00 (Zero Wallet Charge)</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    Autonomous multi-query search & candidate deduplication
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Firecrawl web search returns candidates across distinct supplier domains.
                  </p>
                </div>

                <div className="rounded-[12px] border border-line bg-paper p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted">
                    <span>STEP 2 · EVIDENCE VERIFICATION</span>
                    <span className="text-violet">$0.02 - $0.05 USDC</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    x402 Metered Adapter Execution
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Deterministic budget check before requesting Arc Gateway signature.
                  </p>
                </div>

                <div className="rounded-[12px] border border-line bg-paper p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted">
                    <span>STEP 3 · OUTREACH APPROVAL</span>
                    <span className="text-ink">Human Mandatory</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    Recipient & Draft Inspection
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Email is never dispatched without explicit user review.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <div className="flex items-center gap-3 text-xs leading-5 text-muted">
                <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
                <span>Deterministic rules enforce network, exact prices, allowlists, and response schemas.</span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="border-b border-line px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Autonomous research. Policy-controlled execution.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
              Ordiva separates agent judgment from financial authority. The model recommends what information is worth buying, while deterministic code enforces your budget.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <div className="flex flex-col justify-between rounded-[14px] border border-line bg-paper p-6 sm:p-8">
              <div>
                <span className="grid size-10 place-items-center rounded-full bg-canvas text-sm font-semibold">
                  1
                </span>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em]">Plan & Discover</h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Give the agent a real-world sourcing goal. OpenAI structures the research plan into multi-angle search queries. Candidate suppliers are discovered and deduplicated from the public web with zero charge to your wallet.
                </p>
              </div>
              <div className="mt-8 border-t border-line pt-4 text-xs font-semibold text-muted">
                Cost: Free public discovery
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[14px] border border-line bg-paper p-6 sm:p-8">
              <div>
                <span className="grid size-10 place-items-center rounded-full bg-canvas text-sm font-semibold">
                  2
                </span>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em]">Verify Evidence</h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  When evidence is needed, the agent calls conventional upstreams through Ordiva&apos;s Arc x402 adapters. Every scraping or enrichment call requires an on-chain micropayment that must strictly satisfy your pre-set budget limit.
                </p>
              </div>
              <div className="mt-8 border-t border-line pt-4 text-xs font-semibold text-muted">
                Cost: $0.01 - $0.05 USDC / call
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[14px] border border-line bg-paper p-6 sm:p-8">
              <div>
                <span className="grid size-10 place-items-center rounded-full bg-canvas text-sm font-semibold">
                  3
                </span>
                <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em]">Approve Outreach</h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  The agent prepares tailored RFQs for verified suppliers. Before an email can be sent, the exact recipient, subject line, and message draft are presented for your mandatory one-click human approval.
                </p>
              </div>
              <div className="mt-8 border-t border-line pt-4 text-xs font-semibold text-muted">
                Control: Mandatory human sign-off
              </div>
            </div>
          </div>
        </section>

        {/* Boundary / Architecture Spec Table */}
        <section className="border-b border-line px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <h2 className="text-3xl font-semibold tracking-[-0.03em]">
            Separating judgment from authority
          </h2>
          <p className="mt-3 max-w-[65ch] text-base leading-7 text-muted">
            Language models recommend what to investigate. Code enforces financial, network, and security boundaries.
          </p>

          <div className="mt-10 overflow-hidden rounded-[14px] border border-line bg-paper">
            <div className="grid border-b border-line bg-canvas text-xs font-semibold uppercase tracking-[0.1em] text-muted md:grid-cols-2">
              <div className="px-6 py-3.5 border-b border-line md:border-b-0 md:border-r">
                Agent Judgment (LLM)
              </div>
              <div className="px-6 py-3.5">
                Deterministic Authority (Backend Policy)
              </div>
            </div>

            <div className="divide-y divide-line text-sm leading-6">
              <div className="grid md:grid-cols-2">
                <div className="flex items-start gap-3 p-6 md:border-r md:border-line">
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-violet" />
                  <span>Constructs targeted search queries for niche supplier industries.</span>
                </div>
                <div className="flex items-start gap-3 p-6 bg-canvas/40">
                  <Lock aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
                  <span>Enforces maximum USDC budget limit per sourcing run.</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2">
                <div className="flex items-start gap-3 p-6 md:border-r md:border-line">
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-violet" />
                  <span>Identifies required certifications, lead times, and capacity requirements.</span>
                </div>
                <div className="flex items-start gap-3 p-6 bg-canvas/40">
                  <Lock aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
                  <span>Validates x402 payment headers, network CAIP-2, and exact seller addresses.</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2">
                <div className="flex items-start gap-3 p-6 md:border-r md:border-line">
                  <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-violet" />
                  <span>Drafts context-aware RFQ emails customized for candidate suppliers.</span>
                </div>
                <div className="flex items-start gap-3 p-6 bg-canvas/40">
                  <Lock aria-hidden="true" className="mt-1 size-4 shrink-0 text-success" />
                  <span>Checks recipient against tested email allowlists and blocks unauthorized sends.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Metered Arc Adapters Catalog Section */}
        <section className="border-b border-line px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.03em]">Disclosed Arc Adapters</h2>
              <p className="mt-2 text-sm text-muted">Conventional API upstreams accessible via Arc Testnet x402 micropayments</p>
            </div>
            <span className="font-mono text-xs text-muted">Network: eip155:5042002</span>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[12px] border border-line bg-paper p-5">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Tavily</span>
                <span className="font-mono font-semibold text-ink">$0.01 USDC</span>
              </div>
              <h3 className="mt-3 font-semibold">Web Search</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Supplier discovery and primary web source evidence.
              </p>
            </div>

            <div className="rounded-[12px] border border-line bg-paper p-5">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Firecrawl</span>
                <span className="font-mono font-semibold text-ink">$0.02 USDC</span>
              </div>
              <h3 className="mt-3 font-semibold">Website Scraping</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Bounded markdown extraction from supplier company pages.
              </p>
            </div>

            <div className="rounded-[12px] border border-line bg-paper p-5">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Apollo</span>
                <span className="font-mono font-semibold text-ink">$0.03 USDC</span>
              </div>
              <h3 className="mt-3 font-semibold">Company Enrichment</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Firmographics, employee counts, and location verification.
              </p>
            </div>

            <div className="rounded-[12px] border border-line bg-paper p-5">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Resend</span>
                <span className="font-mono font-semibold text-ink">$0.01 USDC</span>
              </div>
              <h3 className="mt-3 font-semibold">Email Dispatch</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Idempotent email outreach to tested allowlisted recipients.
              </p>
            </div>
          </div>
        </section>

        {/* Footer Banner */}
        <section className="flex flex-col items-center justify-between gap-6 px-5 py-12 text-center sm:px-8 lg:flex-row lg:px-12 lg:text-left">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              Ready to run your first budgeted sourcing job?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Start with free planning and public supplier discovery. Connect your Circle wallet when ready.
            </p>
          </div>
          <Link
            href="/app"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[12px] bg-violet px-6 text-base font-semibold text-white transition-colors hover:bg-violet-dark shrink-0"
          >
            Open Sourcing Workbench <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>
      </div>
    </main>
  );
}
