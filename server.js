// Atlas Terrenos — servidor con base de datos en Supabase (Postgres)
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
const DATABASE_URL = process.env.DATABASE_URL || '';      // cadena de conexión de Supabase
if (!DATABASE_URL) {
  console.error('Falta la variable DATABASE_URL (cadena de conexión de Supabase). Mira el README.');
  process.exit(1);
}

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
  parcelsInBox: (x0, x1, y0, y1) => all('SELECT id, x, y, owner FROM parcels WHERE x BETWEEN $1 AND $2 AND y BETWEEN $3 AND $4 LIMIT 3000', [x0, x1, y0, y1]),
  insertParcel: (id, x, y, owner, orderId, paid, currency, createdAt) =>
    run('INSERT INTO parcels (id, x, y, owner, order_id, paid, currency, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id, x, y, owner, orderId, paid, currency, createdAt]),
  activeOrderForParcel: (id, now) => one("SELECT order_id FROM orders WHERE parcel_id = $1 AND status = 'CREATED' AND expires_at > $2", [id, now]),
  insertOrder: (orderId, parcelId, owner, status, expiresAt, createdAt) =>
    run('INSERT INTO orders (order_id, parcel_id, owner, status, expires_at, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [orderId, parcelId, owner, status, expiresAt, createdAt]),
  orderById: id => one('SELECT * FROM orders WHERE order_id = $1', [id]),
  setOrderStatus: (status, id) => run('UPDATE orders SET status = $1 WHERE order_id = $2', [status, id]),
  purgeOrders: now => run("DELETE FROM orders WHERE status = 'CREATED' AND expires_at <= $1", [now]),
  count: () => one('SELECT COUNT(*) AS n FROM parcels'),
  top: () => all('SELECT owner, COUNT(*) AS n FROM parcels GROUP BY owner ORDER BY n DESC, MIN(created_at) ASC LIMIT 10'),
};
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

async function adminClaimParcel({ lat, lng, owner }) {
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
    await q.insertParcel(p.id, p.x, p.y, name, null, '0.00', 'ADMIN', now);
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
// ---------- WORLD STATISTICS LIVE ----------
const WORLD_INDICATORS = {
  population: {
    code: 'SP.POP.TOTL',
    label: 'Población',
    unit: 'habitantes'
  },
  gdp: {
    code: 'NY.GDP.PCAP.CD',
    label: 'PIB por habitante',
    unit: 'USD'
  },
  life: {
    code: 'SP.DYN.LE00.IN',
    label: 'Esperanza de vida',
    unit: 'años'
  },
  area: {
    code: 'AG.SRF.TOTL.K2',
    label: 'Superficie',
    unit: 'km²'
  }
};

const worldCache = new Map();
const WORLD_CACHE_MS = 6 * 60 * 60 * 1000;

function countryFlag(code) {
  if (!/^[A-Z]{2}$/.test(code || '')) return '🌍';
  return String.fromCodePoint(
    ...[...code].map(c => 127397 + c.charCodeAt(0))
  );
}

async function getWorldStats(key) {
  const indicator = WORLD_INDICATORS[key];

  if (!indicator) {
    throw new HttpError(400, 'Indicador no válido');
  }

  const cached = worldCache.get(key);

  if (cached && Date.now() - cached.time < WORLD_CACHE_MS) {
    return { ...cached.data, cached: true };
  }

  const api =
    'https://api.worldbank.org/v2/country/all/indicator/' +
    indicator.code +
    '?format=json&per_page=400&mrnev=1';

  const response = await fetch(api);

  if (!response.ok) {
    throw new HttpError(502, 'No se pudo consultar el Banco Mundial');
  }

  const payload = await response.json();
  const records = payload?.[1];

  if (!Array.isArray(records)) {
    throw new HttpError(502, 'Respuesta de datos no válida');
  }

  const countries = records
    .filter(row =>
      row.value !== null &&
      row.country?.id &&
      row.countryiso3code &&
      row.country?.value
    )
    .map(row => ({
      name: row.country.value,
      iso2: row.country.id,
      iso3: row.countryiso3code,
      flag: countryFlag(row.country.id),
      value: row.value,
      year: row.date
    }))
    .sort((a, b) => b.value - a.value);

  const data = {
    indicator: key,
    label: indicator.label,
    unit: indicator.unit,
    source: 'Banco Mundial',
    updatedAt: new Date().toISOString(),
    countries
  };

  worldCache.set(key, {
    time: Date.now(),
    data
  });

  return { ...data, cached: false };
}
// ---------- API ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function createOrder({ lat, lng, owner }) {
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
      purchase_units: [{
        reference_id: p.id,
        description: `Terreno ${p.id} (${p.south.toFixed(3)}, ${p.west.toFixed(3)})`,
        amount: { currency_code: CURRENCY, value: PRICE },
      }],
    });
    orderId = o.id;
  }
  // Reserva (la restricción de unicidad real está en la tabla parcels)
  await q.insertOrder(orderId, p.id, name, 'CREATED', now + RESERVE_MINUTES * 60000, now);
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
    await q.insertParcel(ord.parcel_id, p[0], p[1], ord.owner, orderId, paidValue, paidCurrency, Date.now());
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

