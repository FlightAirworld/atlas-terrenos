'use strict';
// Jugadores en línea en tiempo real. Cada pestaña abierta mantiene una conexión con /api/online (SSE);
// el servidor cuenta jugadores distintos y avisa cuando el número cambia. Sin datos personales:
// solo se envía un identificador aleatorio guardado en este navegador.
(function () {
  const btn = document.getElementById('online-btn');
  if (!btn) return;
  if (!window.EventSource) { btn.style.display = 'none'; return; }
  const nEl = document.getElementById('online-n'), tip = document.getElementById('online-tip');

  let cid = null;
  try { cid = localStorage.getItem('onlineCid'); } catch (e) {}
  if (!cid || !/^[\w-]{8,40}$/.test(cid)) {
    cid = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('onlineCid', cid); } catch (e) {}
  }

  const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '').replace('.', ',') + 'k' : String(n);
  function show(n) {
    nEl.textContent = fmt(n);
    const txt = n === 1 ? '1 jugador en línea ahora' : n.toLocaleString('es') + ' jugadores en línea ahora';
    btn.title = txt; btn.setAttribute('aria-label', txt);
    if (tip) tip.textContent = txt;
    btn.classList.remove('off');
  }

  let es = null, closeTimer = null, retryTimer = null;
  function open() {
    clearTimeout(retryTimer);
    if (es) return;
    if (window.apiState && !window.apiState.ready) return;      // servidor dormido: se abre cuando despierte
    es = new EventSource('/api/online?cid=' + encodeURIComponent(cid));
    es.onopen = () => btn.classList.remove('off');
    es.onmessage = e => { const n = parseInt(e.data, 10); if (Number.isFinite(n) && n >= 0) show(n); };
    es.onerror = () => {
      btn.classList.add('off');                                   // sin conexión: punto gris
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

  // Al tocar el botón se muestra el texto completo unos segundos
  let tipTimer = null;
  btn.addEventListener('click', () => {
    if (!tip) return;
    tip.classList.add('show');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.remove('show'), 3500);
  });

  (window.apiReady || Promise.resolve()).then(open);
})();
