# Registro de auditoría

DiagramaHub guarda los eventos de seguridad de cada cuenta en un registro de auditoría dentro de MongoDB. Sirve para investigar incidentes (intentos de acceso, cambios de contraseña, uso de códigos de recuperación) y para cumplir controles de monitoreo como SOC 2 CC7.2.

## Almacenamiento y retención

| Aspecto | Valor |
|---|---|
| Colección | `audit_log` |
| Retención | **90 días**: un índice TTL sobre `timestamp` borra las entradas automáticamente |
| Índices | `user_email`, `event`, `timestamp` (TTL) |
| Escritura | Solo el backend agrega entradas; ninguna API las modifica ni las borra |

Si una escritura del registro falla, el error se anota en los logs del servidor y la operación del usuario continúa: el registro nunca bloquea un inicio de sesión.

### Campos de cada entrada

| Campo | Descripción |
|---|---|
| `timestamp` | Fecha y hora UTC del evento |
| `event` | Tipo de evento (ver tabla siguiente) |
| `user_email` | Correo de la cuenta involucrada |
| `user_id` | ID del usuario, si se conoce |
| `ip_address` | IP de origen, en los eventos de login con contraseña |
| `details` | Contexto adicional (por ejemplo, el método MFA o el proveedor OAuth) |

## Eventos registrados

| Evento | Cuándo se registra |
|---|---|
| `login_success` | Correo y contraseña correctos (si la cuenta tiene MFA, se registra antes del segundo factor) |
| `login_failed` | Contraseña incorrecta o usuario inexistente; también se registra (con `details: mfa_max_attempts`) cuando se agotan los códigos MFA de un inicio de sesión |
| `login_locked` | La cuenta se bloqueó por fallos consecutivos |
| `login_mfa_verified` | Segundo factor verificado (`details` incluye el método) |
| `mfa_recovery_used` | Se completó el login con un código de recuperación |
| `mfa_enabled` | El usuario activó TOTP o email como factor |
| `mfa_disabled` | El usuario desactivó un método MFA |
| `admin_mfa_reset` | Un administrador restableció el MFA de un usuario |
| `password_changed` | El usuario cambió su contraseña desde el perfil |
| `password_reset_requested` | Se solicitó un correo de restablecimiento |
| `password_reset_confirmed` | Se restableció la contraseña con el enlace del correo |
| `oauth_login_success` | Login correcto con un proveedor OAuth |
| `oauth_login_failed` | Falló un login OAuth (por ejemplo, correo no verificado o validación del token) |
| `oauth_account_linked` | Una cuenta existente se vinculó a un proveedor OAuth |
| `account_deleted` | El usuario eliminó su cuenta |

## Consultar el registro

La aplicación todavía **no tiene una vista** del registro de auditoría: lo consulta quien opera la instancia, con acceso directo a MongoDB.

```bash
docker exec -it diagramahub-mongodb mongosh diagramahub
```

```javascript
// Últimos 20 eventos de una cuenta
db.audit_log.find({ user_email: "persona@ejemplo.com" })
  .sort({ timestamp: -1 }).limit(20)

// Bloqueos de cuenta de las últimas 24 horas
db.audit_log.find({
  event: "login_locked",
  timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
})

// Conteo por tipo de evento
db.audit_log.aggregate([{ $group: { _id: "$event", total: { $sum: 1 } } }])
```

!!! warning "Datos personales"
    El registro contiene correos e IPs. Limita el acceso a MongoDB a quien opera la instancia y trata sus exportaciones como información sensible.

Si necesitas conservar eventos más de 90 días (por ejemplo, por una política de cumplimiento), expórtalos periódicamente a tu sistema de logs antes de que venzan.
