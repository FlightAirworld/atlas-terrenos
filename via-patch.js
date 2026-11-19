'use strict';
// 🌿 Terreno verde en carreteras y ríos: si la parcela TOCA una calle, vía de tren, pista, río, lago o mar, al comprar sale SIEMPRE un terreno verde (nunca casa).
// Antes solo salía verde si lo de debajo cubría al menos un 5 % de la parcela y sin margen: si solo la rozaba salía casa.
// Cambios en app.js (parcelaSobreVia):
//   1) VIA_MIN_PCT 0.05 -> 0.002 (basta con que toque)
//   2) calles, vías y pistas con 1 m más de margen por lado; ríos con 1,5 m; lagos y mar con 1,5 m
//   3) espera hasta ~4 s a que carguen las teselas del mapa (antes ~2 s)
// Se ejecuta con «npm install» (postinstall, en Render), igual que seo-patch.js. Es idempotente y NUNCA falla:
// si algún punto de anclaje no encaja o el resultado no compila, deja app.js como está.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const STEPS = [
  { done: 'const VIA_MIN_PCT = 0.002;', from: 'const VIA_MIN_PCT = 0.05;', to: 'const VIA_MIN_PCT = 0.002;' },
  { done: '/* via-patch:lineas */',
    from: 'for (const f of lineas) lineBuf(f, (ROAD_WIDTH[f.properties && f.properties.class] || 7) / 2);',
    to: 'for (const f of lineas) lineBuf(f, (ROAD_WIDTH[f.properties && f.properties.class] || 7) / 2 + 1); /* via-patch:lineas */' },
  { done: '/* via-patch:rios */',
    from: 'for (const f of rios.slice(0, 12)) lineBuf(f, (WATERWAY_WIDTH[f.properties && f.properties.class] || 3) / 2);',
    to: 'for (const f of rios.slice(0, 12)) lineBuf(f, (WATERWAY_WIDTH[f.properties && f.properties.class] || 3) / 2 + 1.5); /* via-patch:rios */' },
  { done: '/* via-patch:polis */',
    from: 'try { add(turf.polygon(pc)); } catch (er) {}',
    to: "try { let pf = turf.polygon(pc); try { const bf = turf.buffer(pf, 1.5, { units: 'meters', steps: 1 }); if (bf) pf = bf; } catch (er) {} add(pf); } catch (er) {} /* via-patch:polis */" },
  { done: 'i < 25 && !gl.areTilesLoaded()',
    from: 'i < 12 && !gl.areTilesLoaded()',
    to: 'i < 25 && !gl.areTilesLoaded()' }
];

function patch(src) {
  let h = src;
  for (const s of STEPS) {
    if (h.includes(s.done)) continue;                         // ya aplicado
    if (h.split(s.from).length !== 2) return null;            // el anclaje no está (o está repetido): no se toca nada
    h = h.replace(s.from, () => s.to);
  }
  return h;
}

function run(file) {
  try {
    const before = fs.readFileSync(file, 'utf8');
    const after = patch(before);
    if (after === null) { console.warn('via-patch: no encuentro los puntos de anclaje en app.js, no se toca'); return; }
    if (after === before) { console.log('via-patch: app.js ya estaba parcheado'); return; }
    new vm.Script(after, { filename: 'app.js' });             // salvaguarda: tiene que compilar
    fs.writeFileSync(file, after);
    console.log('via-patch: app.js parcheado (' + before.length + ' -> ' + after.length + ' caracteres)');
  } catch (e) {
    console.warn('via-patch: omitido (' + (e && e.message) + ')');
  }
}

module.exports = { patch, run };
if (require.main === module) run(path.join(__dirname, 'app.js'));
