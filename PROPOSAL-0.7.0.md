# Plan vivo — Versión 0.7.0: Optimizar, Asegurar, Estabilizar (+ quick wins)

- **Última actualización**: 2026-09-29
- **Rama**: `release/0.7.0` (6 commits sobre main)
- **Estado**: desarrollo en curso — este documento es el punto de retoma
- **Regla del documento**: marcar cada ítem como ✅ hecho / 🔨 en curso / ⬜ pendiente / 🚫 diferido con criterio

---

## 1. Qué ya está hecho en esta sesión (verificado)

### 1.1 Frontend — imagen de producción + config en runtime

- **Dockerfile multi-stage** con targets `development` (Vite + HMR, idéntico al anterior) y `production` (estático servido por Nginx no-root, `nginxinc/nginx-unprivileged`).
- **Inyección de config en runtime**: `/config.js` se genera al arrancar el contenedor desde env vars (`VITE_API_URL`, `VITE_SENTRY_DSN`, `VITE_APP_ENV`); la app lee `window.__DH_CONFIG__` con precedencia runtime → build-time → localhost. Funciona sin cambios en DigitalOcean App Platform (Static Site: env vars en build).
- Nginx escucha **5173** dentro del contenedor (compatibilidad con el `http_port` existente), healthcheck, gzip, cache immutable de assets, headers de seguridad. CSP opcional vía `csp.conf.example` (habilitar por despliegue tras validar).
- **Verificado en contenedor real**: imagen 68MB vs 951MB (14x), no-root, headers, SPA fallback, gzip (2.38MB→638KB), healthcheck healthy, dev target con HMR intacto.
- Commits: `593b15e`.

### 1.2 Backend — alineación SOLID/DIP + documentación de código

Auditoría de los 14 módulos contra el contrato SOLID del repo y corrección:

- **Inversión de dependencias**: servicios tipados contra ABCs en lugar de repos concretos (projects, folders, diagrams, shared_links, oauth, deletion, migration, users).
- **ABCs completados**: `IUserRepository`, `IMfaRepository`, `ISharedLinkRepository`, `IPaymentProvider`, `IChatSessionRepository`, `IIntegrationsRepository` (nuevo), `IOAuthStateRepository` (nuevo), `delete_by_user_id` en 4 repos.
- **Cero acceso crudo en servicios**: Beanie directo eliminado de shared_links, chat_sessions, plan_service, deletion_service (bulk-deletes), migration_service; SDK de Stripe crudo fuera de servicios/handlers (todo vía `IPaymentProvider`).
- **Abstracción de clientes IA**: `BaseAIClient.complete()` público en los 5 clientes; duck-typing de métodos privados eliminado de 3 sitios (ai_providers, chat_sessions, diagrams/conversion_service); `build_fix_prompt` reubicado a `ai_providers/prompts.py` con shim.
- **Lógica fuera de rutas**: get_recent_diagrams, fix/render, update/test_provider, usage stats, delete_message, endpoints admin MFA (`mfa/admin_service.py`), delete_account. **Bonus seguridad**: fix de diagramas verifica ownership (403).
- **Dependencias de auth consolidadas**: `app/api/deps.py` como casa canónica (`get_current_user_email`, `get_current_user`, `get_current_user_id`, `get_user_service`); 11 módulos migrados; 0 imports route-to-route; 0 helpers duplicados con `UserRepository()` inline.
- **Docstrings**: gaps cubiertos en todos los archivos tocados, respetando estilo local (reST/Google, ES/EN).
- Commits: `06ddf3f`, `5da8f79`, `ed03e68`.

**Verificación**: suite completa **251 passed** (era 249) · cobertura **51.34%** (gate 45%, baseline 46.65%) · ruff app-wide limpio (baseline 29 errores) · black aplicado en modificados · mypy global **238 errores vs 266 baseline** (sin errores nuevos en archivos tocados) · `import app.main` OK.

### 1.3 Ambiente dev regenerado