async function route(req, res, url) {
  const { pathname: pn, searchParams: sp } = url;
  if (req.method === 'POST' && pn === '/api/admin/claim') {
  if (!isAdmin(req)) {
    throw new HttpError(403, 'Acceso exclusivo de administrador');
  }

  return adminClaimParcel(await readJson(req));
  }
if (req.method === 'GET' && pn === '/api/world-stats') {
  const indicator = sp.get('indicator') || 'population';
  return getWorldStats(indicator);
}
  if (req.method === 'GET' && pn === '/api/config')
    return { demo: DEMO, clientId: DEMO ? null : PAYPAL_CLIENT_ID, currency: CURRENCY, price: PRICE, size: SIZE };

  if (req.method === 'GET' && pn === '/api/parcel') {
    const p = parcelFromLatLng(Number(sp.get('lat')), Number(sp.get('lng')));
    if (!p) throw new HttpError(400, 'Coordenadas no válidas');
    const row = await q.parcelById(p.id);
    return { ...p, owner: row ? row.owner : null, since: row ? row.created_at : null };
  }

  if (req.method === 'GET' && pn === '/api/parcels') {
    const [s, w, n, e] = ['south', 'west', 'north', 'east'].map(k => Number(sp.get(k)));
    if (![s, w, n, e].every(Number.isFinite) || n - s > 0.3 || e - w > 0.3) throw new HttpError(400, 'Zona demasiado grande');
    const x0 = Math.max(0, Math.floor((w + 180) / SIZE)), x1 = Math.min(MAX_X - 1, Math.floor((e + 180) / SIZE));
    const y0 = Math.max(0, Math.floor((s + 90) / SIZE)), y1 = Math.min(MAX_Y - 1, Math.floor((n + 90) / SIZE));
    return (await q.parcelsInBox(x0, x1, y0, y1)).map(r => ({ id: r.id, x: r.x, y: r.y, owner: r.owner }));
  }

  if (req.method === 'GET' && pn === '/api/stats')
    return { sold: (await q.count()).n, top: await q.top() };

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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, body, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }); res.end(body); };
  try {
    if (url.pathname.startsWith('/api/')) {
      const out = await route(req, res, url);
      return send(200, JSON.stringify(out));
    }
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, 'No encontrado', 'text/plain');
    send(200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e, e.details ? JSON.stringify(e.details) : '');
    send(status, JSON.stringify({ error: status === 500 ? 'Error interno' : e.message }));
  }
}).listen(PORT, () => {
  console.log(`Atlas Terrenos en http://localhost:${PORT}  [${DEMO ? 'MODO DEMO (sin PayPal real)' : 'PayPal ' + PAYPAL_ENV}]  precio ${PRICE} ${CURRENCY}`);
});
