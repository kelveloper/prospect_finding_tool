"""Signal detection: turn a resolved prospect profile into scored signals.

All six spec signal types are active:
- PHYSICIAN, SPECIALTY, NEW_LICENSE from the provider sources (NPI, IDFPR)
- OWNERSHIP from business-entity records (IL Secretary of State)
- PROPERTY_EVENT from deed transfers (Cook County recorder)
- CAREER_ADVANCEMENT from appointment/promotion announcements
"""
from dataclasses import dataclass
from datetime import date

from app.identity.resolver import ResolvedProspect

SIGNAL_TYPES = (
    "NEW_LICENSE",
    "PHYSICIAN",
    "SPECIALTY",
    "OWNERSHIP",
    "PROPERTY_EVENT",
    "CAREER_ADVANCEMENT",
)

# Earning-potential tiers by specialty keyword. Tier strength feeds the
# SPECIALTY signal; unknown specialties fall back to 0.4.
SPECIALTY_TIERS: dict[str, float] = {
    "orthopaedic surgery": 1.0,
    "orthopedic surgery": 1.0,
    "neurological surgery": 1.0,
    "plastic surgery": 1.0,
    "cardiovascular disease": 0.95,
    "dermatology": 0.9,
    "gastroenterology": 0.9,
    "anesthesiology": 0.85,
    "radiology": 0.85,
    "urology": 0.8,
    "oncology": 0.75,
    "emergency medicine": 0.6,
    "internal medicine": 0.45,
    "family medicine": 0.4,
    "pediatrics": 0.4,
}
DEFAULT_SPECIALTY_STRENGTH = 0.4

# Entity types that indicate a professional practice the prospect owns
PROFESSIONAL_ENTITY_TYPES = {"PLLC", "PC", "SC"}

# Seniority of an announced role, for CAREER_ADVANCEMENT strength
SENIOR_ROLE_KEYWORDS = ("partner", "director", "chief", "chair", "president", "founder")
MID_ROLE_KEYWORDS = ("attending", "associate professor", "medical director")


def recency_strength(event_date: date | None, reference_date: date) -> float:
    """Decay curve: how 'fresh' an event is. Drives timing signals."""
    if event_date is None:
        return 0.0
    months = (reference_date - event_date).days / 30.44
    if months < 0:
        return 0.0
    if months <= 6:
        return 1.0
    if months <= 12:
        return 0.85
    if months <= 24:
        return 0.6
    if months <= 36:
        return 0.3
    return 0.1


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

        # PHYSICIAN — professional standing; active license strengthens it
        active = (prospect.license_status or "").upper() == "ACTIVE"
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

        # SPECIALTY — earning-potential tier
        if prospect.specialty:
            tier = SPECIALTY_TIERS.get(
                prospect.specialty.lower(), DEFAULT_SPECIALTY_STRENGTH
            )
            signals.append(
                DetectedSignal(
                    signal_type="SPECIALTY",
                    source=prospect.records[0].source,
                    description=(
                        f"Specialty: {prospect.specialty} "
                        f"({'high' if tier >= 0.75 else 'moderate' if tier >= 0.5 else 'standard'} "
                        "earning potential)"
                    ),
                    strength=tier,
                    confidence=base_confidence,
                )
            )

        # NEW_LICENSE — timing signals from license issue and NPI enumeration
        if prospect.license_issue_date:
            strength = recency_strength(prospect.license_issue_date, reference_date)
            months = int(
                (reference_date - prospect.license_issue_date).days / 30.44
            )
            signals.append(
                DetectedSignal(
                    signal_type="NEW_LICENSE",
                    source="idfpr",
                    description=(
                        f"Illinois license issued {months} month(s) ago"
                        if months <= 36
                        else f"Illinois license issued {months // 12} year(s) ago"
                    ),
                    strength=strength,
                    confidence=0.95,
                    event_date=prospect.license_issue_date,
                )
            )
        if prospect.enumeration_date:
            strength = recency_strength(prospect.enumeration_date, reference_date)
            months = int((reference_date - prospect.enumeration_date).days / 30.44)
            signals.append(
                DetectedSignal(
                    signal_type="NEW_LICENSE",
                    source="npi",
                    description=(
                        f"NPI enumerated {months} month(s) ago "
                        "(recently entered professional practice)"
                        if months <= 36
                        else f"NPI enumerated {months // 12} year(s) ago"
                    ),
                    strength=strength,
                    confidence=0.9,
                    event_date=prospect.enumeration_date,
                )
            )

        signals.extend(self._enrichment_signals(prospect, reference_date))
        return signals

    def _enrichment_signals(
        self, prospect: ResolvedProspect, reference_date: date
    ) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        for record in prospect.enrichments:
            months = (
                int((reference_date - record.event_date).days / 30.44)
                if record.event_date
                else None
            )
            age = f"{months} month(s) ago" if months is not None and months <= 36 else (
                f"{months // 12} year(s) ago" if months is not None else "date unknown"
            )

            if record.kind == "ENTITY":
                professional = (record.entity_type or "").upper() in PROFESSIONAL_ENTITY_TYPES
                active = (record.entity_status or "").upper() == "ACTIVE"
                strength = (0.9 if professional else 0.6) * (1.0 if active else 0.6)
                signals.append(
                    DetectedSignal(
                        signal_type="OWNERSHIP",
                        source=record.source,
                        description=(
                            f"Registered {record.entity_type} '{record.entity_name}' "
                            f"formed {age}"
                        ),
                        strength=strength,
                        confidence=0.85,
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
                role = (record.role_title or "").lower()
                if any(k in role for k in SENIOR_ROLE_KEYWORDS):
                    role_weight = 1.0
                elif any(k in role for k in MID_ROLE_KEYWORDS):
                    role_weight = 0.8
                else:
                    role_weight = 0.5
                recency = recency_strength(record.event_date, reference_date)
                signals.append(
                    DetectedSignal(
                        signal_type="CAREER_ADVANCEMENT",
                        source=record.source,
                        description=(
                            f"Named {record.role_title} at {record.organization}, {age}"
                        ),
                        strength=round(role_weight * recency, 3),
                        confidence=0.75,
                        event_date=record.event_date,
                    )
                )
        return signals
