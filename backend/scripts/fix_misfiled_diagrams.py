#!/usr/bin/env python3
"""
Move misfiled diagrams back to the root of their own project.

Before 0.8.1 the API accepted any ``folder_id`` when creating or updating a
diagram, so a diagram could point at a folder of ANOTHER project (even of
another user), and diagrams whose folder was deleted could keep a dangling id.
Both kinds were missing from their own project's tree and exports.

This script finds diagrams whose ``folder_id`` is not a folder of the
diagram's own project and sets ``folder_id`` to null (project root). It never
deletes anything, does not touch ``updated_at`` and is idempotent.

Usage (inside the backend container):
    poetry run python -m scripts.fix_misfiled_diagrams            # dry run: report only
    poetry run python -m scripts.fix_misfiled_diagrams --apply    # fix
"""

import argparse
import asyncio
import sys
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


async def repair_misfiled_diagrams(db: AsyncIOMotorDatabase, apply: bool) -> dict[str, Any]:
    """Find (and with ``apply`` fix) diagrams filed under a folder outside their project.

    Args:
        db: Database holding the ``diagrams`` and ``folders`` collections
        apply: When False only reports; when True moves them to the project root

    Returns:
        Counts: ``checked``, ``foreign_folder``, ``missing_folder``, ``fixed`` and
        up to 20 example diagram ids (no content, no titles)
    """
    folder_project: dict[str, str] = {}
    async for folder in db["folders"].find({}, {"project_id": 1}):
        folder_project[str(folder["_id"])] = str(folder.get("project_id"))

    report: dict[str, Any] = {
        "checked": 0,
        "foreign_folder": 0,
        "missing_folder": 0,
        "fixed": 0,
        "examples": [],
    }
    misfiled: list[ObjectId] = []
    cursor = db["diagrams"].find(
        {"folder_id": {"$nin": [None, ""]}}, {"folder_id": 1, "project_id": 1}
    )
    async for diagram in cursor:
        report["checked"] += 1
        owner = folder_project.get(str(diagram["folder_id"]))
        if owner == str(diagram.get("project_id")):
            continue
        report["missing_folder" if owner is None else "foreign_folder"] += 1
        misfiled.append(diagram["_id"])
        if len(report["examples"]) < 20:
            report["examples"].append(str(diagram["_id"]))

    if apply and misfiled:
        result = await db["diagrams"].update_many(
            {"_id": {"$in": misfiled}}, {"$set": {"folder_id": None}}
        )
        report["fixed"] = result.modified_count
    return report


async def main() -> int:
    """CLI entry point: dry run by default, ``--apply`` to write."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--apply", action="store_true", help="write the fix (default: dry run)")
    args = parser.parse_args()

    client = AsyncIOMotorClient(settings.MONGO_URI)
    try:
        report = await repair_misfiled_diagrams(client[settings.DATABASE_NAME], args.apply)
    finally:
        client.close()

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"[{mode}] database: {settings.DATABASE_NAME}")
    print(f"  diagrams with a folder checked: {report['checked']}")
    print(f"  pointing at another project's folder: {report['foreign_folder']}")
    print(f"  pointing at a folder that no longer exists: {report['missing_folder']}")
    if report["examples"]:
        print(f"  examples (diagram ids): {', '.join(report['examples'])}")
    if args.apply:
        print(f"  moved to their project's root: {report['fixed']}")
    elif report["foreign_folder"] or report["missing_folder"]:
        print("  run again with --apply to move them to their project's root")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
