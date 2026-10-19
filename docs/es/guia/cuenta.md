# Tu cuenta y seguridad

La configuración de tu cuenta está repartida en tres lugares de la barra lateral:

| Sección | Qué contiene |
|---|---|
| **Perfil** (Mi Perfil) | Información personal, contraseña, autenticación de dos factores y cuentas vinculadas. |
| **Ajustes** | Integraciones de IA y la zona de peligro (eliminar la cuenta). |
| **Suscripción** | Tu plan, el uso de recursos y la facturación. |

## Idioma y tema

En la barra lateral:

- **Idioma**: cambia entre español e inglés. Esto también define el idioma en que responde el [asistente de IA](ia.md).
- **Cambiar tema**: alterna entre **Modo claro** y **Modo oscuro**.

Ambas preferencias se guardan **en tu navegador**: si entras desde otro equipo, tendrás que elegirlas de nuevo.

## Información personal

En **Mi Perfil → Información Personal** puedes cambiar:

- **Foto de Perfil**: JPG, PNG o GIF de hasta 2 MB.
- **Nombre Completo**.
- **Zona Horaria**: se usa para mostrar fechas y horas.

El **correo electrónico no se puede cambiar**.

## Contraseña

Para cambiarla, ve a **Mi Perfil → Seguridad → Cambiar contraseña**. Necesitas tu contraseña actual. La nueva contraseña debe tener:

- [x] al menos 12 caracteres;
- [x] al menos una letra mayúscula y una minúscula;
- [x] al menos un número;
- [x] al menos un carácter especial (`! @ # $ % ^ & * ( ) _ + - = [ ] { } | ; : ' , . < > ? / ~`);
- [x] un valor distinto de tu correo electrónico.

!!! info "Cambiar la contraseña cierra tus otras sesiones"
    Las sesiones que tenías abiertas en otros navegadores o dispositivos dejan de ser válidas y tendrás que iniciar sesión de nuevo en ellas.

**¿Olvidaste tu contraseña?** En la pantalla de inicio de sesión, pide un enlace de recuperación. Llega a tu correo si la dirección está registrada. Esto requiere que el operador haya configurado el envío de correos.

### Bloqueo por intentos fallidos

Después de **5 intentos fallidos** de inicio de sesión, la cuenta se bloquea durante **15 minutos**.

## Autenticación de dos factores (MFA)

La MFA agrega un segundo paso al iniciar sesión. Puedes activar uno o los dos métodos desde **Mi Perfil → Autenticación de Dos Factores (MFA)**:

=== "Aplicación autenticadora (TOTP)"

    1. Pulsa **Habilitar aplicación autenticadora**.
    2. Escanea el código QR con una app como Google Authenticator o Authy. Si no puedes escanearlo, escribe la **Clave secreta** a mano.
    3. Escribe el código de 6 dígitos que muestra la app y pulsa **Verificar y activar**.

=== "Código por correo"

    1. Pulsa **Habilitar MFA por email**.
    2. Usa **Enviar código de verificación** y escribe el código de 6 dígitos que llega a tu correo.

    Cada código vence a los **10 minutos**. Al iniciar sesión puedes pedir hasta **3 reenvíos**, con una espera de 60 segundos entre cada uno. Este método solo está disponible si el operador configuró el envío de correos.

Si activas los dos métodos, elige cuál usar por defecto con **Método predeterminado**. Al iniciar sesión también puedes **Probar otro método**.

### Códigos de recuperación

Al activar la MFA recibes **8 códigos de recuperación**. Úsalos si pierdes acceso a tu método principal: cada código sirve **una sola vez**.

!!! warning "Los códigos solo se muestran una vez"
    Cópialos (**Copiar todos**) y guárdalos en un lugar seguro, como un gestor de contraseñas. Si los pierdes o se agotan, usa **Regenerar códigos de recuperación**: los códigos anteriores dejan de funcionar.

Para desactivar un método necesitas tu contraseña actual.

### Duración de la sesión

| Cómo iniciaste sesión | Duración |
|---|---|
| Correo y contraseña, sin MFA | 2 días |
| Correo y contraseña, con MFA | 5 días |
| Google | 5 días |

## Iniciar sesión con Google

Si el operador activó Google como proveedor, las pantallas de inicio de sesión y registro muestran **Iniciar sesión con Google**.

- Si ya tenías una cuenta con el mismo correo, Google **se vincula** a esa cuenta automáticamente.
- Al entrar con Google, DiagramaHub no pide su propio segundo factor: la verificación queda a cargo de tu cuenta de Google.
- Las cuentas externas vinculadas aparecen en **Mi Perfil → Cuentas Vinculadas**.
- Si tu cuenta solo usa Google y quieres entrar también con correo y contraseña, usa **Crear contraseña por correo**.

## Suscripción

En **Suscripción** (Mi Suscripción) ves:

- tu **Plan Actual** y su estado;
- el **Uso de Recursos**: cuántos proyectos y diagramas usas frente al límite de tu plan;
- los **Planes Disponibles**, si quieres **Cambiar Plan**.

Los planes, sus límites y sus precios los define el operador de la instancia. Todas las cuentas empiezan en el plan gratuito. Si la instancia tiene pagos configurados, también verás:

- **Cambiar método de pago** e **Historial de Facturación**;
- **Cancelar Suscripción**, con dos opciones:

| Opción | Qué pasa |
|---|---|
| **Al final del período** (recomendado) | Conservas tu plan hasta la fecha de corte y luego pasas al plan gratuito. |
| **Inmediatamente** | Pasas al plan gratuito en ese momento, sin reembolso por el tiempo restante. |

## Eliminar tu cuenta

En **Ajustes → Zona de peligro**, usa **Eliminar mi cuenta** y escribe `elimíname` para confirmar.

Se eliminan de forma **permanente** tus proyectos, diagramas, carpetas, tu configuración de IA y tu suscripción, y tu historial de prompts.

!!! danger "Antes de eliminar"
    - Si tienes un plan de pago, primero cambia al plan gratuito.
    - Si eres el **único administrador** de la instancia, no puedes eliminar tu cuenta desde la aplicación.
    - [Exporta tus proyectos](exportar-importar.md#exportar-un-proyecto-o-una-carpeta) si quieres conservar una copia.

Para más detalles técnicos sobre estos mecanismos, consulta [Autenticación](../seguridad/autenticacion.md).
