'use strict';
// Semáforos y pasos de peatones en los cruces de las calles reales (las mismas que usan coches y gente).
//  - En cada cruce (3 o más calles) hay un paso de cebra y una línea de parada por calle, y un semáforo para los coches que llegan por ella.
//  - Dos fases de 20 s: calles principales (verde 7 s, ámbar 2 s, rojo) y transversales desfasadas 10 s; entre fases hay 1 s de rojo para todos.
//  - vehicles.js (followLimit → stopRem): los coches frenan ante la línea de parada con rojo (y con ámbar si aún pueden parar). Las emergencias no paran.
//  - people.js (pedHold): los peatones esperan en el bordillo y cruzan solo cuando los coches de esa calle tienen el rojo.
//  - Los pasos de cebra van en gris oscuro (las calles del mapa son blancas) y cada uno lleva dos balizas ámbar intermitentes de precaución, una en cada bordillo.
// Solo se dibujan los cruces más cercanos al centro de la pantalla (hasta 14; 8 en móvil) y con zoom >= 16,5.
(function () {
  if (typeof map === 'undefined' || !map || !window.roadGraph) return;
  const REF_Z = 17, MIN_ZOOM = 16.5, CYCLE = 20, ZEBRA = '#363c48';   // ZEBRA: color del paso de cebra y de la línea de parada
  const SMALL = Math.min(innerWidth, innerHeight) < 600, MAX_J = SMALL ? 8 : 14;
  const RANK = { primary: 5, secondary: 4, tertiary: 3, minor: 2, service: 1 };   // las autovías no llevan semáforos
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  const st = document.createElement('style');
  st.textContent = `
    .xg { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .xg-r { position: absolute; left: 0; top: 0; width: 0; height: 0; }
    .xg-r > div { position: absolute; }
    .xg-l { border-radius: 50%; box-sizing: border-box; border: 1.5px solid #2b2b2b; background: #777; transition: background .2s, box-shadow .2s; }
    .xg-l.g { background: #3df57f; box-shadow: 0 0 8px 2px rgba(61,245,127,.7); }
    .xg-l.y { background: #ffc533; box-shadow: 0 0 8px 2px rgba(255,197,51,.7); }
    .xg-l.r { background: #ff3b3b; box-shadow: 0 0 8px 2px rgba(255,59,59,.7); }
    /* Baliza ámbar intermitente de precaución en cada paso de peatones (una a cada lado, parpadean alternadas) */
    .xg-c { border-radius: 50%; box-sizing: border-box; border: 1.5px solid #2b2b2b; background: #ffb300; box-shadow: 0 0 7px 3px rgba(255,170,0,.8); will-change: opacity; animation: xgBlinkA 1s steps(1, end) infinite; }
    .xg-c.b { animation-name: xgBlinkB; }
    @keyframes xgBlinkA { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: .15; } }
    @keyframes xgBlinkB { 0%, 49.9% { opacity: .15; } 50%, 100% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .xg-c, .xg-c.b { animation: none; opacity: .9; } }`;
  document.head.appendChild(st);

  const active = new Map();     // clave del cruce -> { C, br: [{ th, u, cls, grp, half, xs, els }], mk, off, fp, fv }

  // 'g' verde, 'y' ámbar, 'r' rojo para el grupo grp (0 = calle principal y la opuesta, 1 = transversales)
  const phase = (J, grp, now) => (now + J.off + (grp ? 10 : 0)) % CYCLE;
  function state(J, grp, now) { const p = phase(J, grp, now); return p < 7 ? 'g' : p < 9 ? 'y' : 'r'; }

  function layout(J) {
    const z = map.sizes(), fp = z.fp;
    J.fp = fp; J.fv = z.fv;
    const dz = Math.max(...J.br.map(b => map.roadMetrics(b.cls).curb)) + 4 * fp;   // el paso cae justo en la acera por la que camina la gente
    J.br.forEach(b => {
      const half = map.roadMetrics(b.cls).half, depth = Math.max(8 * fp, half * 0.75), t = Math.max(1.4, half / 4.5);
      b.half = half; b.xs = dz + depth / 2 + 3 * fp;
      const set = (el, l, tp, w, h) => { const s = el.style; s.left = l + 'px'; s.top = tp + 'px'; s.width = w + 'px'; s.height = h + 'px'; };
      set(b.els.z, dz - depth / 2, -half, depth, 2 * half);                    // paso de cebra: franjas paralelas a la calle
      b.els.z.style.background = `repeating-linear-gradient(to bottom,${ZEBRA} 0 ${t}px,transparent ${t}px ${2 * t}px)`;   // las calles son blancas: el paso va en gris oscuro para que se vea
      set(b.els.s, b.xs, -half, Math.max(1.6, half * 0.16), half);             // línea de parada en el carril de llegada
      b.els.s.style.background = ZEBRA;
      const ls = Math.max(5, 7 * fp);
      set(b.els.l, b.xs + 1, -half - 3 * fp - ls, ls, ls);                     // semáforo en el bordillo, a la derecha de quien llega
      const cs = Math.max(6, 8 * fp);
      set(b.els.c1, dz - cs / 2, -half - 3 * fp - cs, cs, cs);                 // balizas ámbar intermitentes: una en cada bordillo, a la altura del paso
      set(b.els.c2, dz - cs / 2, half + 3 * fp, cs, cs);
    });
    J.k = layoutKey();
  }
  const layoutKey = () => Math.round(map.roadMetrics('minor').half * 10) + ':' + Math.round(map.sizes().fp * 100);
  function paint(J, now) {
    J.br.forEach(b => { const s = state(J, b.grp, now); if (b.cur !== s) { b.cur = s; b.els.l.className = 'xg-l ' + s; } });
  }

  function add(c) {
    for (const J of active.values()) if (Math.hypot(J.C.x - c.C.x, J.C.y - c.C.y) < 40) return;   // sin cruces pegados (autovías de doble calzada…)
    const br = c.br.sort((a, b) => RANK[b.cls] - RANK[a.cls]).slice(0, 4);
    br.forEach((b, i) => { b.u = { x: Math.cos(b.th), y: Math.sin(b.th) }; b.grp = i === 0 || Math.abs(angDiff(b.th, br[0].th + Math.PI)) < 0.8 ? 0 : 1; });
    const html = br.map(b => `<div class="xg-r" style="transform:rotate(${b.th.toFixed(4)}rad)"><div class="xg-z"></div><div class="xg-s"></div><div class="xg-l"></div><div class="xg-c"></div><div class="xg-c b"></div></div>`).join('');
    const mk = L.marker(map.unproject(c.C, REF_Z), { icon: L.divIcon({ className: 'xg', iconSize: [0, 0], iconAnchor: [0, 0], html }), pane: 'pads', interactive: false, keyboard: false }).addTo(map);
    const J = { key: c.key, C: c.C, br, mk, off: hash(c.key) / 4294967296 * CYCLE, k: '', fp: 1, fv: 1 };
    const rs = mk.getElement().querySelectorAll('.xg-r');
    br.forEach((b, i) => { const r = rs[i]; b.els = { z: r.children[0], s: r.children[1], l: r.children[2], c1: r.children[3], c2: r.children[4] }; });
    active.set(c.key, J); layout(J); paint(J, Date.now() / 1000);
  }
  function removeJ(k) { const J = active.get(k); if (J) { map.removeLayer(J.mk); active.delete(k); } }
  function clearAll() { Array.from(active.keys()).forEach(removeJ); }

  function scan() {
    if (document.hidden) return;
    if (map.getZoom() < MIN_ZOOM) { clearAll(); return; }
    if (map.setRoads) map.setRoads(true, 'x');
    const g = window.roadGraph(); if (!g) return;
    const size = map.getSize(), cx = size.x / 2, cy = size.y / 2;
    const scr = p => map.latLngToContainerPoint(map.unproject(p, REF_Z));
    active.forEach((J, k) => { const c = scr(J.C); if (c.x < -140 || c.y < -140 || c.x > size.x + 140 || c.y > size.y + 140) removeJ(k); });
    if (active.size >= MAX_J) return;
    const cand = [];
    g.ends.forEach(arr => {
      if (arr.length < 3) return;
      let sx = 0, sy = 0; const br = [];
      arr.forEach(e => {
        const pts = e.ln.pts, p = e.end ? pts[pts.length - 1] : pts[0];
        sx += p.x; sy += p.y;
        let q = null;
        for (let i = 1; i < pts.length && !q; i++) { const r = e.end ? pts[pts.length - 1 - i] : pts[i]; if (Math.hypot(r.x - p.x, r.y - p.y) >= 3) q = r; }
        if (!q || !RANK[e.ln.cls]) return;
        const th = Math.atan2(q.y - p.y, q.x - p.x), dup = br.find(b => Math.abs(angDiff(b.th, th)) < 0.4);
        if (dup) { if (RANK[e.ln.cls] > RANK[dup.cls]) dup.cls = e.ln.cls; return; }
        br.push({ th, cls: e.ln.cls });
      });
      if (br.length < 3) return;
      const C = { x: sx / arr.length, y: sy / arr.length }, key = Math.round(C.x / 4) + ',' + Math.round(C.y / 4);
      if (active.has(key)) return;
      const c = scr(C);
      if (c.x < 24 || c.y < 24 || c.x > size.x - 24 || c.y > size.y - 24) return;
      cand.push({ key, C, br, d: Math.hypot(c.x - cx, c.y - cy) });
    });
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand) { if (active.size >= MAX_J) break; add(c); }
  }

  // Distancia (px de pantalla) que le queda al vehículo v hasta una línea de parada con semáforo cerrado; Infinity si nada le obliga a parar.
  function stopRem(v, scale) {
    if (!active.size) return Infinity;
    const ch = Math.cos(v.h), sh = Math.sin(v.h), now = Date.now() / 1000;
    let best = Infinity;
    active.forEach(J => {
      const rx = (J.C.x - v.x) * scale, ry = (J.C.y - v.y) * scale, a = rx * ch + ry * sh;
      if (a <= 0 || a > 240) return;
      const lat = Math.abs(-rx * sh + ry * ch);
      J.br.forEach(b => {
        if (Math.cos(v.h - b.th - Math.PI) < 0.8 || lat > b.half * 2 + 8) return;       // no viene por esta calle hacia el cruce
        const s = state(J, b.grp, now);
        if (s === 'g') return;
        const rem = a - b.xs - v.K.L / 2 * J.fv;
        if (rem < -3 || (s === 'y' && rem < 26)) return;                                 // ya pasó la línea / no llega a parar con el ámbar
        if (rem < best) best = rem;
      });
    });
    return best;
  }

  // ¿Debe esperar el peatón w antes de cruzar la calle que desemboca en el cruce? (cruza con el rojo de los coches)
  function pedHold(w, scale) {
    if (!active.size) return false;
    const ch = Math.cos(w.th), sh = Math.sin(w.th), rx = -sh * w.side, ry = ch * w.side, now = Date.now() / 1000;
    let hold = false;
    active.forEach(J => {
      const px = (J.C.x - w.cx) * scale, py = (J.C.y - w.cy) * scale, a = px * ch + py * sh;
      if (a < 0 || a > 50 || Math.abs(-px * sh + py * ch) > 40) return;
      J.br.forEach(b => {
        if (Math.abs(b.u.x * ch + b.u.y * sh) > 0.55 || b.u.x * rx + b.u.y * ry < 0.6) return;   // solo calles transversales de SU lado
        const aw = b.half + 4 * J.fp;                                                          // punto de espera: justo antes de la calzada
        if (a > aw + 3 || a < aw - 1.5) return;
        const p = phase(J, b.grp, now);
        if (!(p >= 9 && p < 17)) hold = true;                                                   // rojo para los coches y quedan >= 3 s
      });
    });
    return hold;
  }

  window.Xings = { stopRem, pedHold };
  setInterval(scan, 1200);
  setInterval(() => {
    if (!active.size || document.hidden) return;
    const now = Date.now() / 1000, k = layoutKey();
    active.forEach(J => { if (J.k !== k) layout(J); paint(J, now); });
  }, 250);
  map.on('zoomend', () => { if (map.getZoom() < MIN_ZOOM) clearAll(); });
})();
