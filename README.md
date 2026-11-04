# Atlas Terrenos

Juego tipo Atlas Earth: compra parcelas reales del mapa mundial y paga con PayPal.
Cada parcela comprada muestra el nombre de su dueño y **no se puede volver a comprar**.

## Base de datos: Supabase (los datos ya no se pierden en Render)

Render borra el disco en cada reinicio/despliegue, así que los terrenos se guardan en Supabase (Postgres).

1. En https://supabase.com crea un proyecto.
2. Ve a **SQL Editor** > New query, pega el contenido de `schema.sql` y pulsa **Run**.
3. Ve a **Connect** (botón arriba) > **Connection string** > pestaña **Session pooler** y copia la URI
   (`postgresql://postgres.xxxx:[TU-PASSWORD]@aws-0-...pooler.supabase.com:5432/postgres`).
   Sustituye `[TU-PASSWORD]` por la contraseña de la base de datos. Usa el *pooler* porque Render
   no siempre soporta IPv6, que es lo que usa la conexión directa.
4. En Render > tu servicio > **Environment** añade la variable `DATABASE_URL` con esa URI
   (junto a `ADMIN_TOKEN`, `PAYPAL_CLIENT_ID`, etc.) y guarda: Render redespliega solo.
   Render ejecuta `npm install` en cada despliegue (instala `pg`).

Los terrenos que ya perdiste en Render no se pueden recuperar; a partir de ahora quedan guardados.

## Arrancar en local

    npm install
    DATABASE_URL="postgresql://..." node server.js   # modo DEMO (pago simulado)
    # abre http://localhost:3000

## Activar PayPal

1. En https://developer.paypal.com crea una app (primero en Sandbox) y copia Client ID y Secret.
2. Arranca así:

    PAYPAL_CLIENT_ID=xxx PAYPAL_SECRET=yyy PAYPAL_ENV=sandbox node server.js

3. Para cobrar de verdad usa las credenciales Live y `PAYPAL_ENV=live`.

Otras variables: `DATABASE_URL` (obligatoria), `ADMIN_TOKEN`, `PACKS` (packs a la venta, `créditos:precio` separados por comas; por defecto `50:1,150:2,300:3,500:4`; sustituye a `PRICE` y `PACK_SIZE`), `CURRENCY` (EUR), `PORT` (3000).

## Cómo funciona

- El mundo es una rejilla de parcelas de 0,001° (~111 m). Cada una tiene id `x:y` calculado desde lat/lng.
- Al pagar, el servidor reserva la parcela 10 min y crea el pedido en PayPal.
- Al aprobar, el servidor captura el pago, comprueba importe y moneda y guarda la parcela
  (clave primaria única en Postgres: imposible venderla dos veces). Si por una carrera extrema
  ya estaba vendida, se reembolsa automáticamente.
- El nombre del dueño se limpia en el servidor y se pinta con textContent (sin HTML).
- "Mi ubicación" usa la geolocalización del navegador; hay ranking de propietarios.

## Antes de publicarlo en internet

- Ponlo detrás de HTTPS (Caddy, nginx, Render, Railway...).
- Añade límite de peticiones y moderación de nombres si es público.
- Deja claro que son objetos virtuales sin valor legal sobre el suelo real y revisa
  las condiciones de PayPal para vender bienes digitales.

## Elegir casa

Cada terreno tiene una columna `house` (ruta de la imagen). Si está vacía se usa la casa "al azar" de siempre.
El dueño con cuenta puede cambiarla desde el panel del terreno (`POST /api/parcel/house`). Cuesta 1 crédito (variable `HOUSE_COST`; pon 0 para que sea gratis). Elegir la casa al reclamar es gratis.
El servidor añade la columna solo al arrancar (`migration-house.sql` es el mismo comando por si prefieres ejecutarlo a mano).
Para añadir casas nuevas, ponlas al FINAL de `HOUSES` en `app.js` y en `server.js` (así no cambian las casas al azar ya existentes).

## Niveles de terreno

Cada terreno tiene un nivel del 1 al 50 (columnas `level` y `level_at` de `parcels`; el servidor las crea solo al arrancar).
Subir de nivel cuesta créditos y multiplica lo que produce ese terreno (`POST /api/parcel/upgrade`, solo el dueño con cuenta).
Por defecto el multiplicador del nivel N es `1 + 0,5 × (N-1)` (nivel 2: ×1,5 · nivel 10: ×5,5 · nivel 50: ×25,5) y pasar del nivel N al N+1 cuesta `ceil(0,75 × N)` créditos (1, 2, 3, 3, 4, 5…).

