# API Keys

Las **API keys** conectan DiagramaHub con tus scripts, tu CI o tus propias herramientas, sin usar tu contraseña. Con una llave puedes consultar tus proyectos y diagramas, cambiar su código y su descripción, publicarlos en la Comunidad o retirarlos, y compartirlos con un enlace o dejar de compartirlos. Cada llave solo puede hacer lo que le permitas.

Se administran desde **API Keys** en el menú lateral, que tiene dos pestañas: **Tus llaves**, para crearlas y revocarlas, y **Documentación**, con la URL base, ejemplos listos para copiar (cURL, JavaScript y Python) y la referencia de lo que cada llave puede llamar.

## Contexto para agentes de IA

En **Documentación**, **Copiar para IA** copia toda la documentación en Markdown para pegársela a un agente como Claude o Codex: URL base, autenticación, permisos, errores, tareas comunes con ejemplos, todos los endpoints y notas de uso (por ejemplo, que confirme contigo antes de borrar o de hacer público algo). **Descargar .md** guarda el mismo documento, útil para dejarlo en un repositorio como contexto del agente. No incluye ninguna llave: el agente la lee de la variable de entorno `DIAGRAMAHUB_API_KEY`.

## Crear una llave

1. Usa **Nueva API key**.
2. Ponle un **nombre** que diga dónde la usarás (por ejemplo, «CI de documentación») y una **vigencia**: 30, 90 o 365 días, o sin vencimiento.
3. Elige los **permisos** por área (abajo). **Solo lectura** y **Lectura y escritura** las configuran de un clic; cualquier otra combinación queda como **Personalizado**.
4. **Copia la llave en ese momento**: solo se muestra una vez (se guarda únicamente su huella SHA-256). La ventana trae una primera llamada lista para probarla.

## Permisos

Cada área tiene su propio nivel: **Ninguno**, **Lectura** o **Escritura** (escritura incluye lectura).

| Área | Lectura | Escritura |
|---|---|---|
| **Proyectos** | Listar y ver proyectos y carpetas; exportar un proyecto | Crear, renombrar y borrar proyectos y carpetas |
| **Diagramas** | Ver diagramas, los recientes y buscar en su contenido | Crear diagramas; cambiar título, código, descripción o carpeta; moverlos, duplicarlos y borrarlos |
| **Compartir** | Ver el enlace activo de un diagrama | Compartir (crear un enlace), cambiarlo y dejar de compartir (revocarlo) |
| **Comunidad** | Ver tus publicaciones y explorar la Comunidad | Hacer público (publicar), cambiar categoría, etiquetas y comentarios, hacer privado (retirar); dar estrella, comentar y hacer fork |
| **IA** | — | **Usar**: corregir y convertir diagramas con tus proveedores de IA (consume tu cuota) |

- La IA viene apagada en los preajustes: actívala solo si la llave la necesita.
- **Importar** un proyecto requiere escritura en Proyectos y en Diagramas, y **hacer fork** requiere escritura en Comunidad y en Diagramas.
- **Ver un proyecto o una carpeta**, **exportar un proyecto**, **compartir** (crear un enlace), **hacer público** y **corregir con IA** también requieren lectura en Diagramas, porque exponen el código de los diagramas. Al crear la llave se avisa si falta.
- Ninguna llave llega a tu cuenta, tu seguridad (contraseña, MFA), tus ajustes de IA, el chat con IA, las propias llaves ni a la administración: eso siempre requiere iniciar sesión.

## Usarla

Envía la llave en la cabecera `Authorization` a la URL base de tu instancia (la página **API Keys** la muestra con un botón para copiarla):

```bash
export DIAGRAMAHUB_API_KEY="dh_pat_..."
curl -H "Authorization: Bearer $DIAGRAMAHUB_API_KEY" https://tu-instancia/api/v1/projects
```

Por ejemplo, para hacer público un diagrama:

```bash
curl -X POST https://tu-instancia/api/v1/community/diagrams \
  -H "Authorization: Bearer $DIAGRAMAHUB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"diagram_id": "DIAGRAM_ID", "category": "architecture", "tags": ["api"]}'
```

Si una llave no tiene el permiso que la ruta necesita, la respuesta es `403` y dice qué le falta:

```json
{"detail": {"error": "api_key_permission", "message": "This API key needs write access to projects", "needs": {"projects": "write"}}}
```

Una llave vencida, revocada o desconocida recibe `401`. La lista de llaves muestra cuándo se usó cada una por última vez. Más detalles en la [API REST](../desarrollo/api.md#api-keys-api_tokens).

## Revocar

Usa **Revocar** en una llave que ya no uses o que pudo filtrarse: deja de funcionar de inmediato. Al eliminar tu cuenta se borran todas tus llaves. Crear y revocar llaves queda en el [registro de auditoría](../seguridad/auditoria.md).
