'use strict';
// Añade integrity="sha384-…" y crossorigin a los <script> y <link rel="stylesheet"> externos de index.html.
// Uso (con internet, en tu ordenador):  node tools/add-sri.js     y luego sube index.html cambiado.
// Repítelo cada vez que cambies la versión de una librería externa.
const fs = require('node:fs');
const crypto = require('node:crypto');
const file = require('node:path').join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const tags = [...html.matchAll(/<(script|link)\b[^>]*?(?:src|href)="(https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)[^"]+)"[^>]*>/g)];
(async () => {
  for (const m of tags) {
    const [tag, , url] = m;
    if (/integrity=/.test(tag)) continue;
    if (/<link/.test(tag) && !/stylesheet/.test(tag)) continue;
    if (/@(latest|\d+)(["/])/.test(url) || !/@\d+\.\d+\.\d+/.test(url)) { console.error('Versión sin fijar, no se puede proteger:', url); continue; }
    const r = await fetch(url);
    if (!r.ok) { console.error('No se pudo descargar', url, r.status); continue; }
    const hash = 'sha384-' + crypto.createHash('sha384').update(Buffer.from(await r.arrayBuffer())).digest('base64');
    html = html.replace(tag, tag.replace(/\s*\/?>$/, ` integrity="${hash}" crossorigin="anonymous">`));
    console.log('OK', url);
  }
  fs.writeFileSync(file, html);
})();
