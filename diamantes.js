'use strict';
// 💚 DIAMANTES VERDES: cada día salen pocos, repartidos al azar por todo el mundo, y dan 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15 o 20 créditos.
// El servidor (minijuegos-server.js, rutas /api/mj/diamantes) sortea los sitios y los premios cada día, y paga.
// Aquí solo se dibuja: un diamante verde con un círculo rojo alrededor. Tu muñeco es el centro del mapa.
//   - Con el muñeco DENTRO del círculo rojo puedes tocar el diamante para cogerlo.
//   - Si lo tocas desde fuera del círculo sale «Camina hacia el diamante».
//   - Si el muñeco pasa por encima del diamante, lo coge solo.
//   - Al cogerlo desaparece, se suman los créditos, sale «¡Enhorabuena!» y un bocadillo sobre el muñeco con lo ganado.
// Usa globals de app.js: map (mapa con API de Leaflet, mapshim.js), authToken, credits, updateCreditUi(), openLogin(), api(), sfx().
(function () {
  if (typeof map === 'undefined' || !map || !map.gl) return;
  const items = document.getElementById('games-items');
  const word = n => (n === 1 ? 'crédito' : 'créditos');
  const ding = n => { try { if (window.sfx) window.sfx(n); } catch (e) { /* sin sonido */ } };
  function setCredits(c) { if (c != null && typeof credits !== 'undefined') { credits = c; if (typeof updateCreditUi === 'function') updateCreditUi(); } }

  let radius = 80;             // metros: el círculo rojo (lo manda el servidor)
  let list = [];               // diamantes de hoy: { id, lat, lng, taken, mine, mk, ring, tip }
  let day = '', timer = 0, claiming = false;

  const AUTO_PX = 26;          // «pasar por encima»: el centro del mapa a menos de 26 px del diamante en pantalla (y dentro del círculo)

  // ---- Estilos ----
  const st = document.createElement('style');
  st.textContent = `
    .dm { position: relative; width: 44px; height: 44px; }
    .dm-ring { position: absolute; left: 50%; top: 50%; border-radius: 50%; border: 3px solid #e03131; background: rgba(224, 49, 49, .13); box-sizing: border-box; pointer-events: none; transform: translate(-50%, -50%); animation: dmring 1.8s ease-in-out infinite; }
    .dm.in .dm-ring { background: rgba(224, 49, 49, .24); box-shadow: 0 0 0 3px rgba(224, 49, 49, .25), 0 0 14px rgba(224, 49, 49, .7); }
    .dm-gem { position: absolute; left: 0; top: 0; width: 44px; height: 44px; cursor: pointer; animation: dmbob 1.5s ease-in-out infinite; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .5)); }
    .dm-gem svg { width: 100%; height: 100%; display: block; }
    .dm.gone .dm-gem { animation: dmgone .45s ease-in forwards; }
    .dm.gone .dm-ring { opacity: 0; transition: opacity .3s; }
    .dm-tip { position: absolute; left: 50%; bottom: 52px; transform: translateX(-50%); width: max-content; max-width: 190px; text-align: center; background: #fff; color: #16211c; border-radius: 12px; padding: 7px 10px; font: 800 13px/1.2 system-ui, sans-serif; box-shadow: 0 3px 10px rgba(0, 0, 0, .35); pointer-events: none; z-index: 6; }
    .dm-tip::after { content: ''; position: absolute; left: 50%; top: 100%; margin-left: -6px; border: 6px solid transparent; border-top-color: #fff; }
    .dm-say { position: absolute; left: 50%; top: calc(50% - 71px - 10px); transform: translate(-50%, -100%) scale(.6); transform-origin: 50% 100%; opacity: 0; width: max-content; max-width: 220px; text-align: center; background: #fff; color: #16211c; border-radius: 16px; padding: 9px 13px; font: 800 15px/1.25 system-ui, sans-serif; box-shadow: 0 4px 14px rgba(0, 0, 0, .4); pointer-events: none; z-index: 40; transition: opacity .25s, transform .25s; }
    .dm-say::after { content: ''; position: absolute; left: 50%; top: 100%; margin-left: -7px; border: 7px solid transparent; border-top-color: #fff; }
    .dm-say.on { opacity: 1; transform: translate(-50%, -100%) scale(1); }
    #dm-win { position: fixed; left: 50%; top: 18%; transform: translate(-50%, -20px); z-index: 9999; width: min(88vw, 340px); box-sizing: border-box; text-align: center; padding: 16px 14px; border-radius: 18px;
      background: linear-gradient(#1faa59, #0c6a24); color: #fff; border: 3px solid #b7f5cd; box-shadow: 0 10px 30px rgba(0, 0, 0, .5); opacity: 0; pointer-events: none; transition: opacity .3s, transform .3s; font-family: system-ui, sans-serif; }
    #dm-win.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
    #dm-win b { display: block; font-size: 22px; margin-bottom: 4px; }
    #dm-win span { font-size: 17px; font-weight: 700; }
    #dm-win button { margin-top: 10px; padding: 8px 22px; border-radius: 10px; font-weight: 800; border: 0; background: #fff; color: #0c6a24; cursor: pointer; }
    @keyframes dmring { 50% { transform: translate(-50%, -50%) scale(1.04); } }
    @keyframes dmbob { 50% { transform: translateY(-4px) scale(1.06); } }
    @keyframes dmgone { to { transform: translateY(-26px) scale(0); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .dm-ring, .dm-gem { animation: none; } #dm-win, .dm-say { transition: none; } }
  `;
  document.head.appendChild(st);

  const GEM_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="28,12 72,12 96,40 50,92 4,40" fill="#27c25c" stroke="#0c6a24" stroke-width="5" stroke-linejoin="round"/>'
    + '<polygon points="28,12 50,40 4,40" fill="#6fe39a" opacity=".85"/><polygon points="72,12 96,40 50,40" fill="#1a9a49" opacity=".9"/><polygon points="28,12 72,12 50,40" fill="#a8f5c4"/>'
    + '<polygon points="4,40 50,40 50,92" fill="#17a04a" opacity=".85"/><polygon points="96,40 50,40 50,92" fill="#0e7a36" opacity=".9"/>'
    + '<path d="M30 20 38 14" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/></svg>';

  // ---- Utilidades ----
  const metros = (a, b, c, e) => {   // metros entre dos puntos (haversine)
    const R = 6371008.8, rad = Math.PI / 180, dLa = (c - a) * rad, dLo = (e - b) * rad;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const here = () => { const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; };   // el muñeco está en el centro del mapa
  const dist = d => { const p = here(); return metros(p.lat, p.lng, d.lat, d.lng); };
  const inside = d => dist(d) <= radius;
  const pxPerM = () => { try { return map.pxPerM(); } catch (e) { return 0; } };

  function toast(text) {
    if (window.giftToast) return window.giftToast(text, 6000);
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 5000);
  }

  // ---- Bocadillo sobre el muñeco y cartel de enhorabuena ----
  let sayEl = null, sayT = 0;
  function bubble(text, ms) {
    const host = map.getContainer();
    if (!sayEl || !sayEl.isConnected) { sayEl = document.createElement('div'); sayEl.className = 'dm-say'; sayEl.setAttribute('data-notranslate', ''); host.appendChild(sayEl); }
    sayEl.textContent = text;
    void sayEl.offsetWidth; sayEl.classList.add('on');
    clearTimeout(sayT); sayT = setTimeout(() => sayEl && sayEl.classList.remove('on'), ms || 5000);
  }
  let winEl = null, winT = 0;
  function enhorabuena(n) {
    if (!winEl) {
      winEl = document.createElement('div'); winEl.id = 'dm-win'; winEl.setAttribute('role', 'status'); winEl.setAttribute('data-notranslate', '');
      document.body.appendChild(winEl);
    }
    winEl.innerHTML = '<b>🎉 ¡Enhorabuena!</b><span>Has ganado ' + n + ' ' + word(n) + '</span><br><button type="button">OK</button>';
    winEl.querySelector('button').onclick = () => winEl.classList.remove('on');
    void winEl.offsetWidth; winEl.classList.add('on');
    clearTimeout(winT); winT = setTimeout(() => winEl && winEl.classList.remove('on'), 6000);
  }

  // ---- Dibujo de los diamantes ----
  function clearAll() { list.forEach(d => { clearTimeout(d.tipT); if (d.mk) { try { d.mk.remove(); } catch (e) { /* ya quitado */ } } }); list = []; }
  function sizeRing(d) {
    if (!d.ring) return;
    const k = pxPerM(), px = Math.max(34, Math.min(3000, 2 * radius * k));   // lejos del suelo el círculo se ve como un aro mínimo; el radio real sigue siendo el mismo
    d.ring.style.width = d.ring.style.height = px + 'px';
  }
  function showTip(d, text) {
    if (!d.el) return;
    let t = d.el.querySelector('.dm-tip');
    if (!t) { t = document.createElement('div'); t.className = 'dm-tip'; d.el.appendChild(t); }
    t.textContent = text; clearTimeout(d.tipT);
    d.tipT = setTimeout(() => t.remove(), 2800);
  }
  function draw(data) {
    clearAll();
    radius = data.radius || radius;
    list = data.diamonds.filter(x => !x.taken).map(x => ({ ...x }));
    list.forEach(d => {
      const el = document.createElement('div'); el.className = 'dm';
      el.innerHTML = '<div class="dm-ring"></div><div class="dm-gem" title="Diamante verde">' + GEM_SVG + '</div>';
      d.el = el; d.ring = el.querySelector('.dm-ring');
      d.mk = L.marker([d.lat, d.lng], { icon: L.divIcon({ className: 'dm-wrap', html: el, iconSize: [44, 44] }) }).addTo(map);
      sizeRing(d);
      el.querySelector('.dm-gem').addEventListener('click', ev => { ev.stopPropagation(); tap(d); });
    });
    tick();
  }
  async function load() {
    if (typeof authToken === 'undefined' || !authToken) return false;
    try {
      const j = await api('/api/mj/diamantes');
      day = j.day; draw(j); return true;
    } catch (e) { return false; }
  }

  // ---- Coger ----
  function tap(d) {
    if (claiming) return;
    if (typeof authToken === 'undefined' || !authToken) return openLogin('Entra con tu cuenta para coger diamantes 💚');
    if (!inside(d)) { showTip(d, '🚶 Camina hacia el diamante'); return; }
    claim(d);
  }
  async function claim(d) {
    if (claiming || d.gone) return;
    claiming = true;
    try {
      const p = here();
      const r = await api('/api/mj/diamantes/claim', { method: 'POST', body: { id: d.id, lat: p.lat, lng: p.lng } });
      d.gone = true; d.el.classList.add('gone');
      setTimeout(() => { try { d.mk.remove(); } catch (e) { /* ya quitado */ } }, 500);
      list = list.filter(x => x !== d);
      setCredits(r.credits); ding('claim');
      enhorabuena(r.prize);
      bubble('💚 ¡Has ganado ' + r.prize + ' ' + word(r.prize) + '!', 6000);
    } catch (e) {
      const m = (e && e.message) || 'No se pudo coger';
      if (/camina/i.test(m)) showTip(d, '🚶 Camina hacia el diamante'); else toast('💚 ' + m);
      load();
    } finally { claiming = false; }
  }

  // ---- Vigilar al muñeco: círculo encendido dentro y recogida automática al pasar por encima ----
  function tick() {
    if (!list.length) return;
    const k = pxPerM(), p = here();
    for (const d of list) {
      if (d.gone) continue;
      const m = metros(p.lat, p.lng, d.lat, d.lng), dentro = m <= radius;
      if (dentro !== !!d.dentro) { d.dentro = dentro; d.el.classList.toggle('in', dentro); }
      if (dentro && k > 0 && m * k <= AUTO_PX && !claiming) { claim(d); break; }   // el muñeco pasa por encima
    }
  }
  function onZoom() { list.forEach(sizeRing); tick(); }
  map.gl.on('move', tick);
  map.gl.on('zoom', onZoom);
  setInterval(tick, 400);

  // ---- Botón en la carpeta Juegos: lleva al diamante más cercano ----
  if (items) {
    const b = document.createElement('button');
    b.id = 'diamantes-btn'; b.type = 'button'; b.setAttribute('data-label', 'Diamantes'); b.title = 'Diamantes verdes: te llevo al más cercano'; b.setAttribute('aria-label', 'Diamantes verdes: te llevo al más cercano'); b.textContent = '💚';
    items.appendChild(b);
    b.addEventListener('click', async () => {
      if (typeof authToken === 'undefined' || !authToken) return openLogin('Entra con tu cuenta para buscar diamantes 💚');
      await load();
      if (!list.length) return toast('💚 Hoy ya no quedan diamantes. ¡Mañana salen otros!');
      const p = here(), d = list.slice().sort((a, c) => metros(p.lat, p.lng, a.lat, a.lng) - metros(p.lat, p.lng, c.lat, c.lng))[0];
      toast('💚 Quedan ' + list.length + ' ' + (list.length === 1 ? 'diamante' : 'diamantes') + ' hoy. Te llevo al más cercano: camina hasta el círculo rojo.');
      map.flyTo({ lat: d.lat, lng: d.lng }, 17);
    });
  }

  // ---- Arranque: carga al entrar con cuenta, se refresca solo y cambia de diamantes a medianoche ----
  let loaded = false;
  setInterval(async () => {
    if (document.hidden) return;
    if (!loaded) { loaded = await load(); return; }
    await load();   // cada 2 min: quita los que otros ya han cogido y estrena los de un día nuevo
  }, 120000);
  const first = setInterval(async () => { if (loaded) return clearInterval(first); loaded = await load(); if (loaded) clearInterval(first); }, 4000);
  document.addEventListener('account:linked', () => { load().then(ok => { loaded = ok; }); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && loaded) load(); });
})();
