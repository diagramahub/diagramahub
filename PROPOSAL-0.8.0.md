# Plan vivo — Versión 0.8.0 (MINOR): Exportar, Importar y Pizarrón a mano alzada

- **Inicio**: 2026-10-01 · **Rama**: `release/0.8.0` (desde `main` = tag `0.7.1`)
- **Tipo**: MINOR — funcionalidad nueva compatible
- **Regla**: archivo interno de la rama; **se elimina antes del merge a `main`**
- **Estados**: 🎯 en alcance · 🔨 en curso · ✅ hecho · ❓ por decidir · 🚫 fuera de 0.8

## Alcance

Tres pilares que se refuerzan entre sí: **lo que se exporta se puede importar**, y el **pizarrón** se vuelve ciudadano de primera clase en ambos (y se conecta con los diagramas como código).

**Fuera de 0.8.0** (para otra versión): historial de versiones, galería de templates, exportar desde link compartido, búsqueda global, modo embed, tokens de API, bloques de diagrama vivos y "dibuja esto" en el pizarrón, CI, pruebas de contrato, hardening (email único, clave TOTP, PyJWT, Monaco empaquetado), MongoDB con credenciales, Redis.

---

## Pilar 1 — Exportar (proyecto o carpeta)

| # | Tarea | Esfuerzo | Estado |
|---|-------|----------|--------|
| E1 | **Backend**: servicio + `GET /projects/{id}/export?folder_id&format=zip\|markdown&variant=ai\|standard&descriptions` y `GET …/export/summary` | M | ✅ `export_builders.py` (puro) + `export_service.py` + rutas; 27 pruebas |
| E2 | **Frontend**: diálogo (alcance, formato, variante, descripciones, resumen) desde el proyecto y desde el menú de carpeta del explorador | S/M | 🎯 |

**Diálogo**
```
Exportar
  Alcance   (•) Proyecto completo (raíz + todas las carpetas)
            ( ) Una carpeta: [ Arquitectura ▾ ]        ← preseleccionada si se abre desde una carpeta
  Formato   (•) ZIP — carpetas y archivos individuales
            ( ) Markdown — un solo archivo (.md)
                  Variante  (•) Para contexto de IA   ( ) Estándar
  Incluir   [x] Descripciones
  Resumen   12 diagramas · 3 carpetas · ~48 KB · ~11.000 tokens (solo variante IA)
```

**ZIP**: carpeta raíz con el nombre del proyecto; una subcarpeta por carpeta; por diagrama su fuente (`.mmd`, `.puml`, `.d2`, `.dbml`, `.freehand.json`) y, si tiene, su descripción en un `.md` hermano; `README.md` (índice) y `manifest.json` (versión de formato, carpetas con color, tipos) para reimportar. Nombres saneados para cualquier sistema operativo y sin colisiones (sufijo `(2)`).

**Markdown**

| | Para contexto de IA | Estándar |
|---|---|---|
| Encabezado | preámbulo que explica qué es el archivo, cómo está organizado y cómo leer cada bloque | solo el título |
| Índice | con la ruta de cada diagrama | simple |
| Metadatos por diagrama | tipo, carpeta, fecha | ninguno |
| Estimación de tokens | sí | no |
| Común | secciones por carpeta/diagrama, descripción, código en bloques con etiqueta (`mermaid`, `plantuml`, `d2`, `dbml`); pizarrones como lista de sus textos (y como Mermaid si D1a puede convertirlos) | |

**Notas técnicas**: se genera en el servidor (no depende de lo que el navegador tenga cargado); ZIP con `zipfile` de la librería estándar; límite de peticiones por usuario; `Content-Disposition` con nombre saneado.

**Pruebas**: proyecto completo y una carpeta; las dos variantes (preámbulo/metadatos solo en IA); sin descripciones; nombres saneados y colisiones; carpeta vacía; carpeta de otro proyecto o proyecto de otro usuario → 403/404.

---

## Pilar 2 — Importar

| # | Tarea | Esfuerzo | Estado |
|---|-------|----------|--------|
| I1 | **Archivos sueltos** (arrastrar al explorador o seleccionar): `.mmd/.mermaid`, `.puml/.plantuml/.pu`, `.d2`, `.dbml`, `.freehand.json`, `.md` con un bloque de código | S/M | 🎯 |
| I2 | **ZIP**: el de E1 (con `manifest.json`, restaura carpetas y colores) y también un ZIP cualquiera (carpetas desde las rutas, tipo por extensión, descripción desde el `.md` hermano) | M | 🎯 |
| I3 | **Importar de Excalidraw** (`.excalidraw` → pizarrón): rectángulo, rombo, elipse, flecha, línea, texto, trazo libre; lo no soportado (imágenes, *frames*) se omite y se informa | M | 🎯 |

