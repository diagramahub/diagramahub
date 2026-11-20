# Usuarios

En **Administración → Usuarios** ves todas las cuentas de tu instalación: su plan, su uso, su seguridad y su estado. Desde ahí puedes bloquear o eliminar una cuenta y revisar sus pagos. Solo la ven los usuarios con rol `admin`.

## La lista

| Columna | Qué muestra |
|---|---|
| **Usuario** | Nombre, correo y la marca **Admin** si lo es. |
| **Plan** | El plan de su suscripción activa (o **Sin plan**) y la marca **De pago** cuando paga un plan con precio a través del proveedor de pagos. |
| **Uso** | Proyectos y diagramas. |
| **Seguridad** | Si tiene MFA y con qué métodos. |
| **Último acceso** | Su último inicio de sesión. |
| **Estado** | **Activo** o **Bloqueado**. |

Puedes buscar por nombre o correo, filtrar por **Todos**, **Activos** o **Bloqueados** y descargar la lista completa en Excel. En el móvil la tabla muestra solo usuario, plan y estado; el resto está en el detalle.

## El detalle de un usuario

Al elegir un usuario se abre un panel lateral con dos pestañas:

- **Resumen**: rol, plan, fecha de registro y último acceso; proyectos y diagramas por tipo; los modelos de IA que conectó; su MFA (con **Desactivar MFA**, para quien perdió acceso a sus factores); y la **Zona de riesgo** con bloquear y eliminar.
- **Pagos**: el plan actual, desde cuándo está suscrito y su siguiente cobro, el total pagado por moneda, las facturas del proveedor de pagos (con enlace a cada una) y el historial de suscripciones. Sin un proveedor de pagos configurado se ven las suscripciones, pero no las facturas.

No puedes bloquear ni eliminar tu propia cuenta desde aquí: para eliminarla usa tu perfil. Así siempre queda al menos un administrador activo.

## Bloquear y desbloquear

**Bloquear** impide el acceso sin borrar nada:

- No puede iniciar sesión, ni con contraseña ni con Google; ve el aviso «Tu cuenta está bloqueada».
- Sus sesiones abiertas terminan en su siguiente acción, y sus [API keys](../guia/api-keys.md) dejan de funcionar.
- Sus datos, publicaciones y suscripción se conservan. **Bloquear no cancela una suscripción de pago**: el diálogo lo advierte si la tiene.
- Puedes anotar un motivo (opcional); solo lo ven los administradores, junto con quién bloqueó la cuenta y cuándo.

**Desbloquear** devuelve el acceso de inmediato, y sus API keys vuelven a funcionar si no vencieron.

## Eliminar

**Eliminar** borra la cuenta y todos sus datos: proyectos, carpetas, diagramas, publicaciones en la Comunidad, API keys, configuración de IA, historial de prompts y suscripciones. No se puede deshacer, y para confirmarlo tienes que escribir el correo del usuario.

Si tiene una suscripción de pago activa, primero se cancela de inmediato en el proveedor de pagos. Si esa cancelación falla, o si no hay un proveedor de pagos configurado, **no se elimina nada**: borrar la cuenta mientras el proveedor sigue cobrando sería peor.

## Auditoría

Bloquear, desbloquear y eliminar quedan en el [registro de auditoría](../seguridad/auditoria.md) (`admin_user_blocked`, `admin_user_unblocked`, `admin_user_deleted`) con el administrador que lo hizo, el motivo del bloqueo y, al eliminar, la suscripción cancelada.
