# Atlas Terrenos

Juego de terrenos virtuales sobre el mapa del mundo: compra un pack con PayPal (o gana créditos con el regalo diario y la producción) y reclama parcelas.
Cada parcela reclamada muestra el nombre de su dueño y **no se puede volver a reclamar**.

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

Variables de entorno:

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `DATABASE_URL` | (obligatoria) | Conexión a Supabase |
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_ENV` | - / - / sandbox | Cobros. **En producción son obligatorias**: sin ellas el servidor no arranca (salvo `DEMO=1`) |
| `DEMO` | - | `1` = pago simulado, no se cobra nada |
| `PRICE`, `CURRENCY` | 1.00, EUR | Precio de un pack |
| `PACK_SIZE` | 50 | Terrenos por pack |
| `PROD_RATE` | 0.002 | Créditos por terreno y hora |
| `PROD_CAP_HOURS` | 24 | Horas máximas que se acumulan sin recoger |
| `MAX_PARCELS_PER_ACCOUNT` | 500 | Tope de terrenos por cuenta |
| `TRUST_PROXY_HOPS` | 1 | Proxies de confianza delante del servidor (0 en local) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REQUIRE_LOGIN` | - / - / activo si hay Supabase | Login |
| `ADMIN_TOKEN`, `DAILY_TZ`, `DAILY_SALT`, `PORT` | - / Europe/Madrid / - / 3000 | Administración, regalo diario, puerto |

## Cómo funciona

- El mundo es una rejilla de parcelas de 0,0005° (~55 m). Cada una tiene id `x:y` calculado desde lat/lng.
- Se paga un pack de terrenos con PayPal: el servidor captura el pago, comprueba importe y moneda y suma los créditos.
- Cada crédito reclama una parcela; la clave primaria única en Postgres hace imposible que dos personas la reclamen.
- El nombre del dueño se limpia en el servidor y se pinta con textContent (sin HTML).
- "Mi ubicación" usa la geolocalización del navegador; hay ranking de propietarios.

## Antes de publicarlo en internet

- Ponlo detrás de HTTPS (Caddy, nginx, Render, Railway...).
- Añade límite de peticiones y moderación de nombres si es público.
- Deja claro que son objetos virtuales sin valor legal sobre el suelo real y revisa
  las condiciones de PayPal para vender bienes digitales.
