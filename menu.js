'use strict';
// Menú y Extras con aspecto profesional: botones de cristal, iconos de línea, paneles tipo tarjeta.
// Todo el diseño vive en este archivo (estilos incluidos), así que no hay que tocar index.html ni style.css.
(function () {
  const CSS = `
body{--mp-bg:var(--card,#fff);--mp-bd:var(--line,rgba(0,0,0,.14));--mp-tile:rgba(8,127,91,.14);--mp-hover:rgba(0,0,0,.06);--mp-ink:var(--fg,#16211c);--mp-acc:var(--accent,#087f5b)}
@supports (background:color-mix(in srgb,red 50%,transparent)){
  body{--mp-bg:color-mix(in srgb,var(--card,#fff) 88%,transparent);--mp-bd:color-mix(in srgb,var(--fg,#16211c) 13%,transparent);--mp-tile:color-mix(in srgb,var(--accent,#087f5b) 14%,transparent);--mp-hover:color-mix(in srgb,var(--fg,#16211c) 7%,transparent)}
}

/* Posición con zona segura (móviles con muesca / app instalada) */
html body #map-controls{top:calc(10px + env(safe-area-inset-top,0px)) !important;right:calc(10px + env(safe-area-inset-right,0px)) !important;gap:8px !important}
html body #credit-pill{top:calc(10px + env(safe-area-inset-top,0px)) !important;left:calc(10px + env(safe-area-inset-left,0px)) !important}
html body #map-controls #top-row{gap:8px !important}

/* Barra superior: credito, en línea, Extras y Menú con el mismo estilo */
html body #credit-pill,
html body #map-controls #top-row #online-btn,
html body #map-controls #top-row #extras-btn,
html body #map-controls #top-row #menu-btn{
  height:44px !important;min-width:44px;box-sizing:border-box;
  padding:0 13px !important;margin:0 !important;gap:8px !important;
  border-radius:14px !important;
  background:var(--mp-bg) !important;
  border:1px solid var(--mp-bd) !important;
  box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 22px rgba(0,0,0,.16) !important;
  -webkit-backdrop-filter:blur(14px) saturate(1.5);backdrop-filter:blur(14px) saturate(1.5);
  color:var(--mp-ink) !important;
  font:700 14px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif !important;
  letter-spacing:.01em;white-space:nowrap;
  display:inline-flex !important;align-items:center;justify-content:center;flex-direction:row !important;
  cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:transform .12s ease,box-shadow .15s ease,background .15s ease;
}
html body #credit-pill{font-variant-numeric:tabular-nums}
html body #credit-pill small{font-size:12px !important;font-weight:600 !important;opacity:.85}
html body #credit-pill:active,
html body #map-controls #top-row #online-btn:active,
html body #map-controls #top-row #extras-btn:active,
html body #map-controls #top-row #menu-btn:active{transform:scale(.96)}
@media (hover:hover){
  html body #credit-pill:hover,
  html body #map-controls #top-row #online-btn:hover,
  html body #map-controls #top-row #extras-btn:hover,
  html body #map-controls #top-row #menu-btn:hover{transform:translateY(-1px);box-shadow:0 2px 4px rgba(0,0,0,.1),0 12px 26px rgba(0,0,0,.2) !important}
}
html body #credit-pill:focus-visible,
html body #map-controls button:focus-visible{outline:2px solid var(--mp-acc);outline-offset:2px}
html body #map-controls #top-row #menu-btn,
html body #map-controls #top-row #extras-btn{padding:0 14px 0 12px !important}
html body #map-controls #top-row #menu-btn[aria-expanded="true"],
html body #map-controls #top-row #extras-btn[aria-expanded="true"]{background:var(--mp-acc) !important;border-color:transparent !important;color:#fff !important}
.mp-svg{width:20px;height:20px;flex:none;display:block}

/* En línea: punto verde con latido */
html body #map-controls #top-row #online-btn{padding:0 12px !important;gap:7px !important}
html body #map-controls #top-row #online-btn i{position:relative !important;flex:none;width:9px !important;height:9px !important;border-radius:50%;background:#22c55e !important;box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:mp-pulse 2.2s ease-out infinite}
html body #map-controls #top-row #online-btn b{font-size:15px !important;font-weight:800 !important;font-variant-numeric:tabular-nums}
html body #map-controls #top-row #online-btn small{font-size:12px !important;font-weight:600 !important;opacity:.7;color:var(--mp-ink) !important}
@keyframes mp-pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}

/* Puntito rojo de novedades en Extras */
html body #extras-dot{top:6px !important;right:6px !important;width:10px !important;height:10px !important;border:2px solid var(--card,#fff) !important;box-sizing:content-box}

/* Paneles desplegables tipo tarjeta */
html body #map-controls #menu-items,
html body #map-controls #extras-items{
  width:244px;max-width:calc(100vw - 20px);box-sizing:border-box;
  padding:6px !important;gap:2px !important;align-items:stretch !important;
  border-radius:20px;
  background:var(--mp-bg);
  border:1px solid var(--mp-bd);
  box-shadow:0 2px 6px rgba(0,0,0,.1),0 18px 44px rgba(0,0,0,.28);
  -webkit-backdrop-filter:blur(18px) saturate(1.6);backdrop-filter:blur(18px) saturate(1.6);
  max-height:calc(100vh - 84px);max-height:calc(100dvh - 84px);
  overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;
}
html body #map-controls.open #menu-items,
html body #map-controls #extras-wrap.open #extras-items{animation:mp-in .17s cubic-bezier(.2,.85,.25,1) both;transform-origin:top right}
@keyframes mp-in{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}

/* Filas: icono en baldosa + etiqueta */
html body #map-controls #menu-items button:not(.hidden),
html body #map-controls #extras-items button:not(.hidden){
  width:100% !important;height:50px !important;min-width:0 !important;margin:0 !important;
  padding:0 12px 0 6px !important;gap:12px !important;
  border:0 !important;border-radius:14px !important;
  background:transparent !important;box-shadow:none !important;
  -webkit-backdrop-filter:none;backdrop-filter:none;
  display:flex !important;flex-direction:row !important;align-items:center;justify-content:flex-start !important;
  font-size:15px !important;font-weight:600;text-align:left;color:var(--mp-ink) !important;
  transition:background .12s ease;-webkit-tap-highlight-color:transparent;
}
html body #map-controls #menu-items button:not(.hidden):active,
html body #map-controls #extras-items button:not(.hidden):active{background:var(--mp-hover) !important}
@media (hover:hover){
  html body #map-controls #menu-items button:not(.hidden):hover,
  html body #map-controls #extras-items button:not(.hidden):hover{background:var(--mp-hover) !important}
}
html body #map-controls #menu-items button.hidden,
html body #map-controls #extras-items button.hidden{display:none !important}
html body #map-controls #menu-items button::after,
html body #map-controls #extras-items button::after{flex:1;font-size:15px !important;font-weight:600 !important;letter-spacing:.005em;text-align:left;color:var(--mp-ink)}
.mp-ic{position:relative;flex:none;width:38px;height:38px;border-radius:12px;background:var(--mp-tile);display:inline-flex;align-items:center;justify-content:center;font-size:20px;line-height:1}
.mp-ic img{width:24px;height:24px;border-radius:6px}
.mp-ic svg{width:20px;height:20px}
.mp-ic #daily-dot{top:-3px !important;right:-3px !important}

/* Velo suave detrás de los paneles */
#mp-scrim{position:fixed;inset:0;z-index:900;background:rgba(8,20,14,.30);opacity:0;pointer-events:none;transition:opacity .18s ease;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
#mp-scrim.on{opacity:1;pointer-events:auto}

/* Pantallas estrechas: el texto del Menú se oculta y queda el icono */
html body #credit-pill{max-width:calc(100vw - 330px) !important}
@media (max-width:420px){
  html body #credit-pill{max-width:calc(100vw - 258px) !important;padding:0 11px !important;font-size:14px !important}
  html body #map-controls #top-row #menu-btn .mp-l{display:none}
  html body #map-controls #top-row #menu-btn{padding:0 !important;width:44px}
}
@media (max-width:350px){
  html body #map-controls #top-row #extras-btn .mp-l{display:none}
  html body #map-controls #top-row #extras-btn{padding:0 !important;width:44px}
}
@media (prefers-reduced-motion:reduce){
  html body #map-controls #menu-items,html body #map-controls #extras-items,
  html body #map-controls #top-row #online-btn i{animation:none !important}
  #mp-scrim,html body #credit-pill,html body #map-controls button{transition:none !important}
}
`;
  const st = document.createElement('style');
  st.id = 'menu-pro-css';
  st.textContent = CSS;
  document.head.appendChild(st);
})();

