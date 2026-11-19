'use strict';
// Conecta Cascada con server.js (misma idea que i18n-wire.js). Se ejecuta solo en «npm install» (Render).
//   1) monta cascada-server.js junto al rasca y gana, 2) añade las rutas /api/cascada (+ /api/cascada/bonus/*), 3) crea sus tablas al arrancar,
//   4) impide que cascada-server.js se pueda descargar desde la web, 5) carga cascada/bg.js en la página principal
//   para que el modo automático / las compras sigan jugando cuando el jugador sale de Cascada.
// Es idempotente y NUNCA falla: cada cambio tiene que encajar exactamente UNA vez y el resultado se comprueba con el analizador de JavaScript;
// si algo no cuadra, no se escribe nada y el resto del juego sigue igual (Cascada diría que no está disponible).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const EDITS = [
  [   // 1) montaje del módulo
    "// Bingo (bingo-server.js): sala compartida con rondas, mismo patrón",
    "// Cascada (cascada-server.js): tragaperras con los créditos del jugador, mismo patrón\n" +
    "const cascadaMod = () => cascadaMod.m || (cascadaMod.m = require('./cascada-server')({ pool, run, all, needUser, ensureUserPack, HttpError, rateHit }));\n" +
    "// Bingo (bingo-server.js): sala compartida con rondas, mismo patrón",
  ],
  [   // 2) rutas
    "if (req.method === 'POST' && pn === '/api/rasca/play') return rascaMod().play(req);",
    "if (req.method === 'POST' && pn === '/api/rasca/play') return rascaMod().play(req);\n" +
    "  if (req.method === 'GET' && pn === '/api/cascada') return cascadaMod().get(req);\n" +
    "  if (req.method === 'POST' && pn === '/api/cascada/play') return cascadaMod().play(req, await readJson(req));",
  ],
  [   // 3) tabla al arrancar
    ".then(() => rascaMod().init()).catch(e => console.error('No se pudieron crear las tablas del rasca y gana:', e.message))",
    ".then(() => rascaMod().init()).catch(e => console.error('No se pudieron crear las tablas del rasca y gana:', e.message))\n" +
    "  .then(() => cascadaMod().init()).catch(e => console.error('No se pudieron crear las tablas de Cascada:', e.message))",
  ],
  [   // 4) el código del servidor no se sirve como archivo
    "(trivia|rasca|parejas|minijuegos|bingo)-server\\.js",
    "(trivia|rasca|parejas|minijuegos|bingo|cascada)-server\\.js",
  ],
];

// Rutas del tesoro: se añaden detrás de la ruta de jugar (también si server.js ya tenía Cascada conectada de antes)
const BONUS_ANCHOR = "if (req.method === 'POST' && pn === '/api/cascada/play') return cascadaMod().play(req, await readJson(req));";
const BONUS_ROUTE = "\n  if (req.method === 'POST' && pn.startsWith('/api/cascada/bonus/')) return cascadaMod().bonus(req, pn.slice('/api/cascada/bonus/'.length), await readJson(req));";

const count = (s, sub) => s.split(sub).length - 1;

function patchServer(src) {
  let out = src;
  if (!out.includes('cascadaMod')) {
    for (const [from, to] of EDITS) {
      if (count(out, from) !== 1) return null;    // no encaja: no se toca nada
      out = out.replace(from, () => to);
    }
  }
  if (!out.includes('/api/cascada/bonus/')) {
    if (count(out, BONUS_ANCHOR) !== 1) return null;
    out = out.replace(BONUS_ANCHOR, () => BONUS_ANCHOR + BONUS_ROUTE);
  }
  if (out === src) return src;                    // ya conectado del todo
  new vm.Script(out);                             // lanza error si el JavaScript resultante no es válido
  return out;
}

// La página principal carga cascada/bg.js (sigue jugando en segundo plano fuera de Cascada)
const BG_TAG = '<script src="/cascada/bg.js" defer></script>';
function patchIndex(src) {
  if (src.includes('cascada/bg.js')) return src;
  const i = src.lastIndexOf('</body>');
  if (i < 0) return null;
  return src.slice(0, i) + BG_TAG + '\n' + src.slice(i);
}

function run(dir) {
  dir = dir || __dirname;
  try {
    const f = path.join(dir, 'server.js');
    if (fs.existsSync(f) && fs.existsSync(path.join(dir, 'cascada-server.js'))) {
      const before = fs.readFileSync(f, 'utf8');
      const after = patchServer(before);
      if (after === null) console.warn('cascada-wire: server.js ha cambiado y no encaja, no se toca');
      else if (after !== before) { fs.writeFileSync(f, after); console.log('cascada-wire: Cascada conectada en server.js'); }
      else console.log('cascada-wire: server.js ya estaba conectado');
    }
    const h = path.join(dir, 'index.html');
    if (fs.existsSync(h) && fs.existsSync(path.join(dir, 'cascada', 'bg.js'))) {
      const b = fs.readFileSync(h, 'utf8'), a = patchIndex(b);
      if (a && a !== b) { fs.writeFileSync(h, a); console.log('cascada-wire: bg.js añadido a index.html'); }
    }
  } catch (e) {
    console.warn('cascada-wire: omitido (' + (e && e.message) + ')');
  }
}

module.exports = { run, patchServer, patchIndex };
if (require.main === module) run(__dirname);
