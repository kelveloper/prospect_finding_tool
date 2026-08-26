# Research: Contacting the Prospect — Channels + Contact Data

Researched 2026-08-26. Question: once an advisor sees a ranked prospect,
how do they reach them — and where does the contact data come from?
Vendor-marketing claims are flagged **[VENDOR]**; independent/practitioner
evidence **[INDEP]**.

**What we already have (free, in the product today):** practice street
address + practice phone for every prospect (NPPES), plus the trigger
event itself (new license, new PLLC, career move, property purchase) with
its date. What we don't have: direct email, mobile, LinkedIn.

---

## Part 1 — How advisors actually reach physicians

### The channels, ranked for a solo advisor using our trigger data

1. **Trigger-timed direct mail to the practice** — the winner. Least-regulated
   channel (no CAN-SPAM/DNC analog), matches physicians' documented preference
   for educational mail over calls, and it's the only channel where our event
   data converts directly into a reason-to-write inside the golden window.
   The entire "new homeowner list" industry (deed-triggered mail sold to
   insurance/financial services, first-90-days framing) proves deed-triggered
   mail converts — it's a decades-old business.
2. **Trigger-personalized cold email to the practice** — cheap and measurable.
   Baseline cold email gets ~1–5% replies (Backlinko 12M-email study: only
   8.5% get *any* response **[INDEP]**); signal-based personalization reports
   3–8x lift, 15–25% replies **[VENDOR, but directionally consistent across
   many vendors]**. Must be CAN-SPAM compliant (accurate headers, identify as
   ad, postal address, working opt-out; fines to ~$53k/email) and archived as
   an advertisement under the SEC Marketing Rule.
3. **COI mapping — the attorneys/CPAs/lenders in our own data** — every
   practitioner account ranks warm referral as the highest-converting source
   **[INDEP]** (Kitces podcast case studies: physician-niche firms built on
   CPA/attorney flywheels). Twist: our filings identify *which* professionals
   just formed the PLLC or financed the property — the tool can map the COI
   graph, not just the physician.
4. **Presence in the physician-finance ecosystem** (White Coat Investor /
   Physician on FIRE / Physician Side Gigs paid listings + content) — THE
   dominant inbound engine for successful physician-niche firms; WCI claims
   42% of its users have hired from its lists **[VENDOR]**. Not targetable to
   a specific prospect, but it's the credibility backdrop when the physician
   Googles the sender. Paid listings are "endorsements" under the SEC
   Marketing Rule (disclosure + written agreement required).
5. **LinkedIn as warm-up/second touch** — InMail benchmarks 3–25% depending
   on study **[VENDOR-adjacent]**, but physician-niche advisors report
   doctors barely use general social media **[INDEP]** — verification and
   second-touch layer, not primary. Sermo's new self-serve ad product
   (Oct 2025, pay-per-engagement, 1M+ verified HCPs) is the dark-horse for
   later — audience targeting only, no individual targeting. Doximity ads
   reach 80%+ of US doctors but are enterprise-priced for pharma budgets.

### Anti-recommendations

- **Cold calling the practice**: physicians frown on it **[INDEP]**, you reach
  a gatekeeper, and while true B2B business-line calls are exempt from the
  national DNC registry, personal cells / home-office lines / some state laws
  (incl. the Illinois Restricted Call Registry Act, penalties to
  $2,500/violation) re-create the risk. Product rule: only surface practice
  landlines, never inferred personal cells.
- **Any home-address contact from property deeds**: legal (the new-homeowner
  mail industry exists) but deed-mining letters are a recognized scam pattern
  consumers are warned about, and physicians are unusually privacy-sensitive.
  **Use the property event as a scoring/timing signal only; route every touch
  to the practice; never mention the home purchase.**

### The creative play: trigger/event-based selling

Sales terminology: "trigger-event selling" / "signal-based selling."
Vendor-reported evidence: 15–25% reply vs 3–5% generic; "first seller to
reach out after a trigger is 5x more likely to win" **[all VENDOR;
no peer-reviewed source found — but consistent with the independent cold-email
baseline and the new-homeowner-mail industry's persistence]**.

