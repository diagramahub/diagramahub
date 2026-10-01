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

## 3b. Track D — Pizarrón a mano alzada: calidad + diferenciación frente a Excalidraw

### Por qué hoy no se siente como Excalidraw (verificado en `FreehandCanvas.tsx`)

| Aspecto | Hoy | Excalidraw |
|---|---|---|
| Formas | geometría perfecta (`strokeRect`, líneas rectas) → app de dibujo básica | trazo "a mano" con `roughjs` (irregular, relleno rayado) |
| Trazo libre | polilínea cruda, grosor constante, sin suavizado → dentado | `perfect-freehand`: suavizado, grosor variable, puntas afinadas |
| Texto | `sans-serif` | fuente manuscrita (Virgil/Excalifont) |
| Dependencias | ninguna de las dos librerías | ambas son MIT y son la base de su look |

**Conclusión**: el salto de calidad percibida viene de **dos librerías MIT y una fuente**, no de reescribir el lienzo.

### Estrategia: paridad en lo esencial, ganar en lo que Excalidraw no tiene

Competir con Excalidraw *en dibujar* es perder: es un producto enfocado y muy pulido. Diagramahub gana si el pizarrón deja de ser una isla y se conecta con lo que ya lo hace único (diagramas como código, IA con tu propia key, organización, historial, compartir, self-host multiusuario).

**Paridad (lo mínimo para que no se sienta inferior)**

| # | Ítem | Esfuerzo | Estado |
|---|------|----------|--------|
| W1 | **Estilo "a mano" con `roughjs`**: control de *trazo* (arquitecto / artista / caricatura) y relleno (sólido / rayado / cruzado); sin cambiar el formato guardado (atributos nuevos opcionales, *seed* estable por elemento para que no "tiemble" al redibujar) | M | ❓ |
| W2 | **Trazo libre con `perfect-freehand`** (suavizado, presión del lápiz/stylus, puntas) | S | ❓ |
| W3 | **Fuente manuscrita empaquetada** (OFL, servida localmente) + texto que se ajusta dentro de las formas | S | ❓ |
| W4 | **Rendimiento**: caché del dibujo por elemento (roughjs es costoso) para no redibujar todo en cada cuadro | S/M | ❓ |
| W5 | **Lo que se nota al usarlo**: pegar imágenes, atajos de teclado por herramienta (1–9), exportar PNG/SVG con fondo transparente, bloquear elementos, "ajustar a pantalla", lienzo oscuro | M | ❓ |

**Diferenciación (lo que Excalidraw no tiene o cobra)**

| # | Ítem | Por qué gana usuarios | Esfuerzo | Estado |
|---|------|-----------------------|----------|--------|
| D1 | **Boceto ↔ código**: convertir un pizarrón a Mermaid/PlantUML con IA (para versionarlo, documentarlo, ponerlo en un README) y Mermaid → pizarrón "a mano" (para presentarlo con look informal). Hoy la conversión excluye freehand | Nadie une boceto y diagrama-como-código en ambos sentidos | M/L | ❓ |
| D2 | **Bloques de diagrama vivos dentro del pizarrón**: un elemento con código Mermaid/PlantUML/D2 que se renderiza y se edita ahí mismo | Pizarrón libre + diagramas precisos en el mismo lienzo | M | ❓ |
| D3 | **"Dibuja esto" con IA (BYOK)**: genera un boceto editable en el lienzo desde un prompt, con el proveedor del usuario | En Excalidraw la IA es de pago/limitada; aquí es tu key, self-hosted | M | ❓ |
| D4 | **Lo que ya existe, puesto en valor para el pizarrón**: proyectos/carpetas, historial de versiones (F1), links con código y expiración, modo presentación con anotaciones, descripción en Markdown | Excalidraw gratis no organiza ni versiona (Excalidraw+ es de pago) | S (mensaje + pulido) | ❓ |

**Fuera de alcance de 0.8**: colaboración en tiempo real (la gran fortaleza de Excalidraw; requiere CRDT/WebSockets — apuesta mayor).

**Alternativa considerada — incrustar el componente de Excalidraw (MIT)**: paridad inmediata de dibujo, pero migración del formato guardado, ~1 MB más en el chunk del editor, perder lo que ya tiene el lienzo propio (guías de alineación, anclajes de flechas, integración con autosave/presentación/solo lectura) y, sobre todo, refuerza la pregunta "¿por qué no usar Excalidraw directamente?". Se recomienda el camino propio (W1–W4) y reevaluar si después la calidad sigue por debajo.

**Recomendación**: W1–W4 + D1 + D4 en 0.8.0 (D2/D3 si hay espacio; W5 por partes).

## 4. Deuda técnica

- `ChatSessionService` (1,336 líneas, send/stream casi duplicados): dividir **después** de Q2, que le da red de pruebas.
- `ai_providers/prompts.py` (2,061 líneas): revisar duplicación entre idiomas/proveedores.

## 5. Decisiones abiertas

1. ¿Qué features entran? (recomendado: F1–F4)
2. ¿Pizarrón: camino propio (`roughjs` + `perfect-freehand`) o incrustar Excalidraw? (recomendado: propio) ¿Qué diferenciadores entran? (recomendado: D1 + D4)
3. ¿Q4 (extraer hooks del editor) entra con F1?
4. ¿H3 cambia la instalación local por defecto o queda como opción documentada?
5. ¿Modo embed (F6): se acepta permitir *framing* en la ruta pública de embed?
6. ¿Umbral de cobertura objetivo: 55%?

## 6. Cierre

- [ ] Release notes `docs/{es,en}/release-notes/0.8.0.md`, índices, nav de mkdocs, CHANGELOG
- [ ] Badge de cobertura del README actualizado
- [ ] `bash scripts/check-version.sh 0.8.0` → OK
- [ ] **Eliminar este archivo** antes de abrir el PR
