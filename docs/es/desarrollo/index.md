# Desarrollo

Todo lo necesario para trabajar en el código de DiagramaHub: cómo está construido, cómo levantar el entorno, cómo probar y cómo publicar una versión.

<div class="grid cards" markdown>

-   :material-sitemap: **Arquitectura**

    ---

    Servicios, flujo de datos, render de diagramas y el flujo del chat de IA.

    [:octicons-arrow-right-24: Ver arquitectura](arquitectura.md)

-   :material-language-python: **Backend**

    ---

    FastAPI + MongoDB: los 12 módulos, el patrón por capas y la configuración.

    [:octicons-arrow-right-24: Ver backend](backend.md)

-   :material-react: **Frontend**

    ---

    React 19 + Vite: rutas, contextos, capa de API, i18n y design system.

    [:octicons-arrow-right-24: Ver frontend](frontend.md)

-   :material-api: **API REST**

    ---

    Convenciones, autenticación, errores y el mapa de endpoints.

    [:octicons-arrow-right-24: Ver API](api.md)

-   :material-test-tube: **Pruebas**

    ---

    pytest en Docker, piso de cobertura, Vitest y el benchmark de IA.

    [:octicons-arrow-right-24: Ver pruebas](pruebas.md)

-   :material-puzzle: **Extender DiagramaHub**

    ---

    Nuevos módulos, proveedores de IA, páginas y textos.

    [:octicons-arrow-right-24: Ver guía](extender.md)

-   :material-tag: **Versionado y releases**

    ---

    SemVer, ramas `release/<V>` y el check de versión.

    [:octicons-arrow-right-24: Ver versionado](versionado.md)

-   :material-source-pull: **Contribuir**

    ---

    Flujo de PR, estilo de código y cómo reportar problemas.

    [:octicons-arrow-right-24: Ver cómo contribuir](contribuir.md)

</div>

## Levantar el entorno de desarrollo

Todo corre en Docker Compose: no necesitas Python ni Node en tu máquina para usar la app (sí Node si quieres correr `pnpm` o Vitest fuera del contenedor).

```bash
git clone https://github.com/diagramahub/diagramahub.git
cd diagramahub

# Variables del backend (como mínimo, JWT_SECRET)
cp backend/.env.example backend/.env

# El docker-compose.yml de la raíz es un symlink al modo de despliegue
ln -sf deploy/local-full/docker-compose.yml docker-compose.yml

docker-compose up -d --build
```

| Servicio | Contenedor | URL / puerto | En desarrollo |
|---|---|---|---|
| Frontend | `diagramahub-frontend` | <http://localhost:5173> | Vite dev server con HMR (etapa `development` del Dockerfile) |
| Backend | `diagramahub-backend` | <http://localhost:5172> | Uvicorn con recarga en caliente |
| Swagger / ReDoc | — | <http://localhost:5172/docs> · `/redoc` | Solo fuera de producción |
| Kroki | `diagramahub-kroki` | interno | Render de PlantUML, D2 y DBML |
| MongoDB | `diagramahub-mongodb` | `27017` | Volumen persistente (modo `local-full`) |

!!! tip "La primera vez"
    Al abrir el frontend por primera vez te recibe el asistente de instalación (`/setup`), que crea la cuenta de administrador. Ver [Instalación](../instalacion.md).

Comandos frecuentes:

```bash
docker-compose logs -f backend          # logs del backend
docker exec -it diagramahub-backend bash
docker exec -it diagramahub-mongodb mongosh
docker-compose build frontend --no-cache
```

!!! note "Gestor de paquetes del frontend"
    El frontend usa **pnpm** (`packageManager: pnpm@9.15.9` en `frontend/package.json`, lockfile `pnpm-lock.yaml`). Los scripts son `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`.
