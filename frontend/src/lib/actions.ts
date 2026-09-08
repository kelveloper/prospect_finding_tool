"use server";

import { updateTag } from "next/cache";
import { BOARD_TAG } from "@/lib/api";

/** Drops the cached ranked board so the next render refetches it. Called
 *  from the client after any mutation that changes what the board shows —
 *  an ingest run (here or in another tab) or a logged outreach event.
 *
 *  `updateTag`, not `revalidateTag(tag, "max")`: the latter serves the
 *  stale board once and refreshes behind it, so the router.refresh() that
 *  follows a sweep showed last week's scores until a second reload. */
export async function revalidateBoard(): Promise<void> {
  updateTag(BOARD_TAG);
}
