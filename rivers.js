'use strict';
// Ríos con vida: patos que nadan y peces que se ven bajo el agua, siguiendo los ríos reales del mapa
// (la capa 'wt-waterway' de app.js, que además se dibuja POR ENCIMA de las parcelas).
// Se activan y desactivan con el mismo botón de la gente (🚶), igual que los perros y gatos de animals.js.
(function () {
  if (typeof map === 'undefined' || !map || !map.gl) return;
  const gl = map.gl, MIN_ZOOM = 16, REF_Z = 17;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const MAX_DUCKS = SMALL ? 3 : 6, MAX_FISH = SMALL ? 5 : 10;
  const peopleBtn = document.getElementById('people-btn');
  const isOn = () => !peopleBtn || peopleBtn.getAttribute('aria-pressed') !== 'false';

  const st = document.createElement('style');
  st.textContent = `
    .rv { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .rv-in { width: 100%; height: 100%; transition: opacity .4s; }
    .rv-in svg { overflow: visible; display: block; }
    .rv-duck { animation: rvbob 1.6s ease-in-out infinite alternate; }
    @keyframes rvbob { from { transform: translateY(-.6px); } to { transform: translateY(.6px); } }
    @media (prefers-reduced-motion: reduce) { .rv-duck { animation: none; } }`;
  document.head.appendChild(st);
  map.createPane('rivers');
  const pane = map.getPane('rivers');
  pane.style.zIndex = 586; pane.style.pointerEvents = 'none';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const toLL = (x, y) => map.unproject({ x, y }, REF_Z);

  // Ancho (px de pantalla) con el que se dibuja el río ahora mismo: mismas paradas que WATER_W de app.js
  const STOPS = [[8, 0.5], [14, 2], [16, 5], [18, 13], [20, 30]];
  function riverPx() {
    const z = gl.getZoom();
    if (z <= STOPS[0][0]) return STOPS[0][1];
    for (let i = 1; i < STOPS.length; i++) {
      const [z0, v0] = STOPS[i - 1], [z1, v1] = STOPS[i];
      if (z <= z1) { const t = (Math.pow(1.6, z - z0) - 1) / (Math.pow(1.6, z1 - z0) - 1); return v0 + t * (v1 - v0); }
    }
    return STOPS[STOPS.length - 1][1];
  }

  // ---------- Dibujos (vistos desde arriba, mirando a la derecha) ----------
  function duckSVG() {
    const v = pick([
      { b: '#9b7b52', w: '#6f8fb5', h: '#1f7a4d' },     // ánade real
      { b: '#ffffff', w: '#e6e6e6', h: '#ffffff' },     // pato blanco
      { b: '#c9a063', w: '#a7804a', h: '#7b5a30' }      // pato marrón
    ]);
    return `<svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
      <ellipse cx="11" cy="7" rx="10.6" ry="6.4" fill="none" stroke="rgba(255,255,255,.6)" stroke-width=".8"/>
      <path d="M3 7 L.2 5.4 L.2 8.6Z" fill="${v.b}"/>
      <ellipse cx="9" cy="7" rx="7" ry="4.3" fill="${v.b}" stroke="rgba(0,0,0,.25)" stroke-width=".5"/>
      <ellipse cx="8.5" cy="7" rx="4.2" ry="2.5" fill="${v.w}" opacity=".7"/>
      <circle cx="15.8" cy="7" r="2.8" fill="${v.h}"/>
      <path d="M18.3 5.9 L21.6 7 L18.3 8.1Z" fill="#f4a01c"/>
      <circle cx="16.9" cy="6" r=".55" fill="#111"/><circle cx="16.9" cy="8" r=".55" fill="#111"/></svg>`;
  }
  function fishSVG() {
    const c = pick(['#f28c28', '#e86a3a', '#e8e3d0', '#3a6ea5', '#d9534f', '#f2c14e']);
    const swing = `<animateTransform attributeName="transform" type="rotate" values="-16 6 4.5;16 6 4.5;-16 6 4.5" dur="${rnd(.35, .6).toFixed(2)}s" repeatCount="indefinite"/>`;
    return `<svg width="20" height="9" viewBox="0 0 20 9" aria-hidden="true"><g opacity=".78">
      <path d="M6 4.5 L.2 .8 L1.8 4.5 L.2 8.2Z" fill="${c}">${swing}</path>
      <ellipse cx="11.5" cy="4.5" rx="7" ry="3" fill="${c}"/>
      <path d="M10 2 L12.4 .4 L13.4 2Z M10 7 L12.4 8.6 L13.4 7Z" fill="${c}" opacity=".75"/>
      <circle cx="16" cy="3.6" r=".6" fill="#fff"/><circle cx="16" cy="5.4" r=".6" fill="#fff"/></g></svg>`;
  }

  // ---------- Ríos visibles ahora mismo ----------
  function makePath(pts, cls) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, total: cum[cum.length - 1], cls };
  }
  function riverPaths() {
    if (!gl.getLayer('wt-waterway')) return [];
    let feats = [];
    try { feats = gl.queryRenderedFeatures({ layers: ['wt-waterway'] }); } catch (e) { return []; }
    const scale = Math.pow(2, map.getZoom() - REF_Z), out = [];
    for (const f of feats) {
      const g = f.geometry, cls = f.properties && f.properties.class;
      if (!g || cls === 'drain' || cls === 'ditch') continue;       // acequias y desagües: demasiado pequeños
      const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const l of lines) {
        if (l.length < 2) continue;
        const P = makePath(l.map(c => map.project({ lat: c[1], lng: c[0] }, REF_Z)), cls);
        if (P.total * scale >= 90) out.push(P);
      }
    }
    return out;
  }
  function pointAt(P, s) {
    let i = 0;
    while (i < P.pts.length - 2 && P.cum[i + 1] <= s) i++;
    const a = P.pts[i], b = P.pts[i + 1], len = (P.cum[i + 1] - P.cum[i]) || 1, t = clamp((s - P.cum[i]) / len, 0, 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, th: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  const onScreen = ll => {
    const p = map.latLngToContainerPoint(ll), sz = map.getSize();
    return p.x >= 0 && p.y >= 0 && p.x <= sz.x && p.y <= sz.y;
  };

  const critters = [];
  let zooming = false;

  function spawn(kind) {
    const paths = riverPaths().filter(P => kind === 'fish' || P.cls === 'river' || P.cls === 'canal' || P.cls == null);
    if (!paths.length) return false;
    const P = pick(paths), dir = Math.random() < 0.5 ? 1 : -1;
    let s = null;
    for (let i = 0; i < 14 && s == null; i++) {           // un punto del río que esté a la vista y con camino por delante
      const c = rnd(0, P.total), q = pointAt(P, c);
      if (onScreen(toLL(q.x, q.y))) s = c;
    }
    if (s == null) return false;
    const svg = kind === 'duck' ? duckSVG() : fishSVG();
    const w = kind === 'duck' ? 22 : 20, h = kind === 'duck' ? 14 : 9;
    const icon = L.divIcon({ className: 'rv', iconSize: [w, h], iconAnchor: [w / 2, h / 2],
      html: `<div class="rv-in ${kind === 'duck' ? 'rv-duck' : ''}" style="opacity:0">${svg}</div>` });
    const q = pointAt(P, s);
    const c = { kind, path: P, s, dir, v: kind === 'duck' ? rnd(7, 13) : rnd(14, 26), age: 0, life: rnd(40, 90),
      off: rnd(-0.22, 0.22), wob: rnd(0, 6.28), h: q.th + (dir < 0 ? Math.PI : 0), el: null, mk: null };
    c.mk = L.marker(toLL(q.x, q.y), { icon, pane: 'rivers', interactive: false, keyboard: false }).addTo(map);
    critters.push(c);
    return true;
  }
  function remove(i) { map.removeLayer(critters[i].mk); critters.splice(i, 1); }
  function clearAll() { while (critters.length) remove(0); }
  const count = k => critters.reduce((n, c) => n + (c.kind === k ? 1 : 0), 0);

  map.on('zoomstart', () => { zooming = true; });
  map.on('zoomend', () => { zooming = false; if (map.getZoom() < MIN_ZOOM) clearAll(); });

  let last = performance.now(), nextSpawn = rnd(1, 3), running = false;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    if (!isOn()) { if (running) { running = false; clearAll(); } return; }
    running = true;
    if (document.hidden || zooming) return;
    const z = map.getZoom(), scale = Math.pow(2, z - REF_Z);
    if (z < MIN_ZOOM) return;
    nextSpawn -= dt;
    if (nextSpawn <= 0) {
      const wantDuck = count('duck') < MAX_DUCKS, wantFish = count('fish') < MAX_FISH;
      let ok = true;
      if (wantDuck || wantFish) ok = spawn(wantDuck && (!wantFish || Math.random() < 0.4) ? 'duck' : 'fish');
      nextSpawn = ok ? rnd(1.2, 3.5) : 3;
    }
    const rw = riverPx(), sc = clamp(rw / 9, 0.55, 2.2), bearing = gl.getBearing() * Math.PI / 180;
    const view = map.getBounds().pad(0.4);
    for (let i = critters.length - 1; i >= 0; i--) {
      const c = critters[i];
      c.age += dt; c.s += c.dir * c.v * dt / scale;
      if (c.s <= 0 || c.s >= c.path.total || c.age > c.life) { remove(i); continue; }
      const q = pointAt(c.path, c.s), th = q.th + (c.dir < 0 ? Math.PI : 0);
      c.h += clamp(angDiff(th, c.h), -3 * dt, 3 * dt);
      // desplazamiento lateral dentro del cauce (el pez serpentea; el pato va por su lado)
      const lat = (c.off + (c.kind === 'fish' ? Math.sin(c.age * 2.2 + c.wob) * 0.16 : Math.sin(c.age * 0.5 + c.wob) * 0.05)) * rw / scale;
      const x = q.x - Math.sin(q.th) * lat, y = q.y + Math.cos(q.th) * lat, ll = toLL(x, y);
      if (c.age > 3 && !view.contains(ll)) { remove(i); continue; }
      c.mk.setLatLng(ll);
      if (!c.el) { const e = c.mk.getElement(); c.el = e && e.firstChild; }
      if (c.el) {
        c.el.style.scale = sc.toFixed(3);
        c.el.style.rotate = ((c.h - bearing) * 180 / Math.PI).toFixed(1) + 'deg';
        const toEnd = Math.min(c.s, c.path.total - c.s) * scale / 30;
        c.el.style.opacity = Math.max(0, Math.min(1, c.age / 1.2, toEnd, (c.life - c.age) / 1.5)) * (c.kind === 'fish' ? 0.9 : 1);
      }
    }
  }
  requestAnimationFrame(frame);
})();
