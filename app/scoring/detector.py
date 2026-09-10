"""Signal detection: turn a resolved prospect profile into scored signals.

Seven signal types:
- PHYSICIAN — licence standing (the gate's evidence; it carries no points)
- SPECIALTY — how much money the specialty makes (value)
- CAREER_STAGE — where in the career they are (value; a state, never a trigger)
- OWNERSHIP — do they own the practice, discounted by tenure (value)
- NEW_LICENSE — a licence issued recently (timing)
- PROPERTY_EVENT — a deed transfer (timing)
- CAREER_ADVANCEMENT — a billing-group change; a group carrying the
  doctor's own surname means they formed their practice (timing)

Value signals carry a 0–1 strength that the engine multiplies by a point
budget. Timing signals bake the half-life decay into their strength, so the
engine can score stored rows without knowing today's date (the detail page
recomputes components from stored rows).
"""
from dataclasses import dataclass
from datetime import date

from app.identity.resolver import ResolvedProspect

SIGNAL_TYPES = (
    "CAREER_STAGE",
    "NEW_LICENSE",
    "PHYSICIAN",
    "SPECIALTY",
    "OWNERSHIP",
    "PROPERTY_EVENT",
    "CAREER_ADVANCEMENT",
)

# ── Specialty: wealth tier ───────────────────────────────────
# Source: Medscape Physician Wealth & Debt Report, "Specialists in the
# over-$5 million wealth tier" — the share of each specialty with a net
# worth above $5M, scaled so the top (radiology and orthopaedics, 39%) is
# 1.0. Neurosurgery is absent from the chart and kept at 1.0 on
# compensation. Decided 2026-09-09; the table before that was hand-set.
SPECIALTY_TIERS: dict[str, float] = {
    "radiology": 1.0,
    "orthopaedic surgery": 1.0,
    "orthopedic surgery": 1.0,
    "neurological surgery": 1.0,
    "cardiovascular disease": 0.9,
    "cardiology": 0.9,
    "anesthesiology": 0.8,
    "plastic surgery": 0.75,
    "otolaryngology": 0.7,
    "obstetrics & gynecology": 0.65,
    "urology": 0.65,
    "surgery": 0.65,
    "gastroenterology": 0.6,
    "ophthalmology": 0.6,
    "nephrology": 0.55,
    "pathology": 0.55,
    "nuclear medicine": 0.55,
    "preventive medicine": 0.55,
    "emergency medicine": 0.5,
    "allergy & immunology": 0.45,
    "pulmonary disease": 0.4,
    "infectious disease": 0.4,
    "internal medicine": 0.4,
    "hospitalist": 0.4,
    "endocrinology": 0.4,
    "oncology": 0.35,
    "hematology": 0.35,
    "neurology": 0.35,
    "dermatology": 0.35,
    "psychiatry": 0.3,
    "critical care": 0.3,
    "family medicine": 0.3,
    "pediatrics": 0.25,
    "physical medicine": 0.25,
    "rheumatology": 0.25,
}
# The chart's "Other" bucket (19%) — unlisted specialties are not assumed poor
DEFAULT_SPECIALTY_STRENGTH = 0.5

# ── Ownership: entity strength × tenure ──────────────────────
PROFESSIONAL_ENTITY_TYPES = {"PLLC", "PC", "SC"}
ENTITY_STRENGTH_PROFESSIONAL = 1.0   # an active PLLC / PC / SC earns the full 25
ENTITY_STRENGTH_OTHER = 0.6          # LLC / LTD / anything else
ENTITY_INACTIVE_FACTOR = 0.6
# Ownership at three years in practice is emergence; at twenty it is an
# established practice the pitch is too late for. Years since enumeration.
TENURE_FACTORS: tuple[tuple[float, float], ...] = (
    (10, 1.0),
    (20, 0.6),
    (float("inf"), 0.3),
)
TENURE_UNKNOWN_FACTOR = 0.6

# ── Career stage: a hump, not a ramp ─────────────────────────
# Money arrives mid-career (Medscape: 96% of physicians under 35 are below
# $1M net worth) and the advisor arrives late (ACP: two thirds of those 17+
# years in already have one). The window is between.
CAREER_STAGE_MAX = 30
CAREER_STAGE_BANDS: tuple[tuple[float, int, str], ...] = (
    (3, 5, "first attending years"),
    (5, 15, "early attending"),
    (15, 30, "peak accumulation years"),
    (20, 20, "established"),
    (float("inf"), 10, "late career"),
)
CAREER_STAGE_UNKNOWN_POINTS = 15

