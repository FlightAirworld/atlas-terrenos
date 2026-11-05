'use strict';
// Botón "Menú": agrupa los botones de la derecha en un desplegable.
(function () {
  const box = document.getElementById('map-controls'), btn = document.getElementById('menu-btn'), list = document.getElementById('menu-items');
  if (!box || !btn || !list) return;
  const KEEP_OPEN = ['sound-btn', 'view-btn', 'base-btn'];   // interruptores: se puede tocar varios seguidos

  function set(open) {
    box.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? '✕ Cerrar' : '☰ Menú';
  }
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
  const dot = document.getElementById('daily-dot'), eDot = document.getElementById('extras-dot');
  if (dot && eDot) {
    const sync = () => eDot.classList.toggle('hidden', dot.classList.contains('hidden'));
    new MutationObserver(sync).observe(dot, { attributes: true, attributeFilter: ['class'] });
    sync();
  }
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
