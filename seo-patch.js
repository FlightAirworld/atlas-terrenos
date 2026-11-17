'use strict';
// Arregla el SEO de index.html (informes de Seobility del 17-11-2026): título y descripción más cortos,
// un solo H1, sin etiquetas vacías, ALT en todas las imágenes, sin etiquetas <b>/<strong> repetidas,
// enlaces externos, botones para compartir en redes y textos ancla que no se repiten.
// También: pie legal (Privacidad, Condiciones, Prensa) oculto a la vista pero presente en el HTML para los buscadores,
// y enlace a la página de Prensa en el Menú, el pie, la portada y el texto para buscadores, traducido a todos los idiomas del juego,
// y enlace a Prensa en el pie de las páginas por idioma (/en, /fr, /de, /it, /pt, /ja, /zh).
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
// Los botones de compartir van ocultos a la vista (igual que el H1): el mapa a pantalla completa los tapaba y se veían cortados, pero siguen en el HTML para los buscadores
const CSS2 = [
  '#cover-online #cover-online-n{font-weight:900;font-variant-numeric:tabular-nums}',
  '#map-controls #top-row #online-btn #online-n{font-size:16px;font-weight:800}',
  '.seo-share{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0}',
  '.seo-share a{display:inline-block;margin:0 6px}',
].join('\n');

// Pie legal: ya no se ve encima del mapa (a petición del dueño). Se queda oculto a la vista, igual que el H1 y los botones de compartir,
// pero sigue en el HTML para los buscadores. Los enlaces a Privacidad y Condiciones siguen en el aviso del formulario de entrada.
const CSS3 = [
  '.site-footer{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0}',
].join('\n');

// Botón «Prensa» del Menú (se abre en una pestaña nueva para no sacar al jugador de la partida)
const PRESS_BTN = '<button id="press-btn" data-label="Prensa" type="button" title="Prensa y medios" aria-label="Prensa y medios" onclick="window.open(\'/prensa.html\',\'_blank\',\'noopener\')">📰</button>';

// Traducción de los textos de Prensa a los idiomas del juego (es, en, pt, fr, de, it) y a los que están preparados (ar, zh, ru, ja, ko, tr, hi, id).
// i18n.js solo traduce lo que tiene en su tabla, así que este pequeño script traduce los enlaces y el botón de Prensa según <html lang>, y se actualiza al cambiar de idioma.
const PRESS_I18N = `<script id="prensa-i18n">
(function () {
  var D = {
    'Prensa': { en: 'Press', pt: 'Imprensa', fr: 'Presse', de: 'Presse', it: 'Stampa', ar: 'الصحافة', zh: '媒体资料', ru: 'Пресса', ja: 'プレス', ko: '보도자료', tr: 'Basın', hi: 'प्रेस', id: 'Pers' },
    'Prensa y medios': { en: 'Press and media', pt: 'Imprensa e mídia', fr: 'Presse et médias', de: 'Presse und Medien', it: 'Stampa e media', ar: 'الصحافة والإعلام', zh: '新闻与媒体', ru: 'Пресса и СМИ', ja: 'プレス・メディア', ko: '언론 및 미디어', tr: 'Basın ve medya', hi: 'प्रेस और मीडिया', id: 'Pers dan media' },
    'Sala de prensa': { en: 'Press room', pt: 'Sala de imprensa', fr: 'Salle de presse', de: 'Pressebereich', it: 'Sala stampa', ar: 'غرفة الصحافة', zh: '新闻室', ru: 'Для прессы', ja: 'プレスルーム', ko: '프레스룸', tr: 'Basın odası', hi: 'प्रेस कक्ष', id: 'Ruang pers' },
    'Dossier de prensa': { en: 'Press kit', pt: 'Press kit', fr: 'Dossier de presse', de: 'Pressemappe', it: 'Cartella stampa', ar: 'الملف الصحفي', zh: '新闻资料包', ru: 'Пресс-кит', ja: 'プレスキット', ko: '프레스 킷', tr: 'Basın kiti', hi: 'प्रेस किट', id: 'Press kit' }
  };
  function tr(es) {
    var l = (document.documentElement.lang || 'es').slice(0, 2).toLowerCase();
    if (l === 'es') return es;
    var d = D[es];
    return d ? (d[l] || d.en || es) : es;
  }
  function apply() {
    var b = document.getElementById('press-btn');
    if (b) {
      b.setAttribute('data-label', tr('Prensa'));
      b.setAttribute('title', tr('Prensa y medios'));
      b.setAttribute('aria-label', tr('Prensa y medios'));
    }
    var a = document.querySelectorAll('a[href="/prensa.html"]');
    for (var i = 0; i < a.length; i++) {
      var el = a[i];
      if (!el.hasAttribute('data-es')) el.setAttribute('data-es', el.textContent.trim());
      var t = tr(el.getAttribute('data-es'));
      if (el.textContent !== t) el.textContent = t;
    }
  }
  apply();
  try { new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] }); } catch (e) {}
})();
</script>`;

