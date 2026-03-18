# Guía de Instalación

Bienvenido a la guía de instalación de DiagramaHub. Hemos preparado herramientas para facilitar el despliegue de la aplicación tanto para entornos locales y desarrollo, como para un entorno productivo.

Nuestra herramienta recomendada y principal es el instalador `install.sh`, un script interactivo que se encarga de instalar los prerrequisitos, clonar el repositorio y configurar el proyecto por ti.

## Análisis del Instalador Automático (`install.sh`)

El archivo `install.sh` está diseñado para ofrecer una experiencia fluida desde la terminal (estilo "Siguiente, Siguiente"). Al ejecutarse de forma interactiva, realiza lo siguiente:

1. **Detección del Sistema Operativo:** Detecta automáticamente si estás en macOS, Ubuntu/Debian o CentOS/RHEL.
2. **Revisión e Instalación:** Comprueba si tienes instalados `git`, `docker` y `docker-compose`. Si no los tienes, ofrece instalarlos automáticamente.
3. **Clonación:** Descarga el repositorio de GitHub y lo ubica en `$HOME/diagramahub`.
4. **Seguridad y Variables:** Genera criptográficamente el `JWT_SECRET` y construye el archivo `.env` del backend para que no tengas que hacerlo manualmente.

Al final del proceso, el instalador te permitirá elegir entre dos modos principales.

---

### Ambiente 1: Desarrollo / Entorno Local (Local Full Stack) 🐳

Este nivel es el recomendado si quieres **conocer la aplicación**, **probar nuevas versiones** o **realizar desarrollo local rápido**.

**Aspectos clave:**
* Administra una base de datos **MongoDB** en un contenedor Docker asociado.
* Despliega el Backend (FastAPI).
* Despliega el Frontend (Vite/React).
* Todos los datos se guardan en un volumen persistente de Docker. No requiere herramientas externas.

**¿Qué ocurre a nivel interno?**
El instalador vinculará el orquestador principal a `deploy/local-full/docker-compose.yml`, que tiene los 3 servicios declarados.

---

### Ambiente 2: Productivo (External MongoDB) 🌐

Este ambiente está pensado para entornos de **Producción**. La mejor práctica en Kubernetes o la nube es separar la capa de base de datos de los contenedores de aplicación que no guardan estado.

**Aspectos clave:**
* **No inicializa el contenedor de MongoDB.**
* El script te solicitará tu cadena y URI de conexión externa (por ejemplo: MongoDB Atlas, Amazon DocumentDB, o una BD propia).
* Únicamente levanta el Backend y el Frontend en Docker, los cuales se comunican con tu base de datos cloud.
* Ideal porque descargas a Docker de la administración de respaldos y recuperación de tu base de datos principal.

**¿Qué ocurre a nivel interno?**
El instalador vinculará el orquestador principal a `deploy/external-mongodb/docker-compose.yml`, donde solo están el API y el Cliente.

---

## Ejecutar el "One Line Installer"

Si deseas utilizar la instalación rápida, abre una terminal en el servidor donde quieres instalar y corre uno de los siguientes comandos:

```bash
# Opción 1 (Vía curl)
bash <(curl -fsSL https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh)

# Opción 2 (Vía wget)
wget -qO- https://raw.githubusercontent.com/diagramahub/diagramahub/main/install.sh | bash
```

### Comandos Útiles post-instalación

Si utilizaste el instalador exitosamente, te ubicarás en la carpeta `$HOME/diagramahub`. Desde allí podrás ejecutar comandos nativos de Docker Compose:

* **Ver Logs generales:** `docker-compose logs -f`
* **Ver Logs por servicio:** `docker-compose logs -f backend` o `frontend`
* **Detener la granja de contenedores:** `docker-compose down`
* **Actualizar a la última versión:** 
  ```bash
  git pull
  docker-compose build
  docker-compose up -d
  ```

---

## Instalación Totalmente Manual (Para Desarrolladores)

Si eres un desarrollador, quieres aportar código al núcleo y requieres tener las herramientas arrancando fuera de Docker en tu propio puerto local:

1. **Estructura Base:**
   * Haz un `git clone` del repositorio oficial.
2. **Backend (Python / FastAPI):**
   * Ubícate en `backend/`.
   * Manejamos las dependencias con `Poetry` o directamente pip.
   * Crea una copia del archivo de ejemplo `.env.example` y nómbralo `.env`. Configura ahí tus secretos y URI local de Mongo.
   * Inicia el proceso de recarga en caliente según el motor ASGI de FastAPI (por ej: `uvicorn main:app --reload` o `fastapi dev`).
3. **Frontend (NodeJS / React):**
   * Ubícate en `frontend/` y ejecuta `npm install`, `yarn` o `bun install` según tu entorno.
   * Ajusta las variables si el puerto del API de desarrollo cambió.
   * Prende el servidor con `npm run dev` y visualiza la web.
