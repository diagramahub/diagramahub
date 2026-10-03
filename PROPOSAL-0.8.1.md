# PROPOSAL 0.8.1 — Estabilización de 0.8.0

> Documento de trabajo **solo de la rama `release/0.8.1`**. Se elimina antes de integrar a `main`.

**Tipo de versión: PATCH.** Correcciones, endurecimiento, pulido y deuda interna. Sin funciones nuevas: lo que sea capacidad nueva va a 0.9 (al final).

## Cómo se hizo el análisis

- Tres auditorías de código, solo lectura: pizarrón, export/import en backend, UI de export/import y editor.
- Mediciones: `pnpm audit --prod`, ESLint por regla, mypy completo, `utcnow`, paridad de i18n, tamaños de archivo.
- **Verificación en vivo** de los hallazgos de mayor riesgo contra el stack (marcados ✔︎). Lo que solo se revisó leyendo código lleva 📖; lo que falta confirmar, ❓.

Tamaños: **S** < 1 h · **M** ½ día · **L** 1 día+.

---

## A. Seguridad e integridad — imprescindible

| ID | Problema | Evidencia | Tam. |
|---|---|---|---|
| A1 | **Un usuario puede meter diagramas en la carpeta de otro.** Crear o actualizar un diagrama acepta cualquier `folder_id` sin comprobar que la carpeta sea del proyecto, y `get_by_folder_id` filtra solo por carpeta. El diagrama aparece en el explorador del otro usuario y en su exportación por carpeta (incluido el Markdown para IA: inyección de prompt). | ✔︎ El usuario B creó "inyectado" y apareció en la carpeta de A | M ✅ |
| A2 | **Duplicar un diagrama no respeta la cuota del plan** (`/diagrams/{id}/duplicate` no llama a `enforce_diagram_limit`). | 📖 `diagrams/routes.py:258` | S ✅ |
| A3 | **12 vulnerabilidades en axios 1.18.1** (7 altas, 5 moderadas). Todas se corrigen subiendo a 1.20. En 0.7.1 dejamos el audit en cero. | ✔︎ `pnpm audit --prod` | S ✅ |
| A4 | **Los límites de importación se aplican por ZIP, no por petición.** 20 MB de ZIPs pequeños muy comprimibles pueden descomprimirse a varios GB en memoria, incluso en vista previa. | 📖 `import_service.py:132`, `import_parsers.py:620` | M ✅ |
| A5 | **La vista previa de importación no tiene límite de frecuencia**, lo que abarata repetir A4. | 📖 `import_service.py:201` | S ✅ |
| A6 | **La vista compartida (solo lectura) se puede "editar" con clic derecho.** El menú contextual no revisa `readOnly`: el visitante puede borrar, cortar o bloquear elementos en su pantalla. No se guarda, pero confunde. | 📖 `FreehandCanvas.tsx:1305` | S ✅ |

## B. Pizarrón — correcciones

| ID | Problema | Evidencia | Tam. |
|---|---|---|---|
| B1 | **El paneo con rueda o trackpad nunca se guarda**: cada evento recrea el callback y cancela el guardado pendiente. Toca la invariante del viewport. | ✔︎ Tras desplazar, la vista guardada no cambió | S ✅ |
| B2 | La vista guardada (pan y zoom) probablemente no se restaura al abrir el pizarrón. | ✔︎ Confirmado con la e2e nueva: se abría siempre en 0,0 | S ✅ |
| B3 | Hacer clic (sin arrastrar) en el extremo de una flecha la **desconecta** de su forma. | 📖 `:883` | S ✅ |
| B4 | Mover, duplicar, pegar o redimensionar un trazo **pierde la presión del lápiz** y cambia su forma. | 📖 5 sitios | S ✅ |
| B5 | Pegar conserva `groupId` (la copia se agrupa con el original) y `locked`; duplicar copia `locked`. | 📖 `:1557`, `:1362` | S ✅ |
| B6 | Borrar una forma **borra flechas bloqueadas** conectadas a ella; "Cortar" del menú contextual incluye bloqueados (el atajo de teclado no). | 📖 `:831`, `:1464`, `:2042` | S ✅ |
| B7 | La selección y el borrado **ignoran la rotación**: se hace clic sobre la caja sin rotar. | 📖 `:72-86` | M |
| B8 | **Entradas vacías en el historial**: un clic sin mover crea un paso de deshacer; los sliders crean uno por cada movimiento y llenan el historial (100). | 📖 `:1160`, `:1959` | S ✅ |
| B9 | Redimensionar se queda "pegado" si el puntero sale del lienzo. | 📖 `:1987` | S |
| B10 | La fuente Caveat no se espera: el lienzo no se redibuja al cargarla y los anchos de texto se miden con la fuente de reserva. | 📖 sin `document.fonts` | S |
| B11 | El editor de texto usa otra fuente e interlineado que el lienzo (el texto "salta" al confirmar); un toque de un solo punto con el lápiz no deja marca. | 📖 `:2026`, `:1199` | S |
| B12 | Espacio para paneo solo funciona con el foco en `body`: tras usar la barra, Espacio pulsa el botón enfocado (incluido "Borrar todo", que no pide confirmación). | 📖 `:1613`, `:1678` | S |
| B13 | **Boceto → Mermaid**: un nodo llamado `end`, `style`, `class`, `click`… rompe el diagrama; las líneas sin punta salen como flechas; los autoenlaces se descartan; las flechas antiguas pueden invertir su sentido; las formas sin texto conectadas salen como "rectangle". | 📖 `sketchToMermaid.ts` | S ✅ |
| B14 | Atajos mostrados como ⌘ también en Windows/Linux. | 📖 tooltips | S |

