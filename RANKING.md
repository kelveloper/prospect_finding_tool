# The Ranking System, Explained

How a physician in public data becomes a number on the scoreboard.

---

## 1. The two questions

Every prospect is scored on exactly two questions:

| Score | Question | Weight |
|---|---|---|
| **Qualification** (0–100) | *Should we care about this person?* — are they the kind of person who becomes wealthy? | **60%** |
| **Timing** (0–100) | *Why now?* — is wealth-building happening right now, making this the moment to reach out? | **40%** |

```
TOTAL = Qualification × 0.60  +  Timing × 0.40
```

Qualification weighs more because a great prospect at an okay time still
matters; a mediocre prospect at a perfect time doesn't. Both weights are
settings (`QUALIFICATION_WEIGHT`, `TIMING_WEIGHT` env vars) — tunable
without code changes.

---

## 2. Signals: the raw material

Scores are built only from **signals** — facts detected in public data,
each with a strength from 0.0 to 1.0:

| Signal | What it means | Where it comes from |
|---|---|---|
| `PHYSICIAN` | They're a licensed physician | NPI registry + IDFPR |
| `SPECIALTY` | How lucrative their specialty is | NPI registry |
| `NEW_LICENSE` | How recently they were licensed / entered practice | IDFPR + NPI |
| `OWNERSHIP` | They own a practice entity (PLLC/LLC) | IL business registry |
| `PROPERTY_EVENT` | They bought property | County deed records |
| `CAREER_ADVANCEMENT` | Promotion / new senior role | Affiliations feed |

No signal → no points. The system never guesses.

---

## 3. Qualification: "should we care?" (max 100 pts)

| Component | Max pts | How strength is decided |
|---|---|---|
| **Physician standing** | 40 | Active verified license = 1.0 · NPI-only, unverified = 0.7 · inactive license = 0.5 |
| **Specialty earning tier** | 35 | Orthopedic/neuro/plastic surgery = 1.0 · cardiology = 0.95 · dermatology/gastro = 0.9 · anesthesiology = 0.85 · family medicine/pediatrics = 0.4 · unknown = 0.4 |
| **Practice ownership** | 25 | Active PLLC/PC (professional entity) = 0.9 · generic LLC = 0.6 · inactive entity discounted |

Points = max pts × strength. Example: an active-licensed dermatologist with
no business entity = 40×1.0 + 35×0.9 + 25×0 = **71.5**.

**Why these three:** the first two say "high earner"; ownership says
"business owner, not employee" — the step in the emerging-affluent
hypothesis where wealth starts compounding.

---

## 4. Timing: "why now?" (max 100 pts)

Timing is all about **recency**. Every date-based component runs through
one decay curve:

```
event happened...   ≤6 months   ≤12 months   ≤24 months   ≤36 months   older
strength            1.0         0.85         0.6          0.3          0.1
```

| Component | Max pts | The date that drives it |
|---|---|---|
| **License recency** | 40 | IDFPR original license issue date |
| **Property purchase** | 30 | Deed transfer date |
| **Practice entry** | 15 | NPI enumeration date |
| **Career advancement** | 15 | Announcement date × role seniority (partner/director/chief = 1.0 · attending = 0.8 · other = 0.5) |

**Why licenses dominate timing:** a new license is the cleanest public
marker of "physician income starts now." A physician licensed 8 months ago
scores 40×0.85 = 34; one licensed in 2018 scores 40×0.1 = 4.

---

## 5. Two worked examples

**Dr. John Smith — 89.2, #1 on the showcase board** (the full hypothesis chain)

```
QUALIFICATION                                    TIMING
Physician standing   40 × 1.0  = 40.0            License (8 mo)      40 × 0.85 = 34.0
Ortho surgery        35 × 1.0  = 35.0            Property (2 mo)     30 × 1.0  = 30.0
Active PLLC          25 × 0.9  = 22.5            Enumeration (7 mo)  15 × 0.85 = 12.8
                                ------            Career (none)       15 × 0    =  0.0
                                 97.5                                          ------
                                                                                76.8
TOTAL = 97.5 × 0.6 + 76.8 × 0.4 = 58.5 + 30.7 = 89.2
```

**Dr. Michael Brooks — 27.6, bottom of the board** (why he ranks low)

```
QUALIFICATION                                    TIMING
Physician (unverified) 40 × 0.7 = 28.0           License date: none   40 × 0   =  0.0
Pediatrics             35 × 0.4 = 14.0           Property: none       30 × 0   =  0.0
Ownership: none        25 × 0   =  0.0           Enumeration (2017)   15 × 0.1 =  1.5
                                ------            Career (2024, minor) 15 × 0.3×0.5 ≈ 2.3*
                                 42.0                                          ------
                                                                                ~6.0
TOTAL = 42.0 × 0.6 + 6.0 × 0.4 ≈ 27.6            (*seniority-weighted recency)
```

Same formula, wildly different outcomes — the spread **is** the product.

---

## 6. Rules that keep it honest

- **Strongest signal per component** — duplicates never double-count.
- **Zero rows stay visible** — the UI shows "Career advancement: 0/15 — no
  signal," which doubles as "what would raise this score."
- **Deterministic** — same data in, same score out. No LLM, no randomness.
  (Planned AI features — match assistant, UI narrative — sit *around* the
  scoring, never inside it. See PROGRESS.md.)
- **Traceable** — every point maps to a stored signal row; every signal maps
  to a source record; every identity merge has a logged score + reason.

---

## 7. Where to see and change it

**In the UI:** any candidate dossier → **Score Breakdown card** → "How was
this calculated?" expands per-component bars. The follow-up page shows the
underlying signal evidence.

**In the code:**

| What | File |
|---|---|
| Weights & component points | `app/scoring/engine.py` (`QUAL_WEIGHTS`, `TIMING_WEIGHTS`) |
| Specialty tiers & decay curve | `app/scoring/detector.py` (`SPECIALTY_TIERS`, `recency_strength`) |
| 60/40 top-level weights | `app/config.py` (env-overridable) |
| Plain-English summaries | `app/scoring/reasons.py` |
| Tests proving the math | `tests/test_scoring.py`, `tests/test_ownership.py` |

**To tune:** edit a tier or weight, run `pytest tests/ -q`, re-ingest, and
watch the board reorder. Advisor feedback (`good_fit`/`not_fit`) is being
collected precisely so these hand-set weights can be calibrated against
real judgments later.
