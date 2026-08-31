"use server";

import { revalidateTag } from "next/cache";
import { BOARD_TAG } from "@/lib/api";

/** Drops the cached ranked board so the next render refetches it. Called
 *  from the client after any mutation that changes what the board shows —
 *  an ingest run (here or in another tab) or a logged outreach event. */
export async function revalidateBoard(): Promise<void> {
  revalidateTag(BOARD_TAG, "max");
}
