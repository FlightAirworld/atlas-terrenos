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
const DEMO = !(PAYPAL_CLIENT_ID && PAYPAL_SECRET) || process.env.DEMO === '1';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const RESERVE_MINUTES = 10;                               // tiempo que se reserva una parcela mientras se paga
const PACK_SIZE = Math.max(1, Number(process.env.PACK_SIZE || 50));   // terrenos por pack (el pack cuesta PRICE)
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
  parcelsInBox: (x0, x1, y0, y1) => all('SELECT id, x, y, owner, avatar, country FROM parcels WHERE x BETWEEN $1 AND $2 AND y BETWEEN $3 AND $4 LIMIT 3000', [x0, x1, y0, y1]),
  insertParcel: (id, x, y, owner, orderId, paid, currency, createdAt, avatar, country) =>
    run('INSERT INTO parcels (id, x, y, owner, order_id, paid, currency, created_at, avatar, country) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, x, y, owner, orderId, paid, currency, createdAt, avatar, country]),
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

async function adminClaimParcel({ lat, lng, owner, avatar, country }) {
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
    await q.insertParcel(p.id, p.x, p.y, name, null, '0.00', 'ADMIN', now, cleanAvatar(avatar), cleanCountry(country));
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

async function createOrder({ lat, lng, owner, avatar }) {
  const p = parcelFromLatLng(Number(lat), Number(lng));
  if (!p) throw new HttpError(400, 'Coordenadas no válidas');
  const name = cleanName(owner);
  if (!name) throw new HttpError(400, 'Pon un nombre de 2 a 30 caracteres');

  const now = Date.now();
  await q.purgeOrders(now);
  if (await q.parcelById(p.id)) throw new HttpError(409, 'Este terreno ya tiene dueño');
  if (await q.activeOrderForParcel(p.id, now)) throw new HttpError(409, 'Este terreno está siendo comprado por otra persona. Prueba en unos minutos');

  let orderId;
  if (DEMO) {
    orderId = 'DEMO-' + crypto.randomUUID();
  } else {
    const o = await paypal('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', landing_page: 'GUEST_CHECKOUT' } } },
      purchase_units: [{
        reference_id: p.id,
        description: `Terreno ${p.id} (${p.south.toFixed(3)}, ${p.west.toFixed(3)})`,
        amount: { currency_code: CURRENCY, value: PRICE },
      }],
    });
    orderId = o.id;
  }
  // Reserva (la restricción de unicidad real está en la tabla parcels)
  await q.insertOrder(orderId, p.id, name, 'CREATED', now + RESERVE_MINUTES * 60000, now, cleanAvatar(avatar));
  return { orderId, parcel: p.id, price: PRICE, currency: CURRENCY };
}

