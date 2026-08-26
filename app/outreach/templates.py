"""Deterministic outreach letter templates — one per trigger type.

Grounded in docs/RESEARCH_CONTACT_OUTREACH.md: educational, congratulatory,
event-anchored letters addressed to the PRACTICE. No LLM — same signals in,
same letter out, auditable like the scoring engine. The advisor edits the
draft before sending; [bracketed] placeholders mark what they must fill in.

PROPERTY_EVENT deliberately has no template: referencing a home purchase
reads as surveillance. It only raises urgency.
"""
import re

QUOTED = re.compile(r"'([^']+)'")


def quoted_name(description: str | None) -> str | None:
    """Pull the entity/group name detector descriptions carry in quotes."""
    match = QUOTED.search(description or "")
    return match.group(1) if match else None


def _salutation(last_name: str) -> str:
    return f"Dear Dr. {last_name},"


def ownership_letter(last_name: str, specialty: str | None, entity: str | None) -> tuple[str, str]:
    practice = f"of {entity}" if entity else "of your own practice"
    field = specialty or "medicine"
    body = (
        f"Congratulations on the launch {practice} — building an independent "
        f"practice is one of the biggest professional and financial steps a "
        f"physician can take.\n\n"
        f"Most new practice owners in {field} run into the same handful of "
        f"avoidable financial mistakes in their first two years: entity and "
        f"tax-election missteps, missed retirement-plan deadlines, and "
        f"under-structured owner compensation. I've enclosed a short one-pager, "
        f"\"Seven tax mistakes new practice owners make,\" that covers them.\n\n"
        f"If any of it raises questions, I'd be glad to talk — no obligation.\n\n"
        f"Respectfully,\n[Your name]\n[Your firm]\n[Your contact details]"
    )
    return _salutation(last_name), body


def career_letter(last_name: str, specialty: str | None, organization: str | None) -> tuple[str, str]:
    move = f"your move to {organization}" if organization else "your recent career move"
    body = (
        f"Congratulations on {move}.\n\n"
        f"A change of employer is one of the few moments when a physician has "
        f"to make retirement-plan decisions on a deadline: what to do with the "
        f"old 401(k)/403(b), how to make the most of the new plan's match and "
        f"vesting rules, and whether a rollover makes sense. Decisions made "
        f"by default in the first weeks are often the costly ones.\n\n"
        f"I've enclosed a short checklist for physicians changing employers. "
        f"If it would help to walk through it, I'd be glad to — no obligation.\n\n"
        f"Respectfully,\n[Your name]\n[Your firm]\n[Your contact details]"
    )
    return _salutation(last_name), body


def new_license_letter(last_name: str, specialty: str | None) -> tuple[str, str]:
    field = specialty or "medicine"
    body = (
        f"Congratulations on your Illinois medical license — and welcome to "
        f"practice in {field}.\n\n"
        f"The first attending years set up the decisions with the longest "
        f"compounding: own-occupation disability coverage while it's cheapest, "
        f"a student-loan strategy (PSLF or refinance) matched to your employer "
        f"type, and reading the fine print of a first contract. I've enclosed "
        f"a short guide written for newly licensed physicians on exactly "
        f"those three.\n\n"
        f"If any of it raises questions, I'd be glad to talk — no obligation.\n\n"
        f"Respectfully,\n[Your name]\n[Your firm]\n[Your contact details]"
    )
    return _salutation(last_name), body


def generic_letter(last_name: str, specialty: str | None) -> tuple[str, str]:
    field = specialty or "medicine"
    body = (
        f"I work with physicians in {field} on the financial questions the "
        f"job doesn't leave time for: tax structure, retirement plans, "
        f"disability coverage, and practice finances.\n\n"
        f"I've enclosed a short introduction to the topics physicians most "
        f"often bring to a first conversation. If any of it is useful, I'd "
        f"be glad to talk — no obligation.\n\n"
        f"Respectfully,\n[Your name]\n[Your firm]\n[Your contact details]"
    )
    return _salutation(last_name), body
