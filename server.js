// Redecora El Mundo — servidor con base de datos en Supabase (Postgres)
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool, types } = require('pg');

types.setTypeParser(20, Number);   // BIGINT (created_at, COUNT) -> número, no texto

// ---------- Configuración ----------
const PORT = Number(process.env.PORT || 3000);
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase(); // sandbox | live
const PAYPAL_BASE = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PRICE = (process.env.PRICE || '1.00');              // precio por parcela
const CURRENCY = (process.env.CURRENCY || 'EUR').toUpperCase();
const HAS_PAYPAL = !!(PAYPAL_CLIENT_ID && PAYPAL_SECRET);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';   // sk_test_... (pruebas) o sk_live_... (real). Solo en el servidor
const HAS_STRIPE = /^(sk|rk)_(test|live)_/.test(STRIPE_SECRET_KEY);
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RENDER;   // Render define RENDER=true
const DEMO = process.env.DEMO === '1' || !(HAS_STRIPE || HAS_PAYPAL);
if (DEMO && IS_PROD && process.env.DEMO !== '1') {
  // Sin esto, un fallo de configuración regalaría packs sin cobrar.
  console.error('Falta STRIPE_SECRET_KEY (o PAYPAL_CLIENT_ID / PAYPAL_SECRET) en producción. Configúralos, o pon DEMO=1 si de verdad quieres el modo demo.');
  process.exit(1);
}
if (DEMO && IS_PROD) console.warn('AVISO: modo DEMO activo en producción. No se cobra dinero real.');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const RESERVE_MINUTES = 10;                               // tiempo que se reserva una parcela mientras se paga
const PACK_SIZE = Math.max(1, Number(process.env.PACK_SIZE || 50));   // (ya no se usa para vender: ver PACKS)
// Packs a la venta: lista "créditos:precio" separada por comas, p. ej. PACKS="50:1,150:2,300:3,500:4" (sustituye a PRICE y PACK_SIZE)
const PACKS = (() => {
  const list = String(process.env.PACKS || '').split(',').map(x => x.trim()).filter(Boolean)
    .map(x => { const [c, p] = x.split(':'); return { credits: Math.floor(Number(c)), price: Number(p) }; })
    .filter(x => x.credits >= 1 && Number.isFinite(x.price) && x.price > 0)
    .map(x => ({ credits: x.credits, price: x.price.toFixed(2) }));
  return list.length ? list : [{ credits: 50, price: '1.00' }, { credits: 150, price: '2.00' }, { credits: 300, price: '3.00' }, { credits: 500, price: '4.00' }];
})();
const MAX_PARCELS_PER_ACCOUNT = Math.max(1, Number(process.env.MAX_PARCELS_PER_ACCOUNT || 500));   // tope de terrenos por cuenta
const DATABASE_URL = process.env.DATABASE_URL || '';      // cadena de conexión de Supabase
if (!DATABASE_URL) {
  console.error('Falta la variable DATABASE_URL (cadena de conexión de Supabase). Mira el README.');
  process.exit(1);
}

// ---------- Login (Supabase Auth) ----------
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');   // https://xxxx.supabase.co
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';               // clave pública "anon"
const AUTH_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const REQUIRE_LOGIN = AUTH_ENABLED && process.env.REQUIRE_LOGIN !== '0';     // comprar y cobrar el regalo exige cuenta

// Rejilla del mundo: cada parcela es un cuadrado de 0.001° (~111 m de lado en latitud)
const SIZE = 0.0005;
const MAX_X = Math.round(360 / SIZE);   // 360000 columnas
const MAX_Y = Math.round(180 / SIZE);   // 180000 filas

// ---------- Base de datos ----------
// Las tablas se crean una sola vez ejecutando schema.sql en el editor SQL de Supabase.
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // Supabase exige SSL
  max: 5,
});
pool.on('error', e => console.error('Error en el pool de Postgres:', e.message));

const run = (text, params = []) => pool.query(text, params);
const one = async (text, params) => (await run(text, params)).rows[0];
const all = async (text, params) => (await run(text, params)).rows;
const isUniqueViolation = e => e && e.code === '23505';

const q = {
  parcelById: id => one('SELECT * FROM parcels WHERE id = $1', [id]),
  parcelsInBox: (x0, x1, y0, y1) => all('SELECT id, x, y, owner, avatar, country, house, level FROM parcels WHERE x BETWEEN $1 AND $2 AND y BETWEEN $3 AND $4 LIMIT 3000', [x0, x1, y0, y1]),
  insertParcel: (id, x, y, owner, orderId, paid, currency, createdAt, avatar, country, house) =>
    run('INSERT INTO parcels (id, x, y, owner, order_id, paid, currency, created_at, avatar, country, house) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [id, x, y, owner, orderId, paid, currency, createdAt, avatar, country, house]),
  activeOrderForParcel: (id, now) => one("SELECT order_id FROM orders WHERE parcel_id = $1 AND status = 'CREATED' AND expires_at > $2", [id, now]),
  insertOrder: (orderId, parcelId, owner, status, expiresAt, createdAt, avatar) =>
    run('INSERT INTO orders (order_id, parcel_id, owner, status, expires_at, created_at, avatar) VALUES ($1,$2,$3,$4,$5,$6,$7)', [orderId, parcelId, owner, status, expiresAt, createdAt, avatar]),
  orderById: id => one('SELECT * FROM orders WHERE order_id = $1', [id]),
  setOrderStatus: (status, id) => run('UPDATE orders SET status = $1 WHERE order_id = $2', [status, id]),
  purgeOrders: now => run("DELETE FROM orders WHERE status = 'CREATED' AND expires_at <= $1", [now]),
  count: () => one('SELECT COUNT(*) AS n FROM parcels'),
  topCountries: () => all('SELECT country, COUNT(*) AS n FROM parcels WHERE country IS NOT NULL GROUP BY country ORDER BY n DESC LIMIT 10'),
  top: () => all('SELECT owner, COUNT(*) AS n, (ARRAY_AGG(country ORDER BY created_at DESC) FILTER (WHERE country IS NOT NULL))[1] AS country FROM parcels GROUP BY owner ORDER BY n DESC, MIN(created_at) ASC LIMIT 10'),
};
// ---------- Avatares ----------
const AVATARS = ['😀','😎','🤠','🦊','🐱','🐶','🦁','🐼','🚀','👑','⚽','🌟'];
const cleanAvatar = a => AVATARS.includes(a) ? a : AVATARS[0];
// Casas que se pueden elegir (deben coincidir con HOUSES de app.js; para añadir más, ponlas al FINAL de ambas listas)
const HOUSES = [
  'images/casa-1.webp',
  'images/casa-6.webp',
  'images/colegio.webp',
  'images/pisos.webp',
  'images/pisos-2.webp',
  'images/Farmacia.webp',
  'images/bosque.webp',
  'images/parque-infantil.webp',
  'images/supermercado.webp',
  'images/helipuerto.webp',
  'images/jardin.webp',
  'images/condis.webp',
  'images/cepsa.webp',
  'images/aurgi.webp',
  'images/burrito-blanco.webp',
  'images/arcobaleno.webp',
  'images/la-cruilla.webp'
];
const cleanHouse = h => { h = typeof h === 'string' ? h.replace(/\.png$/i, '.webp') : h; return HOUSES.includes(h) ? h : null; };   // null = al azar (como hasta ahora)
const cleanCountry = c => (typeof c === 'string' && /^[A-Za-z]{2}$/.test(c)) ? c.toUpperCase() : null;

// ---------- Seguridad de administrador ----------
function isAdmin(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer (.+)$/);

  if (!ADMIN_TOKEN || !match) return false;

  const supplied = Buffer.from(match[1]);
  const expected = Buffer.from(ADMIN_TOKEN);

  return supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected);
}

async function adminClaimParcel({ lat, lng, owner, avatar, country, house }) {
  const p = parcelFromLatLng(Number(lat), Number(lng));
  if (!p) throw new HttpError(400, 'Coordenadas no válidas');

  const name = cleanName(owner);
  if (!name) throw new HttpError(400, 'Nombre no válido');

  const now = Date.now();

  await q.purgeOrders(now);

  if (await q.parcelById(p.id)) {
    throw new HttpError(409, 'Esta parcela ya tiene propietario');
  }

  if (await q.activeOrderForParcel(p.id, now)) {
    throw new HttpError(409, 'Esta parcela está reservada por una compra');
  }

  try {
    await q.insertParcel(p.id, p.x, p.y, name, null, '0.00', 'ADMIN', now, cleanAvatar(avatar), cleanCountry(country), cleanHouse(house));
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'No se ha podido reclamar esta parcela');
    throw e;
  }

  return {
    ok: true,
    free: true,
    parcel: p.id,
    owner: name
  };
}
// ---------- Utilidades de parcelas ----------
function parcelFromLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat >= 90 || lng < -180 || lng >= 180) return null;
  const x = Math.floor((lng + 180) / SIZE);
  const y = Math.floor((lat + 90) / SIZE);
  return parcelFromXY(x, y);
}
function parcelFromXY(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= MAX_X || y >= MAX_Y) return null;
  const west = x * SIZE - 180, south = y * SIZE - 90;
  return { id: `${x}:${y}`, x, y, south, west, north: south + SIZE, east: west + SIZE };
}
function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return s.length >= 2 && s.length <= 30 ? s : null;
}

// ---------- PayPal ----------
let tokenCache = { token: null, exp: 0 };
async function paypalToken() {
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json();
  if (!r.ok) throw new Error('PayPal auth: ' + (j.error_description || r.status));
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return tokenCache.token;
}
async function paypal(method, url, body) {
  const r = await fetch(PAYPAL_BASE + url, {
    method,
    headers: { Authorization: 'Bearer ' + (await paypalToken()), 'Content-Type': 'application/json', 'PayPal-Request-Id': crypto.randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('PayPal: ' + (j.message || r.status)); e.details = j; throw e; }
  return j;
}
// ---------- Stripe (pago principal) ----------
// Se usa Stripe Checkout (página de pago alojada por Stripe) sin instalar ningún paquete: llamadas directas a su API.
async function stripe(method, url, form) {
  const r = await fetch('https://api.stripe.com' + url, {
    method,
    headers: { Authorization: 'Bearer ' + STRIPE_SECRET_KEY, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('Stripe: ' + ((j.error && j.error.message) || r.status)); e.details = j; throw e; }
  return j;
}
const cents = price => Math.round(Number(price) * 100);

// ---------- API ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

// ---------- Packs de terrenos (créditos) ----------
const newPackCode = () => crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{4}/g).join('-');
const packCodeFrom = req => {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  return m ? m[1].trim().toUpperCase().slice(0, 40) : null;
};

async function getPack(req) {
  const code = packCodeFrom(req);
  const row = code && await one('SELECT code, credits FROM packs WHERE code = $1', [code]);
  if (!row) throw new HttpError(403, 'Código no válido');
  return row;
}

// ---------- Login: usuario a partir del token de Supabase ----------
const authCache = new Map();   // token -> { user, exp }
async function userFrom(req) {
  const t = String(req.headers['x-auth-token'] || '').trim();
  if (!AUTH_ENABLED || !t || t.length > 4096) return null;
  const hit = authCache.get(t);
  if (hit && hit.exp > Date.now()) return hit.user;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + t } });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.id) return null;
    const user = { id: j.id, email: j.email || null };
    if (authCache.size > 500) authCache.clear();
    authCache.set(t, { user, exp: Date.now() + 60_000 });
    return user;
  } catch { return null; }
}
async function needUser(req) {
  const u = await userFrom(req);
  if (!u) throw new HttpError(401, 'Inicia sesión para continuar');
  return u;
}

// Pack de la cuenta (se crea vacío la primera vez)
async function ensureUserPack(user, create = true) {
  const find = () => one('SELECT code, credits, last_daily, streak FROM packs WHERE user_id = $1', [user.id]);
  const row = await find();
  if (row || !create) return row;
  try {
    await run('INSERT INTO packs (code, credits, created_at, user_id) VALUES ($1,0,$2,$3)', [newPackCode(), Date.now(), user.id]);
  } catch (e) { if (!isUniqueViolation(e)) throw e; }
  return find();
}

// ---------- Apodo fijo (se elige una sola vez y no se puede cambiar) ----------
const getProfile = userId => one('SELECT nickname FROM profiles WHERE user_id = $1', [userId]);

async function profileGet(req) {
  const user = await needUser(req);
  const p = await getProfile(user.id);
  return { nickname: p ? p.nickname : null };
}
async function profileSet(req, { nickname }) {
  const user = await needUser(req);
  const name = cleanName(nickname);
  if (!name) throw new HttpError(400, 'El apodo debe tener de 2 a 30 caracteres');
  if (await getProfile(user.id)) throw new HttpError(409, 'Tu apodo ya está fijado y no se puede cambiar');
  try {
    await run('INSERT INTO profiles (user_id, nickname, created_at) VALUES ($1,$2,$3)', [user.id, name, Date.now()]);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    if (await getProfile(user.id)) throw new HttpError(409, 'Tu apodo ya está fijado y no se puede cambiar');
    throw new HttpError(409, 'Ese apodo ya está en uso. Elige otro');
  }
  return { ok: true, nickname: name };
}

// Regalo de bienvenida: créditos que recibe una cuenta nueva, una sola vez (WELCOME_CREDITS=0 lo desactiva)
const WELCOME_CREDITS = Math.max(0, Math.floor(Number(process.env.WELCOME_CREDITS ?? 5)));

