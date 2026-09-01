"use client";

import { useEffect, useState } from "react";
import { revalidateBoard } from "@/lib/actions";
import type { OutreachEntry } from "@/lib/data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type EventType = OutreachEntry["eventType"];

type Action = {
  value: EventType;
  label: string;
  tone: string;
  needsReason: boolean;
};

const PRIMARY = "bg-brand text-white shadow-brand hover:bg-brand-dark";
const QUIET = "border border-hairline bg-white text-brand hover:bg-surface-soft";
const GOOD = "bg-tier-strong text-white hover:opacity-90";
const MUTED = "border border-hairline bg-white text-ink-muted hover:bg-surface-soft";

/** Step 1 — the only thing knowable at the moment of the attempt. */
const REACHED: Action[] = [
  { value: "connected", label: "Yes, I spoke to them", tone: PRIMARY, needsReason: false },
  { value: "not_connected", label: "No, couldn't reach", tone: QUIET, needsReason: true },
];

/** Step 2 — only answerable once they have actually been spoken to, which
 *  is why it is never on screen at the same time as step 1. */
const OUTCOME: Action[] = [
  { value: "converted", label: "They became a client", tone: GOOD, needsReason: false },
  { value: "follow_up_later", label: "Following up later", tone: QUIET, needsReason: true },
  { value: "not_converted", label: "Not a fit", tone: MUTED, needsReason: true },
];

/** Which question this prospect is actually at.
 *
 *  connected            → they have been reached; ask how it went
 *  converted / not_..   → finished; show the result, offer a way back
 *  anything else        → ask whether this attempt reached them. A
 *                         follow_up_later loops back here on purpose: next
 *                         time round, the advisor is dialling again.
 */
function stepFor(last: OutreachEntry | undefined): "reached" | "outcome" | "done" {
  if (!last) return "reached";
  if (last.eventType === "connected") return "outcome";
  if (last.eventType === "converted" || last.eventType === "not_converted") return "done";
  return "reached";
}

const LABELS: Record<EventType, string> = {
  connected: "Spoke to them",
  not_connected: "Couldn't reach them",
  follow_up_later: "Following up later",
  converted: "Became a client",
  not_converted: "Not a fit",
};

const MODAL_PROMPTS: Partial<
  Record<EventType, { title: string; placeholder: string; askDate?: boolean }>
> = {
  not_connected: {
    title: "Couldn't reach them — what happened?",
    placeholder: "e.g. Gatekeeper wouldn't transfer; left a message with the front desk",
  },
  follow_up_later: {
    title: "Following up later — what did they say?",
    placeholder: "e.g. Interested, but wants to talk after bonus season",
    askDate: true,
  },
  not_converted: {
    title: "Not a fit — why not?",
    placeholder: "e.g. Already has an advisor; not interested right now",
  },
};

