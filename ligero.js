'use strict';
// Modo ligero: si el juego va a trompicones, baja solo la cantidad de cosas que se mueven (coches, gente, animales, patos,
// peces, lluvia, fotos del suelo) y la resolución del mapa, para que no se quede colgado en móviles flojos.
//  · Mide los fotogramas por segundo con requestAnimationFrame. Si durante ~6 s seguidos van por debajo de 24, sube un nivel.
//  · Niveles: 0 = normal, 1 = ligero (≈45 % de cosas), 2 = muy ligero (≈15 %; solo si aun así sigue yendo mal).
//  · Menú → ⚡ Modo ligero: Automático (por defecto) → Siempre ligero → Desactivado. Se guarda en el navegador.
//  · Los demás scripts consultan window.Perf.cap(n, mínimo) en lugar de usar un número fijo, y escuchan el evento «perfchange».
// La lógica de decisión (createGovernor) no toca el navegador, así que se prueba con `node --test` (ver ligero.test.js).
(function () {
  // ---------- Lógica pura: decide cuándo subir de nivel ----------
  function createGovernor(o) {
    o = o || {};
    const WINDOW = o.windowMs || 2000,      // cada cuánto se calcula la media de fps
      WARMUP = o.warmupMs == null ? 10000 : o.warmupMs,   // al arrancar (y tras cada cambio) no se juzga: el mapa aún está cargando
      PAUSE = o.pauseMs || 2500,            // un hueco así entre fotogramas es pestaña congelada o app en segundo plano, no lentitud
      BAD = o.badFps || 24,                 // por debajo de esto va mal en el nivel 0…
      BAD2 = o.badFps2 || 16,               // …y por debajo de esto en el nivel 1 (hay que ser más exigente para pasar al 2)
      NEED = o.needBad || 3,                // ventanas malas seguidas necesarias
      MAXLVL = o.maxLevel == null ? 2 : o.maxLevel,
      SETTLE = o.settleMs == null ? 4000 : o.settleMs;    // espera tras subir de nivel, para dejar que se note el cambio
    let level = o.startLevel || 0, bad = 0, t0 = null, wait = WARMUP, wStart = null, frames = 0, last = null, fps = 0;
    function reset() { wStart = null; frames = 0; }
    return {
      get level() { return level; },
      get fps() { return fps; },
      setLevel(n) { level = Math.max(0, Math.min(MAXLVL, n | 0)); bad = 0; t0 = null; wait = SETTLE; reset(); },
      // Llamar en cada fotograma con su marca de tiempo (ms). Devuelve el nuevo nivel si ha cambiado, o null.
      frame(t, hidden) {
        const gap = last == null ? 0 : t - last;
        last = t;
        if (hidden || gap > PAUSE) { reset(); bad = 0; if (t0 != null) t0 = t; return null; }
        if (t0 == null) t0 = t;
        if (t - t0 < wait) { reset(); return null; }
        if (wStart == null) { wStart = t; frames = 0; return null; }
        frames++;
        const span = t - wStart;
        if (span < WINDOW) return null;
        fps = frames * 1000 / span;
        reset();
        if (level >= MAXLVL) return null;
        const limit = level === 0 ? BAD : BAD2;
        if (fps < limit) bad++; else bad = 0;
        if (bad >= NEED) { level++; bad = 0; t0 = t; wait = SETTLE; return level; }
        return null;
      }
    };
  }

  if (typeof module === 'object' && module.exports) { module.exports = { createGovernor }; return; }
  if (typeof window === 'undefined') return;

  // ---------- Navegador ----------
  const MODE_KEY = 'perfMode', LEARN_KEY = 'perfLearned', WEEK = 7 * 864e5;
  const FACTOR = [1, 0.45, 0.15];
  const tr = s => (window.i18n && i18n.lang !== 'es' && i18n.t) ? i18n.t(s) : s;
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };

  let mode = read(MODE_KEY); if (mode !== 'on' && mode !== 'off') mode = 'auto';
  let level = 0;
  const listeners = [];

  // Nivel de partida: «siempre ligero» → 1; automático → lo que se aprendió en este móvil (si es reciente) o, si es un móvil
  // muy justo de memoria o de procesador, 1; desactivado → 0.
  function startLevel() {
    if (mode === 'on') return 1;
    if (mode === 'off') return 0;
    try {
      const j = JSON.parse(read(LEARN_KEY) || 'null');
      if (j && j.l > 0 && Date.now() - j.t < WEEK) return 1;
    } catch (e) {}
    const mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
    return (mem && mem <= 2) || (cores && cores <= 2) ? 1 : 0;
  }
  level = startLevel();
  const gov = createGovernor({ startLevel: level });

  const Perf = {
    get level() { return level; },
    get lite() { return level > 0; },
    get mode() { return mode; },
    get fps() { return gov.fps; },
    // Reduce una cantidad según el nivel: Perf.cap(36, 6) → 36 normal, 16 en ligero, 5→6 (mínimo) en muy ligero
    cap(n, min) { return level ? Math.max(min || 0, Math.round(n * FACTOR[level])) : n; },
    onChange(fn) { if (typeof fn === 'function') listeners.push(fn); },
    setMode(m) { setMode(m); }
  };
  window.Perf = Perf;

  // ---------- Estilos: sin animaciones decorativas, sombras ni desenfoques cuando va justo ----------
  const st = document.createElement('style');
  st.id = 'ligero-css';
  st.textContent = `
    html.lite .pw-in, html.lite .an-in, html.lite .al-sp svg, html.lite .al-leg, html.lite .al-e > .al-sp, html.lite .bl, html.lite .rv-w,
    html.lite .cf, html.lite .dgw .l1, html.lite .dgw .l2, html.lite .dgw .tl, html.lite .exa-arm, html.lite .cn::after { animation: none !important; }
    html.lite .pl, html.lite .rt-i, html.lite .ts-i { filter: none !important; }
    html.lite .modal, html.lite #mp-scrim, html.lite #map-controls, html.lite #menu-items, html.lite #credit-pill { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
    html.lite2 .pw-in, html.lite2 .an-in { transition: none !important; }
    #lite-btn[aria-pressed="true"] .mp-ic { box-shadow: 0 0 0 2px var(--mp-acc, #087f5b) inset; }`;
  document.head.appendChild(st);

  // ---------- Resolución del mapa: en pantallas de mucha densidad, dibujar menos píxeles es lo que más alivia ----------
  const DPR = window.devicePixelRatio || 1;
  let mapTries = 0;
  function applyMap() {
    let g = null;
    try { g = typeof gl !== 'undefined' ? gl : null; } catch (e) {}
    if (!g || !g.setPixelRatio) { if (level && ++mapTries < 40) setTimeout(applyMap, 500); return; }   // el mapa aún no existe
    const want = level === 0 ? DPR : level === 1 ? Math.min(DPR, 1.5) : 1;
    try { if (g.getPixelRatio && g.getPixelRatio() !== want) g.setPixelRatio(want); } catch (e) {}
  }

  // ---------- Botón del menú ----------
  const btn = document.getElementById('lite-btn');
  const LABEL = { auto: 'Modo ligero: automático', on: 'Modo ligero: activado', off: 'Modo ligero: desactivado' };
  function paintBtn() {
    if (!btn) return;
    const text = tr(LABEL[mode]);
    btn.setAttribute('aria-pressed', mode === 'on' || (mode === 'auto' && level > 0) ? 'true' : 'false');
    btn.setAttribute('title', text); btn.setAttribute('aria-label', text);
    btn.setAttribute('data-label', tr('Modo ligero') + ' · ' + tr(mode === 'auto' ? 'Auto' : mode === 'on' ? 'Sí' : 'No'));
  }

  // ---------- Aviso ----------
  function toast(text) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 6500);
  }

  // ---------- Aplicar un nivel ----------
  function apply(n, auto) {
    const prev = level;
    level = n;
    const root = document.documentElement;
    root.classList.toggle('lite', level >= 1);
    root.classList.toggle('lite2', level >= 2);
    applyMap();
    paintBtn();
    if (prev !== level) {
      try { window.dispatchEvent(new CustomEvent('perfchange', { detail: { level, prev } })); } catch (e) {}
      listeners.slice().forEach(fn => { try { fn(level, prev); } catch (e) {} });
    }
    if (auto && level > prev) {
      write(LEARN_KEY, JSON.stringify({ l: level, t: Date.now() }));
      toast(level === 1
        ? '⚡ ' + tr('El juego iba lento: se ha activado el modo ligero (menos coches y gente). Puedes cambiarlo en Menú → Modo ligero.')
        : '⚡ ' + tr('Sigue yendo justo: modo muy ligero activado. Puedes cambiarlo en Menú → Modo ligero.'));
    }
  }

  // ---------- Vigilante de fotogramas (solo en automático) ----------
  let watching = false;
  function watch(t) {
    if (mode !== 'auto') { watching = false; return; }
    const n = gov.frame(t, document.hidden);
    if (n != null) apply(n, true);
    requestAnimationFrame(watch);
  }
  function startWatch() { if (!watching && mode === 'auto') { watching = true; gov.setLevel(level); requestAnimationFrame(watch); } }

  function setMode(m) {
    mode = m === 'on' || m === 'off' ? m : 'auto';
    write(MODE_KEY, mode === 'auto' ? null : mode);
    if (mode !== 'auto') write(LEARN_KEY, null);     // lo aprendido solo vale para el automático
    apply(mode === 'on' ? 1 : mode === 'off' ? 0 : (level > 1 ? 1 : level), false);
    if (mode === 'auto') { gov.setLevel(level); startWatch(); }
    paintBtn();
  }

  if (btn) btn.addEventListener('click', () => {
    const next = mode === 'auto' ? 'on' : mode === 'on' ? 'off' : 'auto';
    setMode(next);
    toast('⚡ ' + tr(LABEL[next]) + (next === 'auto' ? ' — ' + tr('se activa solo si el juego va lento.') : next === 'on' ? ' — ' + tr('menos coches, gente y animales.') : ' — ' + tr('todo al máximo.')));
  });

  apply(level, false);
  startWatch();
  window.addEventListener('load', applyMap);
})();
