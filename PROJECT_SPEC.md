# Emerging Affluent Prospecting Platform — Backend Prototype Spec

**Role:** Principal Software Architect / Staff Engineer
**Goal:** Prove that a signal-driven scoring system can identify and rank emerging affluent wealth-management prospects using publicly available data.

---

## 1. Scope

### In scope (V1)
- Data ingestion
- Signal detection
- Identity resolution
- Lead scoring
- Lead ranking
- Explainability
- Feedback loop

### Explicitly out of scope (do NOT build)
- Frontend UI
- Authentication
- Compliance approval workflows
- Legal review systems
- Outreach generation
- CRM integration
- Production infrastructure
- Property records / ATTOM integration
- Entity registries
- AI-generated outreach

> **Ruthless constraint:** NPI + licensing data is the clean foundation. Enrichment
> sources get complicated fast. **Prove ranking works first. Then add enrichment.**
> The biggest risk is building a huge data estate *before* validating that the
> scoring hypothesis produces a useful ranked lead list.

---

## 2. Product Context

### Core hypothesis

```
Career Signal
     ↓
Ownership Signal
     ↓
Financial Event
     ↓
Emerging Affluent Candidate
```

A strong prospect is **not** necessarily already wealthy. A strong prospect is
someone demonstrating signals consistent with **becoming wealthy in the near future**.

**V1 focuses on physicians** because physician data is available through structured
public sources. Lawyers and other professions are future phases.

---

## 3. Core Architecture

```
Data Sources
     ↓
Ingestion & Normalization
     ↓
Identity Resolution
     ↓
Signal Detection
     ↓
Signal Scoring
     ↓
Prospect Record
     ↓
Lead Ranking API
     ↓
Feedback Loop
```

---

## 4. Data Sources (Phase 1)

Only two sources are supported in V1:

| Source | Purpose |
|---|---|
| **A. NPI Registry** | Physician identity, specialty, licensing information, enumeration date |
| **B. Illinois physician licensing data (IDFPR)** | License issue dates, status, specialty, licensing verification |

The system must be designed so additional adapters can be added later:

```python
BaseDataSource
├── NPIDataSource
├── IDFPRDataSource
├── FuturePropertyDataSource   # future phase
└── FutureEntityDataSource     # future phase
```

---

## 5. Domain Model

### Prospect

```python
Prospect
├── id
├── first_name
├── last_name
├── full_name
├── profession
├── specialty
├── state
├── enumeration_date
├── license_issue_date
├── qualification_score
├── timing_score
├── total_score
├── signals: list[Signal]
├── reason_summary
├── created_at
└── updated_at
```

### Signal

```python
Signal
├── id
├── prospect_id
├── signal_type
├── source
├── description
├── strength
├── event_date
└── confidence
```

### Signal types

```
NEW_LICENSE
PHYSICIAN
SPECIALTY
OWNERSHIP            # future
PROPERTY_EVENT       # future
CAREER_ADVANCEMENT   # future
```

Not all signal types must be active initially — support future expansion.

---

## 6. Identity Resolution

Implement an identity resolution service.

**Responsibilities:**

1. **Deduplicate** — e.g. `John Smith MD` and `John A Smith MD` → same person
2. **Merge records** — combine the NPI record and the state licensing record into a single prospect profile
3. **Confidence scoring:**

```python
IdentityMatch
├── score
└── reason
```

Rules are **deterministic** initially. **No ML.**

---

## 7. Signal Framework (Scoring)

Scoring is split into two categories:

### Qualification Score — "Should we care about this person?"
- Inputs: physician specialty, professional standing, active license
- Range: **0–100**

### Timing Score — "Why now?"
- Inputs: newly licensed, recently enumerated, recent activity
- Range: **0–100**

### Final ranking formula

```python
total_score = (qualification_score * 0.60) + (timing_score * 0.40)
```

Weights must be **configurable** and stored in settings.

---

## 8. Explainability

Every score must be explainable. For every prospect, generate:

```python
ReasonSummary
├── top_signals
├── plain_english_summary
└── confidence
```

**Example output:**

> Licensed physician. Illinois license issued 8 months ago. Recently entered
> professional practice. High qualification score. Strong timing signal.

**No LLM required — generate deterministically.**

---

## 9. Lead Ranking Service

```
GET /prospects/ranked
```

Returns (highest score first by default):

```json
[
  {
    "name": "...",
    "score": 91,
    "qualification_score": 88,
    "timing_score": 95,
    "reason_summary": "..."
  }
]
```

---

## 10. Feedback Loop

```
POST /feedback
```

Input:

```json
{
  "prospect_id": "...",
  "verdict": "good_fit"
}
```

Possible verdicts: `good_fit` | `revisit_later` | `not_fit`

- Store full feedback history.
- **Do not implement model retraining.** The `FeedbackService` should capture
  data so future retraining is possible.

---

## 11. Tech Stack & Persistence

| Layer | Choice |
|---|---|
| Language | Python |
| API framework | FastAPI |
| Validation | Pydantic |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Database | PostgreSQL |

**Database models:** `Prospects`, `Signals`, `IdentityMatches`, `Feedback`

### Folder structure

```
app/
├── api/
├── services/
├── repositories/
├── models/
├── schemas/
├── adapters/
│   ├── npi/
│   └── idfpr/
├── scoring/
├── identity/
└── feedback/
tests/
```

---

## 12. Non-Functional Requirements

| Requirement | Meaning |
|---|---|
| **Clean architecture** | Business logic must not live in controllers |
| **Extensible** | New sources can be added without changing the scoring engine |
| **Testable** | All services have unit tests |
| **Explainable** | Every score is traceable back to its signals |
| **Deterministic** | No LLM, no AI agent, no vector DB, no graph DB |

---

## 13. Deliverables

1. System architecture
2. Entity relationship diagram
3. Folder structure
4. Database schema
5. FastAPI endpoints
6. Service layer design
7. Class diagrams
8. Sample data
9. Scoring engine implementation
10. Identity resolution implementation
11. Unit test strategy
12. Local development setup
13. Docker configuration
14. Production-readiness recommendations
