/**
 * One prospect's full dossier, fetched on demand and kept.
 *
 * Both detail panels read through this — the board's fixed panel and the
 * book's slide-over — so the cache is shared between them: opening someone
 * in the book and then switching to the board shows them with no fetch at
 * all, and a layout switch never re-requests what is already in hand.
 *
 * A dossier is a few KB. Changing which prospect is on screen used to be a
 * server navigation, which re-sent all ~1,200 ranked rows to do it.
 */

import { useEffect, useReducer, useState } from "react";
import {
  fetchCandidateDetail,
  fetchContactKit,
  fetchOutreachHistory,
  type ContactKit,
} from "./api";
import type { OutreachEntry } from "./data";

type DetailData = NonNullable<Awaited<ReturnType<typeof fetchCandidateDetail>>>;

/** Everything a detail panel needs for one prospect, fetched together. */
export type Dossier = {
  detail?: DetailData;
  contactKit?: ContactKit;
  outreach?: OutreachEntry[];
};

/**
 * The dossier for `id`, or null while it is still in flight — callers fall
 * back to the ranked row so the panel has something to draw immediately.
 *
 * `seed` is the server-rendered dossier for `seedId`, so the first paint is
 * complete without a client round-trip.
 */
export function useDossier(
  id: string | null,
  seedId: string | null,
  seed: Dossier,
): Dossier | null {
  const [cache, setCache] = useState<Map<string, Dossier>>(() =>
    seedId ? new Map([[seedId, seed]]) : new Map(),
  );
  const [, loaded] = useReducer((n: number) => n + 1, 0);

  // A refresh — a sweep landed, an outcome was logged — re-renders the page
  // with a fresh dossier for the prospect in the URL. Adopt it and drop
  // everything cached from before it, or a panel keeps showing last week's
  // score.
  const [seen, setSeen] = useState(seed);
  if (seed !== seen) {
    setSeen(seed);
    setCache(seedId ? new Map([[seedId, seed]]) : new Map());
  }

  useEffect(() => {
    if (!id || cache.has(id)) return;
    let live = true;
    void Promise.all([
      fetchCandidateDetail(id),
      fetchContactKit(id),
      fetchOutreachHistory(id),
    ]).then(([detail, contactKit, outreach]) => {
      // Keep the result even if the reader has moved on — they may well come
      // back to it — but only repaint while this is still the one wanted.
      cache.set(id, { detail, contactKit, outreach });
      if (live) loaded();
    });
    return () => {
      live = false;
    };
  }, [id, cache]);

  return id ? (cache.get(id) ?? null) : null;
}
