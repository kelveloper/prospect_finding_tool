"use client";

import { useEffect, useRef, useState } from "react";
import { revalidateBoard } from "@/lib/actions";
import type { OutreachEntry } from "@/lib/data";
import { StarIcon } from "./icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type EventType = OutreachEntry["eventType"];

type Action = {
  value: EventType;
  label: string;
  tone: string;
  needsReason: boolean;
};

const PRIMARY = "bg-brand text-white shadow-brand hover:bg-brand-dark";
const QUIET =
  "border border-hairline bg-white text-brand hover:bg-surface-soft";
const GOOD = "bg-tier-strong text-white hover:opacity-90";
const MUTED =
  "border border-hairline bg-white text-ink-muted hover:bg-surface-soft";

/** Step 1 — the only thing knowable at the moment of the attempt. */
const REACHED: Action[] = [
  {
    value: "connected",
    label: "Yes, I spoke to them",
    tone: PRIMARY,
    needsReason: false,
  },
  {
    value: "not_connected",
    label: "No, couldn't reach",
    tone: QUIET,
    needsReason: true,
  },
];

/** Not an answer to "did you reach them?" but a way out of the question:
 *  the advisor has looked at this prospect and decided not to call at all.
 *  Offered quietly beneath step 1, because it is the rarer choice and must
 *  not compete with actually making the call. */
const NOT_PURSUED: Action = {
  value: "not_pursued",
  label: "Skip without calling",
  tone: MUTED,
  needsReason: true,
};

/** Why a prospect was not worth calling.
 *
 *  Picked from a list rather than typed, because the point of collecting it
 *  is to count it: free prose says what one advisor thought, a fixed set
 *  says what the board keeps getting wrong. Each one names something the
 *  engine actually decides — specialty, career stage, evidence, identity —
 *  so a pile of them points at the input to retune. */
const COULD_NOT_REACH_REASONS = [
  "Gatekeeper wouldn't transfer",
  "Left a voicemail",
  "No answer",
  "Number wrong or dead",
  "Asked to call back",
  "Other",
] as const;

/** Reached them, and it went nowhere. These are about the prospect rather
 *  than about the board, so they say something the score cannot: whether we
 *  are arriving too late, or at the wrong person entirely. */
const NOT_A_FIT_REASONS = [
  "Already has an advisor",
  "Not interested",
  "Assets are elsewhere",
  "Too early — not accumulating yet",
  "Wrong person",
  "Other",
] as const;

/** Reached them and they are worth another call, just not today. */
const FOLLOW_UP_REASONS = [
  "Busy right now",
  "Wants to think it over",
  "Asked me to call back",
  "Interested, timing is wrong",
  "Other",
] as const;

const NOT_PURSUED_REASONS = [
  "Wrong specialty",
  "Too early in their career",
  "Too established already",
  "Already has an advisor",
  "Identity looks wrong",
  "Evidence too thin",
  "Outside my territory",
  "Other",
] as const;

/** Step 2 — only answerable once they have actually been spoken to, which
 *  is why it is never on screen at the same time as step 1.
 *
 *  These say what pressing them does, not what the prospect is. "They became
 *  a client" was read by a reviewer as "this person already banks with us" —
 *  a fact about the prospect rather than an outcome being recorded — and it
 *  took three exchanges to undo.
 *
 *  The verb carries an object rather than standing alone: "Rule out" was
 *  tried and promises something this does not do. Nothing is removed from
 *  the board — an outcome is only recorded — so a label that sounds like
 *  deletion is a worse lie than the one it replaced. Mark, schedule, skip. */
const OUTCOME: Action[] = [
  {
    value: "converted",
    label: "Mark as client",
    tone: GOOD,
    needsReason: false,
  },
  {
    value: "follow_up_later",
    label: "Schedule a follow-up",
    tone: QUIET,
    needsReason: true,
  },
  {
    value: "not_converted",
    label: "Mark as not a fit",
    tone: MUTED,
    needsReason: true,
  },
];

/** Which question this prospect is actually at.
 *
 *  connected            → they have been reached; ask how it went
 *  converted / not_..   → finished; show the result, offer a way back
 *  anything else        → ask whether this attempt reached them. A
 *                         follow_up_later loops back here on purpose: next
 *                         time round, the advisor is dialing again.
 */
function stepFor(
  last: OutreachEntry | undefined,
): "reached" | "outcome" | "done" {
  if (!last) return "reached";
  if (last.eventType === "connected") return "outcome";
  if (
    last.eventType === "converted" ||
    last.eventType === "not_converted" ||
    last.eventType === "not_pursued"
  )
    return "done";
  return "reached";
}