// Al iniciar sesión: ata a la cuenta el código de este dispositivo (o junta sus terrenos con los de la cuenta)
async function linkAccount(req) {
  const user = await needUser(req);
  const local = packCodeFrom(req);
  const client = await pool.connect();
  let welcomeBonus = 0;
  try {
    await client.query('BEGIN');
    let mine = (await client.query('SELECT code, credits FROM packs WHERE user_id = $1 FOR UPDATE', [user.id])).rows[0];
    const isNewAccount = !mine;          // la cuenta aún no tenía pack: es la primera vez que entra
    let old = null;
    if (local && (!mine || mine.code !== local)) {
      old = (await client.query('SELECT code, credits, user_id FROM packs WHERE code = $1 FOR UPDATE', [local])).rows[0] || null;
      if (old && old.user_id) old = null;          // ya es de otra cuenta: no se toca
    }
    if (!mine && old) {
      await client.query('UPDATE packs SET user_id = $1 WHERE code = $2', [user.id, old.code]);
      mine = { code: old.code, credits: old.credits };
    } else {
      if (!mine) {
        const code = newPackCode();
        await client.query('INSERT INTO packs (code, credits, created_at, user_id) VALUES ($1,0,$2,$3)', [code, Date.now(), user.id]);
        mine = { code, credits: 0 };
      }
      if (old && old.credits > 0) {
        await client.query('UPDATE packs SET credits = 0 WHERE code = $1', [old.code]);
        const up = await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING credits', [old.credits, mine.code]);
        mine.credits = up.rows[0].credits;
      }
    }
    // Regalo de bienvenida: solo cuentas nuevas y una sola vez (la clave primaria de welcome_gifts lo garantiza)
    if (isNewAccount && WELCOME_CREDITS > 0) {
      const g = await client.query('INSERT INTO welcome_gifts (user_id, credits, created_at) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO NOTHING RETURNING user_id', [user.id, WELCOME_CREDITS, Date.now()]);
      if (g.rows[0]) {
        const up = await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING credits', [WELCOME_CREDITS, mine.code]);
        mine.credits = up.rows[0].credits;
        welcomeBonus = WELCOME_CREDITS;
      }
    }
    await client.query('COMMIT');
    const prof = await getProfile(user.id);
    return { ok: true, code: mine.code, credits: mine.credits, email: user.email, nickname: prof ? prof.nickname : null, welcomeBonus };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (isUniqueViolation(e)) throw new HttpError(409, 'Inténtalo de nuevo');
    throw e;
  } finally {
    client.release();
  }
}

async function createPackOrder(req, body) {
  if (REQUIRE_LOGIN) await needUser(req);
  const now = Date.now();
  const want = body && body.pack != null ? Number(body.pack) : PACKS[0].credits;   // sin indicar pack: el primero (clientes antiguos)
  const pack = PACKS.find(p => p.credits === want);
  if (!pack) throw new HttpError(400, 'Pack no válido');
  let orderId, approveUrl = null;
  const useStripe = !DEMO && HAS_STRIPE && (!body || body.method !== 'paypal');
  if (DEMO) {
    orderId = 'DEMO-' + crypto.randomUUID();
  } else if (useStripe) {
    // Stripe Checkout: devuelve una dirección a la que mandar al cliente a pagar. Vuelve a returnUrl con ?stripe=ok&session_id=...
    let u; try { u = new URL(String(body && body.returnUrl)); } catch { throw new HttpError(400, 'Dirección de retorno no válida'); }
    const host = req.headers.host;
    const allowed = new Set([...CORS_ORIGINS, `https://${host}`, `http://${host}`]);
    if (!/^https?:$/.test(u.protocol) || !allowed.has(u.origin)) throw new HttpError(400, 'Dirección de retorno no válida');
    u.search = ''; u.hash = '';
    const base = u.toString();
    const form = {
      mode: 'payment',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': CURRENCY.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(cents(pack.price)),
      'line_items[0][price_data][product_data][name]': `Pack de ${pack.credits} créditos`,
      success_url: base + '?stripe=ok&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: base + '?pay=cancel',
      'metadata[pack_credits]': String(pack.credits),
    };
    const user = await userFrom(req);
    if (user) form.client_reference_id = user.id;
    if (user && user.email) form.customer_email = user.email;
    const o = await stripe('POST', '/v1/checkout/sessions', form);
    orderId = o.id; approveUrl = o.url;
  } else {
    const ctx = { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', landing_page: 'GUEST_CHECKOUT' };
    if (body && body.returnUrl) {   // pago por redirección (botón "Tarjeta" en móvil): PayPal necesita a dónde volver
      let u; try { u = new URL(String(body.returnUrl)); } catch { throw new HttpError(400, 'Dirección de retorno no válida'); }
      if (!/^https?:$/.test(u.protocol)) throw new HttpError(400, 'Dirección de retorno no válida');
      u.search = ''; u.hash = '';
      ctx.return_url = u.toString();
      u.searchParams.set('pay', 'cancel');
      ctx.cancel_url = u.toString();
    }
    const o = await paypal('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      payment_source: { paypal: { experience_context: ctx } },
      purchase_units: [{
        reference_id: 'PACK',
        description: `Pack de ${pack.credits} créditos`,
        amount: { currency_code: CURRENCY, value: pack.price },
      }],
    });
    orderId = o.id;
    const l = (o.links || []).find(x => x.rel === 'payer-action') || (o.links || []).find(x => x.rel === 'approve');
    approveUrl = l ? l.href : null;
  }
  await run('INSERT INTO pack_orders (order_id, status, created_at, pack_credits, pack_price) VALUES ($1,$2,$3,$4,$5)', [orderId, 'CREATED', now, pack.credits, pack.price]);
  return { orderId, size: pack.credits, price: pack.price, currency: CURRENCY, approveUrl };
}

async function capturePackOrder(req, orderId) {
  const ord = await one('SELECT * FROM pack_orders WHERE order_id = $1', [orderId]);
  if (!ord) throw new HttpError(404, 'Pedido desconocido');
  if (ord.status === 'PAID') {
    const p = await one('SELECT code, credits FROM packs WHERE code = $1', [ord.code]);
    return { ok: true, code: p.code, credits: p.credits };
  }
  if (ord.status !== 'CREATED') throw new HttpError(409, 'Pedido no válido');
  const packCredits = ord.pack_credits ?? PACKS[0].credits, packPrice = ord.pack_price ?? PACKS[0].price;   // el pack que se pidió al crear el pedido

  const user = REQUIRE_LOGIN ? await needUser(req) : await userFrom(req);   // antes de cobrar nada
  let captureId = null;
  const isStripeOrder = orderId.startsWith('cs_');
  if (!DEMO && isStripeOrder) {
    if (!HAS_STRIPE) throw new HttpError(503, 'Stripe no está configurado');
    // Se comprueba en Stripe (nunca nos fiamos del navegador) que está pagado, con el importe y la moneda del pack pedido
    const ses = await stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(orderId)}`);
    if (ses.payment_status !== 'paid') throw new HttpError(402, 'El pago no se ha completado');
    if (ses.amount_total !== cents(packPrice) || String(ses.currency).toUpperCase() !== CURRENCY) throw new HttpError(402, 'Importe incorrecto');
    captureId = typeof ses.payment_intent === 'string' ? ses.payment_intent : (ses.payment_intent && ses.payment_intent.id) || ses.id;
    // Evita que dos peticiones a la vez (p. ej. recargar la página) sumen los créditos dos veces
    const claimed = await one("UPDATE pack_orders SET status = 'PROCESSING' WHERE order_id = $1 AND status = 'CREATED' RETURNING order_id", [orderId]);
    if (!claimed) throw new HttpError(409, 'Este pago ya se está procesando. Espera unos segundos y recarga');
  } else if (!DEMO) {
    const cap = await paypal('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`);
    const c = cap.purchase_units?.[0]?.payments?.captures?.[0];
    if (cap.status !== 'COMPLETED' || !c || c.status !== 'COMPLETED') throw new HttpError(402, 'El pago no se ha completado');
    if (c.amount.value !== Number(packPrice).toFixed(2) || c.amount.currency_code !== CURRENCY) throw new HttpError(402, 'Importe incorrecto');
    captureId = c.id;
  }

  let code, credits;
  try {
    if (user) {
      // Con cuenta: los terrenos se suman al pack de la cuenta
      const row = await ensureUserPack(user);
      const up = await one('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING code, credits', [packCredits, row.code]);
      code = up.code; credits = up.credits;
    } else {
      code = newPackCode();
      await run('INSERT INTO packs (code, credits, created_at) VALUES ($1,$2,$3)', [code, packCredits, Date.now()]);
      credits = packCredits;
    }
    await run("UPDATE pack_orders SET status = 'PAID', code = $1 WHERE order_id = $2", [code, orderId]);
  } catch (e) {
    if (isStripeOrder) await run("UPDATE pack_orders SET status = 'CREATED' WHERE order_id = $1 AND status = 'PROCESSING'", [orderId]).catch(() => {});
    if (captureId) console.error('PAGO CAPTURADO PERO PACK NO GUARDADO, REVISAR', captureId, orderId, e.message);
    throw e;
  }
  return { ok: true, code, credits };
}

async function claimWithCredit(req, { lat, lng, owner, avatar, country, house }) {
  const code = packCodeFrom(req);
  const p = parcelFromLatLng(Number(lat), Number(lng));
  if (!p) throw new HttpError(400, 'Coordenadas no válidas');
  const user = await userFrom(req);
  const prof = user && await getProfile(user.id);
  const name = prof ? prof.nickname : cleanName(owner);   // con cuenta, siempre sale el apodo fijo
  if (!name) throw new HttpError(400, 'Pon un nombre de 2 a 30 caracteres');

  const now = Date.now();
  await q.purgeOrders(now);
  if (await q.parcelById(p.id)) throw new HttpError(409, 'Este terreno ya tiene dueño');
  if (await q.activeOrderForParcel(p.id, now)) throw new HttpError(409, 'Este terreno está siendo comprado por otra persona. Prueba en unos minutos');

  // Una sola transacción: restar el crédito y guardar la parcela, o ninguna de las dos cosas.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('UPDATE packs SET credits = credits - 1 WHERE code = $1 AND credits > 0 RETURNING credits', [code]);
    if (!r.rows[0]) {
      const exists = code && await one('SELECT 1 AS ok FROM packs WHERE code = $1', [code]);
      throw new HttpError(exists ? 402 : 403, exists ? 'No te quedan terrenos en tu pack' : 'Código no válido');
    }
    if (user) {   // la fila del pack ya está bloqueada: dos reclamaciones a la vez no pueden pasarse del tope
      const owned = Number((await client.query('SELECT COUNT(*) AS n FROM parcels WHERE user_id = $1', [user.id])).rows[0].n);
      if (owned >= MAX_PARCELS_PER_ACCOUNT) throw new HttpError(409, `Has alcanzado el máximo de ${MAX_PARCELS_PER_ACCOUNT} terrenos por cuenta`);
    }
    await client.query(
      'INSERT INTO parcels (id, x, y, owner, order_id, paid, currency, created_at, avatar, country, user_id, house) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [p.id, p.x, p.y, name, null, '0.00', 'PACK', now, cleanAvatar(avatar), cleanCountry(country), user ? user.id : null, cleanHouse(house)]);
    await client.query('COMMIT');
    let bonus = 0;   // invitación: premio al invitado y a quien le invitó (si no hay invitación, no pasa nada)
    if (user) notifyFriendsOf(user.id, 'claim');   // sin esperar: el aviso no retrasa la respuesta
    if (user) { try { const rr = await rewardReferral(user.id, code); if (rr) bonus = rr.inviteeBonus; } catch (e) { console.error('Invitación:', e.message); } }
    return { ok: true, parcel: p.id, owner: name, credits: r.rows[0].credits + bonus, referralBonus: bonus };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (isUniqueViolation(e)) throw new HttpError(409, 'Este terreno ya tiene dueño');
    throw e;
  } finally {
    client.release();
  }
}

// Cambiar la casa de un terreno propio (solo el dueño con cuenta). Cuesta HOUSE_COST créditos.
const HOUSE_COST = Math.max(0, Math.floor(Number(process.env.HOUSE_COST ?? 1)));
async function setHouse(req, { id, house }) {
  const user = await needUser(req);
  const h = cleanHouse(house);
  if (!h) throw new HttpError(400, 'Casa no válida');
  const pack = await ensureUserPack(user);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const par = (await client.query('SELECT house FROM parcels WHERE id = $1 AND user_id = $2 FOR UPDATE', [String(id), user.id])).rows[0];
    if (!par) throw new HttpError(403, 'Este terreno no es tuyo');
    let credits;
    if (par.house === h) {   // ya tiene esa casa: no se cobra nada
      credits = (await client.query('SELECT credits FROM packs WHERE code = $1', [pack.code])).rows[0].credits;
    } else {
      const r = await client.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [HOUSE_COST, pack.code]);
      if (!r.rows[0]) throw new HttpError(402, 'NO TIENES CRÉDITOS PARA ESTA MEJORA. COMPRA CRÉDITOS.');
      credits = r.rows[0].credits;
      await client.query('UPDATE parcels SET house = $1 WHERE id = $2', [h, String(id)]);
    }
    await client.query('COMMIT');
    return { ok: true, house: h, credits };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ---------- Regalo diario ----------
