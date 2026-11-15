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

// Con conexión lenta no se espera a la red:
//  · imágenes y fuentes: primero lo guardado (cambian muy poco) y solo van a la red si no están;
//  · HTML, JS y CSS: red primero, pero si tarda más de 3 s se usa lo guardado (así el juego abre aunque la red vaya fatal);
//  · /api y lo externo: siempre directo a la red.
const SLOW_MS = 3000;
const guardar = (req, res) => { if (res && res.status === 200 && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); } return res; };

function redPrimero(req) {
  const net = fetch(req).then(res => guardar(req, res));
  const lenta = new Promise((_, no) => setTimeout(no, SLOW_MS));
  return Promise.race([net, lenta]).catch(async () => {
    const hit = await caches.match(req);
    if (hit) { net.catch(() => {}); return hit; }                     // lo guardado ya; la descarga sigue y deja lo nuevo para la próxima
    if (req.mode === 'navigate') { const home = await caches.match('/'); if (home) { net.catch(() => {}); return home; } }
    return net;                                                        // no hay nada guardado: se espera a la red
  });
}
async function guardadoPrimero(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  return fetch(req).then(res => guardar(req, res));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // mapas, Supabase, API externa: directo a la red
  if (/^\/(api|auth|socket|ws|admin)/.test(url.pathname)) return;  // datos en vivo: nunca a caché
  if (url.pathname === '/sw.js') return;
  const estatico = /\.(png|jpe?g|webp|gif|avif|ico|svg|woff2?|ttf)$/i.test(url.pathname);
  e.respondWith(estatico ? guardadoPrimero(req) : redPrimero(req));
});