## C. Export/import — robustez

| ID | Problema | Evidencia | Tam. |
|---|---|---|---|
| C1 | **Importar un título de 100 caracteres que ya existe falla completo** (el sufijo "(2)" excede 100 → 500 `import_failed`). | ✔︎ 2.ª importación: 500 | S ✅ |
| C2 | Un `.excalidraw` mal formado (puntos inválidos, `appState` no objeto, ids no texto, JSON muy anidado) provoca **500**. | 📖 `import_parsers.py:418-514` | S ✅ |
| C3 | Errores al leer una entrada del ZIP (CRC, cifrado, deflate64) provocan **500** en vez de omitirla. | 📖 `:633` | S ✅ |
| C4 | El revert no cubre cancelaciones (cliente que se desconecta): queda una importación parcial; además reporta `rolled_back: true` aunque algún borrado falle. | 📖 `import_service.py:289` | S ✅ |
| C5 | Carpetas con el mismo nombre en distinta capitalización (`Docs/` y `docs/`) crean dos carpetas; nombres repetidos en el manifest dejan carpetas vacías. | 📖 | S ✅ |
| C6 | Diagramas cuya carpeta ya no existe quedan **fuera de la exportación** del proyecto. | 📖 `export_service.py:138` | S ✅ |
| C7 | `NaN`/`Infinity` en un pizarrón importado se guardan y el frontend no puede leerlo; texto no UTF-8 se importa con caracteres de reemplazo sin aviso. | 📖 | S ✅ |
| C8 | Contar diagramas para la cuota **carga todos los documentos con su contenido** (en cada creación, importación y en la lista de proyectos). | 📖 `usage_limiter.py:127` | S ✅ |
| C9 | Los constructores de ZIP/Markdown corren en el event loop: un proyecto grande bloquea a todos mientras exporta. | 📖 `export_service.py:190` | S ✅ |

## D. UI de export/import y editor

| ID | Problema | Evidencia | Tam. |
|---|---|---|---|
| D1 | **El diálogo "Exportar proyecto" se reinicia solo** mientras está abierto: cualquier re-render del editor (autoguardado, temporizadores) devuelve alcance, formato y variante a los valores por defecto. | ✔︎ dependencias del efecto: `folders` es un arreglo nuevo en cada render (no reproducido en e2e: el diálogo no se re-renderiza en el flujo probado; arreglo defensivo) | S ✅ |
| D2 | El diálogo de importación puede quedarse en **"Cargando…" para siempre** (cerrar durante la vista previa y volver a abrir). | 📖 `ImportProjectModal.tsx:85` | S ✅ |
| D3 | Un error de conversión con `detail` como objeto **rompe la pantalla** ("Objects are not valid as a React child"); el texto de reserva está en inglés fijo. | 📖 `DiagramEditorPage.tsx:2176` | S ✅ |
| D4 | **`Accept-Language` siempre es `es`**: `api.ts` lee `i18nextLng`, pero i18n guarda el idioma en `language`. Los usuarios en inglés reciben respuestas del backend en español. | ✔︎ ninguna parte escribe `i18nextLng` (e2e: con la UI en inglés se enviaba `es`) | S ✅ |
| D5 | Mensajes de error: `import_failed` y 429 sin "intenta en N s" (se ignora `Retry-After`). | 📖 | S ✅ |
| D6 | Accesibilidad de diálogos: "Exportar diagrama" no cierra con Escape ni tiene `role="dialog"`; ningún diálogo atrapa el foco (DESIGN.md lo exige). | 📖 | M |
| D7 | Las URL de descarga se revocan justo después del clic (Firefox/Safari pueden cancelar la descarga de ZIPs grandes). | 📖 3 sitios; ❓ en navegador | S ✅ |
| D8 | Plurales ("Importar 1 diagramas"), variantes `dark:` faltantes, parpadeo de la zona de soltar, expansión de carpetas tras importar por nombre (en vez de por id), soltar un archivo fuera del explorador abre el archivo en el navegador, doble clic en "Exportar" de la lista de proyectos. | 📖 | M |
| D9 | **Faltan 97 claves en `en.json`** (historial de prompts, facturación, cancelación, uso y planes): esas pantallas muestran la clave cruda en inglés. | ✔︎ comparación de llaves | M ✅ |