const DAILY_TZ = process.env.DAILY_TZ || 'Europe/Madrid';       // el "día" cambia a medianoche de esta zona
const DAILY_REWARDS = (() => {                                   // créditos de cada día de la racha (se repite cada 7 días; el día 7 es el premio grande)
  const l = String(process.env.DAILY_REWARDS || '').split(',').map(x => Math.floor(Number(x))).filter(x => x >= 1 && x <= 1000);
  return l.length === 7 ? l : [1, 1, 2, 2, 3, 3, 10];
})();
const DAILY_SALT = process.env.DAILY_SALT || ADMIN_TOKEN || 'atlas-terrenos';
const dayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: DAILY_TZ });   // AAAA-MM-DD
const yesterdayKey = () => { const d = new Date(dayKey() + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
// Detrás de un proxy, la IP fiable es la que AÑADE el proxy (la última de x-forwarded-for), no la primera, que la puede escribir el cliente.
// TRUST_PROXY_HOPS = nº de proxies de confianza delante del servidor (1 por defecto; pon 0 en local sin proxy).
const TRUST_PROXY_HOPS = Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? 1));
const clientIp = req => {
  if (TRUST_PROXY_HOPS > 0) {
    const parts = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim()).filter(Boolean);
    const ip = parts[parts.length - TRUST_PROXY_HOPS];
    if (ip) return ip;
  }
  return req.socket.remoteAddress || '';
};

function dailyInfo(row) {
  const today = dayKey();
  const last = row ? row.last_daily : null;
  const streak = row ? row.streak : 0;
  let canClaim, effective, completed;
  if (last === today) {
    canClaim = false; effective = streak; completed = ((streak - 1) % 7) + 1;
  } else {
    canClaim = true; effective = last === yesterdayKey() ? streak : 0; completed = effective % 7;
  }
  const next = canClaim ? DAILY_REWARDS[completed] : DAILY_REWARDS[streak % 7];
  return { canClaim, streak: effective, dayInCycle: completed, next, rewards: DAILY_REWARDS, newStreak: effective + 1 };
}

async function dailyGet(req) {
  const code = packCodeFrom(req);
  if (!code) {
    const user = await userFrom(req);
    return dailyInfo(user ? await ensureUserPack(user, false) : null);
  }
  const row = await one('SELECT code, credits, last_daily, streak FROM packs WHERE code = $1', [code]);
  if (!row) throw new HttpError(403, 'Código no válido');
  return dailyInfo(row);
}

async function dailyClaim(req) {
  let code = packCodeFrom(req);
  const today = dayKey();

  if (!code) {
    const user = await userFrom(req);
    if (user) code = (await ensureUserPack(user)).code;
    else if (REQUIRE_LOGIN) throw new HttpError(401, 'Inicia sesión para reclamar tu regalo diario');
  }

  if (!code) {
    // Primer regalo sin código: se crea un pack nuevo. Máximo uno por conexión y día.
    const hash = crypto.createHash('sha256').update(clientIp(req) + DAILY_SALT).digest('hex');
    await run('DELETE FROM daily_ip WHERE day < $1', [today]);
    const ins = await run('INSERT INTO daily_ip (day, ip_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING', [today, hash]);
    if (ins.rowCount === 0) throw new HttpError(429, 'Ya se ha reclamado un regalo desde esta conexión hoy. Si ya tienes un código, introdúcelo para reclamar el tuyo.');
    const reward = dailyInfo(null).next;
    const newCode = newPackCode();
    await run('INSERT INTO packs (code, credits, created_at, last_daily, streak) VALUES ($1,$2,$3,$4,$5)', [newCode, reward, Date.now(), today, 1]);
    return { ok: true, code: newCode, credits: reward, reward, streak: 1, newCode: true };
  }

  const row = await one('SELECT code, credits, last_daily, streak FROM packs WHERE code = $1', [code]);
  if (!row) throw new HttpError(403, 'Código no válido');
  const info = dailyInfo(row);
  if (!info.canClaim) throw new HttpError(409, 'Ya has reclamado el regalo de hoy');
  const up = await one(
    'UPDATE packs SET credits = credits + $1, last_daily = $2, streak = $3 WHERE code = $4 AND last_daily IS DISTINCT FROM $2 RETURNING credits, streak',
    [info.next, today, info.newStreak, code]);
  if (!up) throw new HttpError(409, 'Ya has reclamado el regalo de hoy');
  return { ok: true, code, credits: up.credits, reward: info.next, streak: up.streak, newCode: false };
}

// ---------- Ruleta diaria ----------
// Un giro gratis al día por cuenta (día según DAILY_TZ). Premios en créditos; los de 1, 2, 5 y 10 solo pueden salir UNA vez al mes por cuenta.
// El premio lo decide el servidor. Como los créditos (packs.credits) son enteros, los decimales se acumulan en packs.roulette_carry
// y cada vez que suman 1 pasan a créditos enteros.
// Se puede ajustar con variables: ROULETTE_BIG_CHANCE (prob. de premio grande por giro si aún no salió este mes, 0.10 por defecto).
const ROULETTE_SMALL = [[0.10, 40], [0.20, 28], [0.50, 20], [0.75, 12]];   // [premio, peso]
const ROULETTE_BIG = [[1, 60], [2, 25], [5, 12], [10, 3]];
const ROULETTE_BIG_CHANCE = Math.min(1, Math.max(0, Number(process.env.ROULETTE_BIG_CHANCE ?? 0.10)));
function roulettePick(table) {
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = crypto.randomInt(0, total * 1000) / 1000;
  for (const [prize, w] of table) { if ((r -= w) < 0) return prize; }
  return table[0][0];
}
async function rouletteGet(req) {
  const user = await needUser(req);
  const done = await one('SELECT 1 FROM roulette_spins WHERE user_id = $1 AND day = $2', [user.id, dayKey()]);
  return { canSpin: !done };
}
async function rouletteSpin(req) {
  const user = await needUser(req);
  const pack = await ensureUserPack(user);
  const today = dayKey(), month = today.slice(0, 7);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT code FROM packs WHERE code = $1 FOR UPDATE', [pack.code]);   // un giro a la vez por cuenta
    const bigDone = (await client.query("SELECT 1 FROM roulette_spins WHERE user_id = $1 AND prize >= 1 AND to_char(day, 'YYYY-MM') = $2 LIMIT 1", [user.id, month])).rowCount > 0;
    const prize = (!bigDone && crypto.randomInt(0, 1_000_000) / 1_000_000 < ROULETTE_BIG_CHANCE) ? roulettePick(ROULETTE_BIG) : roulettePick(ROULETTE_SMALL);
    const ins = await client.query('INSERT INTO roulette_spins (user_id, day, prize, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [user.id, today, prize, Date.now()]);
    if (!ins.rowCount) throw new HttpError(409, 'Hoy ya has girado la ruleta. ¡Vuelve mañana!');
    const up = (await client.query(
      `UPDATE packs SET roulette_carry = (roulette_carry + $1) - floor(roulette_carry + $1),
                        credits = credits + floor(roulette_carry + $1)::int
       WHERE code = $2 RETURNING credits, roulette_carry`, [prize, pack.code])).rows[0];
    await client.query('COMMIT');
    return { ok: true, prize, credits: Number(up.credits), carry: Number(up.roulette_carry) };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

// ---------- Seguridad: límite de peticiones, clave de administrador, visitas ----------
const rateBuckets = new Map();   // clave -> { count, reset }
function rateHit(key, windowMs) {
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || b.reset <= now) { b = { count: 0, reset: now + windowMs }; rateBuckets.set(key, b); }
  b.count++;
  return b.count;
}
function ratePeek(key) {
  const b = rateBuckets.get(key);
  return b && b.reset > Date.now() ? b.count : 0;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of rateBuckets) if (b.reset <= now) rateBuckets.delete(k);
  if (rateBuckets.size > 50000) rateBuckets.clear();   // por si alguien intenta llenar la memoria
}, 60_000).unref();

// Más de 5 claves de administrador incorrectas en 15 minutos desde la misma conexión: se bloquea.
function requireAdmin(req) {
  const ip = clientIp(req);
  if (ratePeek('adminfail:' + ip) >= 5) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos');
  if (!isAdmin(req)) {
    rateHit('adminfail:' + ip, 15 * 60_000);
    throw new HttpError(403, 'Acceso exclusivo de administrador');
  }
}

// Contador de visitas únicas por día, anónimo (solo se guarda una huella no reversible de la conexión)
async function registerVisit(req) {
  const hash = crypto.createHash('sha256').update('visit:' + clientIp(req) + DAILY_SALT).digest('hex');
  await run('INSERT INTO visits (day, ip_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING', [dayKey(), hash]);
  if (Math.random() < 0.02) {   // de vez en cuando se borran las huellas antiguas (más de 60 días)
    const cutoff = new Date(Date.now() - 60 * 86400000).toLocaleDateString('en-CA', { timeZone: DAILY_TZ });
    await run('DELETE FROM visits WHERE day < $1', [cutoff]);
  }
  return { ok: true };
}
async function adminStats(req) {
  requireAdmin(req);
  const visitors = await all('SELECT day, COUNT(*) AS n FROM visits GROUP BY day ORDER BY day DESC LIMIT 14');
  const accounts = (await one('SELECT COUNT(*) AS n FROM packs WHERE user_id IS NOT NULL')).n;
  const parcels = (await q.count()).n;
  return { visitors, accounts, parcels };
}

// ---------- Mis terrenos y producción de créditos ----------
const PROD_RATE = Math.max(0, Number(process.env.PROD_RATE || 0.002));          // créditos por terreno y hora
const PROD_CAP_HOURS = Math.max(1, Number(process.env.PROD_CAP_HOURS || 24));  // horas máximas que se acumulan sin recoger
const HOUR_MS = 3600000;

// ---------- Niveles de terreno ----------
// Cada terreno tiene un nivel de 1 a MAX_LEVEL (50 por defecto). Pasar del nivel L al L+1 cuesta LEVEL_COSTS[L-1] créditos y el
// terreno produce PROD_RATE × LEVEL_MULTS[nivel-1]. Por defecto: multiplicador = 1 + LEVEL_STEP × (nivel-1) y coste = ceil(LEVEL_COST_K × L).
// Variables opcionales: LEVEL_MAX, LEVEL_STEP, LEVEL_COST_K, o listas completas LEVEL_MULTS / LEVEL_COSTS (separadas por comas) que mandan sobre la fórmula.
const numEnv = (name, def) => { const v = String(process.env[name] ?? '').trim(); const n = v === '' ? NaN : Number(v); return Number.isFinite(n) && n >= 0 ? n : def; };
const numList = (s, def) => { const a = String(s || '').split(',').map(x => x.trim()).filter(x => x !== '').map(Number).filter(x => Number.isFinite(x) && x >= 0); return a.length ? a : def; };
const LEVEL_MAX = Math.max(1, Math.min(200, Math.floor(numEnv('LEVEL_MAX', 50))));
const LEVEL_STEP = numEnv('LEVEL_STEP', 0.5);
const LEVEL_COST_K = numEnv('LEVEL_COST_K', 0.75);
const LEVEL_MULTS = numList(process.env.LEVEL_MULTS, Array.from({ length: LEVEL_MAX }, (_, i) => Math.round((1 + i * LEVEL_STEP) * 10000) / 10000));
const MAX_LEVEL = LEVEL_MULTS.length;
const LEVEL_COSTS = (() => {                                                  // créditos para pasar al nivel 2, 3, 4…
  const c = numList(process.env.LEVEL_COSTS, Array.from({ length: MAX_LEVEL - 1 }, (_, i) => Math.max(1, Math.ceil((i + 1) * LEVEL_COST_K)))).map(x => Math.floor(x));
  while (c.length < MAX_LEVEL - 1) c.push(c.length ? c[c.length - 1] : 1);
  return c.slice(0, Math.max(0, MAX_LEVEL - 1));
})();

// Subir un terreno propio al siguiente nivel. "from" (opcional) es el nivel que ve el jugador: evita cobrar dos veces por un doble toque.
async function upgradeParcel(req, { id, from }) {
  const user = await needUser(req);
  const pack = await ensureUserPack(user);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const par = (await client.query('SELECT level FROM parcels WHERE id = $1 AND user_id = $2 FOR UPDATE', [String(id), user.id])).rows[0];
    if (!par) throw new HttpError(403, 'Este terreno no es tuyo');
    const level = Math.max(1, Math.min(MAX_LEVEL, Number(par.level) || 1));
    if (from != null && Number(from) !== level) throw new HttpError(409, 'El nivel de este terreno ya ha cambiado');
    if (level >= MAX_LEVEL) throw new HttpError(409, 'Este terreno ya está al nivel máximo');
    const cost = LEVEL_COSTS[level - 1];
    // Se cobra primero (la fila del pack queda bloqueada): así la hora de la mejora es posterior a cualquier recogida en curso
    const r = await client.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [cost, pack.code]);
    if (!r.rows[0]) throw new HttpError(402, 'NO TIENES CRÉDITOS PARA ESTA MEJORA. COMPRA CRÉDITOS.');
    await client.query('UPDATE parcels SET level = $1, level_at = $2 WHERE id = $3', [level + 1, Date.now(), String(id)]);
    await client.query('COMMIT');
    notifyFriendsOf(user.id, 'level', level + 1);
    return { ok: true, level: level + 1, credits: r.rows[0].credits, cost };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Suma, por cada terreno de la cuenta, el tiempo producido desde la última recogida (o desde que se reclamó), con tope.
