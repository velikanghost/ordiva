"use client";

import { CircleAlert, LoaderCircle, LockKeyhole, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiAuthJson, apiJson } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";

type Phase = "idle" | "starting" | "verifying" | "creating-wallet" | "provisioning-wallet" | "complete" | "error";

interface PublicAuthConfig {
  appId: string;
  blockchain: "ARC-TESTNET";
  accountType: "EOA";
}

interface StartResponse {
  state: string;
  deviceToken: string;
  deviceEncryptionKey: string;
  otpToken: string;
}

interface SessionResponse {
  sessionToken: string;
  user: { id: string; circleUserId: string; status: "active" };
  wallet: {
    id: string;
    address: string;
    blockchain: "ARC-TESTNET";
    accountType: "EOA";
    state: string;
  } | null;
  walletAction:
    | { required: false }
    | {
        required: true;
        challengeId: string;
        accountType: "EOA";
        blockchain: "ARC-TESTNET";
      };
}

type ArcWallet = NonNullable<SessionResponse["wallet"]>;

interface WalletFinalizeResponse {
  wallet: ArcWallet | null;
}

function messageForPhase(phase: Phase): string {
  switch (phase) {
    case "starting":
      return "Requesting a secure email challenge…";
    case "verifying":
      return "Complete the one-time code in Circle's secure window.";
    case "creating-wallet":
      return "Finish the wallet challenge in Circle's secure window.";
    case "provisioning-wallet":
      return "Circle accepted wallet setup. Creating your Arc wallet…";
    case "complete":
      return "Your Arc wallet is ready.";
    case "error":
      return "Sign-in could not be completed.";
    default:
      return "No password. Circle sends a one-time code to your email.";
  }
}

export function EmailOtpSignIn({
  returnTo = "/app",
  onExternalChallenge,
  onExternalChallengeComplete,
  onFlowError,
}: {
  returnTo?: string;
  onExternalChallenge?: () => void;
  onExternalChallengeComplete?: () => void;
  onFlowError?: () => void;
}) {
  const router = useRouter();
  const { hydrated, session: existingSession, hydrate, acceptSession } = useSessionStore();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = ["starting", "verifying", "creating-wallet", "provisioning-wallet"].includes(phase);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (hydrated && existingSession) router.replace(returnTo);
  }, [existingSession, hydrated, returnTo, router]);

  async function completeCircleFlow() {
    let handedOff = false;
    setError(null);
    setPhase("starting");

    try {
      const [{ W3SSdk }, config] = await Promise.all([
        import("@circle-fin/w3s-pw-web-sdk"),
        apiJson<PublicAuthConfig>("/v1/auth/config"),
      ]);
      const sdk = new W3SSdk();
      const deviceId = await sdk.getDeviceId();
      const start = await apiJson<StartResponse>("/v1/auth/email/start", {
        method: "POST",
        body: JSON.stringify({ email, deviceId }),
      });

      setPhase("verifying");
      const circleAuth = await new Promise<{ userToken: string; encryptionKey: string }>(
        (resolve, reject) => {
          sdk.updateConfigs(
            {
              appSettings: { appId: config.appId },
              loginConfigs: {
                deviceToken: start.deviceToken,
                deviceEncryptionKey: start.deviceEncryptionKey,
                otpToken: start.otpToken,
              },
            },
            (sdkError, result) => {
              if (sdkError) reject(new Error(sdkError.message));
              else if (!result) reject(new Error("Circle returned no verification result."));
              else resolve({ userToken: result.userToken, encryptionKey: result.encryptionKey });
            },
          );
          handedOff = true;
          onExternalChallenge?.();
          sdk.verifyOtp();
        },
      );

      let session = await apiJson<SessionResponse>("/v1/auth/session", {
        method: "POST",
        body: JSON.stringify({ state: start.state, circleUserToken: circleAuth.userToken }),
      });

      if (session.walletAction.required) {
        const { challengeId } = session.walletAction;
        setPhase("creating-wallet");
        sdk.setAuthentication(circleAuth);
        await runWalletChallenge(sdk, challengeId);

        setPhase("provisioning-wallet");
        onExternalChallengeComplete?.();
        const wallet = await waitForArcWallet(session.sessionToken, circleAuth.userToken);
        session = { ...session, wallet, walletAction: { required: false } };
      }

      if (!session.wallet) throw new Error("Circle completed the challenge, but the Arc wallet is not ready yet. Try again in a moment.");
      acceptSession({
        token: session.sessionToken,
        email,
        wallet: session.wallet,
        circleAuth,
      });
      setPhase("complete");
      router.replace(returnTo);
    } catch (caught) {
      setError(signInErrorMessage(caught));
      setPhase("error");
      if (handedOff) onFlowError?.();
    }
  }

  if (!hydrated || existingSession || phase === "complete") {
    return (
      <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted" role="status" aria-live="polite">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {phase === "complete" || existingSession ? "Opening your workspace…" : "Checking your session…"}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void completeCircleFlow();
      }}
    >
      <WalletCards aria-hidden="true" className="size-7 text-violet" />
      <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em]">Sign in with email</h2>
      <p className="mt-3 max-w-[50ch] text-base leading-7 text-muted">{messageForPhase(phase)}</p>

      <label htmlFor="account-email" className="mt-9 block text-sm font-semibold">
        Email address
      </label>
      <input
        id="account-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        disabled={busy}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.com"
        className="mt-3 min-h-13 w-full rounded-[12px] border border-line-strong bg-white px-4 outline-none transition-shadow placeholder:text-[#6f6d67] focus:border-violet focus:ring-4 focus:ring-violet-wash disabled:cursor-wait disabled:bg-canvas"
      />

      {error ? (
        <div className="mt-4 flex items-start gap-3 rounded-[12px] bg-danger-wash px-4 py-3 text-sm leading-6 text-danger" role="alert">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-ink px-5 font-semibold text-paper transition-colors hover:bg-violet disabled:cursor-not-allowed disabled:bg-line-strong"
      >
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <LockKeyhole aria-hidden="true" className="size-4" />}
        {busy ? "Continue in Circle" : phase === "error" ? "Try again" : "Send one-time code"}
      </button>
      <p className="mt-5 text-center text-xs leading-5 text-muted">
        Circle&apos;s secure SDK handles the one-time code and wallet PIN. Sensitive wallet credentials are never stored by Ordiva.
      </p>
    </form>
  );
}

