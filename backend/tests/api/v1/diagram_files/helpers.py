"""Helpers shared by the diagram file tests (users, freehand diagrams, images)."""

import hashlib
import json
import os

from httpx import AsyncClient, Response

from tests.utils import generate_test_password

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def png(size: int = 64) -> bytes:
    """Bytes that start like a PNG (only the magic bytes are checked), unique per call."""
    return PNG_MAGIC + os.urandom(max(size - len(PNG_MAGIC), 1))


def webp() -> bytes:
    """Bytes with WebP magic (RIFF....WEBP)."""
    return b"RIFF" + (100).to_bytes(4, "little") + b"WEBP" + os.urandom(32)


def gif() -> bytes:
    """Bytes with GIF magic."""
    return b"GIF89a" + os.urandom(32)


def sha(data: bytes) -> str:
    """The file id the server computes."""
    return hashlib.sha256(data).hexdigest()


def scene(*file_ids: str) -> str:
    """A freehand scene whose image elements use these files."""
    return json.dumps(
        {
            "elements": [
                {"type": "image", "fileId": file_id, "mimeType": "image/png"}
                for file_id in file_ids
            ]
        }
    )


async def make_user(client: AsyncClient, name: str) -> dict:
    """Register and sign in a user; returns its id and auth headers."""
    email = f"{name.lower().replace(' ', '.')}-{os.urandom(3).hex()}@example.com"
    password = generate_test_password("Files")
    response = await client.post(
        "/api/v1/users/register", json={"email": email, "password": password, "full_name": name}
    )
    assert response.status_code == 201, response.text
    login = await client.post("/api/v1/users/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"id": response.json()["id"], "headers": {"Authorization": f"Bearer {token}"}}


async def make_diagram(
    client: AsyncClient, user: dict, content: str = "", diagram_type: str = "freehand", **fields
) -> str:
    """Create a diagram in the user's (single) project; returns its id."""
    if "project_id" not in user:
        project = await client.post(
            "/api/v1/projects", json={"name": "Sketches", "emoji": "📁"}, headers=user["headers"]
        )
        assert project.status_code == 201, project.text
        user["project_id"] = project.json()["id"]
    body = {
        "title": "Sketch",
        "content": content or scene(),
        "diagram_type": diagram_type,
        **fields,
    }
    response = await client.post(
        f"/api/v1/projects/{user['project_id']}/diagrams", json=body, headers=user["headers"]
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def set_content(client: AsyncClient, user: dict, diagram_id: str, content: str) -> None:
    """Save a new scene for a diagram."""
    response = await client.put(
        f"/api/v1/diagrams/{diagram_id}", json={"content": content}, headers=user["headers"]
    )
    assert response.status_code == 200, response.text


async def upload(
    client: AsyncClient,
    user: dict,
    diagram_id: str,
    data: bytes,
    content_type: str = "image/png",
    filename: str = "image.png",
) -> Response:
    """POST a file to a diagram."""
    return await client.post(
        f"/api/v1/diagrams/{diagram_id}/files",
        files={"file": (filename, data, content_type)},
        headers=user["headers"],
    )
