"""Current time helpers."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Current UTC time as a naive datetime.

    Replaces ``datetime.utcnow()`` (deprecated since Python 3.12) with the
    same value: naive UTC, which is what PyMongo returns (``tz_aware``
    is off), so comparisons with stored dates keep working.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
