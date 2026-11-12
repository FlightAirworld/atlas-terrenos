'use strict';
// PUNTOS ROJOS PARPADEANTES para lo que aún no tenían: Trivia, Rasca y gana, Parejas, Racha diaria, Adivina el lugar,
// ¿Más o menos?, Cofres del mapa, Duelos (reto recibido) y Mis terrenos (créditos listos para recoger).
// Regalo diario, Ruleta, Campeonato, Cartas, Retos, Premios del mes y Población ya tienen el suyo en su propio archivo.
// Los juegos que cuestan créditos por tirada (tragaperras, plinko, cara o cruz, ruleta de números, minas, gemas) no llevan punto: siempre están disponibles.
// Cada punto es un <span id="…-dot" class="hidden"> dentro del botón: así lo recogen menu.js (que lo pinta y lo hace parpadear dentro de la baldosa del icono),
// juegos.js (punto en la carpeta 🎮) y el punto de «Extras», que se enciende solo si cualquier opción del desplegable tiene el suyo.
// Usa globals de app.js: authToken, api(), prodState, liveTotal().
(function () {
  const $ = id => document.getElementById(id);

  // Por si el botón queda fuera de la baldosa .mp-ic (menu.js, p. ej.), el punto se ve igual
  const st = document.createElement('style');
  st.textContent = `
    .pt-dot { position: absolute; top: 1px; right: 1px; width: 13px; height: 13px; border-radius: 50%; background: #e63946; border: 2px solid #fff; box-sizing: border-box; pointer-events: none; animation: mpblink 1s ease-in-out infinite; }
    .pt-dot.hidden { display: none; }
    @keyframes mpblink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .2; transform: scale(1.3); } }
    @media (prefers-reduced-motion: reduce) { .pt-dot { animation: none; } }
  `;
  document.head.appendChild(st);

  const logged = () => typeof authToken !== 'undefined' && !!authToken;
  const get = path => api(path, { method: 'GET' });

  // [id del botón, ruta de estado, función que decide si hay algo disponible]
  const ITEMS = [
    ['trivia-btn', '/api/trivia', s => !!(s.on && (s.active || s.gamesLeft > 0))],
    ['rasca-btn', '/api/rasca', s => !!(s.on && !s.played)],
    ['parejas-btn', '/api/parejas', s => !!(s.on && (s.active || s.gamesLeft > 0))],
    ['racha-btn', '/api/mj/racha', s => !s.claimedToday],
    ['adivina-btn', '/api/mj/adivina', s => !s.done],
    ['mm-btn', '/api/mj/mm', s => !s.started || !s.over],
    ['cofres-btn', '/api/mj/cofres', s => {
      const free = (s.chests || []).some(c => !c.taken), mine = (s.chests || []).filter(c => c.mine).length;
      return free && mine < (s.max || 2);
    }],
    ['duelos-btn', '/api/mj/duelos', s => (s.incoming || []).length > 0]
  ].map(([id, path, ok]) => ({ id, path, ok, dotId: id.replace(/-btn$/, '') + '-dot', busy: false }));

  const dotFor = it => {
    let d = $(it.dotId); if (d) return d;
    const b = $(it.id); if (!b) return null;
    d = document.createElement('span'); d.id = it.dotId; d.className = 'pt-dot hidden'; d.setAttribute('aria-hidden', 'true');
    (b.querySelector(':scope > .mp-ic') || b).appendChild(d);
    return d;
  };
  function paint(it, on) {
    const d = dotFor(it); if (!d) return;
    d.classList.toggle('hidden', !on);
    if (window.syncExtrasDot) window.syncExtrasDot();
  }
  async function check(it) {
    if (it.busy) return; it.busy = true;
    try {
      if (!logged()) return paint(it, false);
      const s = await get(it.path);
      paint(it, !!it.ok(s));
    } catch (e) { /* sin conexión o juego apagado: se deja como está */ }
    finally { it.busy = false; }
  }

  // Mis terrenos: hay al menos 1 crédito entero listo para recoger (se calcula en local, sin pedir nada al servidor)
  const mine = { id: 'mine-btn', dotId: 'mine-dot' };
  function checkMine() {
    let on = false;
    try { on = logged() && typeof prodState !== 'undefined' && !!prodState && !!prodState.parcels && Math.floor(liveTotal() + 1e-9) >= 1; } catch (e) { /* app.js aún no está listo */ }
    paint(mine, on);
  }

  const checkAll = () => { ITEMS.forEach(check); checkMine(); };

  // Entrar / salir de la cuenta
  let tokenSeen = null;
  setInterval(() => {
    if (logged() !== tokenSeen) { tokenSeen = logged(); checkAll(); }
    ITEMS.concat([mine]).forEach(dotFor);   // si otro script reescribe un botón y se lleva el punto, se vuelve a poner
    checkMine();
  }, 2000);
  // Día nuevo, premios nuevos
  setInterval(() => { if (!document.hidden) checkAll(); }, 5 * 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkAll(); });

  // Tras tocar un botón (jugar, cobrar…) se vuelve a mirar ese juego unos segundos para apagar el punto en cuanto no quede nada
  ITEMS.forEach(it => {
    const b = $(it.id); if (!b) return;
    b.addEventListener('click', () => { [4000, 15000, 45000, 90000].forEach(ms => setTimeout(() => check(it), ms)); });
  });

  setTimeout(checkAll, 1500);
})();
