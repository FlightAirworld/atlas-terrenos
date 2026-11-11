'use strict';
// Jugadores en línea en tiempo real. Cada pestaña abierta mantiene una conexión con /api/online (SSE);
// el servidor cuenta jugadores distintos y avisa cuando el número cambia. Sin datos personales:
// solo se envía un identificador aleatorio guardado en este navegador.
(function () {
  const btn = document.getElementById('online-btn');
  if (!btn) return;
  if (!window.EventSource) { btn.style.display = 'none'; return; }
  const nEl = document.getElementById('online-n'), tip = document.getElementById('online-tip');   // tip: texto accesible del contador

  let cid = null;
  try { cid = localStorage.getItem('onlineCid'); } catch (e) {}
  if (!cid || !/^[\w-]{8,40}$/.test(cid)) {
    cid = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('onlineCid', cid); } catch (e) {}
  }

  const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',') + 'k' : String(n);
  // Botones «en línea» de los demás mundos (los crea mundos.js dentro de cada planeta): muestran el mismo número
  function mirrors(fn) { document.querySelectorAll('.mundo-online').forEach(fn); }
  function show(n) {
    nEl.textContent = fmt(n);
    const txt = n === 1 ? '1 jugador en línea ahora' : n.toLocaleString('es') + ' jugadores en línea ahora';
    btn.title = txt; btn.setAttribute('aria-label', txt);
    if (tip) tip.textContent = txt;
    btn.classList.remove('off');
    window.onlineLast = n;
    mirrors(m => { const b = m.querySelector('b'); if (b) b.textContent = fmt(n); m.title = txt; m.setAttribute('aria-label', txt); m.classList.remove('off'); });
  }

  let es = null, closeTimer = null, retryTimer = null;
  function open() {
    clearTimeout(retryTimer);
    if (es) return;
    if (window.apiState && !window.apiState.ready) return;      // servidor dormido: se abre cuando despierte
    let mine = ''; try { mine = localStorage.getItem('country') || ''; } catch (e) {}
    es = new EventSource('/api/online?cid=' + encodeURIComponent(cid) + (/^[A-Za-z]{2}$/.test(mine) ? '&country=' + mine.toUpperCase() : ''));
    es.onopen = () => { btn.classList.remove('off'); mirrors(m => m.classList.remove('off')); };
    es.addEventListener('santa', e => { try { window.dispatchEvent(new CustomEvent('santa-msg', { detail: JSON.parse(e.data) })); } catch (x) {} });   // Papá Noel (santa.js)
    es.onmessage = e => { const n = parseInt(e.data, 10); if (Number.isFinite(n) && n >= 0) show(n); };
    es.onerror = () => {
      btn.classList.add('off'); mirrors(m => m.classList.add('off'));   // sin conexión: punto gris
      if (es && es.readyState === 2) { close(); retryTimer = setTimeout(open, 15000); }   // el navegador se rindió: reintento manual
    };
  }
  function close() { if (es) { es.close(); es = null; } }

  // En segundo plano más de un minuto ya no cuenta como "en línea"
  document.addEventListener('visibilitychange', () => {
    clearTimeout(closeTimer);
    if (document.hidden) closeTimer = setTimeout(close, 60000); else open();
  });
  addEventListener('pagehide', close);
  addEventListener('pageshow', e => { if (e.persisted) open(); });

  // ---------- Panel: jugadores en línea por país (se abre al tocar el contador) ----------
  // Solo cuenta jugadores realmente conectados. Se actualiza solo cada pocos segundos mientras está abierto.
  const REFRESH_MS = 4000;
  const flagOf = c => /^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map(ch => 127397 + ch.charCodeAt(0))) : '🌐';
  let names = null;
  function nameOf(cc) {
    try {
      if (!names) names = new Intl.DisplayNames([(window.i18n && window.i18n.lang) || document.documentElement.lang || 'es', 'es'], { type: 'region' });
      const n = names.of(cc);
      return n && n !== cc ? n.charAt(0).toUpperCase() + n.slice(1) : cc;
    } catch (e) { return cc; }
  }
  const st = document.createElement('style');
  st.textContent = `
    #online-panel .modal-card { width:min(400px,100%); }
    #op-total { margin:2px 0 10px; font-weight:700; }
    #op-live { display:inline-block; width:9px; height:9px; border-radius:50%; background:#2fbf71; margin-right:6px; animation:dailypulse 1.4s infinite; }
    #op-live.off { background:#9aa6b6; animation:none; }
    #op-list { list-style:none; margin:0; padding:0; max-height:min(56vh,420px); overflow-y:auto; overscroll-behavior:contain; }
    #op-list li { position:relative; display:flex; align-items:center; gap:10px; padding:9px 10px; margin:4px 0; border-radius:10px; overflow:hidden; border:1px solid var(--line); }
    #op-list li .bar { position:absolute; inset:0 auto 0 0; background:var(--accent); opacity:.14; transition:width .5s ease; }
    #op-list li .fl { position:relative; font-size:24px; line-height:1; }
    #op-list li .nm { position:relative; flex:1; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    #op-list li .n { position:relative; font-weight:800; font-variant-numeric:tabular-nums; }
    #op-empty { text-align:center; padding:14px 0; }
    @media (prefers-reduced-motion: reduce) { #op-live { animation:none; } #op-list li .bar { transition:none; } }`;
  document.head.appendChild(st);

  const box = document.createElement('div');
  box.id = 'online-panel'; box.className = 'modal hidden';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'op-title');
  box.innerHTML =
    '<div class="modal-card">' +
    '<button id="op-close" class="close" type="button" aria-label="Cerrar">×</button>' +
    '<h2 id="op-title">🌍 Jugadores por país</h2>' +
    '<p id="op-total" aria-live="polite"><span id="op-live"></span><span id="op-total-t">Cargando…</span></p>' +
    '<ul id="op-list"></ul>' +
    '<p id="op-empty" class="muted hidden">Ahora mismo no hay nadie conectado.</p>' +
    '</div>';
  document.body.appendChild(box);
  const $ = id => document.getElementById(id);
  const listEl = $('op-list'), totalEl = $('op-total-t'), liveEl = $('op-live'), emptyEl = $('op-empty');

  function render(j) {
    const rows = (j.countries || []).slice();
    if (j.unknown > 0) rows.push({ cc: '', n: j.unknown });                  // sin identificar, siempre al final
    const max = Math.max(1, ...rows.map(r => r.n));
    listEl.textContent = '';
    for (const r of rows) {
      const li = document.createElement('li');
      const bar = document.createElement('span'); bar.className = 'bar'; bar.style.width = Math.max(4, Math.round(r.n / max * 100)) + '%';
      const fl = document.createElement('span'); fl.className = 'fl'; fl.textContent = flagOf(r.cc); fl.setAttribute('aria-hidden', 'true');
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = r.cc ? nameOf(r.cc) : 'Sin identificar';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = r.n.toLocaleString('es');
      li.append(bar, fl, nm, n); listEl.appendChild(li);
    }
    const t = j.total || 0;
    totalEl.textContent = t === 1 ? '1 jugador conectado ahora' : t.toLocaleString('es') + ' jugadores conectados ahora';
    emptyEl.classList.toggle('hidden', t > 0);
    liveEl.classList.remove('off');
  }

  let pollTimer = null, ctrl = null, lastFocus = null;
  async function refresh() {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    try {
      const r = await fetch('/api/online/countries', { cache: 'no-store', signal: ctrl.signal });
      if (!r.ok) throw new Error('http ' + r.status);
      render(await r.json());
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      liveEl.classList.add('off'); totalEl.textContent = 'Sin conexión: reintentando…';
    }
  }
  function schedule() { clearTimeout(pollTimer); pollTimer = setTimeout(async () => { if (!document.hidden) await refresh(); if (!box.classList.contains('hidden')) schedule(); }, REFRESH_MS); }
  function openPanel() {
    lastFocus = document.activeElement;
    box.classList.remove('hidden');
    refresh(); schedule();
    $('op-close').focus();
  }
  function closePanel() {
    box.classList.add('hidden'); clearTimeout(pollTimer); if (ctrl) ctrl.abort();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  btn.addEventListener('click', openPanel);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.mundo-online')) openPanel(); });   // el mismo panel desde cualquier planeta
  $('op-close').addEventListener('click', closePanel);
  box.addEventListener('click', e => { if (e.target === box) closePanel(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) closePanel(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !box.classList.contains('hidden')) { refresh(); schedule(); } });

  (window.apiReady || Promise.resolve()).then(open);
})();
