'use strict';
// Animales por el mapa:
//  - Perros y gatos que pasean por las aceras (siguen las calles reales, igual que la gente de people.js).
// Se activan y desactivan con el mismo botón de la gente (🚶).
(function () {
  if (typeof map === 'undefined' || !map) return;
  const MIN_ZOOM = 16, REF_Z = 17;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const MAX_PETS = SMALL ? 4 : 7;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const peopleBtn = document.getElementById('people-btn');
  const isOn = () => !peopleBtn || peopleBtn.getAttribute('aria-pressed') !== 'false';

  const st = document.createElement('style');
  st.textContent = `
    .an { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .an-in { position: relative; width: 100%; height: 100%; transition: opacity .3s; animation: anbob .3s ease-in-out infinite alternate; }
    .an-in svg { overflow: visible; }
    .an-in.flip svg { transform: scaleX(-1); }
    .an-in.still { animation: none; }
    @keyframes anbob { from { transform: translateY(0); } to { transform: translateY(-1.4px); } }
    @media (prefers-reduced-motion: reduce) { .an-in { animation: none; } }`;
  document.head.appendChild(st);
  map.createPane('animals');
  const pane = map.getPane('animals');
  pane.style.zIndex = 592; pane.style.pointerEvents = 'none';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const toLL = (x, y) => map.unproject(L.point(x, y), REF_Z);

  function swing(a, cx, cy, dur, rev) {
    if (reduce) return '';
    const v = rev ? `${a} ${cx} ${cy};${-a} ${cx} ${cy};${a} ${cx} ${cy}` : `${-a} ${cx} ${cy};${a} ${cx} ${cy};${-a} ${cx} ${cy}`;
    return `<animateTransform attributeName="transform" type="rotate" values="${v}" dur="${dur}s" repeatCount="indefinite"/>`;
  }
  const leg = (x, y1, y2, col, w, a, dur, rev) =>
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round">${swing(a, x, y1, dur, rev)}</line>`;

  // ---------- Dibujos (vistos de lado, mirando a la derecha) ----------
  function dogSVG() {
    const c = pick(['#b5773a', '#8b5a2b', '#e8d3a8', '#4a4a4a', '#d9a441']), d = '#00000033';
    return `<svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
      <ellipse cx="12" cy="16.5" rx="9" ry="1.4" fill="rgba(0,0,0,.25)"/>
      <path d="M5 7 Q1 4 3 1" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      ${leg(7, 10, 16, c, 1.8, 28, .5, false)}${leg(9.5, 10, 16, c, 1.8, 28, .5, true)}${leg(14, 10, 16, c, 1.8, 28, .5, true)}${leg(16.5, 10, 16, c, 1.8, 28, .5, false)}
      <ellipse cx="12" cy="9" rx="7.5" ry="3.8" fill="${c}"/>
      <circle cx="19" cy="6.5" r="3.4" fill="${c}"/>
      <ellipse cx="22.4" cy="8" rx="2.2" ry="1.6" fill="#f3e6cf"/><circle cx="24" cy="7.4" r=".9" fill="#222"/>
      <ellipse cx="17.2" cy="5" rx="1.3" ry="2.6" fill="${c}" stroke="${d}" stroke-width=".6" transform="rotate(15 17.2 5)"/>
      <circle cx="20.4" cy="5.6" r=".7" fill="#222"/></svg>`;
  }
  function catSVG() {
    const c = pick(['#8e8e8e', '#f4a261', '#2b2b2b', '#e8e8e8', '#b5773a']);
    return `<svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
      <ellipse cx="12" cy="16.5" rx="8" ry="1.3" fill="rgba(0,0,0,.25)"/>
      <path d="M5 9 Q-1 8 1 1" stroke="${c}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      ${leg(7.5, 11, 16, c, 1.5, 30, .45, false)}${leg(10, 11, 16, c, 1.5, 30, .45, true)}${leg(14, 11, 16, c, 1.5, 30, .45, true)}${leg(16.5, 11, 16, c, 1.5, 30, .45, false)}
      <ellipse cx="12" cy="10" rx="7" ry="3.3" fill="${c}"/>
      <circle cx="19" cy="7.5" r="3.1" fill="${c}"/>
      <path d="M16.6 5.6 L17 2 L19 4.6Z M19.4 4.6 L21.4 2 L21.8 5.6Z" fill="${c}"/>
      <circle cx="18" cy="7.2" r=".6" fill="#222"/><circle cx="20.4" cy="7.2" r=".6" fill="#222"/>
      <circle cx="19.2" cy="8.4" r=".5" fill="#e07a8a"/></svg>`;
  }
  // ---------- Trayectos por las aceras (igual que people.js) ----------
  function place(w) {
    const P = w.path;
    while (w.seg < P.pts.length - 2 && P.cum[w.seg + 1] <= w.s) w.seg++;
    const a = P.pts[w.seg], b = P.pts[w.seg + 1], len = (P.cum[w.seg + 1] - P.cum[w.seg]) || 1;
    const t = clamp((w.s - P.cum[w.seg]) / len, 0, 1);
    w.cx = a.x + (b.x - a.x) * t; w.cy = a.y + (b.y - a.y) * t;
    w.th = Math.atan2(b.y - a.y, b.x - a.x);
  }
  // Igual que las personas (people.js): justo fuera de la calzada, según el ancho con el que se dibuja ESA calle ahora mismo
  let FP = 1;
  function sidewalk(w, scale, dt) {
    FP = map.sizes ? map.sizes().fp : 1;
    const cl = w.path.cl, m = map.roadMetrics(cl ? cl[Math.min(w.seg + 1, cl.length - 1)] : 'minor');
    const target = m.curb + (2.5 + w.off * 0.3) * FP;
    w.o = w.o == null || !dt ? target : w.o + clamp(target - w.o, -30 * dt, 30 * dt);
    const o = w.o / scale * w.side;
    w.x = w.cx - Math.sin(w.h) * o; w.y = w.cy + Math.cos(w.h) * o;
  }

  const pets = [];
  let zooming = false;

  function spawnPet() {
    const rr = window.roadRoute && window.roadRoute({ inside: true, len: 600, minLen: 120 });
    if (!rr || !rr.starts || !rr.starts.length) return false;
    const P = rr.path, scale = Math.pow(2, map.getZoom() - REF_Z);
    const svg = Math.random() < 0.5 ? dogSVG() : catSVG();
    const icon = L.divIcon({ className: 'an', iconSize: [26, 18], iconAnchor: [13, 16], html: `<div class="an-in" style="opacity:0">${svg}</div>` });
    const w = { mk: null, path: P, seg: 0, s: pick(rr.starts), side: Math.random() < 0.5 ? 1 : -1, off: rnd(10, 22),
      v: rnd(13, 22), h: 0, x: 0, y: 0, cx: 0, cy: 0, th: 0, age: 0, life: rnd(40, 80), el: null, flip: null };
    place(w); w.h = w.th; sidewalk(w, scale, 0);
    w.mk = L.marker(toLL(w.x, w.y), { icon, pane: 'animals', interactive: false, keyboard: false }).addTo(map);
    pets.push(w);
    return true;
  }
  function removePet(i) { map.removeLayer(pets[i].mk); pets.splice(i, 1); }

  // ---------- Bucle ----------
  let last = performance.now(), nextPet = rnd(1, 3), running = false;
  function clearAll() { while (pets.length) removePet(0); }
  const pcap = (n, min) => window.Perf ? Perf.cap(n, min) : n;           // modo ligero (ligero.js)
  window.addEventListener('perfchange', () => { const c = pcap(MAX_PETS, 1); while (pets.length > c) removePet(pets.length - 1); });
  map.on('zoomstart', () => { zooming = true; });
  map.on('zoomend', () => { zooming = false; if (map.getZoom() < MIN_ZOOM) clearAll(); });

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    const on = isOn();
    if (!on) { if (running) { running = false; clearAll(); if (map.setRoads) map.setRoads(false, 'a'); } return; }
    running = true;
    if (document.hidden || zooming) return;
    const z = map.getZoom(), scale = Math.pow(2, z - REF_Z);
    if (map.setRoads) map.setRoads(z >= MIN_ZOOM, 'a');
    // Perros y gatos
    nextPet -= dt;
    if (nextPet <= 0) {
      let ok = true;
      if (z >= MIN_ZOOM && pets.length < pcap(MAX_PETS, 1)) ok = spawnPet();
      nextPet = !ok ? 2 : rnd(2, 6);
    }
    const view = map.getBounds().pad(0.4);
    for (let i = pets.length - 1; i >= 0; i--) {
      const w = pets[i];
      w.age += dt; w.s += w.v * FP * dt / scale;
      if (w.s >= w.path.total || w.age > w.life) { removePet(i); continue; }
      place(w);
      w.h += clamp(angDiff(w.th, w.h), -5 * dt, 5 * dt);
      sidewalk(w, scale, dt);
      const ll = toLL(w.x, w.y);
      if (w.age > 3 && !view.contains(ll)) { removePet(i); continue; }
      w.mk.setLatLng(ll);
      if (!w.el) { const e = w.mk.getElement(); w.el = e && e.firstChild; }
      if (w.el) {
        if (w.fpA !== FP) { w.el.style.scale = FP.toFixed(3); w.fpA = FP; }
        const toEnd = (w.path.total - w.s) * scale / 40;
        w.el.style.opacity = Math.max(0, Math.min(1, w.age / 1.2, toEnd, (w.life - w.age) / 1.5));
        const f = Math.cos(w.h) < 0;
        if (f !== w.flip) { w.flip = f; w.el.classList.toggle('flip', f); }
      }
    }
  }
  requestAnimationFrame(frame);
})();
