'use strict';
// Detalle en vivo de cada jugador conectado (solo para el panel de administrador).
// Todo vive en memoria del servidor: no se guarda nada en la base de datos y desaparece cuando el jugador se desconecta.
// Por jugador (identificado solo por su cid anónimo): país/región/ciudad de la conexión (cabeceras del proxy/CDN),
// dispositivo (por el user-agent), página y sección donde está, y cuánto lleva conectado.
const { placeOf, countryOf } = require('./online-stats');

const clean = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n) : '');

function deviceOf(ua) {
  ua = String(ua || '');
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

const live = new Map();   // cid -> { since, cc, region, city, device, page, section, pageAt }

// Se llama cuando un jugador abre la conexión /api/online (SSE).
function track(cid, headers, chosenCountry) {
  const now = Date.now();
  let e = live.get(cid);
  if (!e) { e = { since: now, page: '', section: '', pageAt: 0 }; live.set(cid, e); }
  const place = placeOf(headers);
  e.cc = countryOf(headers, chosenCountry);
  e.region = place.region;
  e.city = place.city;
  e.device = deviceOf(headers && headers['user-agent']);
}

// Se llama cuando el jugador avisa de la página/sección donde está.
function setPage(cid, page, section) {
  const e = live.get(cid);
  if (!e) return false;
  e.page = clean(page, 120);
  e.section = clean(section, 80);
  e.pageAt = Date.now();
  return true;
}

// activeCids: los cid con conexión abierta ahora (onlineClients.keys()). Borra los que ya no están.
function list(activeCids, max = 200) {
  const active = new Set(activeCids), now = Date.now(), out = [];
  for (const cid of [...live.keys()]) if (!active.has(cid)) live.delete(cid);
  for (const cid of active) {
    const e = live.get(cid);
    if (!e) continue;
    out.push({
      id: String(cid).slice(0, 6),
      cc: e.cc || null, region: e.region || null, city: e.city || null,
      device: e.device || 'desktop',
      page: e.page, section: e.section,
      secs: Math.round((now - e.since) / 1000),
      pageSecs: e.pageAt ? Math.round((now - e.pageAt) / 1000) : null
    });
  }
  out.sort((a, b) => b.secs - a.secs);
  return out.slice(0, max);
}

module.exports = { track, setPage, list, deviceOf };
