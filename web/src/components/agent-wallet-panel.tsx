"use client";

import { Bot, CircleAlert, LoaderCircle, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiAuthJson, apiJson, ApiError } from "@/lib/api";
import { CopyableAddress } from "@/components/copyable-address";
import { useSessionStore } from "@/lib/session-store";

interface AgentWalletStatus {
  address: string;
  blockchain: "ARC-TESTNET";
  accountType: "EOA";
  gatewayBalance: string;
  ownerBalance: string;
  ownerAddress: string;
  allowance: string;
}

interface FundingChallenge {
  step: "approve" | "deposit";
  challengeId: string;
  description: string;
}

interface ApproveResponse {
  /** Null when the existing allowance already covers the amount. */
  challenge: FundingChallenge | null;
  allowance: string;
}

interface DepositResponse {
  challenge: FundingChallenge;
  agentAddress: string;
}

type Phase = "loading" | "ready" | "funding" | "confirming" | "error";

const DEFAULT_AMOUNT = "2";
const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1500;

/**
 * Grants the agent its spending authority.
 *
 * This panel is the one place a human authorises spending. Everything the agent
 * buys afterwards happens with no prompt, which is the whole point — so the panel
 * states plainly what is being granted and shows the on-chain balance backing it.
 */
export function AgentWalletPanel() {
  const session = useSessionStore((state) => state.session);
  const [status, setStatus] = useState<AgentWalletStatus | null>(null);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const token = session?.token;

  const refresh = useCallback(async (): Promise<AgentWalletStatus | null> => {
    if (!token) return null;
    const next = await apiAuthJson<AgentWalletStatus>("/v1/agent-wallet", token);
    setStatus(next);
    return next;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh()
      .then(() => setPhase("ready"))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Could not load the agent wallet.");
        setPhase("error");
      });
  }, [refresh, token]);

  async function fund() {
    if (!session?.token) return;

    setError(null);

    if (!session.circleAuth) {
      setError("Your Circle session is no longer available. Sign in again to authorise funding.");
      setPhase("error");
      return;
    }

    setPhase("funding");

    try {
      const body = JSON.stringify({
        circleUserToken: session.circleAuth.userToken,
        amount,
      });

      // The SDK needs the app id before it can resolve entity config; without it
      // Circle rejects the challenge with "Provided appid is not configured".
      const [{ W3SSdk }, authConfig] = await Promise.all([
        import("@circle-fin/w3s-pw-web-sdk"),
        apiJson<{ appId: string }>("/v1/auth/config"),
      ]);
      const sdk = new W3SSdk();
      sdk.updateConfigs({ appSettings: { appId: authConfig.appId } });
      sdk.setAuthentication(session.circleAuth);

      const approval = await apiAuthJson<ApproveResponse>(
        "/v1/agent-wallet/fund/approve",
        session.token,
        { method: "POST", body },
      );

      if (approval.challenge) {
        setProgress(`Step 1 of 2: ${approval.challenge.description}`);
        await runChallenge(sdk, approval.challenge.challengeId);

        // A completed challenge only means Circle accepted it. `depositFor` pulls via
        // `transferFrom`, so the approval must be mined before the deposit is created.
        setProgress("Waiting for the approval to confirm on Arc…");
        await waitForAllowance();
      }

      const deposit = await apiAuthJson<DepositResponse>(
        "/v1/agent-wallet/fund/deposit",
        session.token,
        { method: "POST", body },
      );

      setProgress(`Step 2 of 2: ${deposit.challenge.description}`);
      await runChallenge(sdk, deposit.challenge.challengeId);

      setPhase("confirming");
      setProgress("Confirming the deposit on Arc…");
      await pollUntilFunded();
      setPhase("ready");
      setProgress(null);
    } catch (caught) {
      setError(fundingErrorMessage(caught));
      setPhase("error");
      setProgress(null);
    }
  }

  /**
   * Block until the approval is mined and the allowance covers the amount.
   *
   * Without this the deposit is created against an allowance of zero and reverts
   * on-chain with "ERC20: transfer amount exceeds allowance".
   */
  async function waitForAllowance() {
    // Compare numerically: a leftover allowance from a smaller past grant is
    // non-zero but still insufficient, and would fail at the deposit step.
    const required = Number(amount);
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      const next = await refresh();
      if (next && Number(next.allowance.replace("$", "")) >= required) return;
      await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error(
      "The approval has not confirmed on Arc yet. Wait a moment and press Fund agent again — " +
        "your approval is not lost.",
    );
  }

  /**
   * Re-read the balance until Arc reflects the deposit.
   *
   * The challenge completing means Circle accepted it, not that it has settled.
   */
  async function pollUntilFunded() {
    const before = status?.gatewayBalance;
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
      const next = await refresh();
      if (next && next.gatewayBalance !== before) return;
      await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
    }
    setError("The deposit was submitted but has not appeared on Arc yet. Refresh in a moment.");
  }

  if (!session) {
    return (
      <section className="rounded-[12px] border border-line p-6">
        <h2 className="text-lg font-semibold">Agent wallet</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          <Link href="/sign-in" className="font-semibold text-violet underline">
            Sign in
          </Link>{" "}
          to provision an agent wallet.
        </p>
      </section>
    );
  }

  const busy = phase === "funding" || phase === "confirming";

  return (
    <section className="rounded-[12px] border border-line p-6">
      <div className="flex items-start gap-3">
        <Bot aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-violet" />
        <div>
          <h2 className="text-lg font-semibold">Agent wallet</h2>
          <p className="mt-1 max-w-[60ch] text-sm leading-6 text-muted">
            Ordiva operates this wallet so your agent can pay for evidence without a prompt each
            time. It can only ever spend what you deposit here.
          </p>
        </div>
      </div>

      {phase === "loading" ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Loading agent wallet…
        </p>
      ) : null}

      {status ? (
        <>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[12px] border border-line px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Agent spending balance
              </dt>
              <dd className="mt-1 font-mono text-xl font-semibold">{status.gatewayBalance}</dd>
              <dd className="mt-1 text-xs text-muted">Escrowed on Arc — a hard ceiling</dd>
            </div>
            <div className="rounded-[12px] border border-line px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Your wallet
              </dt>
              <dd className="mt-1 font-mono text-xl font-semibold">{status.ownerBalance}</dd>
              <dd className="mt-1 text-xs text-muted">Funds the agent, stays yours</dd>
            </div>
          </dl>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <Wallet aria-hidden="true" className="size-3.5 shrink-0" />
            <span>Agent address</span>
            <CopyableAddress address={status.address} truncate label="agent wallet address" />
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="fund-amount" className="block text-sm font-semibold">
                Grant spending authority (USDC)
              </label>
              <input
                id="fund-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                disabled={busy}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-2 min-h-11 w-36 rounded-[12px] border border-line-strong bg-white px-3 font-mono outline-none focus:border-violet focus:ring-4 focus:ring-violet-wash disabled:cursor-wait disabled:bg-canvas"
              />
            </div>
            <button
              type="button"
              onClick={() => void fund()}
              disabled={busy || !amount.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-ink px-5 font-semibold text-paper transition-colors hover:bg-violet disabled:cursor-not-allowed disabled:bg-line-strong"
            >
              {busy ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <ShieldCheck aria-hidden="true" className="size-4" />
              )}
              {busy ? "Authorising…" : "Fund agent"}
            </button>
          </div>

          <p className="mt-3 max-w-[62ch] text-xs leading-5 text-muted">
            The first grant needs two approvals — one to permit the transfer, one to make it.
            Later top-ups need only one. After this, the agent spends unattended.
          </p>
        </>
      ) : null}

      <p role="status" aria-live="polite" className="mt-4 text-sm text-muted empty:hidden">
        {progress}
      </p>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-[12px] bg-danger-wash px-4 py-3 text-sm leading-6 text-danger"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Run one Circle challenge to completion.
 *
 * @param sdk - An authenticated Circle Web SDK instance.
 * @param challengeId - The challenge to execute.
 */
function runChallenge(sdk: { execute: (id: string, cb: ChallengeCallback) => void }, challengeId: string) {
  return new Promise<void>((resolve, reject) => {
    sdk.execute(challengeId, (sdkError, result) => {
      if (sdkError) reject(new Error(sdkError.message ?? "The approval was not completed."));
      else if (!result || result.status !== "COMPLETE") {
        reject(new Error("The approval did not complete."));
      } else resolve();
    });
  });
}

type ChallengeCallback = (
  error: { message?: string } | undefined,
  result: { status?: string } | undefined,
) => void;

/**
 * Turn a funding failure into something the operator can act on.
 *
 * @param caught - The thrown value.
 */
function fundingErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    const body = caught.body;
    if (body && typeof body === "object" && "error" in body && body.error === "circle_reauth_required") {
      return "Your Circle session expired. Sign in again to authorise funding.";
    }
    return caught.message;
  }
  return caught instanceof Error ? caught.message : "Funding could not be completed.";
}
