'use strict';
// Conecta los idiomas extra (árabe, chino, ruso, japonés, coreano y turco, que viven en i18n-extra.js) con el motor de i18n.js.
// Hasta ahora i18n-extra.js existía pero nadie lo leía. Este script, que se ejecuta solo en «npm install» (Render) y en «node build-static.js»:
//   1) en i18n.js: añade esos idiomas a la lista, a los nombres del selector y a la tabla de traducciones (y pone dir="rtl" en árabe);
//   2) en index.html: carga i18n-extra.js justo antes de i18n.js.
// Es idempotente y NUNCA falla: cada cambio tiene que encajar exactamente UNA vez y el resultado se comprueba con el analizador de JavaScript;
// si algo no cuadra, no se escribe nada y el juego sigue con los 6 idiomas de siempre.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// [texto exacto de i18n.js, texto nuevo]
const EDITS = [
  [
    "const SUP = ['es', 'en', 'pt', 'fr', 'de', 'it'];",
    "const EX = (typeof window !== 'undefined' && window.I18N_EXTRA) || null;\n  const SUP = ['es', 'en', 'pt', 'fr', 'de', 'it'].concat(EX ? EX.order : []);",
  ],
  [
    "const NAMES = { es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano' };",
    "const NAMES = Object.assign({ es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano' }, EX ? EX.langs : {});",
  ],
  [
    "const IDX = { en: 0, pt: 1, fr: 2, de: 3, it: 4 };",
    "const IDX = { en: 0, pt: 1, fr: 2, de: 3, it: 4 };\n  if (EX) EX.order.forEach((c, i) => { IDX[c] = 5 + i; });",
  ],
  [
    // Mezcla las filas de i18n-extra.js con ROWS (misma frase en español = misma fila; si no existe, fila nueva)
    "// Textos con números: se traducen con plantilla ($1, $2…)",
    "if (EX && EX.rows) {\n" +
    "    const byEs = new Map(ROWS.map(rw => [rw[0], rw]));\n" +
    "    EX.rows.forEach(er => {\n" +
    "      let rw = byEs.get(er[0]);\n" +
    "      if (!rw) { rw = [er[0], null, null, null, null, null]; ROWS.push(rw); byEs.set(er[0], rw); }\n" +
    "      EX.order.forEach((c, i) => { rw[1 + IDX[c]] = er[1 + i]; });\n" +
    "    });\n" +
    "  }\n\n" +
    "  // Textos con números: se traducen con plantilla ($1, $2…)",
  ],
  [
    "// ---------- Motor ----------",
    "if (EX && EX.pats) EX.pats.forEach((tp, j) => { if (PATS[j]) EX.order.forEach((c, i) => { PATS[j][1][IDX[c]] = tp[i]; }); });\n\n  // ---------- Motor ----------",
  ],
  [
    // Una fila que solo existe en idiomas extra no debe romper los 5 idiomas de siempre
    "const t = row[1 + IDX[l]];",
    "const t = row[1 + IDX[l]]; if (t == null) return;",
  ],
  [
    "document.documentElement.lang = l;",
    "document.documentElement.lang = l;\n    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';",
  ],
];

const count = (s, sub) => s.split(sub).length - 1;

function patchI18n(src) {
  if (src.includes('I18N_EXTRA')) return src;   // ya conectado
  let out = src;
  for (const [from, to] of EDITS) {
    if (count(out, from) !== 1) return null;    // no encaja: no se toca nada
    out = out.replace(from, () => to);
  }
  new vm.Script(out);                           // lanza error si el JavaScript resultante no es válido
  return out;
}

function patchIndex(html) {
  if (html.includes('src="i18n-extra.js"')) return html;
  const tag = '<script src="i18n.js"></script>';
  if (count(html, tag) !== 1) return html;
  return html.replace(tag, () => '<script src="i18n-extra.js"></script>\n  ' + tag);
}

function run(dir) {
  dir = dir || __dirname;
  try {
    const f = path.join(dir, 'i18n.js');
    const extra = path.join(dir, 'i18n-extra.js');
    if (fs.existsSync(f) && fs.existsSync(extra)) {
      const before = fs.readFileSync(f, 'utf8');
      const after = patchI18n(before);
      if (after === null) console.warn('i18n-wire: i18n.js ha cambiado y no encaja, no se toca');
      else if (after !== before) { fs.writeFileSync(f, after); console.log('i18n-wire: idiomas extra conectados en i18n.js'); }
      else console.log('i18n-wire: i18n.js ya estaba conectado');
      if (after !== null) {   // solo se carga i18n-extra.js si i18n.js sabe leerlo
        const idx = path.join(dir, 'index.html');
        const h0 = fs.readFileSync(idx, 'utf8'), h1 = patchIndex(h0);
        if (h1 !== h0 && h1.includes('</html>')) { fs.writeFileSync(idx, h1); console.log('i18n-wire: index.html carga i18n-extra.js'); }
      }
    }
  } catch (e) {
    console.warn('i18n-wire: omitido (' + (e && e.message) + ')');
  }
}

module.exports = { run, patchI18n, patchIndex };
if (require.main === module) run(__dirname);
