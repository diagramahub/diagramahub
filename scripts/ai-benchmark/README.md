# AI prompt benchmark

Measures how often the "generate diagram" prompt produces code that renders on
the first try. Use it before and after changing prompts or adding models.

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

Results for 0.8.1 (same 160 cases): prompts 0.8.0 → 72 % valid; prompts 0.8.1 → 98 %.
