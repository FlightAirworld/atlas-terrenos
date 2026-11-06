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

Presidente de pueblo: el jugador con cuenta que más terrenos tiene en un pueblo (Población) cobra `PRESIDENT_CREDITS` créditos al mes (por defecto 10; 0 lo desactiva). Cada pueblo paga una sola vez al mes. `PRESIDENT_MIN_PARCELS` (por defecto 1) fija los terrenos mínimos para ser presidente.

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
🏛️ **Ayuntamiento** (`images/ayuntamiento.webp`): casa especial, solo la puede poner en uno de sus terrenos el presidente del pueblo (el que más terrenos tiene allí) y solo hay uno por pueblo. No sale al azar ni se elige al reclamar. Al presidente que aún no lo ha puesto le sale un aviso con la imagen del ayuntamiento en el panel de terrenos (`GET /api/town/president/ayuntamiento`), con un botón para construirlo si el terreno está en su pueblo. Si otro jugador pasa a ser presidente y construye el suyo, el ayuntamiento anterior pasa a casa al azar.
**Edificios con función propia** (se construyen cambiando la casa de un terreno propio que ya tenga pueblo; cuestan `BUILDING_COST` créditos, 3 por defecto, y la fábrica 2 más):
- 🏦 Banco: ese terreno produce ×`BANCO_MULT` (1,25). Uno por jugador y pueblo.
- 🏭 Fábrica: produce ×`FABRICA_MULT` (2). Uno por jugador y pueblo.
- ⚓ Puerto: produce ×`PUERTO_MULT` (1,5). Uno por pueblo.
- 🏥 Hospital: da `HOSPITAL_PER_DAY` créditos al día (1), sumados a la producción y con el mismo tope de horas. Uno por jugador y pueblo.
- 🚒 Bomberos: `BOMBEROS_DISCOUNT` (0,2 = 20 %) de descuento al subir de nivel los terrenos del dueño en ese pueblo. Uno por jugador y pueblo.
El bonus cuenta desde el momento del cambio (columnas `house_at` y `house_prev` de `parcels`, que el servidor crea solo), igual que los niveles.
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

Avisos, por orden de prioridad: racha en peligro (desde las 18:00 hora del jugador), un terreno a punto de llenarse (2 h antes), producción lista, premio de presidente (una vez al mes, si es presidente de algún pueblo y aún no lo ha cobrado) y regalo diario.
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
- **Colores**: las calles del mapa son blancas, así que el paso de cebra y la línea de parada van en gris oscuro (`ZEBRA` en `crossings.js`) para que se vean.
- **Balizas de precaución**: cada paso de peatones lleva dos luces ámbar intermitentes (una en cada bordillo, parpadean alternadas; clase `.xg-c`). Con `prefers-reduced-motion` quedan fijas.

## Señales de tráfico (`signs.js`)

- Las señales no vienen en el mapa: se colocan por reglas junto a los cruces (zoom 16,5 o más; los 14 más cercanos al centro, 8 en móvil), al lado de la calle y no encima de la calzada.
- **Límite de velocidad**: 50 en calles principales, secundarias y terciarias; 30 en calles pequeñas y de servicio (`LIMIT`). Los coches nunca pasan de ese límite, se vea la señal o no.
- **Paso de peatones** (rombo amarillo): en los cruces con semáforo, antes del paso de cebra.
- **Stop y ceda el paso**: en los cruces sin semáforo, en la calle de menos categoría. El coche frena del todo ante el stop, espera ~1,3 s y arranca cuando nadie cruza; ante el ceda el paso baja la velocidad y solo para si viene alguien. Si no ve hueco en 9 s arranca igualmente (para no bloquear el tráfico).
- **Dirección prohibida**: en la boca de las calles de sentido único, si las teselas traen el dato `oneway`. Los coches no trazan rutas contra el sentido (`canGo` en `vehicles.js`); los peatones no se ven afectados.
- Policía, bomberos y ambulancias no obedecen las señales (igual que los semáforos).
- Enganche: `followLimit` (`vehicles.js`) llama a `Signs.check(v, scale, vehicles)`. `crossings.js` exporta `Xings.list()` y `Xings.near()`.

## Tren, vías y estaciones (`trains.js`)

- Las **vías** son las reales de OpenStreetMap (clase `rail`, sin túneles ni apartaderos); el mapa las dibuja con balasto y traviesas (`st-rail` en `app.js`). Solo hay tren donde hay vía real: prueba por ejemplo cerca de una estación grande de tu ciudad.
- Cada 60-80 s sale un tren (locomotora + 2 o 3 vagones) con zoom 16 o más. Para probarlo sin esperar: `spawnTrain()` en la consola.
- **Estaciones**: el mundo se divide en celdas de ~650 m y en 4 de cada 10 hay una estación junto a la vía (andén con marquesina; misma posición para todos los jugadores). El tren frena, abre puertas (luces amarillas), baja y sube gente, avisa y arranca.
- **Aspecto**: techo con sombreado curvo y franja de color, ventanas con reflejo, puertas, aires acondicionados, pantógrafo en la locomotora, morro aerodinámico con parabrisas y faros (con haz de luz), cabina y luces rojas en el último coche, fuelles entre coches y bogies asomando (`carSVG` en `trains.js`).
- **Sonido** (Web Audio, respeta el botón 🔊): traqueteo según la velocidad, bocina al entrar y al salir, campana al llegar y pitidos antes de cerrar puertas. Botón 🚆 del menú para activar o desactivar el tren.

