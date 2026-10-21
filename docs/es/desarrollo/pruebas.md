# Pruebas

## Backend: pytest

Las pruebas corren **dentro del contenedor** del backend (necesitan MongoDB levantado). Herramientas: pytest + pytest-asyncio + pytest-cov + Hypothesis + Faker.

```bash
# Suite completa con el piso de cobertura (la que debe pasar antes de un release)
docker exec diagramahub-backend poetry run pytest --cov-fail-under=60
# Equivalente, con el script del backend
docker exec diagramahub-backend ./run-tests.sh

# Más rápido, sin cobertura
docker exec diagramahub-backend poetry run pytest --no-cov

# Por marker
docker exec diagramahub-backend poetry run pytest -m unit
docker exec diagramahub-backend poetry run pytest -m integration
docker exec diagramahub-backend poetry run pytest -m property

# Parar en el primer fallo / filtrar por nombre
docker exec diagramahub-backend poetry run pytest -x
docker exec diagramahub-backend poetry run pytest -k chat_sessions
```

`run-tests.sh` acepta además `--unit`, `--integration`, `--cov` y `--quick`.

### Cómo están organizadas

- Las pruebas reflejan los módulos: `backend/tests/api/v1/<módulo>/`, más `tests/core/` para `deps`, el rate limiter y el límite de tamaño de petición.
- `asyncio_mode = "auto"`: no hace falta `@pytest.mark.asyncio`.
- `--strict-markers`: solo existen los markers `unit`, `integration`, `slow` y `property`.
- Base de datos aislada **`diagramahub_test`**, que se elimina después de cada prueba.

Fixtures de [`tests/conftest.py`](https://github.com/diagramahub/diagramahub/blob/main/backend/tests/conftest.py):

| Fixture | Qué da |
|---|---|
| `test_db` | Beanie inicializado sobre `diagramahub_test` |
| `client` | `httpx.AsyncClient` contra la app |
| `user_data` | Datos de usuario aleatorios (Faker) |
| `registered_user` | Usuario ya registrado |
| `authenticated_client` | `client` con el `Authorization` de ese usuario |

### Cobertura

La cobertura está activa por defecto (`--cov=app`, reportes en terminal, HTML y XML). La suite **completa** exige un piso del **60 %** con `--cov-fail-under=60`.

!!! info "¿Por qué el piso no está en `addopts`?"
    Una corrida parcial (`-m unit`, `-k ...`) no puede alcanzar un piso calculado sobre todo el proyecto. Por eso el piso va en el comando de la suite completa y no en la configuración. Súbelo a medida que se agreguen pruebas.

### Property-based testing

Las pruebas con [Hypothesis](https://hypothesis.readthedocs.io/) llevan el marker `property` (por ejemplo, los eventos SSE y el streaming del chat en `tests/api/v1/chat_sessions/`).

### Credenciales de prueba

Nunca escribas contraseñas, tokens ni keys literales en pruebas o scripts. Usa los generadores de [`backend/tests/utils/security.py`](https://github.com/diagramahub/diagramahub/blob/main/backend/tests/utils/security.py):

| Función | Uso |
|---|---|
| `generate_test_password()` | Contraseña aleatoria válida para la política (12+ caracteres, mayúscula, minúscula, dígito y especial) |
| `generate_weak_password()`, `generate_password_missing_uppercase()`, `generate_password_missing_lowercase()`, `generate_password_missing_digit()` | Casos inválidos de la política |
| `generate_test_token()`, `generate_test_secret()`, `generate_test_api_key()` | Valores aleatorios con prefijo |

En shell, `scripts/test-helpers.sh` ofrece `generate_runtime_password`.

## Frontend: Vitest

Vitest prueba **utilidades puras** (entorno Node, sin DOM ni red). Las pruebas viven en `src/**/__tests__/*.test.ts`.

```bash
cd frontend
pnpm test          # vitest run
pnpm test:watch    # modo watch
```

Pruebas actuales en `src/utils/__tests__/`:

| Prueba | Qué protege |
|---|---|
| `aiModelCatalog.test.ts` | Los selectores de modelos del frontend ofrecen exactamente los modelos `listed` del catálogo del backend, en el mismo orden y con el mismo recomendado |
| `i18nParity.test.ts` | `es.json` y `en.json` tienen las mismas claves y los mismos placeholders |
| `sketchToMermaid.test.ts` | Conversión del boceto del pizarrón a Mermaid |
| `mermaidCheck.test.ts` | El mensaje que pide a la IA corregir un Mermaid inválido incluye el error y el código completo, en el idioma del usuario |
| `freehandExport.test.ts`, `download.test.ts` | Exportación del pizarrón y descargas |

El comportamiento de la interfaz se verifica a mano o con Playwright contra el entorno de desarrollo.

## Scripts de humo

Desde la raíz del repo, con los servicios levantados:

| Script | Qué hace |
|---|---|
| `bash verify-installation.sh` | Comprueba que todos los servicios respondan |
| `bash test-api.sh` | Recorre la API: registro, login, reseteo de contraseña, etc. |
| `bash test-onboarding.sh` | Flujo de onboarding |
| `bash test-onboarding-wizard.sh` | Flujo del asistente de onboarding (primer proyecto) |

## Benchmark de IA

[`scripts/ai-benchmark/`](https://github.com/diagramahub/diagramahub/tree/main/scripts/ai-benchmark) mide qué tan seguido el código generado por la IA se renderiza al primer intento. Úsalo antes y después de cambiar prompts, el flujo del chat o el catálogo de modelos.

- `chat.py` corre el `ChatSessionService.stream_message` real (lo que usa la interfaz) con repositorios en memoria.
- `generate.py` mide el endpoint `/ai/generate-diagram`.
- 10 descripciones × 4 tipos (Mermaid, PlantUML, D2, DBML) por modelo. PlantUML, D2 y DBML se validan con Kroki; Mermaid con `validate_mermaid.js` (Playwright, con el build real de `mermaid`).

!!! warning "Cuesta dinero"
    Cada corrida hace 40 llamadas por modelo con las keys guardadas en una cuenta local. Usa modelos baratos. Las instrucciones completas están en el [README del benchmark](https://github.com/diagramahub/diagramahub/blob/main/scripts/ai-benchmark/README.md).
