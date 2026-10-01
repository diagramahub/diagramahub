# Plan vivo — Versión 0.8.0 (MINOR): borrador para revisar

- **Inicio**: 2026-10-01 · **Rama**: `release/0.8.0` (desde `main` = tag `0.7.1`)
- **Tipo**: MINOR — admite funcionalidad nueva compatible; cambios con migración van con notas de actualización
- **Regla**: archivo interno de la rama; **se elimina antes del merge a `main`**
- **Estados**: ✅ hecho · 🔨 en curso · ⬜ pendiente · 🚫 descartado/diferido con criterio · ❓ por decidir

---

## 0. Revisión de partida (2026-10-01, verificada en el código)

| Hallazgo | Evidencia |
|---|---|
| Sin CI | no existe `.github/workflows/` |
| Cobertura backend 52.38%, pero baja donde más duele | webhooks de Stripe **14%**, `chat_sessions/services.py` **10%** (519 stmts), `shared_links/services.py` **24%**, OAuth **0–20%**, `plan_service` 19% |
| Las 3 regresiones de 0.7.0 salieron de endpoints sin pruebas | consultas Beanie de links compartidos/planes, `GET /folders/{id}` |
| Frontend sin framework de pruebas | sin Vitest/Jest en `package.json` |
| `DiagramEditorPage.tsx` con 5,632 líneas | autosave, viewport, cambio de diagrama y export viven en un solo componente |
| Índice `users.email` no único | TODO en `users/schemas.py:148` desde 0.6.x |
| Una sola clave cifra API keys de IA **y** secretos TOTP | `core/security.py` usa `AI_ENCRYPTION_KEY` para ambos |
| `python-jose` arrastra `ecdsa` con aviso sin versión corregida | `pyproject.toml` |
| Monaco se carga desde CDN | `@monaco-editor/react` sin `loader.config` → un self-host sin internet pierde el editor y bloquea una CSP estricta |
| MongoDB de `local-full` sin credenciales y con `27017` expuesto | `deploy/local-full/docker-compose.yml` |
| 🚫 **Descartado: SSRF en URLs de proveedores IA** | las URLs de los 5 clientes están fijas en el código; no hay URL configurable que validar |

---

## 1. Track A — Producto (funcionalidad nueva)

| # | Feature | Valor | Esfuerzo | Notas | Estado |
|---|---------|-------|----------|-------|--------|
| F1 | **Historial de versiones** (snapshot al guardar con política de retención, listar, restaurar, comparar) | Alto: red de seguridad ante errores/IA; diferencia clara en el nicho | M/L | Reusa `DiagramDiffView`; nueva colección + límites por plan | ❓ |
| F2 | **Importar archivos** (.mmd/.puml/.d2/.dbml/.txt, arrastrar o seleccionar) | Migración desde archivos locales | S | Solo frontend + endpoint de creación existente; detectar tipo por extensión/contenido | ❓ |
| F3 | **Galería de templates** al crear diagrama (flujo, secuencia, ER, gantt, estados, clases + PlantUML/D2/DBML) | Elimina la página en blanco; onboarding | S/M | El modal de nuevo diagrama ya está traducido (0.7.1) | ❓ |
| F4 | **Exportar desde link compartido** (PNG/SVG para quien ve, sin login) | El link pasa de vitrina a entregable | S/M | Reusa `exportService` (ya carga html2canvas bajo demanda) | ❓ |
| F5 | **Búsqueda global** de diagramas (título + contenido) | Encontrar en proyectos grandes | M | Índice `$text` en Mongo + endpoint paginado + UI en dashboard | ❓ |
| F6 | **Modo embed** (`?embed=1` + "copiar código embed") | Diagramas vivos en READMEs/Notion/wikis | M | Requiere permitir *framing* solo en esa ruta (hoy `X-Frame-Options`/CSP lo impiden): decisión de seguridad | ❓ |
| F7 | **Tokens personales de API** (export/render vía curl en CI) | Automatización | M/L | Sensible: scopes, hash del token, auditoría, revocación | ❓ |