## Aeropuerto (`vehicles.js`)

- Igual que los helipuertos, los aeropuertos están repartidos por el mundo en posiciones fijas (las mismas para todos los jugadores): celdas de ~1,1 km y en algo menos de la mitad hay uno
  (`AP_CELL`, `AP_RATE`). Se prueban hasta 8 sitios por celda y vale el primero cuyo recinto entero (340 × 130 m) esté libre de calles, edificios y agua; por eso salen en las afueras y
  descampados, no en el centro de una ciudad. Se ven con zoom 14,5 o más y desaparecen si alguien compra una parcela dentro del recinto. Los helipuertos no se colocan dentro de un aeropuerto.
- Cada aeropuerto tiene pista de 300 m (09/27, con umbrales, eje, luces de borde y números), dos calles de rodaje con línea amarilla, plataforma con puestos, terminal con pasarelas,
  torre de control, dos hangares, manga de viento y dos aviones aparcados.
- Cada ~100 s (`AP_EVERY`) un avión de línea aterriza de oeste a este, frena, sale por la calle de rodaje, llega a la plataforma, espera 14 s, retrocede, gira, rueda hasta la cabecera
  y despega hacia el oeste (ciclo de ~85 s, con sonido de reactor y las luces de la pista parpadeando). El tamaño del avión sigue al de la pista a cualquier zoom.
- Para probarlo en cualquier sitio, en la consola: `spawnAirport()` (pone un aeropuerto en el centro de la pantalla, sin mirar si hay calles debajo, y hace aterrizar un avión).
  Con un aeropuerto a la vista también vale `spawnAircraft('airliner')`.

## Plazas de las rotondas (`rotondas.js`)

- Las glorietas de las calles reales se detectan como anillos de calle (una calle cerrada, o varias unidas por los extremos) de ~5 a ~85 m de radio, bastante redondos. Las minirrotondas sin isleta no se tocan.
- En la isleta central se dibuja, al azar, una de estas decoraciones: **fuente con agua animada, estatua sobre pedestal, arboleda, palmeras, jardín de flores o monumento con setos** (`BUILD` en `rotondas.js`: para añadir una nueva, crea otra función ahí).
- "Al azar" sale de un hash de la posición del centro: cada rotonda tiene siempre la misma para todos los jugadores.
- Solo se pintan las 10 más cercanas al centro de la pantalla (6 en móvil) y con zoom >= 16,5. Cubre solo la isleta: los coches siguen rodeándola.

## Monumentos famosos (`monumentos.js`)

- 32 monumentos dibujados **a color** y **fijos** en su sitio real (mismas coordenadas para todos los jugadores, nada al azar): Sagrada Família (Barcelona), Alhambra, Giralda, Puerta de Alcalá, Palacio Real, Acueducto de Segovia, Mezquita de Córdoba, Torre de Hércules, Peñón de Gibraltar, Catedral de Santiago, Ciudad de las Artes, Guggenheim, Torre Eiffel, Coliseo, Big Ben, Estatua de la Libertad, Taj Mahal, Pirámides de Giza, Cristo Redentor, Torre de Pisa, Puerta de Brandeburgo, Ópera de Sídney, San Basilio, Partenón, Golden Gate, Burj Khalifa, Arco del Triunfo, Duomo de Milán, Atomium, Machu Picchu, Chichén Itzá y Torre de Belém.
- Cada dibujo es un SVG visto de frente con la **base clavada en su latitud/longitud**. Se ven con zoom >= 12, con un tamaño mínimo legible, y crecen con el mapa al acercarte. El nombre sale debajo con zoom >= 14,5.
- Al tocar un monumento sale una ficha (nombre, lugar y botón "Ir"). Solo el dibujo recibe el toque; el resto del terreno se compra como siempre.
- Botón 🏛️ del menú para ocultarlos o mostrarlos (se recuerda en el móvil).
- **Añadir uno nuevo:** crea su dibujo en `ART` (una función que devuelve el SVG dentro de su `viewBox`) y añade una línea a `LIST`: `[id, nombre, lugar, lat, lng, ancho en metros, [ancho, alto del viewBox]]`.
- Consola: `Monumentos.list()` y `Monumentos.goto('sagrada')` (vuela hasta él).

