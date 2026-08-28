"""Advisor-summary CLI. Reads the database only — never ingests.

    python -m app.summaries --all                # compose for the whole book
    python -m app.summaries <prospect-id>        # compose for one prospect
    python -m app.summaries --export-facts F     # facts JSON for offline LLM
    python -m app.summaries --import-file F      # import LLM-written summaries

Add --stale to --all or --export-facts to touch only prospects that are
new or whose facts changed since their summary was generated — after an
ingest this is a handful, not the whole book. Summaries never bake in
rank (the UI computes it live), so other prospects arriving does NOT
stale an existing summary.

Import file format: [{"prospect_id": "...", "summary": "..."}, ...]
"""
import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Prospect
from app.summaries.composer import apply, compose, is_stale


def _ranked(db) -> list[Prospect]:
    return list(
        db.scalars(select(Prospect).order_by(Prospect.total_score.desc()))
    )


def _facts(prospect: Prospect, rank: int, total: int) -> dict:
    return {
        "prospect_id": prospect.id,
        "name": prospect.full_name,
        "specialty": prospect.specialty,
        "city": prospect.city,
        "state": prospect.state,
        "rank": rank,
        "of": total,
        "total_score": prospect.total_score,
        "qualification_score": prospect.qualification_score,
        "timing_score": prospect.timing_score,
        "license_issue_date": str(prospect.license_issue_date or ""),
        "license_status": prospect.license_status,
        "npi_enumeration_date": str(prospect.enumeration_date or ""),
        "identity_confidence": prospect.identity_confidence,
        "signals": [
            {
                "type": s.signal_type,
                "description": s.description,
                "event_date": str(s.event_date or ""),
                "strength": s.strength,
            }
            for s in prospect.signals
        ],
        "outreach": [
            {
                "event_type": e.event_type,
                "occurred_at": str(e.occurred_at),
                "follow_up_on": str(e.follow_up_on or ""),
                "notes": e.notes,
            }
            for e in prospect.outreach_events
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.summaries")
    parser.add_argument("prospect_id", nargs="?", help="compose for one prospect")
    parser.add_argument("--all", action="store_true", help="compose for every prospect")
    parser.add_argument("--export-facts", metavar="FILE", help="write facts JSON for offline LLM")
    parser.add_argument("--import-file", metavar="FILE", help="import LLM-written summaries JSON")
    parser.add_argument(
        "--stale",
        action="store_true",
        help="limit --all / --export-facts to new or changed prospects",
    )
    args = parser.parse_args(argv)

    db = SessionLocal()
    try:
        prospects = _ranked(db)
        total = len(prospects)
        rank_of = {p.id: i + 1 for i, p in enumerate(prospects)}
        targets = [p for p in prospects if is_stale(p)] if args.stale else prospects

        if args.export_facts:
            payload = [_facts(p, rank_of[p.id], total) for p in targets]
            Path(args.export_facts).write_text(json.dumps(payload, indent=2))
            print(
                f"Exported facts for {len(payload)} of {total} prospects "
                f"→ {args.export_facts}"
            )
            return 0

        if args.import_file:
            items = json.loads(Path(args.import_file).read_text())
            by_id = {p.id: p for p in prospects}
            applied = 0
            for item in items:
                prospect = by_id.get(item["prospect_id"])
                if prospect is None:
                    print(f"skip: unknown prospect {item['prospect_id']}")
                    continue
                apply(prospect, item["summary"], source="llm")
                applied += 1
            db.commit()
            print(f"Imported {applied} LLM summaries ({len(items) - applied} skipped)")
            return 0

        if args.all:
            for p in targets:
                apply(p, compose(p), source="composed")
            db.commit()
            print(f"Composed summaries for {len(targets)} of {total} prospects")
            return 0

        if args.prospect_id:
            prospect = db.get(Prospect, args.prospect_id)
            if prospect is None:
                print(f"Prospect {args.prospect_id} not found", file=sys.stderr)
                return 1
            apply(prospect, compose(prospect), source="composed")
            db.commit()
            print(prospect.advisor_summary)
            return 0

        parser.print_help()
        return 2
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
