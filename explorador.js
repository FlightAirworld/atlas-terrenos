'use strict';
// 🧭 EXPLORADOR (solo administrador): el muñeco recorre solo TODO el juego, uno tras otro y en bucle:
//   1. Todos los botones de Extras, Juegos y los de la columna del mapa (Cartas, Regalo diario, Trivia, Rasca y gana, Parejas, Bingo, Ranking, Chat…): los abre, deja unos
//      segundos la pantalla a la vista y la cierra. SOLO abre y mira: nunca pulsa comprar, jugar ni pagar dentro de los paneles.
//   2. Los monumentos del mapa (Monumentos.list()): vuela a cada uno y, mientras está allí, el muñeco camina por las calles y entra en las casas (jugador.js).
//   3. Todos los mundos (Luna, Marte, planetas, Prehistoria…): viaja en cohete a cada uno, se queda un rato y vuelve a la Tierra.
// FUTURAS MEJORAS: no hay que tocar nada para que entren.
//   · Un botón nuevo en Extras / Juegos / columna del mapa (con data-label) se descubre solo en cada vuelta. Para dejarlo fuera: data-explore="no".
//   · Un mundo nuevo en mundos.js (window.worldIds()) y un monumento nuevo (Monumentos.list()) también entran solos.
//   · Para cualquier otra cosa: Explorer.register({ id: 'mi-sitio', label: '🏗️ Mi sitio', go: async ctx => { abrirAlgo(); await ctx.wait(8000); cerrarAlgo(); } })
//     (ctx.wait(ms) espera y corta el recorrido si el jugador toca algo; ctx.say(texto) avisa en pantalla).
// Se activa solo en la cuenta de administrador (vista #admin del dispositivo o la cuenta Redecora63). Botón 🧭 abajo a la izquierda: activar / parar. Si tocas algo, se pausa y vuelve a los 45 s.
// Consola: Explorer.start(), Explorer.stop(), Explorer.stops() (lista lo que visitaría ahora mismo).
(function () {
  const KEY = 'explorerOn', START_IDLE = 15000, RESUME_IDLE = 45000, BTN_DWELL = 8000, MONU_DWELL = 12000, WORLD_DWELL = 14000;
  const INTERRUPT = { interrupted: true };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const custom = [];
  let on = false, running = null, lastUser = Date.now(), btn = null;

  // Quién es el administrador: el que abrió el juego con #admin en este dispositivo, o la cuenta Lodam
  function isAdmin() {
    try {
      if (localStorage.getItem('adminView') === '1' || location.hash === '#admin') return true;
      const n = String((window.atlasPlayerName && window.atlasPlayerName()) || '').trim().toLowerCase();
      return n === 'redecora63' || n === 'redecora 63';   // (cuando cambie el apodo a Lodam, añadir aquí 'lodam')
    } catch (e) { return false; }
  }
  const toast = t => { try { if (typeof flashToast === 'function') flashToast(t); } catch (e) { /* nada */ } };
  const earthReady = () => !document.hidden && !document.body.classList.contains('en-mundo') && !document.body.classList.contains('viajando')
    && !(window.worldBusy && window.worldBusy());
  const sceneOpen = () => !!(document.getElementById('visita') || document.getElementById('edif'));

  // Lo que toca el jugador de verdad (no los clics que hace el explorador, que no son «de confianza»)
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(n => document.addEventListener(n, e => { if (e.isTrusted) lastUser = Date.now(); }, { capture: true, passive: true }));

  // ---------- Qué visitar ----------
  const DENY_ID = new Set(['menu-btn', 'extras-btn', 'games-btn', 'online-btn', 'mundos-btn', 'account-btn', 'install-btn', 'coffee-btn', 'share-app-btn', 'push-btn', 'presence-btn', 'sounds-btn', 'lite-btn', 'search-btn']);
  const DENY_RE = /compr|pagar|paypal|caf[eé]|sesi[oó]n|borrar|elimin|salir|descargar|compartir|sonid|ligero|avis/i;
  function buttonStops() {
    const seen = new Set(), out = [];
    document.querySelectorAll('#map-controls button[data-label], #extras-items button, #games-items button').forEach(b => {
      const label = b.getAttribute('data-label') || b.getAttribute('title') || '';
      if (!b.id && !label) return;
      if (seen.has(b) || DENY_ID.has(b.id) || b.classList.contains('hidden') || b.disabled || b.getAttribute('data-explore') === 'no') return;
      if (b.getAttribute('data-explore') !== 'si' && DENY_RE.test(label)) return;
      seen.add(b);
      const icon = (b.textContent || '').trim().split(/\s/)[0] || '▪️';
      out.push({ id: 'btn:' + (b.id || label), label: icon + ' ' + (label || b.id), go: async ctx => { b.click(); await ctx.wait(BTN_DWELL); await closeAll(); } });
    });
    return out;
  }
  async function closeAll() {   // cierra los paneles que haya abiertos (.modal con su botón ×)
    for (let i = 0; i < 4; i++) {
      const open = [...document.querySelectorAll('.modal:not(.hidden) .close')];
      if (!open.length) break;
      open.forEach(c => { try { c.click(); } catch (e) { /* nada */ } });
      await sleep(400);
    }
    try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) { /* nada */ }
    await sleep(300);
  }
  async function monumentsStop(ctx) {
    const list = (window.Monumentos && window.Monumentos.list && window.Monumentos.list()) || [];
    for (const m of list) {
      if (!earthReady()) break;
      ctx.say('🏛️ ' + m.name + (m.place ? ' · ' + m.place : ''));
      window.Monumentos.goto(m.id);
      await ctx.wait(MONU_DWELL);
      await ctx.whileScene();
    }
  }
  async function worldsStop(ctx) {
    const ids = (window.worldIds ? window.worldIds() : []).filter(i => i !== 'tierra');
    const arrive = async id => {   // espera a que acabe el viaje (cohete incluido)
      const t0 = Date.now();
      while (window.worldBusy && window.worldBusy() && Date.now() - t0 < 180000) await ctx.wait(500);
      window.travelTo(id);
      await ctx.wait(1500);
      while (Date.now() - t0 < 360000 && ((window.worldBusy && window.worldBusy()) || (window.worldNow && window.worldNow() !== id))) await ctx.wait(500);
    };
    for (const id of ids) {
      const name = (window.worldInfo && window.worldInfo(id).name) || id;
      ctx.say('🚀 Viajando a ' + name);
      await arrive(id);
      await ctx.wait(WORLD_DWELL);
    }
    if (ids.length) { ctx.say('🌎 Volviendo a la Tierra'); await arrive('tierra'); await ctx.wait(3000); }
  }
  function buildStops() {   // se vuelve a calcular en cada vuelta: lo que se añada al juego entra solo
    const out = [...custom, ...buttonStops()];
    if (window.Monumentos && window.Monumentos.list) out.push({ id: 'monumentos', label: '🏛️ Monumentos del mapa', go: monumentsStop, earth: true });
    if (window.worldIds && window.travelTo) out.push({ id: 'mundos', label: '🌌 Mundos', go: worldsStop });
    return out;
  }

  // ---------- El recorrido ----------
  function makeCtx(started) {
    const check = () => { if (!on || lastUser > started) throw INTERRUPT; };
    return {
      say: toast,
      async wait(ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { check(); await sleep(250); } check(); },
      async whileScene() { const t0 = Date.now(); while (sceneOpen() && Date.now() - t0 < 180000) { check(); await sleep(500); } }   // si entró en una casa, espera a que salga
    };
  }
  async function waitReady() {
    for (;;) {
      if (!on) throw INTERRUPT;
      const need = running && running.paused ? RESUME_IDLE : START_IDLE;
      if (Date.now() - lastUser >= need && !document.hidden && !sceneOpen() && !document.querySelector('.modal:not(.hidden)')) { if (running) running.paused = false; return; }
      await sleep(500);
    }
  }
  async function tour(token) {
    while (on && running === token) {
      const stops = buildStops();
      for (const s of stops) {
        if (!on || running !== token) return;
        try {
          await waitReady();
          if (s.earth && !earthReady()) continue;
          const started = Date.now(), ctx = makeCtx(started);
          if (s.label) toast('🧭 ' + s.label);
          await s.go(ctx);
        } catch (e) {
          if (e === INTERRUPT) { token.paused = true; continue; }   // el jugador tocó algo: se pausa y sigue más tarde con la siguiente parada
          console.warn('[explorador]', s && s.id, e);
        }
      }
      try { await waitReady(); await sleep(15000); } catch (e) { /* parado */ }
    }
  }
  function start() {
    if (running || !isAdmin()) return false;
    on = true; try { localStorage.setItem(KEY, '1'); } catch (e) { /* nada */ }
    const token = running = { paused: false };
    paint();
    tour(token).finally(() => { if (running === token) running = null; paint(); });
    return true;
  }
  function stop() {
    on = false; try { localStorage.setItem(KEY, '0'); } catch (e) { /* nada */ }
    running = null; paint();
  }
  function paint() {
    if (!btn) return;
    btn.style.display = isAdmin() ? '' : 'none';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.style.opacity = on ? '1' : '.6';
    btn.title = on ? 'Explorador: recorriendo el juego (toca para parar)' : 'Explorador: parado (toca para que recorra todo el juego)';
  }
  function mount() {
    btn = document.createElement('button');
    btn.id = 'explorer-btn'; btn.type = 'button'; btn.textContent = '🧭'; btn.setAttribute('data-notranslate', '');
    btn.style.cssText = 'position:fixed;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:1200;width:44px;height:44px;border-radius:14px;border:1px solid rgba(0,0,0,.15);background:#fffffff0;font-size:22px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;display:none';
    btn.onclick = () => { if (on) { stop(); toast('🧭 Explorador parado'); } else if (start()) toast('🧭 Explorador en marcha'); };
    document.body.appendChild(btn);
    paint();
    // Por defecto, el administrador lo tiene en marcha (salvo que lo haya parado él)
    setInterval(() => { paint(); let off = false; try { off = localStorage.getItem(KEY) === '0'; } catch (e) { /* nada */ } if (!running && !off && isAdmin() && document.body.classList.contains('en-mundo') === false) start(); }, 5000);
  }
  window.Explorer = {
    start, stop, running: () => !!running,
    register(s) { if (s && s.id && typeof s.go === 'function') { const i = custom.findIndex(c => c.id === s.id); if (i >= 0) custom[i] = s; else custom.push(s); } },
    stops: () => buildStops().map(s => s.label || s.id)
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
