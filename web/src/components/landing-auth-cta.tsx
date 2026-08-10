"use client";

import { ArrowRight, WalletCards, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { EmailOtpSignIn } from "@/components/email-otp-sign-in";
import { useSessionStore } from "@/lib/session-store";

export function LandingAuthCta({
  label,
  className,
  icon = "arrow",
}: {
  label: string;
  className: string;
  icon?: "arrow" | "wallet";
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { hydrated, session, hydrate } = useSessionStore();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  function begin() {
    if (session) {
      router.push("/app");
      return;
    }
    setActive(true);
    setOpen(true);
  }

  function dismiss() {
    dialog.current?.close();
    setOpen(false);
    setActive(false);
  }

  function handOffToCircle() {
    dialog.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={begin} aria-haspopup={session ? undefined : "dialog"} className={className}>
        {icon === "wallet" ? <WalletCards aria-hidden="true" className="size-4" /> : null}
        {session ? "Open workspace" : label}
        {icon === "arrow" ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
      </button>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          event.preventDefault();
          dismiss();
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) dismiss();
        }}
        aria-labelledby={titleId}
        className="m-auto max-h-[calc(100vh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-[16px] border-0 bg-paper p-0 text-ink shadow-ledger-lg backdrop:bg-ink/75"
      >
        {active ? (
          <>
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-7">
              <div>
                <h2 id={titleId} className="font-semibold tracking-[-0.02em]">Connect to Ordiva</h2>
                <p className="mt-1 text-xs text-muted">Continue directly to your sourcing workspace.</p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Close sign-in"
                className="grid size-10 place-items-center rounded-[10px] border border-line transition-colors hover:border-ink hover:bg-ink hover:text-paper"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <div className="px-5 py-7 sm:px-8 sm:py-9">
              <EmailOtpSignIn
                returnTo="/app"
                onExternalChallenge={handOffToCircle}
                onFlowError={() => setOpen(true)}
              />
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
