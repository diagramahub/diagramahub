# Pizarrón a mano alzada

El tipo **Mano Alzada** es un pizarrón libre para pensar sin sintaxis: dibuja formas, flechas, texto, trazos, notas adhesivas e imágenes con un aspecto hecho a mano. Cuando la idea madura, conviértela en un diagrama Mermaid con un clic.

Para crear uno, elige **Mano Alzada** como **Tipo de diagrama** al crear un diagrama. El pizarrón se guarda automáticamente, igual que cualquier otro diagrama.

## Herramientas

| Herramienta | Atajo | Uso |
|---|---|---|
| **Seleccionar** | ++v++ | Selecciona, mueve, redimensiona y rota elementos |
| **Mano** | ++h++ | Mueve el lienzo |
| **Rectángulo** | ++r++ | Caja |
| **Rombo** | ++d++ | Decisión |
| **Elipse** | ++o++ | Círculo u óvalo |
| **Flecha** | ++a++ | Flecha; si la sueltas sobre una forma, queda conectada a ella |
| **Línea** | ++l++ | Línea sin punta |
| **Texto** | ++t++ | Texto libre |
| **Nota adhesiva** | ++n++ | Post-it de color; un clic la coloca, arrastrar le da tamaño |
| **Mano alzada** | ++p++ | Trazo libre, sensible a la presión del lápiz |
| **Borrador** | ++e++ | Borra elementos |
| **Imagen** | — | Inserta imágenes desde tu equipo (ver [Imágenes](#imagenes)) |

!!! tip "Texto rápido"
    Haz doble clic en una forma (o selecciónala y pulsa ++enter++) para escribir dentro de ella, o doble clic en un espacio vacío (con **Seleccionar**) para crear un texto. ++enter++ confirma y ++esc++ cancela; ++shift+enter++ agrega un salto de línea. El texto de las formas se acomoda en varias líneas dentro de ellas.

Las flechas conectadas siguen a las formas, notas e imágenes cuando las mueves o rotas.

## Notas adhesivas

La herramienta **Nota adhesiva** (++n++) crea post-its como en Miro: un clic coloca una nota de 200 × 200 y arrastrar la dibuja del tamaño que quieras. Al crearla queda lista para escribir. El texto se ajusta solo al tamaño de la nota: se achica a medida que escribes más. Hay seis colores en **Color de la nota**, y las flechas se pueden conectar a las notas como a cualquier forma.

## Imágenes

Inserta imágenes PNG, JPEG, WebP o GIF de tres formas:

- **Pegar** una imagen copiada (++ctrl+v++ / ++cmd+v++): aparece bajo el cursor.
- **Arrastrar y soltar** archivos sobre el lienzo.
- El botón **Imagen** de la barra de herramientas.

Antes de subirla, el navegador reduce la imagen a 2048 px como máximo y la vuelve a comprimir, lo que también elimina sus metadatos (por ejemplo, la ubicación GPS de una foto). Las imágenes se guardan aparte del dibujo, conservan su proporción al cambiarles el tamaño, admiten flechas conectadas y aparecen en la exportación PNG, la vista compartida, el modo incrustado y las presentaciones. SVG no se admite.

!!! note "Límites"
    Cada imagen puede pesar hasta 3 MB después de comprimirla, y un pizarrón admite hasta 100 imágenes (el operador de una instalación propia puede cambiar ambos valores). Las imágenes que ya no se usan se liberan solas cuando hace falta espacio.

## Estilo de los elementos

Con uno o varios elementos seleccionados, el panel **Estilo del elemento** te deja ajustar:

| Opción | Valores |
|---|---|
| **Trazo** y **Relleno** | Color del borde y del interior (o **Sin relleno**) |
| **Grosor** | Ancho del trazo |
| **Estilo de trazo** | **Limpio**, **Arquitecto**, **Artista**, **Caricatura** |
| **Estilo de relleno** | **Sólido**, **Rayado**, **Cruzado** |
| **Fuente** | **Manuscrita**, **Normal**, **Código**; y **Tamaño de fuente** |
| Líneas y flechas | **Línea discontinua**, **Flecha inicial**, **Flecha final** |
| Formas | **Esquinas redondeadas** |

El aspecto «hecho a mano» se dibuja con [Rough.js](https://roughjs.com/) y es estable: un elemento no cambia de forma cada vez que se redibuja.

## Organizar elementos

- **Duplicar**, **Agrupar** / **Desagrupar**.
- Orden: **Traer al frente**, **Traer adelante**, **Enviar atrás**, **Enviar al fondo**.
- Alineación (izquierda, centro, derecha, arriba, medio, abajo) y **Distribuir horizontalmente** / **verticalmente**.
- Guías de alineación al mover elementos.
- Menú contextual con clic derecho.
- **Limpiar todo** borra el pizarrón (se puede deshacer).

## Bloquear elementos

**Bloquear** fija los elementos seleccionados para no moverlos por accidente (también con ++ctrl+shift+l++ / ++cmd+shift+l++ o desde el menú contextual). Un elemento bloqueado no se puede arrastrar, redimensionar, rotar, mover con flechas, alinear, cambiar de estilo, cortar ni borrar hasta que pulses **Desbloquear**.

## Navegar por el lienzo

| Acción | Cómo |
|---|---|
| Mover el lienzo | Rueda del ratón (++shift++ + rueda para moverlo de lado), herramienta **Mano**, mantener ++space++ y arrastrar, o clic central |
| Zoom | ++ctrl++ / ++cmd++ + rueda o pellizcar en el trackpad (centrado en el cursor), o los botones de zoom |
| Ajustar al contenido | ++f++ |

La posición y el zoom del pizarrón se guardan con el diagrama, sin contar como una edición.

### Pantallas táctiles y lápiz

En tabletas y pantallas táctiles, un dedo dibuja con la herramienta activa (con **Seleccionar**, arrastrar sobre un espacio vacío mueve el lienzo), dos dedos mueven el lienzo y hacen zoom al pellizcar, y un doble toque equivale al doble clic. El lápiz es sensible a la presión. Un trazo o un arrastre que sale del lienzo no se pierde.

## Atajos de teclado

| Atajo | Acción |
|---|---|
| ++ctrl+z++ / ++cmd+z++ | Deshacer |
| ++ctrl+shift+z++ o ++ctrl+y++ | Rehacer |
| ++ctrl+a++ | Seleccionar todo |
| ++ctrl+c++ / ++ctrl+x++ / ++ctrl+v++ | Copiar / cortar / pegar con el portapapeles del sistema: se pega en la posición del cursor y funciona entre diagramas y pestañas. Un texto copiado de otra aplicación se pega como texto |
| ++enter++ | Escribir en la forma, nota o texto seleccionado |
| ++ctrl+d++ | Duplicar |
| ++ctrl+g++ / ++ctrl+shift+g++ | Agrupar / desagrupar |
| ++ctrl+shift+l++ | Bloquear / desbloquear |
| ++delete++ o ++backspace++ | Borrar la selección |
| Flechas (++shift++ = 10 px) | Mover la selección |
| ++esc++ | Quitar la selección y volver a **Seleccionar** |
| ++f++ | Ajustar al contenido |

En macOS usa ++cmd++ en lugar de ++ctrl++.

## Exportar el pizarrón

Desde **Exportar Diagrama**, los pizarrones se exportan como **PNG** con resolución **Pantalla (1x)**, **Estándar (2x)** o **Alta (3x)** y la opción **Fondo transparente**. La imagen abarca todo el contenido dibujado (incluidos elementos rotados); en lienzos muy grandes la escala se reduce automáticamente para no exceder los límites del navegador, sin recortar nada.

También puedes **Descargar código fuente** como archivo `.freehand.json`, que se puede volver a importar (sin las imágenes, que se guardan aparte del dibujo). Los archivos de Excalidraw (`.excalidraw`) se importan como pizarrones. Consulta [Exportar e importar](exportar-importar.md).

## Boceto → Mermaid

En un pizarrón, el menú **Convertir tipo de diagrama** ofrece **Boceto → Mermaid**, que crea un **diagrama Mermaid nuevo** (el pizarrón no se modifica). La conversión es determinista y **no usa IA**:

```mermaid
flowchart LR
    R[Rectángulo con texto] --> N1["Nodo [ ]"]
    D[Rombo con texto] --> N2["Nodo { }"]
    E[Elipse con texto] --> N3["Nodo ( )"]
    F[Flecha conectada a dos formas] --> L[Relación]
```

| En el pizarrón | En Mermaid |
|---|---|
| Rectángulo / rombo / elipse con texto | Nodo `[ ]` / `{ }` / `( )` |
| Nota adhesiva con texto | Nodo con forma de bandera `> ]` |
| Flecha conectada a dos formas | Relación `-->` (el texto de la flecha es la etiqueta) |
| Flecha discontinua | `-.->` |
| Flecha con dos puntas | `<-->` |
| Línea sin punta | `---` |
| Flecha que sale y llega a la misma forma | Relación consigo misma |

!!! note "Lo que se omite"
    Los trazos a mano alzada, los textos sueltos, las imágenes, las flechas sin conectar y las formas sin texto no tienen equivalente estructural: se omiten y DiagramaHub te dice cuántos de cada tipo quedaron fuera.
