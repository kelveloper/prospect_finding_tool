"""Rescore CLI — re-run detection and scoring over the stored book.

    python -m app.scoring --rescore                 # rewrite every score
    python -m app.scoring --rescore --dry-run       # compute, print, write nothing
    python -m app.scoring --rescore --histogram     # add the Priority distribution
    python -m app.scoring --rescore --reference-date 2026-09-09

Use it when the formula changes: the next sweep would re-score everyone
anyway, but this switches the board today. Every prospect gets one new
score_history snapshot whose movement is the formula, not the world —
the board's "What changed" alert will light up once.

What it rebuilds from stored data, honestly:
- identity: the columns as they stand (no re-resolution; one `npi` record
  plus an `idfpr` record when a licence status exists, so the detector's
  corroboration confidence matches a real sweep)
- ownership: from `affiliation_snapshots`, exactly as a sweep infers it
- career events: from `career_events`, exactly as a sweep reads them
- property purchases: from the stored PROPERTY_EVENT signal rows (date from
  the row; address and price parsed back out of the description)
It cannot recover an enrichment a past sweep dropped, and it cannot
change identity confidence. Follow it with `python -m app.summaries
--stale` (never `--all`: LLM-written summaries would be overwritten).
"""
import argparse
import re
from collections import Counter
from datetime import date, datetime

from sqlalchemy import select

from app.adapters.base import EnrichmentRecord, RawProviderRecord
from app.database import SessionLocal
from app.identity.resolver import ResolvedProspect
from app.models import AffiliationSnapshot, Prospect
from app.services.pecos_sync import PECOSService
from app.services.pipeline import IngestionPipeline

_PROPERTY = re.compile(r"Purchased property at (?P<address>.+?)(?: for \$(?P<price>[\d,]+))?, ")


def _profile(prospect: Prospect, pecos: PECOSService) -> ResolvedProspect:
    profile = ResolvedProspect(
        first_name=prospect.first_name,
        last_name=prospect.last_name,
        specialty=prospect.specialty,
        state=prospect.state,
        npi=prospect.npi,
        enumeration_date=prospect.enumeration_date,
        license_number=prospect.license_number,
        license_issue_date=prospect.license_issue_date,
        license_status=prospect.license_status,
        address_line=prospect.address_line,
        city=prospect.city,
        address_state=prospect.address_state,
        zip_code=prospect.zip_code,
        phone=prospect.phone,
        identity_confidence=prospect.identity_confidence,
    )
    profile.records.append(
        RawProviderRecord(
            source="npi", source_record_id=prospect.npi or prospect.id,
            first_name=prospect.first_name, last_name=prospect.last_name,
            state=prospect.state, npi=prospect.npi,
            enumeration_date=prospect.enumeration_date,
        )
    )
    if prospect.license_status:
        profile.records.append(
            RawProviderRecord(
                source="idfpr", source_record_id=prospect.license_number or prospect.id,
                first_name=prospect.first_name, last_name=prospect.last_name,
                state=prospect.state, license_number=prospect.license_number,
                license_issue_date=prospect.license_issue_date,
                license_status=prospect.license_status,
            )
        )

    if prospect.npi:
        names = {prospect.npi: (prospect.first_name, prospect.last_name)}
        groups = pecos.db.scalars(
            select(AffiliationSnapshot).where(
                AffiliationSnapshot.npi == prospect.npi,
                AffiliationSnapshot.kind == "group",
            )
        )
        current = {
            prospect.npi: [("group", g.item_key, g.item_name) for g in groups]
        }
        profile.enrichments.extend(pecos._ownership_inferences(current, names))
        profile.enrichments.extend(pecos._career_records(names))

    for s in prospect.signals:
        if s.signal_type != "PROPERTY_EVENT":
            continue
        m = _PROPERTY.match(s.description or "")
        profile.enrichments.append(
            EnrichmentRecord(
                source=s.source, source_record_id=s.id, kind="PROPERTY",
                owner_first_name=prospect.first_name, owner_last_name=prospect.last_name,
                state=prospect.state, event_date=s.event_date,
                property_address=m.group("address") if m else s.description,
                sale_price=int(m.group("price").replace(",", "")) if m and m.group("price") else None,
            )
        )
    return profile


def _histogram(prospects: list[Prospect]) -> str:
    scores = sorted((p.total_score for p in prospects), reverse=True)
    buckets = Counter(int(s // 5) * 5 for s in scores)
    lines = ["Priority distribution (5-point buckets):"]
    for lo in range(0, 100, 5):
        n = buckets.get(lo, 0)
        lines.append(f"  {lo:3d}-{lo + 5:<3d} {'#' * (n // 5):<50s} {n}")
    ranked = [s for s in scores if s > 0]
    if ranked:
        for share in (0.05, 0.20, 0.50, 0.80):
            lines.append(f"  top {int(share * 100):2d}% cut falls at {ranked[max(0, int(len(ranked) * share) - 1)]:.1f}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.scoring")
    parser.add_argument("--rescore", action="store_true", help="re-run detection and scoring for every prospect")
    parser.add_argument("--dry-run", action="store_true", help="compute and report, write nothing")
    parser.add_argument("--histogram", action="store_true", help="print the Priority distribution")
    parser.add_argument("--reference-date", metavar="YYYY-MM-DD", help="score as of this date (default today)")
    args = parser.parse_args(argv)
    if not args.rescore:
        parser.print_help()
        return 2

    reference_date = (
        datetime.strptime(args.reference_date, "%Y-%m-%d").date()
        if args.reference_date
        else date.today()
    )
    db = SessionLocal()
    try:
        pipeline = IngestionPipeline(sources=[])
        pecos = PECOSService(db)
        prospects = list(db.scalars(select(Prospect)))
        before = {p.id: p.total_score for p in prospects}
        gated = moved = 0
        for prospect in prospects:
            profile = _profile(prospect, pecos)
            pipeline.store_scores(prospect, profile, reference_date)
            if prospect.total_score == 0.0:
                gated += 1
            if abs(prospect.total_score - before[prospect.id]) >= 0.05:
                moved += 1
        top = sorted(prospects, key=lambda p: -p.total_score)[:10]
        print(f"Rescored {len(prospects)} prospects as of {reference_date}: {moved} moved, {gated} not ranked (licence not active)")
        print("Top 10:")
        for i, p in enumerate(top, 1):
            print(f"  #{i:<3} {p.full_name[:28]:28s} {(p.specialty or '')[:22]:22s} value {p.qualification_score:5.1f}  timing {p.timing_score:5.1f}  priority {p.total_score:5.1f}")
        if args.histogram:
            print(_histogram(prospects))
        if args.dry_run:
            db.rollback()
            print("Dry run — nothing written.")
        else:
            db.commit()
            print("Written. Next: python -m app.summaries --stale")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
