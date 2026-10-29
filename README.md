# Atlas Terrenos

Juego tipo Atlas Earth: compra parcelas reales del mapa mundial y paga con PayPal.
Cada parcela comprada muestra el nombre de su dueño y **no se puede volver a comprar**.

## Arrancar (solo necesita Node 22.5 o superior, sin `npm install`)

    node server.js        # modo DEMO (pago simulado, no cobra nada)
    # abre http://localhost:3000

## Activar PayPal

1. En https://developer.paypal.com crea una app (primero en Sandbox) y copia Client ID y Secret.
2. Arranca así:

    PAYPAL_CLIENT_ID=xxx PAYPAL_SECRET=yyy PAYPAL_ENV=sandbox node server.js

3. Para cobrar de verdad usa las credenciales Live y `PAYPAL_ENV=live`.

Otras variables: `PRICE` (por defecto 1.00), `CURRENCY` (EUR), `PORT` (3000), `DB_FILE`.

## Cómo funciona

- El mundo es una rejilla de parcelas de 0,001° (~111 m). Cada una tiene id `x:y` calculado desde lat/lng.
- Al pagar, el servidor reserva la parcela 10 min y crea el pedido en PayPal.
- Al aprobar, el servidor captura el pago, comprueba importe y moneda y guarda la parcela
  (clave primaria única en SQLite: imposible venderla dos veces). Si por una carrera extrema
  ya estaba vendida, se reembolsa automáticamente.
- El nombre del dueño se limpia en el servidor y se pinta con textContent (sin HTML).
- "Mi ubicación" usa la geolocalización del navegador; hay ranking de propietarios.

## Antes de publicarlo en internet

- Ponlo detrás de HTTPS (Caddy, nginx, Render, Railway...).
- Añade límite de peticiones y moderación de nombres si es público.
- Deja claro que son objetos virtuales sin valor legal sobre el suelo real y revisa
  las condiciones de PayPal para vender bienes digitales.
