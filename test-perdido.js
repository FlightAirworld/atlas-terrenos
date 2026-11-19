'use strict';
const assert = require('node:assert/strict');
const lost = (stake, prize) => Math.max(0, stake - prize);
assert.equal(lost(10, 0), 10);
assert.equal(lost(10, 4), 6);
assert.equal(lost(10, 10), 0);
assert.equal(lost(10, 15), 0);
assert.equal([lost(10, 0), lost(10, 15), lost(10, 4)].reduce((a,b)=>a+b,0), 16);
console.log('5 pruebas de cálculo de PERDIDO superadas');
