# Testing

## Backend: pytest

Tests run **inside the backend container** (MongoDB must be up). Tools: pytest + pytest-asyncio + pytest-cov + Hypothesis + Faker.

```bash
# Full suite with the coverage floor (must pass before a release)
docker exec diagramahub-backend poetry run pytest --cov-fail-under=45
# Same thing, through the backend script
docker exec diagramahub-backend ./run-tests.sh

# Faster, without coverage
docker exec diagramahub-backend poetry run pytest --no-cov

# By marker
docker exec diagramahub-backend poetry run pytest -m unit
docker exec diagramahub-backend poetry run pytest -m integration
docker exec diagramahub-backend poetry run pytest -m property

# Stop at the first failure / filter by name
docker exec diagramahub-backend poetry run pytest -x
docker exec diagramahub-backend poetry run pytest -k chat_sessions
```

`run-tests.sh` also accepts `--unit`, `--integration`, `--cov` and `--quick`.

### How they are organized

- Tests mirror the modules: `backend/tests/api/v1/<module>/`, plus `tests/core/` for `deps`, the rate limiter and the request size limit.
- `asyncio_mode = "auto"`: no `@pytest.mark.asyncio` needed.
- `--strict-markers`: only the `unit`, `integration`, `slow` and `property` markers exist.
- Isolated **`diagramahub_test`** database, dropped after each test.

Fixtures from [`tests/conftest.py`](https://github.com/diagramahub/diagramahub/blob/main/backend/tests/conftest.py):

| Fixture | Provides |
|---|---|
| `test_db` | Beanie initialized on `diagramahub_test` |
| `client` | `httpx.AsyncClient` against the app |
| `user_data` | Random user data (Faker) |
| `registered_user` | An already registered user |
| `authenticated_client` | `client` with that user's `Authorization` |

### Coverage

Coverage is on by default (`--cov=app`, terminal, HTML and XML reports). The **full** suite enforces a **45%** floor with `--cov-fail-under=45`.

!!! info "Why isn't the floor in `addopts`?"
    A partial run (`-m unit`, `-k ...`) can't reach a floor computed over the whole project. That's why the floor lives in the full-suite command instead of the configuration. Raise it as tests land.

### Property-based testing

[Hypothesis](https://hypothesis.readthedocs.io/) tests carry the `property` marker (for example, the SSE events and chat streaming in `tests/api/v1/chat_sessions/`).

### Test credentials

Never write literal passwords, tokens or keys in tests or scripts. Use the generators in [`backend/tests/utils/security.py`](https://github.com/diagramahub/diagramahub/blob/main/backend/tests/utils/security.py):

| Function | Use |
|---|---|
| `generate_test_password()` | Random password that satisfies the policy (12+ characters, upper, lower, digit and special) |
| `generate_weak_password()`, `generate_password_missing_uppercase()`, `generate_password_missing_lowercase()`, `generate_password_missing_digit()` | Invalid policy cases |
| `generate_test_token()`, `generate_test_secret()`, `generate_test_api_key()` | Random prefixed values |

In shell scripts, `scripts/test-helpers.sh` provides `generate_runtime_password`.

## Frontend: Vitest

Vitest tests **pure utilities** (Node environment, no DOM or network). Tests live in `src/**/__tests__/*.test.ts`.

```bash
cd frontend
pnpm test          # vitest run
pnpm test:watch    # watch mode
```

Current tests in `src/utils/__tests__/`:

| Test | What it guards |
|---|---|
| `aiModelCatalog.test.ts` | The frontend model pickers offer exactly the backend catalog's `listed` models, in the same order and with the same recommended one |
| `i18nParity.test.ts` | `es.json` and `en.json` have the same keys and the same placeholders |
| `sketchToMermaid.test.ts` | Whiteboard sketch to Mermaid conversion |
| `mermaidCheck.test.ts` | The message asking the AI to fix invalid Mermaid includes the error and the full code, in the user's language |
| `freehandExport.test.ts`, `download.test.ts` | Whiteboard export and downloads |

UI behavior is checked by hand or with Playwright against the development stack.

## Smoke scripts

From the repo root, with the services running:

| Script | What it does |
|---|---|
| `bash verify-installation.sh` | Checks that every service responds |
| `bash test-api.sh` | Walks the API: registration, login, password reset, etc. |
| `bash test-onboarding.sh` | Onboarding flow |
| `bash test-onboarding-wizard.sh` | Onboarding wizard flow (first project) |

## AI benchmark

[`scripts/ai-benchmark/`](https://github.com/diagramahub/diagramahub/tree/main/scripts/ai-benchmark) measures how often AI-generated code renders on the first try. Use it before and after changing prompts, the chat flow or the model catalog.

- `chat.py` runs the real `ChatSessionService.stream_message` (what the UI uses) with in-memory repositories.
- `generate.py` measures the `/ai/generate-diagram` endpoint.
- 10 descriptions × 4 types (Mermaid, PlantUML, D2, DBML) per model. PlantUML, D2 and DBML are validated with Kroki; Mermaid with `validate_mermaid.js` (Playwright, with the real `mermaid` build).

!!! warning "It costs money"
    Each run makes 40 calls per model with the keys saved in a local account. Use cheap models. Full instructions in the [benchmark README](https://github.com/diagramahub/diagramahub/blob/main/scripts/ai-benchmark/README.md).