// Iconos de línea (en lugar de emojis) para los botones de la barra
const MP_ICON = {
  menu: '<svg class="mp-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg class="mp-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  extras: '<svg class="mp-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5l1.7 4.8 4.8 1.7-4.8 1.7L10 16.5l-1.7-4.8L3.5 10l4.8-1.7z"/><path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>'
};

// Cada botón de los paneles: el icono (emoji, imagen o dibujo) va dentro de una baldosa .mp-ic.
// Si otro script cambia el icono más tarde (p. ej. 🔊/🔇), se vuelve a envolver solo.
(function () {
  const lists = ['menu-items', 'extras-items'].map(id => document.getElementById(id)).filter(Boolean);
  function tidy(b) {
    const loose = [...b.childNodes].filter(n => !(n.nodeType === 1 && n.classList.contains('mp-ic')) && !(n.nodeType === 3 && !n.textContent.trim()));
    if (!loose.length) return;
    let s = b.querySelector(':scope > .mp-ic');
    if (!s) { s = document.createElement('span'); s.className = 'mp-ic'; b.insertBefore(s, b.firstChild); }
    loose.forEach(n => s.appendChild(n));
  }
  lists.forEach(list => list.querySelectorAll('button').forEach(b => {
    tidy(b);
    const mo = new MutationObserver(() => { mo.disconnect(); tidy(b); mo.observe(b, { childList: true }); });
    mo.observe(b, { childList: true });
  }));
})();

