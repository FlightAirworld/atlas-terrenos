'use strict';
// IndexNow: avisa a Bing, Yandex y otros buscadores de que la web cambió (Google no lo admite: para Google, Search Console + sitemap.xml).
// La clave sale de INDEXNOW_KEY o, si no está, se deriva (hash) de DATABASE_URL: es la misma en cada despliegue y no hay que configurar nada.
// El servidor la publica en /<clave>.txt, que es lo que los buscadores comprueban.
const crypto = require('node:crypto');

const HOST = 'redecoraelmundo.com';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function keyFor(env) {
  const k = String((env && env.INDEXNOW_KEY) || '').trim();
  if (/^[A-Za-z0-9-]{8,128}$/.test(k)) return k;
  return crypto.createHash('sha256').update('indexnow|' + String((env && env.DATABASE_URL) || 'dev')).digest('hex').slice(0, 32);
}

function urlsFromSitemap(xml) {   // direcciones <loc> de nuestro dominio
  const out = [];
  for (const m of String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    try { if (new URL(m[1]).hostname === HOST) out.push(m[1]); } catch {}
  }
  return [...new Set(out)];
}

function payload(key, urls) {
  return { host: HOST, key, keyLocation: `https://${HOST}/${key}.txt`, urlList: urls.slice(0, 10000) };
}

async function submit(key, urls, fetchFn = fetch) {   // devuelve { ok, status, n }
  if (!urls.length) return { ok: false, status: 0, n: 0 };
  const r = await fetchFn(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload(key, urls)), signal: AbortSignal.timeout(15_000) });
  return { ok: r.status === 200 || r.status === 202, status: r.status, n: urls.length };   // 200/202 = aceptado
}

module.exports = { keyFor, urlsFromSitemap, payload, submit, HOST };
