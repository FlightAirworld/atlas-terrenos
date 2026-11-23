'use strict';
// NIVEL SOBRE LA CABEZA: cada muñeco del mapa (el tuyo y el de los demás jugadores) lleva un número de 0 a 100 encima de la cabeza.
// Sube con los terrenos, las mejoras, los juegos y lo social (el cálculo lo hace el servidor: GET /api/niveles?n=apodo&n=apodo).
// Sin sesión (visitante) = nivel 0. Colores por tramos: 0-19 verde, 20-39 azul, 40-59 morado, 60-79 naranja, 80-99 rojo, 100 dorado.
// No toca jugador.js ni jugadores.js: mira cada 1,5 s los muñecos que hay en pantalla (.pw.ot = otros jugadores, playerWalker.el() = el tuyo).
(function () {
  if (window.__nivelJugadores) return;
  window.__nivelJugadores = true;
  const API = window.API_BASE || '';
  const TTL = 60000, EVERY = 1500, MIN_GAP = 2000, MAX_BATCH = 40;
  const cache = new Map();   // apodo en minúsculas → { lv, at }
  let busy = false, lastFetch = 0;

  const st = document.createElement('style');
  st.textContent = `
    .pw .lv { position: absolute; left: 50%; top: -16px; transform: translateX(-50%); min-width: 20px; height: 17px; padding: 0 5px; box-sizing: border-box; border-radius: 9px;
      font: 800 11px/14px system-ui, sans-serif; text-align: center; white-space: nowrap; color: #fff; background: #2a9d8f; border: 1.5px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,.35); pointer-events: none; z-index: 4; }
    .pw .lv.t2 { background: #4361ee; }
    .pw .lv.t3 { background: #8338ec; }
    .pw .lv.t4 { background: #ff9f1c; color: #2b1b00; }
    .pw .lv.t5 { background: #e63946; }
    .pw .lv.gold { background: linear-gradient(#ffd54a, #f5a300); color: #4a3000; border-color: #fff6cf; }
    .pw.hasLv .say { margin-bottom: 26px; }   /* el globo de charla se sube para no tapar el nivel */`;
  document.head.appendChild(st);

  const tier = lv => lv >= 100 ? 'gold' : lv >= 80 ? 't5' : lv >= 60 ? 't4' : lv >= 40 ? 't3' : lv >= 20 ? 't2' : 't1';
  const clamp = v => Math.max(0, Math.min(100, Math.floor(Number(v) || 0)));

  // Apodo del dueño del muñeco ('' = visitante sin cuenta)
  function nickOf(el) {
    const nm = el.querySelector('.nm');
    if (nm) { const t = (nm.textContent || '').trim(); return /^Visitante\b/i.test(t) ? '' : t; }   // muñeco de otro jugador: su apodo está bajo los pies
    try { return String((window.atlasPlayerName && window.atlasPlayerName()) || '').replace(/\s+/g, ' ').trim(); } catch (e) { return ''; }   // el tuyo
  }

  function targets() {
    const out = Array.from(document.querySelectorAll('.pw.ot'));
    try {
      const me = window.playerWalker && window.playerWalker.el && window.playerWalker.el();
      if (me && me.isConnected && !out.includes(me)) out.push(me);
    } catch (e) { /* sin muñeco propio */ }
    return out;
  }

  function paint(b, key) {
    const c = key ? cache.get(key) : null;
    const lv = key ? (c ? c.lv : null) : 0;
    const txt = lv === null ? '…' : String(lv);
    if (b.textContent !== txt) b.textContent = txt;
    const cls = 'lv ' + (lv === null ? 't1' : tier(lv));
    if (b.className !== cls) b.className = cls;
    const ttl = lv === null ? '' : 'Nivel ' + lv;
    if (b.title !== ttl) b.title = ttl;
  }

  async function load(keys) {
    if (busy || Date.now() - lastFetch < MIN_GAP) return;
    busy = true; lastFetch = Date.now();
    const batch = keys.slice(0, MAX_BATCH);
    try {
      const r = await fetch(API + '/api/niveles?' + batch.map(k => 'n=' + encodeURIComponent(k)).join('&'), { cache: 'no-store' });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json(), at = Date.now();
      batch.forEach(k => cache.set(k, { lv: clamp(j && j.levels && j.levels[k]), at }));
    } catch (e) {
      const at = Date.now() - TTL + 10000;   // sin conexión: lo vuelve a intentar en ~10 s (si ya tenía un valor, lo conserva)
      batch.forEach(k => { const c = cache.get(k); cache.set(k, { lv: c ? c.lv : 0, at }); });
    } finally { busy = false; }
  }

  function tick() {
    if (document.hidden) return;
    const els = targets();
    if (!els.length) return;
    const now = Date.now(), need = new Set();
    for (const el of els) {
      const key = nickOf(el).toLowerCase();
      let b = Array.from(el.children).find(c => c.classList && c.classList.contains('lv'));
      if (!b) { b = document.createElement('div'); b.className = 'lv t1'; b.textContent = '…'; el.appendChild(b); el.classList.add('hasLv'); }
      paint(b, key);
      if (key) { const c = cache.get(key); if (!c || now - c.at > TTL) need.add(key); }
    }
    if (need.size) load(Array.from(need));
  }

  window.nivelJugadores = { get: nick => { const c = cache.get(String(nick || '').trim().toLowerCase()); return c ? c.lv : null; } };
  setInterval(tick, EVERY);
  setTimeout(tick, 1500);
})();