// Botón "Menú": agrupa los botones de la derecha en un desplegable.
(function () {
  const box = document.getElementById('map-controls'), btn = document.getElementById('menu-btn'), list = document.getElementById('menu-items');
  if (!box || !btn || !list) return;
  const KEEP_OPEN = ['sound-btn', 'view-btn', 'base-btn'];   // interruptores: se puede tocar varios seguidos

  function paint(open) {
    btn.innerHTML = (open ? MP_ICON.close : MP_ICON.menu) + '<span class="mp-l">' + (open ? 'Cerrar' : 'Menú') + '</span>';
    btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  function set(open) {
    box.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    paint(open);
  }
  paint(false);
  btn.addEventListener('click', e => { e.stopPropagation(); set(!box.classList.contains('open')); });

  // Al elegir una opción, el menú se cierra (salvo los interruptores)
  list.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && !KEEP_OPEN.includes(b.id)) set(false);
  });
  // Tocar fuera o pulsar Escape también lo cierra
  document.addEventListener('pointerdown', e => { if (box.classList.contains('open') && !box.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) { set(false); btn.focus(); } });
})();

// Botón "Extras": desplegable arriba, junto a Menú, con los botones que antes estaban sueltos a la izquierda.
(function () {
  const wrap = document.getElementById('extras-wrap'), btn = document.getElementById('extras-btn'), list = document.getElementById('extras-items');
  const menuBtn = document.getElementById('menu-btn'), menuBox = document.getElementById('map-controls');
  if (!wrap || !btn || !list) return;
  // Icono de línea + texto; el puntito rojo (#extras-dot) se conserva tal cual
  const eDot = document.getElementById('extras-dot');
  btn.innerHTML = MP_ICON.extras + '<span class="mp-l">Extras</span>';
  if (eDot) btn.appendChild(eDot);
  btn.setAttribute('aria-label', 'Extras');
  function set(open) {
    wrap.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !wrap.classList.contains('open');
    if (open && menuBox && menuBox.classList.contains('open') && menuBtn) menuBtn.click();   // abrir Extras cierra Menú
    set(open);
  });
  if (menuBtn) menuBtn.addEventListener('click', () => set(false));                          // abrir Menú cierra Extras
  list.addEventListener('click', e => { const b = e.target.closest('button'); if (b) set(false); });
  document.addEventListener('pointerdown', e => { if (wrap.classList.contains('open') && !wrap.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('open')) { set(false); btn.focus(); } });
  // El puntito rojo del regalo diario también se ve en el botón Extras, aunque esté cerrado
  const dot = document.getElementById('daily-dot');
  if (dot && eDot) {
    const sync = () => eDot.classList.toggle('hidden', dot.classList.contains('hidden'));
    new MutationObserver(sync).observe(dot, { attributes: true, attributeFilter: ['class'] });
    sync();
  }
  // Velo detrás de cualquier panel abierto: oscurece un poco el mapa y un toque fuera lo cierra
  const scrim = document.createElement('div');
  scrim.id = 'mp-scrim';
  document.body.appendChild(scrim);
  const syncScrim = () => scrim.classList.toggle('on', wrap.classList.contains('open') || (!!menuBox && menuBox.classList.contains('open')));
  const obs = new MutationObserver(syncScrim);
  obs.observe(wrap, { attributes: true, attributeFilter: ['class'] });
  if (menuBox) obs.observe(menuBox, { attributes: true, attributeFilter: ['class'] });
})();

