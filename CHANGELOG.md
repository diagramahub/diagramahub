# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

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
