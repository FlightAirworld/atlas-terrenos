'use strict';
// Arregla el SEO de index.html (informes de Seobility del 17-11-2026): título y descripción más cortos,
// un solo H1, sin etiquetas vacías, ALT en todas las imágenes, sin etiquetas <b>/<strong> repetidas,
// enlaces externos, botones para compartir en redes y textos ancla que no se repiten.
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

// Los contadores que antes eran <b> pasan a <span>: hay que darles el mismo aspecto que tenían
const CSS2 = [
  '#cover-online #cover-online-n{font-weight:900;font-variant-numeric:tabular-nums}',
  '#map-controls #top-row #online-btn #online-n{font-size:16px;font-weight:800}',
  '.seo-share{margin-top:8px;line-height:1.9}',
  '.seo-share a{display:inline-block;margin:0 6px}',
].join('\n');

// Enlaces para compartir en redes (sin scripts de terceros: son enlaces normales) y enlaces externos de créditos del mapa
const SITE = 'https://redecoraelmundo.com/';
const SHARE_TXT = 'Redecora El Mundo: juego de mapa del mundo gratis. Reclama un terreno virtual con tu nombre';
const U = encodeURIComponent(SITE);
const T = encodeURIComponent(SHARE_TXT);
const SHARE_HTML = [
  '<div id="seo-share" class="seo-share">',
  '<p>¿Te gusta el juego? Compártelo con tus amigos:</p>',
  `<a href="https://www.facebook.com/sharer/sharer.php?u=${U}" target="_blank" rel="noopener noreferrer">Compartir en Facebook</a>`,
  `<a href="https://twitter.com/intent/tweet?url=${U}&amp;text=${T}" target="_blank" rel="noopener noreferrer">Compartir en X</a>`,
  `<a href="https://wa.me/?text=${T}%20${U}" target="_blank" rel="noopener noreferrer">Compartir en WhatsApp</a>`,
  `<a href="https://t.me/share/url?url=${U}&amp;text=${T}" target="_blank" rel="noopener noreferrer">Compartir en Telegram</a>`,
  '<p>Mapa con datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> y tecnología de <a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre</a>.</p>',
  '</div>',
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

  // 7. Etiquetas <b>/<strong> repetidas (Seobility: «Algunas etiquetas se repiten, como por ejemplo: –»).
  // Los marcadores «–», «0%» y «0» los rellena el JavaScript y no son énfasis de verdad: pasan a <span> en negrita
  rep(/<b id="(cover-online-n|online-n|cl-pct)">([^<]*)<\/b>/g, (m, id, t) => `<span id="${id}" style="font-weight:bold">${t}</span>`);
  rep(/<strong id="credits-left">([^<]*)<\/strong>/, (m, t) => `<span id="credits-left" style="font-weight:bold">${t}</span>`);
  rep(/<b>G<\/b>/g, () => '<span style="font-weight:bold">G</span>');
  if (!h.includes('id="seo-patch-2"')) rep(/<\/head>/, () => `<style id="seo-patch-2">\n${CSS2}\n</style>\n</head>`);

  // 8. Textos ancla repetidos: el aviso legal del formulario de entrada repetía «Condiciones del Servicio» y «Política de Privacidad» del pie de página
  rep(/(href="\/terminos\.html" target="_blank" rel="noopener">)Condiciones del Servicio(<\/a>)/, (m, a, b) => `${a}condiciones de uso${b}`);
  rep(/(href="\/privacidad\.html" target="_blank" rel="noopener">)Política de Privacidad(<\/a>)/, (m, a, b) => `${a}política de datos personales${b}`);

  // 9. Redes sociales y enlaces externos: botones de compartir + créditos del mapa, dentro del pie de página visible
  if (!h.includes('id="seo-share"')) rep(/<\/footer>/, () => `${SHARE_HTML}\n</footer>`);
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
