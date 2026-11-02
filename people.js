'use strict';
// Gente caminando por el mapa de vez en cuando (figuras SVG ancladas a coordenadas del mapa).
(function () {
  if (typeof map === 'undefined' || !map) return;
  const KEY = 'peopleOn', MIN_ZOOM = 16, REF_Z = 17, MAX = 12;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('people-btn');
  let on = true;
  try { const s = localStorage.getItem(KEY); if (s !== null) on = s === '1'; } catch (e) {}

  const st = document.createElement('style');
  st.textContent = `
    .pw { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .pw-in { width: 20px; height: 30px; animation: pwbob .36s ease-in-out infinite alternate; transition: opacity .3s; }
    .pw-in svg { overflow: visible; }
    .pw-in.flip svg { transform: scaleX(-1); }
    .pw-in .umb { display: none; }
    .pw-in.rain .umb { display: inline; }
    @keyframes pwbob { from { transform: translateY(0); } to { transform: translateY(-1.6px); } }
    @media (prefers-reduced-motion: reduce) { .pw-in { animation: none; } }`;
  document.head.appendChild(st);
  map.createPane('people');
  const pane = map.getPane('people');
  pane.style.zIndex = 590; pane.style.pointerEvents = 'none';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const SHIRTS = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703', '#06d6a0', '#ef476f'];
  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const PANTS = ['#2b2d42', '#3a3a3a', '#1d3557', '#5c4033'];

  function swing(a, cx, cy, dur, rev) {
    if (reduce) return '';
    const v = rev ? `${a} ${cx} ${cy};${-a} ${cx} ${cy};${a} ${cx} ${cy}` : `${-a} ${cx} ${cy};${a} ${cx} ${cy};${-a} ${cx} ${cy}`;
    return `<animateTransform attributeName="transform" type="rotate" values="${v}" dur="${dur}s" repeatCount="indefinite"/>`;
  }
  function personSVG(shirt, skin, pants, umb) {
    const d = rnd(0.62, 0.78).toFixed(2);
    const limb = (x1, y1, y2, col, w, a, cy, rev) =>
      `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round">${swing(a, x1, cy, d, rev)}</line>`;
    return `<svg width="20" height="30" viewBox="-2 -9 20 36" aria-hidden="true">
      <ellipse cx="8" cy="26" rx="5" ry="1.5" fill="rgba(0,0,0,.25)"/>
      ${limb(7, 16, 25, pants, 3, 28, 16, false)}${limb(9, 16, 25, pants, 3, 28, 16, true)}
      <rect x="4.5" y="7.5" width="7" height="9.5" rx="3" fill="${shirt}"/>
      ${limb(8, 9, 16, skin, 2.2, 24, 9, true)}${limb(8, 9, 16, skin, 2.2, 24, 9, false)}
      <circle cx="8" cy="4" r="3.3" fill="${skin}"/>
      <g class="umb"${umb ? ' style="display:inline"' : ''}><path d="M-3 1.5Q8 -11 19 1.5Z" fill="${pick(['#e63946', '#1d3557', '#2a9d8f', '#6a4c93', '#f4a261', '#ffb703'])}"/><line x1="8" y1="1.5" x2="8" y2="9" stroke="#444" stroke-width=".8"/></g>
    </svg>`;
  }

  window.personSVG = personSVG;   // lo reutilizan los pasajeros de los taxis (vehicles.js)

  const walkers = [];
  let zooming = false;

  function spawn() {
    const size = map.getSize(), z = map.getZoom();
    // entra por un borde de la pantalla y cruza hacia el lado contrario
    const side = Math.floor(Math.random() * 4);
    const along = (len) => rnd(0.1, 0.9) * len;
    let a, b;
    if (side === 0) { a = [0, along(size.y)]; b = [size.x, along(size.y)]; }
    else if (side === 1) { a = [size.x, along(size.y)]; b = [0, along(size.y)]; }
    else if (side === 2) { a = [along(size.x), 0]; b = [along(size.x), size.y]; }
    else { a = [along(size.x), size.y]; b = [along(size.x), 0]; }
    const p0 = map.project(map.containerPointToLatLng(a), REF_Z), p1 = map.project(map.containerPointToLatLng(b), REF_Z);
    const icon = L.divIcon({
      className: 'pw', iconSize: [20, 30], iconAnchor: [10, 28],
      html: `<div class="pw-in" style="opacity:0">${personSVG(pick(SHIRTS), pick(SKINS), pick(PANTS), false)}</div>`
    });
    const mk = L.marker(map.unproject(p0, REF_Z), { icon, pane: 'people', interactive: false, keyboard: false }).addTo(map);
    walkers.push({
      mk, x: p0.x, y: p0.y, h: Math.atan2(p1.y - p0.y, p1.x - p0.x), age: 0, life: rnd(30, 55),
      v: rnd(12, 18), turn: rnd(-0.25, 0.25), el: null, flip: null, rain: false
    });
  }
  function remove(i) { map.removeLayer(walkers[i].mk); walkers.splice(i, 1); }
  function clearAll() { while (walkers.length) remove(0); }

  map.on('zoomstart', () => { zooming = true; });
  map.on('zoomend', () => { zooming = false; if (map.getZoom() < MIN_ZOOM) clearAll(); });

  let last = performance.now(), nextSpawn = rnd(1, 3), running = false;
  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    if (!document.hidden && !zooming) {
      const z = map.getZoom(), scale = Math.pow(2, z - REF_Z);
      // aparece gente a menudo (algo menos si hay tormenta fuerte)
      nextSpawn -= dt;
      const storm = window.weatherIntensity ? window.weatherIntensity() : 0;
      const raining = storm > 0.25;                             // con lluvia, todos salen con paraguas
      if (nextSpawn <= 0) {
        if (z >= MIN_ZOOM && walkers.length < (storm > 0.6 ? 8 : MAX)) spawn();
        nextSpawn = rnd(1.5, 5) * (storm > 0.6 ? 1.4 : 1);
      }
      const view = map.getBounds().pad(0.4);
      for (let i = walkers.length - 1; i >= 0; i--) {
        const w = walkers[i];
        w.age += dt;
        w.h += w.turn * dt + rnd(-0.4, 0.4) * dt;                 // pequeño paseo errático
        w.turn += rnd(-0.3, 0.3) * dt;
        const step = w.v * dt / scale;                            // velocidad constante en pantalla
        w.x += Math.cos(w.h) * step; w.y += Math.sin(w.h) * step;
        const ll = map.unproject(L.point(w.x, w.y), REF_Z);
        if (w.age > w.life || (w.age > 3 && !view.contains(ll))) { remove(i); continue; }
        w.mk.setLatLng(ll);
        if (!w.el) { const e = w.mk.getElement(); w.el = e && e.firstChild; }
        if (w.el) {
          w.el.style.opacity = Math.max(0, Math.min(1, w.age / 1.5, (w.life - w.age) / 1.5));
          if (raining !== w.rain) { w.rain = raining; w.el.classList.toggle('rain', raining); }   // saca/guarda el paraguas
          const f = Math.cos(w.h) < 0;
          if (f !== w.flip) { w.flip = f; w.el.classList.toggle('flip', f); }
        }
      }
    }
    requestAnimationFrame(frame);
  }
  function apply() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.opacity = on ? '1' : '.55'; btn.title = on ? 'Gente caminando: activada' : 'Gente caminando: desactivada'; }
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!on) { running = false; clearAll(); }
  }
  if (btn) btn.onclick = function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) nextSpawn = 1;       // al activarlo sale alguien enseguida
    apply();
  };
  apply();
})();
