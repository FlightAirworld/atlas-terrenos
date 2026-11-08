'use strict';
// Pruebas rápidas: node --test   (se ejecutan también en GitHub Actions antes de desplegar)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const jsFiles = fs.readdirSync(root).filter(f => f.endsWith('.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('todos los .js tienen sintaxis válida', () => {
  for (const f of jsFiles) execFileSync(process.execPath, ['--check', path.join(root, f)]);
});
test('no hay archivos duplicados tipo "nombre (1).js"', () => {
  const dup = fs.readdirSync(root).filter(f => / \(\d+\)\./.test(f));
  assert.deepStrictEqual(dup, []);
});
test('los scripts locales de index.html existen', () => {
  for (const m of html.matchAll(/<script[^>]+src="([^":]+\.js)"/g)) assert.ok(fs.existsSync(path.join(root, m[1])), 'falta ' + m[1]);
});
test('las librerías externas llevan versión exacta', () => {
  for (const m of html.matchAll(/https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net\/npm)\/[^"']+/g)) {
    assert.match(m[0], /@\d+\.\d+\.\d+/, 'versión sin fijar: ' + m[0]);
  }
});
test('el service worker usa el marcador de versión y la caché se limpia', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes('__BUILD__'));
});
test('el servidor maneja SIGTERM', () => {
  assert.match(fs.readFileSync(path.join(root, 'server.js'), 'utf8'), /process\.on\('SIGTERM'/);
});
test('schema.sql define todas las tablas que crea el servidor', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8'), schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
  for (const m of server.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) assert.ok(new RegExp('CREATE TABLE IF NOT EXISTS ' + m[1] + '\\b').test(schema), 'falta en schema.sql: ' + m[1]);
});

test('los peatones dicen nombres de jugadores y el servidor los ofrece en /api/names', () => {
  const ciudad = fs.readFileSync(path.join(root, 'ciudad.js'), 'utf8'), server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(server, /pn === '\/api\/names'/);
  const list = /const NAMED = \[([\s\S]*?)\];/.exec(ciudad);
  assert.ok(list && (list[1].match(/\{n\}/g) || []).length >= 20, 'faltan frases con {n}');
});

test('toda casa del selector (app.js) la acepta el servidor (server.js)', () => {
  const list = (src, from) => { const i = src.indexOf(from); return [...src.slice(i, src.indexOf('];', i)).matchAll(/'(images\/[^']+)'/g)].map(m => m[1]); };
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8'), server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const srv = new Set(list(server, 'const HOUSES = ['));
  const missing = [...list(app, 'const HOUSES = ['), ...list(app, 'const EXTRA_HOUSES = [')].filter(h => !srv.has(h));
  assert.deepEqual(missing, [], 'casas del cliente que el servidor rechazaría: ' + missing.join(', '));
  // el reparto al azar del servidor (álbum) debe ser idéntico al de HOUSES de app.js
  assert.deepEqual(list(server, 'const CLIENT_RANDOM_POOL = ['), list(app, 'const HOUSES = ['));
});

test('las casas del Pase Oro son las mismas en app.js y server.js, y existen sus imágenes', () => {
  const grab = (src, from) => { const i = src.indexOf(from); return [...src.slice(i, src.indexOf('];', i)).matchAll(/'(images\/[^']+)'/g)].map(m => m[1]); };
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8'), server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const a = grab(app, 'const GOLD_HOUSES = ['), s = grab(server, 'const GOLD_HOUSES = [');
  assert.ok(a.length >= 6);
  assert.deepEqual(a, s);
  for (const h of a) for (const suf of ['', '-s', '-m', '-t']) assert.ok(fs.existsSync(path.join(root, h.replace(/\.webp$/, suf + '.webp'))), 'falta ' + h + suf);
});