// Cada terreno produce según su nivel. Si subió de nivel dentro del periodo que se está acumulando, el tiempo anterior a la
// mejora cuenta con el multiplicador del nivel anterior y el posterior con el nuevo: la mejora solo vale desde que se hace,
// así que subir de nivel justo antes de recoger no da créditos de más.
async function prodCompute(db, userId, lastCollect, carry, now) {
  const r = (await db.query(
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(wms), 0) AS wms,
            COALESCE(SUM(mc), 0) AS mult,
            COUNT(*) FILTER (WHERE e < $4::bigint) AS active,
            COALESCE(SUM(mc) FILTER (WHERE e < $4::bigint), 0) AS active_mult,
            MIN($4::bigint - e) FILTER (WHERE e < $4::bigint) AS next_cap
       FROM (SELECT e, mc,
                    LEAST(o, LEAST(e, $4::bigint)) * mp + (LEAST(e, $4::bigint) - LEAST(o, LEAST(e, $4::bigint))) * mc AS wms
               FROM (SELECT GREATEST($2::bigint - GREATEST(created_at, $3::bigint), 0) AS e,
                            GREATEST(COALESCE(level_at, 0) - GREATEST(created_at, $3::bigint), 0) AS o,
                            ($5::float8[])[LEAST(GREATEST(level, 1), ${MAX_LEVEL})] AS mc,
                            ($5::float8[])[LEAST(GREATEST(level - 1, 1), ${MAX_LEVEL})] AS mp
                       FROM parcels WHERE user_id = $1) a) s`,
    [userId, now, lastCollect || 0, Math.round(PROD_CAP_HOURS * HOUR_MS), LEVEL_MULTS])).rows[0];
  const n = Number(r.n);
  const total = (Number(carry) || 0) + (Number(r.wms) / HOUR_MS) * PROD_RATE;
  // active = terrenos que aún no han llegado al tope y siguen produciendo (activeMult: suma de sus multiplicadores);
  // next_cap = ms hasta que el primero llegue al tope
  return { parcels: n, perHour: Number(r.mult) * PROD_RATE, total, ready: Math.floor(total + 1e-9), active: Number(r.active),
    activeMult: Number(r.active_mult), nextCap: r.next_cap == null ? null : Number(r.next_cap) };
}

async function myParcels(req) {
  const user = await needUser(req);
  const rows = await all('SELECT id, x, y, avatar, country, level, created_at FROM parcels WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [user.id]);
  const total = (await one('SELECT COUNT(*) AS n FROM parcels WHERE user_id = $1', [user.id])).n;
  return { total, parcels: rows.map(r => ({ id: r.id, x: r.x, y: r.y, avatar: r.avatar, country: r.country, level: r.level, since: r.created_at })) };
}

async function productionGet(req) {
  const user = await needUser(req);
  const pack = await ensureUserPack(user);
  const p = await one('SELECT last_collect, prod_carry FROM packs WHERE code = $1', [pack.code]);
  const st = await prodCompute(pool, user.id, p && p.last_collect, p && p.prod_carry, Date.now());
  return { parcels: st.parcels, perHour: Math.round(st.perHour * 10000) / 10000, ready: st.ready, capHours: PROD_CAP_HOURS, rate: PROD_RATE,
    total: Math.round(st.total * 1e6) / 1e6, activeRate: st.activeMult * PROD_RATE, nextCapMs: st.nextCap };
}

async function productionCollect(req) {
  const user = await needUser(req);
  const pack = await ensureUserPack(user);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = (await client.query('SELECT code, credits, last_collect, prod_carry FROM packs WHERE code = $1 FOR UPDATE', [pack.code])).rows[0];
    const now = Date.now();
    const st = await prodCompute(client, user.id, p.last_collect, p.prod_carry, now);
    const amount = Math.floor(st.total + 1e-9);
    if (amount < 1) throw new HttpError(409, 'Todavía no hay créditos listos. Vuelve más tarde');
    const up = await client.query(
      'UPDATE packs SET credits = credits + $1, last_collect = $2, prod_carry = $3 WHERE code = $4 RETURNING credits',
      [amount, now, Math.max(0, st.total - amount), p.code]);
    await client.query('COMMIT');
    return { ok: true, collected: amount, credits: up.rows[0].credits };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ---------- Muñeco que pasea: da una fracción de crédito al tocarlo ----------
// La fracción se suma a prod_carry (el acumulado decimal de producción), que se recoge junto con lo producido por los terrenos.
// El servidor decide cuándo puede salir un muñeco y valida el toque, así que no se puede abusar llamando a la API a mano.
const WALKER_REWARD = Math.max(0, Number(process.env.WALKER_REWARD || 0.002));
const WALKER_GAP_MS = Math.max(10_000, Number(process.env.WALKER_GAP_MS || 90_000));   // mínimo entre muñecos de un mismo usuario
const WALKER_DAILY_MAX = Math.max(0, Number(process.env.WALKER_DAILY_MAX || 40));      // toques premiados por día y usuario
const WALKER_TTL_MS = 20_000;                                                          // lo que tarda en cruzar la pantalla (con margen)
const walkerState = new Map();   // userId -> { id, born, lastSpawn, day, count }  (en memoria)

function walkerOf(userId, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  let s = walkerState.get(userId);
  if (!s) { if (walkerState.size > 20000) walkerState.clear(); s = { id: null, born: 0, lastSpawn: 0, day, count: 0 }; walkerState.set(userId, s); }
  if (s.day !== day) { s.day = day; s.count = 0; }
  return s;
}

async function walkerSpawn(req) {
  const user = await needUser(req);
  const now = Date.now(), s = walkerOf(user.id, now);
  if (!WALKER_REWARD || s.count >= WALKER_DAILY_MAX) return { spawn: false, waitMs: 3_600_000 };
  const wait = s.lastSpawn + WALKER_GAP_MS - now;
  if (wait > 0) return { spawn: false, waitMs: wait };
  s.id = crypto.randomBytes(8).toString('hex'); s.born = now; s.lastSpawn = now;
  return { spawn: true, id: s.id, reward: WALKER_REWARD };
}

async function walkerTap(req, body) {
  const user = await needUser(req);
  const now = Date.now(), s = walkerOf(user.id, now);
  const id = body && body.id;
  if (!s.id || typeof id !== 'string' || id !== s.id) throw new HttpError(409, 'El muñeco ya se fue');
  const age = now - s.born;
  s.id = null;   // un solo uso
  if (age < 600 || age > WALKER_TTL_MS + 5000) throw new HttpError(409, 'El muñeco ya se fue');
  if (s.count >= WALKER_DAILY_MAX) throw new HttpError(429, 'Hoy ya has atrapado a todos los muñecos. ¡Vuelve mañana!');
  s.count++;
  const pack = await ensureUserPack(user);
  await one('UPDATE packs SET prod_carry = COALESCE(prod_carry, 0) + $1 WHERE code = $2 RETURNING code', [WALKER_REWARD, pack.code]);
  return { ok: true, reward: WALKER_REWARD, left: WALKER_DAILY_MAX - s.count };
}

// ---------- Jugadores en línea en tiempo real (SSE) ----------
// Cada pestaña abierta mantiene una conexión GET /api/online (Server-Sent Events). Se cuenta un jugador por
// identificador anónimo (cid), así que varias pestañas del mismo navegador cuentan como uno. Todo vive en memoria:
// no se guarda nada en la base de datos. Cuando el número cambia, el servidor se lo envía a todos los conectados.
const ONLINE_MAX_PER_IP = Math.max(1, Number(process.env.ONLINE_MAX_PER_IP || 60));   // conexiones abiertas por conexión de red
const onlineClients = new Map();   // cid -> Set de respuestas abiertas
const onlineByIp = new Map();      // ip -> nº de conexiones abiertas
let onlineSent = -1, onlineTimer = null;
const ONLINE_MIN = 500;   // lo que se muestra: 500 como mínimo; por encima de 500 es el número real
const onlineShown = () => Math.max(ONLINE_MIN, onlineClients.size);

function broadcastOnline(force) {
  const n = onlineShown();
  if (!force && n === onlineSent) return;
  onlineSent = n;
  const msg = `data: ${n}\n\n`;
  for (const set of onlineClients.values()) for (const r of set) { try { r.write(msg); } catch {} }
}
function scheduleOnlineBroadcast() {   // agrupa altas y bajas seguidas en un solo aviso
  if (onlineTimer) return;
  onlineTimer = setTimeout(() => { onlineTimer = null; broadcastOnline(false); }, 500);
}
// Cada 20 s se reenvía el número: sirve de latido (los proxies cortan conexiones mudas) y corrige cualquier desajuste
setInterval(() => broadcastOnline(true), 20_000).unref();

function onlineStream(req, res, url) {
  const ip = clientIp(req);
  if ((onlineByIp.get(ip) || 0) >= ONLINE_MAX_PER_IP) {
    res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Demasiadas conexiones');
  }
  const cid = String(url.searchParams.get('cid') || '').replace(/[^\w-]/g, '').slice(0, 40) || crypto.randomBytes(8).toString('hex');
  req.socket.setTimeout(0);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',          // que nginx y similares no retengan los avisos
    'X-Content-Type-Options': 'nosniff'
  });
  let set = onlineClients.get(cid);
  if (!set) { set = new Set(); onlineClients.set(cid, set); }
  set.add(res);
  onlineByIp.set(ip, (onlineByIp.get(ip) || 0) + 1);
  res.write(`retry: 3000\n\ndata: ${onlineShown()}\n\n`);   // el recién llegado ve el número al instante
  if (santaActive) res.write(`event: santa\ndata: ${JSON.stringify({ type: 'start', now: Date.now(), ev: santaPublic(santaActive) })}\n\n`);   // si Papá Noel está de visita, el recién llegado lo ve
  scheduleOnlineBroadcast();                                     // y los demás, medio segundo después
  let gone = false;
  const leave = () => {
    if (gone) return; gone = true;
    set.delete(res);
    if (!set.size && onlineClients.get(cid) === set) onlineClients.delete(cid);
    const k = (onlineByIp.get(ip) || 1) - 1;
    if (k > 0) onlineByIp.set(ip, k); else onlineByIp.delete(ip);
    scheduleOnlineBroadcast();
  };
  req.on('close', leave);
  res.on('error', leave);
}

// ---------- Chat por zona (radio de CHAT_RADIUS_KM) ----------
// Cada mensaje guarda el punto del mapa (redondeado a ~1 km) desde el que se envió, y se ve a CHAT_RADIUS_KM a la redonda
// (10 km por defecto). Leer es libre; escribir exige cuenta con apodo. Los mensajes se guardan 7 días.
// Antiabuso: 1 mensaje cada 3 s, 15 por minuto, sin repetir el mismo, sin enlaces y con lista de palabras prohibidas
// opcional (CHAT_BANNED="palabra1,palabra2"). El admin puede borrar mensajes (POST /api/chat/delete con la clave).
const CHAT_RADIUS_KM = Math.min(200, Math.max(1, Number(process.env.CHAT_RADIUS_KM || 10)));
const CHAT_MAX_LEN = 200, CHAT_KEEP_MS = 7 * 24 * 3600 * 1000, CHAT_HISTORY = 50;
const CHAT_MAX_PER_IP = Math.max(1, Number(process.env.CHAT_MAX_PER_IP || 30));
const CHAT_BANNED = String(process.env.CHAT_BANNED || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
const CHAT_EMOJIS = ['❤️', '😂', '👍', '😮', '🔥'];
const chatSubs = new Set();    // { res, lat, lng } de cada conexión abierta (SSE)
const chatByIp = new Map();    // ip -> nº de conexiones abiertas
const chatLast = new Map();    // user_id -> { t: [marcas de tiempo], text }
function cleanLatLng(lat, lng) {
  lat = Number(lat); lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}
function kmBetween(a, b) {   // distancia sobre la esfera (haversine)
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function chatBox(p) {   // rectángulo que contiene el círculo (filtro rápido en la base de datos)
  const dLat = CHAT_RADIUS_KM / 111, c = Math.cos(p.lat * Math.PI / 180);
  const dLng = c < 0.05 ? 360 : CHAT_RADIUS_KM / (111 * c);
  return [p.lat - dLat, p.lat + dLat, p.lng - dLng, p.lng + dLng];
}
function cleanChatText(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFC').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e<>]/g, '').replace(/\s+/g, ' ').trim();
  return s.length >= 1 && s.length <= CHAT_MAX_LEN ? s : null;
}
function chatPublish(at, payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const s of chatSubs) { if (kmBetween(at, s) <= CHAT_RADIUS_KM) { try { s.res.write(msg); } catch {} } }
}
setInterval(() => { for (const s of chatSubs) { try { s.res.write(': ping\n\n'); } catch {} } }, 20_000).unref();   // latido

function chatStream(req, res, url) {
  const at = cleanLatLng(url.searchParams.get('lat'), url.searchParams.get('lng'));
  const ip = clientIp(req);
  if (!at) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Posición no válida'); }
  if ((chatByIp.get(ip) || 0) >= CHAT_MAX_PER_IP) { res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Demasiadas conexiones'); }
  req.socket.setTimeout(0);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff'
  });
  res.write('retry: 3000\n\n: ok\n\n');
  const sub = { res, lat: at.lat, lng: at.lng };
  chatSubs.add(sub);
  chatByIp.set(ip, (chatByIp.get(ip) || 0) + 1);
  let gone = false;
  const leave = () => {
    if (gone) return; gone = true;
    chatSubs.delete(sub);
    const k = (chatByIp.get(ip) || 1) - 1;
    if (k > 0) chatByIp.set(ip, k); else chatByIp.delete(ip);
  };
  req.on('close', leave);
  res.on('error', leave);
}

const chatRow = r => ({ id: Number(r.id), nick: r.nick, avatar: r.avatar, country: r.country, text: r.text, t: Number(r.created_at) });
// Mensajes del radio (más nuevos que "after" si se indica). Añade las reacciones de cada uno y, si hay sesión, la tuya.
async function chatList(req, url) {
  const at = cleanLatLng(url.searchParams.get('lat'), url.searchParams.get('lng'));
  if (!at) throw new HttpError(400, 'Posición no válida');
  const after = Math.max(0, Math.floor(Number(url.searchParams.get('after')) || 0));
  const [s, n, w, e] = chatBox(at);
  const near = rows => rows.filter(r => kmBetween(at, r) <= CHAT_RADIUS_KM);
  let rows;
  if (after) rows = near(await all('SELECT id, nick, avatar, country, text, created_at, lat, lng FROM chat_msgs WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4 AND id > $5 ORDER BY id ASC LIMIT 200', [s, n, w, e, after]));
  else rows = near(await all('SELECT id, nick, avatar, country, text, created_at, lat, lng FROM chat_msgs WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4 ORDER BY id DESC LIMIT 300', [s, n, w, e])).slice(0, CHAT_HISTORY).reverse();
  const messages = rows.map(chatRow);
  if (messages.length) {
    const ids = messages.map(m => m.id);
    const cnt = await all('SELECT msg_id, emoji, COUNT(*) AS n FROM chat_reacts WHERE msg_id = ANY($1::bigint[]) GROUP BY msg_id, emoji', [ids]);
    const user = await userFrom(req);
    const mine = user ? await all('SELECT msg_id, emoji FROM chat_reacts WHERE user_id = $1 AND msg_id = ANY($2::bigint[])', [user.id, ids]) : [];
    const by = new Map(messages.map(m => [m.id, m]));
    for (const m of messages) { m.r = {}; m.mine = null; }
    for (const c of cnt) { const m = by.get(Number(c.msg_id)); if (m) m.r[c.emoji] = Number(c.n); }
    for (const c of mine) { const m = by.get(Number(c.msg_id)); if (m) m.mine = c.emoji; }
  }
  return { messages, km: CHAT_RADIUS_KM };
}
// ¿Hay mensajes nuevos en tu radio? (para el punto rojo del botón). Sin "seen" solo devuelve cuál es el último.
async function chatUnread(url) {
  const at = cleanLatLng(url.searchParams.get('lat'), url.searchParams.get('lng'));
  if (!at) throw new HttpError(400, 'Posición no válida');
  const hasSeen = url.searchParams.has('seen');
  const seen = Math.max(0, Math.floor(Number(url.searchParams.get('seen')) || 0));
  const [s, n, w, e] = chatBox(at);
  const rows = (await all('SELECT id, lat, lng FROM chat_msgs WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4 AND id > $5 ORDER BY id DESC LIMIT 100', [s, n, w, e, seen]))
    .filter(r => kmBetween(at, r) <= CHAT_RADIUS_KM);
  return { n: hasSeen ? rows.length : 0, last: rows.length ? Number(rows[0].id) : seen };
}
async function chatSend(req, body) {
  const user = await needUser(req);
  const prof = await getProfile(user.id);
  if (!prof) throw new HttpError(403, 'Elige tu apodo para poder escribir');
  const at = cleanLatLng(body && body.lat, body && body.lng);
  if (!at) throw new HttpError(400, 'Posición no válida');
  const text = cleanChatText(body && body.text);
  if (!text) throw new HttpError(400, `Escribe un mensaje (máximo ${CHAT_MAX_LEN} caracteres)`);
  const low = text.toLowerCase();
  if (/https?:\/\/|www\./.test(low)) throw new HttpError(400, 'No se pueden enviar enlaces');
  if (CHAT_BANNED.some(w => low.includes(w))) throw new HttpError(400, 'Mensaje no permitido');
  const now = Date.now();
  const st = chatLast.get(user.id) || { t: [], text: '' };
  st.t = st.t.filter(x => now - x < 60_000);
  if (st.t.length && now - st.t[st.t.length - 1] < 3000) throw new HttpError(429, 'Vas muy rápido: espera unos segundos');
  if (st.t.length >= 15) throw new HttpError(429, 'Demasiados mensajes: espera un poco');
  if (st.text === low) throw new HttpError(429, 'No repitas el mismo mensaje');
  st.t.push(now); st.text = low;
  if (chatLast.size > 5000) chatLast.clear();
  chatLast.set(user.id, st);
  const avatar = cleanAvatar(body.avatar), country = cleanCountry(body.country);
  const zone = Math.floor((at.lng + 180) / 0.02) + ':' + Math.floor((at.lat + 90) / 0.02);   // columna antigua, ya sin uso
  const row = await one('INSERT INTO chat_msgs (zone, user_id, nick, avatar, country, text, created_at, lat, lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
    [zone, user.id, prof.nickname, avatar, country, text, now, at.lat, at.lng]);
  const msg = { id: Number(row.id), nick: prof.nickname, avatar, country, text, t: now, r: {}, mine: null };
  chatPublish(at, msg);
  return { ok: true, message: msg };
}
// Reaccionar con un emoji (uno por persona y mensaje; tocar el mismo otra vez lo quita)
async function chatReact(req, body) {
  const user = await needUser(req);
  const id = Math.floor(Number(body && body.id));
  const emoji = body && body.emoji;
  if (!Number.isFinite(id) || id < 1 || !CHAT_EMOJIS.includes(emoji)) throw new HttpError(400, 'Reacción no válida');
  const m = await one('SELECT lat, lng FROM chat_msgs WHERE id = $1', [id]);
  if (!m) throw new HttpError(404, 'Ese mensaje ya no existe');
  const cur = await one('SELECT emoji FROM chat_reacts WHERE msg_id = $1 AND user_id = $2', [id, user.id]);
  let mine = emoji;
  if (cur && cur.emoji === emoji) { await run('DELETE FROM chat_reacts WHERE msg_id = $1 AND user_id = $2', [id, user.id]); mine = null; }
  else await run('INSERT INTO chat_reacts (msg_id, user_id, emoji) VALUES ($1,$2,$3) ON CONFLICT (msg_id, user_id) DO UPDATE SET emoji = $3', [id, user.id, emoji]);
  const r = {};
  for (const c of await all('SELECT emoji, COUNT(*) AS n FROM chat_reacts WHERE msg_id = $1 GROUP BY emoji', [id])) r[c.emoji] = Number(c.n);
  if (m.lat != null) chatPublish({ lat: m.lat, lng: m.lng }, { react: { id, r } });
  return { ok: true, id, r, mine };
}
async function chatDelete(req, body) {
  if (!isAdmin(req)) throw new HttpError(403, 'No autorizado');
  const id = Math.floor(Number(body && body.id));
  if (!Number.isFinite(id) || id < 1) throw new HttpError(400, 'Mensaje no válido');
  const row = await one('DELETE FROM chat_msgs WHERE id = $1 RETURNING lat, lng', [id]);
  await run('DELETE FROM chat_reacts WHERE msg_id = $1', [id]);
  if (row && row.lat != null) chatPublish({ lat: row.lat, lng: row.lng }, { del: id });
  return { ok: true };
}

// ---------- Amigos ----------
// Lista de amigos de cada cuenta (en un solo sentido: no hace falta que el otro acepte). Se añade desde el chat tocando
// el apodo: el cliente manda el id del mensaje y el servidor busca la cuenta, así nunca se expone el id de usuario.
const FRIENDS_MAX = 100;
const friendPushAt = new Map();   // 'quien>amigo' -> última vez que se avisó
async function friendsList(req) {
  const user = await needUser(req);
  const rows = await all('SELECT f.friend_id, p.nickname FROM friends f JOIN profiles p ON p.user_id::text = f.friend_id WHERE f.user_id = $1 ORDER BY f.created_at DESC', [user.id]);
  const ids = rows.map(r => r.friend_id);
  const ps = ids.length ? await all('SELECT DISTINCT ON (user_id::text) user_id::text AS uid, x, y, avatar, country FROM parcels WHERE user_id::text = ANY($1::text[]) ORDER BY user_id::text, created_at ASC', [ids]) : [];
  const byUser = new Map(ps.map(p => [p.uid, p]));
  return {
    friends: rows.map(r => {
      const p = byUser.get(String(r.friend_id));
      return { nick: r.nickname, avatar: p ? p.avatar : null, country: p ? p.country : null,
        lat: p ? p.y * SIZE - 90 + SIZE / 2 : null, lng: p ? p.x * SIZE - 180 + SIZE / 2 : null };
    })
  };
}
async function friendsAdd(req, body) {
  const user = await needUser(req);
  const id = Math.floor(Number(body && body.msgId));
  if (!Number.isFinite(id) || id < 1) throw new HttpError(400, 'Mensaje no válido');
  const m = await one('SELECT user_id, nick FROM chat_msgs WHERE id = $1', [id]);
  if (!m) throw new HttpError(404, 'Ese mensaje ya no existe');
  if (m.user_id === user.id) throw new HttpError(400, 'Ese eres tú');
  const n = Number((await one('SELECT COUNT(*) AS n FROM friends WHERE user_id = $1', [user.id])).n);
  if (n >= FRIENDS_MAX) throw new HttpError(409, `Máximo ${FRIENDS_MAX} amigos`);
  const ins = await run('INSERT INTO friends (user_id, friend_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [user.id, m.user_id, Date.now()]);
  if (ins.rowCount === 1 && PUSH_ON) {   // avisa al nuevo amigo (como mucho una vez al día por pareja)
    const key = user.id + '>' + m.user_id, last = friendPushAt.get(key) || 0;
    if (Date.now() - last > 24 * 3600_000) {
      friendPushAt.set(key, Date.now());
      if (friendPushAt.size > 5000) friendPushAt.clear();
      getProfile(user.id).then(me => me && pushSocial(m.user_id, { title: '👥 Nuevo amigo', body: `${me.nickname} te ha añadido como amigo.`, tag: 'friend', url: '/' })).catch(() => {});
    }
  }
  return { ok: true, nick: m.nick };
}
async function friendsRemove(req, body) {
  const user = await needUser(req);
  const nick = cleanName(body && body.nick);
  const f = nick && await one('SELECT user_id FROM profiles WHERE nickname = $1', [nick]);
  if (f) await run('DELETE FROM friends WHERE user_id = $1 AND friend_id = $2', [user.id, f.user_id]);
  return { ok: true };
}

// ---------- Ranking por ciudades ----------
// El país lo elige el jugador al reclamar, pero la ciudad se averigua sola a partir de las coordenadas del terreno
// (geocodificación inversa con Nominatim, como mucho 1 consulta por segundo). Los terrenos antiguos se van rellenando
// solos en segundo plano. CITY_GEOCODE=0 lo desactiva. CITY_CONTACT = email/web de contacto (Nominatim lo pide).
const CITY_GEOCODE = process.env.CITY_GEOCODE !== '0';
const CITY_NONE = 'Sin ciudad';
const cityCache = new Map();   // celda de ~500 m -> nombre de la ciudad
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
async function reverseCity(lat, lng) {
  const key = Math.round(lat / 0.005) + ',' + Math.round(lng / 0.005);
  if (cityCache.has(key)) return { name: cityCache.get(key), cached: true };
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=es&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}`,
    { headers: { 'User-Agent': 'atlas-terrenos/1.0 (' + (process.env.CITY_CONTACT || 'https://atlas-terrenos.onrender.com') + ')' }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error('Nominatim ' + r.status);
  const a = ((await r.json()) || {}).address || {};
  const name = String(a.city || a.town || a.village || a.municipality || a.hamlet || a.county || '').trim().slice(0, 80) || CITY_NONE;
  if (cityCache.size > 20000) cityCache.clear();
  cityCache.set(key, name);
  return { name, cached: false };
}
let cityBusy = false;
async function cityTick() {
  if (cityBusy) return;
  cityBusy = true;
  try {
    for (let i = 0; i < 300; i++) {
      const p = await one('SELECT id, x, y FROM parcels WHERE city IS NULL AND (city_try IS NULL OR city_try < $1) ORDER BY created_at DESC LIMIT 1', [Date.now() - 3600_000]);
      if (!p) break;
      try {
        const { name, cached } = await reverseCity(p.y * SIZE - 90 + SIZE / 2, p.x * SIZE - 180 + SIZE / 2);
        await run('UPDATE parcels SET city = $1 WHERE id = $2', [name, p.id]);
        if (!cached) await sleepMs(1100);   // respeta el límite de Nominatim
      } catch (e) {
        await run('UPDATE parcels SET city_try = $1 WHERE id = $2', [Date.now(), p.id]).catch(() => {});   // reintenta dentro de 1 h
        await sleepMs(3000);
      }
    }
  } catch (e) { console.error('Ciudades:', e.message); }
  cityBusy = false;
}
// filas {city, owner, n} -> ciudades con más terrenos y, en cada una, sus propietarios
function groupCities(rows, maxCities = 20, maxOwners = 10) {
  const by = new Map();
  for (const r of rows) {
    const c = by.get(r.city) || { city: r.city, n: 0, owners: [] };
    c.n += Number(r.n); c.owners.push({ owner: r.owner, n: Number(r.n) });
    by.set(r.city, c);
  }
  return [...by.values()].sort((a, b) => b.n - a.n || a.city.localeCompare(b.city)).slice(0, maxCities)
    .map(c => ({ ...c, owners: c.owners.sort((a, b) => b.n - a.n || a.owner.localeCompare(b.owner)).slice(0, maxOwners) }));
}
async function rankCities(url) {
  const country = cleanCountry(url.searchParams.get('country'));
  if (!country) throw new HttpError(400, 'País no válido');
  const rows = await all('SELECT city, owner, COUNT(*) AS n FROM parcels WHERE country = $1 AND city IS NOT NULL AND city <> $2 GROUP BY city, owner', [country, CITY_NONE]);
  const other = Number((await one('SELECT COUNT(*) AS n FROM parcels WHERE country = $1 AND (city IS NULL OR city = $2)', [country, CITY_NONE])).n);
  return { country, cities: groupCities(rows), other };
}

// ---------- Avisos al móvil (notificaciones push) ----------
// Hace falta el paquete "web-push" y un par de claves VAPID (npx web-push generate-vapid-keys) en las variables
// VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY (y VAPID_SUBJECT, p. ej. mailto:tu@correo.com). Sin ellas, los avisos quedan desactivados.
// Avisos: "racha en peligro" (tarde), "producción a punto de llenarse", "producción lista", "regalo diario" y "X te ha añadido como amigo". Para no molestar: nada de noche (solo entre
// las 10:00 y las 21:00 hora del jugador), 6 h mínimo entre avisos y se paran tras 3 avisos sin que el jugador vuelva a entrar.
let webpush = null;
try { webpush = require('web-push'); } catch { /* sin el paquete: avisos desactivados */ }
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '', VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const PUSH_ON = !!(webpush && VAPID_PUBLIC && VAPID_PRIVATE);
if (PUSH_ON) {
  try { webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://atlas-terrenos.onrender.com', VAPID_PUBLIC, VAPID_PRIVATE); }
  catch (e) { console.error('Claves VAPID no válidas, avisos desactivados:', e.message); }
}
const PUSH_QUIET_FROM = 10, PUSH_QUIET_TO = 21, PUSH_GAP_MS = 6 * 3600_000, PUSH_MAX_UNSEEN = 3, PUSH_MAX_SUBS = 5;
const cleanTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: String(tz) }); return String(tz).slice(0, 60); } catch { return 'Europe/Madrid'; } };

