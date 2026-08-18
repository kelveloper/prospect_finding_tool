"""Deterministic plain-English reason summaries. No LLM (spec section 8)."""
from app.scoring.detector import DetectedSignal
from app.scoring.engine import ScoreBreakdown


def _score_phrase(label: str, value: float) -> str | None:
    if value >= 75:
        return f"High {label}."
    if value >= 50:
        return f"Moderate {label}."
    return None


def build_reason_summary(
    signals: list[DetectedSignal], breakdown: ScoreBreakdown
) -> tuple[str, float]:
    """Returns (plain_english_summary, confidence).

    Sentences are built from the strongest signals, ordered by strength,
    followed by score-level statements.
    """
    if not signals:
        return "Insufficient signals detected.", 0.0

    top_signals = sorted(signals, key=lambda s: s.strength, reverse=True)

    sentences = [s.description.rstrip(".") + "." for s in top_signals if s.strength >= 0.3]

    qual_phrase = _score_phrase("qualification score", breakdown.qualification_score)
    if qual_phrase:
        sentences.append(qual_phrase)
    if breakdown.timing_score >= 75:
        sentences.append("Strong timing signal.")
    elif breakdown.timing_score >= 50:
        sentences.append("Moderate timing signal.")
    elif breakdown.timing_score < 30:
        sentences.append("Weak timing signal.")

    if not sentences:
        sentences = ["Insufficient signals detected."]

    confidence = (
        round(sum(s.confidence for s in top_signals) / len(top_signals), 2)
        if top_signals
        else 0.0
    )
    return " ".join(sentences), confidence