## Vida urbana (botón 🏙️ del menú)

`ciudad.js` añade todo lo que da densidad al mapa; se apaga con el botón 🏙️ si el móvil va justo. Los vehículos nuevos están en `vehicles.js`.

- **Humo y vapor:** chimeneas en algunas casas, vapor en bares/restaurantes y de alcantarilla en las calles.
- **Vehículos:** camión de la basura que va parando, furgonetas de reparto en doble fila con luces de emergencia, autobuses que paran en paradas y recogen gente, coche de autoescuela que se cala y tranvía por las calles con paradas.
- **Eventos:** boda con coches decorados (claxon), desfile o manifestación pequeña (frenan el tráfico) y ambulancia que sale de un hospital fijo del mundo (aparece en solares libres).
- **Gente con actividad:** sentados en bancos y terrazas, colas en farmacia/supermercado, niños en el parque infantil, gente entrando y saliendo de los negocios, coches en el autoservicio y en la gasolinera, y algunos peatones paseando al perro.
- **Globos de texto** sobre los peatones (cambian con la lluvia y la noche).
- **Obras:** conos, excavadora y operarios; el tráfico se desvía hacia el centro y reduce la velocidad.
- **Barrios:** más tráfico y gente donde hay muchos edificios (centro), menos en las afueras.
- **Sonido ambiente** según el zoom (murmullo, bocinazos lejanos, campanas a las horas en punto); respeta el botón 🔊.
- **Estaciones:** hojas en otoño, nieve en invierno y pétalos en primavera (según el mes y el hemisferio); en verano y en el trópico no hay partículas.

Para probar sin esperar, en la consola: `cityEvent('works' | 'parade' | 'wedding' | 'ambulance' | 'steam' | 'bubble' | 'tram' | 'garbage' | 'van' | 'driving')` y `citySeason('autumn' | 'winter' | 'spring' | 'summer' | 'auto')`.
Las posiciones de bancos, colas, puertas y chimeneas dentro de cada parcela son aproximadas (constantes `P_(sc, u, v)` en `INIT`/`TICK` de `ciudad.js`): se ajustan viendo cada edificio.

## Regalar créditos entre jugadores (`gifts.js`)

- Botón 💝 en **Extras**, y también en la tarjeta que sale al tocar un apodo en el chat y en la lista de amigos. Se regala por **apodo** (no distingue mayúsculas).
- Hace falta cuenta con apodo. El servidor lo hace todo en **una transacción** (`giftSend` en `server.js`): bloquea las dos cuentas, descuenta solo si hay saldo y lo ingresa al otro. Nadie queda en negativo ni se duplican créditos aunque se pulse dos veces o se mande desde dos móviles.
- El que recibe ve un aviso al entrar (y cada minuto mientras juega), más un aviso al móvil si tiene los 🔔 activados. En 💝 hay historial de recibidos y enviados.
- Límites contra abuso (cuentas falsas pasándose los regalos de bienvenida): `GIFT_MAX` (500 por regalo), `GIFT_DAILY_MAX` (1000 cada 24 h), `GIFT_MIN_AGE_HOURS` (la cuenta debe tener 24 h) y 8 regalos por minuto. `GIFT=off` apaga los regalos. **El dueño no tiene ninguno de estos límites.**
- Tablas nuevas (se crean solas al arrancar; `migration-gifts.sql` es lo mismo por si prefieres ejecutarlo a mano): `gifts` y `owner_grants`.

## Paga mensual del dueño

- El dueño recibe `OWNER_MONTHLY_CREDITS` créditos (**10.000** por defecto) una vez al mes (el mes cambia según `DAILY_TZ`).
- Se identifica con `OWNER_USER_ID` (tu UUID en Supabase → Authentication → Users → columna *User UID*) y/o `OWNER_EMAIL` (solo vale si ese correo está confirmado en Supabase).
- Con `OWNER_USER_ID` el ingreso se hace solo el día 1 de cada mes aunque no abras el juego (revisa cada hora). Con solo `OWNER_EMAIL` se ingresa la primera vez que entras cada mes. Si este mes aún no se ha ingresado, entra la primera vez que arranque con la variable puesta.
- La clave primaria `(user_id, mes)` de `owner_grants` garantiza que no se puede cobrar dos veces en el mismo mes, aunque se reinicie el servidor.
- `OWNER_MONTHLY_CREDITS=0` lo desactiva.

## Avisos al móvil del dueño (compras y conexiones, por Telegram)

1. En Telegram habla con **@BotFather**, escribe `/newbot`, elige nombre y copia el **token**.
2. Abre tu bot nuevo y escríbele cualquier mensaje (por ejemplo "hola").
3. Abre en el navegador `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia el número de `"chat":{"id":...}`.
4. En Render > Environment añade `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` y guarda.
5. Recibirás un mensaje por cada compra y cuando un jugador se conecte (máx. uno por jugador cada 6 h).
