"""G9 benchmark for the AI CHAT (what the UI uses), phase 1 — runs in the backend container.

Runs the real ChatSessionService.stream_message (streaming, think-tag filter,
marker parsing, response-mode detection, auto-retry) with in-memory chat
repositories (nothing is written to the database) and the user's real AI
provider. Each case is a fresh session: "Crea un diagrama: <description>" on a
diagram that holds a small starter. The improved_code from the final `done`
event is validated with Kroki (PlantUML/D2/DBML); Mermaid is validated later in
the browser (validate_mermaid.js). No API key is printed.

Usage: see scripts/ai-benchmark/README.md
"""

import asyncio
import json
import os
import sys
import time
from types import SimpleNamespace

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/tmp")  # generate.py is copied next to this script
from generate import CASES, KROKI_TYPES, kroki_validate  # noqa: E402

from app.api.v1.ai_providers.repository import AIProviderRepository  # noqa: E402
from app.api.v1.ai_providers.schemas import UserAISettingsInDB  # noqa: E402
from app.api.v1.ai_providers.services import AIProviderService  # noqa: E402
from app.api.v1.chat_sessions.services import ChatSessionService  # noqa: E402

STARTERS = {
    "mermaid": "flowchart TD\n    A[Inicio] --> B[Fin]",
    "plantuml": "@startuml\nAlice -> Bob: Hola\n@enduml",
    "d2": "a -> b",
    "dbml": "Table ejemplo {\n  id integer [pk]\n}",
}


class MemorySessions:
    def __init__(self):
        self.session = SimpleNamespace(
            id="s1", status="active", summary=None, title=None, user_id="u", diagram_id="d"
        )

    async def get_session_by_id(self, _sid):
        return self.session

    async def update_session_last_provider(self, *a, **k):
        return self.session

    async def update_session_summary(self, *a, **k):
        return self.session

    async def update_session_title(self, *a, **k):
        return self.session


class MemoryMessages:
    def __init__(self):
        self.items = []

    async def create_message(self, session_id, role, content, **extra):
        msg = SimpleNamespace(id=f"m{len(self.items)}", session_id=session_id, role=role, content=content, **extra)
        self.items.append(msg)
        return msg

    async def get_recent_messages(self, _sid, limit=4):
        return self.items[-limit:]

    async def count_messages_by_session(self, _sid):
        return len(self.items)


async def run_case(user_id, provider, model, diagram_type, index, description, sem):
    async with sem:
        service = ChatSessionService(MemorySessions(), MemoryMessages(), AIProviderService(AIProviderRepository()))
        started = time.time()
        result = {"model": model, "type": diagram_type, "case": index}
        events = []
        try:
            async for raw in service.stream_message(
                session_id="s1",
                user_id=user_id,
                content=f"Crea un diagrama: {description}",
                diagram_code=STARTERS[diagram_type],
                diagram_type=diagram_type,
                provider=provider,
                model=model,
                language="es",
            ):
                for line in raw.splitlines():
                    if line.startswith("data: "):
                        events.append(json.loads(line[6:]))
        except Exception as exc:  # noqa: BLE001
            result.update(ok_call=False, code="", error=str(exc)[:300])
            return result
        result["seconds"] = round(time.time() - started, 1)
        mode = next((e["mode"] for e in events if e["type"] == "mode"), None)
        done = next((e for e in events if e["type"] == "done"), None)
        error = next((e for e in events if e["type"] == "error"), None)
        result["mode"] = mode
        result["retried"] = sum(1 for e in events if e["type"] == "phase" and "intaxis" in e.get("phase", ""))
        if error or not done:
            result.update(ok_call=False, code="", error=str(error)[:300])
            return result
        code = done.get("improved_code") or ""
        reply = "".join(e.get("content", "") for e in events if e["type"] == "token")
        result.update(ok_call=True, code=code, reply_len=len(reply), reply_head=reply[:300], reply_tail=reply[-300:])
        if not code:
            result.update(valid=False, validation_error="no code extracted from the reply")
        elif diagram_type in KROKI_TYPES:
            valid, message = await asyncio.to_thread(kroki_validate, diagram_type, code)
            result.update(valid=valid, validation_error=message)
        return result


async def main():
    email, label, targets = sys.argv[1], sys.argv[2], sys.argv[3:]
    db = AsyncIOMotorClient(os.environ["MONGO_URI"])[os.environ["DATABASE_NAME"]]
    await init_beanie(database=db, document_models=[UserAISettingsInDB])
    user_id = str((await db.users.find_one({"email": email}))["_id"])
    sem = asyncio.Semaphore(4)
    tasks = []
    for target in targets:
        provider, model = target.split(":", 1)
        for diagram_type, descriptions in CASES.items():
            for index, description in enumerate(descriptions):
                tasks.append(run_case(user_id, provider, model, diagram_type, index, description, sem))
    results = await asyncio.gather(*tasks)
    print(json.dumps({"label": label, "results": results}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
