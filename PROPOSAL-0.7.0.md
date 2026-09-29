# Propuesta — Versión 0.7.0: Optimizar, Asegurar, Estabilizar

- **Fecha**: 2026-09-28
- **Estado**: Propuesta (sin aprobar)
- **Versión actual**: 0.6.2 · **Versión propuesta**: 0.7.0 (MINOR)
- **Fuentes de evidencia**: código del repo (main @ `6d0d49d`), `reports/security/security-review-2026-04-23-13-32.md`, build de producción existente en `frontend/dist`, estado de GitHub (sin milestone, sin issues/PRs abiertos).

---

## 1. Resumen ejecutivo

0.7.0 propone consolidar la plataforma en tres frentes antes de crecer en funcionalidad:

- **Estabilizar**: no existe pipeline CI/CD; la cobertura del backend está a 45% (piso) y el frontend no tiene ningún test automatizado.
- **Asegurar**: del informe de seguridad de abril quedan abiertos 14 hallazgos, incluidos el único crítico (CI/CD) y la exposición de MongoDB sin autenticación.
- **Optimizar**: el bundle principal del frontend pesa 2.49 MB (670 KB gzip) sin code splitting por ruta, y la API envía el contenido completo de todos los diagramas al abrir un proyecto.

La única deuda explícitamente marcada en el código para esta versión es la **migración del índice `users.email` a único** (`backend/app/api/v1/users/schemas.py:151` — *"tracked for 0.7.0"*).

**Justificación de MINOR (0.7.0, no 0.6.3)**: según la tabla de versionado del proyecto, PATCH es solo para fixes/polish sin capacidad nueva. Este release agrega capacidades nuevas (pipeline CI/CD, imagen de producción del frontend, rate limiting respaldado por Redis, migración de datos con procedimiento). Bajo las reglas 0.x, la migración de índice es un cambio de procedimiento de upgrade documentado, no un cambio de API — MINOR es correcto.

---

## 2. Estado actual verificado (línea base)

### Estabilización

