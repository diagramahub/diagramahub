# Auditoría de mejoras para v0.6.2

> **Documento temporal** — creado para lectura fuera de la terminal. Eliminar cuando ya no se necesite:
> `rm AUDIT-0.6.2.md`
>
> No está referenciado por el nav de MkDocs, ni por `scripts/check-version.sh`, ni por ningún otro tooling del repo.

| Dato | Valor |
|---|---|
| Fecha de auditoría | 2026-09-25 |
| Rama | `release/v0.6.2` |
| Commit base | `7495887` |
| Alcance | Producto completo: backend, frontend, docs, seguridad, testing e infraestructura |
| Método | 4 auditorías paralelas (read-only) + verificación directa de cada hallazgo material |

## Leyenda

- **Tipo** — `PATCH`: corrección, seguridad, pulido, docs o tooling interno → cabe en 0.6.2. `MINOR`: capacidad nueva → 0.7.0.
- **Esfuerzo** — `S` (horas), `M` (1–2 días), `L` (varios días).
- **Verif.** — `✅` lo comprobé yo directamente en el código (ruta:línea). `~` viene de las auditorías automatizadas, no lo confirmé línea por línea.

## Límites de esta auditoría

No se pudieron ejecutar pruebas ni levantar contenedores al inicio de la auditoría: el sandbox bloqueaba el socket de Docker y la red. **Actualización (2026-09-25, misma sesión):** con una aprobación explícita del modo ampliado sí se obtuvo acceso a Docker y se ejecutó la suite completa dentro del contenedor — 220 tests pasan, cobertura 46.65%. Los conteos marcados con `~` siguen siendo escaneos automatizados.

- No hay medición real de cobertura de tests ni de tamaño de bundle.
- No hay verificación en navegador ni en dispositivo móvil real.
- Los conteos marcados con `~` son escaneos automatizados y pueden variar ±unos pocos casos.

---

## Resumen ejecutivo

**Los 3 hallazgos de mayor valor:**