Angles our data uniquely enables:
- **"Congratulations on opening [Practice Name]"** letter within weeks of the
  PECOS went-independent event + a one-pager: "7 tax mistakes new practice
  owners make" (educate-don't-sell matches documented physician preference)
- **New license →** first-attending/residency-graduation content: disability
  insurance, PSLF, contract review (the topics WCI-style firms lead with)
- **Career move →** "new employer = new 401(k)/403(b) + rollover decision"
- **COI-side play →** introduce yourself to the attorney/CPA who just formed
  the PLLC

### Product implication

The per-prospect deliverable should be a **contact kit**: practice mailing
address + practice phone (flagged business-line-verified) + the trigger event
with date + a compliant, event-matched letter/email template + COI names from
the same filings.

---

## Part 2 — Where the contact data comes from

### Paid: healthcare-specific vendors (researched Aug 25–26, 2026)

The critical requirement: **matching keyed by NPI** (zero name-match risk,
same principle as our PECOS adapter). Summary of the eight vendors probed:

| Vendor | NPI-keyed match | Emails | Mobile | LinkedIn | Realistic entry cost | Use rights |
|---|---|---|---|---|---|---|
| Definitive Healthcare | Yes (platform) | Work + suppl. | In schema | Yes | ~$25–50k/yr [Vendr] | Subscription |
| IQVIA OneKey | Yes (strongest IDs) | Opt-in work | No | No | ~$50k+/yr | Subscription/TPA |
| MedicoReach | NPI in output | Work | No | Optional | Low, quote/volume | **Perpetual multi-use** |
| Ampliz | **Yes — self-serve NPI search** | Work | Unverified | Implied | **$480/yr** | Exported records kept |
| HealthLink Dimensions | NPI on record; custom match | **Work + personal (avg 2.3/contact)** | No | No | Quote-only | License or deployment |
| Redi-Data | ME/name match ($200–650 flat); NPI select | Work (permissioned) | "Where avail." | No | **$415/M one-time sends, $850 min** (public rate card) | **Rental/one-time by default** |
| DMD / IQVIA Digital | Yes (NPI graph) | **Opt-in, ~95% of HCPs** | No | No | Enterprise, deployment-only | Sends, not data |
| Veeva OpenData Email | Yes (NPI field) | **98% coverage, 5 ranked incl. personal** | No | No | 5–6 figures/yr | Subscription, ecosystem-bound |

Key findings:

- **No vendor advertises physician mobile/direct-dial at meaningful
  coverage.** Definitive is the only one with mobile in its schema — and
  contact-level accuracy is its most-criticized attribute (G2 3.9/5).
- **Best data is closed to us:** DMD (opt-in emails for ~95% of HCPs, cited
  even in an FTC complaint) and Veeva OpenData (NPI + 5 ranked emails incl.
  personal) are sold to pharma at enterprise terms — deployment/campaigns,
  not queryable files.
- **Best value pilot: Ampliz** — $50/mo or $480/yr, 100 credits/month, true
  self-serve NPI lookup cross-referenced against the federal registry.
  Right-sized to measure real email fill rates on our IL cohort before any
  bigger commitment.
- **Best mid-market quote to chase: HealthLink Dimensions** — permissioned
  work + personal emails (avg 2.3 per contact), NPI/DEA/license identifiers
  on record, licensable for internal use. Ask for a data-license quote (not
  their managed-deployment product) scoped to our NPI universe.
- **Avoid as enrichment: MedicoReach** (worst independent reviews of the set —
  an 87%-bounce complaint on record; use only with a sample validated against
  our NPIs + contractual deliverability guarantee) and **Redi-Data for data**
  (rental model — addresses never flow back to us; fine purely as a
  send-execution service, and their $200–650 flat database-match is a cheap
  way to *count* overlap).

### Free sources (verified against the actual files, Aug 2026)

