# Diagramahub Frontend

React + TypeScript + Vite + TailwindCSS frontend con autenticación JWT completa.

## Stack Tecnológico

- **React 18** - Biblioteca UI
- **TypeScript** - Tipos estáticos
- **Vite** - Build tool ultrarrápido
- **TailwindCSS** - Framework CSS utility-first
- **React Router 7** - Enrutamiento
- **Axios** - Cliente HTTP con interceptores
- **Context API** - Estado global de autenticación

## Rutas Implementadas

| Ruta | Descripción | Protegida |
|------|-------------|-----------|
| `/` | Redirect al dashboard | No |
| `/login` | Página de login | No |
| `/register` | Página de registro | No |
| `/dashboard` | Dashboard del usuario | **Sí** |

## Instalación Local

```bash
cd frontend
npm install
cp .env.template .env
npm run dev
```

Accede a: http://localhost:5173

## Docker

```bash
docker-compose up frontend
```

## Variables de Entorno

```env
VITE_API_URL=http://localhost:8000
```

## Licencia

Apache License 2.0
