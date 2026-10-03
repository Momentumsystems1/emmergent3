# QUEDADA — especificación canónica de Juan (CEO), 2026-10-03

Texto literal condensado de la orden ("vamos a tomar notas para que recuerdes… haz esto y estaremos cerca").
Este documento es memoria canónica del proyecto: lo que aquí figura es lo acordado.

## Flujo de la herramienta «Quedar»

1. **Entrada**: clic en «Quedar» en el panel de herramientas.
2. **Pantalla dividida en vertical** (el largo del teléfono): mitad arriba / mitad abajo.
   - Arriba: el mapa de siempre, a la mitad de tamaño.
   - Abajo: tarjeta con el prompt para escribir el nombre de un restaurante, gasolinera,
     farmacia, calle o lo que sea.
   - La tarjeta es como todas las de la app: **negra con efecto crystal** y su título es
     el de la herramienta: **«Quedar»**.
3. **Comportamiento al mover el mapa**: si el usuario se pone a buscar por el mapa, la tarjeta
   **se esconde** mientras se mueve (más visibilidad). Al dejar de moverse, la tarjeta
   **vuelve con slide con velocidad y un toque de efecto física** (rebote).
4. **Tap en el mapa**: se apunta al **establecimiento más cercano** al toque del dedo.
   Si es una **calle con número**, se apunta a esa calle y número, y en el prompt se le dice
   si es correcto o quiere afinar.
5. **Cuando el sitio está definido**: se abre **calendario y hora** + **personas del grupo** a
   invitar, con atajos: **Todos / Más cercanos / Manual**.
6. **Nombre de la quedada**: lo pone a mano el usuario.
7. **Al enviar**:
   - Los círculos de avatar del grupo muestran un **circulito rojo con un número** (empieza en 1)
     = número de eventos pendientes. Por cada evento se suma.
   - Al tocar el círculo de un miembro se ve **que tiene este u otro evento, de tal a tal hora**,
     **pero NO con quién ni para qué**.
   - Los detalles solo se ven **si ese usuario comparte su agenda contigo**.
   - El evento que **tú has enviado lo ves siempre**, y queda **pendiente de confirmar** por
     cada miembro.

## Notas de implementación (CTO)

- Privacidad de agenda en servidor: los miembros ven franjas horarias de eventos ajenos,
  nunca detalles, salvo permiso de agenda compartida. Los eventos propios/enviados, siempre visibles.
- Estilo de tarjeta: coherente con el sistema (BlurCard/efecto cristal negro), título «Quedar».
- Animación de retorno de tarjeta: slide con rebote (física) al parar el mapa.
- Puntos de interés: snap al establecimiento más cercano al toque (Places cercano / reverse).
