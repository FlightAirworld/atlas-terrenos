'use strict';
// Service worker mínimo: hace la app instalable y, sin conexión, muestra lo último que se vio.
// Siempre intenta primero la red, así nunca se queda atascado en una versión vieja.
// __BUILD__ lo sustituye build-static.js (o el servidor) en cada despliegue para renovar la caché.
const CACHE = 'atlas-__BUILD__';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // mapas, Supabase, API externa: directo a la red
  if (/^\/(api|auth|socket|ws|admin)/.test(url.pathname)) return;  // datos en vivo: nunca a caché

  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const home = await caches.match('/');
        if (home) return home;
      }
      throw err;
    }
  })());
});