**Flujo**: subir → **vista previa** ("se crearán 2 carpetas y 14 diagramas; 1 archivo omitido: `foto.png`") → confirmar → crear. Destino: la carpeta o raíz desde donde se importa.

**Reglas**
- **Detección de tipo** por extensión y, si es ambigua, por contenido (`@startuml`, `Table …`, `graph`/`flowchart`, sintaxis de D2).
- **Título** desde el nombre del archivo; si ya existe en el destino, sufijo `(2)`.
- **Límites del plan**: se revisa el cupo de diagramas **antes** de crear nada (`usage_limiter.check_diagram_limit`).
- **Seguridad del ZIP**: tamaño de subida propio para este endpoint (el límite global de 0.7.1 es 5 MB), tope de tamaño descomprimido y de cantidad de archivos (protección contra *zip bombs*), sin ZIP anidados, se ignoran `__MACOSX/` y ocultos, rutas saneadas.
- **Validación**: el JSON de pizarrón y el de Excalidraw se validan antes de guardarse.
- **Sin escrituras parciales**: se valida todo primero; si algo falla al crear, se revierte lo creado (MongoDB standalone no tiene transacciones).

**Implementación**: `POST /projects/{id}/import` (multipart, `python-multipart` ya está en las dependencias; `?dry_run=true` para la vista previa). Parsers puros (detección de tipo, ZIP, Excalidraw → pizarrón) con pruebas propias.

**Por qué I3 importa**: es la puerta de entrada para usuarios de Excalidraw ("trae tus dibujos") — la forma más directa de que prueben Diagramahub.

---

## Pilar 3 — Pizarrón a mano alzada

### Diagnóstico (verificado en `FreehandCanvas.tsx`)

| Aspecto | Hoy | Excalidraw |
|---|---|---|
| Formas | geometría perfecta (`strokeRect`, líneas rectas) | trazo "a mano" con `roughjs` |
| Trazo libre | polilínea cruda, grosor constante, sin suavizado | `perfect-freehand`: suavizado, presión, puntas |
| Texto | `sans-serif` | fuente manuscrita |

Ambas librerías son MIT y livianas. **Camino propio** (no incrustar Excalidraw): conserva el formato guardado y lo que ya tiene el lienzo (guías de alineación, anclajes de flechas, grupos, integración con autosave, presentación y solo lectura).

### Calidad visual

| # | Tarea | Esfuerzo | Estado |
|---|-------|----------|--------|
| W1 | **`roughjs`**: estilo de trazo (Arquitecto / Artista / Caricatura) y relleno (sólido / rayado / cruzado), con *seed* estable por elemento para que no "tiemble" al redibujar. Atributos nuevos opcionales: **sin migración** | M | 🎯 |
| W2 | **`perfect-freehand`**: trazo suave con presión del lápiz/stylus (`PointerEvent.pressure`) | S | 🎯 |
| W3 | **Fuente manuscrita Virgil empaquetada** (servida localmente, OFL-1.1, con su `OFL.txt`) + selector (manuscrita / normal / código) + texto que se ajusta dentro de las formas | S | 🎯 |
| W4 | **Rendimiento**: caché del dibujo por elemento; medir con 1.000 elementos antes/después | S/M | 🎯 |
| W5 | **Pulido de uso**: atajos por herramienta, "ajustar a pantalla", exportar PNG/SVG con fondo transparente, lienzo oscuro, bloquear elementos. (Pegar imágenes queda fuera: inflaría el contenido por encima del límite de 5 MB) | M | 🎯 |

### Diferenciación

| # | Tarea | Esfuerzo | Estado |
|---|-------|----------|--------|
| D1a | **Pizarrón → Mermaid** (diagrama de flujo), **determinista**: formas con texto → nodos (rectángulo `[ ]`, rombo `{ }`, elipse `( )`), flechas ancladas → conexiones (con su texto como etiqueta; punteada → `-.->`). Trazos libres y flechas sueltas se omiten con aviso. Crea un diagrama nuevo; el original no cambia. IA opcional (BYOK) solo para completar lo que no es estructurado | M | 🎯 |
| D1b | **Mermaid → pizarrón** (diagrama de flujo): se dibuja con Mermaid, se toma la geometría de nodos y conexiones del SVG y se crean formas "a mano" con sus flechas ancladas | M | 🎯 (si hay tiempo tras D1a) |
| D4 | **Pizarrón de primera clase**: incluido en exportar/importar; revisión del modo presentación y de la vista compartida con el nuevo renderizado | S | 🎯 |

