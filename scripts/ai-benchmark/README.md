# AI prompt benchmark

Measures how often AI-generated diagram code renders on the first try. Use it
before and after changing prompts, the chat flow or the model catalog.

- `chat.py` — **the AI chat, what users actually use**: runs the real
  `ChatSessionService.stream_message` (streaming, marker parsing, response-mode
  detection, auto-retry) with in-memory chat repositories (nothing is written).
- `generate.py` — the `/ai/generate-diagram` endpoint (API only, no UI uses it).

- 10 descriptions × 4 diagram types (Mermaid, PlantUML, D2, DBML) per model, in Spanish.
- Generation goes through the app's own AI clients (same prompts and code extraction as production).
- PlantUML, D2 and DBML are validated with the real Kroki renderer; Mermaid with the
  app's own `mermaid` build in a browser.
- API keys come from a local account's saved providers (read through the app, never printed).
  Each run makes 40 calls per model: use the cheap models.

```bash
# 1. Generate + validate Kroki types (inside the backend container)
docker exec -i -u 0 diagramahub-backend sh -c 'cat > /tmp/generate.py' < scripts/ai-benchmark/generate.py
docker exec -w /app diagramahub-backend sh -c \
  'PYTHONPATH=/app poetry run python /tmp/generate.py you@example.com "label" \
   openai:gpt-6-luna claude:claude-haiku-5-5 deepseek:deepseek-flash gemini:gemini-3.5-flash-lite 2>/dev/null' \
  > results.json
docker exec -u 0 diagramahub-backend rm -f /tmp/generate.py

# 2. Validate Mermaid and print the summary (Playwright, dev stack running)
node scripts/ai-benchmark/validate_mermaid.js results.json
```

For the chat, copy both `generate.py` and `chat.py` to `/tmp` and run `chat.py` with the
same arguments (`/tmp/chat.py you@example.com "label" provider:model ...`).

Results for 0.8.1 (same 160 cases, 4 cheap models):

| Path | 0.8.0 | 0.8.1 |
|---|---|---|
| AI chat (streaming) | 88 % | 99 % |
| `/ai/generate-diagram` | 72 % | 98 % |

## Newer Mermaid types (`mermaid_types.py`)

Measures the Mermaid syntax reference the prompts carry
(`backend/app/api/v1/ai_providers/mermaid_reference.json`): one request per newer type
(mindmap, timeline, Venn, Wardley, Kanban, Ishikawa, …) checking that the model **uses
that type** and that it renders, 14 broken diagrams of those types to fix
(`mermaid_fix_cases.json`, with mermaid's real error) and the 10 classic Mermaid cases of
`generate.py` to catch regressions, plus 6 requests for the flowchart extras (animated
edges, step-by-step animation, BPMN shapes: they count when the code uses them).
`--chat` runs the requests through the real chat instead of generate/fix. Run it after changing the reference or upgrading mermaid
(the reference's examples are also parsed in CI by
`frontend/src/utils/__tests__/mermaidReference.test.ts`).

```bash
docker exec -u 0 diagramahub-backend mkdir -p /tmp/abench
for f in generate.py chat.py mermaid_types.py mermaid_fix_cases.json; do
  docker cp scripts/ai-benchmark/$f diagramahub-backend:/tmp/abench/; done
docker exec -u 0 diagramahub-backend chmod -R a+r /tmp/abench
docker exec -w /app diagramahub-backend sh -c \
  'PYTHONPATH=/app poetry run python /tmp/abench/mermaid_types.py you@example.com "label" \
   deepseek:deepseek-flash gemini:gemini-3.8-flash 2>/dev/null' > mermaid-types.json
# add --chat after the script name for the chat; then validate and print the summary:
node scripts/ai-benchmark/validate_mermaid_types.js mermaid-types.json
docker exec -u 0 diagramahub-backend rm -rf /tmp/abench
```

Results for 0.9.0 (DeepSeek `deepseek-flash` · Gemini `gemini-3.8-flash`; ranges are over two runs):

| Case | Without the reference | With the reference |
|---|---|---|
| Newer type requested: uses it and renders (generate) | 0/24 · 3/24 | 21–23/24 · 23/24 |
| Newer type requested: uses it and renders (chat) | — | 21–23/24 · 23/24 |
| Fix a broken diagram of a newer type | 10/14 · 10/14 | 14/14 · 14/14 |
| Flowchart extras: animated edges, steps, BPMN (generate · chat) | 0/12 · 0/12 | 12/12 · 12/12 |
| Classic Mermaid (generate) | 10/10 · 10/10 | 10/10 · 10/10 |
| Classic Mermaid (chat) | — | 10/10 · 10/10 |

Without the reference the models drew almost everything as a flowchart (it rendered, but it
wasn't what was asked) and never used animation or BPMN shapes; with it, classic requests still
come back without unrequested animation (0/40). The one miss left in generate is "block diagram", answered with a flowchart.
