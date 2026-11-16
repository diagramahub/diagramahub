# 🧠 Diagrama Hub - Brain Storm de Funcionalidades

Ideas de funcionalidades potentes para llevar Diagrama Hub al siguiente nivel.

**Estado** (revisado contra el código de la versión 0.9.0):

- ✅ Implementado
- 🟡 Parcial: existe algo relacionado, pero no lo que describe la idea
- ⬜ Pendiente

---

## 🗺️ Mapa de versiones

### 0.9.0 (en curso, rama `release/0.9.0`)

**Funciones**
- ✅ Diagrama desde imagen con IA (foto de pizarrón o captura → código), con los proveedores que aceptan imágenes
- ✅ Búsqueda en el contenido de los diagramas y filtro por tipo
- ✅ Embed (iframe) y código QR para los enlaces compartidos
- ✅ Presentación de una carpeta completa (navegar entre diagramas)
- ✅ PDF de un proyecto o carpeta con varios diagramas
- ✅ Tokens de API personales (base para una CLI o extensión de VS Code)
- ✅ Pantalla de historial de prompts (la API ya existe)

**Actualizaciones mayores**
- ✅ Backend: Beanie 2 y retiro de Motor (fin de vida 2026-05-14), FastAPI, uvicorn + `uvicorn-worker`, gunicorn, httpx, qrcode, google-genai 3, bcrypt 5
- ✅ Pruebas y calidad: pytest 9 + pytest-asyncio 1.x, ruff, mypy
- ✅ Frontend: ESLint 10, Vitest 5, Vite 8 + plugin-react 6, TypeScript 6, Mermaid 12 con sus valores predeterminados (ELK, Redux color, neo) y migración de los diagramas existentes, i18next 27 / react-i18next 18, react-markdown 10, Sentry 11
- ✅ Infraestructura: nginx-unprivileged 1.30, versiones fijas de Kroki y MongoDB

**Comunidad**

Portal donde los usuarios publican sus diagramas y que reemplaza la idea de una galería de plantillas (ver §3):

- ⬜ Publicar un diagrama en el portal (y retirarlo)
- ⬜ Fork: copiar un diagrama público a la cuenta propia
- ⬜ Estrellas
- ⬜ Comentarios públicos
- ⬜ Categorías y exploración por categoría
- ⬜ Compartir desde el portal

**Seguridad**
- ✅ CI en GitHub Actions: pruebas, lint, auditoría de dependencias, CodeQL, escaneo de imágenes y Dependabot
- ✅ Auditoría de acciones sensibles fuera de la autenticación (integraciones, planes, llaves de IA, enlaces compartidos)
- ✅ Content-Security-Policy activa por defecto en el frontend
- ✅ Límite explícito de 72 bytes para contraseñas (bcrypt)
- ✅ Rotación de la llave de cifrado (`AI_ENCRYPTION_KEY`)

### Pendiente sin versión asignada

- ⬜ Historial de versiones de cada diagrama (§2)
- ⬜ Sesión en cookie httpOnly, logout en el servidor y lista de sesiones activas
- ⬜ Stripe SDK 17
- ⬜ Passkeys (WebAuthn) como método MFA
- ⬜ TypeScript 7, Tailwind CSS 4, MongoDB 9
- ⬜ Adoptar el React Compiler (sus reglas de lint quedaron desactivadas en 0.9.0)
- ⬜ Incluir los pizarrones en el PDF de proyecto o carpeta

---

## ✅ Implementado

### 🔧 **Auto-Fix de Diagramas Rotos con IA** (antes PRIORIDAD ALTA)

