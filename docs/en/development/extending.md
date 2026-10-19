# Extending DiagramaHub

Recipes for the most common extensions. In all of them: text in Spanish **and** English, tests for every new endpoint and no business logic in routes.

## Creating a backend module

One entity = one folder. Example with a `templates` entity:

1. **Create the folder** `backend/app/api/v1/templates/` with `__init__.py`, `interfaces.py`, `repository.py`, `services.py`, `schemas.py` and `routes.py`.
2. **Schemas** (`schemas.py`): Pydantic v2 models `TemplateBase`, `TemplateCreate`, `TemplateUpdate`, `TemplateResponse` and the Beanie document `TemplateInDB(Document)`.
3. **Interface** (`interfaces.py`): `class ITemplateRepository(ABC)` with `@abstractmethod` methods (`create`, `get_by_id`, `list_by_user`, …).
4. **Repository** (`repository.py`): `TemplateRepository(ITemplateRepository)` implemented with Beanie.
5. **Service** (`services.py`): `TemplateService` receives an `ITemplateRepository` in its constructor; the rules live here (resource ownership, limits, validation).
6. **Routes** (`routes.py`): an `APIRouter`, a `get_template_service()` function that builds the service with the concrete repository, and endpoints that use `Depends(get_current_user_id)` and delegate to the service.
7. **Register** the document in `init_beanie(document_models=[...])` and the router with `app.include_router(router, prefix=settings.API_V1_PREFIX)` in `main.py`.
8. **Tests** in `backend/tests/api/v1/templates/` using `authenticated_client`.

```python title="routes.py (skeleton)"
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user_id
from app.api.v1.templates.repository import TemplateRepository
from app.api.v1.templates.schemas import TemplateCreate, TemplateResponse
from app.api.v1.templates.services import TemplateService

router = APIRouter(prefix="/templates", tags=["templates"])


def get_template_service() -> TemplateService:
    """Build the service with its concrete repository."""
    return TemplateService(repository=TemplateRepository())


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(
    body: TemplateCreate,
    user_id: str = Depends(get_current_user_id),
    service: TemplateService = Depends(get_template_service),
) -> TemplateResponse:
    """Create a template owned by the current user."""
    return await service.create(body, user_id)
```

!!! warning "Every private route must identify the user"
    Each endpoint that reads or changes a user's data needs `Depends(get_current_user_id)` (or `get_current_user`), and the service must check that the resource belongs to that user. Without it, anyone who knows an id could read it.

## Adding an AI provider

1. **Client**: create `backend/app/api/v1/ai_providers/clients/<provider>_client.py` with a class that extends `BaseAIClient` and implements its abstract methods (`complete`, `generate_description`, `fix_diagram`, `validate_api_key`, `chat_with_context`, `summarize_conversation` and the `provider_name` property). Diagram generation and improvement already live in `BaseAIClient`, with the same prompt for every provider.
2. **Enum**: add the value to `AIProviderType` in `ai_providers/schemas.py` **and** in `frontend/src/types/ai.ts`.
3. **Factory**: register it in `_clients_map` in `ai_providers/clients/factory.py`.
4. **Model catalog**: add its models to [`model_catalog.json`](https://github.com/diagramahub/diagramahub/blob/main/backend/app/api/v1/ai_providers/model_catalog.json), the single source of truth:

    ```json
    {"provider": "new", "id": "new-model-1", "context_window": 128000,
     "listed": true, "recommended": true, "supports_temperature": true}
    ```

    - `listed`: the model is offered in the UI (unlisted ones are kept so saved configurations keep working).
    - `recommended`: exactly one per provider; it is the default model.
    - `context_window`: used by chat compaction.
    - `supports_temperature`: `false` when the model rejects that parameter.

    Check the models against the provider's docs and with a live call.

5. **Frontend**: add the same `listed` models to `AI_PROVIDER_MODELS` in `frontend/src/types/ai.ts`. The `aiModelCatalog.test.ts` test fails if they differ (ids, order and recommended).
6. **Text**: provider name and help under `ai.providers.<id>` and `ai.help.<id>` in `es.json` and `en.json`. The providers modal iterates over `AIProviderType`, so it shows up on its own.
7. **Measure**: run the [AI benchmark](testing.md#ai-benchmark) with the new model.

## Adding a frontend page

1. Create the component in `frontend/src/pages/MyPage.tsx`.
2. Add the route in `App.tsx`: inside `PrivateRoute` and `SidebarLayout` if it needs a session, or next to the public ones if not.
3. Add the API methods to `ApiService` in `services/api.ts` and the types in `types/`.
4. Follow [`DESIGN.md`](https://github.com/diagramahub/diagramahub/blob/main/DESIGN.md): Tailwind, dark mode, accessibility, no UI libraries.
5. All text through `t()`.

## Adding UI text (i18n)

1. Add the key to **both** `frontend/src/i18n/locales/es.json` and `en.json`, in the matching section (`common`, `nav`, `auth`, `diagram`, `editor`, `errors`, …).
2. Use the same `{{name}}` placeholders in both languages. For plurals use i18next's forms (`_one` / `_other`), not the legacy `_plural` suffix.
3. Run `pnpm test`: `i18nParity.test.ts` checks keys, placeholders and plurals.
