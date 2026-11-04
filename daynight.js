'use strict';
// Día y noche sobre el mapa.
//  - La hora es la hora solar REAL del punto donde está centrado el mapa: si vuelas a Australia ahí puede ser de día aunque aquí sea de noche.
//    Al atardecer y al amanecer hay un tono anaranjado que va pasando al azul de la noche.
//  - De noche se encienden las farolas de las calles y los coches van con faros y pilotos.
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
  const hash = (s, i) => { let h = 2166136261 ^ i; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
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

  // ---------- Farolas (canvas aditivo, por debajo de nombres y vehículos) ----------
  // Se colocan cada ~36 m a lo largo de las calles reales, alternando acera izquierda y derecha. Las calles salen de queryRoads()
  // (solo se piden de noche y con zoom cercano). Cada farola es un charco de luz cálida pequeño y tenue sobre la calzada.
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
  const LAMP_ZOOM = 16, SPACING_M = 36, MAX_LAMPS = 700;
  let lamps = [], lampKey = '', roadsAsked = false, cur = { nd: 0, hour: 12 };
  function wantRoads(on) {
    if (on === roadsAsked || !map.setRoads) return;
    roadsAsked = on; map.setRoads(on, 'n');
  }
  function buildLamps() {
    if (!roadsAsked || !map.queryRoads) return;
    const c = gl.getCenter(), key = c.lat.toFixed(4) + ',' + c.lng.toFixed(4) + ',' + map.getZoom().toFixed(1);
    if (key === lampKey) return;
    const lines = map.queryRoads();
    if (!lines.length) return;                                   // la capa de calles aún no ha cargado: se reintenta en 'idle'
    lampKey = key;
    const out = [], seen = new Set(), mLat = 111320, mLng = 111320 * Math.cos(c.lat * Math.PI / 180), ppm = map.pxPerM();
    for (const ln of lines) {
      if (out.length >= MAX_LAMPS) break;
      if (ln.cls === 'motorway' || ln.cls === 'trunk') continue;
      const off = map.roadMetrics(ln.cls).curb / ppm;            // metros del eje de la calle a la acera
      let side = 1, carry = hash(String(ln[0]), 1) * SPACING_M;
      for (let i = 0; i + 1 < ln.length && out.length < MAX_LAMPS; i++) {
        const [x0, y0] = ln[i], [x1, y1] = ln[i + 1];
        const dx = (x1 - x0) * mLng, dy = (y1 - y0) * mLat, len = Math.hypot(dx, dy);
        if (len < 0.5) continue;
        const nx = -dy / len, ny = dx / len;                     // normal a la calle (metros)
        for (let d = carry; d < len; d += SPACING_M) {
          const f = d / len, lng = x0 + (x1 - x0) * f + side * nx * off / mLng, lat = y0 + (y1 - y0) * f + side * ny * off / mLat;
          const k = Math.round(lng * 20000) + ',' + Math.round(lat * 20000);   // ~5 m: evita farolas repetidas donde se solapan tramos
          if (!seen.has(k)) { seen.add(k); out.push([lng, lat]); }
          side = -side; carry = d + SPACING_M - len;
        }
        carry = Math.max(0, carry);
      }
    }
    lamps = out;
    schedule();
  }
  function drawLights() {
    if (cv.style.display === 'none') return;
    if (cv.width !== Math.round(host.clientWidth * dpr) || cv.height !== Math.round(host.clientHeight * dpr)) resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!lamps.length || map.getZoom() < LAMP_ZOOM) return;
    const on = smooth(0.25, 0.7, cur.nd);                        // se encienden al anochecer
    if (on <= 0.01) return;
    const ppm = map.pxPerM(), r = Math.max(5, Math.min(26, 8 * ppm)), dot = Math.max(1.2, Math.min(2.6, 0.5 * ppm));
    ctx.globalCompositeOperation = 'lighter';
    for (const [lng, lat] of lamps) {
      const p = gl.project([lng, lat]);
      if (p.x < -r || p.y < -r || p.x > W + r || p.y > H + r) continue;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,205,120,${0.34 * on})`); g.addColorStop(1, 'rgba(255,205,120,0)');
      ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      ctx.fillStyle = `rgba(255,236,190,${0.9 * on})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, dot, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawLights(); }); };
  gl.on('render', schedule);
  gl.on('idle', () => { if (cv.style.display !== 'none') buildLamps(); });
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
    if (!force && Math.abs(nd - lastNd) < 0.004 && mode !== 'fast') { schedule(); return; }
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
    wantRoads(nd > 0.25 && map.getZoom() >= LAMP_ZOOM);
    if (!roadsAsked) lamps = [];
    buildLamps(); schedule();
  }
  setInterval(() => { if (!document.hidden) apply(false); }, reduce ? 4000 : 1000);
  gl.on('moveend', () => { apply(false); wantRoads(cur.nd > 0.25 && map.getZoom() >= LAMP_ZOOM); buildLamps(); });
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
