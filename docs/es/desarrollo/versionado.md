# Versionado y releases

DiagramaHub sigue [Semantic Versioning 2.0.0](https://semver.org/): `MAJOR.MINOR.PATCH`. La política completa está en [`VERSIONING.md`](https://github.com/diagramahub/diagramahub/blob/main/VERSIONING.md).

| Incremento | Cuándo |
|---|---|
| **PATCH** | Correcciones, pulido, mejoras de rendimiento, ajustes de prompts, refactors internos: ninguna capacidad nueva |
| **MINOR** | Una funcionalidad o capacidad nueva compatible con lo anterior |
| **MAJOR** | Cambios incompatibles en la API, estructuras de datos, import/export o contratos frontend/backend |

En caso de duda: si solo corrige o pule, es PATCH; si agrega una capacidad, MINOR.

!!! info "Beta"
    Mientras la versión sea `0.x`, las APIs y estructuras de datos pueden cambiar entre versiones. A partir de `1.0.0`, todo cambio incompatible requerirá subir MAJOR.

## Ramas y tags

- Cada versión se trabaja en una rama **`release/<V>`** (p. ej. `release/0.8.4`) y se integra a `main` con un PR.
- Los tags de Git **no llevan prefijo `v`**: `0.8.3`, no `v0.8.3`.

## Archivos que llevan la versión

| Archivo | Valor |
|---|---|
| `frontend/package.json` | `"version": "<V>"` |
| `backend/pyproject.toml` | `version = "<V>"` |
| `frontend/.env.template` | `VITE_APP_VERSION=<V>` |
| `backend/app/core/config.py` | `VERSION: str = "<V>"` (se reporta en `GET /`, Swagger y Sentry) |
| `AGENTS.md` | versión actual, sección de versionado y ejemplo de entorno |
| `VERSIONING.md` | `Versión actual: **<V>**.` |

## Checklist de release

1. Decidir el incremento (MAJOR, MINOR o PATCH).
2. Actualizar la versión en todos los archivos de la tabla anterior.
3. Escribir las notas `docs/es/release-notes/<V>.md` y `docs/en/release-notes/<V>.md`, seccionadas por tipo de cambio (💥 Breaking Changes, ✨ Features, 🐛 Fixes, ♻️ Refactors, ⬆️ Upgrades, 📝 Docs, 🌐 Translations, 🔧 Internal; solo las que tengan entradas).
4. Agregar la fila `[<V>](<V>.md)` a `docs/{es,en}/release-notes/index.md`.
5. Agregar las páginas al `nav` de `mkdocs.yml` (sección "Notas de Versión" / "Release Notes", dentro del grupo de su versión menor).
6. Agregar `## [<V>] - <fecha>` a `CHANGELOG.md` (en inglés, formato [Keep a Changelog](https://keepachangelog.com/)).
7. Actualizar el badge de cobertura del `README.md` con el total de la corrida completa.
8. Crear el tag `<V>`.
9. **Verificación obligatoria**:

    ```bash
    bash scripts/check-version.sh <V>
    ```

    El script revisa, sin excepciones, cada archivo que debe llevar la versión (código, configuración, docs, notas de versión, `nav` de MkDocs y CHANGELOG). Si algo sale `FAIL`, no se hace merge del release.

!!! note
    Los lockfiles (`backend/poetry.lock`, `frontend/pnpm-lock.yaml`) no se editan a mano y el script los ignora. Si un archivo nuevo empieza a llevar la versión, agrégalo al checklist de `VERSIONING.md` y al script.

## Sitio de documentación

Este sitio se construye con MkDocs Material y se publica en GitHub Pages con el workflow `.github/workflows/docs.yml` cada vez que cambia `docs/`, `overrides/` o `mkdocs.yml` en `main` (en los PR solo se construye). Para verlo en local:

```bash
pip install -r docs/requirements.txt
mkdocs serve            # http://127.0.0.1:8000
mkdocs build --strict   # falla ante enlaces rotos, como en CI
```
