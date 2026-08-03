import type { Metadata } from "next";
import "@fontsource-variable/figtree";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ordiva — Agentic supplier sourcing",
    template: "%s · Ordiva",
  },
  description:
    "Source, verify, and contact suppliers through a policy-controlled agent on Arc.",
};

const directionContract = `<!--
THESIS: A paid agent decision and the proof it buys share one workbench; Ordiva refuses chat-first and dashboard-card layouts.
OWN-WORLD: Near-white and near-black, fine rules, precise geometric sans, one restrained violet for current state, focus, and approval.
STORY: See the goal and budget, inspect the paid service reason and deterministic policy, read evidence, compare three suppliers, then approve outreach.
FIRST VIEWPORT: Slim status bar, five-step strip, 58/42 decision-and-evidence split joined by a violet line, supplier results below.
FORM: Evidence Split Workbench; approved comp .impeccable/mocks/evidence-split.webp; seed 113170a7.
FINISH: Unreviewed and undocumented is unfinished; complete the finish review, verdict, and DESIGN.md.
-->`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <template
          data-direction-contract
          dangerouslySetInnerHTML={{ __html: directionContract }}
        />
        {children}
      </body>
    </html>
  );
}
