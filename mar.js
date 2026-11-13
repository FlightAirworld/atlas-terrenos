'use strict';
// Mar con vida: barcos, barquitos, tiburones, gente nadando y tomando el sol, y un puerto con ferry.
//  · Lee el agua del mapa (la capa 'wt-water' de app.js: mar, lagos y ríos anchos) y la guarda como polígonos en píxeles de mundo,
//    así puede preguntar "¿hay agua aquí?" sin tocar el mapa a cada fotograma.
//  · Barcos (velero, lancha, pesquero) y barquitos de remos navegan sin salir del agua ni pasar por encima de una casa.
//  · Tiburones (solo en agua grande: mar o lagos enormes) patrullan. Si ven un bañista o un barco lo persiguen:
//    el bañista grita y huye nadando a la orilla; el barco se sacude y la tripulación pide socorro. Nadie sale herido.
//  · Gente en la playa: sombrilla, toalla y tumbonas junto a la orilla, y bañistas que nadan cerca de la costa.
//  · PUERTO + FERRY: en algunas costas hay un muelle de madera con gente esperando y, al otro lado del agua, otro muelle.
//    El ferry hace el viaje de uno a otro: al llegar atraca, baja gente, sube gente, y sale otra vez. Los puertos son siempre los mismos
//    en el mismo sitio (se deciden con el número de la celda del mapa, no al azar).
//  · SONIDO (Web Audio, sin archivos; categoría «🌊 Mar» del botón 🔊): olas, gaviotas, motor de las lanchas, bocina y campana del ferry,
//    chapoteo y música de peligro cuando un tiburón empieza a perseguir. Suena más fuerte cuanto más cerca del centro de la pantalla.
//  · VOCES (voices.js → atlasVoice): bañistas que gritan «¡Tiburón!», tripulaciones que piden socorro o saludan, gente de la playa
//    que charla, y el megáfono del ferry («¡Última llamada!»). Respetan la categoría «Gente y voces».
// Se activa y desactiva con el mismo botón de la gente (🚶), igual que rivers.js. Para probar: con zoom >= 16 junto al mar.
(function () {
  if (typeof map === 'undefined' || !map || !map.gl) return;
  const gl = map.gl, MIN_ZOOM = 16, REF_Z = 17;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAP = { boats: SMALL ? 3 : 6, swim: SMALL ? 4 : 8, beach: SMALL ? 2 : 4, sharks: SMALL ? 1 : 2, ports: SMALL ? 1 : 2 };
  const peopleBtn = document.getElementById('people-btn');
  const isOn = () => !peopleBtn || peopleBtn.getAttribute('aria-pressed') !== 'false';
  const tr = s => (window.i18n && i18n.lang !== 'es' && i18n.t) ? i18n.t(s) : s;
  const pcap = (n, min) => window.Perf ? Perf.cap(n, min) : n;           // modo ligero (ligero.js)

  const st = document.createElement('style');
  st.textContent = `
    .mr { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .mr-in { width: 100%; height: 100%; transition: opacity .5s; }
    .mr-in svg { overflow: visible; display: block; }
    .mr-bob { animation: mrbob 2.2s ease-in-out infinite alternate; }
    .mr-shake { animation: mrshake .18s linear infinite alternate; }
    @keyframes mrbob { from { transform: translateY(-.7px) rotate(-1.2deg); } to { transform: translateY(.7px) rotate(1.2deg); } }
    @keyframes mrshake { from { transform: translate(-1.6px, .8px) rotate(-5deg); } to { transform: translate(1.6px, -.8px) rotate(5deg); } }
    .mr-bub { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -4px); white-space: nowrap; pointer-events: none;
      background: #fff; color: #222; font: 700 11px/1.2 system-ui, sans-serif; padding: 2px 7px; border-radius: 10px; border: 1px solid rgba(0,0,0,.25);
      box-shadow: 0 1px 3px rgba(0,0,0,.3); animation: mrpop .25s ease-out; z-index: 3; }
    @keyframes mrpop { from { opacity: 0; transform: translate(-50%, 4px) scale(.6); } to { opacity: 1; transform: translate(-50%, -4px) scale(1); } }
    @media (prefers-reduced-motion: reduce) { .mr-bob, .mr-shake { animation: none; } }`;
  document.head.appendChild(st);
  map.createPane('mar');
  const pane = map.getPane('mar');
  pane.style.zIndex = 587; pane.style.pointerEvents = 'none';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const toLL = (x, y) => map.unproject({ x, y }, REF_Z);
  const toW = ll => map.project(ll, REF_Z);
  const dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);
  function hash3(a, b, c) { let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const SHIRTS = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703', '#06d6a0', '#ef476f', '#ffffff'];
  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

  // ---------- El agua: polígonos en píxeles de mundo (zoom 17) ----------
  let W = [], wCache = new Map(), wView = null, wDirty = true, wBuiltAt = 0;
  function inRing(r, x, y) {
    let c = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], b = r[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  const ringArea = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(s / 2); };
  function buildWater() {
    wDirty = false; wBuiltAt = performance.now();
    if (!gl.getLayer('wt-water')) { W = []; wCache.clear(); return; }
    let feats = [];
    try { feats = gl.queryRenderedFeatures({ layers: ['wt-water'] }); } catch (e) { return; }
    const out = [];
    for (const f of feats) {
      const g = f.geometry; if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) {
        if (!poly.length || poly[0].length < 4) continue;
        const rings = poly.map(r => r.map(c => { const p = toW({ lat: c[1], lng: c[0] }); return [p.x, p.y]; }));
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of rings[0]) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
        out.push({ x0, y0, x1, y1, rings, big: ringArea(rings[0]) >= 600000 });   // agua grande: mar o lago enorme (≈ 0,85 km² o más)
      }
    }
    W = out; wCache.clear();
    const b = map.getBounds().pad(0.25), a = toW({ lat: b.getNorth(), lng: b.getWest() }), c = toW({ lat: b.getSouth(), lng: b.getEast() });
    wView = { x0: a.x, y0: a.y, x1: c.x, y1: c.y };   // zona donde se conoce el agua (si no, "no hay agua" no significa "hay tierra")
  }
  function waterEntry(x, y) {
    for (const e of W) {
      if (x < e.x0 || x > e.x1 || y < e.y0 || y > e.y1) continue;
      let ins = false;
      for (const r of e.rings) if (inRing(r, x, y)) ins = !ins;
      if (ins) return e;
    }
    return null;
  }
  function inWater(x, y) {
    const k = (x >> 2) + ',' + (y >> 2);
    let v = wCache.get(k);
    if (v === undefined) { v = !!waterEntry(x, y); if (wCache.size > 20000) wCache.clear(); wCache.set(k, v); }
    return v;
  }
  const known = (x, y) => !!wView && x >= wView.x0 && x <= wView.x1 && y >= wView.y0 && y <= wView.y1;
  // ¿hay una casa (o parte de casa sin recortar) en este punto? Las parcelas comidas por el agua dejan pasar a los barcos por su parte de agua
  function covered(x, y) {
    if (typeof cfg === 'undefined' || !cfg || typeof drawn === 'undefined') return false;
    const ll = toLL(x, y), ex = drawn.get(Math.floor((ll.lng + 180) / cfg.size) + ':' + Math.floor((ll.lat + 90) / cfg.size));
    if (!ex) return false;
    const cut = typeof roadCut !== 'undefined' ? roadCut.get(ex.p.id) : null;
    if (!(cut && cut.road && cut.rest) || typeof turf === 'undefined') return true;
    try { return turf.booleanPointInPolygon([ll.lng, ll.lat], cut.rest); } catch (e) { return true; }
  }
  const sea = (x, y) => inWater(x, y) && !covered(x, y);

  // ---------- Dibujos (vistos desde arriba, mirando a la derecha; 1 px = 1 px de pantalla con el mapa a zoom 17) ----------
  const wake = (len, w) => `<path d="M2 0 L${-len} ${-w} L${-len} ${w} Z" fill="rgba(255,255,255,.42)"/>`;
  function sailSVG() {
    const hull = pick(['#ffffff', '#2f6fb0', '#c0392b', '#f5d76e']), sail = pick(['#ffffff', '#fff7e0', '#ffe5e5']);
    return `<svg width="30" height="16" viewBox="-15 -8 30 16" aria-hidden="true"><g>${wake(16, 5)}
      <path d="M-10 -3.6 Q-11 0 -10 3.6 L7 3 Q13 0 7 -3 Z" fill="${hull}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>
      <path d="M-6 -.4 L7 -7 L7 -.4 Z" fill="${sail}" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>
      <path d="M-6 .4 L5 6.5 L5 .4 Z" fill="${sail}" opacity=".92" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>
      <circle cx="-4" cy="0" r="1" fill="#555"/></g></svg>`;
  }
  function motorSVG() {
    const c = pick(['#ffffff', '#e63946', '#1d3557', '#ffb703']);
    return `<svg width="30" height="12" viewBox="-15 -6 30 12" aria-hidden="true"><g>${wake(20, 5.5)}
      <path d="M-11 -4 L6 -4 Q13 0 6 4 L-11 4 Z" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>
      <rect x="-5" y="-2.6" width="8" height="5.2" rx="1.4" fill="#e8f1f5" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>
      <rect x="-1.6" y="-1.8" width="3.2" height="3.6" rx=".8" fill="#4a90b8"/>
      <rect x="-12.4" y="-1.4" width="2" height="2.8" fill="#333"/></g></svg>`;
  }
  function fishSVG() {
    return `<svg width="28" height="12" viewBox="-14 -6 28 12" aria-hidden="true"><g>${wake(14, 4)}
      <path d="M-11 -4 L6 -4 Q12 0 6 4 L-11 4 Z" fill="#2a6f4e" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>
      <path d="M-11 -4 L6 -4 Q9 -2.6 9.4 -2 L-11 -2 Z" fill="#fff" opacity=".7"/>
      <rect x="-9" y="-2.4" width="6" height="4.8" rx="1" fill="#f4e6c1" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>
      <path d="M2 -3 L9 -5 M2 3 L9 5" stroke="#444" stroke-width=".7"/><path d="M5 -5.4 Q10 0 5 5.4" fill="none" stroke="#b8d8e8" stroke-width=".6"/></g></svg>`;
  }
  function rowSVG() {
    const shirt = pick(SHIRTS);
    return `<svg width="16" height="8" viewBox="-8 -4 16 8" aria-hidden="true"><g>${wake(8, 2.4)}
      <path d="M-6 -2.4 Q-7 0 -6 2.4 L4 2 Q8 0 4 -2 Z" fill="#a9743f" stroke="rgba(0,0,0,.4)" stroke-width=".5"/>
      <ellipse cx="-.5" cy="0" rx="2" ry="1.9" fill="${shirt}"/><circle cx="-.2" cy="0" r="1.2" fill="${pick(SKINS)}"/>
      <path d="M-1 -2 L2 -5 M-1 2 L2 5" stroke="#6a4520" stroke-width=".8" stroke-linecap="round">${reduce ? '' : '<animateTransform attributeName="transform" type="rotate" values="-14 -1 0;14 -1 0;-14 -1 0" dur=".9s" repeatCount="indefinite"/>'}</path></g></svg>`;
  }
  function sharkSVG() {
    const tail = reduce ? '' : '<animateTransform attributeName="transform" type="rotate" values="-14 -9 0;14 -9 0;-14 -9 0" dur=".9s" repeatCount="indefinite"/>';
    return `<svg width="46" height="20" viewBox="-23 -10 46 20" aria-hidden="true">
      <g opacity=".42"><path d="M-6 0 Q-2 -4.6 6 -4 Q12 -3 15 0 Q12 3 6 4 Q-2 4.6 -6 0Z" fill="#1f3b4d"/>
        <path d="M-6 0 L-14 -5 L-12 0 L-14 5Z" fill="#1f3b4d">${tail}</path></g>
      <g><path d="M-2 0 L-8 -1.6 Q-5 -1.8 -3.4 -3.6 Z" fill="none"/>
        <path d="M-3.6 .4 Q-1 -7.4 3 -8 Q2.4 -3 3.4 .4 Z" fill="#7c8a95" stroke="#4d5a64" stroke-width=".6"/>
        <path d="M3.4 .4 Q2.4 -3 3 -8" stroke="rgba(255,255,255,.45)" stroke-width=".6" fill="none"/></g>
      <ellipse cx="0" cy="0" rx="9" ry="3" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".8">${reduce ? '' : '<animate attributeName="rx" values="6;12;6" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".8;.1;.8" dur="1.4s" repeatCount="indefinite"/>'}</ellipse>
      <path d="M-4 0 L-20 -2.5 M-4 0 L-20 2.5" stroke="rgba(255,255,255,.4)" stroke-width="1"/></svg>`;
  }
  function swimSVG() {
    const cap = pick(SHIRTS), skin = pick(SKINS);
    const arm = (a, rev) => reduce ? '' : `<animateTransform attributeName="transform" type="rotate" values="${rev ? '-50;50;-50' : '50;-50;50'}" dur=".8s" repeatCount="indefinite"/>`;
    return `<svg width="14" height="10" viewBox="-7 -5 14 10" aria-hidden="true">
      <ellipse cx="0" cy="0" rx="6" ry="4.2" fill="none" stroke="rgba(255,255,255,.6)" stroke-width=".7"/>
      <line x1="0" y1="-1.6" x2="4.4" y2="-3.2" stroke="${skin}" stroke-width="1.3" stroke-linecap="round">${arm(0, false)}</line>
      <line x1="0" y1="1.6" x2="4.4" y2="3.2" stroke="${skin}" stroke-width="1.3" stroke-linecap="round">${arm(0, true)}</line>
      <ellipse cx="-.6" cy="0" rx="2.6" ry="2.3" fill="${skin}" opacity=".85"/>
      <circle cx="0" cy="0" r="1.9" fill="${cap}" stroke="rgba(0,0,0,.3)" stroke-width=".4"/></svg>`;
  }
  function beachSVG() {
    const u1 = pick(['#e63946', '#ffb703', '#2a9d8f', '#457b9d', '#9b5de5']), towel = pick(['#ffd6a5', '#bde0fe', '#ffc8dd', '#caffbf']);
    const skin = pick(SKINS), suit = pick(SHIRTS);
    const two = Math.random() < 0.5;
    const person = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="1.8" fill="${suit}"/><circle cx="${x + 3.2}" cy="${y}" r="1.4" fill="${skin}"/><ellipse cx="${x - 2.4}" cy="${y}" rx="1.8" ry="1.4" fill="${skin}"/>`;
    return `<svg width="26" height="22" viewBox="-13 -11 26 22" aria-hidden="true">
      <rect x="-9" y="-1" width="18" height="8" rx="1" fill="${towel}" stroke="rgba(0,0,0,.2)" stroke-width=".5"/>
      ${person(-2, 3)}${two ? person(-2, 6) : ''}
      <circle cx="3" cy="-5" r="6.4" fill="${u1}" stroke="rgba(0,0,0,.3)" stroke-width=".6"/>
      <path d="M3 -5 L3 -11.4 M3 -5 L9.4 -5 M3 -5 L3 1.4 M3 -5 L-3.4 -5 M3 -5 L7.5 -9.5 M3 -5 L7.5 -.5 M3 -5 L-1.5 -.5 M3 -5 L-1.5 -9.5" stroke="rgba(255,255,255,.55)" stroke-width=".7"/>
      <circle cx="3" cy="-5" r=".8" fill="#fff"/></svg>`;
  }
  function paxSVG() {
    return `<svg width="8" height="8" viewBox="-4 -4 8 8" aria-hidden="true"><ellipse cx="0" cy="0" rx="2.6" ry="3.2" fill="${pick(SHIRTS)}" stroke="rgba(0,0,0,.35)" stroke-width=".5"/><circle cx="0" cy="0" r="1.5" fill="${pick(SKINS)}"/></svg>`;
  }
  function pierSVG(len) {
    const L = Math.round(len);
    let posts = '', planks = '';
    for (let x = 4; x < L - 2; x += 5) planks += `<line x1="${x}" y1="1.2" x2="${x}" y2="9.8" stroke="rgba(60,35,10,.35)" stroke-width=".6"/>`;
    for (let x = 8; x < L; x += 20) posts += `<circle cx="${x}" cy="0" r="1.5" fill="#5b3b1c"/><circle cx="${x}" cy="11" r="1.5" fill="#5b3b1c"/>`;
    return `<svg width="${L}" height="12" viewBox="0 0 ${L} 12" aria-hidden="true">
      <rect x="0" y="1" width="${L}" height="10" rx="1" fill="#a9743f" stroke="#5b3b1c" stroke-width=".8"/>${planks}${posts}
      <circle cx="${L - 3}" cy="2.4" r="1.7" fill="#c33"/><circle cx="${L - 3}" cy="9.6" r="1.7" fill="#c33"/>
      <rect x="-9" y="-1" width="11" height="14" rx="1.5" fill="#d9d2c3" stroke="#8a826f" stroke-width=".8"/>
      <rect x="-7.4" y="1" width="8" height="3.2" fill="#e63946"/><rect x="-7.4" y="5.4" width="8" height="2" fill="#fff" opacity=".7"/></svg>`;
  }
  function ferrySVG(n) {
    let dots = '';
    const spots = [[-16, -4], [-12, 3.2], [-6, -4.4], [-1, 3.6], [4, -4], [8, 3.4], [13, -3.6], [17, 3.4]];
    spots.forEach((s, i) => { dots += `<circle class="fd" cx="${s[0]}" cy="${s[1]}" r="1.7" fill="${SHIRTS[i % SHIRTS.length]}" stroke="rgba(0,0,0,.35)" stroke-width=".4" style="opacity:${i < n ? 1 : 0}"/>`; });
    return `<svg width="70" height="26" viewBox="-35 -13 70 26" aria-hidden="true"><g>${wake(26, 8)}
      <path d="M-30 -9 L22 -9 Q34 0 22 9 L-30 9 Z" fill="#f6f6f6" stroke="#506070" stroke-width="1"/>
      <path d="M-30 5.4 L24 5.4 L22 9 L-30 9 Z" fill="#1d5fa8"/>
      <rect x="-26" y="-6.6" width="44" height="13" rx="2.4" fill="#e7edf1" stroke="#7f8f9b" stroke-width=".7"/>${dots}
      <rect x="-22" y="-5" width="32" height="10" rx="2" fill="none" stroke="#9fb0bb" stroke-width=".6"/>
      <rect x="-10" y="-3.8" width="20" height="7.6" rx="2" fill="#f7fbfd" stroke="#8aa0ae" stroke-width=".6"/>
      <g fill="#4a90b8"><rect x="-8" y="-2.4" width="3.4" height="4.8" rx=".8"/><rect x="-3" y="-2.4" width="3.4" height="4.8" rx=".8"/><rect x="2" y="-2.4" width="3.4" height="4.8" rx=".8"/></g>
      <ellipse cx="-15" cy="0" rx="3.4" ry="3" fill="#d6453d" stroke="#7a1f1a" stroke-width=".6"/><ellipse cx="-15" cy="0" rx="1.6" ry="1.4" fill="#333"/>
      <path d="M-33 0 L-30 0" stroke="#333" stroke-width="1"/><path d="M24 0 L27 0" stroke="#e63946" stroke-width="1.2"/></g></svg>`;
  }

  // ---------- Marcadores ----------
  function mkMarker(x, y, svg, w, h, cls) {
    const icon = L.divIcon({ className: 'mr', iconSize: [w, h], iconAnchor: [w / 2, h / 2], html: `<div class="mr-in ${cls || ''}" style="opacity:0">${svg}</div>` });
    return L.marker(toLL(x, y), { icon, pane: 'mar', interactive: false, keyboard: false }).addTo(map);
  }
  let S = 1, BEAR = 0, SC_EXAG = 1.5;
  function place(c, mul, rot, op) {
    c.mk.setLatLng(toLL(c.x, c.y));
    if (!c.el) { const e = c.mk.getElement(); c.el = e && e.firstChild; }
    if (!c.el) return;
    c.el.style.scale = (S * (mul || 1)).toFixed(3);
    c.el.style.rotate = ((rot - BEAR) * 180 / Math.PI).toFixed(1) + 'deg';
    c.el.style.opacity = op == null ? Math.min(1, c.age / 1.2) : op;
  }
  function bubble(c, text, ms) {
    const root = c.mk && c.mk.getElement(); if (!root) return;
    root.querySelectorAll('.mr-bub').forEach(b => b.remove());
    const b = document.createElement('span'); b.className = 'mr-bub'; b.textContent = tr(text);
    root.appendChild(b);
    setTimeout(() => b.remove(), ms || 2600);
  }

  // ---------- Sonido y voces ----------
  let ctx = null, bus = null, nbuf = null, amb = null, eng = null, nextGull = 6, nextChat = 14, tickAt = 0, waterFrac = 0;
  const audioOk = () => !document.hidden && !window.houseInside && (!window.soundMode || window.soundMode() >= 1) && (!window.soundOn || window.soundOn('mar'));
  function ac() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    bus = ctx.createGain(); bus.gain.value = 0.7; bus.connect(ctx.destination);
    return ctx;
  }
  const audioRunning = () => { if (!ac()) return false; if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} } return ctx.state === 'running'; };
  function tone(type, f0, f1, t, dur, vol, x) {
    x = x || {};
    const o = ctx.createOscillator(), g = ctx.createGain(), a = x.a || 0.01;
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
    if (x.hold) { g.gain.setValueAtTime(vol, t + dur - x.hold); }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = g;
    if (x.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = x.lp; g.connect(f); last = f; }
    o.connect(g); last.connect(bus);
    if (x.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = x.vib[0]; lg.gain.value = x.vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseBuf() { if (!nbuf) { nbuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return nbuf; }
  function burst(t, dur, vol, fc) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf(); s.loop = true; f.type = 'lowpass'; f.frequency.value = fc;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
  }
  // Cuánto se oye algo según lo cerca que está del centro de la pantalla (0 si queda fuera)
  function near(x, y) {
    const p = map.latLngToContainerPoint(toLL(x, y)), sz = map.getSize();
    if (p.x < 0 || p.y < 0 || p.x > sz.x || p.y > sz.y) return 0;
    const d = Math.hypot(p.x - sz.x / 2, p.y - sz.y / 2) / (0.62 * Math.hypot(sz.x, sz.y));
    return clamp(1 - d, 0, 1);
  }
  const SND = {
    splash: (t, v) => { burst(t, 0.45, 0.5 * v, 1100); tone('sine', 420, 140, t, 0.3, 0.35 * v); burst(t + 0.18, 0.3, 0.25 * v, 700); },
    gull: (t, v) => { for (let i = 0; i < 3; i++) { const u = t + i * 0.32; tone('triangle', 1900, 1250, u, 0.26, 0.2 * v, { vib: [38, 90] }); tone('sine', 3800, 2500, u, 0.2, 0.05 * v); } },
    horn: (t, v) => { tone('sawtooth', 98, 92, t, 1.5, 0.3 * v, { lp: 520, a: 0.08, hold: 0.5 }); tone('square', 123, 116, t, 1.5, 0.18 * v, { lp: 480, a: 0.08, hold: 0.5 }); },
    bell: (t, v) => { for (let i = 0; i < 3; i++) { tone('sine', 1760, 1760, t + i * 0.28, 0.9, 0.22 * v); tone('sine', 2637, 2637, t + i * 0.28, 0.5, 0.08 * v); } },
    // peligro: dos notas graves que se aceleran (un tiburón empieza a perseguir)
    sting: (t, v) => { [0, 0.6, 1.05, 1.4, 1.68, 1.9, 2.08].forEach((d, i) => tone('sine', i % 2 ? 87.3 : 82.4, i % 2 ? 87.3 : 82.4, t + d, 0.28, 0.5 * v, { lp: 320, a: 0.02 })); },
    ding: (t, v) => { tone('sine', 1568, 1568, t, 0.6, 0.2 * v); tone('sine', 2093, 2093, t + 0.12, 0.7, 0.16 * v); }
  };
  function sfx(name, x, y, vol) {
    if (!audioOk() || !audioRunning()) return;
    const g = x == null ? 1 : near(x, y); if (g < 0.05) return;
    try { SND[name](ctx.currentTime + 0.02, clamp(g * (vol == null ? 1 : vol), 0.05, 1.3)); } catch (e) {}
  }
  // Frase en un globo y, si se puede, dicha en voz alta (cada personaje conserva su voz)
  function say(c, text, o) {
    o = o || {};
    bubble(c, text, o.ms);
    const av = window.atlasVoice; if (!av || !audioOk()) return;
    const g = near(c.x, c.y); if (g < 0.08) return;
    if (!c.vp) c.vp = c.announcer ? { k: 'human', pitch: 0.85, rate: 0.95, vi: 0.3, chirp: 0 } : av.profile('human');
    try { av.speak(tr(text), c.vp, { force: !!o.force, vol: clamp(0.35 + g, 0.3, 1) }); } catch (e) {}
  }
  // Ambiente continuo: olas (ruido suave que sube y baja) y motor de las lanchas; se ajustan cada poco según lo que se ve
  function ambStart() {
    if (amb || !audioRunning()) return;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = noiseBuf(); s.loop = true; f.type = 'lowpass'; f.frequency.value = 650; g.gain.value = 0;
    l.frequency.value = 0.11; lg.gain.value = 260; l.connect(lg); lg.connect(f.frequency);   // el filtro sube y baja: «shhh… shhh…»
    s.connect(f); f.connect(g); g.connect(bus); s.start(); l.start();
    amb = { g, nodes: [s, l] };
    const o = ctx.createOscillator(), og = ctx.createGain(), of = ctx.createBiquadFilter(), vl = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 58; of.type = 'lowpass'; of.frequency.value = 240; og.gain.value = 0;
    vl.frequency.value = 9; vg.gain.value = 5; vl.connect(vg); vg.connect(o.frequency);
    o.connect(of); of.connect(og); og.connect(bus); o.start(); vl.start();
    eng = { g: og, nodes: [o, vl] };
  }
  function ambLevel(wave, motor) {
    if (!amb || !ctx) return;
    amb.g.gain.setTargetAtTime(wave, ctx.currentTime, 0.9);
    eng.g.gain.setTargetAtTime(motor, ctx.currentTime, 0.5);
  }
  function audioStop() { if (amb && ctx) ambLevel(0, 0); }
  const CHAT = {
    swim: ['¡Qué buena está el agua!', '¡Al agua, patos!', '¡Mira cómo nado!', '¡Qué calor, menos mal que hay mar!'],
    beach: ['¡Qué calorcito!', '¡Pásame la crema solar!', '¡Qué día de playa!', '¡Qué bien se está aquí!'],
    sail: ['¡Buen viento hoy!', '¡Ahoy, marinero!', '¡Larga la vela!'],
    motor: ['¡A toda máquina!', '¡Agárrate fuerte!', '¡Qué velocidad!'],
    fish: ['¡Pican los peces!', '¡Hoy toca pescado!', '¡Ya tengo uno!'],
    row: ['Un, dos… un, dos…', '¡Qué remos más duros!']
  };
  function audioTick(t) {
    if (t - tickAt < 1500) return; tickAt = t;
    if (!audioOk()) { audioStop(); return; }
    // fracción de la pantalla que es agua (muestreo)
    let w = 0; const N = 14;
    for (let i = 0; i < N; i++) { const p = randView(); if (inWater(p.x, p.y)) w++; }
    waterFrac = w / N;
    ambStart();
    let motor = 0;
    for (const c of ents) if (c.kind === 'boat' && (c.type === 'motor' || c.type === 'fish')) motor = Math.max(motor, near(c.x, c.y) * (c.type === 'motor' ? 1 : 0.5));
    ambLevel(0.1 * Math.sqrt(waterFrac) * clamp(map.getZoom() - 15, 0.4, 1.4), 0.05 * motor);
    nextGull -= 1.5; nextChat -= 1.5;
    if (nextGull <= 0) { nextGull = rnd(8, 18); if (waterFrac > 0.15) sfx('gull', null, null, 0.7); }
    if (nextChat <= 0) {          // alguien dice algo por su cuenta
      nextChat = rnd(10, 22);
      const pool = ents.filter(c => (c.kind === 'swim' && c.state === 'swim') || c.kind === 'beach' || c.kind === 'boat').filter(c => near(c.x, c.y) > 0.25);
      if (pool.length) { const c = pick(pool), key = c.kind === 'boat' ? c.type : c.kind; say(c, pick(CHAT[key])); }
    }
  }

  // ---------- Criaturas del mar ----------
  const ents = [];
  const count = k => ents.reduce((n, c) => n + (c.kind === k ? 1 : 0), 0);
  function killEnt(i) { const c = ents[i]; if (c.mk) map.removeLayer(c.mk); ents.splice(i, 1); }
  function randView() {
    const sz = map.getSize();
    return toW(map.containerPointToLatLng({ x: rnd(0.06, 0.94) * sz.x, y: rnd(0.1, 0.9) * sz.y }));
  }
  function clearRing(x, y, r) { for (let a = 0; a < 6.28; a += 1.05) if (!sea(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false; return true; }

  // Dirección de la orilla más cercana: marcha en varias direcciones hasta salir del agua. { ex, ey: borde del agua, nx, ny: hacia el agua }
  function shoreSearch(x, y, maxD, rng) {
    const r = rng || Math.random, a0 = r() * 6.28;
    let best = null;
    for (let k = 0; k < 12; k++) {
      const a = a0 + k * 0.5236, dx = Math.cos(a), dy = Math.sin(a);
      for (let d = 4; d <= maxD; d += 4) {
        const px = x + dx * d, py = y + dy * d;
        if (!known(px, py)) break;
        if (!inWater(px, py)) {
          if (!best || d < best.d) best = { d, ex: x + dx * (d - 2), ey: y + dy * (d - 2), nx: -dx, ny: -dy };
          break;
        }
      }
    }
    return best;
  }

  function spawnBoat() {
    const p = randView();
    if (!clearRing(p.x, p.y, 22)) return false;
    const type = pick(['sail', 'sail', 'motor', 'motor', 'fish', 'row', 'row']);
    const D = { sail: [sailSVG, 30, 16, 7, 0.5, 15], motor: [motorSVG, 30, 12, 17, 0.7, 15], fish: [fishSVG, 28, 12, 6, 0.45, 14], row: [rowSVG, 16, 8, 3, 0.8, 8] }[type];
    const h = rnd(0, 6.28);
    const c = { kind: 'boat', type, x: p.x, y: p.y, h, want: h, v: D[3] * rnd(0.8, 1.2), turn: D[4], len: D[5], age: 0, life: rnd(70, 140), tt: rnd(1, 4), chk: 0, shake: 0, el: null,
      mk: mkMarker(p.x, p.y, D[0](), D[1], D[2], 'mr-bob') };
    ents.push(c); return true;
  }
  function spawnShark() {
    for (let i = 0; i < 14; i++) {
      const p = randView(), e = waterEntry(p.x, p.y);
      if (!e || !e.big || !clearRing(p.x, p.y, 30)) continue;
      const h = rnd(0, 6.28);
      ents.push({ kind: 'shark', x: p.x, y: p.y, h, want: h, v: 8, mode: 'patrol', modeT: 0, cool: rnd(4, 10), target: null, age: 0, life: rnd(80, 160), tt: rnd(2, 5), chk: 0, look: 0, el: null,
        mk: mkMarker(p.x, p.y, sharkSVG(), 46, 20, '') });
      return true;
    }
    return false;
  }
  function spawnSwimmer() {
    for (let i = 0; i < 16; i++) {
      const p = randView(); if (!inWater(p.x, p.y)) continue;
      const sh = shoreSearch(p.x, p.y, 90); if (!sh || sh.d < 6) continue;
      const land = { x: sh.ex - sh.nx * 14, y: sh.ey - sh.ny * 14 };
      if (inWater(land.x, land.y) || covered(land.x, land.y)) continue;   // sin una franja de tierra libre no hay playa
      const d = rnd(10, 38), u = rnd(-40, 40);
      const c = { kind: 'swim', ex: sh.ex, ey: sh.ey, nx: sh.nx, ny: sh.ny, d, u, du: rnd(0, 6.28), dir: Math.random() < 0.5 ? 1 : -1, v: rnd(3.5, 6), state: 'swim', age: 0, life: rnd(60, 120), fear: 0, el: null, x: 0, y: 0, h: 0,
        mk: mkMarker(sh.ex, sh.ey, swimSVG(), 14, 10, '') };
      ents.push(c); return true;
    }
    return false;
  }
  function spawnBeach() {
    for (let i = 0; i < 16; i++) {
      const p = randView(); if (!inWater(p.x, p.y)) continue;
      const sh = shoreSearch(p.x, p.y, 110); if (!sh) continue;
      const t = { x: -sh.ny, y: sh.nx }, off = rnd(-30, 30), back = rnd(9, 18);
      const x = sh.ex - sh.nx * back + t.x * off, y = sh.ey - sh.ny * back + t.y * off;
      if (inWater(x, y) || inWater(x - sh.nx * 6, y - sh.ny * 6) || covered(x, y)) continue;
      if (typeof ents !== 'undefined' && ents.some(o => o.kind === 'beach' && dist(o.x, o.y, x, y) < 26)) continue;
      if (blockedByStreet(x, y)) continue;
      ents.push({ kind: 'beach', x, y, h: 0, age: 0, life: rnd(90, 180), el: null, mk: mkMarker(x, y, beachSVG(), 26, 22, '') });
      return true;
    }
    return false;
  }
  // Calle o edificio dibujados justo ahí (solo con el mapa estilizado): la sombrilla no se pone encima de una calle
  function blockedByStreet(x, y) {
    try {
      const ids = ['st-road', 'st-buildings'].filter(id => gl.getLayer(id) && gl.getLayoutProperty(id, 'visibility') !== 'none');
      if (!ids.length) return false;
      const pt = map.latLngToContainerPoint(toLL(x, y));
      return gl.queryRenderedFeatures([[pt.x - 4, pt.y - 4], [pt.x + 4, pt.y + 4]], { layers: ids }).length > 0;
    } catch (e) { return false; }
  }

  function steerFree(c, L) {   // si delante no hay agua libre, busca otro rumbo
    if (sea(c.x + Math.cos(c.h) * L, c.y + Math.sin(c.h) * L)) return;
    const turns = [0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4].sort(() => Math.random() - 0.5);
    for (const da of turns) {
      const a = c.h + da;
      if (sea(c.x + Math.cos(a) * L, c.y + Math.sin(a) * L) && sea(c.x + Math.cos(a) * L * 2, c.y + Math.sin(a) * L * 2)) { c.want = a; c.tt = rnd(2, 4); return; }
    }
    c.want = c.h + Math.PI; c.tt = 3;
  }
  function sharks() { return ents.filter(e => e.kind === 'shark'); }

  function updBoat(c, dt) {
    c.tt -= dt; c.chk -= dt;
    if (c.tt <= 0) { c.tt = rnd(3, 7); c.want = c.h + rnd(-0.7, 0.7); }
    if (c.chk <= 0) { c.chk = 0.25; steerFree(c, c.len * 1.4 + 8); }
    c.h += clamp(angDiff(c.want, c.h), -c.turn * dt, c.turn * dt);
    c.x += Math.cos(c.h) * c.v * dt; c.y += Math.sin(c.h) * c.v * dt;
    if (c.shake > 0) { c.shake -= dt; if (c.shake <= 0 && c.el) c.el.classList.remove('mr-shake'); }
  }
  function hitBoat(b) {
    b.shake = 1.4; if (b.el) b.el.classList.add('mr-shake');
    sfx('splash', b.x, b.y);
    say(b, pick(['¡Socorro, un tiburón!', '¡Un tiburón! ¡Cuidado!', '¡Nos ataca un tiburón!']), { force: true, ms: 2600 });
  }
  function updShark(c, dt) {
    c.cool -= dt; c.tt -= dt; c.chk -= dt; c.look -= dt;
    if (c.mode === 'retreat') { c.modeT -= dt; if (c.modeT <= 0) c.mode = 'patrol'; }
    if (c.mode !== 'retreat' && c.look <= 0) {          // busca presas: bañistas primero, luego barcos
      c.look = 0.6; c.target = null;
      if (c.cool <= 0) {
        let best = 1e9;
        for (const o of ents) {
          if (o.kind !== 'swim' && o.kind !== 'boat') continue;
          if (o.kind === 'swim' && o.state !== 'swim') continue;
          const d = dist(c.x, c.y, o.x, o.y), range = o.kind === 'swim' ? 320 : 230;
          if (d < range && d < best) { best = d; c.target = o; }
        }
      }
      const prev = c.mode;
      c.mode = c.mode === 'retreat' ? 'retreat' : (c.target ? 'hunt' : 'patrol');
      if (prev !== 'hunt' && c.mode === 'hunt') sfx('sting', c.x, c.y, 0.9);   // empieza la persecución: música de peligro
    }
    if (c.mode === 'hunt' && c.target && ents.includes(c.target)) {
      const t = c.target, ang = Math.atan2(t.y - c.y, t.x - c.x), d = dist(c.x, c.y, t.x, t.y);
      c.want = ang; c.v = Math.min(24, 11 + d * 0.06);
      if (d < (t.kind === 'boat' ? 16 : 11)) {            // ¡ataque!
        if (t.kind === 'swim') scare(t, true); else hitBoat(t);
        c.mode = 'retreat'; c.modeT = rnd(4, 6); c.cool = rnd(14, 26); c.want = ang + Math.PI + rnd(-0.6, 0.6); c.target = null;
      }
    } else if (c.mode === 'patrol') {
      c.v = 8; if (c.tt <= 0) { c.tt = rnd(3, 6); c.want = c.h + rnd(-1, 1); }
    } else if (c.mode === 'retreat') c.v = 14;
    if (c.chk <= 0) { c.chk = 0.25; steerFree(c, 22); }
    c.h += clamp(angDiff(c.want, c.h), -(c.mode === 'hunt' ? 2.2 : 1) * dt, (c.mode === 'hunt' ? 2.2 : 1) * dt);
    c.x += Math.cos(c.h) * c.v * dt; c.y += Math.sin(c.h) * c.v * dt;
  }
  function scare(s, attacked) {
    if (s.state !== 'swim') return;
    s.state = 'flee'; s.v = 17;
    if (attacked) sfx('splash', s.x, s.y);
    say(s, attacked ? pick(['¡Tiburón! ¡Socorro!', '¡Aaah, un tiburón!', '¡Socorro, que me muerde!']) : pick(['¡Un tiburón! ¡Fuera del agua!', '¡Tiburón, tiburón!']), { force: attacked, ms: 2600 });
  }
  function updSwim(c, dt) {
    const t = { x: -c.ny, y: c.nx };
    if (c.state === 'swim') {
      c.u += c.dir * c.v * dt; c.du += dt * 0.5;
      if (Math.abs(c.u) > 48) { c.dir = -c.dir; c.u = clamp(c.u, -48, 48); }
      c.d += (clamp(24 + Math.sin(c.du) * 14, 8, 40) - c.d) * Math.min(1, dt * 0.6);
      c.fear -= dt;
      if (c.fear <= 0) { c.fear = 0.5; for (const s of sharks()) if (dist(c.x, c.y, s.x, s.y) < 130) { scare(c, false); break; } }
    } else if (c.state === 'flee') {
      c.d -= c.v * dt; c.u += Math.sin(c.age * 9) * 4 * dt;
      if (c.d <= 0) { c.state = 'out'; c.outT = 0; say(c, pick(['¡Uf, me salvé!', '¡Qué susto, madre mía!']), { ms: 2400 }); }
    } else if (c.state === 'out') { c.outT += dt; if (c.outT > 3 && c.life > c.age + 1.5) c.life = c.age + 1.5; }
    c.x = c.ex + c.nx * c.d + t.x * c.u; c.y = c.ey + c.ny * c.d + t.y * c.u;
    c.h = c.state === 'flee' ? Math.atan2(-c.ny, -c.nx) : Math.atan2(t.y * c.dir, t.x * c.dir);
  }

  // ---------- Puertos con ferry ----------
  const ports = new Map(), tried = new Map(), CELL = 0.01;
  const PIER_L = [44, 58], FERRY_V = 12, WALK = 9;
  const pierLen = L => L + 10;
  function pierGeom(S, n, L) {            // S: borde del agua, n: hacia el agua
    const p = { x: -n.y, y: n.x };
    const tip = { x: S.x + n.x * L, y: S.y + n.y * L };
    return { S, n, p, L, tip,
      mid: { x: S.x + n.x * (L / 2 - 4), y: S.y + n.y * (L / 2 - 4) },
      base: { x: S.x - n.x * 11, y: S.y - n.y * 11 },
      walkTip: { x: tip.x - n.x * 6, y: tip.y - n.y * 6 },
      rot: Math.atan2(n.y, n.x) };
  }
  function dockPos(pg, side) { return { x: pg.tip.x + pg.n.x * 14 + pg.p.x * side * 21, y: pg.tip.y + pg.n.y * 14 + pg.p.y * side * 21 }; }

  function buildPort(rng, cell) {
    for (let i = 0; i < 60; i++) {
      const x = cell.x0 + rng() * (cell.x1 - cell.x0), y = cell.y0 + rng() * (cell.y1 - cell.y0);
      if (!known(x, y) || !inWater(x, y)) continue;
      const sh = shoreSearch(x, y, 140, rng); if (!sh) continue;
      const n = { x: sh.nx, y: sh.ny }, S = { x: sh.ex, y: sh.ey }, L = PIER_L[0] + rng() * (PIER_L[1] - PIER_L[0]);
      const A = pierGeom(S, n, L);
      let ok = !covered(A.base.x, A.base.y) && !inWater(A.base.x, A.base.y) && !inWater(S.x - n.x * 22, S.y - n.y * 22);   // detrás del muelle tiene que haber tierra libre
      if (!ok) continue;
      for (const k of [0, 10, 20, 34, 50, 70]) if (!inWater(A.tip.x + n.x * k, A.tip.y + n.y * k)) ok = false;
      if (!ok) continue;
      const side = rng() < 0.5 ? 1 : -1, dA = dockPos(A, side);
      if (!inWater(dA.x, dA.y) || !inWater(dA.x + n.x * 30, dA.y + n.y * 30) || !inWater(dA.x - n.x * 22, dA.y - n.y * 22)) continue;
      // Orilla de enfrente: se marcha desde el muelle en varios rumbos hasta salir del agua (entre 130 y 900 px, y dentro de la zona conocida)
      const a0 = Math.atan2(n.y, n.x), cands = [];
      for (let k = -5; k <= 5; k++) {
        const a = a0 + k * 0.3, dx = Math.cos(a), dy = Math.sin(a);
        let d = 8, hit = null;
        for (; d <= 900; d += 6) {
          const px = dA.x + dx * d, py = dA.y + dy * d;
          if (!known(px, py)) break;
          if (!inWater(px, py)) { hit = { x: dA.x + dx * (d - 3), y: dA.y + dy * (d - 3), dx, dy, d }; break; }
        }
        if (hit && hit.d >= 130) cands.push(hit);
      }
      if (!cands.length) continue;
      const h = cands[Math.floor(rng() * cands.length)], n2 = { x: -h.dx, y: -h.dy };
      const B = pierGeom({ x: h.x, y: h.y }, n2, PIER_L[0] + rng() * (PIER_L[1] - PIER_L[0]));
      if (covered(B.base.x, B.base.y) || inWater(B.base.x, B.base.y)) continue;
      const side2 = rng() < 0.5 ? 1 : -1, dB = dockPos(B, side2);
      if (!inWater(dB.x, dB.y)) continue;
      return { A, B, dockA: dA, dockB: dB };
    }
    return null;
  }
  function cellRect(cx, cy) {
    const a = toW({ lat: cy * CELL, lng: cx * CELL }), b = toW({ lat: (cy + 1) * CELL, lng: (cx + 1) * CELL });
    return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) };
  }
  function scanPorts() {
    if (!W.length) return;
    const b = gl.getBounds(), now = performance.now();
    let budget = 3;
    for (let cx = Math.floor(b.getWest() / CELL); cx <= Math.floor(b.getEast() / CELL); cx++) {
      for (let cy = Math.floor(b.getSouth() / CELL); cy <= Math.floor(b.getNorth() / CELL); cy++) {
        const key = cx + ',' + cy;
        if (ports.has(key)) continue;
        const tt = tried.get(key) || { n: 0, at: 0, done: false };
        if (tt.done || tt.n >= 6 || now - tt.at < 15000 || budget <= 0) continue;
        if (hash3(cx, cy, 9) / 4294967296 > 0.4) { tried.set(key, { n: 9, at: now, done: true }); continue; }   // 4 de cada 10 celdas con costa tienen puerto
        budget--; tt.n++; tt.at = now; tried.set(key, tt);
        const r = buildPort(mulberry(hash3(cx, cy, 100 + tt.n)), cellRect(cx, cy));
        if (r) ports.set(key, { key, ...r, active: false, seen: now, pax: [], waiters: [] });
      }
    }
  }
  function activatePort(P) {
    P.active = true; P.seenAt = performance.now();
    const A = P.A, B = P.B;
    P.mkA = mkMarker(A.mid.x, A.mid.y, pierSVG(pierLen(A.L)), pierLen(A.L), 12, '');
    P.mkB = mkMarker(B.mid.x, B.mid.y, pierSVG(pierLen(B.L)), pierLen(B.L), 12, '');
    P.elA = null; P.elB = null; P.age = 0;
    const atA = Math.random() < 0.5;
    const from = atA ? P.dockA : P.dockB, to = atA ? P.dockB : P.dockA;
    P.f = { st: 'dock', at: atA ? 'A' : 'B', t: rnd(0, 6), x: from.x, y: from.y, h: Math.atan2(to.y - from.y, to.x - from.x), hWant: Math.atan2(to.y - from.y, to.x - from.x), deckN: 3, age: 0, el: null, did: { alight: false, board: false },
      mk: mkMarker(from.x, from.y, ferrySVG(3), 70, 26, 'mr-bob') };
    for (const pg of [A, B]) for (let i = 0; i < 2; i++) newWaiter(P, pg);
  }
  function newWaiter(P, pg) {
    const t = rnd(-8, 8), x = pg.base.x - pg.n.x * rnd(2, 9) + pg.p.x * t, y = pg.base.y - pg.n.y * rnd(2, 9) + pg.p.y * t;
    const w = { kind: 'wait', pg, x, y, h: 0, age: 0, el: null, mk: mkMarker(x, y, paxSVG(), 8, 8, '') };
    P.waiters.push(w);
  }
  function deactivatePort(P) {
    P.active = false;
    for (const m of [P.mkA, P.mkB, P.f && P.f.mk]) if (m) map.removeLayer(m);
    for (const q of P.pax.concat(P.waiters)) if (q.mk) map.removeLayer(q.mk);
    P.pax = []; P.waiters = []; P.mkA = P.mkB = null; P.f = null;
  }
  function walker(P, pts, onDone, fade) {
    const q = { kind: 'pax', x: pts[0].x, y: pts[0].y, h: 0, age: 0, pts, i: 1, onDone, fade, el: null, mk: mkMarker(pts[0].x, pts[0].y, paxSVG(), 8, 8, '') };
    P.pax.push(q); return q;
  }
  function setDeck(P, n) {
    const f = P.f; f.deckN = clamp(n, 0, 8);
    if (f.el) f.el.querySelectorAll('.fd').forEach((d, i) => { d.style.opacity = i < f.deckN ? 1 : 0; });
  }
  function dockAt(P) { return P.f.at === 'A' ? { pg: P.A, d: P.dockA } : { pg: P.B, d: P.dockB }; }
  function updPort(P, dt) {
    const f = P.f; if (!f) return;
    f.age += dt; P.age += dt;
    if (!f.el) { const e = f.mk.getElement(); f.el = e && e.firstChild; if (f.el) setDeck(P, f.deckN); }
    if (!P.elA) { const e = P.mkA.getElement(); P.elA = e && e.firstChild; }
    if (!P.elB) { const e = P.mkB.getElement(); P.elB = e && e.firstChild; }
    for (const [el, pg] of [[P.elA, P.A], [P.elB, P.B]]) if (el) {
      el.style.scale = S.toFixed(3); el.style.rotate = ((pg.rot - BEAR) * 180 / Math.PI).toFixed(1) + 'deg'; el.style.opacity = Math.min(1, P.age / 1);
    }
    if (f.st === 'dock') {
      f.t += dt;
      f.h += clamp(angDiff(f.hWant, f.h), -0.8 * dt, 0.8 * dt);
      const { pg, d } = dockAt(P);
      f.announcer = true;
      if (!f.did.hello && f.t > 0.2) { f.did.hello = true; sfx('horn', f.x, f.y, 0.9); setTimeout(() => { if (P.active && P.f) sfx('bell', P.f.x, P.f.y); }, 1700); say(f, 'Atención, pasajeros: hemos llegado a puerto', { ms: 3200 }); }
      if (!f.did.alight && f.t > 1) {          // bajan del ferry hacia la tierra
        f.did.alight = true;
        const n = Math.min(f.deckN, 2 + Math.floor(Math.random() * 3));
        for (let i = 0; i < n; i++) setTimeout(() => {
          if (!P.active || !P.f) return;
          const away = { x: pg.base.x - pg.n.x * rnd(16, 30) + pg.p.x * rnd(-14, 14), y: pg.base.y - pg.n.y * rnd(16, 30) + pg.p.y * rnd(-14, 14) };
          walker(P, [{ x: d.x + rnd(-8, 8), y: d.y + rnd(-2, 2) }, pg.walkTip, pg.base, away], null, true);
          setDeck(P, P.f.deckN - 1);
        }, i * 900 * rnd(0.8, 1.3));
      }
      if (!f.did.board && f.t > 6) {           // suben los que esperaban en el muelle
        f.did.board = true; sfx('ding', f.x, f.y);
        const n = Math.min(P.waiters.filter(w => w.pg === pg).length, 2 + Math.floor(Math.random() * 3));
        let k = 0;
        for (const w of P.waiters.filter(w => w.pg === pg).slice(0, n)) {
          setTimeout(() => {
            if (!P.active || !P.f) return;
            const i = P.waiters.indexOf(w); if (i < 0) return;
            P.waiters.splice(i, 1); if (w.mk) map.removeLayer(w.mk);
            walker(P, [{ x: w.x, y: w.y }, pg.base, pg.walkTip, { x: d.x + rnd(-8, 8), y: d.y + rnd(-2, 2) }], () => setDeck(P, P.f.deckN + 1), false);
          }, (k++) * 1000 * rnd(0.8, 1.3));
        }
        for (let i = 0; i < n; i++) setTimeout(() => { if (P.active && P.f) newWaiter(P, pg); }, 7000 + i * 1500);   // llegan otros a la cola
      }
      if (!f.did.last && f.t > 12) { f.did.last = true; say(f, '¡Última llamada! El ferry zarpa en un minuto', { ms: 3200 }); }
      if (f.t > 16) { f.st = 'sail'; f.t = 0; f.did = { alight: false, board: false }; sfx('horn', f.x, f.y); say(f, '¡Zarpamos! Buen viaje', { ms: 2600 }); }
    } else if (f.st === 'sail') {
      const to = f.at === 'A' ? P.dockB : P.dockA, d = dist(f.x, f.y, to.x, to.y);
      const ang = Math.atan2(to.y - f.y, to.x - f.x);
      f.h += clamp(angDiff(ang, f.h), -0.9 * dt, 0.9 * dt);
      const v = Math.min(FERRY_V, 2.5 + d * 0.22);
      f.x += Math.cos(f.h) * v * dt; f.y += Math.sin(f.h) * v * dt;
      if (d < 2.5) { f.at = f.at === 'A' ? 'B' : 'A'; f.st = 'dock'; f.t = 0; const back = f.at === 'A' ? P.dockB : P.dockA; f.hWant = Math.atan2(back.y - to.y, back.x - to.x); }
    }
    place(f, 1, f.h, Math.min(1, f.age / 1));
    for (let i = P.pax.length - 1; i >= 0; i--) {   // gente andando por el muelle y por la pasarela
      const q = P.pax[i]; q.age += dt;
      const tgt = q.pts[q.i];
      if (!tgt) { if (q.onDone) q.onDone(); map.removeLayer(q.mk); P.pax.splice(i, 1); continue; }
      const d = dist(q.x, q.y, tgt.x, tgt.y), st = WALK * dt;
      if (d <= st) { q.x = tgt.x; q.y = tgt.y; q.i++; } else { q.x += (tgt.x - q.x) / d * st; q.y += (tgt.y - q.y) / d * st; }
      const end = q.fade && q.i >= q.pts.length - 1 ? clamp(dist(q.x, q.y, q.pts[q.pts.length - 1].x, q.pts[q.pts.length - 1].y) / 12, 0, 1) : 1;
      place(q, 1.15, 0, Math.min(1, q.age / 0.4) * end);
    }
    for (const w of P.waiters) place(w, 1.15, 0, Math.min(1, (w.age += dt) / 1));
  }

  // ---------- Bucle principal ----------
  let zooming = false, moved = false, last = performance.now(), running = false, nextSpawn = 1, portScanAt = 0;
  map.on('zoomstart', () => { zooming = true; });
  map.on('zoomend', () => { zooming = false; wDirty = true; if (map.getZoom() < MIN_ZOOM) clearAll(); });
  gl.on('moveend', () => { wDirty = true; });
  gl.on('idle', () => { if (map.getZoom() >= MIN_ZOOM) wDirty = true; });   // cuando acaban de cargar las teselas se vuelve a leer el agua
  function clearAll() {
    while (ents.length) killEnt(0);
    for (const P of ports.values()) if (P.active) deactivatePort(P);
  }
  window.addEventListener('perfchange', () => {
    for (const [kind, max] of [['boat', pcap(CAP.boats, 1)], ['swim', pcap(CAP.swim, 1)], ['beach', pcap(CAP.beach, 0)], ['shark', pcap(CAP.sharks, 1)]]) {
      for (let i = ents.length - 1; i >= 0 && count(kind) > max; i--) if (ents[i].kind === kind) killEnt(i);
    }
  });

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    if (!isOn()) { if (running) { running = false; clearAll(); audioStop(); } return; }
    running = true;
    if (document.hidden || zooming) return;
    const z = map.getZoom();
    if (z < MIN_ZOOM) { audioStop(); return; }
    if (wDirty && (t - wBuiltAt > 700) && !(gl.isMoving && gl.isMoving())) buildWater();
    if (!W.length) return;
    S = clamp(Math.pow(2, z - REF_Z) * SC_EXAG, 0.3, 3.2); BEAR = gl.getBearing() * Math.PI / 180;

    nextSpawn -= dt;
    if (nextSpawn <= 0) {
      const wants = [];
      if (count('boat') < pcap(CAP.boats, 1)) wants.push(spawnBoat);
      if (count('swim') < pcap(CAP.swim, 1)) wants.push(spawnSwimmer);
      if (count('beach') < pcap(CAP.beach, 0)) wants.push(spawnBeach);
      if (count('shark') < pcap(CAP.sharks, 1) && (count('swim') + count('boat') > 1) && Math.random() < 0.5) wants.push(spawnShark);
      nextSpawn = wants.length && pick(wants)() ? rnd(0.8, 2.2) : 2.5;
    }
    if (t - portScanAt > 3000) { portScanAt = t; scanPorts(); }
    audioTick(t);
    // Puertos: se montan los que están cerca de la pantalla y se desmontan al alejarse
    const view = map.getBounds().pad(0.3);
    let nActive = 0;
    for (const P of ports.values()) {
      const c = toLL(P.dockA.x, P.dockA.y), c2 = toLL(P.dockB.x, P.dockB.y), near = view.contains(c) || view.contains(c2);
      if (P.active) { if (!near && performance.now() - P.seenAt > 5000) { deactivatePort(P); continue; } if (near) P.seenAt = performance.now(); nActive++; }
    }
    for (const P of ports.values()) {
      if (nActive >= pcap(CAP.ports, 1)) break;
      if (!P.active && (view.contains(toLL(P.dockA.x, P.dockA.y)) || view.contains(toLL(P.dockB.x, P.dockB.y)))) { activatePort(P); nActive++; }
    }
    for (const P of ports.values()) if (P.active) updPort(P, dt);

    const vb = map.getBounds().pad(0.4);
    for (let i = ents.length - 1; i >= 0; i--) {
      const c = ents[i];
      c.age += dt;
      if (c.kind === 'boat') updBoat(c, dt);
      else if (c.kind === 'shark') updShark(c, dt);
      else if (c.kind === 'swim') updSwim(c, dt);
      const ll = toLL(c.x, c.y);
      if (c.age > c.life || (c.age > 3 && !vb.contains(ll))) { killEnt(i); continue; }
      const fade = Math.min(1, c.age / 1.2, (c.life - c.age) / 1.5) * (c.kind === 'shark' ? 1 : 1);
      place(c, c.kind === 'swim' ? 1.15 : c.kind === 'beach' ? 1.1 : 1, c.kind === 'beach' ? 0 : c.h, fade);
    }
  }
  requestAnimationFrame(frame);
  window.marDebug = { ents, ports, get water() { return W.length; } };
})();
