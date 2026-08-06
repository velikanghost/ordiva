"use client";

import { ArrowRight, Check, CircleAlert, LoaderCircle, LockKeyhole, WalletCards } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { apiJson } from "@/lib/api";
import { CopyableAddress } from "@/components/copyable-address";
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

export function EmailOtpSignIn({ returnTo = "/" }: { returnTo?: string }) {
  const acceptSession = useSessionStore((state) => state.acceptSession);
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletIsNew, setWalletIsNew] = useState(true);

  const busy = ["starting", "verifying", "creating-wallet"].includes(phase);

  async function completeCircleFlow() {
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
          sdk.verifyOtp();
        },
      );

      let session = await apiJson<SessionResponse>("/v1/auth/session", {
        method: "POST",
        body: JSON.stringify({ state: start.state, circleUserToken: circleAuth.userToken }),
      });

      if (session.walletAction.required) {
        setWalletIsNew(true);
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
      } else {
        setWalletIsNew(false);
      }

      if (!session.wallet) throw new Error("Circle completed the challenge, but the Arc wallet is not ready yet. Try again in a moment.");
      acceptSession({
        token: session.sessionToken,
        email,
        wallet: session.wallet,
        circleAuth,
      });
      setWalletAddress(session.wallet.address);
      setPhase("complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "An unexpected sign-in error occurred.");
      setPhase("error");
    }
  }

  if (phase === "complete" && walletAddress) {
    if (!walletIsNew) {
      return (
        <div className="proof-enter" role="status">
          <span className="grid size-12 place-items-center rounded-full bg-success-wash text-success">
            <Check aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-7 text-3xl font-semibold tracking-[-0.03em]">Signed in</h2>
          <p className="mt-3 text-base leading-7 text-muted">{email}</p>
          <div className="mt-6 flex items-center gap-3 rounded-[12px] border border-line px-4 py-4">
            <WalletCards aria-hidden="true" className="size-4 shrink-0 text-muted" />
            <CopyableAddress address={walletAddress} truncate className="text-sm text-muted" />
            <span className="ml-auto rounded-full bg-success-wash px-2.5 py-1 text-[0.68rem] font-semibold text-success">
              Connected
            </span>
          </div>
          <Link href={returnTo} className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-violet px-5 font-semibold text-white transition-colors hover:bg-violet-dark">
            Continue <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      );
    }

    return (
      <div className="proof-enter" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-success-wash text-success">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-7 text-3xl font-semibold tracking-[-0.03em]">Wallet ready</h2>
        <p className="mt-3 text-base leading-7 text-muted">One Arc Testnet EOA is linked to this Ordiva account.</p>
        <div className="mt-8 border-y border-line py-5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Wallet address</span>
          <CopyableAddress address={walletAddress} className="mt-2 text-sm leading-6" />
        </div>
        <Link href={returnTo} className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-[12px] bg-ink px-5 font-semibold text-paper hover:bg-violet">
          Continue
        </Link>
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
