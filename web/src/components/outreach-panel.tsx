"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  LoaderCircle,
  Mail,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  approveOutreach,
  createOutreachDrafts,
  fetchRun,
  sendOutreach,
  sendTestOutreach,
  updateOutreachDraft,
  type RunOutreach,
  type SourcingRun,
} from "@/lib/run";

export function OutreachPanel({
  run,
  token,
  email,
  onRun,
}: {
  run: SourcingRun;
  token: string;
  email: string;
  onRun: (run: SourcingRun) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const autoRequestedFor = useRef<string | null>(null);
  const eligible = run.suppliers.filter((supplier) => supplier.verified && supplier.contacts.length > 0);
  const verificationFinished = !["research_ready", "verifying"].includes(run.status);
  const pageIndex = Math.min(activeIndex, Math.max(run.outreach.length - 1, 0));
  const activeDraft = run.outreach[pageIndex];

  async function act(key: string, operation: () => Promise<SourcingRun>) {
    setBusy(key);
    setError(null);
    try {
      onRun(await operation());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outreach action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function send(draft: RunOutreach) {
    await act(`send-${draft.id}`, async () => {
      let next = await sendOutreach(run.id, draft.id, token);
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const current = next.outreach.find((item) => item.id === draft.id);
        if (!current || !["queued", "sending"].includes(current.status)) return next;
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        next = await fetchRun(run.id, token);
        onRun(next);
      }
      return next;
    });
  }

  const prepareDrafts = useCallback(async () => {
    setBusy("drafts");
    setError(null);
    window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    try {
      onRun(await createOutreachDrafts(run.id, token));
      setActiveIndex(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "RFQ drafts could not be prepared.");
    } finally {
      setBusy(null);
    }
  }, [onRun, run.id, token]);

  useEffect(() => {
    if (!verificationFinished || eligible.length === 0 || run.outreach.length > 0) return;
    if (autoRequestedFor.current === run.id) return;
    autoRequestedFor.current = run.id;
    void prepareDrafts();
  }, [eligible.length, prepareDrafts, run.id, run.outreach.length, verificationFinished]);

  return (
    <section ref={sectionRef} className="mt-12 scroll-mt-6 border-t border-line pt-10" aria-busy={busy === "drafts"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
            <Mail aria-hidden="true" className="size-4 text-muted" /> RFQ drafts
          </h2>
          <p className="mt-1 max-w-[66ch] text-sm leading-6 text-muted">
            Review the exact recipient, subject, and message. Editing creates a new version and clears approval.
          </p>
        </div>
      </div>

      {busy === "drafts" ? (
        <div className="mt-6 border-y border-line bg-canvas px-4 py-5" role="status" aria-live="polite">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-violet motion-reduce:animate-none" />
            Preparing RFQ drafts
          </span>
          <p className="mt-2 text-sm leading-6 text-muted">
            Tailoring recipient, subject, and sourcing questions for {eligible.length} verified {eligible.length === 1 ? "supplier" : "suppliers"}.
          </p>
        </div>
      ) : eligible.length === 0 ? (
        <p className="mt-5 flex items-start gap-2 rounded-[12px] bg-canvas p-4 text-sm leading-6 text-muted">
          <TriangleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" /> Outreach becomes available when a supplier passes verification and has a public contact.
        </p>
      ) : null}

      {error ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-danger-wash p-4 text-sm text-danger" role="alert">
          <span>{error}</span>
          {run.outreach.length === 0 && eligible.length > 0 ? (
            <button
              type="button"
              onClick={() => void prepareDrafts()}
              className="min-h-11 rounded-[12px] border border-danger/30 px-4 font-semibold transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            >
              Retry preparation
            </button>
          ) : null}
        </div>
      ) : null}

      {activeDraft ? (
        <div className="mt-6 border-y border-line">
          <div className="flex items-center justify-between gap-4 border-b border-line py-3">
            <p className="text-sm font-semibold" aria-live="polite">
              Draft {pageIndex + 1} of {run.outreach.length}
            </p>
            <div className="flex items-center gap-2" aria-label="RFQ draft pagination">
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                aria-label="Previous RFQ draft"
                aria-controls="active-rfq-draft"
                className="grid size-11 place-items-center rounded-[12px] border border-line-strong transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </button>
              <button
                type="button"
                disabled={pageIndex === run.outreach.length - 1}
                onClick={() => setActiveIndex((index) => Math.min(run.outreach.length - 1, index + 1))}
                aria-label="Next RFQ draft"
                aria-controls="active-rfq-draft"
                className="grid size-11 place-items-center rounded-[12px] border border-line-strong transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
          <DraftEditor
            key={`${activeDraft.id}-${activeDraft.version}-${activeDraft.status}`}
            draft={activeDraft}
            supplierName={run.suppliers.find((supplier) => supplier.id === activeDraft.supplierId)?.name ?? "Supplier"}
            busy={busy}
            onSave={(input) => act(`save-${activeDraft.id}`, () => updateOutreachDraft(run.id, activeDraft.id, token, input))}
            onApprove={() => act(`approve-${activeDraft.id}`, () => approveOutreach(run.id, activeDraft.id, token, activeDraft.contentHash))}
            onSendTest={() => act(`test-${activeDraft.id}`, () => sendTestOutreach(run.id, activeDraft.id, token))}
            onSend={() => send(activeDraft)}
            email={email}
          />
        </div>
      ) : null}
    </section>
  );
}

function DraftEditor({
  draft,
  supplierName,
  busy,
  onSave,
  onApprove,
  onSendTest,
  onSend,
  email,
}: {
  draft: RunOutreach;
  supplierName: string;
  busy: string | null;
  onSave: (input: { recipient: string; subject: string; text: string }) => Promise<void>;
  onApprove: () => Promise<void>;
  onSendTest: () => Promise<void>;
  onSend: () => Promise<void>;
  email: string;
}) {
  const [recipient, setRecipient] = useState(draft.recipient);
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState(draft.text);
  const changed = recipient !== draft.recipient || subject !== draft.subject || text !== draft.text;
  const locked = ["queued", "sending", "sent"].includes(draft.status);
  const isBusy = busy?.endsWith(draft.id) ?? false;
  const currentTest = draft.testVersion === draft.version;

  return (
    <article id="active-rfq-draft" className="py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{supplierName}</h3>
          <p className="mt-1 font-mono text-xs text-muted">Version {draft.version} · {draft.status.replace("_", " ")}</p>
        </div>
        {draft.status === "sent" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-wash px-2.5 py-1 text-xs font-semibold text-success">
            <Check aria-hidden="true" className="size-3" /> Sent {draft.messageId ? `· ${draft.messageId}` : ""}
          </span>
        ) : null}
      </div>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Recipient
          <input value={recipient} onChange={(event) => setRecipient(event.target.value)} disabled={locked} className="min-h-12 rounded-[12px] border border-line-strong bg-paper px-4 font-normal outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 disabled:bg-canvas" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={locked} className="min-h-12 rounded-[12px] border border-line-strong bg-paper px-4 font-normal outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 disabled:bg-canvas" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Message
          <textarea value={text} onChange={(event) => setText(event.target.value)} disabled={locked} rows={10} className="resize-y rounded-[14px] border border-line-strong bg-paper px-4 py-3 font-normal leading-6 outline-none focus:border-violet focus:ring-2 focus:ring-violet/30 disabled:bg-canvas" />
        </label>
      </div>
      {draft.failureReason ? <p className="mt-3 text-sm text-danger">{draft.failureReason}</p> : null}
      {currentTest && draft.testStatus === "sent" ? (
        <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-success-wash p-4 text-sm leading-6 text-success" role="status">
          <Check aria-hidden="true" className="mt-1 size-4 shrink-0" />
          Test copy sent to {draft.testRecipient}. The supplier RFQ remains approved and unsent.
        </p>
      ) : null}
      {currentTest && draft.testStatus === "failed" ? (
        <p className="mt-4 rounded-[12px] bg-danger-wash p-4 text-sm leading-6 text-danger" role="alert">
          Test delivery failed{draft.testFailureReason ? `: ${draft.testFailureReason}` : "."} Review the run budget and email configuration, then try again.
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {changed && !locked ? (
          <button type="button" disabled={isBusy} onClick={() => void onSave({ recipient, subject, text })} className="min-h-11 rounded-[12px] border border-line-strong px-4 text-sm font-semibold hover:bg-canvas disabled:cursor-wait">Save new version</button>
        ) : null}
        {!changed && (draft.status === "draft" || draft.status === "failed") ? (
          <button type="button" disabled={isBusy} onClick={() => void onApprove()} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-violet px-5 text-sm font-semibold text-white hover:bg-violet-dark disabled:cursor-wait disabled:bg-line-strong">
            <ShieldCheck aria-hidden="true" className="size-4" /> Approve exact draft
          </button>
        ) : null}
        {draft.status === "approved" ? (
          <>
            <button
              type="button"
              disabled={isBusy || (currentTest && draft.testStatus === "sent")}
              onClick={() => void onSendTest()}
              title={`Send a clearly labeled demo copy to ${email}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-line-strong px-4 text-sm font-semibold transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted"
            >
              {busy === `test-${draft.id}` ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : currentTest && draft.testStatus === "sent" ? <Check aria-hidden="true" className="size-4" /> : <FlaskConical aria-hidden="true" className="size-4" />}
              {currentTest && draft.testStatus === "sent" ? "Test copy sent" : "Send test RFQ to myself"}
            </button>
            <button type="button" disabled={isBusy} onClick={() => void onSend()} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-ink px-5 text-sm font-semibold text-paper transition-colors hover:bg-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet disabled:cursor-wait disabled:bg-line-strong">
              {busy === `send-${draft.id}` ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Send aria-hidden="true" className="size-4" />} Send approved RFQ
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
