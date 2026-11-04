'use strict';
// Plazas de las rotondas: en el centro de cada glorieta de las calles reales se pone, al azar, una decoración:
//  fuente con agua, estatua sobre pedestal, arboleda sobre césped, palmeras, jardín de flores o monumento con setos.
//  - Las rotondas no vienen marcadas en el mapa: se detectan como anillos de calle (una calle cerrada, o varias calles
//    unidas por sus extremos que forman un círculo) con un radio entre ~5 y ~85 m.
//  - La decoración sale de un hash de la posición del centro: cada rotonda siempre tiene la misma para todos los jugadores.
//  - Solo se dibujan las rotondas más cercanas al centro de la pantalla (hasta 10; 6 en móvil) y con zoom >= 16,5.
//  - Cubre solo la isleta del centro (radio del anillo menos la calzada): los coches siguen dando vueltas por la calle.
(function () {
  if (typeof map === 'undefined' || !map || !window.roadGraph) return;
  const REF_Z = 17, MIN_ZOOM = 16.5, SNAP = 3;
  const SMALL = Math.min(innerWidth, innerHeight) < 600, MAX_R = SMALL ? 6 : 10;
  const R_MIN = 5, R_MAX = 85, ROUND = 0.2;            // radio del anillo (px de mundo a REF_Z ≈ 1 m) y lo "redondo" que debe ser
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = seed => () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6D2B79F5) >>> 0; return ((seed ^ (seed >>> 13)) >>> 0) / 4294967296; };
  const f = n => (Math.round(n * 100) / 100);

  // ---------- Dibujos (SVG visto desde arriba; el césped mide 46 de radio y el bordillo llega a 50) ----------
  let uid = 0;
  const defs = id => `<defs>
    <radialGradient id="${id}g" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#8fd672"/><stop offset="1" stop-color="#62b155"/></radialGradient>
    <radialGradient id="${id}t" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#6fbf55"/><stop offset="1" stop-color="#2f7a3a"/></radialGradient>
    <radialGradient id="${id}w" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#9be3f7"/><stop offset="1" stop-color="#3fa9dd"/></radialGradient>
  </defs>`;
  const base = id => `<circle r="50" fill="#ece8de" stroke="#b9b3a3" stroke-width="1"/><circle r="46" fill="url(#${id}g)"/><circle r="39" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="5"/>`;
  const tree = (id, x, y, r) => `<circle cx="${f(x + r * .28)}" cy="${f(y + r * .34)}" r="${f(r)}" fill="#1d4a28" opacity=".3"/>` +
    `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="url(#${id}t)"/>` +
    `<circle cx="${f(x - r * .32)}" cy="${f(y - r * .34)}" r="${f(r * .42)}" fill="#a8e08a" opacity=".45"/>` +
    `<circle cx="${f(x + r * .35)}" cy="${f(y + r * .1)}" r="${f(r * .22)}" fill="#245f2f" opacity=".5"/>`;
  const palm = (x, y, r, rot) => {
    let s = `<circle cx="${f(x + r * .18)}" cy="${f(y + r * .22)}" r="${f(r * .75)}" fill="#1d4a28" opacity=".25"/><g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">`;
    for (let i = 0; i < 9; i++) s += `<g transform="rotate(${i * 40})"><ellipse cx="${f(r * .55)}" cy="0" rx="${f(r * .56)}" ry="${f(r * .17)}" fill="${i % 2 ? '#3d9d4a' : '#58b957'}"/><line x1="0" y1="0" x2="${f(r * 1.05)}" y2="0" stroke="#2a6e35" stroke-width="${f(Math.max(.4, r * .05))}"/></g>`;
    return s + `<circle r="${f(r * .17)}" fill="#8a5a2b"/></g>`;
  };
  const sq = (s, fill, stroke) => `<rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="1" fill="${fill}" stroke="${stroke}" stroke-width=".6"/>`;

  const BUILD = {
    fountain(id, rnd) {
      let s = base(id);
      s += `<circle r="31" fill="#cfcabd"/><circle r="29" fill="#e9e6de" stroke="#b8b3a6" stroke-width=".7"/><circle r="26" fill="url(#${id}w)"/>`;
      for (let i = 0; i < 3; i++) s += `<circle r="8" fill="none" stroke="#fff" stroke-width="1"><animate attributeName="r" from="9" to="25" dur="3s" begin="${-i}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.85;0" dur="3s" begin="${-i}s" repeatCount="indefinite"/></circle>`;
      s += `<circle r="13" fill="#dcd8cd" stroke="#b3aea0" stroke-width=".7"/><circle r="10" fill="url(#${id}w)"/>`;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, x = Math.cos(a) * 18, y = Math.sin(a) * 18, b = f(-i * .108);
        s += `<circle r="1.6" fill="#fff"><animateMotion dur="1.3s" begin="${b}s" repeatCount="indefinite" path="M0 0 L${f(x)} ${f(y)}"/><animate attributeName="opacity" values="1;0.9;0" dur="1.3s" begin="${b}s" repeatCount="indefinite"/></circle>`;
      }
      s += `<circle r="4.2" fill="#f4fbff" stroke="#9fd7ee" stroke-width=".8"><animate attributeName="r" values="3.6;5;3.6" dur="1.1s" repeatCount="indefinite"/></circle>`;
      return s;
    },
    statue(id, rnd) {
      const mat = [['#5fa393', '#3e7c6e'], ['#f3f1ea', '#cfcabd'], ['#e6b84a', '#b88a1f']][Math.floor(rnd() * 3)];
      let s = base(id);
      s += `<circle r="33" fill="none" stroke="#e8dcc0" stroke-width="4.5"/>`;
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, x = f(Math.cos(a) * 25), y = f(Math.sin(a) * 25); s += `<circle cx="${x}" cy="${y}" r="4.5" fill="#e45a7a"/><circle cx="${x}" cy="${y}" r="2" fill="#ffd54a"/>`; }
      s += `<rect x="-10" y="-9" width="22" height="22" fill="#1d3a22" opacity=".25"/>`;
      s += sq(26, '#d6d1c5', '#aaa498') + sq(20, '#e2ded3', '#b9b3a6') + sq(14, '#ece9e0', '#c2bcaf');
      s += `<ellipse cx="2.4" cy="3" rx="7.5" ry="4" fill="#1d1d1d" opacity=".25"/>`;
      s += `<ellipse cx="0" cy="0" rx="7" ry="3.6" fill="${mat[0]}" stroke="${mat[1]}" stroke-width=".7"/>`;
      s += `<ellipse cx="6" cy="-4.5" rx="1.7" ry="3.6" transform="rotate(30 6 -4.5)" fill="${mat[0]}" stroke="${mat[1]}" stroke-width=".5"/>`;
      s += `<circle cx="0" cy="0" r="2.7" fill="${mat[0]}" stroke="${mat[1]}" stroke-width=".6"/><circle cx="-.7" cy="-.8" r="1" fill="#fff" opacity=".45"/>`;
      return s;
    },
    trees(id, rnd) {
      let s = base(id);
      const n = 5 + Math.floor(rnd() * 2), a0 = rnd() * 6.28;
      for (let i = 0; i < n; i++) { const a = a0 + i / n * Math.PI * 2; s += tree(id, Math.cos(a) * 26, Math.sin(a) * 26, 10 + rnd() * 3); }
      return s + tree(id, 0, 0, 15);
    },
    palms(id, rnd) {
      let s = base(id);
      s += `<circle r="30" fill="none" stroke="#e8dcc0" stroke-width="3.5"/>`;
      const a0 = rnd() * 6.28;
      for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2; s += palm(Math.cos(a) * 26, Math.sin(a) * 26, 10.5, rnd() * 40); }
      return s + palm(0, 0, 15, rnd() * 40);
    },
    garden(id, rnd) {
      const ring = (r, col, w, gap) => `<circle r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="0 ${gap}"/>`;
      const pal = [['#e84a5f', '#ffd23f', '#fff'], ['#b05cf0', '#ff9f43', '#fff'], ['#ff6b9d', '#ffe066', '#a5e1ff']][Math.floor(rnd() * 3)];
      let s = base(id);
      s += `<circle r="36" fill="none" stroke="#3d9d4a" stroke-width="5" stroke-opacity=".55"/>`;
      s += ring(36, pal[0], 4.4, 5.5) + ring(27, pal[1], 4, 5) + ring(18.5, pal[2], 3.6, 4.4);
      return s + tree(id, 0, 0, 8.5);
    },
    monument(id, rnd) {
      let s = base(id);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 33, y = Math.sin(a) * 33; s += `<circle cx="${f(x)}" cy="${f(y)}" r="5.2" fill="#2f8a42"/><circle cx="${f(x - 1.2)}" cy="${f(y - 1.4)}" r="2.2" fill="#7ccf68" opacity=".6"/>`; }
      s += `<circle r="25" fill="#e8dcc0"/><circle r="22" fill="none" stroke="#cdbf9c" stroke-width=".8" stroke-dasharray="1.5 3"/>`;
      s += `<polygon points="3,3 16,5 5,16" fill="#1d1d1d" opacity=".22"/>`;
      s += sq(18, '#d6d1c5', '#aaa498') + sq(11, '#e8e4da', '#b9b3a6');
      return s + `<polygon points="0,-6 6,0 0,6 -6,0" fill="#f6f3ea" stroke="#b0aa9c" stroke-width=".6"/><polygon points="0,-6 6,0 0,0" fill="#fff" opacity=".6"/><circle r="1.1" fill="#c9a23a"/>`;
    }
  };
  const TYPES = Object.keys(BUILD);
  const svg = (type, key) => {
    const id = 'rt' + (uid++), rnd = rng(hash(key + type));
    return `<svg viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%;overflow:visible">${defs(id)}${BUILD[type](id, rnd)}</svg>`;
  };

  // ---------- Detección de rotondas en las calles reales ----------
  const polyLen = pts => { let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return t; };
  // Anillo (puntos de una calle cerrada) → { C, Rmin, Rmax, Rm } si es un círculo de verdad; si no, null
  function circleOf(pts) {
    const len = polyLen(pts); if (len < 2 * Math.PI * R_MIN * 0.8) return null;
    const N = 28, S = [];
    let seg = 1, acc = 0;
    for (let k = 0; k < N; k++) {
      const target = len * k / N;
      while (seg < pts.length - 1) { const l = Math.hypot(pts[seg].x - pts[seg - 1].x, pts[seg].y - pts[seg - 1].y); if (acc + l >= target) break; acc += l; seg++; }
      const a = pts[seg - 1], b = pts[seg], l = Math.hypot(b.x - a.x, b.y - a.y) || 1, t = Math.min(1, Math.max(0, (target - acc) / l));
      S.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    const C = { x: S.reduce((s, p) => s + p.x, 0) / N, y: S.reduce((s, p) => s + p.y, 0) / N };
    const rs = S.map(p => Math.hypot(p.x - C.x, p.y - C.y)), Rmin = Math.min(...rs), Rmax = Math.max(...rs), Rm = rs.reduce((a, b) => a + b, 0) / N;
    if (Rm < R_MIN || Rm > R_MAX || (Rmax - Rmin) / Rm > ROUND) return null;
    return { C, Rmin, Rmax, Rm };
  }
  let lastG = null, lastRings = [];
  function findRings(g) {
    if (g === lastG) return lastRings;
    const rings = [];
    const near = p => { const out = [], cx = Math.round(p.x / SNAP), cy = Math.round(p.y / SNAP); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = g.ends.get((cx + i) + ',' + (cy + j)); if (a) out.push(...a); } return out; };
    const close = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= SNAP * 1.5;
    const push = (pts, cls) => { const c = circleOf(pts); if (c && !rings.some(r => Math.hypot(r.C.x - c.C.x, r.C.y - c.C.y) < 8)) rings.push({ ...c, cls }); };
    g.lines.forEach(ln => {
      const p = ln.pts, n = p.length;
      if (n >= 5 && close(p[0], p[n - 1])) { push(p, ln.cls); return; }              // calle cerrada: la rotonda entera
      const L = polyLen(p);
      if (L < 6 || L > 2 * Math.PI * R_MAX) return;
      // Varias calles unidas por sus extremos que vuelven al punto de partida (rotondas cortadas en tramos o en teselas)
      const dfs = (pts, used, total, depth) => {
        for (const o of near(pts[pts.length - 1])) {
          if (used.has(o.ln)) continue;
          const q = o.end ? o.ln.pts.slice().reverse() : o.ln.pts, tot = total + polyLen(q);
          if (tot > 2 * Math.PI * R_MAX) continue;
          const all = pts.concat(q.slice(1));
          if (close(q[q.length - 1], p[0])) { push(all, ln.cls); continue; }
          if (depth < 5) { used.add(o.ln); dfs(all, used, tot, depth + 1); used.delete(o.ln); }
        }
      };
      dfs(p.slice(), new Set([ln]), L, 1);
    });
    lastG = g; lastRings = rings;
    return rings;
  }

  // ---------- Dibujo en el mapa ----------
  const st = document.createElement('style');
  st.textContent = `.rt { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .rt-i { position: absolute; pointer-events: none; transform-origin: 50% 50%; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.35)); }`;
  document.head.appendChild(st);
  map.createPane('plazas'); map.getPane('plazas').style.zIndex = 552;     // por debajo de semáforos, señales, coches y gente
  map.getPane('plazas').style.pointerEvents = 'none';

  const active = new Map();      // clave → { key, C, Rmin, cls, mk, box, type }
  const pitchK = () => { try { return Math.max(0.3, Math.cos(map.gl.getPitch() * Math.PI / 180)); } catch (e) { return 1; } };
  function layout(P) {
    const scale = Math.pow(2, map.getZoom() - REF_Z), half = map.roadMetrics(P.cls).half;
    const isle = P.Rmin * scale - half - 2.5;                                  // radio de la isleta visible (px de pantalla)
    if (isle < 5) { P.box.style.display = 'none'; return; }
    const d = isle * 2 * 50 / 46, s = P.box.style;                             // el SVG incluye el bordillo (radio 50 de 46)
    s.display = ''; s.width = d + 'px'; s.height = d + 'px'; s.left = (-d / 2) + 'px'; s.top = (-d / 2) + 'px';
    s.transform = 'scaleY(' + f(pitchK()) + ')';
  }
  function add(r) {
    const key = Math.round(r.C.x / 4) + ',' + Math.round(r.C.y / 4);
    const type = TYPES[hash(key) % TYPES.length];
    const box = document.createElement('div'); box.className = 'rt-i'; box.innerHTML = svg(type, key);
    const mk = L.marker(map.unproject(r.C, REF_Z), { icon: L.divIcon({ className: 'rt', iconSize: [0, 0], iconAnchor: [0, 0], html: box }), pane: 'plazas', interactive: false, keyboard: false }).addTo(map);
    const P = { key, C: r.C, Rmin: r.Rmin, cls: r.cls || 'minor', mk, box, type };
    active.set(key, P); layout(P);
  }
  function removeP(k) { const P = active.get(k); if (P) { map.removeLayer(P.mk); active.delete(k); } }
  function clearAll() { Array.from(active.keys()).forEach(removeP); }

  function scan() {
    if (document.hidden) return;
    if (map.getZoom() < MIN_ZOOM) { clearAll(); return; }
    if (map.setRoads) map.setRoads(true, 'r');
    const g = window.roadGraph(); if (!g) return;
    const size = map.getSize(), cx = size.x / 2, cy = size.y / 2;
    const scr = p => map.latLngToContainerPoint(map.unproject(p, REF_Z));
    active.forEach((P, k) => { const c = scr(P.C); if (c.x < -200 || c.y < -200 || c.x > size.x + 200 || c.y > size.y + 200) removeP(k); });
    if (active.size >= MAX_R) return;
    const cand = [];
    findRings(g).forEach(r => {
      for (const P of active.values()) if (Math.hypot(P.C.x - r.C.x, P.C.y - r.C.y) < 10) return;   // ya tiene su plaza
      const c = scr(r.C);
      if (c.x < 0 || c.y < 0 || c.x > size.x || c.y > size.y) return;
      cand.push({ ...r, d: Math.hypot(c.x - cx, c.y - cy) });
    });
    cand.sort((a, b) => a.d - b.d);
    for (const r of cand) { if (active.size >= MAX_R) break; add(r); }
  }
  const relayout = () => active.forEach(layout);
  map.on('zoom', relayout); map.on('pitch', relayout);
  map.on('zoomend', () => { if (map.getZoom() < MIN_ZOOM) clearAll(); else relayout(); });
  setInterval(scan, 1500);
  window.Rotondas = { list: () => Array.from(active.values()), _svg: svg, _types: TYPES, _circleOf: circleOf, _findRings: findRings };
})();
