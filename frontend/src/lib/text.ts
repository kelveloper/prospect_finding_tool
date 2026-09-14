/** Stored signal copy pluralises as "6 year(s)" — unremarkable in a log,
 *  wrong in bold at the top of a profile. The generator no longer writes it
 *  (see _plural in app/scoring/detector.py), but descriptions are written at
 *  ingest, so every prospect already in the book still carries the old
 *  wording. Tidied on the way out rather than by re-running a sweep. */
export function tidyPlural(text: string): string {
  return text.replace(
    /\b(\d+)\s+([A-Za-z]+)\(s\)/g,
    (_m, n: string, unit: string) =>
      `${n} ${unit}${Number(n) === 1 ? "" : "s"}`,
  );
}

/** A county parcel number is how a deed office finds a property. It is not
 *  how an advisor talks about one, and it was set in the loudest type on the
 *  page — "Purchased property at Cook County PIN 17032200201275 for
 *  $1,100,000". The price and the date are the facts; the identifier is the
 *  receipt, and belongs in the records rather than in the case for calling.
 */
export function tidyParcel(text: string): string {
  return text.replace(/\s+at\s+[A-Za-z .]*PIN\s+[\dA-Za-z-]+/i, "");
}
