# Guía de Instalación

Bienvenido a la guía de instalación de DiagramaHub. Hemos preparado herramientas para facilitar el despliegue de la aplicación tanto para entornos locales y desarrollo, como para un entorno productivo.

Nuestra herramienta recomendada y principal es el instalador `install.sh`, un script interactivo que se encarga de instalar los prerrequisitos, clonar el repositorio y configurar el proyecto por ti.

## Análisis del Instalador Automático (`install.sh`)

El archivo `install.sh` está diseñado para ofrecer una experiencia fluida desde la terminal (estilo "Siguiente, Siguiente"). Al ejecutarse de forma interactiva, realiza lo siguiente:

1. **Detección del Sistema Operativo:** Detecta automáticamente si estás en macOS, Ubuntu/Debian, CentOS/RHEL o Fedora.
2. **Revisión e Instalación:** Comprueba si tienes instalados `git`, `docker` y `docker compose`. Si no los tienes, ofrece instalarlos automáticamente.
3. **Clonación:** Descarga el repositorio de GitHub y lo ubica en `$HOME/diagramahub`.
4. **Configuración de MongoDB:** Wizard interactivo para elegir entre MongoDB local (Docker) o MongoDB externo (Atlas, DocumentDB, etc.).
5. **Seguridad y Variables:** Genera criptográficamente el `JWT_SECRET` (32 bytes, base64) y construye el archivo `backend/.env` automáticamente.
6. **Docker Compose:** Crea un symlink de `docker-compose.yml` al modo de despliegue elegido.
7. **Build y arranque:** Construye las imágenes Docker y levanta los servicios.
8. **Verificación:** Espera 15 segundos y verifica que todos los servicios estén corriendo.

---

### Ambiente 1: Desarrollo / Entorno Local (Local Full Stack) 🐳

Este nivel es el recomendado si quieres **conocer la aplicación**, **probar nuevas versiones** o **realizar desarrollo local rápido**.

**Aspectos clave:**

* Administra una base de datos **MongoDB 8** en un contenedor Docker con volumen persistente.
* Despliega el Backend (FastAPI en puerto 5172).
* Despliega el Frontend (Vite/React en puerto 5173).
* Hot reload habilitado: backend vía uvicorn `--reload`, frontend vía Vite HMR.
* Todos los datos se guardan en un volumen persistente de Docker (`mongodb_data`).

**¿Qué ocurre a nivel interno?**

El instalador vincula el orquestador principal a `deploy/local-full/docker-compose.yml`, que tiene los 3 servicios declarados: `mongodb`, `backend` y `frontend`.

---

### Ambiente 2: Productivo (External MongoDB) 🌐

Este ambiente está pensado para entornos de **Producción**. La mejor práctica en Kubernetes o la nube es separar la capa de base de datos de los contenedores de aplicación.

**Aspectos clave:**

* **No inicializa el contenedor de MongoDB.**
* El script te solicitará tu cadena y URI de conexión externa (por ejemplo: MongoDB Atlas, Amazon DocumentDB, o una BD propia).
* Únicamente levanta el Backend y el Frontend en Docker, los cuales se comunican con tu base de datos cloud.
* Ideal porque descargas a Docker de la administración de respaldos y recuperación de tu base de datos principal.

**¿Qué ocurre a nivel interno?**

El instalador vincula el orquestador principal a `deploy/external-mongodb/docker-compose.yml`, donde solo están el API y el Cliente.

---

## Ejecutar el "One Line Installer"

Si deseas utilizar la instalación rápida, abre una terminal en el servidor donde quieres instalar y corre uno de los siguientes comandos:

```bash
# Opción 1 (Vía curl)
bash <(curl -fsSL https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh)

# Opción 2 (Vía wget)
wget -qO- https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh | bash
```

---

## Instalación Manual

Si prefieres instalar manualmente, asegúrate de tener:

- **Docker** (20.10 o superior)
- **Docker Compose** (2.0 o superior)
- **Git**

### 1. Clonar el repositorio

```bash
git clone https://github.com/alexdzul/diagramahub.git
cd diagramahub
```

### 2. Configurar variables de entorno

Crea el archivo `backend/.env` a partir del ejemplo:

```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` y configura al menos:

```env
# MongoDB
MONGO_URI=mongodb://mongodb:27017          # Para MongoDB local (Docker)
# MONGO_URI=mongodb+srv://<db-user>:<db-password>@cluster.mongodb.net/  # Para MongoDB externo
DATABASE_NAME=diagramahub

# JWT (genera un secret seguro)
JWT_SECRET=tu-secret-seguro-aqui-minimo-32-caracteres
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API
API_V1_PREFIX=/api/v1

# CORS (orígenes permitidos, separados por coma)
BACKEND_CORS_ORIGINS=http://localhost:5173

# Entorno
APP_ENV=development

# Frontend URL (para redirects de Stripe)
FRONTEND_URL=http://localhost:5173
```

Para generar un JWT secret seguro:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Para generar una clave de encriptación de IA (opcional):

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Elegir modo de despliegue

```bash
# Para MongoDB local (desarrollo):
ln -sf deploy/local-full/docker-compose.yml docker-compose.yml

# Para MongoDB externo (producción):
ln -sf deploy/external-mongodb/docker-compose.yml docker-compose.yml
```