## E. Deuda interna y rendimiento

| ID | Tema | Dato | Tam. |
|---|---|---|---|
| E1 | `datetime.utcnow()` (obsoleto; fechas sin zona horaria, incluso en el manifest) → helper `utcnow()` con UTC. | 63 usos | M |
| E2 | `class Config` estilo Pydantic v1 → `model_config = ConfigDict(...)`. | ~15 modelos | S |
| E3 | Los limitadores de frecuencia nunca borran llaves: crecen sin límite con IPs rotativas. | `rate_limit.py:41` | S |
| E4 | Rendimiento del pizarrón: un `RoughCanvas` nuevo por elemento y por cuadro, caché de dibujos que falla en cada cuadro al arrastrar (y se vacía completa al llegar a 4.000), contornos de trazos recalculados en cada redibujo. Objetivo: acercar el paneo a mano (≈18 ms/cuadro) al limpio (≈10 ms). | medido en 0.8.0 | M |
| E5 | ESLint: 120 problemas (86 `any`, 23 dependencias de hooks). Meta 0.8.1: bajar a < 60, empezando por `DiagramEditorPage` (19). | ESLint | M |
| E6 | mypy completo: 235 errores en 42 archivos (los módulos nuevos están limpios). Meta: no subir el número y corregir los de módulos tocados. | mypy | — |
| E7 | Ruff 0.7 (muy antiguo junto a black 26) → actualizar; AGENTS.md dice Python 3.11+ y passlib, pero el proyecto pide 3.12 y usa bcrypt directo. | pyproject | S |
| E8 | Extraer de `DiagramEditorPage.tsx` (5.777 líneas) el bloque de exportación a un hook `useDiagramExport`; centraliza la descarga (y arregla D7 de una vez). Opcional. | 📖 `:2318-2565` | M |
| E9 | Pruebas: regresión para cada corrección de backend (A1, A2, A4, C1-C7) y Vitest para `sketchToMermaid` (B13) y la geometría de selección rotada (B7). | — | M |

## F. Catálogo de modelos de IA

Actualizar la lista de modelos de los proveedores que ya existen es PATCH (dato de catálogo, sin capacidad nueva). Un proveedor nuevo o una capacidad nueva (visión, razonamiento configurable) sería MINOR → 0.9.

| ID | Tema | Dato | Tam. |
|---|---|---|---|
| F1 | Actualizar los modelos de los 5 proveedores **contra la documentación oficial de cada uno** (no de memoria), con un recomendado por proveedor. Claude va atrasado: hoy ofrecemos Haiku 4.5 y Sonnet 4.6; los actuales son Opus 5.5, Sonnet 5.5, Fable 5.1 y Haiku 4.5. | `frontend/src/types/ai.ts` | S ✅ |
| F2 | **Una sola fuente de verdad.** El catálogo vive en tres sitios que ya divergen: lista del frontend, tabla de ventana de contexto del chat (`chat_sessions/services.py`; un modelo sin entrada recibe un valor por defecto que puede recortar el historial antes de tiempo) y valores por defecto del backend (`gemini-2.5-flash` en los schemas, `gemini-2.0-flash-lite` en el cliente, que ya ni está en la lista). | 3 sitios | M ✅ |
| F3 | Etiqueta "(retirado)" fija en español; el modelo guardado que salga de la lista debe seguir funcionando y avisar. | `AIIntegrationsSection.tsx:202` | S ✅ |
| F4 | Prueba que falle si un modelo de la lista no tiene ventana de contexto definida. | — | S ✅ |
| F5 | **"Sin créditos" se muestra como "Rate limit, intenta en unos momentos".** Todo 429 se traduce igual, aunque OpenAI distingue `insufficient_quota` / `credit_balance_exhausted` (no se arregla esperando). Revisar el mismo mapeo en los 5 clientes. | ✔︎ Llave de OpenAI de alexdzul@me.com: 429 `credit_balance_exhausted` en todos los modelos; la app dice "rate limit" | S ✅ |
| F6 | **"Probar conexión" da OK con una llave que no puede generar nada**: `validate_api_key` solo lista modelos (OpenAI, Claude) y no prueba el modelo elegido ni el saldo. Propuesta: una llamada mínima (1–5 tokens) con el **modelo seleccionado** y mensajes claros: llave inválida / sin créditos / modelo no disponible para esta llave. | ✔︎ Misma llave: validación `True`, generación imposible | S ✅ |