/** The history line: past tense of the button that wrote it. */
const LABELS: Record<EventType, string> = {
  connected: "Spoke to them",
  not_connected: "Couldn't reach them",
  follow_up_later: "Following up later",
  converted: "Became a client",
  not_converted: "Not a fit",
  not_pursued: "Skipped without calling",
};

const MODAL_PROMPTS: Partial<
  Record<
    EventType,
    {
      title: string;
      placeholder: string;
      askDate?: boolean;
      /** Present when the reason is picked rather than typed, and required. */
      reasons?: readonly string[];
    }
  >
> = {
  not_connected: {
    title: "Couldn't reach them — what happened?",
    placeholder: "Anything else worth knowing (optional)",
    reasons: COULD_NOT_REACH_REASONS,
  },
  follow_up_later: {
    title: "Following up later — what did they say?",
    placeholder: "Anything else worth knowing (optional)",
    askDate: true,
    reasons: FOLLOW_UP_REASONS,
  },
  not_converted: {
    title: "Not a fit — why not?",
    placeholder: "Anything else worth knowing (optional)",
    reasons: NOT_A_FIT_REASONS,
  },
  not_pursued: {
    title: "Skipping them without a call — why?",
    placeholder: "Anything else worth knowing (optional)",
    reasons: NOT_PURSUED_REASONS,
  },
};

/** The API's row, as it comes back from both the save and the history. */
type ApiOutreach = {
  id: string;
  event_type: EventType;
  channel: OutreachEntry["channel"];
  notes: string | null;
  occurred_at: string;
  follow_up_on: string | null;
};