async function pushToUser(userId, payload) {
  if (!PUSH_ON) return false;
  const subs = await all('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = $1', [userId]);
  let sent = false;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent = true;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await run('DELETE FROM push_subs WHERE endpoint = $1', [s.endpoint]).catch(() => {});   // el móvil ya no acepta avisos
    }
  }
  return sent;
}

async function pushSubscribe(req, body) {
  if (!PUSH_ON) throw new HttpError(503, 'Los avisos no están disponibles');
  const user = await needUser(req);
  const sub = body && body.subscription;
  const endpoint = sub && typeof sub.endpoint === 'string' ? sub.endpoint : '';
  const k = sub && sub.keys;
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !k || typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || k.p256dh.length > 200 || k.auth.length > 100)
    throw new HttpError(400, 'Suscripción no válida');
  const now = Date.now();
  await run(`INSERT INTO push_subs (endpoint, user_id, p256dh, auth, tz, created_at) VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (endpoint) DO UPDATE SET user_id = $2, p256dh = $3, auth = $4, tz = $5`, [endpoint, user.id, k.p256dh, k.auth, cleanTz(body.tz), now]);
  await run('DELETE FROM push_subs WHERE user_id = $1 AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2)', [user.id, PUSH_MAX_SUBS]);
  await run(`INSERT INTO push_state (user_id, last_seen, unseen) VALUES ($1,$2,0) ON CONFLICT (user_id) DO UPDATE SET last_seen = $2, unseen = 0`, [user.id, now]);   // volver a entrar reactiva los avisos
  return { ok: true };
}
async function pushUnsubscribe(req, body) {
  const user = await needUser(req);
  if (body && typeof body.endpoint === 'string') await run('DELETE FROM push_subs WHERE endpoint = $1 AND user_id = $2', [body.endpoint, user.id]);
  return { ok: true };
}

