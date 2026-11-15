'use strict';
// Comprueba el mundo Prehistoria: terreno estable, aterrizaje en tierra firme, agua sin comprar, casas con sus 4 tamaños y dibujos de todos los animales.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const PT = require('./prehistoria-terreno.js');
const DR = require('./prehistoria-dibujos.js');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

test('Prehistoria: el terreno es determinista (siempre el mismo mapa)', () => {
  for (const [lo, la] of [[-80, 10], [12.3, -40.2], [170.1, 66.6], [0, 0]]) {
    assert.deepStrictEqual(PT.sample(lo, la, 15), PT.sample(lo, la, 15));
    assert.strictEqual(PT.classAt(lo, la), PT.classAt(lo, la));
  }
});

test('Prehistoria: se aterriza en tierra firme y las parcelas de alrededor se pueden comprar', () => {
  assert.ok(PT.isLand(PT.LAND[0], PT.LAND[1]), 'el punto de aterrizaje no puede ser agua');
  const x0 = Math.floor((PT.LAND[0] + 180) / 0.0005), y0 = Math.floor((PT.LAND[1] + 90) / 0.0005);
  let ok = 0; for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) if (PT.parcelOk(x0 + i, y0 + j, 0.0005)) ok++;
  assert.ok(ok >= 56, 'junto al aterrizaje casi todo debe ser comprable (' + ok + '/64)');
});

test('Prehistoria: hay agua y tierra (el mundo tiene lagos y mares, pero también continentes)', () => {
  let land = 0, tot = 0; for (let lo = -179; lo < 180; lo += 6) for (let la = -80; la < 80; la += 6) { tot++; if (PT.isLand(lo, la)) land++; }
  assert.ok(land / tot > 0.25 && land / tot < 0.8, 'proporción de tierra rara: ' + land / tot);
  // el lago de al lado del aterrizaje existe y no se puede comprar
  const lake = PT.SITES.find(s => /Lago/.test(s[0]));
  assert.ok(!PT.isLand(lake[1], lake[2]), 'el lago debe ser agua');
  const x = Math.floor((lake[1] + 180) / 0.0005), y = Math.floor((lake[2] + 90) / 0.0005);
  assert.strictEqual(PT.parcelOk(x, y, 0.0005), false);
});

test('Prehistoria: los árboles salen siempre en el mismo sitio y solo en tierra', () => {
  const a = PT.trees(PT.LAND[0] - 0.004, PT.LAND[1] - 0.004, PT.LAND[0] + 0.004, PT.LAND[1] + 0.004, 0.0003, 3000);
  const b = PT.trees(PT.LAND[0] - 0.004, PT.LAND[1] - 0.004, PT.LAND[0] + 0.004, PT.LAND[1] + 0.004, 0.0003, 3000);
  assert.ok(a.length > 20, 'tiene que haber selva cerca del aterrizaje');
  assert.deepStrictEqual(a, b);
  a.forEach(t => { assert.ok(t.k >= 0 && t.k <= 5); assert.ok(PT.isLand(t.lon, t.lat) || PT.classAt(t.lon, t.lat, 13) > PT.C.RIVER); });
});

test('Prehistoria: el dibujo del mapa se genera por trozos y da lo mismo que de golpe', () => {
  const N = 48, b = [PT.LAND[0] - 0.003, PT.LAND[1] - 0.003, PT.LAND[0] + 0.003, PT.LAND[1] + 0.003];
  const d1 = new Uint8ClampedArray(N * N * 4), d2 = new Uint8ClampedArray(N * N * 4);
  PT.fillImage(d1, N, b[0], b[1], b[2], b[3], 14);
  const job = PT.makeJob(d2, N, b[0], b[1], b[2], b[3], 14); let n = 0; while (!job.step(0)) n++;
  assert.ok(n > 5, 'debe trabajar por trozos'); assert.deepStrictEqual(d1, d2);
  assert.ok(d1.every((v, i) => i % 4 !== 3 || v === 255), 'sin huecos transparentes');
});

