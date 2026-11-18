#!/usr/bin/env python3
"""
Re-encrypt stored secrets with the current AI_ENCRYPTION_KEY.

Rotating the key:
  1. Generate a new key:
       python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  2. Set it as AI_ENCRYPTION_KEY and move the old one to AI_ENCRYPTION_KEY_PREVIOUS
     (comma-separated if there is more than one), then restart the backend. Data
     keeps working: the old key still decrypts it.
  3. Run this script with --apply to re-encrypt everything with the new key.
  4. Remove AI_ENCRYPTION_KEY_PREVIOUS and restart.

Covers AI provider API keys (``user_ai_settings.providers[].api_key``),
integration credentials (``vendor_configs.encrypted_config``) and TOTP secrets
(``users.totp_secret_encrypted``). Values that no configured key can decrypt
are reported and left untouched. Idempotent; never prints secrets.

Usage (inside the backend container):
    poetry run python -m scripts.rotate_encryption_key            # dry run: report only
    poetry run python -m scripts.rotate_encryption_key --apply    # re-encrypt
"""

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from typing import Any

from cryptography.fernet import InvalidToken, MultiFernet
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.core.security import get_cipher


@dataclass
class RotationReport:
    """Counts per kind of secret: ``checked``, ``rotated`` and ``unreadable``."""

    counts: dict[str, dict[str, int]] = field(default_factory=dict)

    def add(self, kind: str, key: str, amount: int = 1) -> None:
        """Increment ``counts[kind][key]`` by ``amount``."""
        bucket = self.counts.setdefault(kind, {"checked": 0, "rotated": 0, "unreadable": 0})
        bucket[key] += amount


def _rotate_token(cipher: MultiFernet, token: str) -> str | None:
    """Return ``token`` re-encrypted with the current key, or None if unreadable."""
    try:
        return cipher.rotate(token.encode()).decode()
    except InvalidToken:
        return None


async def rotate_secrets(db: AsyncDatabase, cipher: MultiFernet, apply: bool) -> RotationReport:
    """Re-encrypt every stored secret with the current key.

    Args:
        db: Database holding ``user_ai_settings``, ``vendor_configs`` and ``users``
        cipher: MultiFernet whose first key is the current one
        apply: When False only counts; when True writes the re-encrypted values

    Returns:
        A report with checked / rotated / unreadable counts per kind
    """
    report = RotationReport()

    async for doc in db["user_ai_settings"].find({"providers.api_key": {"$exists": True}}):
        providers: list[dict[str, Any]] = doc.get("providers", [])
        changed = False
        for provider in providers:
            token = provider.get("api_key")
            if not token:
                continue
            report.add("ai_provider_keys", "checked")
            rotated = _rotate_token(cipher, token)
            if rotated is None:
                report.add("ai_provider_keys", "unreadable")
                continue
            provider["api_key"] = rotated
            changed = True
            report.add("ai_provider_keys", "rotated")
        if apply and changed:
            await db["user_ai_settings"].update_one(
                {"_id": doc["_id"]}, {"$set": {"providers": providers}}
            )

    for collection, field_name, kind in (
        ("vendor_configs", "encrypted_config", "integration_configs"),
        ("users", "totp_secret_encrypted", "totp_secrets"),
    ):
        query = {field_name: {"$nin": [None, ""]}}
        async for doc in db[collection].find(query, {field_name: 1}):
            report.add(kind, "checked")
            rotated = _rotate_token(cipher, doc[field_name])
            if rotated is None:
                report.add(kind, "unreadable")
                continue
            report.add(kind, "rotated")
            if apply:
                await db[collection].update_one(
                    {"_id": doc["_id"]}, {"$set": {field_name: rotated}}
                )

    return report


async def main() -> int:
    """CLI entry point: dry run by default, ``--apply`` to write."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="write the change (default: dry run)")
    args = parser.parse_args()

    cipher = get_cipher()
    client: AsyncMongoClient = AsyncMongoClient(settings.MONGO_URI)
    try:
        report = await rotate_secrets(client[settings.DATABASE_NAME], cipher, args.apply)
    finally:
        await client.close()

    mode = "APPLY" if args.apply else "DRY RUN"
    previous = len(settings.previous_encryption_keys)
    print(f"[{mode}] database: {settings.DATABASE_NAME} (previous keys configured: {previous})")
    unreadable = 0
    for kind, counts in report.counts.items():
        print(
            f"  {kind}: checked {counts['checked']}, "
            f"{'re-encrypted' if args.apply else 'to re-encrypt'} {counts['rotated']}, "
            f"unreadable {counts['unreadable']}"
        )
        unreadable += counts["unreadable"]
    if not report.counts:
        print("  no encrypted values found")
    if unreadable:
        print("  some values can't be decrypted with any configured key: they were left as is")
    if not args.apply and report.counts:
        print("  run again with --apply to re-encrypt with the current key")
    return 1 if unreadable else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