// Botón "Compartir" (dentro de Extras): comparte la pantalla. Captura lo que se ve ahora y lo manda por la hoja de compartir
// (en el ordenador, si no se puede compartir, se descarga la imagen). Si el navegador no permite capturar pantalla (casi todos los
// móviles), comparte el enlace del juego como antes.
(function () {
  const btn = document.getElementById('share-app-btn');
  if (!btn) return;
  const TITLE = 'Redecora El Mundo', TEXT = 'Reclama terrenos virtuales en el mapa del mundo y ponles tu nombre.';
  function note(text) {                                       // mismo aviso emergente (#toast) que usa el resto de la app
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(note.t); note.t = setTimeout(() => t.classList.remove('show'), 2500);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Pide la pantalla al navegador y se queda con un solo fotograma (PNG)
  async function grabScreen() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, preferCurrentTab: true });
    try {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.srcObject = stream;
      await v.play();
      await wait(450);                                        // deja que desaparezca el selector del navegador antes de capturar
      const cv = document.createElement('canvas');
      cv.width = v.videoWidth; cv.height = v.videoHeight;
      cv.getContext('2d').drawImage(v, 0, 0);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      if (!blob) throw new Error('canvas');
      return new File([blob], 'redecora-el-mundo.png', { type: 'image/png' });
    } finally { stream.getTracks().forEach(t => t.stop()); }
  }

  function download(file) {
    const a = document.createElement('a'), u = URL.createObjectURL(file);
    a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    note('📸 Captura guardada');
  }

  async function shareLink() {                                // alternativa cuando no hay captura de pantalla
    const url = location.origin + '/';
    try { if (navigator.share) { await navigator.share({ title: TITLE, text: TEXT, url }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }   // cerró la hoja de compartir: no hacemos nada
    try { await navigator.clipboard.writeText(url); note('🔗 Enlace copiado'); }
    catch (e) { window.prompt('Copia este enlace:', url); }
  }

  btn.addEventListener('click', async () => {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) { shareLink(); return; }
    let file;
    try { file = await grabScreen(); }
    catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return;   // canceló el selector de pantalla
      shareLink(); return;
    }
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: TITLE, text: TEXT + ' ' + location.origin + '/' });
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    download(file);
  });
})();
