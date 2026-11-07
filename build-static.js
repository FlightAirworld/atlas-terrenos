'use strict';
// Genera la carpeta dist/ con SOLO la parte visible del juego, para un sitio estático
// (Static Site de Render, Cloudflare Pages, Netlify…) que nunca se duerme.
// Uso:  API_BASE=https://tu-servidor.onrender.com node build-static.js
const fs = require('node:fs');
const path = require('node:path');

const API_BASE = String(process.env.API_BASE || '').trim().replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+/.test(API_BASE)) {
  console.error('Falta la variable API_BASE con la dirección del servidor, por ejemplo https://atlas-terrenos.onrender.com');
  process.exit(1);
}
const OUT = path.join(__dirname, 'dist');
const EXT = new Set(['.html', '.js', '.css', '.png', '.jpg', '.webp', '.svg', '.ico', '.webmanifest', '.xml']);
const ROOT_EXTRA = new Set(['robots.txt']);   // .txt solo en la raíz (robots.txt); el resto de .txt no se publica
const SKIP_ROOT = /^(server\.js|build-static\.js|package(-lock)?\.json)$/;   // lo del servidor no se publica

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let count = 0;
(function copy(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || (!rel && e.name === 'dist')) continue;
    const src = path.join(dir, e.name), r = path.join(rel, e.name);
    if (e.isDirectory()) { copy(src, r); continue; }                  // images/ y demás carpetas
    if (!(EXT.has(path.extname(e.name)) || (!rel && ROOT_EXTRA.has(e.name))) || (!rel && SKIP_ROOT.test(e.name))) continue;
    fs.mkdirSync(path.dirname(path.join(OUT, r)), { recursive: true });
    fs.copyFileSync(src, path.join(OUT, r));
    count++;
  }
})(__dirname, '');

const swPath = path.join(OUT, 'sw.js');   // misma versión de caché que en el servidor
if (fs.existsSync(swPath)) fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(/__BUILD__/g, String(process.env.RENDER_GIT_COMMIT || 'dev').slice(0, 8)));

fs.writeFileSync(path.join(OUT, 'config.js'), `window.API_BASE = ${JSON.stringify(API_BASE)};\n`);
console.log(`dist/ listo: ${count} archivos, API en ${API_BASE}`);