- Imágenes viejas eliminadas (backend 858MB, frontend 951MB + 2 de prueba) y rebuild `--no-cache` sobre `release/0.7.0`.
- Stack dev arriba y sano: backend `healthy`, frontend con HMR, Kroki y MongoDB OK. **Volumen `diagramahub_mongodb_data` conservado** (la BD dev tenía 0 usuarios — estado previo, no pérdida).

---

## 2. Track A — Quick wins de producto (nuevo, analizado 2026-09-29)

Análisis de funcionalidades pequeñas con alto valor para usuarios. **Ya existen** (verificado, no duplicar): copy-code en editor, atajos de teclado, autosave (debounce 1.5s), recientes en dashboard, copy-code en link compartido.

### Recomendados para 0.7.0

| # | Feature | Valor | Esfuerzo | Estado |
|---|---------|-------|----------|--------|
| Q1 | **Importar archivos de diagrama** (.mmd/.puml/.d2/.dbml, drag & drop o picker) | Migración desde archivos locales; impresión "pro" | S (solo frontend) | ⬜ |
| Q2 | **Exportar imagen desde link compartido** (PNG/SVG al viewer sin login, reusando `exportService`) | El link pasa de vitrina a entregable | S/M | ⬜ |
| Q3 | **Modo embed** (`?embed=1` + botón "copiar código embed") | Diagramas vivos en READMEs/Notion/wikis — feature estrella del nicho | M | ⬜ |
| Q4 | **Galería de templates al crear diagrama** (flowchart, sequence, ER, gantt, state, class, use case + puml/d2/dbml) | Mata la página en blanco; onboarding | S/M | ⬜ |
| Q6 | **Pulido de guardado**: indicador "guardado hace Xs" + confirmación al salir con cambios sin guardar | Confianza en el editor | S | ⬜ |

### Para 0.8 (Tier 2)

- **Q5** Búsqueda global de diagramas (título + contenido; v1 regex paginado, luego índice `$text`).
- **Historial de versiones** del diagrama (snapshot + restore + diff) — killer feature del nicho.
- **API tokens personales** para automatización (export/render vía curl en CI).
- **Bulk actions** (multi-select: mover/duplicar/eliminar).
- **i18n PT-BR o FR** (solo traducción).
- **Diagramas enlazados** (clic en nodo → abrir otro diagrama, mermaid `click` + routing).

### Fuera de alcance 0.x (bets mayores)

Colaboración en tiempo real (CRDT/WebSockets), PWA/offline, sync con Git.

---

## 3. Track B — Hardening pendiente (del informe de seguridad, verificado contra código)

| # | Ítem | Prioridad | Esfuerzo | Estado |
|---|------|-----------|----------|--------|
| A1 | **CI/CD en GitHub Actions** (lint + pytest con gate 45% + build frontend + build imágenes + check-version; workflow semanal de seguridad con pip-audit/npm audit/Trivy) | Must (único hallazgo crítico restante) | M | ⬜ |
| A2 | **Migración índice `users.email` → único** (script que detecta duplicados, dropea `email_1`, deja a Beanie crear el único; correr ANTES de desplegar; documentar en release notes) | Must (marcado "tracked for 0.7.0" en el código) | S/M | ⬜ |
| A5 | **Límite global de payload** (middleware 413 > 1MB, eximiendo uploads) | Must | S | ⬜ |
| B1 | **MongoDB con auth en local-full** (root user/pass + quitar `27017:27017` del host; documentar breaking change) | Must | S | ⬜ |
| B2 | **Contenedores no-root**: frontend ✅ (nginx-unprivileged) · **backend ⬜** (añadir `USER` no-root al Dockerfile del backend) | Must | S/M | 🔨 |
| B3 | **Imagen prod del frontend (estático + Nginx)** | Must | — | ✅ |
| B4 | **Rate limiting con Redis** (interfaz de almacenamiento; `REDIS_URL` opcional con fallback in-memory) | Should | M | ⬜ |
| B5 | **Validación SSRF de URLs base de proveedores IA** (https obligatorio, bloqueo de IPs privadas) | Should | M | ⬜ |
| B6 | **Separación de claves de cifrado** (`AI_ENCRYPTION_KEY` vs `TOTP_ENCRYPTION_KEY`, con migración atómica de secretos) | Should | M | ⬜ |
| B7 | **CSP del frontend + Monaco local** (ya hay `csp.conf.example`; falta empaquetar Monaco y activar por despliegue) | Should | M | ⬜ |
| B8 | **Backup automatizado de MongoDB** (script + cron documentado) | Should | S | ⬜ |
| B9 | **Rotación de secretos + higiene de `.env` local** (3 patrones débiles en `backend/.env`) | Could | S | ⬜ |
| C1 | **Code splitting por ruta** (bundle 2.49MB → meta ≤500KB gzip; lazy para jspdf/html2canvas y rutas pesadas) | Must | M | ⬜ |
| C2 | **API ligera de listado de proyectos** (`GET /projects/{id}` hoy devuelve contenido completo de todos los diagramas) | Should | M | ⬜ |
| C3 | **Chunks vendor + precompresión gzip/brotli** | Should | S/M | ⬜ |
| C4 | **i18n lazy por idioma** | Could | S | ⬜ |
| C5 | **Refresh de dependencias** (ruff, pytest-asyncio, stripe, Poetry 2.x en Dockerfile) | Should | S/M | ⬜ |