Implementado: `POST /api/v1/diagrams/{id}/fix` (`diagrams/fix_service.py`, prompts por tipo en `diagrams/fix_prompts.py`). El editor muestra un diff antes/después con la explicación y el resumen de cambios (`DiagramDiffView`) antes de aplicar el código corregido. El reintento automático está desactivado para PlantUML y DBML (invariante #8).

---

## 🚀 Ideas Propuestas

### 1. **Colaboración en Tiempo Real**
- ⬜ Edición simultánea de diagramas (como Google Docs)
- ⬜ Comentarios y anotaciones en diagramas específicos
- ⬜ Sistema de permisos (viewer, editor, admin): solo hay roles globales `admin`/`user`, no permisos por diagrama o proyecto
- ⬜ Historial de cambios con diff visual

### 2. **Versionado y Control de Cambios**
- ⬜ Git-like versioning para diagramas
- ⬜ Branches y merge de diagramas
- ⬜ Comparación visual entre versiones: el diff visual existe solo para el auto-fix con IA
- ⬜ Rollback a versiones anteriores

### 3. **Plantillas y Biblioteca de Componentes**
- ⬜ Marketplace de plantillas prediseñadas: se cubrirá con el portal de Comunidad (0.9.0)
- ⬜ Biblioteca de componentes reutilizables (AWS icons, UML patterns, etc.)
- ⬜ Snippets personalizados por usuario/equipo
- ⬜ Import/export de plantillas

### 4. **Integración con Herramientas de Desarrollo**
- ⬜ Plugin para VS Code
- ⬜ CLI para generar diagramas desde terminal
- ⬜ Webhook para auto-actualizar diagramas desde código
- ⬜ Integración con GitHub/GitLab (diagramas en PRs)

### 5. **Análisis y Validación Inteligente**
- ✅ Validación de sintaxis en tiempo real con sugerencias: la vista previa muestra el error al renderizar y ofrece "Arreglar con IA"; el backend valida con `diagrams/syntax_validator.py` (Kroki para D2/PlantUML/DBML)
- ⬜ Detección de errores lógicos en diagramas (ciclos infinitos, nodos huérfanos)
- 🟡 Sugerencias de optimización de diagramas: existe "mejorar diagrama" con IA (`/ai/improve-diagram` y el chat), pero no sugerencias automáticas
- ⬜ Análisis de complejidad

### 6. **Presentación y Compartir Mejorado**
- ✅ Modo presentación con navegación por slides: presentar una carpeta o el proyecto completo
- ✅ Links públicos con contraseña: enlaces `public` o `protected` (código de acceso), con expiración de 5/10/30 días o ilimitada
- ✅ Embeds para sitios web (iframe): `/embed/<token>` en enlaces que lo permiten
- ✅ QR codes para compartir rápido

### 7. **Exportación Avanzada**
- ✅ PDF con múltiples diagramas: PDF de un proyecto o una carpeta (sin pizarrones)
- ⬜ PowerPoint/Google Slides
- ⬜ Confluence/Notion integration
- ⬜ Animated GIFs de diagramas secuenciales

### 8. **IA Generativa Avanzada**
- ✅ Generar diagramas desde imágenes/screenshots: "Desde imagen" en el chat (Gemini, OpenAI, Claude), además de "Sketch → Mermaid" desde el pizarrón
- 🟡 Convertir entre tipos de diagramas (flowchart → sequence): existe conversión con IA entre lenguajes (Mermaid ↔ PlantUML ↔ D2 ↔ DBML, `POST /diagrams/convert`), no entre tipos de diagrama
- ⬜ Traducción automática de diagramas a otros idiomas
- 🟡 Generar documentación técnica desde diagramas: la IA genera la descripción de un diagrama y el proyecto se exporta como Markdown "AI-context", pero no hay documentación técnica generada

### 9. **Workspace y Equipos**
- ⬜ Espacios de trabajo compartidos
- ⬜ Facturación por equipos: la suscripción es por usuario
- ⬜ Roles y permisos granulares
- 🟡 Activity feed del equipo: existe el audit log de seguridad (consultable en MongoDB, sin vista en la app), no un feed de actividad

### 10. **Búsqueda y Descubrimiento**
- ✅ Búsqueda full-text en contenido de diagramas: el explorador también busca en el código y la descripción
- 🟡 Filtros avanzados (por tipo, fecha, autor, tags): filtro por tipo; no existen tags
- ⬜ Diagramas relacionados/similares
- ⬜ Búsqueda visual (buscar por forma/estructura)

### 11. **Integraciones con Terceros**
- ⬜ Slack/Discord notifications
- ⬜ Jira/Linear para diagramas de flujo de trabajo
- 🟡 Figma/Miro import: se importa `.excalidraw` (convertido a sketch), no Figma ni Miro
- ✅ API REST pública para integraciones custom: tokens de API personales (lectura o escritura) sobre proyectos, carpetas, diagramas y enlaces

### 12. **Modo Offline y Sincronización**
- ⬜ PWA con soporte offline
- ⬜ Sincronización automática al reconectar
- ⬜ Conflictos de merge inteligentes

---

## 📝 Notas

- Priorizar funcionalidades que aprovechen la IA ya integrada
- Mantener la simplicidad y velocidad de la plataforma
- Considerar impacto en performance y costos de API
- Validar con usuarios antes de implementar features complejas

---

**Última actualización:** 2026-11-15
