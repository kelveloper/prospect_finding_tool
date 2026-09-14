"use client";

import BookView from "./BookView";
import CandidateDetail from "./CandidateDetail";
import CandidateSlideOver from "./CandidateSlideOver";
import Scoreboard from "./Scoreboard";
import {
  closeEntry,
  openEntry,
  setPlaced,
  useBoardState,
  type BoardState,
} from "@/lib/boardState";
import { useDossier, type Dossier } from "@/lib/dossier";
import type { Candidate } from "@/lib/data";
import { BOOK_VIEW } from "@/lib/view";

type Props = {
  ranked: Candidate[];
  /** Layout, placement and open entry as the server read them out of the
   *  URL. From the first click onwards the state store leads. */
  initial: BoardState;
  /** Who the server fetched a dossier for, and the dossier itself, so the
   *  first paint is complete without a client round-trip. */
  seedId: string | null;
  seed: Dossier;
};

/** The scoreboard's two layouts and the detail they share.
 *
 *  Both live in one client tree so switching between them is a state change,
 *  not a navigation: the ~1,200 ranked rows are fetched once by the server
 *  page and re-read here, and the dossier cache carries across, so the
 *  toggle repaints in a frame.
 *
 *  The two layouts read the URL differently on purpose. The board always has
 *  someone in its panel — it is a list beside a profile, and an empty half
 *  is not a view anyone asked for. The book opens an entry only when `?entry=`
 *  says so, so switching into it lands on the spread, marked at the line you
 *  were reading, rather than on a panel covering the spread you came for. */
export default function Board({ ranked, initial, seedId, seed }: Props) {
  const { layout, id, entry } = useBoardState(initial);
  const book = layout === BOOK_VIEW;

  const shownId = book ? entry : (id ?? ranked[0].id);
  const dossier = useDossier(shownId, seedId, seed);
  /* The ranked row arrives instantly and the dossier takes 125–170ms, so
     between the two the panel has a name and nothing else — every section
     renders empty and then expands, which is the jump. */
  const loading = shownId !== null && dossier === null;

  // Fall back to the ranked row while the dossier is in flight, so the panel
  // names the right prospect from the first frame.
  const featured = shownId
    ? (dossier?.detail?.candidate ??
      ranked.find((c) => c.id === shownId) ??
      ranked[0])
    : undefined;

  if (!book)
    return (
      <Scoreboard
        ranked={ranked}
        selectedId={shownId as string}
        dossier={dossier}
        onSelect={setPlaced}
      />
    );

  const rank = featured ? ranked.findIndex((c) => c.id === featured.id) + 1 : 0;
  const detail = dossier?.detail;

  return (
    <>
      {/* Placement marks the line even with the panel shut, so the book
          always shows where the reader left off. */}
      <BookView ranked={ranked} placedId={entry ?? id} onOpen={openEntry} />

      {featured ? (
        <CandidateSlideOver
          label={featured.name}
          rank={rank}
          onClose={closeEntry}
        >
          <CandidateDetail
            candidate={featured}
            profile={detail?.profile}
            dossier={
              detail
                ? {
                    fieldChanges: detail.fieldChanges,
                    scoreHistory: detail.scoreHistory,
                  }
                : undefined
            }
            contactKit={dossier?.contactKit}
            signals={detail?.signals}
            loading={loading}
            outreach={dossier?.outreach}
            rank={rank}
            total={ranked.length}
            headingLevel={2}
          />
        </CandidateSlideOver>
      ) : null}
    </>
  );
}
