'use strict';
// Comprueba que todas las imágenes que nombra el código existen (así no vuelve a pasar que un planeta se quede con las casas rotas).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const OPCIONALES = new Set(['images/gpay-button.svg', 'images/splash.jpg']);   // el código ya tiene un plan B si no existen
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const existe = rel => fs.existsSync(path.join(ROOT, rel));
const fuentes = fs.readdirSync(ROOT).filter(f => /\.(js|html)$/.test(f) && !/\.test\.js$/.test(f));

// Saca de un archivo el contenido de «const NOMBRE = [ ... ];» o «const NOMBRE = { ... };»
function bloque(src, nombre) {
  const m = new RegExp('const ' + nombre + ' = ([\\[{])').exec(src);
  if (!m) return null;
  const abre = m[1], cierra = abre === '[' ? ']' : '}';
  let i = m.index + m[0].length - 1, n = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === abre) n++; else if (src[j] === cierra && --n === 0) break; }
  return src.slice(i, j + 1);
}
const imagenesDe = txt => [...(txt || '').matchAll(/images\/[A-Za-z0-9_.-]+\.(?:webp|png|jpg|svg)/g)].map(m => m[0]);

test('todas las imágenes escritas en el código existen', () => {
  const faltan = [];
  for (const f of fuentes) {
    for (const img of new Set(imagenesDe(read(f)))) {
      if (!existe(img) && !OPCIONALES.has(img)) faltan.push(`${img}  (en ${f})`);
    }
  }
  assert.deepStrictEqual(faltan, [], 'Faltan imágenes:\n' + faltan.join('\n'));
});

test('cada casa tiene sus 4 tamaños (normal, -m, -s y -t)', () => {
  const faltan = [];
  for (const f of ['app.js', 'server.js']) {
    const src = read(f);
    for (const nombre of ['HOUSES', 'EXTRA_HOUSES', 'GOLD_HOUSES', 'WORLD_HOUSES']) {
      for (const img of new Set(imagenesDe(bloque(src, nombre)))) {
        for (const suf of ['', '-m', '-s', '-t']) {
          const p = img.replace(/\.webp$/, suf + '.webp');
          if (!existe(p)) faltan.push(`${p}  (${nombre} de ${f})`);
        }
      }
    }
  }
  assert.deepStrictEqual(faltan, [], 'Faltan tamaños de casas:\n' + faltan.join('\n'));
});

test('las casas de los planetas y del Pase Oro coinciden en app.js y server.js', () => {
  for (const nombre of ['WORLD_HOUSES', 'GOLD_HOUSES']) {
    const a = imagenesDe(bloque(read('app.js'), nombre)), s = imagenesDe(bloque(read('server.js'), nombre));
    assert.ok(a.length > 0 && s.length > 0, nombre + ' no se encontró');
    assert.deepStrictEqual(a, s, nombre + ' es distinta en app.js y server.js');
  }
});