| Source | What it gives | Coverage | NPI-keyed |
|---|---|---|---|
| NPPES main dissemination file | No emails at all — practice address + phone only (which our live API pull already captures) | — | yes |
| **NPPES Endpoint file** (same download page) | Provider "endpoints" — mostly Direct secure-messaging addresses, but a minority are **ordinary practice/consumer emails** and **practice-website URLs** | ~496k NPIs have endpoints; **~16k ordinary emails**, **~4.5k website URLs** (verified by downloading and inspecting the Aug 2026 file) | **yes** |
| **CMS Doctors & Clinicians national downloadable file** (data.cms.gov provider-data) | Clinician practice info incl. a **Telephone Number column with 84.2% fill** (computed from the file), org affiliations, PAC ID | national | yes (NPI + PAC ID) |
| IDFPR / IL physician profile | No contact fields beyond city/zip (already captured) | — | no (license#) |
| Practice website → contact page | Resolvable via the Endpoint-file URLs (free but tiny coverage) or Google Places API (paid-per-lookup) from practice name + address | small free / broad paid | no |

**Hard rule confirmed from the DirectTrust policy itself: Direct
secure-messaging addresses may NOT be used for marketing.** They're for
clinical exchange only — filter endpoint types and use only the ordinary
email/website entries.

**Free-source bottom line:** free data adds a practice website or email for
only a small slice of prospects. The reliable free contact channels remain
what we already have — practice address (direct mail) and practice phone
(84%+ corroborated by two independent CMS files).

### General B2B vendors + email-finding tools

*(from general knowledge + partial agent research — session search budget was
exhausted before full verification; treat pricing as approximate)*

- **Apollo.io / RocketReach / ZoomInfo** — B2B contact databases with emails,
  some mobiles, LinkedIn URLs. None are NPI-keyed: matching is name +
  employer/domain, which reintroduces exactly the name-match risk our
  architecture avoids. Apollo/RocketReach are self-serve ($49–$99+/mo tiers);
  ZoomInfo is enterprise ($15k+/yr). Physician coverage skews toward
  hospital-employed staff with LinkedIn presence — weakest on small-practice
  owners, who are our best prospects.
- **People Data Labs / Coresignal** — bulk person-enrichment APIs,
  per-record pricing; same name-match caveat, plus provenance is largely
  scraped public-web data.
- **Email pattern-guess + verify** (Hunter, Snov + NeverBounce): take the
  practice-website domain (from the Endpoint file or Google Places), guess
  `first.last@domain`, verify deliverability. Works decently for
  small-practice domains; fails on hospital domains (strict gateways,
  catch-alls). Free tiers exist — a plausible zero-vendor-cost email path for
  exactly the independent-practice segment we care most about.
- **Clay** — orchestrator that chains the above per-prospect (~$149+/mo);
  useful pattern to copy in-product, not a data source itself.

### Avoid list (confirmed)

1. **Direct secure-messaging addresses for marketing** — prohibited by
   DirectTrust policy (verified from the policy PDF).
2. **LinkedIn scraping** — legally dead path; Proxycurl shut down July 2025
   after the LinkedIn/Microsoft lawsuit (already documented in
   `RESEARCH_CAREER_SIGNAL.md`).
3. **Inferred personal cell phones** — TCPA exposure (applies to cell numbers
   regardless of B2B status) + the creep factor; surface practice landlines
   only.
4. **Cheap rented email lists** — CAN-SPAM liability rides on the sender;
   MedicoReach-tier deliverability complaints show the failure mode.
5. **Home addresses from deeds** — legal but scam-pattern-matching (Part 1).

---

## Recommended build order (free-first)

1. **Ship the "contact kit" with data we already have** — practice address,
   practice phone (cross-checked against the CMS Doctors & Clinicians file's
   84%-filled phone column as a free second witness), the trigger event +
   date, and an event-matched letter/email template. Direct mail + practice
   phone are fully powered today, $0.
2. **Add the two free NPI-keyed enrichments** — NPPES Endpoint file (ordinary
   emails + practice websites, small coverage but zero cost and zero match
   risk) and the CMS Doctors & Clinicians file (phone corroboration + PAC ID
   org affiliations). Both are bulk downloads that fit our adapter pattern.
3. **Pilot paid enrichment on the gap** — Ampliz at $480/yr (true self-serve
   NPI lookup) to measure real email fill rates on our IL cohort; in
   parallel, domain-based email guess + verify (Hunter/NeverBounce free
   tiers) for prospects whose practice website we resolved. If fill rates
   justify it, get the HealthLink Dimensions data-license quote (permissioned
   work + personal emails, avg 2.3/contact, NPI on record) as the scale-up.