La mejora cuenta desde el momento en que se compra (el tiempo anterior se paga con el multiplicador antiguo), así que subir de nivel justo antes de recoger no da créditos de más.
En el mapa se ve 1 a 5 estrellas (una por cada décima parte del camino) y el número de nivel junto al nombre, y el edificio es más alto.

Variables opcionales: `LEVEL_MAX` (niveles, por defecto 50), `LEVEL_STEP` (por defecto 0.5) y `LEVEL_COST_K` (por defecto 0.75).
Para control total: `LEVEL_MULTS` y `LEVEL_COSTS` como listas separadas por comas, que mandan sobre la fórmula (la longitud de `LEVEL_MULTS` es el nivel máximo; `LEVEL_COSTS` son los créditos para pasar al nivel 2, 3, 4…).
La producción base sigue siendo `PROD_RATE` (créditos por terreno y hora).

## Avisos al móvil y racha

Los avisos (push) necesitan `npm install` (paquete `web-push`) y estas variables en Render: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
(se crean con `npx web-push generate-vapid-keys`) y `VAPID_SUBJECT` (por ejemplo `mailto:tu@correo.com`). Sin ellas los avisos quedan desactivados y el botón 🔔 no aparece.
En iPhone solo funcionan si la app está instalada en la pantalla de inicio.

Avisos, por orden de prioridad: racha en peligro (desde las 18:00 hora del jugador), un terreno a punto de llenarse (2 h antes), producción lista y regalo diario.
Solo entre las 10:00 y las 21:00 del jugador, 6 h entre avisos (2 h para el de la racha) y se paran tras 3 avisos sin que vuelva a entrar.

Racha de 7 días: premios de cada día en `DAILY_REWARDS` (7 números separados por comas; por defecto `1,1,2,2,3,3,10`, el día 7 es el premio grande).

## Tráfico, peatones y helipuertos

- **Coches por la calzada, peatones por la acera.** El carril de cada vehículo y la acera de cada peatón se calculan a partir del ancho
  con el que el mapa dibuja la calle en ese zoom (`roadMetrics()` en `mapshim.js`; en modo satélite usa metros reales por tipo de calle).
  Los coches van por su carril derecho (las bicis y patinetes, junto al bordillo) y la gente camina justo fuera del bordillo.
  Por eso el tamaño de coches y personas también sigue al ancho de la calle (`sizes()`): al alejar el zoom se hacen más pequeños y siguen cabiendo en la calzada.
- **Helipuertos.** El mundo se divide en celdas de ~250 m (`PAD_CELL` en `vehicles.js`) y en una de cada tres hay un helipuerto
  (misma posición para todos los jugadores). Se coloca en el primer hueco libre de la celda: sin calle, edificio, agua ni parcela comprada
  (si alguien compra la parcela, el helipuerto desaparece). El helicóptero (cada 3 min, con zoom 16 o más) aterriza en el helipuerto
  más cercano al centro de la pantalla; si no hay ninguno a la vista, espera a que te acerques a uno. Para probarlo: `spawnAircraft('heli')` en la consola.

## Semáforos y pasos de peatones (`crossings.js`)

- En los cruces de 3 o más calles (zoom 16,5 o más; los 14 más cercanos al centro, 8 en móvil) hay un **paso de cebra** y una **línea de parada** en cada calle, y un **semáforo** por calle.
- Ciclo de 20 s: calles principales (verde 7 s, ámbar 2 s, rojo) y calles transversales desfasadas 10 s; entre fases hay 1 s de rojo para todos.
- **Coches**: frenan ante la línea de parada con rojo (y con ámbar si aún pueden parar) y hacen cola. Policía, bomberos y ambulancias no paran.
- **Peatones**: esperan en el bordillo y cruzan solo cuando los coches de esa calle tienen el rojo.

## Tren, vías y estaciones (`trains.js`)

- Las **vías** son las reales de OpenStreetMap (clase `rail`, sin túneles ni apartaderos); el mapa las dibuja con balasto y traviesas (`st-rail` en `app.js`). Solo hay tren donde hay vía real: prueba por ejemplo cerca de una estación grande de tu ciudad.
- Cada 60-80 s sale un tren (locomotora + 2 o 3 vagones) con zoom 16 o más. Para probarlo sin esperar: `spawnTrain()` en la consola.
- **Estaciones**: el mundo se divide en celdas de ~650 m y en 4 de cada 10 hay una estación junto a la vía (andén con marquesina; misma posición para todos los jugadores). El tren frena, abre puertas (luces amarillas), baja y sube gente, avisa y arranca.
- **Sonido** (Web Audio, respeta el botón 🔊): traqueteo según la velocidad, bocina al entrar y al salir, campana al llegar y pitidos antes de cerrar puertas. Botón 🚆 del menú para activar o desactivar el tren.
