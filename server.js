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
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RENDER;   // Render define RENDER=true
const DEMO = process.env.DEMO === '1' || !HAS_PAYPAL;
if (DEMO && IS_PROD && process.env.DEMO !== '1') {
  // Sin esto, un fallo de configuración regalaría packs sin cobrar.
  console.error('Faltan PAYPAL_CLIENT_ID / PAYPAL_SECRET en producción. Configúralos, o pon DEMO=1 si de verdad quieres el modo demo.');
  process.exit(1);
}
if (DEMO && IS_PROD) console.warn('AVISO: modo DEMO activo en producción. No se cobra dinero real.');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const RESERVE_MINUTES = 10;                               // tiempo que se reserva una parcela mientras se paga
const PACK_SIZE = Math.max(1, Number(process.env.PACK_SIZE || 50));   // terrenos por pack (el pack cuesta PRICE)
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
  'images/casa-aerea.png','images/casa-frente.png','images/policia.png','images/pisos.png','images/gasolinera.png',
  'images/choza.png','images/Restaurante.png','images/McDonald.png','images/Burgerking.png','images/Farmacia.png',
  'images/colegio.png','images/parque.png','images/rascacielos.png','images/casa-1.png','images/casa-2.png',
  'images/casa-3.png','images/casa-4.png','images/casa-5.png'
];
const cleanHouse = h => HOUSES.includes(h) ? h : null;   // null = al azar (como hasta ahora)
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

// Al iniciar sesión: ata a la cuenta el código de este dispositivo (o junta sus terrenos con los de la cuenta)
async function linkAccount(req) {
  const user = await needUser(req);
  const local = packCodeFrom(req);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let mine = (await client.query('SELECT code, credits FROM packs WHERE user_id = $1 FOR UPDATE', [user.id])).rows[0];
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
    await client.query('COMMIT');
    const prof = await getProfile(user.id);
    return { ok: true, code: mine.code, credits: mine.credits, email: user.email, nickname: prof ? prof.nickname : null };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (isUniqueViolation(e)) throw new HttpError(409, 'Inténtalo de nuevo');
    throw e;
  } finally {
    client.release();
  }
}

async function createPackOrder(req) {
  if (REQUIRE_LOGIN) await needUser(req);
  const now = Date.now();
  let orderId;
  if (DEMO) {
    orderId = 'DEMO-' + crypto.randomUUID();
  } else {
    const o = await paypal('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', landing_page: 'GUEST_CHECKOUT' } } },
      purchase_units: [{
        reference_id: 'PACK',
        description: `Pack de ${PACK_SIZE} terrenos`,
        amount: { currency_code: CURRENCY, value: PRICE },
      }],
    });
    orderId = o.id;
  }
  await run('INSERT INTO pack_orders (order_id, status, created_at) VALUES ($1,$2,$3)', [orderId, 'CREATED', now]);
  return { orderId, size: PACK_SIZE, price: PRICE, currency: CURRENCY };
}