Validación real del catálogo con las llaves locales (2026-10-02, cuenta alexdzul@me.com):

| Proveedor | Modelos de la lista probados | Resultado | Disponibles para la llave y ausentes de la lista |
|---|---|---|---|
| Claude | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, guardado `claude-sonnet-4-5-20250929` | ✅ todos responden | `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-fable-5-1` (y versiones anteriores de Opus/Sonnet 5) |
| DeepSeek | `deepseek-v4-flash`, `deepseek-v4-pro`, guardado `deepseek-chat` | ✅ todos responden | `/models` reporta `deepseek-flash` y `deepseek-v4-pro`; `deepseek-chat` funciona como alias aunque ya no se lista |
| OpenAI | los 8 de la lista + guardado `gpt-5-mini` | ✅ todos responden (2.ª prueba, tras recargar la llave; la 1.ª falló por falta de créditos → F5/F6) | la llave lista `gpt-5.5`, `gpt-5.6-*`, `gpt-6-*`, `gpt-6.1-sol`; confirmar contra la documentación cuáles son de uso general |
| MiniMax / Gemini | — | sin llave en esta cuenta (MiniMax está en alex.dzul@hiumanlab.com) | — |

## G. Calidad de los prompts — menos diagramas inválidos

**Hallazgo:** los diálogos "Crear/Mejorar con IA" no se usaban; los usuarios generan **solo desde el chat**, cuyo streaming recibía un prompt mínimo sin marcadores ni reglas. Se midió también el chat (mismo banco de pruebas pasando por `stream_message` real): **88 % → 99 %**. Los diálogos se eliminaron.

**Resultado del endpoint `/ai/generate-diagram` (G9, 160 casos, mismos modelos):** prompts 0.8.0 → **72 %** válidos al primer intento; prompts 0.8.1 → **98 %** (gpt-5.4-mini 85→100, claude-haiku-4.5 75→98, deepseek-flash 35→100, gemini-3.5-flash-lite 93→93). Causa principal: respuestas vacías o cortadas por el límite de 2048–4096 tokens en modelos con razonamiento.

Causas concretas encontradas en `prompts.py`, los 5 clientes y el flujo de generación:

