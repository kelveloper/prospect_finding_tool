"""THE PROOF: a physician resolved from profession data (NPI + IDFPR) can be
found in an unrelated public dataset (IL SoS business registry) by
deterministic name matching — with near-miss records correctly rejected."""
from datetime import date

from app.adapters import IDFPRDataSource, ILSoSDataSource, NPIDataSource
from app.adapters.base import EnrichmentRecord
from app.identity import EnrichmentMatcher, IdentityResolver
from app.scoring import ScoringEngine, SignalDetector

REF = date(2026, 8, 18)


def _resolved_prospects():
    provider = [*NPIDataSource().fetch(), *IDFPRDataSource().fetch()]
    return IdentityResolver().resolve(provider)


def _attach_entities(prospects):
    entities = list(ILSoSDataSource().fetch())
    matched = EnrichmentMatcher().attach(prospects, entities)
    return entities, matched


def test_physician_found_in_business_registry():
    prospects = _resolved_prospects()
    _, matched = _attach_entities(prospects)

    smith = next(p for p in prospects if p.last_name == "Smith")
    assert len(smith.enrichments) == 1
    entity = smith.enrichments[0]
    assert entity.entity_name == "Smith Orthopedics PLLC"

    # The attachment is auditable: recorded as match evidence with a reason
    il_sos_matches = [m for m in smith.matches if m.source_b == "il_sos"]
    assert len(il_sos_matches) == 1
    assert il_sos_matches[0].score >= 0.8
    assert "exact first and last name" in il_sos_matches[0].reason


def test_near_miss_records_are_rejected():
    prospects = _resolved_prospects()
    entities, matched = _attach_entities(prospects)

    # 4 entity records; Palumbo (no such physician) and nobody named
    # Smithfield exist, so only Smith, Gonzalez, Okafor attach
    assert len(entities) == 4
    assert matched == 3

    attached_entities = {e.entity_name for p in prospects for e in p.enrichments}
    assert "Windy City Landscaping LLC" not in attached_entities

    # "Jonathan Smithfield" must NOT attach to "John Smith"
    smith = next(p for p in prospects if p.last_name == "Smith")
    assert all(e.owner_last_name == "Smith" for e in smith.enrichments)


def test_ownership_signal_emitted_and_scored():
    prospects = _resolved_prospects()
    _attach_entities(prospects)
    smith = next(p for p in prospects if p.last_name == "Smith")

    signals = SignalDetector().detect(smith, REF)
    ownership = [s for s in signals if s.signal_type == "OWNERSHIP"]
    assert len(ownership) == 1
    # Active PLLC (professional entity) = 0.9 strength
    assert ownership[0].strength == 0.9
    assert "Smith Orthopedics PLLC" in ownership[0].description

    # Ownership lifts qualification above an otherwise-identical physician
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


def test_state_mismatch_rejected():
    prospects = _resolved_prospects()
    ny_entity = EnrichmentRecord(
        source="il_sos",
        source_record_id="X-1",
        kind="ENTITY",
        owner_first_name="John",
        owner_last_name="Smith",
        state="NY",
        entity_name="Smith Ortho NY PLLC",
        entity_type="PLLC",
        entity_status="ACTIVE",
    )
    matched = EnrichmentMatcher().attach(prospects, [ny_entity])
    assert matched == 0
