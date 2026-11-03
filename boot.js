'use strict';
// Arranque con el servidor dormido (plan gratuito de Render).
// Si la API está en otro sitio (API_BASE), se muestra una pantalla propia con una imagen del juego
// hasta que el servidor despierta, y las llamadas /api/... esperan a que esté listo.
// Con API_BASE vacío (mismo servidor) no hace nada.
(function () {
  const base = String(window.API_BASE || '').trim().replace(/\/+$/, '');
  window.API_BASE = base;
  window.apiState = { ready: !base };
  if (!base) { window.apiReady = Promise.resolve(); return; }

  const nativeFetch = window.fetch.bind(window);
  let resolveReady;
  window.apiReady = new Promise(r => { resolveReady = r; });

  // Las llamadas /api/... van al servidor de la API y esperan a que esté despierto
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      const go = () => nativeFetch(base + input, init);
      return window.apiState.ready ? go() : window.apiReady.then(go);
    }
    return nativeFetch(input, init);
  };
  const NativeES = window.EventSource;
  if (NativeES) {
    window.EventSource = function (url, opts) { return new NativeES(typeof url === 'string' && url.startsWith('/api/') ? base + url : url, opts); };
    window.EventSource.prototype = NativeES.prototype;
    ['CONNECTING', 'OPEN', 'CLOSED'].forEach(k => { window.EventSource[k] = NativeES[k]; });
  }

  // Pantalla de carga (el HTML y el CSS están en index.html)
  const root = document.documentElement;
  root.classList.add('booting');
  const t0 = Date.now();
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function paint() {
    const s = Math.floor((Date.now() - t0) / 1000), msg = $('boot-msg'), sub = $('boot-sub'), retry = $('boot-retry');
    if (!msg) return;
    if (navigator.onLine === false) { msg.textContent = 'Sin conexión a internet'; sub.textContent = 'Se reanudará solo cuando vuelva la conexión.'; return; }
    if (s < 75) { msg.textContent = 'Despertando el servidor…'; sub.textContent = `Puede tardar hasta un minuto la primera vez · ${s} s`; }
    else { msg.textContent = 'Está tardando más de lo normal…'; sub.textContent = `Seguimos intentándolo · ${s} s`; if (retry) retry.classList.remove('hidden'); }
  }
  const tick = setInterval(paint, 1000);
  document.addEventListener('DOMContentLoaded', () => {
    paint();
    const retry = $('boot-retry'); if (retry) retry.addEventListener('click', () => location.reload());
  });

  // Se pregunta al servidor hasta que contesta (mientras duerme, Render responde con su propia página y falla el CORS)
  async function ping() {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await nativeFetch(base + '/api/health', { cache: 'no-store', signal: ac.signal });
      if (r.ok) { const j = await r.json(); return !!(j && j.ok); }
    } catch (e) { /* aún dormido o sin red */ }
    finally { clearTimeout(to); }
    return false;
  }
  (async function loop() {
    while (!(await ping())) await sleep(2500);
    window.apiState.ready = true;
    clearInterval(tick);
    resolveReady();
    root.classList.add('boot-out');                              // desvanece la pantalla
    setTimeout(() => root.classList.remove('booting', 'boot-out'), 500);
  })();
})();
