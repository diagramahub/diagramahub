# Bienvenido a DiagramaHub

¡Bienvenido a la documentación oficial del código base de **DiagramaHub**!

Esta documentación está construida con [MkDocs](https://squidfunk.github.io/mkdocs-material/) y está diseñada para ser la fuente principal de verdad de todos los desarrolladores del proyecto.

## ¿Qué es DiagramaHub?

DiagramaHub es una plataforma open-source para crear, organizar y exportar diagramas usando marcado de texto plano (Mermaid, PlantUML). Está orientada a desarrolladores y equipos que prefieren diagramar con texto.

## Funcionalidades principales

- **Texto a diagrama**: Soporte para Mermaid y PlantUML con renderizado en tiempo real.
- **Organización**: Proyectos, carpetas y navegación jerárquica.
- **Exportación flexible**: PNG, PDF y Markdown.
- **Generación con IA (BYOL)**: Crea y mejora diagramas con tu propia clave de LLM (Gemini, OpenAI, Claude, DeepSeek).
- **Chat de IA**: Sesiones de chat iterativas para refinar diagramas.
- **Historial de prompts**: Registro de todas las interacciones con IA.
- **Compartir diagramas**: Enlaces públicos protegidos con código de acceso.
- **Suscripciones y facturación**: Sistema de planes con integración Stripe.
- **Autenticación**: JWT con flujos de registro, login, reset de contraseña y eliminación de cuenta.
- **Onboarding**: Wizard de instalación inicial y onboarding para nuevos usuarios.
- **Modo presentación**: Visualización de diagramas a pantalla completa con anotaciones.
- **Multi-idioma**: Español (por defecto) e inglés.
- **Panel de administración**: Configuración de vendors de email e integraciones.
- **Self-hostable**: Despliegue completo vía Docker Compose.

## ¿Qué encontrarás aquí?

En estos manuales podrás descubrir:

* **Guía de Instalación:** Cómo desplegar DiagramaHub con el instalador automático o de forma manual.
* **Arquitectura:** Cómo se comunican el frontend y el backend.
* **Stack tecnológico:** Tecnologías, dependencias y herramientas del proyecto.

## Estructura principal del repositorio

```text
diagramahub/
├── frontend/               # App web en React 19 + TypeScript + Vite 7
├── backend/                # API REST con FastAPI + MongoDB (Beanie ODM)
├── deploy/                 # Configuraciones Docker Compose
│   ├── local-full/         # MongoDB 8 + Backend + Frontend
│   └── external-mongodb/   # Backend + Frontend (MongoDB externo)
├── docs/                   # Esta documentación (MkDocs Material)
├── install.sh              # Instalador interactivo de una línea
├── verify-installation.sh  # Script de verificación post-instalación
├── test-api.sh             # Script de pruebas de API
├── test-onboarding.sh      # Script de pruebas del flujo de onboarding
├── docker-compose.yml      # Symlink al modo de despliegue elegido
├── mkdocs.yml              # Configuración de MkDocs
├── INSTALL.md              # Guía detallada de instalación
├── STRIPE_QUICKSTART.md    # Guía rápida de configuración de Stripe
├── README.md               # Readme principal del proyecto
└── LICENSE                 # Apache License 2.0
```

## Stack tecnológico

### Backend

| Tecnología | Versión / Detalle |
|---|---|
| Python | 3.11+ |
| FastAPI | 0.115+ |
| MongoDB | 8 (vía Docker) |
| Beanie ODM | 1.27+ (Motor async driver) |
| Pydantic | v2 |
| Autenticación | JWT (python-jose) + BCrypt (passlib) |
| Pagos | Stripe SDK 11+ |
| Clientes IA | google-genai, httpx (OpenAI, Claude, DeepSeek) |
| Email | Resend (async) |
| Dependencias | Poetry 1.8+ |
| Linting | Ruff (line-length 100, target py311) |
| Formateo | Black (line-length 100, target py311) |
| Type checking | mypy |
| Testing | pytest + pytest-asyncio + pytest-cov + Hypothesis + Faker |

### Frontend

| Tecnología | Versión / Detalle |
|---|---|
| React | 19 |
| TypeScript | 5.9+ |
| Vite | 7 |
| TailwindCSS | v3 |
| React Router | v7 |
| Axios | Cliente HTTP con interceptores |
| i18next | Español (defecto) e inglés |
| Mermaid | 11+ |
| PlantUML | vía plantuml-encoder |
| Monaco Editor | Editor de código |
| react-markdown | Renderizado Markdown |
| ESLint | typescript-eslint |

### Infraestructura

| Aspecto | Detalle |
|---|---|
| Contenedores | Docker Compose |
| Modos de despliegue | `deploy/local-full/` y `deploy/external-mongodb/` |
| Hot reload (dev) | Backend: uvicorn `--reload`, Frontend: Vite HMR |
| Producción | Reverse proxy (Nginx/Traefik) recomendado para SSL |

## Puertos

| Servicio | Puerto |
|---|---|
| Frontend | 5173 |
| Backend | 5172 |
| MongoDB | 27017 (solo en modo local-full) |

## Módulos del backend

El backend sigue principios SOLID. Cada entidad vive en su propia carpeta bajo `backend/app/api/v1/`:

| Módulo | Descripción |
|---|---|
| `users/` | Autenticación, registro, gestión de contraseñas, eliminación de cuenta |
| `projects/` | CRUD de proyectos |
| `diagrams/` | CRUD de diagramas, servicio de corrección con IA, validación de sintaxis |
| `folders/` | CRUD de carpetas |
| `ai_providers/` | Configuración de proveedores IA, clientes LLM (Gemini, OpenAI, Claude, DeepSeek) |
| `chat_sessions/` | Gestión de sesiones de chat con IA |
| `subscriptions/` | Facturación Stripe, planes, webhooks, proveedores de pago |
| `shared_links/` | Compartir diagramas públicamente, rate limiting |
| `prompt_history/` | Historial de prompts de IA |
| `integrations/` | Configuración de vendors de email (admin) |

## Rutas del frontend

| Ruta | Descripción | Protegida |
|---|---|---|
| `/setup` | Wizard de instalación inicial | No |
| `/login` | Página de login | No |
| `/register` | Página de registro | No |
| `/forgot-password` | Recuperación de contraseña | No |
| `/reset-password` | Restablecer contraseña | No |
| `/shared/:token` | Diagrama compartido público | No |
| `/onboarding` | Wizard de onboarding | Sí |
| `/dashboard` | Dashboard del usuario | Sí |
| `/projects/:projectId` | Vista de proyecto | Sí |
| `/projects/:projectId/diagrams/:diagramId` | Editor de diagrama | Sí |
| `/profile` | Perfil del usuario | Sí |
| `/` | Redirect a `/dashboard` | — |

---

*Para servir esta documentación localmente:*
```bash
pip install mkdocs mkdocs-material
mkdocs serve
```
