"use client";

import { useState } from "react";
import type { FeedbackEntry } from "@/lib/data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const VERDICTS: { value: FeedbackEntry["verdict"]; label: string; tone: string }[] = [
  { value: "good_fit", label: "Good Fit", tone: "bg-tier-strong-bg text-tier-strong-fg" },
  { value: "revisit_later", label: "Revisit Later", tone: "bg-tier-neutral-bg text-tier-neutral-fg" },
  { value: "not_fit", label: "Not a Fit", tone: "bg-tier-poor-bg text-tier-poor-fg" },
];

function verdictLabel(verdict: FeedbackEntry["verdict"]): string {
  return VERDICTS.find((v) => v.value === verdict)?.label ?? verdict;
}

export default function FeedbackPanel({
  prospectId,
  initialHistory,
}: {
  prospectId: string;
  initialHistory: FeedbackEntry[];
}) {
  const [history, setHistory] = useState(initialHistory);
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(verdict: FeedbackEntry["verdict"]) {
    setPending(verdict);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_id: prospectId,
          verdict,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const saved = await res.json();
      setHistory([
        { id: saved.id, verdict: saved.verdict, notes: saved.notes, createdAt: saved.created_at },
        ...history,
      ]);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save feedback");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="mt-6 rounded-[16px] bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-surface-soft px-6 py-4">
        <span className="h-4 w-[3px] shrink-0 rounded-full bg-brand" />
        <h2 className="eyebrow">Advisor Feedback</h2>
      </div>

      <div className="p-6">
        <p className="text-[13px] text-ink-muted">
          Your verdict is stored with this prospect and feeds future scoring calibration.
        </p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes — why is this a good or bad fit?"
          rows={2}
          className="mt-4 w-full rounded-[12px] border border-hairline bg-canvas p-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap gap-3">
          {VERDICTS.map((v) => (
            <button
              key={v.value}
              type="button"
              disabled={pending !== null}
              onClick={() => submit(v.value)}
              className={`rounded-[8px] px-5 py-2.5 font-display text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50 ${v.tone}`}
            >
              {pending === v.value ? "Saving…" : v.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-3 text-[13px] font-semibold text-tier-poor-fg">
            Could not save feedback: {error}. Is the backend running on {API_URL}?
          </p>
        ) : null}

        {history.length > 0 ? (
          <div className="mt-6">
            <h3 className="eyebrow">History</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-[12px] bg-canvas px-4 py-3"
                >
                  <span className="rounded-full bg-white px-2.5 py-1 font-display text-[11px] font-semibold text-ink shadow-raised">
                    {verdictLabel(entry.verdict)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">
                    {entry.notes ?? "No notes"}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-faint">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