function toEntry(row: ApiOutreach): OutreachEntry {
  return {
    id: row.id,
    eventType: row.event_type,
    channel: row.channel,
    notes: row.notes,
    occurredAt: row.occurred_at,
    followUpOn: row.follow_up_on,
  };
}

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
  // Picked from the prompt's list; the textarea below it is extra detail.
  const [picked, setPicked] = useState<string | null>(null);
  const [followUpOn, setFollowUpOn] = useState("");
  const [pending, setPending] = useState<EventType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reopened, setReopened] = useState(false);
  const [revising, setRevising] = useState(false);
  // What was just written, so the save can be confirmed away from the panel
  // the advisor may already have scrolled past. Cleared on a timer.
  const [confirmed, setConfirmed] = useState<EventType | null>(null);
  // Picking a reason is the last required step, so the button that commits
  // it takes focus — one click and Enter, rather than a click and a hunt.
  const saveButton = useRef<HTMLButtonElement>(null);

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
    setPicked(null);
    setFollowUpOn("");
    setPending(null);
    setError(null);
    setReopened(false);
    setRevising(false);
    setConfirmed(null);
  }

  // After the render that enables it, not during the click that requires it:
  // Save is disabled until a reason is picked, and a disabled button cannot
  // take focus, so calling this from the chip's own handler does nothing.
  useEffect(() => {
    if (picked) saveButton.current?.focus();
  }, [picked]);

  // Long enough to read a line and reach for the correction, short enough
  // that it is gone before it becomes furniture.
  useEffect(() => {
    if (!confirmed) return;
    const done = setTimeout(() => setConfirmed(null), 6000);
    return () => clearTimeout(done);
  }, [confirmed]);

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
      // A revision only holds while the event being revised is still the
      // most recent one. Another tab, another advisor, or a page left open
      // while something else was logged, and this panel is correcting an
      // event the board has since moved past — the backend refuses, and it
      // is right to. Recover rather than report a status code: reload what
      // is actually there, drop out of revising, and say so in words.
      if (res.status === 409) {
        const fresh = await fetch(
          `${API_URL}/prospects/${prospectId}/outreach`,
        );
        if (fresh.ok) {
          const rows: ApiOutreach[] = await fresh.json();
          setHistory(rows.map(toEntry));
        }
        setRevising(false);
        setModalFor(null);
        throw new Error(
          "This prospect was updated somewhere else, so that change would " +
            "have overwritten a newer one. The log below is up to date now — " +
            "log it again if it still needs changing.",
        );
      }
      if (!res.ok) {
        // FastAPI puts the readable half in `detail`; a status code is not
        // something to put in front of an advisor.
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.detail === "string"
            ? body.detail
            : "Could not reach the server. Nothing was saved.",
        );
      }
      const entry = toEntry(await res.json());
      setHistory(target ? [entry, ...history.slice(1)] : [entry, ...history]);
      // The board's cached payload carries outreach state — drop it so the
      // next navigation reflects this event immediately.
      void revalidateBoard();
      setModalFor(null);
      setReason("");
      setPicked(null);
      setFollowUpOn("");
      setReopened(false);
      setRevising(false);
      // The panel's own state has already moved on to the next question by
      // now, which is what left the save unacknowledged: the buttons the
      // advisor just pressed are gone, replaced by different ones. Say what
      // was written, where they are looking.
      setConfirmed(eventType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(null);
    }
  }

  function onClick(action: Action) {
    if (action.needsReason) {
      setReason("");
      setPicked(null);
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
  const revisable = !last
    ? REACHED
    : OUTCOME.some((a) => a.value === last.eventType)
      ? OUTCOME
      : last.eventType === "not_pursued"
        ? [...REACHED, NOT_PURSUED]
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
    <div className="mt-7">
      <p className="section-title mb-2.5">Log the outcome</p>

      {step === "done" && !revising ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex items-center gap-1.5 font-display text-[15px] font-bold text-ink">
            {last?.eventType === "converted" ? (
              <StarIcon className="size-[15px] shrink-0 text-tier-strong-fg" />
            ) : null}
            {last
              ? `${LABELS[last.eventType]} on ${fmtDate(last.occurredAt)}`
              : ""}
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
                className={`rounded-[8px] px-5 py-2.5 font-display text-[13px] font-semibold transition-colors active:scale-[0.97] disabled:scale-100 disabled:opacity-50 ${action.tone}`}
              >
                {pending === action.value && !modalFor
                  ? "Saving…"
                  : action.label}
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

          {/* The way out of the question, rather than an answer to it —
              quiet, because calling is what this panel is for. */}
          {step === "reached" && !revising ? (
            <p className="mt-3 text-[13px] text-ink-muted">
              Not worth a call?{" "}
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => onClick(NOT_PURSUED)}
                className="font-display font-semibold text-brand hover:underline disabled:opacity-50"
              >
                Skip without calling
              </button>
            </p>
          ) : null}
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
          {last.followUpOn
            ? ` · circling back ${fmtDate(last.followUpOn)}`
            : ""}
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

      {/* ── Confirmation ─────────────────────────────────────
          "I clicked on this, this changed, but nothing here changed" — a
          design review, on a click that saved without saying so. The panel
          swaps to the next question on success, which moves the buttons but
          never confirms the write, and on a long profile the log line below
          is often off-screen.

          The way back is "Change this" rather than "Undo": the API has no
          delete, and revising the most recent event is the recovery that
          actually exists. A button promising to undo what it can only
          overwrite would be the worse lie. */}
      {confirmed ? (
        <div
          role="status"
          aria-live="polite"
          className="animate-toast-rise fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-[420px] items-center justify-between gap-4 rounded-[12px] bg-ink px-4 py-3 text-white shadow-panel sm:left-auto sm:right-6 sm:mx-0"
        >
          <p className="min-w-0 text-[13px]">
            <span className="font-display font-semibold">
              {LABELS[confirmed]}
            </span>
            {prospectName ? (
              <span className="text-white/70"> · {prospectName}</span>
            ) : null}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setRevising(true);
                setConfirmed(null);
              }}
              className="rounded-[6px] px-2 py-1 font-display text-[12.5px] font-semibold text-brand-light underline underline-offset-[3px] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-light"
            >
              Change this
            </button>
            <button
              type="button"
              onClick={() => setConfirmed(null)}
              aria-label="Dismiss this confirmation"
              className="rounded-[6px] px-2 py-1 font-display text-[14px] leading-none text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-light"
            >
              ✕
            </button>
          </div>
        </div>
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

            {prompt.reasons ? (
              <fieldset className="mt-4">
                <legend className="eyebrow">Pick the closest reason</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {prompt.reasons.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={picked === option}
                      onClick={() => setPicked(option)}
                      className={
                        "rounded-full border px-3 py-1.5 font-display text-[12px] font-semibold transition-colors " +
                        (picked === option
                          ? "border-brand bg-brand text-white"
                          : "border-hairline bg-white text-brand hover:bg-surface-soft")
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
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
              {prompt.reasons && !picked
                ? "Pick a reason to save this."
                : "This is stored with the prospect and feeds scoring recalibration."}
            </p>

            {error ? (
              <p className="mt-2 text-[13px] font-semibold text-tier-poor-fg">
                Could not save: {error}
              </p>
            ) : null}

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalFor(null)}
                className="rounded-[8px] border border-hairline bg-white px-5 py-2.5 font-display text-[13px] font-semibold text-ink-muted transition-colors hover:bg-surface-soft"
              >
                Cancel
              </button>
              <button
                ref={saveButton}
                type="button"
                disabled={pending !== null || (!!prompt.reasons && !picked)}
                onClick={() =>
                  void log(
                    modalFor,
                    // The picked reason leads so it can be counted; typed
                    // detail follows it.
                    [picked, reason.trim() || null]
                      .filter(Boolean)
                      .join(" — ") || null,
                  )
                }
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
