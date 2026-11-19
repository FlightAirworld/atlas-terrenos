'use strict';
// Conecta Cascada con server.js (misma idea que i18n-wire.js). Se ejecuta solo en «npm install» (Render).
//   1) monta cascada-server.js junto al rasca y gana, 2) añade las rutas /api/cascada, 3) crea su tabla al arrancar,
//   4) impide que cascada-server.js se pueda descargar desde la web.
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

const count = (s, sub) => s.split(sub).length - 1;

function patchServer(src) {
  if (src.includes('cascadaMod')) return src;   // ya conectado
  let out = src;
  for (const [from, to] of EDITS) {
    if (count(out, from) !== 1) return null;    // no encaja: no se toca nada
    out = out.replace(from, () => to);
  }
  new vm.Script(out);                           // lanza error si el JavaScript resultante no es válido
  return out;
}

function run(dir) {
  dir = dir || __dirname;
  try {
    const f = path.join(dir, 'server.js');
    if (!fs.existsSync(f) || !fs.existsSync(path.join(dir, 'cascada-server.js'))) return;
    const before = fs.readFileSync(f, 'utf8');
    const after = patchServer(before);
    if (after === null) console.warn('cascada-wire: server.js ha cambiado y no encaja, no se toca');
    else if (after !== before) { fs.writeFileSync(f, after); console.log('cascada-wire: Cascada conectada en server.js'); }
    else console.log('cascada-wire: server.js ya estaba conectado');
  } catch (e) {
    console.warn('cascada-wire: omitido (' + (e && e.message) + ')');
  }
}

module.exports = { run, patchServer };
if (require.main === module) run(__dirname);