# ── Timing events ────────────────────────────────────────────
# An event loses half its value every year
HALF_LIFE_MONTHS = 12.0
# A licence issued 3+ years after entering practice is a relocation — an
# established physician rebuilding financial relationships. Earlier than
# that it is a residency graduate: debt, not assets.
NEW_LICENSE_ESTABLISHED_YEARS = 3
NEW_LICENSE_FRACTION_ESTABLISHED = 1.0   # 60 × 1.0
NEW_LICENSE_FRACTION_EARLY = 0.5         # 60 × 0.5 = 30
# Fraction of the 100-point career weight each kind of event earns
CAREER_EVENT_FRACTIONS: dict[str, float] = {
    "OWN_PRACTICE": 1.0,   # new PLLC / PC / SC billing group carrying the doctor's surname
    "OWN_ENTITY": 0.6,     # a surname-carrying LLC / LTD — the same discount the value side uses
    "PARTNER": 1.0,        # announced senior role — no live source today
    "GROUP_CHANGE": 0.3,   # employer's billing group changed
    "FACILITY": 0.3,       # new facility affiliation
}
SENIOR_ROLE_KEYWORDS = ("partner", "director", "chief", "chair", "president", "founder")


def specialty_tier(specialty: str) -> float:
    """Tier lookup tolerant of NPPES compound descriptions like
    'Orthopaedic Surgery, Adult Reconstructive Orthopaedic Surgery'."""
    s = specialty.lower()
    if s in SPECIALTY_TIERS:
        return SPECIALTY_TIERS[s]
    base = s.split(",")[0].strip()
    if base in SPECIALTY_TIERS:
        return SPECIALTY_TIERS[base]
    for key, tier in SPECIALTY_TIERS.items():
        if key in s:
            return tier
    return DEFAULT_SPECIALTY_STRENGTH


def recency_strength(event_date: date | None, reference_date: date) -> float:
    """Half-life decay: 1.0 today, 0.5 a year on, 0.25 at two years."""
    if event_date is None:
        return 0.0
    months = (reference_date - event_date).days / 30.44
    if months < 0:
        return 0.0
    return round(0.5 ** (months / HALF_LIFE_MONTHS), 4)


def years_between(start: date, end: date) -> float:
    return (end - start).days / 365.25


def years_in_practice(
    enumeration_date: date | None,
    license_issue_date: date | None,
    reference_date: date,
) -> float | None:
    """Years since the physician entered practice: NPI enumeration first,
    the licence issue date as a fallback, None when neither is known."""
    start = enumeration_date or license_issue_date
    if start is None:
        return None
    return max(0.0, years_between(start, reference_date))


def tenure_factor(years: float | None) -> float:
    if years is None:
        return TENURE_UNKNOWN_FACTOR
    for upper, factor in TENURE_FACTORS:
        if years < upper:
            return factor
    return TENURE_FACTORS[-1][1]


def career_stage(years: float | None) -> tuple[int, str]:
    """Points out of CAREER_STAGE_MAX and the band's name."""
    if years is None:
        return CAREER_STAGE_UNKNOWN_POINTS, "career stage unknown"
    for upper, points, label in CAREER_STAGE_BANDS:
        if years < upper:
            return points, label
    return CAREER_STAGE_BANDS[-1][1], CAREER_STAGE_BANDS[-1][2]


def entity_strength(entity_type: str | None, entity_status: str | None) -> float:
    professional = (entity_type or "").upper() in PROFESSIONAL_ENTITY_TYPES
    active = (entity_status or "").upper() == "ACTIVE"
    strength = ENTITY_STRENGTH_PROFESSIONAL if professional else ENTITY_STRENGTH_OTHER
    return strength if active else strength * ENTITY_INACTIVE_FACTOR


def _age_text(event_date: date | None, reference_date: date) -> str:
    if event_date is None:
        return "date unknown"
    months = int((reference_date - event_date).days / 30.44)
    if months <= 0:
        return "this month"
    if months <= 36:
        return f"{months} month(s) ago"
    return f"{months // 12} year(s) ago"


@dataclass(frozen=True)
class DetectedSignal:
    signal_type: str
    source: str
    description: str
    strength: float      # 0.0 - 1.0
    confidence: float    # 0.0 - 1.0
    event_date: date | None = None