**Compatibilidad**: los dibujos existentes no tienen los atributos nuevos. Ver decisión 1.

---

## Calidad mínima del alcance (no es un pilar aparte)

- **Pruebas de backend** para exportar e importar (límites, seguridad del ZIP, permisos).
- **Vitest** en el frontend solo para las funciones puras nuevas: detección de tipo, Excalidraw → pizarrón, pizarrón → Mermaid, nombres saneados. Son la lógica más fácil de romper y la más barata de probar.
- Verificación en el navegador (Playwright) de los flujos completos, como en 0.7.x.

## Orden de ejecución

1. **E1 → E2** exportar (define el formato que reutiliza importar).
2. **I1 → I2** importar (mismo formato), luego **I3** Excalidraw.
3. **W1–W4** calidad visual del pizarrón, luego **W5**.
4. **D1a** pizarrón → Mermaid; **D1b** si hay tiempo.
5. **D4** y cierre del release (notas, CHANGELOG, badge, `check-version.sh`, borrar este archivo).

## Decisiones tomadas (2026-10-01)

1. **Dibujos existentes**: conservan su aspecto actual (limpio); solo los elementos nuevos usan el estilo "a mano". Cada usuario puede cambiar el estilo de sus elementos.
2. **Importar por encima del cupo del plan**: se rechaza todo, con un mensaje claro (cuántos diagramas trae, cuántos permite el plan).
3. **Tamaño máximo de subida para importar**: 20 MB (configurable).
4. **Fuente manuscrita**: **Virgil** (OFL-1.1). **Excalifont descartada**: verificado en sus metadatos — "Copyright (c) 2024 by Excalidraw. All rights reserved.", sin licencia; no se puede empaquetar en un proyecto Apache-2.0. Alternativas verificadas también OFL-1.1: Caveat y Kalam (Google Fonts).
5. **Vitest** solo para las funciones puras nuevas.

## Licencias (todo open source y compatible con Apache-2.0)

Diagramahub es **Apache-2.0** (`LICENSE`, `pyproject.toml`). Lo que se agrega en 0.8.0, verificado:

| Componente | Uso | Licencia | Compatible | Obligación |
|---|---|---|---|---|
| `roughjs` 4.6.x | estilo "a mano" (W1) | MIT | ✅ | conservar el aviso de copyright |
| `perfect-freehand` 1.2.x | trazo suave (W2) | MIT | ✅ | conservar el aviso de copyright |
| **Virgil** (fuente) | texto manuscrito (W3) | OFL-1.1 (repo `excalidraw/virgil` + metadatos de la fuente) | ✅ | distribuir `OFL.txt` junto al `.woff2`; no venderla sola; si se modificara, no usar el nombre reservado |
| `vitest` 5.x (+ `jsdom`) | pruebas del frontend, solo desarrollo | MIT | ✅ | no se distribuye en la app |
| `python-multipart` (ya presente) | subida de archivos (I1–I3) | Apache-2.0 | ✅ | — |
| `zipfile` | ZIP de exportar/importar | librería estándar de Python (PSF) | ✅ | — |

- **Formato `.excalidraw` (I3)**: se lee con un parser propio, escrito desde cero (no se copia código de Excalidraw); leer un formato de archivo no impone obligaciones de licencia.
- **Nuevo `THIRD_PARTY_NOTICES.md`** en la raíz con los componentes de terceros que se distribuyen en la app (roughjs, perfect-freehand, Virgil) y sus licencias, y `OFL.txt` junto a la fuente en `frontend/public/fonts/`.
- **Excalifont**: no se usa (ver decisión 4).

## Cierre

- [ ] Release notes `docs/{es,en}/release-notes/0.8.0.md`, índices, nav de mkdocs, CHANGELOG
- [ ] Badge de cobertura del README actualizado
- [ ] `THIRD_PARTY_NOTICES.md` al día con lo que se distribuye
- [ ] `bash scripts/check-version.sh 0.8.0` → OK
- [ ] **Eliminar este archivo** antes de abrir el PR
