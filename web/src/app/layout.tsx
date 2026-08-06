import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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

const themeScript = `(function(){try{var t=localStorage.getItem('ordiva.theme.v1');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans bg-canvas text-ink">
        <template
          data-direction-contract
          dangerouslySetInnerHTML={{ __html: directionContract }}
        />
        {children}
      </body>
    </html>
  );
}
