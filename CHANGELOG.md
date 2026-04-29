# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

## [0.4.0] - 2026-04-29

### Added
- Integración de Kroki como motor de renderizado server-side auto-hospedado (Docker `yuzutech/kroki`).
- Soporte para diagramas D2: renderizado, resaltado de sintaxis, 19 temas, validación, corrección IA, chat IA.
- Endpoint público `POST /api/v1/diagrams/render` para renderizado de diagramas vía Kroki.
- PlantUML migrado de renderizado client-side (plantuml.com) a server-side vía Kroki.
- `KrokiClient` con interfaz `IKrokiClient` (SOLID), 26 tipos de diagrama soportados.
- `KROKI_URL` configurable vía variable de entorno.
- Utilidad centralizada `diagramRenderer.ts` para enrutamiento de renderizado.
- `d2ConfigManager.ts` para gestión de temas D2.
- Validador `validate_d2` con balance de llaves.
- Prompts de IA con contexto D2 completo.
- Dashboard con saludo personalizado y tarjetas de estadísticas.
- Modal de nuevo diagrama rediseñado con layout horizontal.
- Panel de descripción redimensionable con ancho persistente.
- Selector de proyectos en el editor con búsqueda.
- Panel de diagramas rediseñado con buscador y acciones rápidas.
- Editor de código estilo IDE con tema oscuro y barra de estado.
- Responsividad completa en todas las vistas.
- Nuevas claves i18n para D2, dashboard, editor.

### Removed
- Dependencia `plantuml-encoder` del frontend.

### Changed
- Textos hardcoded reemplazados por claves `t()`.
- Paneles flotantes a pantalla completa en móvil.
- Componente `CodeEditor` extendido con soporte D2.

## [0.3.1] - 2026-04-23

### Fixed
- Error de compilación TypeScript `TS2305`: tipo `ChatMode` no exportado desde `types/chat.ts`, causando fallo en build de producción (Digital Ocean).

## [0.3.0] - 2026-04-23

### Added
- OAuth / Login Social con Google: arquitectura provider-agnostic (IOAuthProvider + OAuthProviderFactory).
- Vinculación automática de cuentas OAuth con cuentas existentes por email.
- Creación automática de cuenta con suscripción FREE para nuevos usuarios OAuth.
- Bypass de MFA para logins OAuth con JWT de 5 días.
- Protección CSRF con tokens de estado server-side (TTL 10 min, auto-limpieza MongoDB).
- Validación de ID token (firma, issuer, audience, expiración) para OpenID Connect.
- Rate limiting en endpoint de callback OAuth.
- Audit logging para eventos OAuth (login exitoso/fallido, vinculación de cuenta).
- Página de perfil muestra proveedores OAuth vinculados con fecha.
- Selector de idioma en páginas de login y registro.
- Versión de la aplicación visible en página de login.
- Banner MFA oculto para sesiones OAuth.
- Generación libre de descripciones AI en Markdown estructurado con capacidad de refinamiento.
- Chat unificado con detección automática de intención (conversar, generar, mejorar).

### Fixed
- Prompts de descripción mejorados para Markdown estructurado consistente.
- Generación de descripciones respeta el proveedor preferido del diagrama.
- Soporte DeepSeek agregado a _call_with_prompt para operaciones de refinamiento.
- Proveedor de sesión de chat se propaga correctamente a preferencias del diagrama.
- Bloque except faltante en send_message del servicio de chat.

### Changed
- Eliminado código muerto de modos legacy de conversación/mejora en chat.
- Eliminado campo mode de mensajes de chat (simplificación del modelo de datos).

## [0.2.1] - 2026-04-18

### Added
- Audit log de eventos de seguridad con retención automática de 90 días (TTL index MongoDB).
- Invalidación de sesiones al cambiar contraseña (claim `pca` en JWT).
- Conteo de diagramas por usuario en panel admin y export Excel.
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
- Rate limiting en login (10 intentos/IP/minuto).
- Account lockout (15 minutos tras 5 intentos fallidos).
- Swagger/OpenAPI deshabilitado en producción.
- Stack traces ocultos en producción.

### Fixed
- Banner MFA aparecía después de activar MFA (estado no se recuperaba al recargar).
- "Probar otro método" enviaba email automáticamente en lugar de mostrar selección.
- Códigos de recuperación se regeneraban innecesariamente al activar segundo método MFA.
- Errores de compilación TypeScript para deploy en Digital Ocean.

## [0.2.0] - 2026-04-16

### Added
- Autenticación Multi-Factor (MFA) con email y TOTP (Google Authenticator, Authy).
- Soporte para ambos métodos MFA simultáneos con método predeterminado configurable.
- Códigos de recuperación de un solo uso (8 códigos formato XXXXX-XXXXX).
- Pantalla de verificación MFA durante login con opción de cambiar método.
- Gestión MFA completa desde perfil: activar, desactivar, regenerar códigos.
- Banner recomendando activar MFA para usuarios sin MFA activo.
- Duración de sesión diferenciada: 2 días sin MFA, 5 días con MFA.
- Política de contraseña reforzada: mínimo 12 caracteres + carácter especial.
- Indicador visual de fortaleza de contraseña en tiempo real.
- Panel admin de gestión de usuarios con paginación, búsqueda, estado MFA y plan.
- Desactivación de MFA por admin para recuperación de cuentas.
- Exportación de usuarios a Excel (.xlsx).
- Emails MFA multiidioma (español/inglés).
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
- Rate limiting en login (10 intentos/IP/minuto).
- Account lockout (15 minutos tras 5 intentos fallidos).

## [0.1.0] - 2026-04-16

### Added
- Release inicial de DiagramaHub.
- Creación y edición de diagramas Mermaid y PlantUML.
- Gestión de proyectos y carpetas.
- Integración AI multi-proveedor (Gemini, OpenAI, Claude, DeepSeek).
- Chat AI para refinamiento iterativo de diagramas.
- Compartir diagramas con enlaces públicos/protegidos.
- Sistema de suscripciones con Stripe.
- Internacionalización español/inglés.
