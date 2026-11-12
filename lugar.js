'use strict';
// ETIQUETA DE LUGAR: al moverte por el mapa sale, bajo la barra de arriba, la bandera del país y el nombre del pueblo/ciudad y de la región donde estás.
// Parpadea y se esconde sola a los 10 segundos. Cuando el centro del mapa pasa a otro pueblo/región/país vuelve a salir con el nombre nuevo.
// Los nombres los da el servidor (GET /api/where, ver server.js: geocodificación inversa con caché por celdas de ~1 km).
// No sale con la portada/vídeo de introducción abiertos, ni dentro de la Luna y los planetas (otro mapa), ni con el mapa muy lejos (zoom < 8).
// Usa el global de app.js: gl (el mapa MapLibre).
(function () {
  const MIN_ZOOM = 8;          // por debajo se ve medio país: un pueblo no tendría sentido
  const SHOW_MS = 10000;       // lo que dura la etiqueta
  const WAIT_MS = 1200;        // se espera a que el mapa pare para preguntar
  const base = String(window.API_BASE || '').replace(/\/+$/, '');

  const st = document.createElement('style');
  st.textContent = `
    #lugar { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 66px); transform: translateX(-50%); z-index: 1000;
      max-width: min(92vw, 420px); display: flex; align-items: center; gap: 8px; padding: 7px 16px; border-radius: 999px;
      background: var(--card, #fffe); color: var(--fg, #14213d); border: 1px solid var(--line, #d8dee9); box-shadow: 0 2px 10px rgba(0,0,0,.3);
      font: 700 15px/1.25 system-ui, sans-serif; pointer-events: none; transition: opacity .4s; animation: lugarblink 1s ease-in-out infinite; }
    #lugar.hidden { display: none; }
    #lugar.out { opacity: 0; animation: none; }
    #lugar .lg-f { font-size: 22px; line-height: 1; flex: none; }
    #lugar .lg-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #lugar .lg-r { font-weight: 500; opacity: .75; }
    @keyframes lugarblink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
    @media (prefers-reduced-motion: reduce) { #lugar { animation: none; } }
  `;
  document.head.appendChild(st);

  const el = document.createElement('div');
  el.id = 'lugar'; el.className = 'hidden'; el.setAttribute('data-notranslate', ''); el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);

  const flagOf = cc => /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(ch => 127397 + ch.charCodeAt(0))) : '🌐';
  const lang = () => ((document.documentElement.lang || 'es').slice(0, 2).toLowerCase());
  function countryName(cc) { try { return new Intl.DisplayNames([lang()], { type: 'region' }).of(cc) || cc; } catch (e) { return cc || ''; } }

  // ¿Algo tapa el mapa de la Tierra? (portada, vídeo de introducción, otros mundos)
  const blocked = () => document.hidden || !!window.coverOpen || !!document.querySelector('#intro:not(.hidden), .mundo:not(.hidden)');

  let hideT = null, outT = null, shown = '';
  function hide() {
    clearTimeout(hideT); clearTimeout(outT);
    el.classList.add('out');
    outT = setTimeout(() => el.classList.add('hidden'), 450);
  }
  function show(p) {
    el.replaceChildren();
    const f = document.createElement('span'); f.className = 'lg-f'; f.textContent = flagOf(p.cc); f.setAttribute('aria-hidden', 'true');
    const t = document.createElement('span'); t.className = 'lg-t';
    t.append(p.city || p.region);
    if (p.city && p.region) { const r = document.createElement('span'); r.className = 'lg-r'; r.textContent = ' · ' + p.region; t.append(r); }
    el.append(f, t);
    el.title = (p.cc ? countryName(p.cc) + ': ' : '') + [p.city, p.region].filter(Boolean).join(', ');
    clearTimeout(hideT); clearTimeout(outT);
    el.classList.remove('hidden', 'out', 'blink');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';   // reinicia el parpadeo con cada lugar nuevo
    hideT = setTimeout(hide, SHOW_MS);
  }

  // ---------- Qué lugar es el centro del mapa ----------
  let lastCell = '', lastKey = '', pending = null, seq = 0, retryAt = 0;
  const cells = new Map();   // celda de ~1 km -> lugar (para no volver a preguntar al volver a un sitio)
  const keyOf = p => [p.cc, p.region, p.city].join('|');

  function offer(p) {   // lugar nuevo: se enseña (o queda pendiente si ahora algo tapa el mapa)
    const k = keyOf(p);
    if (k === lastKey) return;
    lastKey = k;
    if (blocked()) { pending = p; return; }
    pending = null; show(p);
  }
  async function check() {
    if (typeof gl === 'undefined' || !gl || blocked() || (gl.isMoving && gl.isMoving()) || gl.getZoom() < MIN_ZOOM || Date.now() < retryAt) return;
    const c = gl.getCenter();
    if (!c || Math.abs(c.lat) > 85) return;
    const cell = Math.round(c.lat / 0.01) + ',' + Math.round(c.lng / 0.01) + '|' + lang();
    if (cell === lastCell) return;
    lastCell = cell;
    const hit = cells.get(cell);
    if (hit) return hit.city || hit.region ? offer(hit) : undefined;
    const my = ++seq;
    try {
      const r = await fetch(base + '/api/where?lat=' + c.lat.toFixed(4) + '&lng=' + c.lng.toFixed(4) + '&lang=' + lang());
      if (!r.ok) throw new Error('where ' + r.status);
      const j = await r.json();
      if (cells.size > 500) cells.clear();
      cells.set(cell, j);
      if (my === seq && (j.city || j.region)) offer(j);   // si el mapa ya se movió a otro sitio, esta respuesta ya no vale
    } catch (e) { lastCell = ''; retryAt = Date.now() + 15000; }   // sin red o servidor ocupado: se reintenta en un rato
  }

  let timer = null;
  const queue = () => { clearTimeout(timer); timer = setTimeout(check, WAIT_MS); };

  // Esperar a que exista el mapa
  const boot = setInterval(() => {
    if (typeof gl === 'undefined' || !gl || typeof gl.on !== 'function') return;
    clearInterval(boot);
    gl.on('moveend', queue);
    queue();
  }, 500);

  setInterval(check, 3000);   // por si se despeja la portada y el mapa no se mueve más: el lugar de ese momento también se enseña

  // Si algo tapaba el mapa cuando llegó el nombre, se enseña en cuanto se despeje
  setInterval(() => { if (pending && !blocked()) { const p = pending; pending = null; show(p); } }, 1500);
  // Al abrir la portada / un planeta mientras está la etiqueta, se esconde
  setInterval(() => { if (!el.classList.contains('hidden') && blocked()) hide(); }, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queue(); });
})();
