'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createGovernor } = require('./ligero');

// Simula `seconds` segundos de juego a `fps` fotogramas por segundo; devuelve los cambios de nivel [{t, level}].
function run(g, fromMs, seconds, fps, hidden) {
  const changes = [], step = 1000 / fps;
  let t = fromMs;
  for (const end = fromMs + seconds * 1000; t < end; t += step) {
    const n = g.frame(t, !!hidden);
    if (n != null) changes.push({ t: Math.round(t), level: n });
  }
  return { changes, t };
}

test('a 60 fps nunca sube de nivel', () => {
  const g = createGovernor();
  assert.deepStrictEqual(run(g, 0, 60, 60).changes, []);
  assert.strictEqual(g.level, 0);
  assert.ok(g.fps > 55);
});

test('a 30 fps (móvil en ahorro de batería) tampoco: no es lentitud', () => {
  const g = createGovernor();
  assert.deepStrictEqual(run(g, 0, 60, 30).changes, []);
});

test('a 12 fps sube a «ligero» pasados el arranque y unos 6 s de mala racha, y no antes', () => {
  const g = createGovernor();
  const { changes } = run(g, 0, 30, 12);
  assert.strictEqual(changes[0].level, 1);
  assert.ok(changes[0].t >= 10000 + 6000, 'no debe juzgar durante el arranque: ' + changes[0].t);
  assert.ok(changes[0].t <= 20000, 'tarda demasiado en reaccionar: ' + changes[0].t);
});

test('si tras bajar de nivel sigue yendo muy mal, sube a «muy ligero» y ahí se queda', () => {
  const g = createGovernor();
  const { changes } = run(g, 0, 90, 8);
  assert.deepStrictEqual(changes.map(c => c.level), [1, 2]);
  assert.strictEqual(g.level, 2);
});

test('si tras bajar de nivel va a 20 fps (mejor que 16) se queda en «ligero»', () => {
  const g = createGovernor();
  const a = run(g, 0, 20, 10);
  assert.strictEqual(a.changes[0].level, 1);
  const b = run(g, a.t, 60, 20);
  assert.deepStrictEqual(b.changes, []);
  assert.strictEqual(g.level, 1);
});

test('una racha mala corta (un tirón) no cuenta: hacen falta varias ventanas seguidas', () => {
  const g = createGovernor();
  let r = run(g, 0, 12, 60);
  r = run(g, r.t, 3, 8);            // 3 s lentos
  assert.deepStrictEqual(r.changes, []);
  r = run(g, r.t, 20, 60);          // se recupera
  assert.deepStrictEqual(r.changes, []);
  assert.strictEqual(g.level, 0);
});

test('con la pestaña oculta o congelada no se castiga al juego', () => {
  const g = createGovernor();
  assert.deepStrictEqual(run(g, 0, 60, 3, true).changes, []);               // oculta: 3 fps no cuentan
  const g2 = createGovernor();
  let r = run(g2, 0, 12, 60);
  g2.frame(r.t + 20000, false);                                              // hueco de 20 s: app en segundo plano
  r = run(g2, r.t + 20000, 30, 60);
  assert.deepStrictEqual(r.changes, []);
  assert.strictEqual(g2.level, 0);
});

test('si ya se parte de «ligero» (móvil justo o aprendido), el nivel inicial se respeta', () => {
  const g = createGovernor({ startLevel: 1 });
  assert.strictEqual(g.level, 1);
  assert.deepStrictEqual(run(g, 0, 40, 60).changes, []);
  assert.strictEqual(g.level, 1);
});

test('setLevel limita el nivel y reinicia la espera', () => {
  const g = createGovernor();
  g.setLevel(9); assert.strictEqual(g.level, 2);
  g.setLevel(-3); assert.strictEqual(g.level, 0);
  g.setLevel(0);
  assert.deepStrictEqual(run(g, 0, 3, 5).changes, []);   // tras el cambio hay un margen antes de volver a juzgar
});
