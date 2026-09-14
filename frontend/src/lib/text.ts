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