async function capturePackOrder(req, orderId) {
  const ord = await one('SELECT * FROM pack_orders WHERE order_id = $1', [orderId]);
  if (!ord) throw new HttpError(404, 'Pedido desconocido');
  if (ord.status === 'PAID') {
    const p = await one('SELECT code, credits FROM packs WHERE code = $1', [ord.code]);
    return { ok: true, code: p.code, credits: p.credits };
  }
  if (ord.status !== 'CREATED') throw new HttpError(409, 'Pedido no válido');

  const user = REQUIRE_LOGIN ? await needUser(req) : await userFrom(req);   // antes de cobrar nada
  let captureId = null;
  if (!DEMO) {
    const cap = await paypal('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`);
    const c = cap.purchase_units?.[0]?.payments?.captures?.[0];
    if (cap.status !== 'COMPLETED' || !c || c.status !== 'COMPLETED') throw new HttpError(402, 'El pago no se ha completado');
    if (c.amount.value !== Number(PRICE).toFixed(2) || c.amount.currency_code !== CURRENCY) throw new HttpError(402, 'Importe incorrecto');
    captureId = c.id;
  }

  let code, credits;
  try {
    if (user) {
      // Con cuenta: los terrenos se suman al pack de la cuenta
      const row = await ensureUserPack(user);
      const up = await one('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING code, credits', [PACK_SIZE, row.code]);
      code = up.code; credits = up.credits;
    } else {
      code = newPackCode();
      await run('INSERT INTO packs (code, credits, created_at) VALUES ($1,$2,$3)', [code, PACK_SIZE, Date.now()]);
      credits = PACK_SIZE;
    }
    await run("UPDATE pack_orders SET status = 'PAID', code = $1 WHERE order_id = $2", [code, orderId]);
  } catch (e) {
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
      if (!r.rows[0]) throw new HttpError(402, `Cambiar la casa cuesta ${HOUSE_COST} ${HOUSE_COST === 1 ? 'crédito' : 'créditos'} y no te quedan`);
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
const DAILY_REWARDS = [1, 1, 2, 2, 3, 3, 5];                    // terrenos de cada día de la racha (se repite cada 7 días)
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
// Cada terreno tiene un nivel de 1 a MAX_LEVEL. Pasar del nivel L al L+1 cuesta LEVEL_COSTS[L-1] créditos y el terreno
// produce PROD_RATE × LEVEL_MULTS[nivel-1]. Se pueden cambiar con las variables LEVEL_MULTS y LEVEL_COSTS (listas separadas por comas).
const numList = (s, def) => { const a = String(s || '').split(',').map(x => Number(x.trim())).filter(x => Number.isFinite(x) && x >= 0); return a.length ? a : def; };
const LEVEL_MULTS = numList(process.env.LEVEL_MULTS, [1, 1.5, 2, 3, 5]);     // multiplicador de cada nivel (el primero es el nivel 1)
const MAX_LEVEL = LEVEL_MULTS.length;
const LEVEL_COSTS = (() => {                                                  // créditos para pasar al nivel 2, 3, 4…
  const c = numList(process.env.LEVEL_COSTS, [1, 2, 4, 8]).map(x => Math.floor(x));
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
    if (!r.rows[0]) throw new HttpError(402, `Subir al nivel ${level + 1} cuesta ${cost} ${cost === 1 ? 'crédito' : 'créditos'} y no te quedan`);
    await client.query('UPDATE parcels SET level = $1, level_at = $2 WHERE id = $3', [level + 1, Date.now(), String(id)]);
    await client.query('COMMIT');
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

function broadcastOnline(force) {
  const n = onlineClients.size;
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
  res.write(`retry: 3000\n\ndata: ${onlineClients.size}\n\n`);   // el recién llegado ve el número al instante
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
  if (req.method === 'GET' && pn === '/api/admin/stats') return adminStats(req);
  if (req.method === 'POST' && pn === '/api/visit') return registerVisit(req);
  if (req.method === 'GET' && pn === '/api/config')
    return { demo: DEMO, clientId: DEMO ? null : PAYPAL_CLIENT_ID, currency: CURRENCY, price: PRICE, size: SIZE, packSize: PACK_SIZE,
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

  if (req.method === 'GET' && pn === '/api/health') return { ok: true };   // la pantalla de carga del sitio estático pregunta aquí si ya despertó
  if (req.method === 'GET' && pn === '/api/online/count') return { online: onlineClients.size };
  if (req.method === 'GET' && pn === '/api/ref') return refGet(req);
  if (req.method === 'POST' && pn === '/api/ref/attach') return refAttach(req, await readJson(req));
  if (req.method === 'GET' && pn === '/api/stats')
    return { sold: (await q.count()).n, top: await q.top(), countries: await q.topCountries() };

  if (req.method === 'POST' && pn === '/api/packs/orders') return createPackOrder(req);
  const pm = pn.match(/^\/api\/packs\/orders\/([^/]+)\/capture$/);
  if (req.method === 'POST' && pm) return capturePackOrder(req, decodeURIComponent(pm[1]));
  if (req.method === 'GET' && pn === '/api/pack') return { credits: (await getPack(req)).credits };
  if (req.method === 'GET' && pn === '/api/daily') return dailyGet(req);
  if (req.method === 'POST' && pn === '/api/daily/claim') return dailyClaim(req);
  if (req.method === 'POST' && pn === '/api/parcel/house') return setHouse(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/parcel/upgrade') return upgradeParcel(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/claim') return claimWithCredit(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/auth/link') return linkAccount(req);
  if (req.method === 'GET' && pn === '/api/profile') return profileGet(req);
  if (req.method === 'POST' && pn === '/api/profile') return profileSet(req, await readJson(req));
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
  }).catch(e => console.error('No se pudieron añadir las columnas de nivel:', e.message))
  .then(async () => {   // tablas de "Invita y gana" (no hacen nada si ya existen)
    await run('CREATE TABLE IF NOT EXISTS ref_codes (code TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL, last_ip TEXT)');
    await run('CREATE TABLE IF NOT EXISTS referrals (invitee_id TEXT PRIMARY KEY, inviter_id TEXT NOT NULL, created_at BIGINT NOT NULL, ip_hash TEXT, rewarded_at BIGINT, inviter_credits INT NOT NULL DEFAULT 0)');
    await run('CREATE INDEX IF NOT EXISTS referrals_inviter ON referrals (inviter_id)');
  }).catch(e => console.error('No se pudieron crear las tablas de invitaciones:', e.message));

// Sitio estático en otro dominio: CORS_ORIGINS = direcciones permitidas, separadas por comas (p. ej. https://atlas-terrenos-web.onrender.com)
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || '').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean);

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, body, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Strict-Transport-Security': 'max-age=15552000' }); res.end(body); };
  if (url.pathname.startsWith('/api/')) {
    const origin = req.headers.origin;
    if (origin && CORS_ORIGINS.includes(origin)) {   // también vale para la conexión larga de /api/online
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
    if (req.method === 'GET' && url.pathname === '/api/online') return onlineStream(req, res, url);   // conexión larga (SSE): no pasa por route()
    if (url.pathname.startsWith('/api/')) {
      const out = await route(req, res, url);
      return send(200, JSON.stringify(out));
    }
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    const rel = path.relative(PUBLIC, file);
    if (!file.startsWith(PUBLIC + path.sep) || /(^|[\\/])(\.|node_modules)/.test(rel) || /^(server\.js|build-static\.js|package(-lock)?\.json)$/.test(rel) || !MIME[path.extname(file)] || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'No encontrado', 'text/plain');
    send(200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e, e.details ? JSON.stringify(e.details) : '');
    send(status, JSON.stringify({ error: status === 500 ? 'Error interno' : e.message }));
  }
}).listen(PORT, () => {
  console.log(`Redecora El Mundo en http://localhost:${PORT}  [${DEMO ? 'MODO DEMO (sin PayPal real)' : 'PayPal ' + PAYPAL_ENV}]  precio ${PRICE} ${CURRENCY}`);
});
