# Bienvenido a DiagramaHub

¡Bienvenido a la documentación oficial del código base de **DiagramaHub**!

Esta documentación está construida con [MkDocs](https://squidfunk.github.io/mkdocs-material/) y está diseñada para ser la fuente principal de verdad de todos los desarrolladores del proyecto.

## ¿Qué encontrarás aquí?

En estos manuales podrás descubrir:

* **Arquitectura:** Cómo se comunican el frontend y el backend.
* **Guía de Desarrollo Local:** Cómo configurar las bases de datos externas y ejecutar el proyecto por primera vez.
* **Flujos de Trabajo:** Cómo desplegar cambios y contribuir al repositorio.

## Estructura principal del repositorio

Nuestro código base sigue un esquema de _monorepositorio_ separado por dominios:

```text
diagramahub/
├── frontend/           # App web en React
├── backend/            # API REST e integraciones   
├── docs/               # Esta mismísima documentación
└── deploy/             # Archivos y configuración de infraestructura
```

---

*Para probar esta página, ejecuta en tu terminal:*
```bash
mkdocs serve
```
