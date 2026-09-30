# Plan vivo — Versión 0.7.1: Estabilidad, seguridad y rendimiento (PATCH)

- **Inicio**: 2026-09-30
- **Rama**: `release/0.7.1` (desde `main` = tag `0.7.0`)
- **Tipo**: PATCH — solo correcciones, seguridad, pulido y rendimiento; nada de funcionalidad nueva (eso es 0.8.0)
- **Regla**: este archivo es interno de la rama y **se elimina antes del merge a `main`**
- **Estados**: ✅ hecho · 🔨 en curso · ⬜ pendiente · 🚫 diferido con criterio

---

## 1. Seguridad y dependencias

| # | Ítem | Evidencia (revisión 2026-09-30) | Estado |
|---|------|--------------------------------|--------|
| S1 | DOMPurify ≥ 3.4.13 | 19 avisos (XSS/bypasses); sanea el SVG de los diagramas | ⬜ |
| S2 | Mermaid ≥ 11.16.1 | 6 avisos (inyección CSS, DoS, prototype pollution) | ⬜ |
| S3 | react-router ≥ 7.18.2 | 1 aviso *high* (modo RSC, no usado) | ⬜ |
| S4 | Poetry 2.x en la imagen del backend | Poetry 1.8.3 + `dulwich` con avisos | ⬜ |
| S5 | Contenedor backend no-root | único contenedor que corre como root | ⬜ |
| S6 | Límite global de tamaño de petición (413) | no existe | ⬜ |

## 2. Bugs

| # | Ítem | Evidencia | Estado |
|---|------|-----------|--------|
| B1 | Abrir un diagrama lo guarda sin cambios | "Guardado justo ahora" al cargar; bump de `updated_at` altera Recientes | ⬜ |
| B2 | Ediciones perdidas al cambiar de diagrama/salir dentro del debounce de 1.5 s | cleanup del efecto cancela el guardado pendiente | ⬜ |
| B3 | Título de la barra con el diagrama anterior durante el cambio | observado en e2e | ⬜ |
| B4 | 6 `alert()` nativos | `AIIntegrationsSection.tsx`, `DiagramEditorPage.tsx` | ⬜ |
| B5 | Textos fijos restantes | modal de nuevo diagrama, 8 `es-ES` literales, 3 `setError("…")` | ⬜ |

## 3. Rendimiento

| # | Ítem | Evidencia | Estado |
|---|------|-----------|--------|
| P1 | Code splitting por ruta + carga diferida de exportación | `index.js` 2.46 MB / 662 KB gz en todas las páginas (login incluido) | ⬜ |
| P2 | Recientes con una consulta limitada | descarga todos los diagramas con contenido de todos los proyectos para mostrar 4 | ⬜ |

## Fuera de alcance (→ 0.8.0)

Funcionalidades nuevas (importar, exportar desde link compartido, embed, templates, historial), índice único de email con migración, MongoDB con credenciales, Redis, separación de claves, migración `python-jose` → PyJWT (aviso de `ecdsa` sin versión corregida), CI y pruebas de contrato.

## Cierre

- [ ] Release notes `docs/{es,en}/release-notes/0.7.1.md`, índices, nav de mkdocs, CHANGELOG
- [ ] `bash scripts/check-version.sh 0.7.1` → OK
- [ ] **Eliminar este archivo** antes de abrir el PR