// Avisos sociales (amigos): respetan la hora tranquila, el tope de avisos sin volver a entrar y 2 h mínimo entre avisos
async function pushSocial(userId, payload) {
  if (!PUSH_ON) return false;
  const sub = await one('SELECT MAX(tz) AS tz FROM push_subs WHERE user_id = $1', [userId]);
  if (!sub) return false;
  const now = Date.now();
  let hour; try { hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: sub.tz || 'Europe/Madrid' }).format(now)); } catch { hour = 12; }
  if (hour < PUSH_QUIET_FROM || hour >= PUSH_QUIET_TO) return false;
  const st = await one('SELECT unseen, last_any FROM push_state WHERE user_id = $1', [userId]);
  if (st && (st.unseen >= PUSH_MAX_UNSEEN || now - Number(st.last_any || 0) < 2 * 3600_000)) return false;
  if (!await pushToUser(userId, payload)) return false;
  await run(`INSERT INTO push_state (user_id, last_any, unseen) VALUES ($1,$2,1) ON CONFLICT (user_id) DO UPDATE SET last_any = $2, unseen = push_state.unseen + 1`, [userId, now]);
  return true;
}
// Avisa a quienes tienen a este jugador como amigo: reclama un terreno o sube uno de nivel (máx. 1 aviso por pareja cada 6 h)
const socialAt = new Map();
async function notifyFriendsOf(userId, kind, level) {
  if (!PUSH_ON) return;
  try {
    const me = await getProfile(userId);
    if (!me) return;
    const rows = await all('SELECT user_id FROM friends WHERE friend_id = $1 LIMIT 200', [userId]);
    const now = Date.now();
    for (const r of rows) {
      const key = userId + '>' + r.user_id;
      if (now - (socialAt.get(key) || 0) < 6 * 3600_000) continue;
      if (await pushSocial(r.user_id, kind === 'claim'
        ? { title: '🏡 Tu amigo ha comprado un terreno', body: `${me.nickname} ha reclamado un terreno nuevo.`, tag: 'friend-act', url: '/' }
        : { title: '⭐ Tu amigo ha subido de nivel', body: `${me.nickname} ha subido un terreno al nivel ${level}.`, tag: 'friend-act', url: '/' })) {
        socialAt.set(key, now);
        if (socialAt.size > 5000) socialAt.clear();
      }
    }
  } catch (e) { console.error('push social:', e.message); }
}

let pushBusy = false;
const PUSH_STREAK_FROM = 18, PUSH_STREAK_GAP_MS = 2 * 3600_000, PUSH_FULL_SOON_MS = 2 * 3600_000;
async function pushRun() {
  if (!PUSH_ON || pushBusy) return;
  pushBusy = true;
  try {
    const users = await all('SELECT user_id, MAX(tz) AS tz FROM push_subs GROUP BY user_id LIMIT 2000');
    for (const u of users) {
      try {
        const now = Date.now();
        let hour; try { hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: u.tz || 'Europe/Madrid' }).format(now)); } catch { hour = 12; }
        if (hour < PUSH_QUIET_FROM || hour >= PUSH_QUIET_TO) continue;
        const st = await one('SELECT * FROM push_state WHERE user_id = $1', [u.user_id]);
        if (st && st.unseen >= PUSH_MAX_UNSEEN) continue;
        const since = st ? now - Number(st.last_any || 0) : Infinity;   // tiempo desde el último aviso
        if (since < PUSH_STREAK_GAP_MS) continue;
        const roomy = since >= PUSH_GAP_MS;                              // ¿ha pasado el descanso normal entre avisos?
        const pack = await one('SELECT last_collect, prod_carry, last_daily, streak FROM packs WHERE user_id = $1', [u.user_id]);
        const day = dayKey(), info = dailyInfo(pack);
        let payload = null, field = null, value = null;

        // 1) La racha se pierde hoy: solo por la tarde y con un descanso más corto, porque es el aviso que más importa
        if (info.canClaim && info.streak > 0 && hour >= PUSH_STREAK_FROM && (!st || st.last_daily_push !== day + '!')) {
          const left = 6 - info.dayInCycle;
          payload = { title: `🔥 ¡Tu racha de ${info.streak} ${info.streak === 1 ? 'día' : 'días'} se acaba hoy!`,
            body: left === 0 ? `Hoy toca el premio grande: +${info.next} créditos. ¡No lo pierdas!` : `Entra y reclama tu regalo diario. ${left === 1 ? 'Mañana' : `En ${left} días`} llega el premio grande.`,
            tag: 'streak', url: '/' };
          field = 'last_daily_push'; value = day + '!';
        }
        if (!payload && !roomy) continue;

        let pr = null;
        if (!payload && pack) {
          pr = await prodCompute(pool, u.user_id, pack.last_collect, pack.prod_carry, now);
          const lastProd = st ? Number(st.last_prod_push || 0) : 0, lastFull = st ? Number(st.last_full_push || 0) : 0;
          // 2) Un terreno está a punto de llenarse (deja de producir): una vez por recogida
          if (pr.ready >= 1 && pr.nextCap != null && pr.nextCap <= PUSH_FULL_SOON_MS && lastFull < Number(pack.last_collect || 0)) {
            const h = Math.max(1, Math.ceil(pr.nextCap / 3600_000));
            payload = { title: '⏳ Tu producción se llena pronto', body: `En ${h} ${h === 1 ? 'hora' : 'horas'} un terreno dejará de producir. Recoge tus ${pr.ready} ${pr.ready === 1 ? 'crédito' : 'créditos'}.`, tag: 'full', url: '/' };
            field = 'last_full_push'; value = now;
          }
          // 3) Hay créditos listos
          else if (pr.ready >= 1 && (lastProd < Number(pack.last_collect || 0) || now - lastProd > 24 * 3600_000)) {
            payload = { title: '🎟️ ¡Producción lista!', body: `Tus terrenos han producido ${pr.ready} ${pr.ready === 1 ? 'crédito' : 'créditos'}. Entra a recogerlos.`, tag: 'prod', url: '/' };
            field = 'last_prod_push'; value = now;
          }
        }
        // 4) Regalo diario por la mañana
        if (!payload && info.canClaim && (!st || (st.last_daily_push !== day && st.last_daily_push !== day + '!'))) {
          const s = info.streak;
          payload = { title: '🎁 Tu regalo diario te espera', body: s > 0 ? `Llevas ${s} ${s === 1 ? 'día' : 'días'} seguidos: ¡no pierdas la racha!` : 'Entra hoy y empieza tu racha.', tag: 'daily', url: '/' };
          field = 'last_daily_push'; value = day;
        }
        if (!payload) continue;
        if (await pushToUser(u.user_id, payload)) {
          await run(`INSERT INTO push_state (user_id, last_any, unseen, ${field}) VALUES ($1,$2,1,$3)
                     ON CONFLICT (user_id) DO UPDATE SET last_any = $2, unseen = push_state.unseen + 1, ${field} = $3`, [u.user_id, now, value]);
        }
      } catch (e) { console.error('push:', e.message); }
    }
  } catch (e) { console.error('push:', e.message); }
  finally { pushBusy = false; }
}

// ---------- Invita y gana ----------
// Cada cuenta tiene un código de invitación (enlace /?ref=CODIGO). Cuando un jugador NUEVO entra con ese enlace,
// crea su cuenta y reclama su primer terreno, el que invita gana créditos y el invitado recibe un regalo de bienvenida.
// Antiabuso: solo cuentan jugadores sin terrenos, una invitación por cuenta, tope por invitador (total y en 24 h)
// y no se premia al invitador si el invitado entró desde la misma conexión de red que él.
const REF_INVITER_REWARD = Math.max(0, Math.floor(Number(process.env.REF_INVITER_REWARD ?? 2)));   // créditos para quien invita
const REF_INVITEE_REWARD = Math.max(0, Math.floor(Number(process.env.REF_INVITEE_REWARD ?? 1)));   // créditos de bienvenida
const REF_MAX_REWARDED = Math.max(1, Number(process.env.REF_MAX_REWARDED || 50));                  // invitaciones premiadas por cuenta
const REF_DAILY_MAX = Math.max(1, Number(process.env.REF_DAILY_MAX || 5));                         // y por cada 24 h
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0/O/1/I para que no se confundan
const newRefCode = () => Array.from(crypto.randomBytes(7), b => REF_ALPHABET[b % 32]).join('');
const refIpHash = req => crypto.createHash('sha256').update('ref:' + clientIp(req) + DAILY_SALT).digest('hex');

async function refCodeFor(userId, ipHash) {
  let row = await one('SELECT code FROM ref_codes WHERE user_id = $1', [userId]);
  for (let i = 0; i < 5 && !row; i++) {
    try { await run('INSERT INTO ref_codes (code, user_id, created_at, last_ip) VALUES ($1,$2,$3,$4)', [newRefCode(), userId, Date.now(), ipHash]); }
    catch (e) { if (!isUniqueViolation(e)) throw e; }
    row = await one('SELECT code FROM ref_codes WHERE user_id = $1', [userId]);
  }
  if (!row) throw new HttpError(500, 'No se pudo crear tu enlace de invitación');
  if (ipHash) await run('UPDATE ref_codes SET last_ip = $1 WHERE user_id = $2', [ipHash, userId]);
  return row.code;
}