class SignalDetector:
    def detect(
        self, prospect: ResolvedProspect, reference_date: date
    ) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        corroborated = len(prospect.records) > 1
        base_confidence = 0.95 if corroborated else 0.75
        years = years_in_practice(
            prospect.enumeration_date, prospect.license_issue_date, reference_date
        )

        # PHYSICIAN — licence standing. The gate reads license_status
        # directly; this signal is the evidence the UI and summaries show.
        active = (prospect.license_status or "").upper().startswith("ACTIVE")
        if active:
            physician_desc = "Licensed physician with an active state license"
            physician_strength = 1.0
        elif prospect.license_status:
            physician_desc = (
                f"Physician with {prospect.license_status.lower()} license status"
            )
            physician_strength = 0.5
        else:
            physician_desc = "Physician identified via NPI registry (license unverified)"
            physician_strength = 0.7
        signals.append(
            DetectedSignal(
                signal_type="PHYSICIAN",
                source="idfpr" if prospect.license_status else "npi",
                description=physician_desc,
                strength=physician_strength,
                confidence=base_confidence,
            )
        )

        # SPECIALTY — wealth tier
        if prospect.specialty:
            tier = specialty_tier(prospect.specialty)
            signals.append(
                DetectedSignal(
                    signal_type="SPECIALTY",
                    source=prospect.records[0].source,
                    description=(
                        f"Specialty: {prospect.specialty} "
                        f"({'high' if tier >= 0.75 else 'moderate' if tier >= 0.5 else 'standard'} "
                        "wealth tier)"
                    ),
                    strength=tier,
                    confidence=base_confidence,
                )
            )

        # CAREER_STAGE — always emitted; a state, so it never dates
        points, band = career_stage(years)
        if years is None:
            stage_desc = "Years in practice unknown — scored as mid-career"
        else:
            anchor = (
                f"NPI enumerated {prospect.enumeration_date:%Y}"
                if prospect.enumeration_date
                else f"licensed {prospect.license_issue_date:%Y}"
            )
            stage_desc = f"In practice {int(years)} year(s) ({anchor}) — {band}"
        signals.append(
            DetectedSignal(
                signal_type="CAREER_STAGE",
                source="npi" if prospect.enumeration_date or not prospect.license_issue_date else "idfpr",
                description=stage_desc,
                strength=round(points / CAREER_STAGE_MAX, 3),
                confidence=0.9,
            )
        )

        # NEW_LICENSE — a licence date is a trigger; whose trigger depends on
        # how far into the career it came
        if prospect.license_issue_date:
            gap = (
                years_between(prospect.enumeration_date, prospect.license_issue_date)
                if prospect.enumeration_date
                else None
            )
            established = gap is not None and gap >= NEW_LICENSE_ESTABLISHED_YEARS
            fraction = (
                NEW_LICENSE_FRACTION_ESTABLISHED
                if established
                else NEW_LICENSE_FRACTION_EARLY
            )
            decay = recency_strength(prospect.license_issue_date, reference_date)
            signals.append(
                DetectedSignal(
                    signal_type="NEW_LICENSE",
                    source="idfpr",
                    description=(
                        f"Illinois license issued {_age_text(prospect.license_issue_date, reference_date)}"
                        + (
                            " — established physician, new to Illinois"
                            if established
                            else " — first license"
                        )
                    ),
                    strength=round(fraction * decay, 4),
                    confidence=0.95,
                    event_date=prospect.license_issue_date,
                )
            )

        signals.extend(self._enrichment_signals(prospect, reference_date, years))
        return signals

    def _enrichment_signals(
        self,
        prospect: ResolvedProspect,
        reference_date: date,
        years: float | None,
    ) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        for record in prospect.enrichments:
            age = _age_text(record.event_date, reference_date)

            if record.kind == "ENTITY":
                strength = round(
                    entity_strength(record.entity_type, record.entity_status)
                    * tenure_factor(years),
                    3,
                )
                tenure = (
                    f"{int(years)} years in practice" if years is not None else "tenure unknown"
                )
                if record.source == "pecos":
                    # Inference from Medicare billing, not a registry record
                    description = (
                        f"Bills Medicare under own entity '{record.entity_name}' "
                        f"(name-matched billing group; {tenure})"
                    )
                    confidence = 0.7
                else:
                    description = (
                        f"Registered {record.entity_type} '{record.entity_name}' "
                        f"formed {age} ({tenure})"
                    )
                    confidence = 0.85
                signals.append(
                    DetectedSignal(
                        signal_type="OWNERSHIP",
                        source=record.source,
                        description=description,
                        strength=strength,
                        confidence=confidence,
                        event_date=record.event_date,
                    )
                )
            elif record.kind == "PROPERTY":
                recency = recency_strength(record.event_date, reference_date)
                price = (
                    f" for ${record.sale_price:,}" if record.sale_price else ""
                )
                signals.append(
                    DetectedSignal(
                        signal_type="PROPERTY_EVENT",
                        source=record.source,
                        description=(
                            f"Purchased property at {record.property_address}{price}, {age}"
                        ),
                        strength=recency,
                        confidence=0.8,
                        event_date=record.event_date,
                    )
                )
            elif record.kind == "CAREER":
                recency = recency_strength(record.event_date, reference_date)
                if record.source == "pecos":
                    kind = record.career_kind or "GROUP_CHANGE"
                    if kind == "OWN_PRACTICE":
                        description = (
                            f"Formed own practice — now bills Medicare under "
                            f"'{record.organization}', {age}"
                        )
                    elif kind == "OWN_ENTITY":
                        description = (
                            f"Formed own company (not a medical practice) — now bills "
                            f"Medicare under '{record.organization}', {age}"
                        )
                    else:
                        # role_title carries the event description
                        # ("Started billing under new group '…'")
                        description = f"{record.role_title}, {age}"
                    confidence = 0.9
                else:
                    role = (record.role_title or "").lower()
                    kind = (
                        "PARTNER"
                        if any(k in role for k in SENIOR_ROLE_KEYWORDS)
                        else "GROUP_CHANGE"
                    )
                    description = f"Named {record.role_title} at {record.organization}, {age}"
                    confidence = 0.75
                signals.append(
                    DetectedSignal(
                        signal_type="CAREER_ADVANCEMENT",
                        source=record.source,
                        description=description,
                        strength=round(CAREER_EVENT_FRACTIONS[kind] * recency, 4),
                        confidence=confidence,
                        event_date=record.event_date,
                    )
                )
        return signals
