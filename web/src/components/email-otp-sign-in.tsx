"use client";

import { CircleAlert, LoaderCircle, LockKeyhole, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";

type Phase = "idle" | "starting" | "verifying" | "creating-wallet" | "complete" | "error";

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

function messageForPhase(phase: Phase): string {
  switch (phase) {
    case "starting":
      return "Requesting a secure email challenge…";
    case "verifying":
      return "Complete the one-time code in Circle's secure window.";
    case "creating-wallet":
      return "Finish the wallet challenge in Circle's secure window.";
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
  onFlowError,
}: {
  returnTo?: string;
  onExternalChallenge?: () => void;
  onFlowError?: () => void;
}) {
  const router = useRouter();
  const { hydrated, session: existingSession, hydrate, acceptSession } = useSessionStore();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = ["starting", "verifying", "creating-wallet"].includes(phase);

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
        await new Promise<void>((resolve, reject) => {
          sdk.execute(challengeId, (sdkError, result) => {
            if (sdkError) reject(new Error(sdkError.message));
            else if (!result || result.status !== "COMPLETE") {
              reject(new Error("The wallet challenge did not complete."));
            } else resolve();
          });
        });

        for (let attempt = 0; attempt < 5; attempt += 1) {
          session = await apiJson<SessionResponse>("/v1/auth/session", {
            method: "POST",
            body: JSON.stringify({ state: start.state, circleUserToken: circleAuth.userToken }),
          });
          if (session.wallet) break;
          await new Promise((resolve) => window.setTimeout(resolve, 700));
        }
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
      setError(caught instanceof Error ? caught.message : "An unexpected sign-in error occurred.");
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
          <span>{error} Check the API connection and try again.</span>
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
