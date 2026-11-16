'use strict';
// Gente caminando por las aceras: siguen las calles reales (las mismas que usan los coches, ver vehicles.js)
// y van por un lado de la calzada, en los dos sentidos. Salen muchos más que antes.
(function () {
  if (typeof map === 'undefined' || !map) return;
  const KEY = 'peopleOn', MIN_ZOOM = 16, REF_Z = 17;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const MAX = SMALL ? 22 : 36;                  // peatones a la vez
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('people-btn');
  let on = true;

  const st = document.createElement('style');
  st.textContent = `
    .pwk { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .pw-in { width: 20px; height: 30px; transform-origin: 10px 28px; animation: pwbob .36s ease-in-out infinite alternate; transition: opacity .3s; }
    .pw-in svg { overflow: visible; }
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
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const SHIRTS = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703', '#06d6a0', '#ef476f'];
  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const PANTS = ['#2b2d42', '#3a3a3a', '#1d3557', '#5c4033'];

  function swing(a, cx, cy, dur, rev) {
    if (reduce) return '';
    const v = rev ? `${a} ${cx} ${cy};${-a} ${cx} ${cy};${a} ${cx} ${cy}` : `${-a} ${cx} ${cy};${a} ${cx} ${cy};${-a} ${cx} ${cy}`;
    return `<animateTransform attributeName="transform" type="rotate" values="${v}" dur="${dur}s" repeatCount="indefinite"/>`;
  }
  const HAIRS = ['#2b1b10', '#4a2f1b', '#8b5a2b', '#d8b25a', '#151515', '#9aa0a6', '#b5392b'];
  // Persona VISTA DE FRENTE (nunca de perfil): cara con ojos y sonrisa, pelo, cuello en V, mangas, manos y zapatos; brazos y piernas se balancean al andar.
  function personSVG(shirt, skin, pants, umb) {
    const d = rnd(0.62, 0.78).toFixed(2), hair = pick(HAIRS);
    const limb = (x1, y1, y2, col, w, a, cy, rev, tip, tipW, tipY) =>
      `<g>${swing(a, x1, cy, d, rev)}<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>${tip ? `<line x1="${x1}" y1="${tipY}" x2="${x1}" y2="${y2}" stroke="${tip}" stroke-width="${tipW}" stroke-linecap="round"/>` : ''}</g>`;
    return `<svg width="20" height="30" viewBox="-2 -9 20 36" aria-hidden="true">
      <ellipse cx="8" cy="26" rx="5" ry="1.5" fill="rgba(0,0,0,.25)"/>
      ${limb(6.6, 16, 25, pants, 3, 28, 16, false, '#222', 3.5, 23.6)}${limb(9.4, 16, 25, pants, 3, 28, 16, true, '#222', 3.5, 23.6)}
      <rect x="4.5" y="7.5" width="7" height="9.5" rx="3" fill="${shirt}"/>
      <rect x="4.9" y="8.5" width="1.6" height="7" rx=".8" fill="rgba(255,255,255,.18)"/>
      <path d="M6.6 7.6 Q8 10.4 9.4 7.6Z" fill="${skin}"/>
      ${limb(4.1, 9, 14.6, shirt, 2.4, 24, 9, true, skin, 2.1, 14.4)}${limb(11.9, 9, 14.6, shirt, 2.4, 24, 9, false, skin, 2.1, 14.4)}
      <rect x="7" y="5.6" width="2" height="2.4" fill="${skin}"/>
      <circle cx="8" cy="3.6" r="3.5" fill="${skin}"/>
      <path d="M4.5 3.4 Q4.4 -0.4 8 -0.5 Q11.6 -0.4 11.5 3.4 Q9.6 1.4 8 1.6 Q6.4 1.4 4.5 3.4Z" fill="${hair}"/>
      <circle cx="6.7" cy="4.1" r=".5" fill="#222"/><circle cx="9.3" cy="4.1" r=".5" fill="#222"/>
      <path d="M6.9 5.6 Q8 6.5 9.1 5.6" stroke="#8a3b3b" stroke-width=".5" fill="none" stroke-linecap="round"/>
      <g class="umb"${umb ? ' style="display:inline"' : ''}><path d="M-3 1.5Q8 -11 19 1.5Z" fill="${pick(['#e63946', '#1d3557', '#2a9d8f', '#6a4c93', '#f4a261', '#ffb703'])}"/><line x1="8" y1="1.5" x2="8" y2="9" stroke="#444" stroke-width=".8"/></g>
    </svg>`;
  }

  window.personSVG = personSVG;   // lo reutilizan los pasajeros de los taxis (vehicles.js)

  let FP = 1;                                     // tamaño de la persona según el ancho de la calle (ver sizes() en mapshim.js)
  const walkers = [];
  window.peopleWalkers = walkers;
  window.peopleKill = w => { const i = walkers.indexOf(w); if (i >= 0) remove(i); };
  let zooming = false;

  // Coloca al peatón sobre su trayecto (centro de la calle) según la distancia recorrida w.s
  function place(w) {
    const P = w.path;
    while (w.seg < P.pts.length - 2 && P.cum[w.seg + 1] <= w.s) w.seg++;
    const a = P.pts[w.seg], b = P.pts[w.seg + 1], len = (P.cum[w.seg + 1] - P.cum[w.seg]) || 1;
    const t = clamp((w.s - P.cum[w.seg]) / len, 0, 1);
    w.cx = a.x + (b.x - a.x) * t; w.cy = a.y + (b.y - a.y) * t;
    w.th = Math.atan2(b.y - a.y, b.x - a.x);
  }
  // Lo separa del eje de la calle hacia la acera (derecha o izquierda del sentido de la marcha).
  // La distancia sale del ancho con el que el mapa dibuja ESA calle ahora mismo: justo fuera de la calzada, a cualquier zoom.
  function sidewalk(w, scale, dt) {
    const cl = w.path.cl, m = map.roadMetrics(cl ? cl[Math.min(w.seg + 1, cl.length - 1)] : 'minor');
    const target = m.curb + (2.5 + w.off * 0.35) * FP;
    w.o = w.o == null || !dt ? target : w.o + clamp(target - w.o, -30 * dt, 30 * dt);   // cambia suave al pasar de una calle a otra / al hacer zoom
    const o = w.o / scale * w.side;
    w.x = w.cx - Math.sin(w.h) * o; w.y = w.cy + Math.cos(w.h) * o;
  }

  function spawn() {
    // Sin calles cerca (mar, campo…) no hay aceras: no sale nadie
    const rr = window.roadRoute && window.roadRoute({ inside: true, len: 700, minLen: 140 });
    if (!rr || !rr.starts || !rr.starts.length) return false;
    const P = rr.path, scale = Math.pow(2, map.getZoom() - REF_Z);
    FP = map.sizes ? map.sizes().fp : 1;
    const icon = L.divIcon({
      className: 'pwk', iconSize: [20, 30], iconAnchor: [10, 28],
      html: `<div class="pw-in" style="opacity:0;scale:${FP.toFixed(3)}">${personSVG(pick(SHIRTS), pick(SKINS), pick(PANTS), false)}</div>`
    });
    const w = {
      mk: null, path: P, seg: 0, s: pick(rr.starts), side: Math.random() < 0.5 ? 1 : -1, off: rnd(0, 8),
      v: rnd(14, 22) * FP, fp: FP, o: null, h: 0, x: 0, y: 0, cx: 0, cy: 0, th: 0, age: 0, life: rnd(35, 70), el: null, flip: null, rain: false
    };
    place(w); w.h = w.th; sidewalk(w, scale, 0);
    w.mk = L.marker(map.unproject(L.point(w.x, w.y), REF_Z), { icon, pane: 'people', interactive: false, keyboard: false }).addTo(map);
    walkers.push(w);
    return true;
  }
  function remove(i) { map.removeLayer(walkers[i].mk); walkers.splice(i, 1); }
  function clearAll() { while (walkers.length) remove(0); }
  const pcap = (n, min) => window.Perf ? Perf.cap(n, min) : n;           // modo ligero (ligero.js)
  window.addEventListener('perfchange', () => { const c = pcap(MAX, 4); while (walkers.length > c) remove(walkers.length - 1); });

  map.on('zoomstart', () => { zooming = true; });
  map.on('zoomend', () => { zooming = false; if (map.getZoom() < MIN_ZOOM) clearAll(); });

  let last = performance.now(), nextSpawn = rnd(0.5, 1.5), running = false;
  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    if (!document.hidden && !zooming) {
      const z = map.getZoom(), scale = Math.pow(2, z - REF_Z);
      FP = map.sizes ? map.sizes().fp : 1;
      if (map.setRoads) map.setRoads(z >= MIN_ZOOM, 'p');      // las aceras salen de las calles reales
      // Sale gente a menudo (algo menos si hay tormenta fuerte); al principio llegan rápido hasta llenar las aceras
      nextSpawn -= dt;
      const storm = window.weatherIntensity ? window.weatherIntensity() : 0;
      const raining = storm > 0.25;                             // con lluvia, todos salen con paraguas
      if (nextSpawn <= 0) {
        const dm = window.CityLife ? window.CityLife.mult() : 1;       // más gente en el centro, menos en las afueras (ciudad.js)
        const cap = Math.round(pcap(MAX, 4) * dm * (storm > 0.6 ? 0.65 : 1));
        let ok = true;
        if (z >= MIN_ZOOM && walkers.length < cap) ok = spawn();
        nextSpawn = !ok ? 1 : (walkers.length < cap * 0.4 ? rnd(0.25, 0.6) : rnd(0.4, 1.1)) * (storm > 0.6 ? 1.5 : 1);
      }
      const view = map.getBounds().pad(0.4);
      for (let i = walkers.length - 1; i >= 0; i--) {
        const w = walkers[i];
        w.age += dt;
        if (!(window.Xings && window.Xings.pedHold(w, scale))) w.s += w.v / w.fp * FP * dt / scale;   // espera en el paso de peatones con los coches en verde                    // velocidad en pantalla: crece y encoge con el tamaño de la persona
        if (w.s >= w.path.total || w.age > w.life) { remove(i); continue; }
        place(w);
        w.h += clamp(angDiff(w.th, w.h), -5 * dt, 5 * dt);      // gira suave en las esquinas
        sidewalk(w, scale, dt);
        const ll = map.unproject(L.point(w.x, w.y), REF_Z);
        if (w.age > 3 && !view.contains(ll)) { remove(i); continue; }
        w.mk.setLatLng(ll);
        // El muñeco del jugador está fijo en el centro de la pantalla y anda a su paso: los peatones que pasan por su sitio se quedaban «pegados» a él y se iban con él.
        // Mientras están donde está su cuerpo se esconden (con su globo de charla), y vuelven a verse en cuanto lo dejan atrás.
        const doll = window.playerWalker && window.playerWalker.el && window.playerWalker.el();
        let near = false;
        if (doll && doll.isConnected && doll.style.opacity !== '0') {
          const sz = map.getSize(), pt = map.latLngToContainerPoint(ll), dx = pt.x - sz.x / 2, dy = pt.y - sz.y / 2;
          near = Math.abs(dx) < 48 && dy > -100 && dy < 34;
        }
        w.near = near;
        if (w.hid !== near) { const me = w.mk.getElement(); if (me) { me.style.visibility = near ? 'hidden' : ''; w.hid = near; } }
        if (!w.el) { const e = w.mk.getElement(); w.el = e && e.firstChild; }
        if (w.el) {
          if (w.fpA !== FP) { w.el.style.scale = FP.toFixed(3); w.fpA = FP; }
          const toEnd = (w.path.total - w.s) * scale / 40;
          w.el.style.opacity = Math.max(0, Math.min(1, w.age / 1.2, toEnd, (w.life - w.age) / 1.5));
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
    if (!on) { running = false; clearAll(); if (map.setRoads) map.setRoads(false, 'p'); }
  }
  if (btn) btn.onclick = function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) nextSpawn = 0.3;       // al activarlo sale alguien enseguida
    apply();
  };
  apply();
})();
