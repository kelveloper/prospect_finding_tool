"""Contact kit — everything an advisor needs for the first touch, built
from data we already store: practice mail address, practice phone, the
trigger to talk about, and the handling rules. No drafted correspondence —
the advisor writes their own outreach (email is deliberately out of scope,
see docs/RESEARCH_CONTACT_OUTREACH.md)."""
from dataclasses import dataclass, field
from datetime import date

from app.models import Prospect

# Which trigger the advisor leads with, best first. PROPERTY_EVENT is
# deliberately absent — it raises urgency but is never mentioned to the
# prospect. PRACTICE_ENTRY is the last resort.
TRIGGER_PRIORITY = ("OWNERSHIP", "CAREER_ADVANCEMENT", "NEW_LICENSE", "PRACTICE_ENTRY")


@dataclass(frozen=True)
class MailChannel:
    address_line: str | None
    city: str | None
    state: str | None
    zip_code: str | None
    complete: bool


@dataclass(frozen=True)
class PhoneChannel:
    number: str | None
    note: str


@dataclass(frozen=True)
class Trigger:
    signal_type: str
    description: str
    event_date: date | None


@dataclass(frozen=True)
class ContactKit:
    prospect_id: str
    name: str
    mail: MailChannel
    phone: PhoneChannel
    primary_trigger: Trigger | None
    urgency: str  # "standard" | "elevated"
    rules: list[str] = field(default_factory=list)


class ContactKitService:
    def build(self, prospect: Prospect) -> ContactKit:
        primary = self._primary_trigger(prospect)
        has_property = any(
            s.signal_type == "PROPERTY_EVENT" for s in prospect.signals
        )

        rules = ["Send to the practice address — never a home address."]
        if has_property:
            rules.append(
                "Never reference the property purchase — it is a timing "
                "signal only."
            )
        if prospect.phone:
            rules.append(
                "Phone is the practice landline — expect a gatekeeper; "
                "never call personal numbers."
            )

        return ContactKit(
            prospect_id=prospect.id,
            name=prospect.full_name,
            mail=MailChannel(
                address_line=prospect.address_line,
                city=prospect.city,
                state=prospect.address_state or prospect.state,
                zip_code=prospect.zip_code,
                complete=bool(
                    prospect.address_line and prospect.city and prospect.zip_code
                ),
            ),
            phone=PhoneChannel(
                number=prospect.phone,
                note="Practice landline from NPPES (business line)",
            ),
            primary_trigger=(
                Trigger(primary.signal_type, primary.description, primary.event_date)
                if primary
                else None
            ),
            urgency="elevated" if has_property else "standard",
            rules=rules,
        )

    @staticmethod
    def _primary_trigger(prospect: Prospect):
        candidates = [
            s for s in prospect.signals if s.signal_type in TRIGGER_PRIORITY
        ]
        if not candidates:
            return None
        return min(
            candidates,
            key=lambda s: (
                TRIGGER_PRIORITY.index(s.signal_type),
                -(s.event_date.toordinal() if s.event_date else 0),
            ),
        )
