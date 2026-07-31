# Política de Versionamiento

Este proyecto adopta oficialmente **Semantic Versioning (SemVer)**.
Versión actual: **0.6.0**.

## Formato

```
MAJOR.MINOR.PATCH
```

## Significado de cada segmento

| Segmento | Cuándo se incrementa | Ejemplos |
|----------|----------------------|----------|
| **MAJOR** | Cambios incompatibles o *breaking changes* que rompen la compatibilidad con versiones anteriores. | Cambio en la estructura de la API, eliminación de endpoints, cambio en el esquema de base de datos sin migración. |
| **MINOR** | Nuevas funcionalidades que son compatibles con lo anterior. | Nuevo módulo, nuevo endpoint, nueva feature en el frontend. |
| **PATCH** | Correcciones de bugs, mejoras menores, refactors internos, ajustes visuales o mejoras que no rompen compatibilidad. | Fix de un bug en autenticación, ajuste de estilos CSS, refactor interno de un servicio, mejora de rendimiento. |

## Criterios prácticos

### PATCH

- Corrección de errores.
- Mejoras de rendimiento.
- Cambios menores de UI.
- Ajustes de prompts.
- Refactors internos sin impacto funcional para el usuario.

### MINOR

- Nuevas funcionalidades visibles al usuario.
- Nuevas capacidades del chat AI.
- Nuevas opciones de edición o generación de diagramas.
- Mejoras importantes compatibles en flujos existentes.

### MAJOR

- Cambios incompatibles en API pública.
- Cambios incompatibles en estructura de datos.
- Cambios incompatibles en import/export.
- Cambios incompatibles en almacenamiento, sesiones o contratos frontend/backend.

## En caso de duda

- Si solo corrige o pule → **PATCH**.
- Si agrega capacidad nueva → **MINOR**.

## Secciones de las Release Notes

Cada release note se secciona por tipo de cambio. Solo se incluyen las secciones que tengan entradas. Categorías en este orden:

| Sección | Emoji | Qué incluye |
|---------|-------|-------------|
| **Breaking Changes** | 💥 | Cambios incompatibles que requieren acción del usuario (migraciones, cambios de config, cambios de API). |
| **Features** | ✨ | Nueva funcionalidad visible al usuario. |
| **Fixes** | 🐛 | Correcciones de bugs. |
| **Refactors** | ♻️ | Reestructuración de código sin cambio de comportamiento visible. |
| **Upgrades** | ⬆️ | Actualización de dependencias, bumps de versiones de librerías. |
| **Docs** | 📝 | Adiciones o mejoras de documentación. |
| **Translations** | 🌐 | Traducciones nuevas o actualizadas (i18n). |
| **Internal** | 🔧 | CI/CD, tooling, infraestructura, cambios solo para desarrollo. |

### Formato de cada release note

Cada release es un archivo `docs/{lang}/release-notes/{VERSION}.md` con esta estructura:

```markdown
# {VERSION} ({YYYY-MM-DD})

Resumen breve del release.

## ✨ Features

- Descripción de feature A.
- Descripción de feature B.

## 🐛 Fixes

- Descripción del fix.

## 🔧 Internal

- Descripción del cambio interno.
```

## Convenciones adicionales

1. Toda versión debe poder explicarse en `CHANGELOG.md`.
2. Toda versión oficial debe etiquetarse en Git con el formato: `0.1.0`, `0.1.1`, `0.2.0`, etc.
3. A partir de `1.0.0`, cualquier cambio incompatible requiere incrementar **MAJOR**.

## Checklist de release

Al crear una nueva versión:

1. Determinar el bump correcto (MAJOR, MINOR o PATCH).
2. Crear el archivo de release notes en `docs/es/release-notes/{VERSION}.md` y `docs/en/release-notes/{VERSION}.md`, seccionado por tipo de cambio.
3. Agregar la nueva versión al índice en `docs/es/release-notes/index.md` y `docs/en/release-notes/index.md`.
4. Agregar las nuevas páginas de release notes al `nav` en `mkdocs.yml` bajo las secciones "Notas de Versión" / "Release Notes".
5. Actualizar `CHANGELOG.md`.
6. Actualizar la "Versión actual" en este archivo (`VERSIONING.md`).
7. Actualizar la versión actual en `AGENTS.md`.

## Referencia

Basado en [Semantic Versioning 2.0.0](https://semver.org/).