> **Nota:** `docker-compose.yml` está en `.gitignore` para que tu elección local no interfiera con actualizaciones.

### 4. Construir y arrancar

```bash
docker-compose up -d --build
```

---

## Verificar la instalación

### Script de verificación automática

El proyecto incluye un script que verifica que todos los servicios estén corriendo:

```bash
bash verify-installation.sh
```

### Verificación manual

```bash
# Estado de los servicios
docker-compose ps

# Probar el backend
curl http://localhost:5172/

# Probar el health check
curl http://localhost:5172/health

# Acceder a la documentación de la API
# Swagger UI: http://localhost:5172/docs
# ReDoc: http://localhost:5172/redoc

# Acceder al frontend
# http://localhost:5173
```

### Scripts de prueba

```bash
# Pruebas de API (registro, login, password reset, etc.)
bash test-api.sh

# Pruebas del flujo de onboarding
bash test-onboarding.sh
```

---

## Comandos útiles post-instalación

Todo se ejecuta vía Docker Compose. No se usa Poetry ni npm directamente en la máquina host.

```bash
# Ver logs generales
docker-compose logs -f

# Ver logs por servicio
docker-compose logs -f backend
docker-compose logs -f frontend

# Detener servicios
docker-compose down

# Reiniciar servicios
docker-compose restart

# Actualizar a la última versión
git pull
docker-compose build
docker-compose up -d
```

### Comandos del backend (dentro del contenedor)

```bash
# Tests con coverage
docker exec diagramahub-backend poetry run pytest

# Tests sin coverage (más rápido)
docker exec diagramahub-backend poetry run pytest --no-cov

# Tests por marker
docker exec diagramahub-backend poetry run pytest -m unit
docker exec diagramahub-backend poetry run pytest -m integration
docker exec diagramahub-backend poetry run pytest -m property

# Detener en primer fallo
docker exec diagramahub-backend poetry run pytest -x

# Formateo
docker exec diagramahub-backend poetry run black app/

# Lint
docker exec diagramahub-backend poetry run ruff check app/

# Type check
docker exec diagramahub-backend poetry run mypy app/

# Shell interactivo
docker exec -it diagramahub-backend bash
```

---

## Acceso a la aplicación

| Servicio | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| Backend API | http://localhost:5172 |
| Swagger UI | http://localhost:5172/docs |
| ReDoc | http://localhost:5172/redoc |
| MongoDB | localhost:27017 (solo modo local) |

---

## Primer uso

1. Abre http://localhost:5173 — verás el **wizard de instalación** (`/setup`) si es la primera vez.
2. Crea tu **cuenta de administrador** siguiendo el wizard.
3. Completa el **onboarding** donde se creará tu primer proyecto automáticamente.
4. Empieza a crear diagramas con Mermaid o PlantUML.
5. (Opcional) Configura **integraciones de IA** en tu perfil para generar diagramas con IA.
6. (Opcional) Configura **Stripe** para habilitar suscripciones — consulta `STRIPE_QUICKSTART.md`.

---

## Despliegue en producción

Para entornos de producción, se recomienda usar un reverse proxy como **Nginx** o **Traefik** para manejar SSL (HTTPS) y servir la aplicación en puertos estándar (80/443).

### Ejemplo con Nginx (enfoque subdominio)

```nginx
# Frontend
server {
    listen 80;
    server_name diagramahub.tudominio.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 80;
    server_name api.diagramahub.tudominio.com;

    location / {
        proxy_pass http://localhost:5172;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **Importante:** Si usas el enfoque de subdominio, actualiza `VITE_API_URL` en el frontend y `BACKEND_CORS_ORIGINS` en `backend/.env` para permitir peticiones cross-origin entre tus dominios.

### SSL con Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d diagramahub.tudominio.com -d api.diagramahub.tudominio.com
```

### Consideraciones de seguridad

- **JWT_SECRET**: Usa un string aleatorio fuerte de al menos 32 caracteres.
- **AI_ENCRYPTION_KEY**: Genera una clave Fernet para encriptar las API keys de IA almacenadas.
- **MongoDB**: Si usas MongoDB local, asegúrate de que el puerto 27017 **NO** esté expuesto a internet (usa firewall).
- **CORS**: Configura `BACKEND_CORS_ORIGINS` solo con los orígenes necesarios.
- **Backups**: Respalda regularmente el volumen `mongodb_data`.

---

## Troubleshooting

### MongoDB no conecta

```bash
# Verificar si el contenedor está corriendo
docker-compose ps mongodb

# Ver logs de MongoDB
docker-compose logs mongodb

# Reiniciar MongoDB
docker-compose restart mongodb
```

### Puerto en uso

```bash
# Encontrar proceso usando el puerto
lsof -i :5172
lsof -i :5173

# Matar el proceso
kill -9 <PID>
```

### Backend no arranca

```bash
docker-compose logs backend
docker-compose build backend --no-cache
docker-compose restart backend
```

### Frontend muestra página en blanco

```bash
docker-compose logs frontend
docker-compose build frontend --no-cache
docker-compose restart frontend
```

---

## Limpieza

```bash
# Detener y eliminar contenedores, redes y volúmenes
docker-compose down -v
```

⚠️ **Advertencia**: Esto eliminará todos los datos en MongoDB local.

```bash
# Eliminar imágenes Docker
docker rmi diagramahub-backend diagramahub-frontend
```
