'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { advance } = require('./jackpots');
test('cada partida suma 10 créditos a los tres botes', () => {
  assert.deepEqual(advance([0,0,0,0], 0), { jackpots:[0,10,10,10], payout:0 });
  assert.deepEqual(advance([0,30,70,110], 0), { jackpots:[0,40,80,120], payout:0 });
});
test('al salir Río paga el acumulado y solo Río vuelve a cero', () => {
  assert.deepEqual(advance([0,30,70,110], 1), { jackpots:[0,0,80,120], payout:40 });
});
test('al salir Mar o Cascada reinicia únicamente el bote correspondiente', () => {
  assert.deepEqual(advance([0,30,70,110], 2), { jackpots:[0,40,0,120], payout:80 });
  assert.deepEqual(advance([0,30,70,110], 3), { jackpots:[0,40,80,0], payout:120 });
});
