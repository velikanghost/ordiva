"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

const RESET_DELAY_MS = 2000;

/**
 * Copy text to the clipboard, falling back for non-secure contexts.
 *
 * `navigator.clipboard` is undefined outside HTTPS/localhost, which is exactly
 * where a teammate opening the dev server over a LAN address would land.
 *
 * @param value - Text to place on the clipboard.
 */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path rather than failing outright.
  }

  try {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(field);
    return copied;
  } catch {
    return false;
  }
}

/**
 * Shorten an address for display while keeping both ends recognisable.
 *
 * @param address - Full 0x address.
 */
function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * An address the user can actually copy.
 *
 * Wallet addresses are unusable if they can only be read: every place Ordiva shows
 * one, it must be possible to get it onto the clipboard. Feedback is conveyed by
 * icon, text, and an assertive live region — never by colour alone (WCAG 2.2 AA).
 */
export function CopyableAddress({
  address,
  truncate = false,
  label = "wallet address",
  className = ""
}: {
  address: string;
  truncate?: boolean;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleCopy() {
    const copied = await copyText(address);
    setState(copied ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), RESET_DELAY_MS);
  }

  const message =
    state === "copied" ? "Copied" : state === "failed" ? "Press Ctrl+C to copy" : null;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}: ${address}`}
        title="Copy to clipboard"
        className="group inline-flex min-h-8 max-w-full items-center gap-2 rounded-[8px] px-2 py-1 font-mono transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
      >
        <span className={truncate ? "" : "break-all text-left"}>
          {truncate ? shorten(address) : address}
        </span>
        {state === "copied" ? (
          <Check aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        ) : (
          <Copy
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted transition-opacity group-hover:opacity-100 sm:opacity-60"
          />
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {message}
      </span>
      {message ? (
        <span aria-hidden="true" className="text-[0.68rem] font-semibold text-muted">
          {message}
        </span>
      ) : null}
    </span>
  );
}