async function refGet(req) {
  const user = await needUser(req);
  const code = await refCodeFor(user.id, refIpHash(req));
  const s = await one(
    `SELECT COUNT(*) FILTER (WHERE rewarded_at IS NOT NULL) AS done,
            COUNT(*) FILTER (WHERE rewarded_at IS NULL) AS pending,
            COALESCE(SUM(inviter_credits), 0) AS earned
       FROM referrals WHERE inviter_id = $1`, [user.id]);
  return { code, done: Number(s.done), pending: Number(s.pending), earned: Number(s.earned),
    inviterReward: REF_INVITER_REWARD, inviteeReward: REF_INVITEE_REWARD, max: REF_MAX_REWARDED };
}

// El invitado, ya con cuenta, apunta de quién viene (una sola vez y solo si aún no tiene terrenos)
async function refAttach(req, { code }) {
  const user = await needUser(req);
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (c.length < 5) throw new HttpError(400, 'Enlace de invitación no válido');
  const inv = await one('SELECT user_id FROM ref_codes WHERE code = $1', [c]);
  if (!inv) throw new HttpError(404, 'Enlace de invitación no válido');
  if (inv.user_id === user.id) throw new HttpError(400, 'No puedes invitarte a ti mismo');
  if (await one('SELECT 1 AS ok FROM referrals WHERE invitee_id = $1', [user.id])) throw new HttpError(409, 'Ya usaste una invitación');
  const owned = Number((await one('SELECT COUNT(*) AS n FROM parcels WHERE user_id = $1', [user.id])).n);
  if (owned > 0) throw new HttpError(409, 'Las invitaciones son solo para jugadores nuevos');
  try {
    await run('INSERT INTO referrals (invitee_id, inviter_id, created_at, ip_hash) VALUES ($1,$2,$3,$4)', [user.id, inv.user_id, Date.now(), refIpHash(req)]);
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'Ya usaste una invitación');
    throw e;
  }
  return { ok: true, bonus: REF_INVITEE_REWARD };
}

// Se llama tras el primer terreno reclamado: paga a los dos (una sola vez por invitado)
async function rewardReferral(userId, claimPackCode) {
  const ref = await one('UPDATE referrals SET rewarded_at = $1 WHERE invitee_id = $2 AND rewarded_at IS NULL RETURNING inviter_id, ip_hash', [Date.now(), userId]);
  if (!ref) return null;
  let gives = REF_INVITER_REWARD;
  const paid = await one('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE rewarded_at > $2) AS recent FROM referrals WHERE inviter_id = $1 AND inviter_credits > 0',
    [ref.inviter_id, Date.now() - 86_400_000]);
  if (Number(paid.total) >= REF_MAX_REWARDED || Number(paid.recent) >= REF_DAILY_MAX) gives = 0;
  const owner = await one('SELECT last_ip FROM ref_codes WHERE user_id = $1', [ref.inviter_id]);
  if (owner && owner.last_ip && ref.ip_hash && owner.last_ip === ref.ip_hash) gives = 0;   // misma conexión: parece una cuenta propia
  if (gives > 0) {
    await ensureUserPack({ id: ref.inviter_id });
    await run('UPDATE packs SET credits = credits + $1 WHERE user_id = $2', [gives, ref.inviter_id]);
    await run('UPDATE referrals SET inviter_credits = $1 WHERE invitee_id = $2', [gives, userId]);
  }
  if (REF_INVITEE_REWARD > 0) await run('UPDATE packs SET credits = credits + $1 WHERE code = $2', [REF_INVITEE_REWARD, claimPackCode]);
  return { inviteeBonus: REF_INVITEE_REWARD };
}

