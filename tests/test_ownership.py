"""OWNERSHIP signal proof — billing-inference mechanism (mirrors live PECOS).

Records are built inline exactly the way live mode earns them: NPI-keyed
entity records inferred from Medicare billing groups. (The registry mock was
removed — no obtainable API for IL SoS data; the paid Cobalt integration
will supply formation dates + official officer records.)"""
from datetime import date

from app.adapters.base import EnrichmentRecord, RawProviderRecord
from app.identity import EnrichmentMatcher, IdentityResolver
from app.scoring import ScoringEngine, SignalDetector

REF = date(2026, 8, 23)


def _npi(npi, first, last, specialty, license_number=None):
    return RawProviderRecord(
        source="npi", source_record_id=npi, first_name=first, last_name=last,
        specialty=specialty, state="IL", npi=npi, license_number=license_number,
        enumeration_date=date(2026, 2, 1),
    )


def _entity(npi, first, last, entity_name, entity_type):
    return EnrichmentRecord(
        source="pecos", source_record_id=f"{npi}-entity", kind="ENTITY",
        owner_first_name=first, owner_last_name=last, state="IL", npi=npi,
        entity_name=entity_name, entity_type=entity_type, entity_status="ACTIVE",
    )


PROVIDER_RECORDS = [
    _npi("1234567801", "John", "Smith", "Orthopaedic Surgery", "036-111111"),
    _npi("1234567804", "Sarah", "Okafor", "Family Medicine", "036-444444"),
]

ENTITY_RECORDS = [
    _entity("1234567801", "John", "Smith", "Smith Orthopedics PLLC", "PLLC"),
    _entity("1234567804", "Sarah", "Okafor", "Okafor Family Care LLC", "LLC"),
    # Trap: an NPI we don't track — must never attach to anyone
    _entity("9999999999", "Gregory", "Palumbo", "Windy City Landscaping LLC", "LLC"),
]


def _resolved_prospects():
    return IdentityResolver().resolve(PROVIDER_RECORDS)


def _attach_entities(prospects):
    matched = EnrichmentMatcher().attach(prospects, ENTITY_RECORDS)
    return ENTITY_RECORDS, matched


def test_ownership_attaches_by_npi():
    prospects = _resolved_prospects()
    _, matched = _attach_entities(prospects)

    smith = next(p for p in prospects if p.last_name == "Smith")
    assert len(smith.enrichments) == 1
    assert smith.enrichments[0].entity_name == "Smith Orthopedics PLLC"

    pecos_matches = [m for m in smith.matches if m.source_b == "pecos"]
    assert len(pecos_matches) == 1
    assert pecos_matches[0].score == 1.0
    assert pecos_matches[0].reason == "NPI match"


def test_unknown_npi_never_attaches():
    prospects = _resolved_prospects()
    entities, matched = _attach_entities(prospects)

    # 3 entities; the Palumbo trap carries an untracked NPI
    assert len(entities) == 3
    assert matched == 2
    attached = {e.entity_name for p in prospects for e in p.enrichments}
    assert "Windy City Landscaping LLC" not in attached


def test_ownership_signal_emitted_and_scored():
    prospects = _resolved_prospects()
    _attach_entities(prospects)
    smith = next(p for p in prospects if p.last_name == "Smith")

    signals = SignalDetector().detect(smith, REF)
    ownership = [s for s in signals if s.signal_type == "OWNERSHIP"]
    assert len(ownership) == 1
    # Billing inference: active PLLC = 0.8 strength, labeled as inference
    assert ownership[0].strength == 0.8
    assert "Bills Medicare under own entity" in ownership[0].description
    assert "Smith Orthopedics PLLC" in ownership[0].description

    without = [s for s in signals if s.signal_type != "OWNERSHIP"]
    engine = ScoringEngine()
    assert (
        engine.score(signals).qualification_score
        > engine.score(without).qualification_score
    )


def test_generic_llc_scores_below_professional_entity():
    detector = SignalDetector()
    prospects = _resolved_prospects()
    _attach_entities(prospects)

    smith = next(p for p in prospects if p.last_name == "Smith")     # PLLC
    okafor = next(p for p in prospects if p.last_name == "Okafor")   # generic LLC

    smith_own = [s for s in detector.detect(smith, REF) if s.signal_type == "OWNERSHIP"]
    okafor_own = [s for s in detector.detect(okafor, REF) if s.signal_type == "OWNERSHIP"]
    assert smith_own[0].strength > okafor_own[0].strength
