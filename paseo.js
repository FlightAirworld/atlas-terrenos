'use strict';
// 🚶 PASEO ENTRE JUGADORES: cuando dos (o más) jugadores se encuentran en el mapa (jugadores.js) y uno invita al otro a «dar una vuelta por el barrio»,
// los muñecos se van paseando solos por el barrio (el círculo rojo de barrio.js) y entran a visitar una casa, el bar y la discoteca, todo automático.
//   · jugadores.js decide la invitación con una semilla común (los dos identificadores públicos + el minuto), así que los dos navegadores la ven a la vez
//     y, con esa misma semilla, eligen los MISMOS sitios y en el mismo orden. No se envía nada entre jugadores.
//   · Sitios: solo parcelas con dueño (que no sean tuyas) dentro del círculo rojo (o, sin GPS, a 500 m del centro del mapa). Se visita como mucho una casa,
//     un bar/restaurante y una discoteca/sala de baile (los que haya). Las escenas son las de siempre (visita.js y edificios.js), con sus límites diarios.
//   · Antes de empezar sale una tarjeta con cuenta atrás: puedes decir «No, gracias». Durante el paseo hay un botón ⏹ para terminar, y si arrastras el mapa se para.
//   · Como mucho un paseo cada 10 minutos.
// Usa globals de app.js: gl, drawn, boundsOf(), houseFor(), cfg, flashToast(); de barrio.js: window.barrio; de visita.js / edificios.js: visitaStart / edificioStart.
(function () {
  const COOLDOWN_MS = 10 * 60 * 1000, COUNTDOWN_S = 6, MAX_STOPS = 3, DEFAULT_R = 500;
  let running = null, lastEnd = 0;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const metros = (a, b, c, e) => {
    const R = 6371008.8, rad = Math.PI / 180, dLa = (c - a) * rad, dLo = (e - b) * rad;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const myName = () => { try { return String((window.atlasPlayerName && window.atlasPlayerName()) || '').trim(); } catch (e) { return ''; } };
  const earthOk = () => typeof gl !== 'undefined' && gl && !document.body.classList.contains('en-mundo') && !document.body.classList.contains('viajando') && !document.hidden;
  const sceneOpen = () => !!(document.getElementById('visita') || document.getElementById('edif'));

  // ---- Estilos ----
  const st = document.createElement('style');
  st.textContent = `
    #ps-card { position: fixed; left: 50%; top: 16%; transform: translateX(-50%); z-index: 2500; width: min(90vw, 340px); box-sizing: border-box; text-align: center; padding: 14px; border-radius: 18px;
      background: #fff; color: #16211c; box-shadow: 0 10px 30px rgba(0, 0, 0, .45); font-family: system-ui, sans-serif; }
    #ps-card b { display: block; font-size: 18px; margin-bottom: 6px; }
    #ps-card p { margin: 0 0 10px; font-size: 14px; line-height: 1.4; }
    #ps-card .ps-b { display: flex; gap: 8px; }
    #ps-card button { flex: 1; padding: 10px; border-radius: 10px; font-weight: 800; border: 0; cursor: pointer; background: #2f9e44; color: #fff; }
    #ps-card button.no { background: #e9ecef; color: #333; }
    #ps-stop { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 2400; padding: 10px 18px; border-radius: 999px; border: 0; font-weight: 800; background: #e03131; color: #fff; box-shadow: 0 4px 14px rgba(0, 0, 0, .4); cursor: pointer; }
    .ps-say { position: absolute; left: 50%; top: calc(50% - 71px - 10px); transform: translate(-50%, -100%) scale(.6); transform-origin: 50% 100%; opacity: 0; width: max-content; max-width: 220px; text-align: center; background: #fff; color: #16211c; border-radius: 16px; padding: 9px 13px; font: 800 15px/1.25 system-ui, sans-serif; box-shadow: 0 4px 14px rgba(0, 0, 0, .4); pointer-events: none; z-index: 40; transition: opacity .25s, transform .25s; }
    .ps-say::after { content: ''; position: absolute; left: 50%; top: 100%; margin-left: -7px; border: 7px solid transparent; border-top-color: #fff; }
    .ps-say.on { opacity: 1; transform: translate(-50%, -100%) scale(1); }
    @media (prefers-reduced-motion: reduce) { .ps-say { transition: none; } }`;
  document.head.appendChild(st);

  let sayEl = null, sayT = 0;
  function bubble(text, ms) {
    try {
      const host = gl.getContainer();
      if (!sayEl || !sayEl.isConnected) { sayEl = document.createElement('div'); sayEl.className = 'ps-say'; sayEl.setAttribute('data-notranslate', ''); host.appendChild(sayEl); }
      sayEl.textContent = text; void sayEl.offsetWidth; sayEl.classList.add('on');
      clearTimeout(sayT); sayT = setTimeout(() => sayEl && sayEl.classList.remove('on'), ms || 3500);
    } catch (e) { /* sin mapa */ }
  }
  const toast = t => { try { if (typeof flashToast === 'function') flashToast(t); } catch (e) { /* nada */ } };

  // ---- Qué hay en cada parcela ----
  function typeOf(p) {
    let h = ''; try { h = String(houseFor(p.id, p.house) || ''); } catch (e) { h = String(p.house || ''); }
    const k = h.split('/').pop().replace(/\.[a-z]+$/i, '').toLowerCase();
    if (/^(discoteca|sala-de-baile|sala-baile|salon-de-baile|salabaile)/.test(k)) return 'disco';
    if (/^(restaurante|cafe|cafeteria|bar|pizzeria)/.test(k)) return 'bar';
    if (/^(casa|pisos)/.test(k)) return 'casa';
    return null;
  }
  function circleArea() {
    const b = window.barrio, r = b && b.radius && b.radius(), pos = b && b.pos && b.pos();
    if (r && pos) return { lat: pos.lat, lng: pos.lng, r, rojo: true };
    const c = gl.getCenter(); return { lat: c.lat, lng: c.lng, r: DEFAULT_R, rojo: false };
  }
  function planRoute(seed) {
    const area = circleArea(), me = myName().toLowerCase(), byType = { casa: [], bar: [], disco: [] };
    for (const ex of (typeof drawn !== 'undefined' ? drawn.values() : [])) {
      const p = ex && ex.p;
      if (!p || !p.owner || (p.world && p.world !== 'tierra') || String(p.owner).toLowerCase() === me) continue;
      const t = typeOf(p); if (!t) continue;
      const [[s, w], [n, e]] = boundsOf(p.x, p.y), lat = (s + n) / 2, lng = (w + e) / 2;
      if (metros(area.lat, area.lng, lat, lng) > area.r) continue;
      byType[t].push({ p, lat, lng, t, score: hash(seed + '|' + p.id) });
    }
    // Un sitio de cada tipo (el de menor puntuación con la semilla: igual en los dos navegadores) y en un orden también al azar con la semilla
    const kinds = ['casa', 'bar', 'disco'].filter(k => byType[k].length).sort((a, b) => hash(seed + a) - hash(seed + b));
    return { area, stops: kinds.slice(0, MAX_STOPS).map(k => byType[k].sort((a, b) => a.score - b.score)[0]) };
  }

  // ---- Tarjeta de invitación con cuenta atrás ----
  function ask(name) {
    return new Promise(res => {
      const card = document.createElement('div'); card.id = 'ps-card'; card.setAttribute('role', 'dialog'); card.setAttribute('data-notranslate', '');
      let n = COUNTDOWN_S;
      const render = () => { card.innerHTML = `<b>🚶 Paseo con ${esc(name)}</b><p>Daréis una vuelta por el barrio y visitaréis una casa, el bar y la discoteca. Empieza en ${n} s.</p><div class="ps-b"><button type="button" class="no">No, gracias</button><button type="button" class="go">¡Vamos!</button></div>`; };
      const done = v => { clearInterval(t); card.remove(); res(v); };
      render(); document.body.appendChild(card);
      card.addEventListener('click', e => { const b = e.target.closest('button'); if (b) done(b.classList.contains('go')); });
      const t = setInterval(() => { n--; if (n <= 0) done(true); else render(); }, 1000);
    });
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- El paseo ----
  const WHERE = {
    casa: o => `🏠 Vamos a ver la casa de ${o}`,
    bar: o => `🍹 Vamos al bar a tomar algo (${o})`,
    disco: o => `💃 ¡A la discoteca de ${o}!`
  };
  async function walkTo(stop, token) {
    const here = gl.getCenter(), m = metros(here.lat, here.lng, stop.lat, stop.lng), ms = Math.max(2500, Math.min(9000, m * 25));
    gl.easeTo({ center: [stop.lng, stop.lat], zoom: Math.max(gl.getZoom(), 16.5), duration: ms, easing: x => x, essential: true });
    const t0 = Date.now();
    while (Date.now() - t0 < ms + 400) { if (token.stop) return false; await sleep(200); }
    return !token.stop;
  }
  async function visit(stop, token) {
    const p = { ...stop.p, mine: false, giftable: true };
    if (stop.t === 'casa') { if (!window.visitaStart) return; window.visitaStart(p); }
    else { if (!window.edificioStart) return; window.edificioStart(p, stop.t === 'bar' ? 'restaurante' : 'discoteca'); }
    let t0 = Date.now(); while (!sceneOpen() && Date.now() - t0 < 8000 && !token.stop) await sleep(250);   // si no abre (límite diario…), se sigue con el paseo
    if (!sceneOpen()) return;
    t0 = Date.now(); while (sceneOpen() && Date.now() - t0 < 5 * 60 * 1000 && !token.stop) await sleep(500);
    await sleep(600);
  }
  async function start(o) {
    o = o || {};
    if (running || !earthOk() || Date.now() - lastEnd < COOLDOWN_MS || sceneOpen()) return false;
    const token = running = { stop: false };
    try {
      if (!(await ask(o.with || 'un amigo'))) return false;
      if (!earthOk()) return false;
      const plan = planRoute(String(o.seed || 'paseo'));
      if (!plan.stops.length) { toast(plan.area.rojo ? '🚶 No hay casas, bar ni discoteca dentro de tu círculo rojo para pasear' : '🚶 No hay sitios cerca para pasear'); return false; }
      const stopBtn = document.createElement('button'); stopBtn.id = 'ps-stop'; stopBtn.type = 'button'; stopBtn.textContent = '⏹ Terminar paseo';
      stopBtn.onclick = () => { token.stop = true; try { gl.stop(); } catch (e) { /* nada */ } };
      document.body.appendChild(stopBtn);
      const onDrag = () => { token.stop = true; };
      gl.on('dragstart', onDrag);
      try {
        bubble('¡Vamos a dar una vuelta! 🚶', 2500); await sleep(2600);
        for (const stop of plan.stops) {
          if (token.stop) break;
          bubble(WHERE[stop.t](stop.p.owner), 3500);
          if (!(await walkTo(stop, token))) break;
          await visit(stop, token);
        }
        if (!token.stop) { bubble('¡Qué buen paseo! 👋', 4000); toast('🚶 Paseo terminado. ¡Hasta la próxima!'); }
      } finally { gl.off('dragstart', onDrag); stopBtn.remove(); }
      return true;
    } finally { running = null; lastEnd = Date.now(); }
  }

  window.paseo = { start, canStart: () => !(window.isAdminDoll && window.isAdminDoll()) && !running && earthOk() && Date.now() - lastEnd >= COOLDOWN_MS && !sceneOpen(), running: () => !!running };
})();
