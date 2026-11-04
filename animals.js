'use strict';
// Animales por el mapa:
//  - Perros y gatos que pasean por las aceras (siguen las calles reales, igual que la gente de people.js).
//  - Un león que de vez en cuando aparece, persigue a un peatón y se lo "come" (el peatón desaparece con una nube y el león dice ¡ÑAM!).
//    Es dibujo infantil, sin sangre. Cuando se harta (3 peatones) se marcha.
// Se activan y desactivan con el mismo botón de la gente (🚶).
// Para probar sin esperar, en la consola: spawnLion()
(function () {
  if (typeof map === 'undefined' || !map) return;
  const MIN_ZOOM = 16, REF_Z = 17;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const MAX_PETS = SMALL ? 4 : 7;
  const LION_SPEED = 56;                 // px de pantalla por segundo (la gente va a 14-22)
  const LION_EVERY = [50, 90];           // segundos entre apariciones
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
    .an-say { position: absolute; left: 50%; top: -14px; transform: translateX(-50%); white-space: nowrap; font: 800 10px system-ui, sans-serif;
      background: #fff; color: #c92a2a; padding: 1px 5px; border-radius: 99px; box-shadow: 0 1px 3px rgba(0,0,0,.35); opacity: 0; transition: opacity .15s; }
    .an-in.say .an-say { opacity: 1; }
    .an-puff { font-size: 22px; line-height: 1; animation: anpuff .8s ease-out forwards; }
    @keyframes anbob { from { transform: translateY(0); } to { transform: translateY(-1.4px); } }
    @keyframes anpuff { from { transform: scale(.5); opacity: 1; } to { transform: scale(1.7) translateY(-8px); opacity: 0; } }
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
  function lionSVG() {
    const tan = '#d9a441', mane = '#8a4b1b';
    return `<svg width="42" height="30" viewBox="0 0 42 30" aria-hidden="true">
      <ellipse cx="21" cy="27.5" rx="15" ry="2" fill="rgba(0,0,0,.28)"/>
      <path d="M7 15 Q0 12 2 5" stroke="${tan}" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="2" cy="5" r="2.3" fill="${mane}"/>
      ${leg(10, 19, 27, '#b8862e', 3, 26, .42, false)}${leg(13.5, 19, 27, '#b8862e', 3, 26, .42, true)}
      ${leg(26, 19, 27, tan, 3, 26, .42, true)}${leg(29.5, 19, 27, tan, 3, 26, .42, false)}
      <ellipse cx="19" cy="16" rx="13" ry="6.8" fill="${tan}"/>
      <circle cx="30" cy="13.5" r="9" fill="${mane}"/>
      <circle cx="32" cy="14.5" r="5.6" fill="#e6b95c"/>
      <circle cx="27.6" cy="8" r="2" fill="${mane}"/><circle cx="35.6" cy="8.4" r="2" fill="${mane}"/>
      <circle cx="33.8" cy="13" r="1" fill="#222"/><ellipse cx="36.8" cy="15.4" rx="1.5" ry="1.1" fill="#3b2a20"/>
      <path d="M33.6 17.6 Q35.4 19 37 17.6" stroke="#3b2a20" stroke-width=".8" fill="none"/></svg>`;
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

  // ---------- El león ----------
  let lion = null, nextLion = rnd(12, 25);

  function puffAt(x, y) {
    const mk = L.marker(toLL(x, y), { icon: L.divIcon({ className: 'an', iconSize: [24, 24], iconAnchor: [12, 16], html: '<div class="an-puff">💨</div>' }),
      pane: 'animals', interactive: false, keyboard: false }).addTo(map);
    setTimeout(() => map.removeLayer(mk), 900);
  }
  function preyList() {
    const ws = window.peopleWalkers || [];
    const view = map.getBounds().pad(0.1);
    return ws.filter(w => w.age > 3 && w.mk && view.contains(map.unproject(L.point(w.x, w.y), REF_Z)));
  }
  function nearestPrey(from) {
    let best = null, bd = 1e12;
    for (const w of preyList()) { const d = (w.x - from.x) ** 2 + (w.y - from.y) ** 2; if (d < bd) { bd = d; best = w; } }
    return best;
  }
  function spawnLion() {
    if (lion) return false;
    const z = map.getZoom(); if (z < MIN_ZOOM) return false;
    const preys = preyList(); if (!preys.length) return false;
    const target = pick(preys), scale = Math.pow(2, z - REF_Z), a = rnd(0, Math.PI * 2), r = 190 / scale;
    const icon = L.divIcon({ className: 'an', iconSize: [42, 30], iconAnchor: [21, 27],
      html: `<div class="an-in" style="opacity:0">${lionSVG()}<span class="an-say">¡ÑAM!</span></div>` });
    lion = { x: target.x + Math.cos(a) * r, y: target.y + Math.sin(a) * r, target, state: 'chase', t: 0, eaten: 0, age: 0, el: null, flip: null,
      fade: 0, mk: null, leaveTo: null };
    lion.mk = L.marker(toLL(lion.x, lion.y), { icon, pane: 'animals', interactive: false, keyboard: false }).addTo(map);
    return true;
  }
  window.spawnLion = spawnLion;
  function removeLion() { if (lion) { map.removeLayer(lion.mk); lion = null; } nextLion = rnd(LION_EVERY[0], LION_EVERY[1]); }

  function updateLion(dt, scale) {
    const L_ = lion; L_.age += dt;
    if (!L_.el) { const e = L_.mk.getElement(); L_.el = e && e.firstChild; }
    const sp = LION_SPEED / scale, catchD = 13 / scale;
    let moving = false;
    if (L_.state === 'chase') {
      if (!L_.target || (window.peopleWalkers || []).indexOf(L_.target) < 0) L_.target = nearestPrey(L_);
      if (!L_.target || L_.age > 50 || L_.eaten >= 3) { L_.state = 'leave'; }
      else {
        const dx = L_.target.x - L_.x, dy = L_.target.y - L_.y, d = Math.hypot(dx, dy) || 1;
        if (d < catchD) {
          puffAt(L_.target.x, L_.target.y);
          if (window.peopleKill) window.peopleKill(L_.target);
          L_.target = null; L_.eaten++; L_.state = 'eat'; L_.t = 1.4;
          if (L_.el) L_.el.classList.add('say', 'still');
        } else {
          const step = Math.min(sp * dt, d);
          L_.x += dx / d * step; L_.y += dy / d * step; moving = true;
          if (Math.abs(dx) > 1 / scale && L_.el) { const f = dx < 0; if (f !== L_.flip) { L_.flip = f; L_.el.classList.toggle('flip', f); } }
        }
      }
    } else if (L_.state === 'eat') {
      L_.t -= dt;
      if (L_.t <= 0) { if (L_.el) L_.el.classList.remove('say', 'still'); L_.state = 'chase'; }
    }
    if (L_.state === 'leave') {
      if (!L_.leaveTo) { const a = rnd(0, Math.PI * 2); L_.leaveTo = { dx: Math.cos(a), dy: Math.sin(a) }; L_.fade = 1.6; }
      L_.x += L_.leaveTo.dx * sp * 0.8 * dt; L_.y += L_.leaveTo.dy * sp * 0.8 * dt; moving = true;
      if (L_.el) { const f = L_.leaveTo.dx < 0; if (f !== L_.flip) { L_.flip = f; L_.el.classList.toggle('flip', f); } }
      L_.fade -= dt;
      if (L_.fade <= 0) return removeLion();
    }
    L_.mk.setLatLng(toLL(L_.x, L_.y));
    if (L_.el) {
      L_.el.style.opacity = L_.state === 'leave' ? Math.max(0, L_.fade / 1.6) : Math.min(1, L_.age / 0.8);
      if (L_.state !== 'eat') L_.el.classList.toggle('still', !moving);
    }
  }

  // ---------- Bucle ----------
  let last = performance.now(), nextPet = rnd(1, 3), running = false;
  function clearAll() { while (pets.length) removePet(0); removeLion(); }
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
      if (z >= MIN_ZOOM && pets.length < MAX_PETS) ok = spawnPet();
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
    // León
    if (lion) updateLion(dt, scale);
    else if (z >= MIN_ZOOM) { nextLion -= dt; if (nextLion <= 0) { if (!spawnLion()) nextLion = 8; } }
  }
  requestAnimationFrame(frame);
})();