| ID | Problema | Por qué confunde al modelo | Tam. |
|---|---|---|---|
| G1 | **Generar y mejorar no validan el resultado.** El código vuelve tal cual; si no renderiza, el usuario tiene que pulsar "Arreglar con IA". | El error se descubre tarde y cuesta una acción manual. Propuesta: validar (Mermaid con `mermaid.parse` en el navegador, D2 con Kroki) y, si falla, **un solo reintento automático** con el mensaje de error real al endpoint de arreglo existente. Se respeta la invariante: sin reintento automático para PlantUML y DBML. | M ✅ |
| G2 | **Respuestas cortadas sin aviso.** `max_tokens` = 4096 y no se revisa `finish_reason`/`stop_reason`. Los modelos con razonamiento (GPT-5.x, DeepSeek V4, Gemini 3) gastan parte de ese presupuesto pensando, así que los diagramas grandes llegan truncados y rotos. | Detectar el corte y mostrar "el diagrama es demasiado grande, simplifica o divide"; subir el límite solo para generar (implica actualizar la regla de AGENTS.md). | S ✅ |
| G3 | **Extracción frágil del código.** Generar pide "solo código" y limpia fences solo si la respuesta *empieza* con ```` ``` ````. Un preámbulo ("Aquí está tu diagrama:") o una nota final se cuela al editor. | Usar los mismos marcadores que el chat (`<<<DIAGRAM>>>` / `<<<END_DIAGRAM>>>`) o extraer el primer bloque de código en cualquier posición; quitar texto suelto antes de la palabra clave del diagrama. | S ✅ |
| G4 | **El prompt empuja a decorar.** "Sé generoso con el diseño: haz que se vea espectacular" y colores obligatorios. `classDef`, `class` y `style` son justo donde la propia guía documenta los errores más frecuentes. | Estilo moderado y solo donde el tipo lo soporta; la corrección primero. | S ✅ |
| G5 | **Faltan los errores reales más comunes de Mermaid**: textos con `( ) : / ; " #` sin comillas (`A[Login (OAuth)]` rompe), `end` en minúsculas como id, HTML en etiquetas, acentos o espacios en ids, `-->` dentro de sequenceDiagram. La referencia cubre bien flowchart y muy poco los demás tipos. | Agregar esas reglas y **un ejemplo mínimo válido por subtipo** (sequence, class, ER, state, gantt, mindmap, timeline). | M ✅ |
| G6 | **No hay guía para elegir el subtipo.** El usuario elige "Mermaid", pero el modelo decide si es flowchart, sequence o ER sin criterio. | Tabla de intención → subtipo (proceso → flowchart, interacción entre actores → sequence, modelo de datos → erDiagram…). | S ✅ |
| G7 | **Temperatura 0.7 para generar código**, y `temperature or default` convierte un 0 explícito en 0.7. Además, algunos modelos de razonamiento rechazan `temperature`. | 0.2–0.3 para generar, mejorar y arreglar; 0.7 se queda para descripciones. Corregir el `or` y omitir el parámetro donde el modelo no lo acepta (verificar en la documentación). | S ✅ |
| G8 | **Instrucciones duplicadas en español e inglés** (dos copias de cada prompt) y casi todo en el mensaje de usuario; el system prompt es una línea. | Una sola plantilla de instrucciones en inglés con "escribe las etiquetas en {idioma}". La referencia de sintaxis estable va al system prompt, lo que además permite **caché de prompts** en Claude, OpenAI y Gemini (menos latencia y costo para el usuario, que paga con su propia llave). | M ✅ |
| G9 | **Sin medición.** Hoy no sabemos qué porcentaje de diagramas sale válido al primer intento. | Banco fijo de ~30 descripciones × 4 tipos; script que corre cada proveedor y mide "válido al primer intento" y "válido tras 1 arreglo", **antes y después** de G1–G8. Sin esto no podemos afirmar que mejoró. | M ✅ |

Notas:
- G1 y G8 tocan el comportamiento de los 5 clientes: van con pruebas por proveedor (respuestas simuladas) y una prueba real por proveedor con llave.
- El reintento automático (G1) gasta una llamada extra de la llave del usuario: máximo 1, y se informa en la respuesta.

---

## Propuesta de alcance

- **Imprescindible (≈ 3 días):** todo **A**; B1-B6, B8, B13; C1-C4; D1-D5; E9; **F1-F3; G1-G4, G7, G9**.
- **Recomendado (≈ 2 días):** B7, B9-B12, B14; C5-C9; D6-D9; E1-E4; F4; G5, G6, G8.
- **Si hay tiempo:** E5, E7. (E8 → 0.9)

## Fuera de 0.8.1 → 0.9

- **Pizarrón táctil** (eventos de puntero, `touch-action`): hoy no se puede dibujar en pantallas táctiles. Es capacidad nueva.
- Fondo oscuro del lienzo según el tema (hoy siempre blanco).
- Índice único de email (requiere migración de datos) y cambio de `python-jose` a PyJWT (`ecdsa` tiene un CVE sin parche; solo aplica con algoritmos ES\*).
- Mermaid → pizarrón, historial de versiones, galería de plantillas.

## Decisiones

| # | Tema | Decisión |
|---|---|---|
| 1 | A1: limpiar datos existentes | ✅ Sí: script idempotente que mueve a la raíz de su propio proyecto los diagramas cuyo `folder_id` es de otro proyecto, con conteo en el log |
| 2 | D9: traducir las 97 claves a inglés | ✅ Sí, las traduzco yo |
| 3 | E8: extraer `useDiagramExport` | 🚫 → 0.9 (D7 se corrige en los 3 sitios sin el refactor) |
| 4 | Alcance | ✅ Imprescindible + recomendado (≈ 5 días); "si hay tiempo" (E5, E7) solo si sobra |
| 5 | Tamaño del banco de pruebas (G9) | ✅ Chico: 10 descripciones × 4 tipos, modelos económicos (`gpt-5.4-mini`, `claude-haiku-4-5`, `deepseek-v4-flash`); se amplía solo si los resultados quedan parejos |
| 6 | `max_tokens` para generar (G2) | ✅ 8192 solo para generar y mejorar (descripciones y chat siguen en 4096), y aviso claro si aun así se corta. Actualizar la regla de AGENTS.md |
| 7 | Reintento automático (G1) | ✅ Opcional, configurable por el usuario |
