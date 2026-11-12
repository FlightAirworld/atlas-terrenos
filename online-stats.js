'use strict';
// Jugadores conectados por país (el panel que se abre al tocar el contador «en línea»).
// Cuenta SOLO jugadores realmente conectados (una conexión /api/online por jugador, identificado por su cid anónimo):
// no incluye los jugadores simulados de ambient.js. No se guarda nada: se calcula al vuelo desde la memoria del servidor.
// El país sale, por este orden, de la cabecera que pone el proxy/CDN (Cloudflare, CloudFront, Vercel...: es el país de la red del
// jugador) y, si no hay, del país que el propio jugador tiene elegido en el juego. Sin ninguno de los dos, cuenta como «sin identificar».
const HEADERS = ['cf-ipcountry', 'cloudfront-viewer-country', 'x-vercel-ip-country', 'x-appengine-country'];
const NOT_A_COUNTRY = new Set(['XX', 'T1', 'ZZ', 'A1', 'A2', 'O1']);   // desconocido, Tor, proxies anónimos, satélite...
const valid = c => typeof c === 'string' && /^[A-Za-z]{2}$/.test(c) && !NOT_A_COUNTRY.has(c.toUpperCase());

// Región y ciudad aproximadas de la conexión, si el proxy/CDN las pone (Cloudflare: «Add visitor location headers»; Vercel; CloudFront).
// Son orientativas (salen de la red del jugador, no de su GPS). Sin cabeceras devuelve null en cada campo.
const REGION_HEADERS = ['cf-region', 'x-vercel-ip-country-region', 'cloudfront-viewer-country-region-name'];
const CITY_HEADERS = ['cf-ipcity', 'x-vercel-ip-city', 'cloudfront-viewer-city'];
function cleanPlace(v) {
  if (typeof v !== 'string' || !v) return null;
  let t = v; try { t = decodeURIComponent(v); } catch { /* se deja tal cual */ }
  t = t.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 80);
  return t || null;
}
function placeOf(headers) {
  const pick = list => { for (const h of list) { const v = cleanPlace(headers && headers[h]); if (v) return v; } return null; };
  return { region: pick(REGION_HEADERS), city: pick(CITY_HEADERS) };
}

// headers: req.headers (en minúsculas); chosen: país que el jugador tiene elegido en el juego (opcional).
function countryOf(headers, chosen) {
  for (const h of HEADERS) { const v = headers && headers[h]; if (valid(v)) return String(v).toUpperCase(); }
  return valid(chosen) ? String(chosen).toUpperCase() : null;
}

// cids: los jugadores conectados; countries: Map cid -> código de país (los que no estén cuentan como sin identificar).
function tally(cids, countries, max = 60) {
  const by = new Map();
  let total = 0, unknown = 0;
  for (const cid of cids) {
    total++;
    const cc = countries.get(cid);
    if (!cc) { unknown++; continue; }
    by.set(cc, (by.get(cc) || 0) + 1);
  }
  const list = [...by].map(([cc, n]) => ({ cc, n })).sort((a, b) => b.n - a.n || (a.cc < b.cc ? -1 : 1));
  const rest = list.slice(max).reduce((s, x) => s + x.n, 0);
  return { total, unknown: unknown + rest, countries: list.slice(0, max) };
}

// Récord de jugadores conectados a la vez por país. peaks: Map cc -> { n, at }; list: lo que devuelve tally().countries.
// Si un país supera su récord, se actualiza (con la hora) y se devuelve la lista de los que cambiaron, para guardarlos.
function updatePeaks(peaks, list, now) {
  const changed = [];
  for (const { cc, n } of list) {
    const cur = peaks.get(cc);
    if (!cur || n > cur.n) { const rec = { n, at: now }; peaks.set(cc, rec); changed.push({ cc, n, at: now }); }
  }
  return changed;
}
const peaksList = peaks => [...peaks].map(([cc, v]) => ({ cc, n: v.n, at: v.at })).sort((a, b) => b.n - a.n || (a.cc < b.cc ? -1 : 1));

module.exports = { placeOf, countryOf, tally, valid, updatePeaks, peaksList };
