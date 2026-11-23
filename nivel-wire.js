'use strict';
// Conecta el NIVEL de los jugadores (0-100 sobre la cabeza del muñeco) con el juego. Misma idea que cascada-wire.js. Se ejecuta en «npm install» (Render) y en build-static.js.
//   1) server.js: añade la ruta GET /api/niveles (la calcula nivel-server.js) justo antes de /api/online/pos
//   2) server.js: impide que nivel-server.js se pueda descargar desde la web (si encuentra el filtro de los demás *-server.js)
//   3) index.html: carga nivel.js (el número sobre la cabeza)
// Es idempotente y NUNCA falla: cada cambio tiene que encajar exactamente UNA vez y el resultado se comprueba con el analizador de JavaScript;
// si algo no cuadra, no se escribe nada y el resto del juego sigue igual (simplemente no se ve el nivel).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROUTE_ANCHOR = "if (req.method === 'POST' && pn === '/api/online/pos') return onlinePos(req, await readJson(req));";
const ROUTE = "if (req.method === 'GET' && pn === '/api/niveles') return require('./nivel-server')({ all: typeof all === 'function' ? all : null, pool: typeof pool !== 'undefined' ? pool : null }).get(req);\n  ";

// Filtro que esconde los *-server.js (con o sin Cascada ya conectada): se le añade «nivel»
const BLOCKS = [
  ['|cascada)-server\\.js', '|cascada|nivel)-server\\.js'],
  ['|bingo)-server\\.js', '|bingo|nivel)-server\\.js'],
];

const count = (s, sub) => s.split(sub).length - 1;

function patchServer(src) {
  let out = src;
  if (!out.includes('/api/niveles')) {
    if (count(out, ROUTE_ANCHOR) !== 1) return null;   // no encaja: no se toca nada
    out = out.replace(ROUTE_ANCHOR, () => ROUTE + ROUTE_ANCHOR);
  }
  if (!/\|nivel\)-server/.test(out)) {                 // opcional: si no encuentra el filtro, sigue sin él
    for (const [from, to] of BLOCKS) {
      if (count(out, from) === 1) { out = out.replace(from, () => to); break; }
    }
  }
  if (out === src) return src;                         // ya conectado del todo
  new vm.Script(out);                                  // lanza error si el JavaScript resultante no es válido
  return out;
}

const TAG = '<script src="nivel.js" defer></script>';
function patchIndex(src) {
  if (src.includes('nivel.js')) return src;
  const i = src.lastIndexOf('</body>');
  if (i < 0) return null;
  return src.slice(0, i) + TAG + '\n' + src.slice(i);
}

// opts.indexOnly: para build-static.js (el sitio estático no lleva server.js)
function run(dir, opts) {
  dir = dir || __dirname;
  try {
    if (!(opts && opts.indexOnly)) {
      const f = path.join(dir, 'server.js');
      if (fs.existsSync(f) && fs.existsSync(path.join(dir, 'nivel-server.js'))) {
        const before = fs.readFileSync(f, 'utf8'), after = patchServer(before);
        if (after === null) console.warn('nivel-wire: server.js ha cambiado y no encaja, no se toca');
        else if (after !== before) { fs.writeFileSync(f, after); console.log('nivel-wire: ruta /api/niveles conectada en server.js'); }
        else console.log('nivel-wire: server.js ya estaba conectado');
      }
    }
    const h = path.join(dir, 'index.html');
    if (fs.existsSync(h) && fs.existsSync(path.join(dir, 'nivel.js'))) {
      const b = fs.readFileSync(h, 'utf8'), a = patchIndex(b);
      if (a && a !== b) { fs.writeFileSync(h, a); console.log('nivel-wire: nivel.js añadido a index.html'); }
    }
  } catch (e) {
    console.warn('nivel-wire: omitido (' + (e && e.message) + ')');
  }
}

module.exports = { run, patchServer, patchIndex };
if (require.main === module) run(__dirname);
