"""OWNERSHIP signal proof — billing-inference mechanism (mirrors live PECOS).

The registry mock was removed (no obtainable API for IL SoS data; the paid
Cobalt integration will supply formation dates + official officer records).
Sample ownership now arrives exactly like live mode earns it: NPI-keyed
entity records inferred from Medicare billing groups."""
from datetime import date

from app.adapters import IDFPRDataSource, NPIDataSource, PECOSSampleDataSource
from app.identity import EnrichmentMatcher, IdentityResolver
from app.scoring import ScoringEngine, SignalDetector

REF = date(2026, 8, 23)


def _resolved_prospects():
    provider = [*NPIDataSource().fetch(), *IDFPRDataSource().fetch()]
    return IdentityResolver().resolve(provider)


def _attach_entities(prospects):
    entities = list(PECOSSampleDataSource().fetch())
    matched = EnrichmentMatcher().attach(prospects, entities)
    return entities, matched


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

    # 4 sample entities; the Palumbo trap carries an untracked NPI
    assert len(entities) == 4
    assert matched == 3
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