1. **La idempotencia de webhooks de Stripe está documentada pero no implementada** (invariante #4 de `AGENTS.md`). Riesgo de doble activación o cobro duplicado ante reintentos de Stripe.
2. **El inglés está roto en Suscripción y facturación**: `en.json` no tiene la sección `subscription` completa; un usuario inglés ve esas pantallas en español.
3. **El cambio de contraseña no pide la contraseña actual**: con un token robado, toma de cuenta permanente.

**Propuesta de alcance para 0.6.2:** bloques **A + B + C + D + E + F** (todo es corrección, seguridad, pulido, documentación o tooling). El bloque **G** queda para 0.7.0, que es donde corresponde capacidad nueva.

---

## Lo que está sano (no re-trabajar)

- Streaming de IA implementado en los 5 clientes (`chat_with_context_stream` en gemini/openai/claude/deepseek/minimax) con endpoint SSE.
- Índices Beanie declarados en las rutas calientes: `shared_links.token` (único), `diagrams.project_id`/`folder_id`, `chat_sessions`, `subscriptions.user_id`, `prompt_history`, `ai_providers.user_id`.
- Paginación correcta en `prompt_history` (`ge=1, le=100`).
- Brute-force en enlaces protegidos (5 fallos / 15 min).
- Autosave (debounce 1.5 s) y render con debounce en el editor; undo/redo, atajos y `canUndo/canRedo` en el canvas freehand.
- **Ningún secreto expuesto en el repo**: no hay `.env` trackeado ni claves hardcodeadas. `backend/.env` existe solo en disco local (higiene local, no exposición).
- El nav de `mkdocs.yml` no tiene enlaces rotos: todas las páginas referenciadas existen en ES y EN.
- Las promesas de features del `README.md` están respaldadas por código.

---

## Bloque A — Cerrar 0.6.2 (bloqueante)

| # | Hallazgo | Evidencia | Tipo | Esf. | Verif. |
|---|---|---|---|---|---|
| A1 | `check-version.sh 0.6.2` falla en 10 comprobaciones: faltan bumps en `package.json`, `pyproject.toml`, `.env.template`, `config.py`, más release notes, índices, nav y CHANGELOG | `scripts/check-version.sh` (ejecutado) | PATCH | S | ✅ |
| A2 | `CHANGELOG.md` no tiene sección `## [0.6.0]`: salta de `## [0.6.1]` a `## [0.5.11]`, con el contenido de 0.6.0 fusionado bajo 0.6.1 y dos `### Added` seguidos | `CHANGELOG.md:8,54` | PATCH | S | ✅ |
| A3 | **RESUELTO.** `backend/pytest.ini` existía sin `addopts` y tenía prioridad sobre `[tool.pytest.ini_options]` de `pyproject.toml` (donde viven `--cov=app`, `--cov-report` y `--strict-markers`), así que la cobertura no se medía. Eliminado el archivo. Descubrimiento adicional: la compose montaba `backend/pytest.ini` en `/app/pytest.ini` aunque la imagen no lo copia — mount eliminado de ambos deploy | `backend/pytest.ini` (borrado) vs `backend/pyproject.toml:60-79`; `deploy/local-full/docker-compose.yml:39`, `deploy/external-mongodb/docker-compose.yml:24` | PATCH | S | ✅ |
| A4 | **RESUELTO.** Cobertura medida dentro del contenedor: **46.65%** (220 tests, ~57 s). Umbral fijado en 45% en la rama de corrida completa de `run-tests.sh` — deliberadamente **no** en `addopts`, porque un subset (`-m unit`) solo alcanza 37.14% y fallaría en falso. Enforce verificado: con `--cov-fail-under=100` el subset falla | `backend/run-tests.sh`; evidencia: `Required test coverage of 45% reached. Total coverage: 46.65%` | PATCH | S | ✅ |
| A5 | **RESUELTO.** `run-tests.sh` pasaba `"$@"` tras `-m unit` → `pytest -m unit --unit` (argumento no reconocido). Reescrito con `case` + `shift`, y el shebang pasó a `#!/bin/sh` porque el contenedor no tiene `bash`: el script era inejecutable ahí. Sintaxis validada con el dash del contenedor | `backend/run-tests.sh:1,10-32` | PATCH | S | ✅ |

---

## Bloque B — Correctitud con impacto en dinero

| # | Hallazgo | Evidencia | Tipo | Esf. | Verif. |
|---|---|---|---|---|---|
| B1 | **Idempotencia de webhooks Stripe documentada pero no implementada.** `WebhookEventInDB` está definido y registrado, pero la colección **nunca se escribe ni se consulta**; `event_id` solo se usa para loguear. Un reintento de Stripe puede reprocesar el evento | Definición: `subscriptions/schemas.py:287`; registro: `main.py:143`; uso solo-log: `webhook_handler.py:53,56,73,79`. Cero callsites de escritura/lectura | PATCH | M | ✅ |

> Nota: `SubscriptionLogger.webhook_duplicate` (`subscriptions/logger.py:177`) existe pero nunca se invoca — andamiaje muerto del diseño original.

---

## Bloque C — Seguridad

> Base: el informe `reports/security/security-review-2026-04-23-13-32.md` (5 meses de antigüedad). Verifiqué en el código actual cuáles siguen vigentes.

| # | Hallazgo | Evidencia | Tipo | Esf. | Verif. |
|---|---|---|---|---|---|
| C1 | **Cambio de contraseña sin pedir la actual.** El schema lo declara explícitamente: *"no current password required"* | `users/schemas.py:167-169`; endpoint en `users/routes.py:304-321` | PATCH | S | ✅ |
| C2 | **Sin Content-Security-Policy.** El middleware ya pone X-Frame-Options, nosniff, HSTS (prod) y Permissions-Policy, pero no CSP. Combinado con JWT en `localStorage`, un XSS no tiene segunda barrera | `main.py:181-199` | PATCH | M | ✅ |
| C3 | **CORS abierto**: `allow_methods=["*"]` y `allow_headers=["*"]` | `main.py:223-224` | PATCH | S | ✅ |
| C4 | **MongoDB sin autenticación y publicado al host** (`27017:27017`), sin `MONGO_INITDB_ROOT_USERNAME/PASSWORD` | `deploy/local-full/docker-compose.yml:11-15` | PATCH | M | ✅ |
| C5 | **Contenedores corriendo como root**: ningún `USER` en ningún Dockerfile | `backend/Dockerfile`, `frontend/Dockerfile` (0 ocurrencias de `USER`) | PATCH | S | ✅ |
| C6 | **`frontend/Dockerfile` es solo para desarrollo**: ejecuta el dev server de Vite; no hay build de producción | `frontend/Dockerfile:26` → `CMD ["pnpm","exec","vite","--host"]` | PATCH | M | ✅ |
| C7 | **Rate limiting incompleto**: solo login y callback OAuth. Sin límite: `POST /users/register`, `reset-password-request` (email bombing), MFA `/verify` y `/resend-email-code` | `users/routes.py:141-145` (solo login); `mfa/routes.py`: 0 referencias | PATCH | S | ✅ |
| C8 | **`POST /diagrams/render` público, sin rate limit y sin tope de payload**: `source` solo tiene `min_length=1` → DoS al contenedor Kroki | `diagrams/schemas.py:189`; ruta pública en `diagrams/routes.py:200` | PATCH | S | ✅ |
| C9 | **Fuga de detalle interno al cliente**: `detail=f"Error deleting account: {str(e)}"` | `users/routes.py:568` | PATCH | S | ✅ |
| C10 | **`users.email` sin índice único** y `register_user` con patrón check-then-insert (TOCTOU) | `users/schemas.py:131-134` (`indexes = ["email"]`); `users/services.py:67-77` | PATCH | S | ✅ |
| C11 | **Audit log incompleto**: 4 eventos documentados en `AGENTS.md` están definidos y **nunca se emiten**: password reset requested, MFA enabled, MFA disabled, account deleted | Solo definiciones en `users/audit_log.py:52-58`; cero callsites fuera de ese archivo | PATCH | S | ✅ |
| C12 | Una sola `AI_ENCRYPTION_KEY` cifra API keys de IA **y** secretos TOTP: el compromiso de una clave afecta ambos | `core/security.py:238` | MINOR | M | ~ |
| C13 | Rate limiters en memoria: se resetean al reiniciar y no escalan en multi-instancia/multi-worker | `users/rate_limiter.py:34`, `shared_links/rate_limiter.py:11-27` | MINOR | M | ~ |

**Del informe original ya no aplican:** SSRF en clientes de IA (todas las `base_url` son constantes de vendor, no hay destino controlable), `.DS_Store`/`__pycache__` no están trackeados, y el monitoreo con Sentry sí existe (con sanitización). Los secretos del informe original eran de un `.env` local no trackeado.

---

## Bloque D — UX e i18n

| # | Hallazgo | Evidencia | Tipo | Esf. | Verif. |
|---|---|---|---|---|---|
| D1 | **`en.json` no tiene la sección `subscription` completa** (verificado: `has("subscription")` → `false`; ~100 claves solo en español). Con `fallbackLng: 'es'`, un usuario inglés ve **toda** la pantalla de facturación y cancelación en español | `frontend/src/i18n/locales/en.json`; `i18n/config.ts:28`; uso en `components/subscription/BillingHistory.tsx:106`, `SubscriptionCard.tsx:74-78` | PATCH | S/M | ✅ |
| D2 | **3 claves usadas que no existen en ningún locale** → se renderiza la clave cruda: `ai.improveDiagram.editHint`, `ai.messages.removeTitle`, `integrations.messages.deleteConfirmTitle` | Verificado ausente en ES y EN; uso en `ImproveDiagramWithAIModal.tsx:171`, `AIIntegrationsSection.tsx:300`, `admin/IntegrationsSection.tsx:484` | PATCH | S | ✅ |
| D3 | **Modales sin dark mode** (~133 líneas solo-claras): las confirmaciones destructivas y de pago salen en blanco en modo oscuro | `ConfirmModal.tsx:49-74`, `DeleteAccountModal.tsx:66-116`, `DeleteFolderModal.tsx:45-97`, `UpgradePlanModal.tsx:22-50`, entre otros | PATCH | M | ~ |
| D4 | **Accesibilidad**: ~99 botones solo-icono sin `aria-label`; solo 3 de 20 modales cierran con Escape y **ninguno** atrapa el foco; filas de proyecto clicables sin navegación por teclado | `Components/*Modal.tsx`; `ProjectsPage.tsx:152` (`<tr onClick>` sin `role`/`tabIndex`) | PATCH | S | ~ |
| D5 | **Strings hardcodeados**: ~92 nodos de texto JSX y ~60 atributos literales con español fuera de `t()`, varios inyectados por `innerHTML` | `DiagramEditorPage.tsx:1015,1046-1057`; `DeleteFolderModal.tsx:54-98`; `SharedDiagramPage.tsx:203-703` | PATCH | M | ~ |
| D6 | **Restos de debug en producción**: `console.log` y errores mostrados con `alert()` nativo mientras el resto usa texto inline | `services/api.ts:283,287`; `DiagramEditorPage.tsx:363,2293,1630-1699`; `AIIntegrationsSection.tsx:44,59` | PATCH | S | ~ |

---

## Bloque E — Documentación

| # | Hallazgo | Evidencia | Tipo | Esf. | Verif. |
|---|---|---|---|---|---|
| E1 | **MiniMax, D2 y SVG implementados pero no documentados**: README e `index.md` listan 4 proveedores (sin MiniMax) y solo PNG/PDF/Markdown (sin SVG; D2 ausente del índice) | `ai_providers/schemas.py:17`, `clients/factory.py:10`; `README.md:18,21`; `docs/es/index.md:20-23` | PATCH | S | ✅ |
| E2 | **`docs/es/index.md` promete páginas que no existen** ("Arquitectura", "Stack tecnológico"); solo hay `ARCHITECTURE.md` en la raíz, fuera del nav | `docs/es/index.md:26-28`; `ls docs/es` | PATCH | S | ✅ |
| E3 | **Tabla de rutas desactualizada**: 12 rutas listadas contra ~21 reales (faltan settings, subscription, integrations, about, admin, mfa-verify, oauth/callback) | `docs/es/index.md:118-131` vs `frontend/src/App.tsx:36-193` | PATCH | S | ~ |
| E4 | **No existe documentación de usuario**: solo index, instalación y release notes. Faltan guías de editor, BYOK, compartir, planes/billing, MFA y panel admin | `ls docs/es` → index.md, instalacion.md, release-notes/ | MINOR | L | ✅ |
| E5 | Claim sobresvendido: el README habla de *production hardening across the stack* mientras C1/C2/C4/C5/C6 siguen abiertos | `README.md:74-88` | PATCH | S | ✅ |

---

## Bloque F — Infraestructura y tooling

| # | Hallazgo | Evidencia | Tipo | Esf. | Verif. |
|---|---|---|---|---|---|
| F1 | **No hay CI**: no existe `.github/`, así que nada verifica pytest, lint, tipos, el build del frontend ni `check-version.sh` | `git ls-files .github` → vacío | PATCH | M | ✅ |
| F2 | **El quickstart documentado está roto**: los READMEs dicen `cd deploy/local-full && docker-compose up`, pero el compose resuelve `context: ./backend`, que no existe desde ese directorio | `deploy/local-full/README.md:36`, `deploy/README.md:33` vs `deploy/local-full/docker-compose.yml:28,54` | PATCH | S | ✅ |
| F3 | **`docker-compose` v1 vs `docker compose` v2 mezclados**: INSTALL.md, install.sh y verify-installation.sh invocan v1, pero el instalador instala el plugin v2 | `INSTALL.md`, `install.sh`, `verify-installation.sh` | PATCH | M | ~ |
| F4 | **Kroki no aparece** en la lista de servicios documentada, ni en INSTALL.md, ni en las comprobaciones de verificación: la ruta de render nunca se verifica | `verify-installation.sh:30` → `SERVICES=("backend" "frontend")` (+mongodb) | PATCH | S | ✅ |
| F5 | **Dependencias sin usar**: `react-color` y `@types/react-color` (0 referencias; el segundo además está en `dependencies` en vez de `devDependencies`) | `frontend/package.json:16,27`; 0 usos en `frontend/src/` | PATCH | S | ✅ |
| F6 | `react-color` fuera; evaluar `python-multipart`: sin `UploadFile`/`Form`/`OAuth2PasswordRequestForm` en el backend | `backend/pyproject.toml:19` | PATCH | S | ~ |
| F7 | Basura en tests: `backend/tests/core/` y `fixtures/` vacíos; `test_openai_models.py` es un script de diagnóstico manual que pytest solo importa | `backend/tests/` | PATCH | S | ~ |
| F8 | `AccessLogInDB` sin índice TTL (a diferencia del audit log de 90 días) → crecimiento sin límite. `AuditLogEntry` sin índice por `user_id` ni compuesto timestamp+event | `shared_links/schemas.py:43-50`; `users/audit_log.py:33-40` | PATCH | S | ~ |
| F9 | Export de usuarios a Excel carga todo en memoria con `find_all()` sin streaming | `mfa/routes.py:713` | PATCH | S | ~ |

---

## Bloque G — Candidatos para 0.7.0 (capacidad nueva)

| # | Hallazgo | Evidencia | Tipo | Esf. | Verif. |
|---|---|---|---|---|---|
| G1 | **Canvas freehand sin soporte táctil**: los handlers se llaman `handlePointer*` pero son `React.MouseEvent` cableados a `onMouseDown/Move/Up` (cero `onTouch*`). Los diagramas freehand compartidos son inutilizables en móvil/tablet. La toolbar además no tiene wrap ni overflow | `FreehandCanvas.tsx:767,895,1027,1796`; toolbar `:1605-1627` | MINOR | L | ✅ |
| G2 | **Cero tests de frontend y sin harness**: no hay vitest/jest/testing-library/jsdom/playwright ni script `test` | `frontend/package.json` | MINOR | L | ✅ |
| G3 | **Tests backend ausentes en 6 módulos**: projects, folders, ai_providers, subscriptions, prompt_history, oauth. Prioridad por riesgo: webhooks/usage_limiter, oauth, totp | `backend/tests/api/v1/` | MINOR | L | ~ |
| G4 | **El audit log es write-only**: no hay endpoint ni vista admin de lectura, pese a citar SOC2 CC7.2 | `users/audit_log.py:5`; sin rutas de lectura | MINOR | M | ~ |
| G5 | **Conekta a medias**: solo existen el enum y el tipo de frontend; `vendor_factory` registra únicamente Stripe → un plan puede declarar `provider="conekta"` que nada ejecuta | `integrations/vendor_factory.py:18`; `subscriptions/schemas.py:35-52,131` | MINOR | L | ✅ |
| G6 | **Sin backups automatizados de MongoDB**: solo prosa en INSTALL.md; no hay script ni cron | `INSTALL.md:356`, `docs/es/instalacion.md:324` | MINOR | M | ~ |
| G7 | Deuda de tamaño: `DiagramEditorPage.tsx` 5160 líneas, `FreehandCanvas.tsx` 1889; Monaco y Mermaid importados estáticos, sin code-splitting en todo `src` | `CodeEditor.tsx:1`, `utils/diagramRenderer.ts:1` | MINOR | M | ~ |
| G8 | N+1 con carga total en memoria: `GET /diagrams/recent` consulta todos los proyectos, luego todos sus diagramas (con `content` completo) y ordena en memoria para devolver 4. Mismo patrón en `get_user_projects` y `usage_limiter` | `diagrams/routes.py:158-198`; `projects/services.py:182-190`; `usage_limiter.py:150-153` | PATCH | M | ✅ |
| G9 | Validación server-side incompleta: `page_size` sin tope en admin list users, `access_code` de shared link sin `min_length` en update, `expiration_days` sin rango, `DiagramBase.content` sin `max_length` | `mfa/routes.py:519-520`; `shared_links/schemas.py:88,102`; `diagrams/schemas.py:83` | PATCH | S | ~ |

---

## Propuesta de alcance

### 0.6.2 — Release de estabilización (PATCH)

Todo lo de los bloques **A, B, C, D, E, F** y los ítems G8/G9 por ser correcciones.

Orden sugerido si se hace por etapas:

1. **Bloque A** — dejar el release formalmente consistente (ya está instrumentado con `check-version.sh`).
2. **B1 + C1** — los dos riesgos más concretos (dinero y toma de cuenta).
3. **C2–C10** — endurecimiento: CSP, CORS, Mongo con auth, `USER` en Dockerfiles, rate limits, topes de payload, índice único de email.
4. **D1 + D2** — el inglés roto en facturación y las 3 claves crudas.
5. **A2–A5, F1–F9, E1–E3, E5** — CHANGELOG, pytest config, CI, docs e infra.
6. **D3–D6** — dark mode, accesibilidad y strings hardcodeados.

### 0.7.0 — Capacidad nueva (MINOR)

Bloque **G** completo (G8/G9 si no entran antes): soporte táctil, harness de tests de frontend, tests backend faltantes, visor de audit log, Conekta o su eliminación, backups, code-splitting, documentación de usuario.

---

## Anexo — Estado del versionado (ya resuelto en esta rama)

Durante esta sesión se corrigió la omisión del release 0.6.1 y se instrumentó su prevención:

- Se corrigieron a 0.6.2 las menciones desactualizadas en `VERSIONING.md` y `AGENTS.md` (3 ubicaciones: cabecera, sección Versioning y ejemplo de entorno).
- Se añadió la entrada faltante de `0.6.1` al nav de `mkdocs.yml` (ES y EN).
- Se descubrió una omisión adicional: `backend/app/core/config.py` seguía en `0.6.0`, y ese valor se publica en `GET /`, Swagger y Sentry — es decir, la app desplegada reportaba 0.6.0.
- Se creó **`scripts/check-version.sh`**: verificación fail-closed de 15 puntos (código, config, docs, release notes, índices, nav, CHANGELOG). Sale con código distinto de cero si algo quedó sin actualizar.
- El checklist de release en `VERSIONING.md` ahora lista el archivo exacto de cada versión y exige el script en verde antes del merge; `AGENTS.md` instruye a los asistentes de IA a ejecutarlo.

Estado actual: el script reporta 4 `PASS` (los archivos de documentación ya corregidos) y 10 `FAIL` (todo lo que falta para 0.6.2).
