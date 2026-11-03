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
