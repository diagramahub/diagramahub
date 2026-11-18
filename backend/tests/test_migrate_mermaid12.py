"""
Migration of pre-0.9.0 Mermaid init blocks to Mermaid 12's defaults.
"""

import pytest
from pymongo import AsyncMongoClient

from app.core.config import settings
from scripts.migrate_mermaid12 import migrate, migrate_init_block


@pytest.mark.unit
@pytest.mark.parametrize(
    "content, expected",
    [
        (
            '%%{init: {"theme":"default","flowchart":{"curve":"basis"}}}%%\ngraph TD\n  A-->B',
            '%%{init: {"theme":"redux-color","look":"neo"}}%%\ngraph TD\n  A-->B',
        ),
        (
            '%%{init: {"theme":"dark","flowchart":{"curve":"step"}}}%%\ngraph TD',
            '%%{init: {"theme":"dark","flowchart":{"curve":"step"},"look":"neo"}}%%\ngraph TD',
        ),
        (
            '%%{init: {"theme":"base","handDrawnSeed":7}}%%\ngraph TD',
            '%%{init: {"theme":"base","handDrawnSeed":7,"look":"handDrawn"}}%%\ngraph TD',
        ),
        (
            '%%{init: {"theme":"default","themeVariables":{"fontSize":"14px"},'
            '"flowchart":{"curve":"basis"}}}%%\ngraph TD',
            '%%{init: {"theme":"redux-color","themeVariables":{"fontSize":"14px"},'
            '"look":"neo"}}%%\ngraph TD',
        ),
        (
            '%%{init: {"theme":"redux-color","layout":"elk","look":"neo"}}%%\nmindmap\n  root',
            '%%{init: {"theme":"redux-color","look":"neo"}}%%\nmindmap\n  root',
        ),
    ],
    ids=["old-default", "chosen-theme-and-curve", "hand-drawn", "keeps-fonts", "drops-elk"],
)
def test_pre_090_blocks_are_migrated(content: str, expected: str) -> None:
    assert migrate_init_block(content) == expected


@pytest.mark.unit
@pytest.mark.parametrize(
    "content",
    [
        '%%{init: {"theme":"redux-color","layout":"dagre","look":"neo"}}%%\ngraph TD',
        "graph TD\n  A-->B",
        "%%{init: {not json}}%%\ngraph TD",
    ],
    ids=["already-mermaid-12", "no-init-block", "broken-json"],
)
def test_other_content_is_left_alone(content: str) -> None:
    assert migrate_init_block(content) is None


@pytest.mark.unit
def test_migration_is_idempotent() -> None:
    once = migrate_init_block('%%{init: {"theme":"default"}}%%\ngraph TD')

    assert once is not None
    assert migrate_init_block(once) is None


@pytest.mark.integration
async def test_script_rewrites_only_old_mermaid_blocks(test_db) -> None:
    client: AsyncMongoClient = AsyncMongoClient(settings.MONGO_URI)
    db = client[f"{settings.DATABASE_NAME}_test"]
    old = '%%{init: {"theme":"default","flowchart":{"curve":"basis"}}}%%\ngraph TD'
    try:
        await db["diagrams"].insert_many(
            [
                {"diagram_type": "mermaid", "content": old},
                {"diagram_type": "mermaid", "content": "graph TD"},
                {"diagram_type": "plantuml", "content": "@startuml\n@enduml"},
            ]
        )

        dry = await migrate(db, apply=False)
        assert await db["diagrams"].find_one({"diagram_type": "mermaid", "content": old})
        applied = await migrate(db, apply=True)
        again = await migrate(db, apply=True)

        assert dry["to_migrate"] == applied["migrated"] == 1
        assert again["to_migrate"] == 0
        assert await db["diagrams"].count_documents({"content": old}) == 0
    finally:
        await client.close()
