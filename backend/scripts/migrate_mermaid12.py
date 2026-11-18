#!/usr/bin/env python3
"""
Move saved Mermaid diagrams to Mermaid 12's look (0.9.0).

Before 0.9.0 the editor wrote an init block such as
``%%{init: {"theme":"default","flowchart":{"curve":"basis"}}}%%`` to every
Mermaid diagram: the old default theme and curve, and no layout or look (the
app couldn't apply them). This script rewrites those blocks to Mermaid 12's
defaults:

- theme ``default`` (or none) -> ``redux-color``
- adds ``"look": "neo"`` when missing (``handDrawn`` when the block has a
  ``handDrawnSeed``)
- drops ``"layout": "elk"``: ELK is already Mermaid 12's default, and naming it
  forces ELK on diagrams with their own engine, so a mindmap fails to render
  (this also repairs blocks written by 0.9.0 development builds)
- drops ``flowchart.curve: "basis"`` (Mermaid's default curve, so nothing
  changes visually)

Other themes, curves, fonts and diagrams without an init block are left as
they are. Idempotent; it never touches ``updated_at``.

Usage (inside the backend container):
    poetry run python -m scripts.migrate_mermaid12            # dry run: report only
    poetry run python -m scripts.migrate_mermaid12 --apply    # rewrite
"""

import argparse
import asyncio
import json
import re
import sys
from typing import Any, Optional

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings

_INIT_BLOCK = re.compile(r"^(\s*)%%\{init:\s*(\{.*?\})\s*\}%%", re.DOTALL)
OLD_DEFAULT_THEME = "default"
NEW_THEME = "redux-color"
DEFAULT_LAYOUT = "elk"
NEW_LOOK = "neo"


def migrate_init_block(content: str) -> Optional[str]:
    """Return ``content`` with its init block moved to Mermaid 12, or None if unchanged."""
    match = _INIT_BLOCK.match(content)
    if not match:
        return None
    try:
        init: dict[str, Any] = json.loads(match.group(2))
    except ValueError:
        return None
    if not isinstance(init, dict):
        return None
    before = json.dumps(init, sort_keys=True)

    if init.get("theme") in (None, "", OLD_DEFAULT_THEME):
        init["theme"] = NEW_THEME
    if init.get("layout") == DEFAULT_LAYOUT:
        del init["layout"]
    if not init.get("look"):
        init["look"] = "handDrawn" if init.get("handDrawnSeed") is not None else NEW_LOOK
    flowchart = init.get("flowchart")
    if isinstance(flowchart, dict) and flowchart.get("curve") == "basis":
        del flowchart["curve"]
        if not flowchart:
            del init["flowchart"]

    if json.dumps(init, sort_keys=True) == before:
        return None
    # Same compact form the editor writes (JSON.stringify).
    block = f"%%{{init: {json.dumps(init, separators=(',', ':'), ensure_ascii=False)}}}%%"
    return match.group(1) + block + content[match.end() :]


async def migrate(db: AsyncDatabase, apply: bool) -> dict[str, Any]:
    """Find (and with ``apply`` rewrite) Mermaid diagrams with a pre-0.9.0 init block.

    Returns:
        Counts: ``checked``, ``to_migrate`` / ``migrated`` and up to 20 example ids
    """
    report: dict[str, Any] = {"checked": 0, "to_migrate": 0, "migrated": 0, "examples": []}
    query = {"diagram_type": "mermaid", "content": {"$regex": r"^\s*%%\{init:"}}
    async for doc in db["diagrams"].find(query, {"content": 1}):
        report["checked"] += 1
        new_content = migrate_init_block(doc.get("content") or "")
        if new_content is None:
            continue
        report["to_migrate"] += 1
        if len(report["examples"]) < 20:
            report["examples"].append(str(doc["_id"]))
        if apply:
            result = await db["diagrams"].update_one(
                {"_id": doc["_id"]}, {"$set": {"content": new_content}}
            )
            report["migrated"] += result.modified_count
    return report


async def main() -> int:
    """CLI entry point: dry run by default, ``--apply`` to write."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="rewrite (default: dry run)")
    args = parser.parse_args()

    client: AsyncMongoClient = AsyncMongoClient(settings.MONGO_URI)
    try:
        report = await migrate(client[settings.DATABASE_NAME], args.apply)
    finally:
        await client.close()

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"[{mode}] database: {settings.DATABASE_NAME}")
    print(f"  Mermaid diagrams with an init block: {report['checked']}")
    print(f"  with a pre-0.9.0 block: {report['to_migrate']}")
    if report["examples"]:
        print(f"  examples (diagram ids): {', '.join(report['examples'])}")
    if args.apply:
        print(f"  rewritten: {report['migrated']}")
    elif report["to_migrate"]:
        print("  run again with --apply to move them to Mermaid 12's look")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