// Páginas por idioma (carpetas /en, /fr…): el pie lleva «Prensa» en su idioma (la página de prensa está en español, por eso hreflang="es", igual que Mundos y Privacidad)
const PRESS_LANG = { en: 'Press', fr: 'Presse', de: 'Presse', it: 'Stampa', pt: 'Imprensa', ja: 'プレス', zh: '媒体资料' };

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

  // 9. Redes sociales y enlaces externos: botones de compartir + créditos del mapa, dentro del pie de página (ocultos a la vista, ver CSS2)
  if (!h.includes('id="seo-share"')) rep(/<\/footer>/, () => `${SHARE_HTML}\n</footer>`);

  // 10. Pie legal oculto a la vista + enlace a Prensa.
  // 10a. El pie pasa a la clase .site-footer, que ya no se ve sobre el mapa (ver CSS3) pero sigue en el HTML.
  rep(/<footer style="text-align:center; font-size:13px; padding:12px;">/, () => '<footer class="site-footer">');
  if (!h.includes('id="seo-patch-3"')) rep(/<\/head>/, () => `<style id="seo-patch-3">\n${CSS3}\n</style>\n</head>`);
  // 10b. «Prensa» en el pie de página (enlace normal, lo ven los buscadores)
  if (!h.includes('href="/prensa.html">Prensa</a>')) rep(/(<a href="\/terminos\.html">Condiciones del Servicio<\/a>)/, (m, a) => `${a} ·\n  <a href="/prensa.html">Prensa</a>`);
  // 10c. Botón «Prensa» en el Menú (justo antes de «Invítame a un café» / «Cuenta»)
  if (!h.includes('id="press-btn"')) rep(/([ \t]*)(<button id="coffee-btn")/, (m, sp, b) => `${sp}${PRESS_BTN}\n${sp}${b}`);
  // 10d. Texto para buscadores («Guías y mundos»), portada y bloque <noscript>: cada enlace con un texto distinto para no repetir anclas
  if (!h.includes('>Dossier de prensa</a>')) rep(/(<a href="\/mundo-pluton\.html">Plutón<\/a>)(<\/p>)/, (m, a, b) => `${a}<a href="/prensa.html">Dossier de prensa</a>${b}`);
  if (!h.includes('>Sala de prensa</a>')) rep(/(<a href="\/terminos\.html">Condiciones<\/a>)(<\/div>)/, (m, a, b) => `${a} · <a href="/prensa.html">Sala de prensa</a>${b}`);
  if (!h.includes('>Prensa y medios</a>')) rep(/(<a href="\/mundos\.html">Mundos: Luna, Marte y planetas<\/a>)(<\/p>)/, (m, a, b) => `${a} · <a href="/prensa.html">Prensa y medios</a>${b}`);
  // 10e. Traducción de todo lo anterior al idioma elegido (se pone justo antes de cerrar el <body>)
  if (!h.includes('id="prensa-i18n"')) rep(/<\/body>/, () => `${PRESS_I18N}\n</body>`);
  return h;
}

// Páginas por idioma: añade «Prensa» (en su idioma) al pie, detrás de «Condiciones»
function patchLang(html, label) {
  if (html.includes('href="/prensa.html"')) return html;
  return html.replace(/(<a href="\/terminos\.html" hreflang="es">[^<]*<\/a>)(\s*<\/footer>)/, (m, a, b) => `${a} · <a href="/prensa.html" hreflang="es">${label}</a>${b}`);
}

function runLangs(dir) {
  Object.keys(PRESS_LANG).forEach(code => {
    try {
      const f = path.join(dir, code, 'index.html');
      if (!fs.existsSync(f)) return;
      const before = fs.readFileSync(f, 'utf8');
      const after = patchLang(before, PRESS_LANG[code]);
      if (after === before || !after.includes('</html>') || after.length < before.length) return;
      fs.writeFileSync(f, after);
      console.log(`seo-patch: ${code}/index.html con enlace a Prensa`);
    } catch (e) {
      console.warn(`seo-patch: ${code}/index.html omitido (` + (e && e.message) + ')');
    }
  });
}

function run(file) {
  try { runLangs(path.dirname(file)); } catch (e) { /* las páginas por idioma son opcionales */ }
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

module.exports = { patch, patchLang, run };
if (require.main === module) run(path.join(__dirname, 'index.html'));
