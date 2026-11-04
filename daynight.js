'use strict';
// Día y noche sobre el mapa.
//  - La hora es la hora solar REAL del punto donde está centrado el mapa: si vuelas a Australia ahí puede ser de día aunque aquí sea de noche.
//    Al atardecer y al amanecer hay un tono anaranjado que va pasando al azul de la noche.
//  - De noche las casas encienden ventanas (algunas se apagan de madrugada y alguna parpadea como una tele) y los coches van con faros y pilotos.
//  - Botón 🌗 del menú: Automático (hora real) → Día → Noche → Rápido (un día entero en 90 s, para verlo).
//    En la consola: setDayNight('auto' | 'day' | 'night' | 'fast')
(function () {
  if (typeof map === 'undefined' || !map || !map.gl) return;
  const gl = map.gl, KEY = 'dayNightMode', MODES = ['auto', 'day', 'night', 'fast'];
  const NAMES = { auto: 'Automático (hora real)', day: 'Siempre de día', night: 'Siempre de noche', fast: 'Rápido (día en 90 s)' };
  const FAST_DAY_MS = 90e3;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('daynight-btn');
  let mode = 'auto';
  try { const s = localStorage.getItem(KEY); if (MODES.includes(s)) mode = s; } catch (e) {}

  // ---------- Hora solar y oscuridad (0 = día, 1 = noche cerrada) ----------
  let fastShift = 0, fastT0 = 0;
  const rad = Math.PI / 180, smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function startFast() {
    const now = Date.now(), c = gl.getCenter();
    const nowH = (((now / 3600e3) % 24) + c.lng / 15 + 24) % 24;
    fastShift = (((17 - nowH) % 24) + 24) % 24 * 3600e3;     // arranca a las 17:00 solares de donde estés mirando
    fastT0 = now;
  }
  function sun() {   // { nd, hour } en el centro del mapa
    if (mode === 'day') return { nd: 0, hour: 12 };
    if (mode === 'night') return { nd: 1, hour: 22 };
    const c = gl.getCenter(), now = Date.now();
    const t = mode === 'fast' ? now + fastShift + (now - fastT0) * (86400e3 / FAST_DAY_MS - 1) : now;
    const d = new Date(t), hour = (((d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) + c.lng / 15) % 24 + 24) % 24;
    const doy = Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400e3);
    const dec = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365) * rad, lat = c.lat * rad, H = (hour - 12) * 15 * rad;
    const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)) / rad;   // altura del sol en grados
    return { nd: smooth(5, -9, alt), hour };
  }

  // ---------- Capa oscura (multiplica los colores del mapa) ----------
  const host = gl.getCanvasContainer();
  const shade = document.createElement('div');
  shade.id = 'night-shade';
  shade.setAttribute('aria-hidden', 'true');
  shade.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:multiply;display:none;';
  host.appendChild(shade);

  // ---------- Luces de las casas (canvas aditivo, por encima de la capa oscura y por debajo de nombres y vehículos) ----------
  const cv = document.createElement('canvas');
  cv.id = 'night-lights';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:none;';
  host.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = host.clientWidth; H = host.clientHeight;
    cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
  }
  const hash = (s, i) => { let h = 2166136261 ^ i; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };

  let cur = { nd: 0, hour: 12 };
  function drawLights(tick) {
    if (cv.style.display === 'none') return;
    if (cv.width !== Math.round(host.clientWidth * dpr) || cv.height !== Math.round(host.clientHeight * dpr)) resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const zoom = map.getZoom();
    if (typeof drawn === 'undefined' || typeof boundsOf !== 'function' || zoom < 14.5) return;
    const nd = cur.nd, h = cur.hour;
    const late = h >= 0.5 && h < 6 ? 0.3 : h >= 6 && h < 7.5 ? 0.6 : 1;    // de madrugada la mayoría de luces están apagadas
    const b = gl.getBounds(), padLat = (b.getNorth() - b.getSouth()) * 0.1, padLng = (b.getEast() - b.getWest()) * 0.1;
    ctx.globalCompositeOperation = 'lighter';
    for (const ex of drawn.values()) {
      const p = ex.p; if (!p) continue;
      const [[s, w], [n, e]] = boundsOf(p.x, p.y);
      const cLat = (s + n) / 2, cLng = (w + e) / 2;
      if (cLat < b.getSouth() - padLat || cLat > b.getNorth() + padLat || cLng < b.getWest() - padLng || cLng > b.getEast() + padLng) continue;
      const c = gl.project([cLng, cLat]), a = gl.project([w, s]), z = gl.project([e, n]);
      const sz = (Math.abs(z.x - a.x) + Math.abs(z.y - a.y)) / 2;
      if (sz < 3 || c.x < -sz || c.y < -sz || c.x > W + sz || c.y > H + sz) continue;
      const id = String(p.id);
      const cnt = sz < 14 ? 1 : Math.max(3, Math.min(9, Math.round(sz / 16)));
      let lit = 0;
      for (let i = 0; i < cnt; i++) {
        const thr = hash(id, i * 7 + 1), off = hash(id, i * 7 + 2);
        const on = smooth(thr * 0.55 + 0.1, thr * 0.55 + 0.3, nd) * (off < late ? 1 : 0);   // se van encendiendo poco a poco al anochecer
        if (on <= 0.01) continue;
        lit += on;
        if (sz < 14) continue;
        // Ventanas pequeñas y sueltas (nunca un foco grande: sumadas darían una mancha blanca)
        const x = c.x + (hash(id, i * 7 + 3) - 0.5) * sz * 0.7, y = c.y + (hash(id, i * 7 + 4) - 0.5) * sz * 0.7;
        let al = on * 0.8, rgb = '255,200,110';
        if (i === 0 && hash(id, 99) < 0.35) { rgb = '150,190,255'; al *= 0.55 + 0.45 * hash(id, tick % 40 + 100); }   // tele que parpadea
        const r = Math.max(2, Math.min(7, sz * 0.045));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${al * 0.55})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.fillStyle = `rgba(255,226,160,${Math.min(0.95, al)})`;
        const ws = Math.max(1, Math.min(2.6, sz * 0.012)); ctx.fillRect(x - ws, y - ws * 0.8, ws * 2, ws * 1.6);
      }
      if (lit > 0.01 && sz < 14) {   // casas lejanas: un puntito cálido
        const r = Math.max(2, sz * 0.5), g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, `rgba(255,190,100,${Math.min(0.5, lit * 0.4)})`); g.addColorStop(1, 'rgba(255,190,100,0)');
        ctx.fillStyle = g; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  let raf = 0, tick = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawLights(tick); }); };
  gl.on('render', schedule);
  addEventListener('resize', schedule);

  // ---------- Estilos: coches con luces, y personas, animales y nubes más oscuros ----------
  const st = document.createElement('style');
  st.textContent = `
    .vh-lights { display: none; position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
    body.dn-on .vh-lights { display: block; opacity: min(1, calc(var(--nd) * 1.5)); }
    .vh-beam { position: absolute; top: 50%; background: linear-gradient(to right, rgba(255,240,180,.85), rgba(255,240,180,.28) 45%, rgba(255,240,180,0)); mix-blend-mode: screen;
      clip-path: polygon(0 34%, 100% 0, 100% 100%, 0 66%); transform: translateY(-50%); }
    .vh-tail { position: absolute; border-radius: 50%; background: radial-gradient(circle, rgba(255,40,50,.9), rgba(255,40,50,0) 70%); mix-blend-mode: screen; }
    body.dn-on .vh-rot svg { filter: brightness(calc(1 - var(--nd) * .45)); }
    body.dn-on .pw-in, body.dn-on .an-in { filter: brightness(calc(1 - var(--nd) * .45)); }
    body.dn-on #weather-canvas { filter: brightness(calc(1 - var(--nd) * .6)); }
    #daynight-btn[data-mode="night"], #daynight-btn[data-mode="day"] { outline: 2px solid var(--accent, #0b6e4f); }`;
  document.head.appendChild(st);

  // Faros delanteros y pilotos traseros: se añaden a cada vehículo de carretera (los trenes y similares se saltan)
  function addLights(el) {
    if (el.dataset.dn) return;
    const rot = el.querySelector('.vh-rot'); if (!rot) return;
    const L = parseFloat(el.style.width), Wd = parseFloat(el.style.height);
    el.dataset.dn = '1';
    if (!(L > 0 && Wd > 0) || L > 100 || (Wd === 18 && (L === 56 || L === 62))) return;   // fuera: estaciones y vagones de tren
    const box = document.createElement('div'); box.className = 'vh-lights';
    const small = Wd < 12;                                       // motos, bicis y patinetes: un solo foco y más corto
    const bl = L * (small ? 1.5 : 2.1), bh = Wd * (small ? 2.2 : 2.5);
    box.innerHTML = `<div class="vh-beam" style="left:${L - 2}px;width:${bl}px;height:${bh}px"></div>` +
      `<div class="vh-tail" style="left:${-Wd * 0.45}px;top:${Wd * 0.18}px;width:${Wd * 0.9}px;height:${Wd * 0.64}px"></div>`;
    rot.appendChild(box);
  }
  const scan = root => { if (root.nodeType !== 1) return; if (root.classList.contains('vh')) addLights(root); else root.querySelectorAll && root.querySelectorAll('.vh').forEach(addLights); };
  new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(host, { childList: true, subtree: true });
  scan(host);

  // ---------- Aplicar ----------
  let lastNd = -1;
  function apply(force) {
    cur = sun();
    const nd = cur.nd;
    if (!force && Math.abs(nd - lastNd) < 0.004 && mode !== 'fast') { if (nd > 0.05) { tick++; schedule(); } return; }
    lastNd = nd;
    document.documentElement.style.setProperty('--nd', nd.toFixed(3));
    document.body.classList.toggle('dn-on', nd > 0.04);
    if (nd > 0.015) {
      // del naranja del atardecer al azul de la noche
      const k = smooth(0.15, 0.75, nd), mix = (a, b) => Math.round(a + (b - a) * k);
      shade.style.background = `rgb(${mix(255, 52)},${mix(175, 66)},${mix(120, 118)})`;
      shade.style.opacity = String(Math.min(0.78, Math.pow(nd, 0.85) * 0.78));
      shade.style.display = 'block'; cv.style.display = 'block';
    } else { shade.style.display = 'none'; cv.style.display = 'none'; ctx.clearRect(0, 0, cv.width, cv.height); }
    tick++; schedule();
  }
  setInterval(() => { if (!document.hidden) apply(false); }, reduce ? 4000 : 1000);
  gl.on('moveend', () => apply(false));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(true); });

  function setMode(m, save) {
    if (!MODES.includes(m)) return;
    mode = m;
    if (m === 'fast') startFast();
    if (save !== false) { try { localStorage.setItem(KEY, m); } catch (e) {} }
    if (btn) {
      btn.dataset.mode = m; btn.dataset.label = 'Hora: ' + NAMES[m];
      btn.title = 'Día y noche: ' + NAMES[m]; btn.setAttribute('aria-label', btn.title);
      btn.textContent = m === 'day' ? '☀️' : m === 'night' ? '🌙' : m === 'fast' ? '⏩' : '🌗';
    }
    apply(true);
  }
  window.setDayNight = setMode;
  if (btn) btn.addEventListener('click', () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]));
  resize();
  setMode(mode, false);
})();
