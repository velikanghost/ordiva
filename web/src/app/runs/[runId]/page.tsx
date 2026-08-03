import type { Metadata } from "next";
import { RunWorkbench } from "@/components/run-workbench";

export const metadata: Metadata = { title: "Live sourcing run" };

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <RunWorkbench runId={runId} />;
}