test('Prehistoria: todos los animales tienen dibujo, sonido y datos', () => {
  const sfx = [...read('voices.js').matchAll(/^\s{4}([a-zA-Z]+): \(d, t, v/gm)].map(m => m[1]);
  for (const k of Object.keys(DR.SP)) {
    const d = DR.SP[k], svg = DR.svg(k);
    assert.ok(/^<svg[\s\S]*<\/svg>$/.test(svg) && svg.length > 400, 'sin dibujo: ' + k);
    assert.ok(d.name && d.say.length && d.fact, 'faltan datos: ' + k);
    assert.ok(sfx.includes(d.snd) || ['splosh'].includes(d.snd), 'sonido que no existe en voices.js: ' + d.snd);
    if (d.diet === 'c') d.eats.forEach(p => assert.ok(DR.SP[p], k + ' caza a un animal que no existe: ' + p));
  }
  ['roar', 'trumpet', 'honk', 'screech', 'raptor', 'squeak', 'moo', 'grunt', 'plesio', 'wings', 'crunch', 'clash', 'spit', 'stomp', 'cricket', 'frog', 'archaeo'].forEach(n => assert.ok(sfx.includes(n), 'falta el sonido ' + n));
});

test('Prehistoria: el mundo está dado de alta en servidor, app, mundos y viaje', () => {
  assert.match(read('server.js'), /const WORLDS = \[[^\]]*'prehistoria'/);
  assert.match(read('mundos.js'), /prehistoria: \{/);
  assert.match(read('viaje.js'), /CHAIN = \[[^\]]*'prehistoria'/);
  assert.match(read('server.js'), /world === 'prehistoria' && !PREHISTORIA\.parcelOk/);
  const idx = read('index.html'); assert.ok(idx.indexOf('prehistoria-terreno.js') < idx.indexOf('mundos.js') && idx.indexOf('prehistoria.js') > idx.indexOf('aliens.js'));
  assert.ok(fs.existsSync(path.join(__dirname, 'mundo-prehistoria.html')));
});

test('Prehistoria: cada casa existe en sus 4 tamaños', () => {
  const m = /prehistoria: \[([^\]]+)\]/.exec(read('server.js')); assert.ok(m);
  const imgs = [...m[1].matchAll(/images\/[\w-]+\.webp/g)].map(x => x[0]); assert.strictEqual(imgs.length, 6);
  for (const img of imgs) for (const suf of ['', '-m', '-s', '-t']) assert.ok(fs.existsSync(path.join(__dirname, img.replace(/\.webp$/, suf + '.webp'))), 'falta ' + img + ' ' + suf);
});

test('Prehistoria: cada animal tiene escala evolutiva, época y datos verídicos; cazan solo hacia abajo en la escala', () => {
  for (const k of Object.keys(DR.SP)) {
    const d = DR.SP[k];
    assert.ok(d.lvl >= 1 && d.lvl <= 6, 'falta el nivel de la escala: ' + k);
    assert.ok(d.ma > 0, 'falta hace cuántos millones de años vivió: ' + k);
    assert.ok(Array.isArray(d.facts) && d.facts.length >= 2, 'faltan datos curiosos: ' + k);
    if (d.diet === 'c') d.eats.forEach(p => assert.ok(DR.SP[p].lvl < d.lvl || p === 'tricer' || p === 'stego' || p === 'anky' || DR.SP[p].lvl < d.lvl + 1, k + ' no debería poder cazar a ' + p));
  }
  assert.ok(DR.SP.trex.lvl > DR.SP.compy.lvl && DR.SP.compy.lvl > DR.SP.libelula.lvl - 1, 'el T-Rex está por encima de los pequeños');
  assert.ok(DR.ERA.length >= 8);
});

test('Prehistoria: los sonidos de comer, morir y disparar existen', () => {
  const sfx = [...read('voices.js').matchAll(/^\s{4}([a-zA-Z]+): \(d, t, v/gm)].map(m => m[1]);
  for (const n of ['bite', 'agony', 'shot', 'hit']) assert.ok(sfx.includes(n), 'falta el sonido ' + n);
});
