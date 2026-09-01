# Known gaps — found while demoing, not yet fixed

Things that are wrong or misleading on screen, with what causes them. None of
these break the pipeline; all of them are visible to somebody being shown the
product. Ordered by how likely a viewer is to notice.

Companion: [`OWNERSHIP_TENURE_BIAS.md`](OWNERSHIP_TENURE_BIAS.md) — a deeper
scoring question found the same way.

---

## 1. Out-of-state doctors are presented as Illinois doctors

**Seen:** the top-ranked prospect, Rahul Aggarwal, displays as **"Boston, IL"**.
His contact kit gives his practice address as 70 Francis St, Boston, MA 02115 —
Brigham and Women's Hospital, in Massachusetts.

**Scale:** 183 of 219 prospects actually practise in Illinois. The other 36 are
in MO, TX, WI, KY, PA, MI and MA. **All 36 render a city from one state beside
the literal string `IL`.**

**Two separate problems underneath.**

*The display bug.* The UI builds the location string from `city` — which comes
from the practice address — joined to `state`, which is the state we queried
NPPES with. When those disagree the result is a place that does not exist. The
prospect row carries both `state` and `address_state`; the UI reads the wrong
one. Frontend-only fix.

*The substantive one.* `app/adapters/npi/live.py:118` admits a physician who is
either **licensed in Illinois** or **practising in Illinois**. That is a
defensible rule — an Illinois licence is a real signal wherever they work — but
it means "219 Illinois doctors" is loose. The honest number for physicians
practising in Illinois is **183**.

**Why it matters beyond cosmetics:** the contact kit tells the advisor to post
to the practice address. For these 36 that address is out of state, while the
board has just called them an Illinois prospect.

**Options**
1. Fix the display: show the practice address's own state, or show licence state
   and practice state as separate fields. Cheapest, and stops the invented city.
2. Decide what the book is *for*. If it is an Illinois book, filter on
   `address_state`. If an Illinois-licensed book, say that on the board and in
   the script instead of "Illinois doctors".
3. Leave the rule, fix the words. Both `README.md` and the run of show currently
   say "Illinois physicians" without qualification.

**Recommend 1 and 3 now, 2 as a product decision.**

---

## 2. Evidence counts still ignore recency

`NEW_LICENSE` and `PRACTICE_ENTRY` are emitted for anyone holding a date at all,
with the recency living in the strength. The detail tooltip's **wording** now
follows the strength — "Newly licensed" above the two-year step, "License date"
below it — and the board's trigger chip is gated the same way.

**What was deliberately left alone:** the ✓ itself, and therefore the evidence
count. Gating those would un-tick **110 of 132** licences and **198 of 219**
practice entries, dropping most of the board from "partial" to "thin". That is
arguably the more honest reading, but it is a visible, board-wide change and was
not worth shipping the day before a demo.

**Decide:** whether "4 of 7 signals" should mean *four facts on file* (today) or
*four facts that still mean something* (recency-gated).

---

## 3. Nobody has both ownership and property

Six prospects carry `OWNERSHIP`, nine carry `PROPERTY_EVENT`, and **zero carry
both**. The four-step chain in the pitch — licensed, entered practice, formed a
practice, bought a house — has no example anywhere in the book, so it can be
described but never shown.

Partly a sampling artefact: the demo page limit skews 203 of 219 surnames to
"A". Worth re-checking after a full sweep before treating it as a real finding.

---

## 4. The run of show has no agreed length

`visuals/presentation-run-of-show.html` runs about 1,200 spoken words, roughly
9–10 minutes before demo clicks and pauses, while its own runsheet still shows a
5:30 finish. Either the slot is longer than five minutes or roughly a third has
to come out — Speaker 3 first, since the Q&A section already covers most of it.