**Recomendación**: F1 + F2 + F3 + F4 para 0.8.0 (F5 si hay espacio). F6 y F7 a 0.9 por su superficie de seguridad.

## 2. Track B — Calidad (habilita ir rápido sin romper)

| # | Ítem | Por qué | Esfuerzo | Estado |
|---|------|---------|----------|--------|
| Q1 | **CI en GitHub Actions**: backend (ruff + pytest con umbral), frontend (`tsc` + build + lint sin regresión), `check-version.sh` en ramas `release/*`, auditoría semanal (`pnpm audit`, `pip-audit`) | Nada valida hoy un PR automáticamente | M | ❓ |
| Q2 | **Pruebas de contrato por endpoint** (cada `GET` con datos devuelve su esquema) + **cobertura de caminos críticos**: webhooks de Stripe (idempotencia), chat, links compartidos, OAuth. Subir umbral 45% → 55% | Las regresiones de 0.7.0 y las invariantes de billing/auth sin red | M | ❓ |
| Q3 | **Vitest en el frontend** para utilidades puras (`configInitBlockManager`, `sanitize`, `lazyWithPreload`, `dateLocale`, exportadores) | Primer piso de pruebas del frontend | S | ❓ |
| Q4 | **Extraer del editor** hooks probables: `useAutosave`, `useViewportSave`, `useDiagramSwitch` | 5,632 líneas; la lógica de 0.7.1 (línea base, en vuelo, serialización) merece pruebas unitarias | M | ❓ |

**Recomendación**: Q1 + Q2 sí o sí (son la lección de 0.7.0); Q3 + Q4 juntos si entra F1 (el historial toca el autosave).

## 3. Track C — Seguridad / hardening (con migraciones)

| # | Ítem | Impacto de actualización | Esfuerzo | Estado |
|---|------|--------------------------|----------|--------|
| H1 | **Índice único `users.email`** + script de migración (detecta duplicados, elimina `email_1`, deja que Beanie cree el único) | Correr la migración **antes** de desplegar | S/M | ❓ |
| H2 | **Clave propia para TOTP** (`TOTP_ENCRYPTION_KEY`) con re-cifrado atómico de secretos existentes | Nueva variable + migración | M | ❓ |
| H3 | **MongoDB con credenciales en `local-full`** y sin exponer `27017` al host | Cambia la instalación local: documentar | S | ❓ |
| H4 | **`python-jose` → PyJWT** (elimina `ecdsa`) | Sin cambio visible (mismos tokens HS256) | S/M | ❓ |
| H5 | **Monaco empaquetado** (sin CDN) | Self-host sin internet funciona; habilita CSP estricta | M | ❓ |
| H6 | pytest 9 + pytest-asyncio actual (solo desarrollo) | Ninguno | S | ❓ |
| H7 | Rate limiting con Redis (opcional, `REDIS_URL` con fallback en memoria) | Solo útil con varias réplicas | M | ❓ |

**Recomendación**: H1 + H2 + H4 + H5 (+ H6 por ser trivial). H3 si aceptas el cambio en la instalación local. H7 a cuando alguien despliegue con réplicas.

## 4. Deuda técnica

- `ChatSessionService` (1,336 líneas, send/stream casi duplicados): dividir **después** de Q2, que le da red de pruebas.
- `ai_providers/prompts.py` (2,061 líneas): revisar duplicación entre idiomas/proveedores.

## 5. Decisiones abiertas

1. ¿Qué features entran? (recomendado: F1–F4)
2. ¿Q4 (extraer hooks del editor) entra con F1?
3. ¿H3 cambia la instalación local por defecto o queda como opción documentada?
4. ¿Modo embed (F6): se acepta permitir *framing* en la ruta pública de embed?
5. ¿Umbral de cobertura objetivo: 55%?

## 6. Cierre

- [ ] Release notes `docs/{es,en}/release-notes/0.8.0.md`, índices, nav de mkdocs, CHANGELOG
- [ ] Badge de cobertura del README actualizado
- [ ] `bash scripts/check-version.sh 0.8.0` → OK
- [ ] **Eliminar este archivo** antes de abrir el PR
