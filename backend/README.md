# Diagramahub Backend

FastAPI backend con MongoDB usando Beanie ODM, autenticación JWT y arquitectura modular siguiendo principios SOLID.

## Stack Tecnológico

- **FastAPI** 0.115+ - Framework web moderno y rápido
- **MongoDB** 7.0 - Base de datos NoSQL
- **Beanie** 1.30+ - ODM async para MongoDB
- **Pydantic** 2.12+ - Validación de datos
- **Poetry** 1.8+ - Gestión de dependencias
- **JWT** - Autenticación basada en tokens
- **BCrypt** - Hash de contraseñas

## Estructura del Proyecto

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── users/           # Módulo de usuarios
│   │           ├── routes.py     # Endpoints de la API
│   │           ├── schemas.py    # Modelos Pydantic
│   │           ├── services.py   # Lógica de negocio
│   │           ├── repository.py # Acceso a datos
│   │           └── interfaces.py # Contratos/Interfaces
│   ├── core/
│   │   ├── config.py            # Configuración
│   │   └── security.py          # JWT y passwords
│   └── main.py                  # Punto de entrada
├── Dockerfile
├── pyproject.toml
└── .env.template
```

## Instalación Local

### Con Poetry (Recomendado)

```bash
# Instalar Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Instalar dependencias
cd backend
poetry install

# Crear archivo .env
cp .env.template .env

# Editar .env y configurar JWT_SECRET
vim .env

# Ejecutar MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:8.0

# Ejecutar backend
poetry run uvicorn app.main:app --reload
```

### Con Docker Compose (Más fácil)

```bash
# Desde la raíz del proyecto
cp backend/.env.template backend/.env
docker-compose up --build
```

## Configuración

Todas las variables de entorno en `backend/.env`:

```env
# Proyecto
PROJECT_NAME=Diagramahub
VERSION=1.0.0

# MongoDB
MONGO_URI=mongodb://mongodb:27017
DATABASE_NAME=diagramahub

# Seguridad (CAMBIAR EN PRODUCCIÓN)
JWT_SECRET=your-super-secret-key-change-this-min-32-chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
```

## API Endpoints

### Health Check

```bash
# Root endpoint
curl http://localhost:8000/

# Health check
curl http://localhost:8000/health
```

### Autenticación

#### 1. Registro de Usuario

```bash
curl -X POST http://localhost:8000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123",
    "full_name": "John Doe"
  }'
```

**Respuesta:**
```json
{
  "id": "68e88e41ad13e0d748218caa",
  "email": "user@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "created_at": "2025-10-10T04:40:33.753000"
}
```

**Validaciones de contraseña:**
- Mínimo 8 caracteres
- Al menos 1 dígito
- Al menos 1 mayúscula
- Al menos 1 minúscula

#### 2. Login

```bash
curl -X POST http://localhost:8000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123"
  }'
```

**Respuesta:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

#### 3. Obtener Usuario Actual

```bash
TOKEN="your-jwt-token"
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Cambiar Contraseña (Autenticado)

```bash
TOKEN="your-jwt-token"
curl -X PUT http://localhost:8000/api/v1/users/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "Password123",
    "new_password": "NewPassword456"
  }'
```

#### 5. Solicitar Reset de Contraseña

```bash
curl -X POST http://localhost:8000/api/v1/users/reset-password-request \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

**Nota:** En desarrollo, el token se retorna en la respuesta. En producción, se enviará por email.

#### 6. Confirmar Reset de Contraseña

```bash
curl -X POST http://localhost:8000/api/v1/users/reset-password-confirm \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "token": "reset-token-from-email",
    "new_password": "NewPassword789"
  }'
```

## Documentación Interactiva

Una vez corriendo el backend, accede a:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Arquitectura y Principios SOLID

### Single Responsibility Principle (SRP)
Cada archivo tiene una única responsabilidad:
- `routes.py` - Manejo de peticiones HTTP
- `schemas.py` - Validación de datos
- `services.py` - Lógica de negocio
- `repository.py` - Acceso a datos

### Open/Closed Principle (OCP)
El código está abierto para extensión pero cerrado para modificación mediante interfaces.

### Liskov Substitution Principle (LSP)
Las implementaciones pueden ser sustituidas por sus interfaces.

### Interface Segregation Principle (ISP)
Interfaces específicas en lugar de interfaces generales.

### Dependency Inversion Principle (DIP)
Los servicios dependen de interfaces (`IUserRepository`), no de implementaciones concretas.

## Testing

```bash
# Instalar dependencias de desarrollo
poetry install --with dev

# Ejecutar tests
poetry run pytest

# Con coverage
poetry run pytest --cov=app tests/
```

## Desarrollo

### Formateo de código

```bash
# Black
poetry run black app/

# Ruff
poetry run ruff check app/
```

### Type checking

```bash
poetry run mypy app/
```

## Docker

### Build manual

```bash
docker build -t diagramahub-backend .
```

### Run manual

```bash
docker run -p 8000:8000 \
  -e JWT_SECRET="your-secret" \
  -e MONGO_URI="mongodb://host.docker.internal:27017" \
  diagramahub-backend
```

## Seguridad

### JWT Secret
En producción, genera un secret seguro:

```python
import secrets
print(secrets.token_urlsafe(32))
```

### Password Hashing
Usamos bcrypt con salt automático. Las contraseñas nunca se almacenan en texto plano.

### CORS
Configura `BACKEND_CORS_ORIGINS` solo con los orígenes necesarios en producción.

## Licencia

Apache License 2.0