type WalletChallengeSdk = {
  execute: (
    id: string,
    callback: (
      error: { message?: string } | undefined,
      result: { status?: string } | undefined,
    ) => void,
  ) => void;
};

function runWalletChallenge(sdk: WalletChallengeSdk, challengeId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sdk.execute(challengeId, (sdkError, result) => {
      if (sdkError) {
        reject(new Error(sdkError.message ?? "Circle could not complete wallet setup."));
        return;
      }

      switch (result?.status) {
        case "COMPLETE":
        case "PENDING":
        case "IN_PROGRESS":
          resolve();
          return;
        case "EXPIRED":
          reject(new Error("The Circle wallet challenge expired. Start the sign-in flow again."));
          return;
        case "FAILED":
          reject(new Error("Circle could not create the Arc wallet. Try the wallet challenge again."));
          return;
        default:
          reject(new Error("Circle returned no usable result for the wallet challenge. Try again."));
      }
    });
  });
}

async function waitForArcWallet(sessionToken: string, circleUserToken: string): Promise<ArcWallet> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (attempt > 0) {
      const delayMs = Math.min(600 + attempt * 150, 1_800);
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }

    const result = await apiAuthJson<WalletFinalizeResponse>(
      "/v1/auth/wallet/finalize",
      sessionToken,
      {
        method: "POST",
        body: JSON.stringify({ circleUserToken }),
      },
    );
    if (result.wallet) return result.wallet;
  }

  throw new Error("Circle accepted wallet setup, but the Arc wallet is still provisioning. Wait a moment and try again.");
}

function signInErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError) return caught.message;
  if (caught instanceof TypeError) {
    return "Ordiva could not reach the API. Check your connection and try again.";
  }
  return caught instanceof Error ? caught.message : "An unexpected sign-in error occurred.";
}
