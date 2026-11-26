"""
Pydantic models for the files (images) of freehand diagrams.

A freehand scene is JSON in the diagram's ``content``; an image element only
names its file (``"fileId": "<sha256 hex>"``). The bytes live here, one
document per file and *scope*: a diagram, or a community publication (which
keeps its own copies so it survives edits or deletion of its source diagram).
"""

import re
from datetime import datetime
from enum import Enum

from beanie import Document
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.core.clock import utcnow

#: A file id is the SHA-256 of its bytes, as 64 lowercase hex characters.
FILE_ID_PATTERN = re.compile(r"^[0-9a-f]{64}$")

#: Image types accepted (detected from the bytes, never from the client). No SVG:
#: it can carry scripts, and nothing here is served as a document.
ALLOWED_MIME_TYPES = frozenset({"image/png", "image/jpeg", "image/webp", "image/gif"})


class FileScope(str, Enum):
    """What a stored file belongs to."""

    DIAGRAM = "diagram"
    PUBLICATION = "publication"


class DiagramFileInDB(Document):
    """One image of a diagram (or of a publication), with its bytes."""

    scope: FileScope
    scope_id: str
    owner_id: str
    file_id: str
    mime_type: str
    size: int
    data: bytes
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "diagram_files"
        indexes = [
            IndexModel(
                [("scope", ASCENDING), ("scope_id", ASCENDING), ("file_id", ASCENDING)],
                unique=True,
                name="scope_file_unique",
            ),
            "owner_id",
        ]


class DiagramFileMeta(BaseModel):
    """A stored file without its bytes (projection)."""

    file_id: str
    mime_type: str
    size: int
    created_at: datetime

    class Settings:
        projection = {"file_id": 1, "mime_type": 1, "size": 1, "created_at": 1}


class DiagramFileResponse(BaseModel):
    """What an upload answers."""

    file_id: str = Field(description="SHA-256 of the bytes (64 lowercase hex characters)")
    mime_type: str = Field(description="Type detected from the bytes")
    size: int = Field(description="Size in bytes")


def is_valid_file_id(file_id: str) -> bool:
    """Whether ``file_id`` has the shape of a file id (64 lowercase hex characters)."""
    return bool(FILE_ID_PATTERN.fullmatch(file_id))
