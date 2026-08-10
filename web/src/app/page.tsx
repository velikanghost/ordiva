import Link from "next/link";
import Image from "next/image";
import { Check, CircleDot, Lock, Search, ShieldAlert, MailCheck } from "lucide-react";
import { LandingAuthCta } from "@/components/landing-auth-cta";
import { PolicyInspector } from "@/components/policy-inspector";
import { SourcingBlueprint } from "@/components/sourcing-blueprint";

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px] overflow-hidden rounded-[16px] border border-line bg-paper shadow-ledger-lg">
        {/* Header */}
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-5 sm:px-8">
          <Link href="/" className="text-[1.15rem] font-semibold tracking-[-0.03em] flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-violet text-white font-mono text-sm font-bold shadow-ledger-sm">O</span>
            Ordiva
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-muted sm:flex">
              <CircleDot aria-hidden="true" className="size-4 text-success" /> Arc Testnet
            </span>
            <LandingAuthCta
              label="Connect wallet"
              icon="wallet"
              className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-violet px-4 text-sm font-semibold text-white transition-colors hover:bg-violet-dark shadow-ledger-sm"
            />
          </div>
        </header>

        {/* Hero Section */}
        <section className="grid min-h-[38rem] border-b border-line lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col justify-between gap-12 px-5 py-12 sm:px-8 lg:border-r lg:border-line lg:px-12 lg:py-16">
            <div className="max-w-3xl proof-enter">
              <h1 className="text-balance max-w-[16ch] text-[clamp(2.6rem,5.5vw,5.2rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
                Your agent spends well, and you can see why.
              </h1>
              <p className="mt-7 max-w-[60ch] text-base leading-7 text-muted sm:text-lg">
                Delegate supplier research, evidence verification, and outreach to an autonomous agent on Arc — backed by deterministic policy and transparent on-chain micropayments.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <LandingAuthCta
                  label="Start a sourcing run"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-[12px] bg-violet px-6 text-base font-semibold text-white transition-all hover:bg-violet-dark shadow-violet-glow"
                />
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-13 items-center justify-center rounded-[12px] border border-line-strong bg-paper px-6 text-base font-semibold text-ink transition-colors hover:bg-ink hover:text-paper shadow-ledger-sm"
                >
                  How it works
                </a>
              </div>
            </div>

            <div className="grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
              <div className="rounded-lg border border-line/60 bg-canvas/50 p-3 shadow-ledger-sm">
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted">Network</span>
                <span className="mt-1 block font-mono text-sm font-semibold">Arc Testnet (USDC)</span>
              </div>
              <div className="rounded-lg border border-line/60 bg-canvas/50 p-3 shadow-ledger-sm">
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted">Payment Protocol</span>
                <span className="mt-1 font-mono text-sm font-semibold">x402 Micropayments</span>
              </div>
              <div className="rounded-lg border border-line/60 bg-canvas/50 p-3 shadow-ledger-sm">
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-muted">Account Model</span>
                <span className="mt-1 font-mono text-sm font-semibold">Circle User EOA</span>
              </div>
            </div>
          </div>

          {/* Interactive Hero Technical Spec Panel */}
          <PolicyInspector />
        </section>

        {/* Hero Vector Architecture Diagram Showcase */}
        <section className="border-b border-line bg-canvas p-6 sm:p-10 lg:p-12">
          <SourcingBlueprint />
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="border-b border-line px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-violet">3-Step Execution Policy</span>
            <h2 className="mt-1 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Autonomous research. Policy-controlled execution.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
              Ordiva separates agent judgment from financial authority. The model recommends what information is worth buying, while deterministic code enforces your budget.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            {/* Step 1 */}
            <div className="flex flex-col justify-between overflow-hidden rounded-[14px] border border-line bg-paper shadow-ledger-md transition-all hover:border-violet/40">
              <div className="relative h-48 w-full border-b border-line bg-canvas overflow-hidden">
                <Image
                  src="/images/step-discovery.png"
                  alt="Step 1 Public Web Search & Discovery"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-full bg-violet-wash text-violet font-mono text-sm font-bold shadow-ledger-sm">
                    1
                  </span>
                  <span className="rounded-full bg-success-wash px-2.5 py-1 text-xs font-mono font-semibold text-success">
                    $0.00 Free
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] flex items-center gap-2">
                  <Search className="size-5 text-violet" /> Plan & Discover
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Give the agent a real-world sourcing goal. OpenAI structures the research plan into multi-angle search queries. Candidate suppliers are discovered and deduplicated from the public web with zero charge to your wallet.
                </p>
              </div>
              <div className="border-t border-line bg-canvas/40 px-6 py-3 text-xs font-semibold text-muted font-mono">
                Cost: Free public discovery
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col justify-between overflow-hidden rounded-[14px] border border-line bg-paper shadow-ledger-md transition-all hover:border-violet/40">
              <div className="relative h-48 w-full border-b border-line bg-canvas overflow-hidden">
                <Image
                  src="/images/step-verification.png"
                  alt="Step 2 Evidence Verification & x402 Micropayments"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-full bg-violet-wash text-violet font-mono text-sm font-bold shadow-ledger-sm">
                    2
                  </span>
                  <span className="rounded-full bg-violet-wash px-2.5 py-1 text-xs font-mono font-semibold text-violet">
                    Metered USDC
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] flex items-center gap-2">
                  <ShieldAlert className="size-5 text-violet" /> Verify Evidence
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  When evidence is needed, the agent calls conventional upstreams through Ordiva&apos;s Arc x402 adapters. Every scraping or enrichment call requires an on-chain micropayment that must strictly satisfy your pre-set budget limit.
                </p>
              </div>
              <div className="border-t border-line bg-canvas/40 px-6 py-3 text-xs font-semibold text-muted font-mono">
                Cost: $0.01 - $0.05 USDC / call
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col justify-between overflow-hidden rounded-[14px] border border-line bg-paper shadow-ledger-md transition-all hover:border-violet/40">
              <div className="relative h-48 w-full border-b border-line bg-canvas overflow-hidden">
                <Image
                  src="/images/step-outreach.png"
                  alt="Step 3 Human Email Outreach Approval"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-full bg-violet-wash text-violet font-mono text-sm font-bold shadow-ledger-sm">
                    3
                  </span>
                  <span className="rounded-full bg-canvas border border-line-strong px-2.5 py-1 text-xs font-mono font-semibold text-ink">
                    Human Required
                  </span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] flex items-center gap-2">
                  <MailCheck className="size-5 text-violet" /> Approve Outreach
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  The agent prepares tailored RFQs for verified suppliers. Before an email can be sent, the exact recipient, subject line, and message draft are presented for your mandatory one-click human approval.
                </p>
              </div>
              <div className="border-t border-line bg-canvas/40 px-6 py-3 text-xs font-semibold text-muted font-mono">
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

          <div className="mt-10 overflow-hidden rounded-[14px] border border-line bg-paper shadow-ledger-md">
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
                  <span>Validates recipient syntax and requires approval of the exact draft before sending.</span>
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
            <div className="rounded-[12px] border border-line bg-paper p-5 shadow-ledger-md transition-all hover:border-violet/40">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-semibold text-ink">Tavily</span>
                <span className="font-mono font-semibold text-violet bg-violet-wash rounded-full px-2.5 py-0.5">$0.01 USDC</span>
              </div>
              <h3 className="mt-3 font-semibold text-base">Web Search</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Supplier discovery and primary web source evidence.
              </p>
            </div>

            <div className="rounded-[12px] border border-line bg-paper p-5 shadow-ledger-md transition-all hover:border-violet/40">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-semibold text-ink">Firecrawl</span>
                <span className="font-mono font-semibold text-violet bg-violet-wash rounded-full px-2.5 py-0.5">$0.02 USDC</span>
              </div>
              <h3 className="mt-3 font-semibold text-base">Website Scraping</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Bounded markdown extraction from supplier company pages.
              </p>
            </div>

            <div className="rounded-[12px] border border-line bg-paper p-5 shadow-ledger-md transition-all hover:border-violet/40">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-semibold text-ink">Apollo</span>
                <span className="font-mono font-semibold text-violet bg-violet-wash rounded-full px-2.5 py-0.5">$0.03 USDC</span>
              </div>
              <h3 className="mt-3 font-semibold text-base">Company Enrichment</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Firmographics, employee counts, and location verification.
              </p>
            </div>

            <div className="rounded-[12px] border border-line bg-paper p-5 shadow-ledger-md transition-all hover:border-violet/40">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-semibold text-ink">Resend</span>
                <span className="font-mono font-semibold text-violet bg-violet-wash rounded-full px-2.5 py-0.5">$0.01 USDC</span>
              </div>
              <h3 className="mt-3 font-semibold text-base">Email Dispatch</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Idempotent email outreach to any valid recipient entered in an approved draft.
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
          <LandingAuthCta
            label="Open sourcing workspace"
            className="inline-flex min-h-13 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-violet px-6 text-base font-semibold text-white transition-colors hover:bg-violet-dark"
          />
        </section>
      </div>
    </main>
  );
}
