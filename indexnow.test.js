'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { keyFor, urlsFromSitemap, payload, submit } = require('./indexnow');

test('IndexNow: la clave es estable, válida y se puede fijar con INDEXNOW_KEY', () => {
  const a = keyFor({ DATABASE_URL: 'x' });
  assert.match(a, /^[a-f0-9]{32}$/);
  assert.strictEqual(a, keyFor({ DATABASE_URL: 'x' }));
  assert.notStrictEqual(a, keyFor({ DATABASE_URL: 'y' }));
  assert.strictEqual(keyFor({ INDEXNOW_KEY: 'abcdef123456', DATABASE_URL: 'x' }), 'abcdef123456');
  assert.match(keyFor({ INDEXNOW_KEY: 'corta' }), /^[a-f0-9]{32}$/);   // clave inválida: se ignora
});
test('IndexNow: saca del sitemap solo las URLs de nuestro dominio, sin repetir', () => {
  const xml = '<urlset><url><loc>https://redecoraelmundo.com/</loc></url><url><loc>https://redecoraelmundo.com/juego.html</loc></url><url><loc>https://otra.com/x</loc></url><url><loc>https://redecoraelmundo.com/</loc></url></urlset>';
  assert.deepStrictEqual(urlsFromSitemap(xml), ['https://redecoraelmundo.com/', 'https://redecoraelmundo.com/juego.html']);
});
test('IndexNow: el envío lleva host, clave y keyLocation; 200 y 202 son éxito', async () => {
  const p = payload('k'.repeat(10), ['https://redecoraelmundo.com/']);
  assert.strictEqual(p.keyLocation, 'https://redecoraelmundo.com/kkkkkkkkkk.txt');
  let sent;
  const ok = await submit('kkkkkkkkkk', ['https://redecoraelmundo.com/'], async (u, o) => { sent = JSON.parse(o.body); return { status: 202 }; });
  assert.deepStrictEqual([ok.ok, ok.n, sent.host], [true, 1, 'redecoraelmundo.com']);
  assert.strictEqual((await submit('kkkkkkkkkk', ['https://redecoraelmundo.com/'], async () => ({ status: 403 }))).ok, false);
  assert.strictEqual((await submit('kkkkkkkkkk', [], async () => { throw new Error('no debe llamar'); })).n, 0);
});
