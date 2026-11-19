'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { advance, share } = require('./jackpots');
test('cada partida suma 10 × apuesta a los tres botes', () => {
  assert.deepEqual(advance([0,0,0,0], 0), { jackpots:[0,10,10,10], payout:0 });
  assert.deepEqual(advance([0,30,70,110], 0, 5), { jackpots:[0,80,120,160], payout:0 });
});
test('con apuesta 50 se cobra el bote entero y solo ese vuelve a cero', () => {
  assert.deepEqual(advance([0,3000,7000,11000], 1, 50), { jackpots:[0,0,7500,11500], payout:3500 });
  assert.deepEqual(advance([0,3000,7000,11000], 2, 50), { jackpots:[0,3500,0,11500], payout:7500 });
  assert.deepEqual(advance([0,3000,7000,11000], 3, 50), { jackpots:[0,3500,7500,0], payout:11500 });
});
test('el bote es proporcional a la apuesta (máximo ×50)', () => {
  assert.equal(share(29000, 50), 29000);
  assert.equal(share(29000, 25), 14500);
  assert.equal(share(29000, 10), 5800);
  assert.equal(share(29000, 1), 580);
  assert.equal(share(29000, 99), 29000);   // nunca más del bote entero
});
test('con apuesta menor se cobra solo su parte y el resto se queda en el bote', () => {
  const r = advance([0,29000,13000,31170], 1, 1);   // bote Río tras sumar 10 = 29010 → 1/50 = 580
  assert.equal(r.payout, 580);
  assert.deepEqual(r.jackpots, [0, 28430, 13010, 31180]);
  const r10 = advance([0,29000,13000,31170], 2, 10);  // 13100 × 10/50 = 2620
  assert.equal(r10.payout, 2620);
  assert.deepEqual(r10.jackpots, [0, 29100, 10480, 31270]);
});
test('el dinero se conserva: cobrado + resto = bote tras sumar', () => {
  for (const m of [1, 2, 3, 4, 7, 13, 25, 49, 50]) {
    const r = advance([0, 12345, 777, 99999], 3, m);
    assert.equal(r.payout + r.jackpots[3], 99999 + 10 * m);
  }
});
