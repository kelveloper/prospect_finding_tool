"use client";

import { useEffect, useState } from "react";
import type { OutreachEntry } from "@/lib/data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type EventType = OutreachEntry["eventType"];

const ACTIONS: {
  value: EventType;
  label: string;
  tone: string;
  needsReason: boolean;
}[] = [
  {
    value: "connected",
    label: "Connected ✓",
    tone: "bg-brand text-white shadow-brand hover:bg-brand-dark",
    needsReason: false,
  },
  {
    value: "not_connected",
    label: "Couldn't Reach",
    tone: "border border-hairline bg-white text-brand hover:bg-surface-soft",
    needsReason: true,
  },
  {
    value: "follow_up_later",
    label: "Follow Up Later",
    tone: "border border-hairline bg-white text-brand hover:bg-surface-soft",
    needsReason: true,
  },
  {
    value: "converted",
    label: "Became Client ★",
    tone: "bg-tier-strong text-white hover:opacity-90",
    needsReason: false,
  },
  {
    value: "not_converted",
    label: "Didn't Work Out",
    tone: "border border-hairline bg-white text-ink-muted hover:bg-surface-soft",
    needsReason: true,
  },
];

const LABELS: Record<EventType, string> = {
  connected: "Connected",
  not_connected: "Couldn't reach",
  follow_up_later: "Follow up later",
  converted: "Became client",
  not_converted: "Didn't work out",
};

const MODAL_PROMPTS: Partial<
  Record<EventType, { title: string; placeholder: string; askDate?: boolean }>
> = {
  not_connected: {
    title: "Couldn't reach — what happened?",
    placeholder: "e.g. Gatekeeper wouldn't transfer; left a message with the front desk",
  },
  follow_up_later: {
    title: "Follow up later — what did they say?",
    placeholder: "e.g. Interested, but wants to talk after bonus season",
    askDate: true,
  },
  not_converted: {
    title: "Didn't work out — why not?",
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
      const res = await fetch(`${API_URL}/prospects/${prospectId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          channel: "phone",
          notes,
          follow_up_on:
            eventType === "follow_up_later" && followUpOn ? followUpOn : null,
        }),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const saved = await res.json();
      setHistory([
        {
          id: saved.id,
          eventType: saved.event_type,
          channel: saved.channel,
          notes: saved.notes,
          occurredAt: saved.occurred_at,
          followUpOn: saved.follow_up_on,
        },
        ...history,
      ]);
      setModalFor(null);
      setReason("");
      setFollowUpOn("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(null);
    }
  }

  function onClick(action: (typeof ACTIONS)[number]) {
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

  return (
    <div className="mt-5">
      <p className="eyebrow">Log The Outcome</p>

      <div className="mt-2.5 flex flex-wrap gap-3">
        {ACTIONS.map((action) => (
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
      </div>

      {error && !modalFor ? (
        <p className="mt-2.5 text-[13px] font-semibold text-tier-poor-fg">
          Could not save: {error}
        </p>
      ) : null}

      {last ? (
        <p className="mt-2.5 text-[12px] text-ink-faint">
          Last action: {LABELS[last.eventType]} · {fmtDate(last.occurredAt)}
          {last.followUpOn ? ` · circling back ${fmtDate(last.followUpOn)}` : ""}
          {last.notes ? ` — ${last.notes}` : ""}
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
              <p className="eyebrow">Log The Outcome</p>
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
              className="mt-4 w-full rounded-[12px] border border-hairline bg-canvas p-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
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

            <p className="mt-1.5 text-[11px] text-ink-faint">
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
