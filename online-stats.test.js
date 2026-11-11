'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { countryOf, tally, updatePeaks, peaksList } = require('./online-stats');

test('País: manda la cabecera del proxy; si no hay, el país elegido en el juego; si no, nada', () => {
  assert.strictEqual(countryOf({ 'cf-ipcountry': 'pt' }, 'ES'), 'PT');
  assert.strictEqual(countryOf({ 'x-vercel-ip-country': 'DE' }, null), 'DE');
  assert.strictEqual(countryOf({}, 'es'), 'ES');
  assert.strictEqual(countryOf({}, null), null);
  assert.strictEqual(countryOf(undefined, undefined), null);
});
test('País: valores raros o desconocidos del proxy se ignoran', () => {
  for (const bad of ['XX', 'T1', 'ZZ', '', 'ESP', '1A', '<b>', 'E']) assert.strictEqual(countryOf({ 'cf-ipcountry': bad }, null), null, bad);
  assert.strictEqual(countryOf({ 'cf-ipcountry': 'XX' }, 'FR'), 'FR');       // cabecera inútil: usa el elegido
  assert.strictEqual(countryOf({}, 'javascript:alert(1)'), null);
});
test('Recuento: agrupa por país, ordena de más a menos y cuenta los sin país', () => {
  const m = new Map([['a', 'ES'], ['b', 'PT'], ['c', 'ES'], ['d', 'DE'], ['e', 'PT'], ['f', 'ES']]);
  const r = tally(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], m);
  assert.deepStrictEqual(r, { total: 8, unknown: 2, countries: [{ cc: 'ES', n: 3 }, { cc: 'PT', n: 2 }, { cc: 'DE', n: 1 }] });
});
test('Recuento: empates por código, vacío, y el total siempre cuadra', () => {
  assert.deepStrictEqual(tally([], new Map()), { total: 0, unknown: 0, countries: [] });
  const m = new Map([['a', 'FR'], ['b', 'DE']]);
  assert.deepStrictEqual(tally(['a', 'b'], m).countries.map(x => x.cc), ['DE', 'FR']);
  const big = new Map(), ids = [];
  for (let i = 0; i < 500; i++) { ids.push('c' + i); if (i % 7) big.set('c' + i, ['ES', 'PT', 'DE', 'FR', 'IT'][i % 5]); }
  const t = tally(ids, big);
  assert.strictEqual(t.countries.reduce((s, x) => s + x.n, 0) + t.unknown, t.total);
});
test('Recuento: con más países que el máximo, el resto pasa a «sin identificar» y el total cuadra', () => {
  const m = new Map(), ids = [];
  for (let i = 0; i < 100; i++) { const cc = String.fromCharCode(65 + Math.floor(i / 10)) + String.fromCharCode(65 + i % 10); ids.push('c' + i); m.set('c' + i, cc); }
  const t = tally(ids, m, 60);
  assert.strictEqual(t.countries.length, 60);
  assert.strictEqual(t.countries.reduce((s, x) => s + x.n, 0) + t.unknown, 100);
});
test('Récords: solo se actualiza el país que supera su máximo, y nunca baja', () => {
  const peaks = new Map();
  assert.deepStrictEqual(updatePeaks(peaks, [{ cc: 'ES', n: 3 }, { cc: 'PT', n: 1 }], 100), [{ cc: 'ES', n: 3, at: 100 }, { cc: 'PT', n: 1, at: 100 }]);
  assert.deepStrictEqual(updatePeaks(peaks, [{ cc: 'ES', n: 3 }, { cc: 'PT', n: 2 }], 200), [{ cc: 'PT', n: 2, at: 200 }]);   // ES empata: no cambia
  assert.deepStrictEqual(updatePeaks(peaks, [], 300), []);                                                                      // se van todos: el récord se queda
  assert.deepStrictEqual(peaksList(peaks), [{ cc: 'ES', n: 3, at: 100 }, { cc: 'PT', n: 2, at: 200 }]);
});