---

## 4. Deuda técnica diferida con criterio (documentada en código)

- **Split SRP de `ChatSessionService`** (1311 líneas, send/stream casi duplicados) — diferido: riesgo alto sin tests de comportamiento; candidato a 0.7.x/0.8.
- **Orquestación del login en `users/routes.py`** (lockout/audit/email-challenge) — TODO explícito en el código; mover requiere tests de comportamiento primero.
- **`EmailService` construido con repo concreto en mfa/users routes** — composition-root; TODO documentado.
- **`IUserRepository.create()` solo soporta `UserCreate`** (oauth) — limitación de contrato; TODO.
- **238 errores mypy preexistentes** (baseline 266) — deuda del repo, no de esta ronda.
- **Monaco desde CDN** — un self-host sin internet pierde el editor; resuelto por B7.

---

## 5. Decisiones abiertas (para revisar juntos)

1. **Quick wins**: ¿confirmamos Q1+Q2+Q3+Q4+Q6 para 0.7.0? (mi recomendación: sí).
2. **Redis (B4)**: ¿entra en 0.7.0 o se difiere a 0.8? (opcional con fallback — bajo riesgo).
3. **CSP (B7)**: ¿activa por defecto o por despliegue? (recomendación: por despliegue hasta validarla en staging).
4. **A2 (índice email)**: es el único ítem con procedimiento de upgrade obligatorio — confirmar que lo documentamos como "correr migración antes de desplegar".
5. **i18n adicional**: ¿PT-BR o FR primero?
6. **GitHub**: ¿creamos milestone `0.7.0` + issues por ítem? (requiere autorización explícita — aún no se ha publicado nada).

---

## 6. Proceso de release (pendiente al final)

- Release notes `docs/{es,en}/release-notes/0.7.0.md` + nav de mkdocs.
- CHANGELOG (Keep a Changelog).
- `bash scripts/check-version.sh 0.7.0` (ya hay `VERSION = "0.7.0"` en `core/config.py`; falta el resto de archivos que cargan versión).
- Checklist `VERSIONING.md` · tags sin prefijo `v`.

---

## 7. Definition of Done del release

- CI verde (A1) con suite ≥45% y builds de imágenes.
- `check-version.sh 0.7.0` sin fallos.
- Migración A2 probada contra BD legacy (incluido caso con duplicados).
- Bundle inicial ≤ 500KB gzip (C1) y rutas con revisión manual.
- Hallazgos C-03, A-02, A-04, M-03, B-04, C-01/C-02 del informe de seguridad cerrados o aceptados con justificación.
- Quick wins Q1-Q4 (+Q6) con revisión manual de UX.