function fmtDate(iso: string): string {
  // Date-only strings parse as UTC midnight; split to keep the local day
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** The outcome capture that lives inside the Contact Kit — the last thing
 *  an advisor does on a profile. One click for the good outcomes; the two
 *  that deserve a reason open a small branded dialog instead of a page. */
export default function OutreachActions({
  prospectId,
  prospectName,
  initialHistory,
}: {
  prospectId: string;
  prospectName?: string;
  initialHistory: OutreachEntry[];
}) {
  const [history, setHistory] = useState(initialHistory);
  const [modalFor, setModalFor] = useState<EventType | null>(null);
  const [reason, setReason] = useState("");
  const [followUpOn, setFollowUpOn] = useState("");
  const [pending, setPending] = useState<EventType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reopened, setReopened] = useState(false);
  const [revising, setRevising] = useState(false);

  // This panel is reused across prospects: the book view swaps `?id=` with a
  // client navigation, so React keeps this component mounted and only changes
  // the props. `useState` reads its argument on mount alone, so without this
  // every state below would still describe whoever was on screen before — the
  // outcome logged on one prospect showing up on the next one's profile.
  const [shownFor, setShownFor] = useState(prospectId);
  if (shownFor !== prospectId) {
    setShownFor(prospectId);
    setHistory(initialHistory);
    setModalFor(null);
    setReason("");
    setFollowUpOn("");
    setPending(null);
    setError(null);
    setReopened(false);
    setRevising(false);
  }

  useEffect(() => {
    if (!modalFor) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalFor(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalFor]);

  async function log(eventType: EventType, notes: string | null) {
    setPending(eventType);
    setError(null);
    try {
      // Revising corrects the event already there; logging appends a new
      // one. Appending a correction would leave both outcomes in the
      // funnel and count the prospect in two stages at once.
      const target = revising && history[0] ? history[0] : null;
      const res = await fetch(
        target
          ? `${API_URL}/prospects/${prospectId}/outreach/${target.id}`
          : `${API_URL}/prospects/${prospectId}/outreach`,
        {
        method: target ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          channel: "phone",
          notes,
          follow_up_on:
            eventType === "follow_up_later" && followUpOn ? followUpOn : null,
        }),
      },
      );
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const saved = await res.json();
      const entry = {
        id: saved.id,
        eventType: saved.event_type,
        channel: saved.channel,
        notes: saved.notes,
        occurredAt: saved.occurred_at,
        followUpOn: saved.follow_up_on,
      };
      setHistory(target ? [entry, ...history.slice(1)] : [entry, ...history]);
      // The board's cached payload carries outreach state — drop it so the
      // next navigation reflects this event immediately.
      void revalidateBoard();
      setModalFor(null);
      setReason("");
      setFollowUpOn("");
      setReopened(false);
      setRevising(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(null);
    }
  }

  function onClick(action: Action) {
    if (action.needsReason) {
      setReason("");
      setFollowUpOn("");
      setError(null);
      setModalFor(action.value);
      return;
    }
    void log(action.value, null);
  }

  const last = history[0];
  const prompt = modalFor ? MODAL_PROMPTS[modalFor] : undefined;
  const step = reopened ? "reached" : stepFor(last);

  // Revising shows the same set the mislogged event came from, so a wrong
  // "Not a fit" is one click from being right rather than a restart.
  const revisable = last
    ? OUTCOME.some((a) => a.value === last.eventType)
      ? OUTCOME
      : REACHED
    : REACHED;
  const actions = revising ? revisable : step === "outcome" ? OUTCOME : REACHED;

  // The heading is the question, so the buttons read as answers to it
  // rather than as a menu of five unrelated things.
  const question =
    revising && last
      ? `Logged "${LABELS[last.eventType]}" on ${fmtDate(last.occurredAt)}. What should it say?`
      : step === "outcome"
        ? last
          ? `You spoke to them on ${fmtDate(last.occurredAt)}. How did it go?`
          : "How did it go?"
        : "Did you reach them?";

  return (
    <div className="mt-5">
      <p className="eyebrow">Log the outcome</p>

      {step === "done" && !revising ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="font-display text-[15px] font-bold text-ink">
            {last?.eventType === "converted" ? "★ " : ""}
            {last ? `${LABELS[last.eventType]} on ${fmtDate(last.occurredAt)}` : ""}
          </p>
          <button
            type="button"
            onClick={() => setRevising(true)}
            className="font-display text-[13px] font-semibold text-brand hover:underline"
          >
            Change this
          </button>
          <button
            type="button"
            onClick={() => setReopened(true)}
            className="font-display text-[13px] font-semibold text-ink-muted hover:text-brand hover:underline"
          >
            Log something new →
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-[14px] text-ink">{question}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            {actions.map((action) => (
              <button
                key={action.value}
                type="button"
                disabled={pending !== null}
                onClick={() => onClick(action)}
                className={`rounded-[8px] px-5 py-2.5 font-display text-[13px] font-semibold transition-colors disabled:opacity-50 ${action.tone}`}
              >
                {pending === action.value && !modalFor ? "Saving…" : action.label}
              </button>
            ))}
            {revising || reopened ? (
              <button
                type="button"
                onClick={() => {
                  setRevising(false);
                  setReopened(false);
                }}
                className="font-display text-[13px] font-semibold text-ink-muted hover:text-brand hover:underline"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </>
      )}

      {error && !modalFor ? (
        <p className="mt-2.5 text-[13px] font-semibold text-tier-poor-fg">
          Could not save: {error}
        </p>
      ) : null}

      {last && step !== "done" ? (
        <p className="mt-2.5 text-[12px] text-ink-muted">
          Last action: {LABELS[last.eventType]} · {fmtDate(last.occurredAt)}
          {last.followUpOn ? ` · circling back ${fmtDate(last.followUpOn)}` : ""}
          {last.notes ? ` — ${last.notes}` : ""}
          {!revising ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => setRevising(true)}
                className="font-display font-semibold text-brand hover:underline"
              >
                Change
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {/* ── Reason dialog — brand-kit popup, no page change ── */}
      {modalFor && prompt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-6"
          onClick={() => setModalFor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={prompt.title}
            className="w-full max-w-[460px] rounded-[16px] bg-white p-6 shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
              <p className="eyebrow">Log the outcome</p>
            </div>
            <h3 className="mt-3 font-display text-[18px] font-bold tracking-[-0.4px] text-ink">
              {prompt.title}
            </h3>
            {prospectName ? (
              <p className="mt-1 text-[13px] text-ink-muted">{prospectName}</p>
            ) : null}

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
              rows={3}
              placeholder={prompt.placeholder}
              className="mt-4 w-full rounded-[12px] border border-hairline bg-canvas p-3 text-[14px] text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />

            {prompt.askDate ? (
              <div className="mt-3">
                <label className="eyebrow block" htmlFor="follow-up-date">
                  When To Circle Back
                </label>
                <input
                  id="follow-up-date"
                  type="date"
                  value={followUpOn}
                  onChange={(e) => setFollowUpOn(e.target.value)}
                  className="mt-1.5 rounded-[12px] border border-hairline bg-canvas px-3 py-2.5 font-display text-[14px] text-ink focus:border-brand focus:outline-none"
                />
              </div>
            ) : null}

            <p className="mt-1.5 text-[12px] text-ink-muted">
              This is stored with the prospect and feeds scoring recalibration.
            </p>

            {error ? (
              <p className="mt-2 text-[13px] font-semibold text-tier-poor-fg">
                Could not save: {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalFor(null)}
                className="rounded-[8px] border border-hairline bg-white px-5 py-2.5 font-display text-[13px] font-semibold text-ink-muted transition-colors hover:bg-surface-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void log(modalFor, reason.trim() || null)}
                className="rounded-[8px] bg-brand px-5 py-2.5 font-display text-[13px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save Outcome"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
