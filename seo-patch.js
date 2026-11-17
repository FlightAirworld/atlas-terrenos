'use strict';
// Arregla el SEO de index.html (informe de Seobility del 17-11-2026): título y descripción más cortos,
// un solo H1, sin etiquetas vacías y con ALT en todas las imágenes.
// Se ejecuta solo: «npm install» (script postinstall, en el servidor de Render) y «node build-static.js» (sitio estático).
// Es idempotente (se puede ejecutar mil veces) y NUNCA falla: si algo no encaja, deja el archivo como está y el juego arranca igual.
const fs = require('node:fs');
const path = require('node:path');

const TITLE = 'Juego de mapa del mundo gratis | Redecora El Mundo';
const DESC = 'Juego de mapa gratis en español: reclama un terreno virtual con tu nombre, decora tu casa y consigue terrenos en la Luna y Marte.';
const H1 = 'Redecora El Mundo: juego de mapa del mundo gratis';

const ALT = {
  'casa-1-s.webp': 'Casa en una parcela virtual',
  'rascacielos-s.webp': 'Rascacielos en el mapa',
  'parque-atracciones-s.webp': 'Parque de atracciones',
  'estadio-s.webp': 'Estadio de fútbol',
  'jardin-s.webp': 'Jardín',
  'casa-2-s.webp': 'Casa con jardín',
  'helipuerto-s.webp': 'Helipuerto',
  'bosque-s.webp': 'Bosque',
  'pisos-s.webp': 'Edificio de pisos',
  'puerto-s.webp': 'Puerto',
  'hospital-s.webp': 'Hospital',
  'mar-peces-s.webp': 'Mar con peces',
  'iglesia-s.webp': 'Iglesia',
  'ayuntamiento-s.webp': 'Ayuntamiento',
  'casa-aerea-s.webp': 'Vista aérea de una casa',
  'claro-bosque-s.webp': 'Claro en el bosque',
};

// El H1 real va oculto a la vista (como el texto para buscadores que ya tiene la página) y el logo de colores pasa a ser decorativo
const CSS = [
  '.seo-h1{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0}',
  '#cover h1.seo-h1{margin:-1px}',
  '#cover .cover-h1{margin:14px 0 8px;font-size:clamp(34px,11vw,46px);line-height:1.05;font-weight:700;text-shadow:0 3px 16px rgba(0,0,0,.7)}',
  '#boot .boot-h1{margin:0 0 6px;font-size:30px;line-height:1.1;font-weight:700;text-shadow:0 2px 12px rgba(0,0,0,.6)}',
].join('\n');

function patch(html) {
  let h = html;
  const rep = (re, to) => { h = h.replace(re, to); };

  // 1. Título corto (antes medía 3329 px) y con las palabras que sí salen en el texto de la página
  rep(/<title>[\s\S]*?<\/title>/, () => `<title>${TITLE}</title>`);
  // 2. Meta descripción más corta (antes 1000 px)
  rep(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => a + DESC + b);
  // 3. Fuera la metaetiqueta keywords: Google la ignora y una lista tan larga parece spam
  rep(/[ \t]*<meta name="keywords" content="[^"]*">[ \t]*\r?\n?/, () => '');

  // 4. Un solo H1: la pantalla de arranque (#boot) usaba otro y el de la portada solo decía «REDECORA El Mundo»
  rep(/<h1>Redecora El Mundo<\/h1>/, () => '<div class="boot-h1">Redecora El Mundo</div>');
  rep(/<h1 id="cover-title" aria-label="Redecora El Mundo">([\s\S]*?)<\/h1>/,
    (m, inner) => `<h1 id="cover-title" class="seo-h1">${H1}</h1><div class="cover-h1" aria-hidden="true">${inner}</div>`);
  if (!h.includes('id="seo-patch"')) rep(/<\/head>/, () => `<style id="seo-patch">\n${CSS}\n</style>\n</head>`);

  // 5. Etiquetas vacías (las rellena el JavaScript): pasan a <span>/<div> con el mismo aspecto
  rep(/<strong id="(p-owner|my-code|login-email-shown)"><\/strong>/g, (m, id) => `<span id="${id}" style="font-weight:bold"></span>`);
  rep(/<h3 id="rank-cities-title" style="margin:10px 0 4px"><\/h3>/,
    () => '<div id="rank-cities-title" role="heading" aria-level="3" style="margin:10px 0 4px;font-size:1.17em;font-weight:700"></div>');

  // 6. ALT descriptivo en todas las imágenes
  rep(/<img src="images\/([a-z0-9-]+\.webp)" alt=""/g, (m, f) => (ALT[f] ? `<img src="images/${f}" alt="${ALT[f]}"` : m));
  rep(/(<img class="cover-hero" src="data:[^"]*" )alt=""/, (m, a) => a + 'alt="Logotipo de Redecora El Mundo"');
  rep(/(<img id="boot-img" src="images\/splash\.jpg" )alt=""/, (m, a) => a + 'alt="Pantalla de inicio de Redecora El Mundo"');
  rep(/(<img src="\/images\/icon-192\.png" )alt=""/g, (m, a) => a + 'alt="Icono de Redecora El Mundo"');
  return h;
}

function run(file) {
  try {
    const before = fs.readFileSync(file, 'utf8');
    const after = patch(before);
    if (after === before) { console.log('seo-patch: index.html ya estaba corregido'); return; }
    // Salvaguarda: si algo salió raro, no se escribe nada
    if (!/<title>[^<]+<\/title>/.test(after) || !after.includes('</html>') || after.length < before.length * 0.9) {
      console.warn('seo-patch: resultado inesperado, no se toca index.html');
      return;
    }
    fs.writeFileSync(file, after);
    console.log(`seo-patch: index.html corregido (${before.length} → ${after.length} caracteres)`);
  } catch (e) {
    console.warn('seo-patch: omitido (' + (e && e.message) + ')');
  }
}

module.exports = { patch, run };
if (require.main === module) run(path.join(__dirname, 'index.html'));
