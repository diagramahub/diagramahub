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
   openai:gpt-5.4-mini claude:claude-haiku-4-5-20251001 deepseek:deepseek-flash gemini:gemini-3.5-flash-lite 2>/dev/null' \
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
