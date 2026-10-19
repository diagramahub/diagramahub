# Preguntas frecuentes

## Uso

??? question "¿Qué lenguajes de diagrama soporta?"
    Mermaid, PlantUML, D2 y DBML, además del pizarrón a mano alzada. Mermaid se dibuja en tu
    navegador; PlantUML, D2 y DBML los dibuja el servicio Kroki que corre dentro de la misma
    instalación. Ver [Tipos de diagrama](guia/tipos-de-diagrama.md).

??? question "¿Puedo pasar un diagrama de un lenguaje a otro?"
    Sí, con la conversión asistida por IA del editor, que muestra el resultado lado a lado antes
    de aplicarlo. Necesitas un proveedor de IA configurado. Ver [El editor](guia/editor.md).

??? question "¿Cómo saco mis diagramas de DiagramaHub?"
    Cada diagrama se exporta a PNG, SVG, PDF o Markdown, y un proyecto o una carpeta completos se
    exportan como ZIP. También puedes importar ZIP, archivos de diagrama y dibujos de Excalidraw.
    Ver [Exportar e importar](guia/exportar-importar.md).

??? question "¿Quién puede ver un diagrama que comparto?"
    Quien tenga el enlace; si el enlace es protegido, además necesita el código de acceso. Los
    enlaces pueden expirar a los 5, 10 o 30 días o no expirar, y puedes revocarlos. Ver
    [Compartir diagramas](guia/compartir.md).

## Inteligencia artificial

??? question "¿La IA tiene costo?"
    DiagramaHub no cobra ni revende IA: usas tu propia API key (BYOL) de Gemini, OpenAI, Claude,
    DeepSeek o MiniMax, y el consumo lo factura tu proveedor directamente.

??? question "¿Qué se envía al proveedor de IA y dónde se guarda mi API key?"
    Solo cuando usas una función de IA, el backend envía a tu proveedor la petición y el
    contexto del diagrama. La key se guarda cifrada en la base de datos y la API nunca la
    devuelve completa. Ver [Asistente de IA](guia/ia.md) y
    [Protecciones](seguridad/protecciones.md).

??? question "La IA devolvió un diagrama que no compila, ¿qué hago?"
    En Mermaid y D2 el chat valida el código y, si falla, pide al modelo que lo corrija
    (puedes desactivarlo en los ajustes de IA). Si la respuesta se cortó por largo, no se aplica
    y se te avisa. Ver [Asistente de IA](guia/ia.md).

## Cuenta

??? question "Olvidé mi contraseña"
    Pide un enlace de recuperación desde la pantalla de inicio de sesión. Requiere que el
    operador de la instancia haya configurado el envío de correos. Ver
    [Tu cuenta y seguridad](guia/cuenta.md).

??? question "Perdí mi teléfono con la app de autenticación"
    Entra con uno de tus códigos de recuperación (cada uno sirve una vez) o con el código por
    email si lo tienes activo. Si no tienes ninguno, un administrador de la instancia puede
    restablecer tu MFA. Ver [Tu cuenta y seguridad](guia/cuenta.md).

## Self-host

??? question "¿Instalarlo en mi servidor tiene costo?"
    No. El software es open-source bajo Apache 2.0. Los planes, límites y precios de tu
    instancia los defines tú; los pagos con Stripe son opcionales. Ver
    [Planes y límites](self-host/planes.md).

??? question "¿Qué necesito para instalarlo?"
    Docker con Docker Compose. Puedes usar el MongoDB que levanta la instalación o uno externo.
    Ver [Self-host](self-host/index.md) e [Instalación](instalacion.md).

??? question "¿Cómo actualizo a una versión nueva?"
    Respalda la base de datos, lee las [notas de versión](release-notes/index.md) y sigue
    [Mantenimiento y actualización](self-host/mantenimiento.md).

??? question "Algo no funciona en mi instalación"
    Revisa [Solución de problemas](self-host/problemas.md). Si es un bug, abre un issue en
    [GitHub](https://github.com/diagramahub/diagramahub/issues); si es una vulnerabilidad,
    repórtala en privado como indica [Seguridad](seguridad/index.md).