- **CI/CD inexistente**: no hay `.github/workflows/` ni ningún pipeline. El check de versión (`scripts/check-version.sh`) y el piso de cobertura solo corren manualmente.
- **Backend**: 249 tests pasan en local (última corrida registrada en PR #71); piso de cobertura 45% con baseline real 46.65% — margen de 1.65 puntos: cualquier refactor que borre tests rompe el piso.
- **Frontend**: 0 tests automatizados (no hay Vitest/Jest en `package.json`).
- **Herramientas envejecidas**: `ruff ^0.7.0` (actual ≈0.12), `pytest-asyncio ^0.24` (actual 1.x), `stripe ^11` (actual 12+), Poetry fijado a `1.8.3` en el Dockerfile.

### Seguridad (hallazgos del informe aún abiertos, verificados en código actual)

| ID | Hallazgo | Evidencia actual |
|----|----------|------------------|
| C-03 | Sin CI/CD con controles de seguridad | `.github/workflows/` no existe |
| A-02 | MongoDB sin auth y expuesto al host | `deploy/local-full/docker-compose.yml:11` → `ports: "27017:27017"`, sin `MONGO_INITDB_ROOT_USERNAME/PASSWORD` |
| A-04 | Contenedores como root | Sin directiva `USER` en `backend/Dockerfile` ni `frontend/Dockerfile` |
| M-03 | Frontend solo con dev server | Ambos compose montan volúmenes de `src/` y corren `vite`; incluso el modo "external-mongodb" (producción) |
| M-01 | Rate limiters in-memory | `core/rate_limit.py`, `users/rate_limiter.py`, `shared_links/rate_limiter.py`: dicts en memoria, se resetean al reiniciar, inútiles multi-instancia |
| M-08 | Clave Fernet compartida | `core/security.py`: `get_cipher()` usa `AI_ENCRYPTION_KEY` para API keys de IA **y** secretos TOTP (`encrypt_totp_secret`) |
| M-04 | Sin protección SSRF | Clientes IA (`httpx`) aceptan cualquier URL base configurada por el usuario |
| M-06 | Sin backup automatizado | Volumen `mongodb_data` sin scripts de respaldo |
| A-05 | CSP solo en API | `backend/app/main.py:201` manda CSP deny-all en prod; `frontend/index.html` no tiene CSP y el JWT vive en `localStorage` |
| B-04 | Sin límite global de payload | Solo el source del render público está capeado a 100k |
| C-01/C-02 | Secretos débiles en `.env` local | 3 coincidencias de patrones débiles (Stripe test keys comentadas, JWT_SECRET predecible) — gitignored, pero presentes en disco |

### Optimización

- **Bundle principal**: `index-*.js` = **2.49 MB** (670 KB gzip). Sin `React.lazy`/`Suspense` en `App.tsx` (0 rutas con code splitting).
- **Dependencias pesadas en el bundle principal**: `html2canvas` (importado estático en `exportService.ts`, `pdfGenerator.ts`, `DiagramEditorPage.tsx`), `easymde`, `react-markdown`, `mermaid` core. `jspdf` ya sale en chunk separado (386 KB) por import dinámico.
- **Monaco desde CDN**: `@monaco-editor/react` sin `loader.config()` → descarga Monaco de jsDelivr en runtime. Un despliegue self-hosted sin internet se queda **sin editor de código**.
- **API pesada**: `GET /projects/{id}` responde `ProjectWithDiagramsResponse` con `diagrams: List` que incluye el `content` completo de cada diagrama (hasta 100k caracteres por diagrama). Abrir un proyecto con 50 diagramas arrastra hasta ~5 MB.
- **i18n**: `es.json` (52 KB) + `en.json` (44 KB) importados estáticamente; ambos van siempre al bundle.

---

## 3. Los tres ejes

Cada ítem: `[Prioridad MoSCoW]` — evidencia → acción → esfuerzo (S/M/L) → riesgo.

### A. Estabilizar

**A1. `[Must]` Pipeline CI/CD en GitHub Actions**
- *Evidencia*: C-03; hoy nada valida el repo antes de un merge.
- *Acción*: workflow `ci.yml` con: ruff + black --check + mypy; pytest con `--cov-fail-under=45` sobre MongoDB de servicio; `npm ci` + `npm run lint` + `tsc -b && vite build`; build de ambas imágenes Docker; `scripts/check-version.sh` en PRs de release. Workflow `security.yml` semanal: `pip-audit` + `npm audit` + Trivy sobre imágenes (cierra también A-06/SCA del informe).
- *Esfuerzo*: M · *Riesgo*: bajo. Un solo gate fallido en check-version ya existe y funciona.

**A2. `[Must]` Migración del índice `users.email` → único**
- *Evidencia*: marcado en el propio código para 0.7.0; hoy la unicidad de email no está garantizada por la BD (los registros con el mismo email son posibles).
- *Acción*: script de migración (`scripts/migrate-email-unique-index.py`) que (1) detecta emails duplicados y los reporta, (2) dropea el índice `email_1` legacy, (3) deja que Beanie cree el único al arrancar. Documentar el procedimiento en `INSTALL.md` + release notes: correr la migración **antes** de desplegar la nueva imagen.
- *Esfuerzo*: S/M · *Riesgo*: **medio** — es el único cambio con procedimiento obligatorio de upgrade; falla si hay duplicados sin resolver. Mitigación: el script aborta y lista duplicados en lugar de elegir por el usuario.

**A3. `[Should]` Tests de frontend (Vitest + React Testing Library)**
- *Evidencia*: 0 tests hoy; regresiones de UI (export, MFA, wizard de onboarding) solo se detectan manualmente.
- *Acción*: montar Vitest + RTL + jsdom; cubrir los flujos de mayor riesgo de regresión: formularios de auth/change-password (clasificación OAuth-only), selector de formato de export, y un smoke del wizard de instalación. Meta modesta: 30-50 tests, no cobertura total.
- *Esfuerzo*: M · *Riesgo*: bajo. No toca runtime.

**A4. `[Should]` Subir cobertura backend de 45% a ~60% en módulos core**
- *Evidencia*: baseline 46.65% contra piso 45%; módulos como `subscriptions/` (el más grande del repo) y `mfa/` concentran lógica de negocio.
- *Acción*: tests de servicios (no solo rutas) en subscriptions, mfa y oauth. Cada punto de cobertura sube el margen y protege refactors futuros.
- *Esfuerzo*: M/L · *Riesgo*: bajo.

**A5. `[Must]` Límite global de tamaño de payload**
- *Evidencia*: B-04; hoy cualquier endpoint autenticado acepta cuerpos arbitrarios.
- *Acción*: middleware que rechace con 413 cuerpos > 1 MB (suficiente para el source de 100k), eximiendo explícitamente uploads binarios si aparecen.
- *Esfuerzo*: S · *Riesgo*: bajo (documentar el límite en la API).

**A6. `[Could]` Higiene de repo y ramas**
- *Acción*: borrar la rama obsoleta `fix/oauth-only-followup` (su contenido ya está en main vía PR #71 — verificado con `git diff main <branch>` vacío). Revisar que `.DS_Store`/`__pycache__` no estén trackeados (hoy no lo están).

### B. Asegurar

**B1. `[Must]` MongoDB autenticado y sin puerto expuesto en local-full**
- *Evidencia*: A-02 — `ports: "27017:27017"` y sin credenciales root.
- *Acción*: agregar `MONGO_INITDB_ROOT_USERNAME/PASSWORD` (con valores generados por el instalador o vía `.env`), quitar el mapeo de puerto del host (la red interna `diagramahub-network` basta; para acceso de desarrollo, `docker exec`), y actualizar `MONGO_URI` con credenciales en `.env.example` e `INSTALL.md`.
- *Esfuerzo*: S · *Riesgo*: **medio** — rompe setups existentes que se conectan por `localhost:27017`. Mitigación: documentar en release notes; el contenedor con `mongosh` sigue accesible.

**B2. `[Must]` Contenedores no-root**
- *Evidencia*: A-04 — ambos Dockerfiles corren como UID 0.
- *Acción*: crear usuario sin privilegios en backend (`addgroup/adduser`, `chown` del código) y en frontend. Verificar que los bind mounts de desarrollo no rompan permisos (usar mismo UID en dev).
- *Esfuerzo*: S/M · *Riesgo*: bajo-medio (permisos de volúmenes en desarrollo).

**B3. `[Must]` Imagen de producción del frontend (build estático + Nginx)**
- *Evidencia*: M-03 — el modo "external-mongodb" (escenario de producción) corre `vite` dev server con volúmenes de código.
- *Acción*: Dockerfile multi-stage (build con pnpm → nginx alpine con `dist/`), usado cuando `APP_ENV=production`; conservar el dev server para desarrollo. Incluir healthcheck y servir `index.html` con cache-control correcto para assets hasheados. Documentar proxy de `/api` en `INSTALL.md`.
- *Esfuerzo*: M · *Riesgo*: medio (cambia la topología de despliegue documentada; requiere probar rutas de React Router en Nginx con `try_files`).

**B4. `[Should]` Rate limiting respaldado por Redis (con fallback in-memory)**
- *Evidencia*: M-01 — dicts en memoria; multi-instancia los vuelve bypassables.
- *Acción*: introducir interfaz de backend de almacenamiento (el repo ya usa el patrón interfaces+repo en todos los módulos): implementación Redis activa cuando `REDIS_URL` está definido, in-memory por defecto. Aplica a login, register, reset, MFA y render público. Sin Redis en el compose por defecto — opcional y documentado.
- *Esfuerzo*: M · *Riesgo*: bajo (el fallback mantiene el comportamiento actual).

**B5. `[Should]` Validación SSRF de URLs base de proveedores IA**
- *Evidencia*: M-04 — `ai_providers/clients/` acepta cualquier URL.
- *Acción*: validar en creación/edición de proveedor: esquema `https` obligatorio, resolución de DNS y bloqueo de IPs privadas/link-local (127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1). Permitir `http` solo a localhost de forma explícita para pruebas. Cachear la validación para no resolver DNS en cada request.
- *Esfuerzo*: M · *Riesgo*: bajo-medio (usuarios legítimos con gateways custom podrían necesitar allowlist).

**B6. `[Should]` Separación de claves de cifrado (IA vs TOTP)**
- *Evidencia*: M-08 — una sola `AI_ENCRYPTION_KEY` cifra API keys y secretos TOTP.
- *Acción*: nueva `TOTP_ENCRYPTION_KEY`; al arrancar, si no existe se deriva y se migran en lote los `totp_secret_encrypted` existentes (descifrar con la vieja, cifrar con la nueva, marcar versión en el documento). Rechazar arranque si la clave falta y hay secretos por migrar.
- *Esfuerzo*: M · *Riesgo*: **medio** — toca datos cifrados de MFA de todos los usuarios; requiere migración atómica y tests con datos reales.

**B7. `[Should]` Frontend CSP + Monaco local**
- *Evidencia*: A-05 — sin CSP en `index.html` y Monaco desde CDN; un self-host sin internet pierde el editor.
- *Acción*: empaquetar Monaco localmente (`@monaco-editor/react` con `loader.config({ monaco })`) — el editor queda offline; meta CSP estricta en producción (script-src 'self', connect-src a la API), servida por Nginx (B3).
- *Esfuerzo*: M · *Riesgo*: medio (CSP mal configurada rompe la app — probar en staging).

**B8. `[Should]` Backup automatizado de MongoDB**
- *Evidencia*: M-06 — sin scripts de respaldo.
- *Acción*: `scripts/backup-mongodb.sh` (mongodump del contenedor a un directorio con rotación de N días) + entrada cron documentada en `INSTALL.md` + verificación opcional de restauración.
- *Esfuerzo*: S · *Riesgo*: bajo.

**B9. `[Could]` Rotación de secretos e higiene de `.env`**
- *Acción*: sección en `INSTALL.md` con procedimiento de rotación (`JWT_SECRET`, `AI_ENCRYPTION_KEY`, `TOTP_ENCRYPTION_KEY`, Stripe) y regeneración de los `.env` de desarrollo locales (C-01/C-02).

### C. Optimizar

**C1. `[Must]` Code splitting por ruta**
- *Evidencia*: bundle principal 2.49 MB; 0 usos de `React.lazy`.
- *Acción*: envolver rutas en `React.lazy` + `Suspense` (páginas pesadas primero: editor de diagramas, modo presentación, admin, wizard). Importar dinámicamente `html2canvas`/`jspdf` solo al exportar (hoy estáticos). Meta: bundle inicial ≤ 500 KB gzip, con la UI del dashboard usable en la primera carga.
- *Esfuerzo*: M · *Riesgo*: bajo-medio (verificación manual de cada ruta; los chunks de Mermaid ya se separan solos).

**C2. `[Should]` API ligera de listado de proyectos**
- *Evidencia*: `ProjectWithDiagramsResponse.diagrams` incluye `content` completo de todos los diagramas.
- *Acción*: nuevo `GET /projects/{id}/diagrams` que devuelva metadatos (id, título, tipo, folder, timestamps) sin contenido; cargar el contenido solo al abrir un diagrama (el endpoint `GET /diagrams/{id}` ya existe). Mantener `ProjectWithDiagramsResponse` para compatibilidad o marcarlo deprecated.
- *Esfuerzo*: M · *Riesgo*: medio (cambio de contrato API — requiere coordinar frontend y backend en el mismo release).

**C3. `[Should]` Chunks vendor + precompresión**
- *Evidencia*: Vite sin `build.rollupOptions`; sin precompresión.
- *Acción*: `manualChunks` estables (react, sentry, mermaid, editor) para que los updates no invaliden todo el cache; generar `.gz`/`.br` de los assets (servidos por Nginx en B3). Bonus: separar la página pública `/shared/:token` del bundle autenticado.
- *Esfuerzo*: S/M · *Riesgo*: bajo.

**C4. `[Could]` i18n lazy por idioma**
- *Evidencia*: ambos `locales/*.json` (96 KB) van siempre en el bundle.
- *Acción*: cargar el idioma secundario bajo demanda con `i18next` backend (o dynamic import). Ahorro modesto pero trivial.
- *Esfuerzo*: S · *Riesgo*: bajo.

**C5. `[Should]` Refresh de dependencias y tooling**
- *Evidencia*: ruff 0.7, pytest-asyncio 0.24, stripe 11, Poetry 1.8.3; pyproject permite Python 3.12-3.13.
- *Acción*: subir ruff (y adoptar reglas nuevas progresivamente), pytest-asyncio 1.x (misma API con mode auto), stripe 12, Poetry 2.x en el Dockerfile. Verificar que el piso de cobertura sigue pasando tras el bump (A1 lo automatiza).
- *Esfuerzo*: S/M · *Riesgo*: bajo-medio (cambios de lint pueden disparar arreglos masivos — hacer el bump de ruff en un PR separado).

---

## 4. Alcance recomendado del release

**Must (no negociable para 0.7.0)**:
- A1 CI/CD · A2 índice email único · A5 límite de payload · B1 Mongo auth · B2 no-root · B3 imagen prod frontend · C1 code splitting

**Should (entra si el tiempo alcanza — candidatos a 0.7.1 si no)**:
- A3 tests frontend · A4 cobertura 60% · B4 Redis · B5 SSRF · B6 claves separadas · B7 CSP+Monaco · B8 backups · C2 API ligera · C3 chunks+precompresión · C5 refresh deps

**Could (deuda menor, cuando haya hueco)**:
- A6 higiene · B9 rotación/secrets · C4 i18n lazy

---

## 5. Plan por fases (orden y dependencias)

- **Fase 1 — Cimientos**: A1 (CI/CD) + A6 (higiene). *Justificación*: todo lo demás se valida automáticamente a partir de aquí. Cierra el hallazgo crítico C-03.
- **Fase 2 — Infraestructura segura**: B1 + B2 + B3 (compose, no-root, imagen prod). *Depende*: A1 para validar builds e imágenes.
- **Fase 3 — Datos y contratos**: A2 (migración de índice) + A5 (payload) + B4 (Redis, opcional). *Depende*: nada, pero A2 requiere release notes y script antes del merge.
- **Fase 4 — Rendimiento frontend**: C1 + C3 (+ C4) + B7 (Monaco local, que ya separa una dependencia del CDN).
- **Fase 5 — Profundización**: A3 + A4 (tests), C2 (API ligera), B5/B6 (SSRF/claves), B8 (backups), C5 (deps).
- **Fase 6 — Release**: release notes ES/EN, CHANGELOG, `check-version.sh`, tags sin prefijo `v`, checklist de `VERSIONING.md`.

Las fases 2-5 pueden correr en paralelo parcial: 2 y 4 son independientes; 3 y 5 también.

## 6. Riesgos principales del release

1. **Migración de índice de email** (A2): si un despliegue existente tiene emails duplicados, el upgrade se detiene. Mitigación: script que reporta y aborta + instrucción en release notes de correrlo antes de desplegar.
2. **Cierre del puerto 27017** (B1): rompe setups que se conectan desde el host. Mitigación: nota de upgrade destacada y `docker exec` como alternativa documentada.
3. **Imagen prod del frontend** (B3): cambia la topología (Nginx en vez de Vite). Mitigación: probar en el compose de producción real y en las rutas públicas de `/shared`.
4. **Separación de claves TOTP** (B6): migra datos cifrados de todos los usuarios. Mitigación: migración atómica con verificación, tests con fixtures reales, y el arranque rechaza configuraciones incompletas.
5. **Code splitting** (C1): regresiones visuales por ruta si un lazy falla. Mitigación: smoke tests de rutas en A3 y revisión manual del flujo completo.

## 7. Definition of Done del release

- CI verde en main: lint backend + frontend, mypy, 249+ tests con cobertura ≥ 45%, builds de ambas imágenes.
- `bash scripts/check-version.sh 0.7.0` pasa sin warnings.
- La migración A2 está documentada y probada contra una BD con datos legacy (incluido un caso con duplicados).
- El bundle inicial baja de 670 KB a ≤ 500 KB gzip y todas las rutas pasan revisión manual.
- Los hallazgos C-03, A-02, A-04, M-03, B-04 y C-01/C-02 del informe de seguridad quedan cerrados (o explícitamente aceptados con justificación escrita).
- Release notes en `docs/es/release-notes/0.7.0.md` y `docs/en/release-notes/0.7.0.md` + CHANGELOG + nav de mkdocs.

## 8. Qué NO entra en 0.7.0

- Cambiar el almacenamiento del JWT de `localStorage` a cookies httpOnly (rediseño de sesión; merece su propio release con plan de migración de sesiones).
- RBAC granular (roles adicionales a admin/user).
- Nuevas funcionalidades de producto (diagramas, AI, colaboración).
- Reescrituras de módulos que ya cumplen el patrón SOLID del repo.

## 9. Siguiente paso

Aprobar esta propuesta (o ajustar el alcance) y crear el milestone `0.7.0` + issues en GitHub (uno por ítem Must/Should) para materializar el backlog. La creación de issues/milestone en GitHub requiere autorización explícita — este documento es local y aún no publica nada.