async function route(req, res, url) {
  const { pathname: pn, searchParams: sp } = url;
  // Límite de peticiones por conexión: 240 por minuto en total y 40 por minuto las que modifican datos
  const ip = clientIp(req);
  if (rateHit('api:' + ip, 60_000) > 240) throw new HttpError(429, 'Demasiadas peticiones. Espera un momento');
  if (req.method !== 'GET' && rateHit('post:' + ip, 60_000) > 40) throw new HttpError(429, 'Demasiadas peticiones. Espera un momento');

  if (req.method === 'POST' && pn === '/api/admin/claim') {
    requireAdmin(req);
    return adminClaimParcel(await readJson(req));
  }
  if (req.method === 'POST' && pn === '/api/admin/santa') {   // prueba: hace venir a Papá Noel ahora mismo
    requireAdmin(req);
    return { started: await santaStart(true) };
  }
  if (req.method === 'GET' && pn === '/api/admin/stats') return adminStats(req);
  if (req.method === 'POST' && pn === '/api/visit') return registerVisit(req);
  if (req.method === 'GET' && pn === '/api/config')
    return { push: PUSH_ON ? { key: VAPID_PUBLIC } : null, chatKm: CHAT_RADIUS_KM, demo: DEMO, stripe: !DEMO && HAS_STRIPE, paypal: !DEMO && HAS_PAYPAL, clientId: (DEMO || !HAS_PAYPAL) ? null : PAYPAL_CLIENT_ID, currency: CURRENCY, price: PACKS[0].price, size: SIZE, packSize: PACKS[0].credits, packs: PACKS,
      maxParcels: MAX_PARCELS_PER_ACCOUNT, houseCost: HOUSE_COST, levels: { costs: LEVEL_COSTS, mults: LEVEL_MULTS }, auth: { enabled: AUTH_ENABLED, required: REQUIRE_LOGIN, url: AUTH_ENABLED ? SUPABASE_URL : null, anonKey: AUTH_ENABLED ? SUPABASE_ANON_KEY : null } };

  if (req.method === 'GET' && pn === '/api/parcel') {
    const p = parcelFromLatLng(Number(sp.get('lat')), Number(sp.get('lng')));
    if (!p) throw new HttpError(400, 'Coordenadas no válidas');
    const row = await q.parcelById(p.id);
    const user = row && row.user_id ? await userFrom(req) : null;
    return { ...p, owner: row ? row.owner : null, since: row ? row.created_at : null, avatar: row ? row.avatar : null, country: row ? row.country : null,
      house: row ? row.house : null, level: row ? row.level : null, mine: !!(user && row && row.user_id === user.id) };
  }

  if (req.method === 'GET' && pn === '/api/parcels') {
    const [s, w, n, e] = ['south', 'west', 'north', 'east'].map(k => Number(sp.get(k)));
    if (![s, w, n, e].every(Number.isFinite) || n - s > 0.3 || e - w > 0.3) throw new HttpError(400, 'Zona demasiado grande');
    const x0 = Math.max(0, Math.floor((w + 180) / SIZE)), x1 = Math.min(MAX_X - 1, Math.floor((e + 180) / SIZE));
    const y0 = Math.max(0, Math.floor((s + 90) / SIZE)), y1 = Math.min(MAX_Y - 1, Math.floor((n + 90) / SIZE));
    return (await q.parcelsInBox(x0, x1, y0, y1)).map(r => ({ id: r.id, x: r.x, y: r.y, owner: r.owner, avatar: r.avatar, country: r.country, house: r.house, level: r.level }));
  }

  if (req.method === 'GET' && pn === '/api/santa') return santaGet(req);
  if (req.method === 'POST' && pn === '/api/santa/seen') return santaSeen(req);
  if (req.method === 'GET' && pn === '/api/health') return { ok: true };   // la pantalla de carga del sitio estático pregunta aquí si ya despertó
  if (req.method === 'GET' && pn === '/api/online/count') return { online: onlineShown() };
  if (req.method === 'GET' && pn === '/api/ref') return refGet(req);
  if (req.method === 'POST' && pn === '/api/ref/attach') return refAttach(req, await readJson(req));
  if (req.method === 'GET' && pn === '/api/rank/cities') return rankCities(url);
  if (req.method === 'GET' && pn === '/api/stats')
    return { sold: (await q.count()).n, top: await q.top(), countries: await q.topCountries() };

  if (req.method === 'POST' && pn === '/api/packs/orders') return createPackOrder(req, await readJson(req));
  const pm = pn.match(/^\/api\/packs\/orders\/([^/]+)\/capture$/);
  if (req.method === 'POST' && pm) return capturePackOrder(req, decodeURIComponent(pm[1]));
  if (req.method === 'GET' && pn === '/api/pack') return { credits: (await getPack(req)).credits };
  if (req.method === 'GET' && pn === '/api/daily') return dailyGet(req);
  if (req.method === 'POST' && pn === '/api/daily/claim') return dailyClaim(req);
  if (req.method === 'GET' && pn === '/api/roulette') return rouletteGet(req);
  if (req.method === 'POST' && pn === '/api/roulette/spin') return rouletteSpin(req);
  if (req.method === 'POST' && pn === '/api/parcel/house') return setHouse(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/parcel/upgrade') return upgradeParcel(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/claim') return claimWithCredit(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/auth/link') return linkAccount(req);
  if (req.method === 'GET' && pn === '/api/profile') return profileGet(req);
  if (req.method === 'POST' && pn === '/api/profile') return profileSet(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/push/subscribe') return pushSubscribe(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/push/unsubscribe') return pushUnsubscribe(req, await readJson(req));
  if (req.method === 'GET' && pn === '/api/friends') return friendsList(req);
  if (req.method === 'POST' && pn === '/api/friends/add') return friendsAdd(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/friends/remove') return friendsRemove(req, await readJson(req));
  if (req.method === 'GET' && pn === '/api/chat') return chatList(req, url);
  if (req.method === 'GET' && pn === '/api/chat/unread') return chatUnread(url);
  if (req.method === 'POST' && pn === '/api/chat/send') return chatSend(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/chat/react') return chatReact(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/chat/delete') return chatDelete(req, await readJson(req));
  if (req.method === 'GET' && pn === '/api/my-parcels') return myParcels(req);
  if (req.method === 'GET' && pn === '/api/production') return productionGet(req);
  if (req.method === 'POST' && pn === '/api/production/collect') return productionCollect(req);
  if (req.method === 'POST' && pn === '/api/walker/spawn') return walkerSpawn(req);
  if (req.method === 'POST' && pn === '/api/walker/tap') return walkerTap(req, await readJson(req));

  throw new HttpError(404, 'No encontrado');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 10_000) { reject(new HttpError(413, 'Petición demasiado grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(new HttpError(400, 'JSON no válido')); } });
  });
}

// ---------- Servidor HTTP + estáticos ----------
const PUBLIC = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

// Migración automática (inofensiva si la columna ya existe)
const ready = run('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS house TEXT').catch(e => console.error('No se pudo añadir la columna house:', e.message))
  .then(async () => {   // niveles de terreno (no hacen nada si las columnas ya existen)
    await run('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS level SMALLINT NOT NULL DEFAULT 1');
    await run('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS level_at BIGINT');
    await run('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS city TEXT');          // ranking por ciudades
    await run('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS city_try BIGINT');
    await run('CREATE INDEX IF NOT EXISTS parcels_country_city ON parcels (country, city)');
    await run('ALTER TABLE pack_orders ADD COLUMN IF NOT EXISTS pack_credits INT');   // qué pack se pidió en cada pedido
    await run('ALTER TABLE pack_orders ADD COLUMN IF NOT EXISTS pack_price TEXT');
  }).catch(e => console.error('No se pudieron añadir las columnas nuevas (niveles / packs):', e.message))
  .then(async () => {   // regalo de bienvenida (una fila por cuenta: así solo se cobra una vez)
    await run('CREATE TABLE IF NOT EXISTS welcome_gifts (user_id TEXT PRIMARY KEY, credits INT NOT NULL, created_at BIGINT NOT NULL)');
  }).catch(e => console.error('No se pudo crear la tabla welcome_gifts:', e.message))
  .then(async () => {   // tablas de "Invita y gana" (no hacen nada si ya existen)
    await run('CREATE TABLE IF NOT EXISTS ref_codes (code TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL, last_ip TEXT)');
    await run('CREATE TABLE IF NOT EXISTS referrals (invitee_id TEXT PRIMARY KEY, inviter_id TEXT NOT NULL, created_at BIGINT NOT NULL, ip_hash TEXT, rewarded_at BIGINT, inviter_credits INT NOT NULL DEFAULT 0)');
    await run('CREATE INDEX IF NOT EXISTS referrals_inviter ON referrals (inviter_id)');
  }).catch(e => console.error('No se pudieron crear las tablas de invitaciones:', e.message))
  .then(async () => {   // chat por zona (no hace nada si ya existe)
    await run('CREATE TABLE IF NOT EXISTS chat_msgs (id BIGSERIAL PRIMARY KEY, zone TEXT NOT NULL, user_id TEXT NOT NULL, nick TEXT NOT NULL, avatar TEXT, country TEXT, text TEXT NOT NULL, created_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS chat_msgs_zone ON chat_msgs (zone, id)');
    await run('ALTER TABLE chat_msgs ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION');   // radio de 50 km: punto desde el que se escribió
    await run('ALTER TABLE chat_msgs ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION');
    await run('CREATE INDEX IF NOT EXISTS chat_msgs_lat ON chat_msgs (lat)');
    await run('CREATE TABLE IF NOT EXISTS chat_reacts (msg_id BIGINT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (msg_id, user_id))');
    await run('CREATE TABLE IF NOT EXISTS friends (user_id TEXT NOT NULL, friend_id TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, friend_id))');
    await run('CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, tz TEXT, created_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs (user_id)');
    await run('ALTER TABLE push_state ADD COLUMN IF NOT EXISTS last_full_push BIGINT');   // aviso "se llena pronto" (una vez por recogida)
    await run('CREATE TABLE IF NOT EXISTS push_state (user_id TEXT PRIMARY KEY, last_seen BIGINT, unseen INT NOT NULL DEFAULT 0, last_any BIGINT, last_prod_push BIGINT, last_daily_push TEXT)');
    if (PUSH_ON) { setTimeout(pushRun, 120_000).unref(); setInterval(pushRun, 15 * 60_000).unref(); }   // revisa cada 15 min quién tiene algo pendiente
    const purge = () => run('DELETE FROM chat_msgs WHERE created_at < $1', [Date.now() - CHAT_KEEP_MS]).then(() => run('DELETE FROM chat_reacts WHERE msg_id NOT IN (SELECT id FROM chat_msgs)')).catch(() => {});
    purge(); setInterval(purge, 3600_000).unref();
    if (CITY_GEOCODE) { setTimeout(cityTick, 5000).unref(); setInterval(cityTick, 20_000).unref(); }   // pone ciudad a los terrenos que no la tienen
  }).catch(e => console.error('No se pudo crear la tabla del chat:', e.message));


// ---------- Papá Noel ----------
// Cada SANTA_EVERY_MIN minutos (60 por defecto) llega Papá Noel volando en su trineo, aterriza en la casa de un jugador con cuenta
// elegida al azar y le deja un regalo: SANTA_REWARD créditos (1 por defecto). Lo ven todos los jugadores conectados (aviso + sonido),
// y el dueño recibe además un mensaje al entrar (tabla santa_notices) y un aviso al móvil si lo tiene activado.
// Para desactivarlo: SANTA=off. Para probarlo ya: POST /api/admin/santa con la clave de admin.
const SANTA_ON = String(process.env.SANTA || 'on').toLowerCase() !== 'off';
const SANTA_EVERY_MS = Math.max(60_000, Number(process.env.SANTA_EVERY_MIN || 60) * 60_000);
const SANTA_REWARD = Math.max(0, Math.floor(Number(process.env.SANTA_REWARD ?? 1)));
const SANTA_FLY_MS = 8_000;     // vuelo hasta aterrizar
const SANTA_GIFT_MS = 2_500;    // desde que aterriza hasta que deja el regalo
const SANTA_STAY_MS = 9_000;    // lo que se queda posado en la casa
const SANTA_LEAVE_MS = 6_000;   // despegue y vuelo de vuelta
let santaActive = null;   // { id, parcelId, userId, x, y, lat, lng, owner, house, startedAt, landAt, giftAt, leaveAt, endsAt }
const santaPublic = ev => ev && ({ id: ev.id, parcelId: ev.parcelId, x: ev.x, y: ev.y, lat: ev.lat, lng: ev.lng, owner: ev.owner, house: ev.house,
  reward: SANTA_REWARD, startedAt: ev.startedAt, landAt: ev.landAt, giftAt: ev.giftAt, leaveAt: ev.leaveAt, endsAt: ev.endsAt });
function santaBroadcast(type, extra) {
  const msg = `event: santa\ndata: ${JSON.stringify({ type, now: Date.now(), ev: santaPublic(santaActive), ...(extra || {}) })}\n\n`;
  for (const set of onlineClients.values()) for (const res of set) { try { res.write(msg); } catch {} }
}
async function santaStart(force) {
  if (!SANTA_ON || santaActive) return null;
  if (!force) {
    if (!onlineClients.size) return null;   // sin jugadores conectados nadie lo vería: espera
    const last = await one('SELECT MAX(started_at) AS t FROM santa_log');
    if (last && last.t && Date.now() - Number(last.t) < SANTA_EVERY_MS - 5000) return null;
  }
  const p = await one('SELECT id, x, y, owner, user_id, house FROM parcels WHERE user_id IS NOT NULL ORDER BY random() LIMIT 1');
  if (!p) return null;
  const now = Date.now();
  const row = await one('INSERT INTO santa_log (parcel_id, x, y, owner, user_id, house, started_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [p.id, p.x, p.y, p.owner, String(p.user_id), p.house, now]);
  const landAt = now + SANTA_FLY_MS, giftAt = landAt + SANTA_GIFT_MS, leaveAt = landAt + SANTA_STAY_MS;
  santaActive = { id: Number(row.id), parcelId: p.id, userId: String(p.user_id), x: p.x, y: p.y,
    lat: p.y * SIZE - 90 + SIZE / 2, lng: p.x * SIZE - 180 + SIZE / 2, owner: p.owner, house: p.house,
    startedAt: now, landAt, giftAt, leaveAt, endsAt: leaveAt + SANTA_LEAVE_MS };
  santaBroadcast('start');
  setTimeout(() => santaGift(santaActive && santaActive.id).catch(e => console.error('Papá Noel:', e.message)), giftAt - now).unref();
  setTimeout(() => santaEnd(santaActive && santaActive.id), santaActive.endsAt - now).unref();
  return santaPublic(santaActive);
}
// Entrega el regalo (una sola vez por visita): suma los créditos y deja el aviso para el dueño
async function santaGift(id, evOverride) {
  const ev = evOverride || santaActive; if (!ev || ev.id !== id) return;
  const claim = await one('UPDATE santa_log SET gifted = TRUE WHERE id = $1 AND gifted = FALSE RETURNING id', [id]);
  if (!claim) return;   // ya entregado
  let paid = 0;
  try {
    if (SANTA_REWARD > 0) {
      const up = await run('UPDATE packs SET credits = credits + $1 WHERE user_id::text = $2', [SANTA_REWARD, ev.userId]);
      if (up && (up.rowCount === undefined || up.rowCount > 0)) paid = SANTA_REWARD;
    }
    await run('INSERT INTO santa_notices (user_id, parcel_id, house, created_at, reward) VALUES ($1,$2,$3,$4,$5)', [ev.userId, ev.parcelId, ev.house, Date.now(), paid]);
  } catch (e) { console.error('Papá Noel: no se pudo entregar el regalo:', e.message); }
  santaBroadcast('gift', { parcelId: ev.parcelId, reward: paid });
  pushToUser(ev.userId, { title: '🎅 ¡Papá Noel ha visitado tu casa!', body: paid ? `Te ha dejado ${paid} ${paid === 1 ? 'crédito' : 'créditos'} de regalo.` : 'Te ha dejado un regalo.', tag: 'santa', url: '/' }).catch(() => {});
}
function santaEnd(id) {
  if (!santaActive || santaActive.id !== id) return;
  const ev = santaActive;
  run('UPDATE santa_log SET ended_at = $1 WHERE id = $2', [Date.now(), ev.id]).catch(() => {});
  santaActive = null;
  santaBroadcast('end', { ev: null, parcelId: ev.parcelId });
}
async function santaResume() {   // si el servidor se reinició a mitad de una visita: se entrega el regalo pendiente y se cierra
  const r = await one('SELECT * FROM santa_log WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1');
  if (!r) return;
  if (!r.gifted) await santaGift(Number(r.id), { id: Number(r.id), parcelId: r.parcel_id, userId: String(r.user_id), house: r.house });
  await run('UPDATE santa_log SET ended_at = $1 WHERE id = $2', [Date.now(), r.id]);
}
async function santaGet(req) {
  const user = await userFrom(req);
  const notices = user ? (await all('SELECT id, parcel_id, house, created_at, reward FROM santa_notices WHERE user_id = $1 AND seen = FALSE ORDER BY id LIMIT 20', [user.id]))
    .map(n => ({ id: Number(n.id), parcelId: n.parcel_id, house: n.house, reward: Number(n.reward) || 0, t: Number(n.created_at) })) : [];
  return { on: SANTA_ON, now: Date.now(), active: santaPublic(santaActive), notices };
}
async function santaSeen(req) {
  const user = await needUser(req);
  await run('UPDATE santa_notices SET seen = TRUE WHERE user_id = $1 AND seen = FALSE', [user.id]);
  return { ok: true };
}
ready.then(async () => {
  if (!SANTA_ON) return;
  await run('CREATE TABLE IF NOT EXISTS santa_log (id BIGSERIAL PRIMARY KEY, parcel_id TEXT NOT NULL, x INT, y INT, owner TEXT, user_id TEXT, house TEXT, started_at BIGINT NOT NULL, gifted BOOLEAN NOT NULL DEFAULT FALSE, ended_at BIGINT)');
  await run('CREATE TABLE IF NOT EXISTS santa_notices (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, parcel_id TEXT, house TEXT, created_at BIGINT NOT NULL, reward INT NOT NULL DEFAULT 0, seen BOOLEAN NOT NULL DEFAULT FALSE)');
  await run('CREATE INDEX IF NOT EXISTS santa_notices_user ON santa_notices (user_id, seen)');
  await santaResume();
  setInterval(() => santaStart(false).catch(e => console.error('Papá Noel:', e.message)), 60_000).unref();
}).catch(e => console.error('No se pudo preparar a Papá Noel:', e.message));

ready.then(async () => {   // ruleta diaria: una fila por cuenta y día (la clave primaria impide girar dos veces el mismo día)
  await run('CREATE TABLE IF NOT EXISTS roulette_spins (user_id TEXT NOT NULL, day DATE NOT NULL, prize NUMERIC(8,2) NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, day))');
  await run('ALTER TABLE packs ADD COLUMN IF NOT EXISTS roulette_carry NUMERIC(6,2) NOT NULL DEFAULT 0');
}).catch(e => console.error('No se pudo preparar la ruleta:', e.message));

// Sitio estático en otro dominio: CORS_ORIGINS = direcciones permitidas, separadas por comas (p. ej. https://atlas-terrenos-web.onrender.com)
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean);

// ---------- Archivos estáticos: ETag + caché + gzip (ahorra ancho de banda) ----------
// Imágenes: el navegador las guarda 7 días. HTML/JS/CSS: siempre pregunta, pero si no han cambiado el servidor contesta 304 (sin cuerpo).
const zlib = require('node:zlib');
const staticCache = new Map();   // ruta -> { mtime, etag, buf, gz }
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json)|image\/svg)/;
function sendStatic(req, res, file) {
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const st = fs.statSync(file);
  let ent = staticCache.get(file);
  if (!ent || ent.mtime !== st.mtimeMs) {
    const buf = fs.readFileSync(file);
    ent = { mtime: st.mtimeMs, buf, etag: '"' + require('node:crypto').createHash('md5').update(buf).digest('hex').slice(0, 20) + '"', gz: null };
    if (staticCache.size > 300) staticCache.clear();
    staticCache.set(file, ent);
  }
  const isImg = /^image\//.test(type) && !/svg/.test(type);
  const headers = { 'Content-Type': type, 'ETag': ent.etag, 'Vary': 'Accept-Encoding',
    'Cache-Control': isImg ? 'public, max-age=604800' : 'no-cache',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Strict-Transport-Security': 'max-age=15552000' };
  if (req.headers['if-none-match'] === ent.etag) { res.writeHead(304, headers); return res.end(); }
  let body = ent.buf;
  if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(String(req.headers['accept-encoding'] || '')) && body.length > 1024) {
    if (!ent.gz) ent.gz = zlib.gzipSync(ent.buf, { level: 9 });
    body = ent.gz; headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers); res.end(body);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, body, type = 'application/json; charset=utf-8') => {
    const h = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Strict-Transport-Security': 'max-age=15552000', 'Vary': 'Accept-Encoding' };
    const plain = () => { res.writeHead(status, h); res.end(body); };
    // Respuestas grandes (JSON de parcelas, ranking…): comprimidas con gzip si el navegador lo admite (ahorra ancho de banda)
    if (typeof body === 'string' && body.length > 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
      return zlib.gzip(body, { level: 5 }, (err, gz) => {
        if (err) return plain();
        res.writeHead(status, { ...h, 'Content-Encoding': 'gzip', 'Content-Length': gz.length }); res.end(gz);
      });
    }
    plain();
  };
  if (url.pathname.startsWith('/api/')) {
    const origin = req.headers.origin;
    if (origin && (CORS_ORIGINS.includes(origin) || /^https:\/\/([a-z0-9-]+\.)*itch\.zone$/.test(origin))) {   // también vale para la conexión larga de /api/online; itch.zone = juego dentro de itch.io
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }
  try {
    await ready;
    if (req.method === 'GET' && url.pathname === '/api/online') return onlineStream(req, res, url);
    if (req.method === 'GET' && url.pathname === '/api/chat/stream') return chatStream(req, res, url);   // conexión larga (SSE) del chat   // conexión larga (SSE): no pasa por route()
    if (url.pathname.startsWith('/api/')) {
      const out = await route(req, res, url);
      return send(200, JSON.stringify(out));
    }
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    const rel = path.relative(PUBLIC, file);
    if (!file.startsWith(PUBLIC + path.sep) || /(^|[\\/])(\.|node_modules)/.test(rel) || /^(server\.js|build-static\.js|package(-lock)?\.json)$/.test(rel) || !MIME[path.extname(file)] || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'No encontrado', 'text/plain');
    return sendStatic(req, res, file);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e, e.details ? JSON.stringify(e.details) : '');
    send(status, JSON.stringify({ error: status === 500 ? 'Error interno' : e.message }));
  }
}).listen(PORT, () => {
  console.log(`Redecora El Mundo en http://localhost:${PORT}  [${DEMO ? 'MODO DEMO (sin cobro real)' : [HAS_STRIPE ? 'Stripe ' + (STRIPE_SECRET_KEY.includes('_live_') ? 'LIVE' : 'test') : null, HAS_PAYPAL ? 'PayPal ' + PAYPAL_ENV : null].filter(Boolean).join(' + ')}]  packs ${PACKS.map(p => p.credits + '=' + p.price).join(', ')} ${CURRENCY}`);
});
