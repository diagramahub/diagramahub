# Planes y límites

En DiagramaHub los planes son **datos**, no código: cada operador decide qué planes ofrece,
cuántos proyectos y diagramas permite cada uno y cuánto cobra (o si no cobra nada). No hay
funciones exclusivas de un plan: todos los planes dan acceso a todas las funciones y solo
cambian los límites.

## El modelo `Plan`

Los planes viven en la colección `plans` de MongoDB.

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | texto (1–50) | Nombre visible. Único. |
| `code` | texto (1–30) | Código único en mayúsculas, dígitos, `_` o `-` (p. ej. `TEAM`). `FREE` está reservado. |
| `description` | texto (≤500) | Descripción opcional. |
| `max_projects` | entero | Máximo de proyectos. `-1` o vacío = ilimitado. |
| `max_diagrams` | entero | Máximo de diagramas. `-1` o vacío = ilimitado. Solo cuenta los **privados**, salvo con `public_diagrams_count` (ver [Diagramas públicos](#diagramas-publicos)). |
| `public_diagrams_count` | booleano | `true`: los diagramas publicados en la Comunidad también cuentan para `max_diagrams`. Por defecto `false`. |
| `max_public_diagrams` | entero | Máximo de diagramas publicados. `-1` o vacío = ilimitado (por defecto). |
| `prices` | diccionario | Precio mensual por moneda, p. ej. `{"usd": 4, "mxn": 70}`. Vacío = gratis. |
| `is_active` | booleano | Un plan inactivo deja de ofrecerse, pero sus suscriptores lo conservan. |
| `gateway_config` | objeto | IDs de producto y precio en Stripe; se llena solo al sincronizar. |

Monedas admitidas: `usd`, `eur`, `gbp`, `mxn` y `brl`.

## El plan gratuito (`FREE`)

- Se crea automáticamente con el **primer registro de un usuario no administrador**, con
  nombre `Gratuito`, 1 proyecto y 10 diagramas.
- Todo usuario nuevo recibe una suscripción a `FREE`, también al registrarse con Google.
- No se puede eliminar, desactivar ni cambiar su código. Sí puedes editar su nombre,
  descripción y límites.

Si la base de datos viene de una versión sin planes, crea el plan y asigna `FREE` a los
usuarios existentes con los scripts del backend (ambos son idempotentes):

```bash
docker exec -it diagramahub-backend python -m scripts.create_free_plan
docker exec -it diagramahub-backend python -m scripts.migrate_users_to_subscriptions --dry-run
docker exec -it diagramahub-backend python -m scripts.migrate_users_to_subscriptions
```

## Administradores

Los administradores no tienen límites: el control de uso los deja crear proyectos y
diagramas sin restricción y no reciben una suscripción.

## Crear y editar planes

Abre **Administración → Planes** (ruta `/admin/plans`).

```mermaid
flowchart TD
    N[Nuevo plan] --> P{¿Precio > 0?}
    P -->|No| G[Plan gratuito<br/>solo en MongoDB]
    P -->|Sí| S{¿Stripe activo?}
    S -->|No| E[Error: se requiere<br/>una vinculación con Stripe]
    S -->|Sí| C[Se crea el producto y el precio<br/>en Stripe y se guardan sus IDs]
    C --> M[Agregar precios en<br/>otras monedas]
```

Reglas que aplica el servidor:

- Un plan de pago necesita una pasarela Stripe activa ([Integraciones](integraciones.md#pagos-stripe)).
  Al crearlo, DiagramaHub crea el producto y el precio en Stripe.
- El precio en USD es el principal. Las demás monedas se agregan después, una vez que el
  plan está sincronizado con Stripe.
- **No se puede cambiar el precio de un plan con suscriptores activos.** Crea un plan nuevo
  y desactiva el anterior.
- Cambiar nombre, descripción o precio de un plan de pago lo vuelve a sincronizar con Stripe.
- Al eliminar un plan **con** suscriptores, solo se desactiva (y se archiva en Stripe); los
  suscriptores lo conservan. **Sin** suscriptores, se archiva en Stripe y se borra.

## Cómo se aplican los límites

Los límites se comprueban **en el servidor** antes de crear un proyecto o un diagrama,
incluidos los que llegan por importación. Al alcanzar el límite, la API responde `403` y la
interfaz ofrece cambiar de plan. El cliente nunca decide si algo está permitido.

```mermaid
sequenceDiagram
    participant U as Usuario
    participant API as Backend
    participant L as Control de uso
    U->>API: Crear diagrama
    API->>L: ¿Dentro del límite del plan?
    alt admin o límite -1
        L-->>API: Permitido
    else uso < límite
        L-->>API: Permitido
    else uso ≥ límite
        L-->>API: Rechazado
        API-->>U: 403 límite alcanzado
    end
```

Cada usuario consulta su uso en `GET /api/v1/subscriptions/usage`.

## Diagramas públicos

Por defecto, un diagrama **publicado en la [Comunidad](../guia/comunidad.md)** no ocupa lugar en el límite de diagramas: el límite cuenta solo los privados. Es la forma de crecer sin pagar a cambio de compartir: quien publica todo puede usar la plataforma sin llegar al tope, y quien quiere privacidad necesita un plan con más lugar. Cada plan lo decide con dos campos (en **Administración → Planes**):

- **Los diagramas publicados también cuentan para el límite** (`public_diagrams_count`): apagado por defecto. Encendido, cuentan todos.
- **Diagramas públicos** (`max_public_diagrams`): un tope opcional de publicaciones; ilimitado por defecto.

Reglas que aplica el servidor:

- Todo diagrama nace privado: crear, duplicar, hacer fork o importar ocupa un lugar.
- **Publicar libera un lugar**, y **retirar una publicación** requiere lugar para un privado más. Si no lo hay, la API responde `403` con `resource_type: "private_diagrams"` y la interfaz desactiva **Retirar de la Comunidad** explicando por qué.
- Una publicación **oculta por moderación** cuenta como privada: solo queda exento lo que otros pueden ver. Si un diagrama publicado se borra, su publicación ya no ocupa lugar.
- **Sobre el límite.** Un usuario puede quedar por encima del límite sin haber hecho nada: si baja de plan, si vence su suscripción, si un administrador retira o la moderación oculta una de sus publicaciones, o si bajas el límite del plan. Nunca se borra ni se bloquea nada: puede editar, borrar y publicar, pero no crear diagramas privados ni retirar publicaciones hasta volver dentro del límite.
- Para que la Comunidad no se use como almacenamiento gratis, publicar requiere un diagrama que dibuje algo (no vacío y que se pueda renderizar), con como máximo 100 000 caracteres de código, y hay un tope de publicaciones por usuario cada 24 horas ([`COMMUNITY_MAX_PUBLICATIONS_PER_DAY`](configuracion.md#comunidad), 20 por defecto). Los administradores no tienen ese tope.

`GET /api/v1/subscriptions/usage` devuelve en `diagrams` el uso que cuenta (`current`), el límite, los publicados visibles (`public`), si cuentan (`public_counts`) y el tope de públicos (`public_limit`).

## Instancia sin cobros

Si no conectas Stripe, todos los usuarios usan planes gratuitos. Para una instancia interna
sin límites, edita `FREE` y pon `-1` en proyectos y diagramas.
