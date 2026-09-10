# The subspecialty bug: cardiologists scored as GPs

*Found and fixed 2026-09-10. Affected 49 of 221 prospects (22% of the book).*

## The one-sentence version

Doctors are listed under two specialties at once — a general one and a
specific one — and the scorer read the general one, so cardiologists were
paid the rate of a family doctor.

## Why doctors have two specialties

NPPES, the federal registry we pull physicians from, writes a specialty as
a pair, general first:

```
Internal Medicine, Cardiovascular Disease
^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^
the training        what they actually do
they started in     all day
```

A cardiologist trained in internal medicine and then specialised. Both
labels are true. But only the second one tells you what they earn.

Our scoring table prices them very differently, because the product is
looking for physicians building wealth:

| Specialty | Tier |
|---|---|
| Cardiovascular disease | 0.90 |
| Gastroenterology | 0.60 |
| **Internal medicine** | **0.40** |

## What the code did wrong

`specialty_tier()` looked up the tier in three steps, and stopped at the
first one that matched:

1. Is the whole string in the table? — *"Internal Medicine, Cardiovascular
   Disease" isn't, so no.*
2. **Take everything before the comma and look that up.** — *"Internal
   Medicine" is in the table. Return 0.40. Stop.*
3. ~~Otherwise search the string for any specialty we know.~~ — *never
   reached.*

Step 2 always wins for a compound name, and step 2 always reads the
**general** half. Step 3 — the one that would have found "cardiovascular
disease" and returned 0.90 — could never run.

## Why nobody noticed

The docstring's own example hid it:

```
Orthopaedic Surgery, Adult Reconstructive Orthopaedic Surgery
```

Both halves are worth 1.0, so reading the wrong one gives the right
answer. The bug only shows when the two halves are priced differently —
and the biggest gaps are exactly the specialties this product cares about
most.

## Who it hurt

49 prospects, all scored below what they should have been:

| Prospects | Specialty | Was | Should be |
|---|---|---|---|
| 23 | Internal Medicine, Gastroenterology | 0.40 | 0.60 |
| 18 | Internal Medicine, Cardiovascular Disease | 0.40 | **0.90** |
| 5 | Internal Medicine, Interventional Cardiology | 0.40 | **0.90** |
| 1 | Internal Medicine, Advanced Heart Failure and Transplant | 0.40 | 0.90 |
| 1 | Dermatology, MOHS-Micrographic Surgery | 0.35 | 0.65 |
| 1 | Pediatrics, Pediatric Critical Care Medicine | 0.25 | 0.30 |

Specialty is worth 45 of the 100 Value points, so a cardiologist read as
an internist lost `45 × (0.9 − 0.4) ≈ 22` points of Value — and because
Priority is Value × Timing, the loss carried straight through to the rank.

**The clearest case.** Rahul Aggarwal: cardiologist, Illinois licence
issued June 2026, bought a Cook County property two days later — the
strongest timing signal in the entire book at 0.85.

|  | Value | Timing | Priority | Rank |
|---|---|---|---|---|
| Before | 48.0 | 68.3 | 41.9 | **#23** |
| After | 70.5 | 68.2 | 61.5 | **#3** |

His Timing was always higher than the #1 prospect's. The bug in the other
half of the formula kept him off the first screen — which meant an advisor
working the book from the top would never have called him.

## The fix

Consider every specialty the string mentions and take the highest.

```python
mentioned = [tier for key, tier in SPECIALTY_TIERS.items() if key in s]
if mentioned:
    return max(mentioned)
```

Taking the **maximum** rather than "the second half" matters in both
directions. It promotes a subspecialty that is worth more than its general
half, and it keeps the general half when *that* is the higher of the two:
"Orthopaedic Surgery, Foot and Ankle Surgery" stays at orthopaedics' 1.0
instead of dropping to surgery's 0.65.

Plain specialties are untouched: "Internal Medicine" on its own still
scores 0.40, because internal medicine is the only tier its string
mentions.

## Where things are

| | |
|---|---|
| The function | `app/scoring/detector.py` — `specialty_tier()` |
| The price list | `app/scoring/detector.py` — `SPECIALTY_TIERS` |
| Regression test | `tests/test_nppes.py` — `test_subspecialty_beats_the_general_half` |
| How Value is built | [`RANKING.md`](RANKING.md) |

## After fixing

The scores in the database were written under the old lookup, so the fix
does not reach the board until the book is rescored:

```bash
python -m app.scoring --rescore --dry-run   # see what would move
python -m app.scoring --rescore             # write it
python -m app.summaries --all --stale       # refresh the changed write-ups
```

Done on 2026-09-10: 50 of 221 prospects moved.
