# Extender DiagramaHub

Recetas para las extensiones más comunes. En todas: textos en español **e** inglés, pruebas para cada endpoint nuevo y nada de lógica de negocio en las rutas.

## Crear un módulo del backend

Una entidad = una carpeta. Ejemplo con una entidad `templates`:

1. **Crea la carpeta** `backend/app/api/v1/templates/` con `__init__.py`, `interfaces.py`, `repository.py`, `services.py`, `schemas.py` y `routes.py`.
2. **Esquemas** (`schemas.py`): modelos Pydantic v2 `TemplateBase`, `TemplateCreate`, `TemplateUpdate`, `TemplateResponse` y el documento `TemplateInDB(Document)` de Beanie.
3. **Interfaz** (`interfaces.py`): `class ITemplateRepository(ABC)` con métodos `@abstractmethod` (`create`, `get_by_id`, `list_by_user`, …).
4. **Repositorio** (`repository.py`): `TemplateRepository(ITemplateRepository)` implementado con Beanie.
5. **Servicio** (`services.py`): `TemplateService` recibe un `ITemplateRepository` en el constructor; aquí van las reglas (propiedad del recurso, límites, validaciones).
6. **Rutas** (`routes.py`): un `APIRouter`, una función `get_template_service()` que arma el servicio con el repositorio concreto, y endpoints que usan `Depends(get_current_user_id)` y delegan al servicio.
7. **Registra** en `main.py` el documento en `init_beanie(document_models=[...])` y el router con `app.include_router(router, prefix=settings.API_V1_PREFIX)`.
8. **Pruebas** en `backend/tests/api/v1/templates/` usando `authenticated_client`.

```python title="routes.py (esqueleto)"
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

!!! warning "Toda ruta privada debe identificar al usuario"
    Cada endpoint que lee o modifica datos de un usuario necesita `Depends(get_current_user_id)` (o `get_current_user`) y el servicio debe comprobar que el recurso le pertenece. Sin eso, cualquiera que conozca un id podría leerlo.

## Agregar un proveedor de IA

1. **Cliente**: crea `backend/app/api/v1/ai_providers/clients/<proveedor>_client.py` con una clase que extienda `BaseAIClient` e implemente sus métodos abstractos (`complete`, `generate_description`, `fix_diagram`, `validate_api_key`, `chat_with_context`, `summarize_conversation` y la propiedad `provider_name`). La generación y mejora de diagramas ya viven en `BaseAIClient` con el mismo prompt para todos los proveedores.
2. **Enum**: agrega el valor a `AIProviderType` en `ai_providers/schemas.py` **y** en `frontend/src/types/ai.ts`.
3. **Fábrica**: regístralo en `_clients_map` de `ai_providers/clients/factory.py`.
4. **Catálogo de modelos**: añade sus modelos a [`model_catalog.json`](https://github.com/diagramahub/diagramahub/blob/main/backend/app/api/v1/ai_providers/model_catalog.json), la fuente única de verdad:

    ```json
    {"provider": "nuevo", "id": "nuevo-model-1", "context_window": 128000,
     "listed": true, "recommended": true, "supports_temperature": true}
    ```

    - `listed`: el modelo aparece en la interfaz (los no listados se conservan para que configuraciones guardadas sigan funcionando).
    - `recommended`: exactamente uno por proveedor; es el modelo por defecto.
    - `context_window`: lo usa la compactación del chat.
    - `supports_temperature`: `false` si el modelo rechaza ese parámetro.

    Verifica los modelos contra la documentación del proveedor y con una llamada real.

5. **Frontend**: agrega los mismos modelos `listed` a `AI_PROVIDER_MODELS` en `frontend/src/types/ai.ts`. El test `aiModelCatalog.test.ts` falla si no coinciden (ids, orden y recomendado).
6. **Textos**: nombre y ayuda del proveedor en `ai.providers.<id>` y `ai.help.<id>` de `es.json` y `en.json`. El modal de proveedores recorre `AIProviderType`, así que aparece solo.
7. **Mide**: corre el [benchmark de IA](pruebas.md#benchmark-de-ia) con el modelo nuevo.

## Agregar una página del frontend

1. Crea el componente en `frontend/src/pages/MiPaginaPage.tsx`.
2. Agrega la ruta en `App.tsx`: dentro de `PrivateRoute` y `SidebarLayout` si requiere sesión, o junto a las públicas si no.
3. Agrega los métodos de API a `ApiService` en `services/api.ts` y los tipos en `types/`.
4. Sigue [`DESIGN.md`](https://github.com/diagramahub/diagramahub/blob/main/DESIGN.md): Tailwind, modo oscuro, accesibilidad, sin librerías de UI.
5. Todos los textos con `t()`.

## Agregar textos (i18n)

1. Añade la clave en **ambos** archivos, `frontend/src/i18n/locales/es.json` y `en.json`, en la sección que corresponda (`common`, `nav`, `auth`, `diagram`, `editor`, `errors`, …).
2. Usa los mismos placeholders `{{nombre}}` en los dos idiomas. Para plurales usa las formas de i18next (`_one` / `_other`), no el sufijo antiguo `_plural`.
3. Corre `pnpm test`: `i18nParity.test.ts` comprueba claves, placeholders y plurales.
