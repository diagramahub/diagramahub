# Development

Everything you need to work on the DiagramaHub codebase: how it is built, how to run the environment, how to test and how to ship a release.

<div class="grid cards" markdown>

-   :material-sitemap: **Architecture**

    ---

    Services, data flow, diagram rendering and the AI chat flow.

    [:octicons-arrow-right-24: See architecture](architecture.md)

-   :material-language-python: **Backend**

    ---

    FastAPI + MongoDB: the 12 modules, the layered pattern and configuration.

    [:octicons-arrow-right-24: See backend](backend.md)

-   :material-react: **Frontend**

    ---

    React 19 + Vite: routes, contexts, API layer, i18n and design system.

    [:octicons-arrow-right-24: See frontend](frontend.md)

-   :material-api: **REST API**

    ---

    Conventions, authentication, errors and the endpoint map.

    [:octicons-arrow-right-24: See API](api.md)

-   :material-test-tube: **Testing**

    ---

    pytest in Docker, coverage floor, Vitest and the AI benchmark.

    [:octicons-arrow-right-24: See testing](testing.md)

-   :material-puzzle: **Extending DiagramaHub**

    ---

    New modules, AI providers, pages and UI text.

    [:octicons-arrow-right-24: See the guide](extending.md)

-   :material-tag: **Versioning and releases**

    ---

    SemVer, `release/<V>` branches and the version check.

    [:octicons-arrow-right-24: See versioning](versioning.md)

-   :material-source-pull: **Contributing**

    ---

    PR flow, code style and how to report issues.

    [:octicons-arrow-right-24: See how to contribute](contributing.md)

</div>

## Running the development environment

Everything runs in Docker Compose: you don't need Python or Node on your machine to use the app (you do need Node to run `pnpm` or Vitest outside the container).

```bash
git clone https://github.com/diagramahub/diagramahub.git
cd diagramahub

# Backend variables (JWT_SECRET at minimum)
cp backend/.env.example backend/.env

# The root docker-compose.yml is a symlink to the deployment mode
ln -sf deploy/local-full/docker-compose.yml docker-compose.yml

docker-compose up -d --build
```

| Service | Container | URL / port | In development |
|---|---|---|---|
| Frontend | `diagramahub-frontend` | <http://localhost:5173> | Vite dev server with HMR (`development` stage of the Dockerfile) |
| Backend | `diagramahub-backend` | <http://localhost:5172> | Uvicorn with hot reload |
| Swagger / ReDoc | — | <http://localhost:5172/docs> · `/redoc` | Outside production only |
| Kroki | `diagramahub-kroki` | internal | Renders PlantUML, D2 and DBML |
| MongoDB | `diagramahub-mongodb` | `27017` | Persistent volume (`local-full` mode) |

!!! tip "First run"
    The first time you open the frontend, the setup wizard (`/setup`) creates the administrator account. See [Installation](../installation.md).

Common commands:

```bash
docker-compose logs -f backend          # backend logs
docker exec -it diagramahub-backend bash
docker exec -it diagramahub-mongodb mongosh
docker-compose build frontend --no-cache
```

!!! note "Frontend package manager"
    The frontend uses **pnpm** (`packageManager: pnpm@9.15.9` in `frontend/package.json`, lockfile `pnpm-lock.yaml`). Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`.
