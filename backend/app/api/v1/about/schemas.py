"""Schemas for the About page's repository facts."""

from typing import Optional

from pydantic import BaseModel


class RepositoryStats(BaseModel):
    """Public numbers of the open-source repository (no user data involved)."""

    #: False when stats are off, GitHub can't be reached or answered an error.
    available: bool
    repository: str
    url: str
    stars: Optional[int] = None
    forks: Optional[int] = None