async function captureOrder(orderId) {
  const ord = await q.orderById(orderId);
  if (!ord) throw new HttpError(404, 'Pedido desconocido');
  if (ord.status === 'PAID') return { ok: true, parcel: ord.parcel_id, owner: ord.owner };
  if (ord.status !== 'CREATED') throw new HttpError(409, 'Pedido no válido');

  let paidValue = PRICE, paidCurrency = CURRENCY, captureId = null;
  if (!DEMO) {
    const cap = await paypal('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`);
    const c = cap.purchase_units?.[0]?.payments?.captures?.[0];
    if (cap.status !== 'COMPLETED' || !c || c.status !== 'COMPLETED') throw new HttpError(402, 'El pago no se ha completado');
    if (c.amount.value !== Number(PRICE).toFixed(2) || c.amount.currency_code !== CURRENCY) throw new HttpError(402, 'Importe incorrecto');
    paidValue = c.amount.value; paidCurrency = c.amount.currency_code; captureId = c.id;
  }

  const p = ord.parcel_id.split(':').map(Number);
  try {
    // La clave primaria impide que dos personas se queden la misma parcela.
    await q.insertParcel(ord.parcel_id, p[0], p[1], ord.owner, orderId, paidValue, paidCurrency, Date.now(), cleanAvatar(ord.avatar), null);
    await q.setOrderStatus('PAID', orderId);
    return { ok: true, parcel: ord.parcel_id, owner: ord.owner };
  } catch (e) {
    if (!isUniqueViolation(e)) {
      // Error de base de datos (no de duplicado): el pago ya está capturado, hay que revisarlo a mano
      if (captureId) console.error('PAGO CAPTURADO PERO NO GUARDADO, REVISAR', captureId, orderId, e.message);
      throw e;
    }
    // Caso extremo: se cobró pero la parcela ya era de otro → reembolso automático
    if (captureId) { try { await paypal('POST', `/v2/payments/captures/${captureId}/refund`, {}); } catch (_) { console.error('REEMBOLSO MANUAL NECESARIO', captureId); } }
    await q.setOrderStatus('REFUNDED', orderId);
    throw new HttpError(409, 'El terreno ya fue vendido. Se ha reembolsado el pago');
  }
}

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

async function claimWithCredit(req, { lat, lng, owner, avatar, country }) {
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
    await client.query(
      'INSERT INTO parcels (id, x, y, owner, order_id, paid, currency, created_at, avatar, country, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [p.id, p.x, p.y, name, null, '0.00', 'PACK', now, cleanAvatar(avatar), cleanCountry(country), user ? user.id : null]);
    await client.query('COMMIT');
    return { ok: true, parcel: p.id, owner: name, credits: r.rows[0].credits };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (isUniqueViolation(e)) throw new HttpError(409, 'Este terreno ya tiene dueño');
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
const clientIp = req => req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

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

// Suma, por cada terreno de la cuenta, el tiempo producido desde la última recogida (o desde que se reclamó), con tope.
async function prodCompute(db, userId, lastCollect, carry, now) {
  const r = (await db.query(
    'SELECT COUNT(*) AS n, COALESCE(SUM(LEAST(GREATEST($2::bigint - GREATEST(created_at, $3::bigint), 0), $4::bigint)), 0) AS ms FROM parcels WHERE user_id = $1',
    [userId, now, lastCollect || 0, Math.round(PROD_CAP_HOURS * HOUR_MS)])).rows[0];
  const n = Number(r.n);
  const total = (Number(carry) || 0) + (Number(r.ms) / HOUR_MS) * PROD_RATE;
  return { parcels: n, perHour: n * PROD_RATE, total, ready: Math.floor(total + 1e-9) };
}

async function myParcels(req) {
  const user = await needUser(req);
  const rows = await all('SELECT id, x, y, avatar, country, created_at FROM parcels WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', [user.id]);
  const total = (await one('SELECT COUNT(*) AS n FROM parcels WHERE user_id = $1', [user.id])).n;
  return { total, parcels: rows.map(r => ({ id: r.id, x: r.x, y: r.y, avatar: r.avatar, country: r.country, since: r.created_at })) };
}

async function productionGet(req) {
  const user = await needUser(req);
  const pack = await ensureUserPack(user);
  const p = await one('SELECT last_collect, prod_carry FROM packs WHERE code = $1', [pack.code]);
  const st = await prodCompute(pool, user.id, p && p.last_collect, p && p.prod_carry, Date.now());
  return { parcels: st.parcels, perHour: Math.round(st.perHour * 10000) / 10000, ready: st.ready, capHours: PROD_CAP_HOURS, rate: PROD_RATE };
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
      auth: { enabled: AUTH_ENABLED, required: REQUIRE_LOGIN, url: AUTH_ENABLED ? SUPABASE_URL : null, anonKey: AUTH_ENABLED ? SUPABASE_ANON_KEY : null } };

  if (req.method === 'GET' && pn === '/api/parcel') {
    const p = parcelFromLatLng(Number(sp.get('lat')), Number(sp.get('lng')));
    if (!p) throw new HttpError(400, 'Coordenadas no válidas');
    const row = await q.parcelById(p.id);
    return { ...p, owner: row ? row.owner : null, since: row ? row.created_at : null, avatar: row ? row.avatar : null, country: row ? row.country : null };
  }

  if (req.method === 'GET' && pn === '/api/parcels') {
    const [s, w, n, e] = ['south', 'west', 'north', 'east'].map(k => Number(sp.get(k)));
    if (![s, w, n, e].every(Number.isFinite) || n - s > 0.3 || e - w > 0.3) throw new HttpError(400, 'Zona demasiado grande');
    const x0 = Math.max(0, Math.floor((w + 180) / SIZE)), x1 = Math.min(MAX_X - 1, Math.floor((e + 180) / SIZE));
    const y0 = Math.max(0, Math.floor((s + 90) / SIZE)), y1 = Math.min(MAX_Y - 1, Math.floor((n + 90) / SIZE));
    return (await q.parcelsInBox(x0, x1, y0, y1)).map(r => ({ id: r.id, x: r.x, y: r.y, owner: r.owner, avatar: r.avatar, country: r.country }));
  }

  if (req.method === 'GET' && pn === '/api/stats')
    return { sold: (await q.count()).n, top: await q.top(), countries: await q.topCountries() };

  if (req.method === 'POST' && pn === '/api/packs/orders') return createPackOrder(req);
  const pm = pn.match(/^\/api\/packs\/orders\/([^/]+)\/capture$/);
  if (req.method === 'POST' && pm) return capturePackOrder(req, decodeURIComponent(pm[1]));
  if (req.method === 'GET' && pn === '/api/pack') return { credits: (await getPack(req)).credits };
  if (req.method === 'GET' && pn === '/api/daily') return dailyGet(req);
  if (req.method === 'POST' && pn === '/api/daily/claim') return dailyClaim(req);
  if (req.method === 'POST' && pn === '/api/claim') return claimWithCredit(req, await readJson(req));
  if (req.method === 'POST' && pn === '/api/auth/link') return linkAccount(req);
  if (req.method === 'GET' && pn === '/api/profile') return profileGet(req);
  if (req.method === 'POST' && pn === '/api/profile') return profileSet(req, await readJson(req));
  if (req.method === 'GET' && pn === '/api/my-parcels') return myParcels(req);
  if (req.method === 'GET' && pn === '/api/production') return productionGet(req);
  if (req.method === 'POST' && pn === '/api/production/collect') return productionCollect(req);

  if (req.method === 'POST' && pn === '/api/orders') return createOrder(await readJson(req));

  const m = pn.match(/^\/api\/orders\/([^/]+)\/capture$/);
  if (req.method === 'POST' && m) return captureOrder(decodeURIComponent(m[1]));

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

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, body, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Strict-Transport-Security': 'max-age=15552000' }); res.end(body); };
  try {
    if (url.pathname.startsWith('/api/')) {
      const out = await route(req, res, url);
      return send(200, JSON.stringify(out));
    }
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    const rel = path.relative(PUBLIC, file);
    if (!file.startsWith(PUBLIC + path.sep) || /(^|[\\/])(\.|node_modules)/.test(rel) || /^(server\.js|package(-lock)?\.json)$/.test(rel) || !MIME[path.extname(file)] || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'No encontrado', 'text/plain');
    send(200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e, e.details ? JSON.stringify(e.details) : '');
    send(status, JSON.stringify({ error: status === 500 ? 'Error interno' : e.message }));
  }
}).listen(PORT, () => {
  console.log(`Redecora El Mundo en http://localhost:${PORT}  [${DEMO ? 'MODO DEMO (sin PayPal real)' : 'PayPal ' + PAYPAL_ENV}]  precio ${PRICE} ${CURRENCY}`);
});
