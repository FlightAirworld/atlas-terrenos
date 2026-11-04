'use strict';
// Señales de tráfico junto a los cruces de las calles reales, y coches que las obedecen.
//  - Las señales no vienen en el mapa: se colocan por reglas, igual que los semáforos de crossings.js.
//  - Límite de velocidad (50 en calles principales, secundarias y terciarias; 30 en calles pequeñas y de servicio): junto a cada calle que llega a un cruce.
//    Los coches no pasan de ese límite en ninguna calle (la velocidad sale del tipo de calle, aunque la señal no se vea en pantalla).
//  - Paso de peatones (rombo amarillo): en los cruces con semáforo, antes del paso de cebra.
//  - Stop y ceda el paso: en los cruces SIN semáforo, en las calles de menos categoría que llegan a otra mayor
//    (diferencia de 2 o más: stop; diferencia de 1, o el palo de una T de calles iguales: ceda el paso).
//    El coche frena del todo ante el stop, espera ~1,3 s y arranca cuando no viene nadie por el cruce; ante el ceda el paso baja la velocidad y solo para si viene alguien.
//  - Dirección prohibida: en la boca de las calles de sentido único (si las teselas del mapa traen ese dato). Los coches nunca entran por ahí:
//    vehicles.js (roadRoute → canGo) no les deja trazar rutas contra el sentido. Los peatones no se ven afectados.
//  - vehicles.js (followLimit) llama a Signs.check(v, scale, vehicles) → { rem, cap }: rem = px hasta la línea donde hay que parar, cap = velocidad máxima.
//  - Las emergencias no usan followLimit, así que no paran (igual que con los semáforos).
// Solo se dibujan los cruces más cercanos al centro de la pantalla (hasta 14; 8 en móvil) y con zoom >= 16,5.
(function () {
  if (typeof map === 'undefined' || !map || !window.roadGraph) return;
  const REF_Z = 17, MIN_ZOOM = 16.5, LINE = '#363c48', RED = '#d62828';
  const SMALL = Math.min(innerWidth, innerHeight) < 600, MAX_S = SMALL ? 8 : 14;
  const RANK = { primary: 5, secondary: 4, tertiary: 3, minor: 2, service: 1 };
  const LIMIT = { primary: 50, secondary: 50, tertiary: 50, minor: 30, service: 30 };   // km/h según el tipo de calle
  const KMH = 1.25;                                    // km/h → unidades de velocidad de vehicles.js (un coche normal va a ~65)
  const WAIT = 1.3, GIVE_UP = 9;                       // s parado ante el stop; s tras los que arranca aunque no vea hueco (para no bloquear el tráfico)
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  const SVG = {
    stop: `<svg viewBox="0 0 20 20"><polygon points="6,1 14,1 19,6 19,14 14,19 6,19 1,14 1,6" fill="${RED}" stroke="#fff" stroke-width="1.2"/><text x="10" y="12.3" text-anchor="middle" font-size="5.6" font-weight="800" fill="#fff" font-family="Arial,Helvetica,sans-serif">STOP</text></svg>`,
    yield: `<svg viewBox="0 0 20 20"><polygon points="2,3.4 18,3.4 10,17.6" fill="#fff" stroke="${RED}" stroke-width="2.8" stroke-linejoin="round"/></svg>`,
    ped: `<svg viewBox="0 0 20 20"><rect x="3.6" y="3.6" width="12.8" height="12.8" transform="rotate(45 10 10)" fill="#ffd23f" stroke="#1b1b1b" stroke-width="1.2" stroke-linejoin="round"/><circle cx="10" cy="6.8" r="1.3" fill="#111"/><path d="M10 8.4V12.2M10 9.4L7.7 11M10 9.4L12.3 10.9M10 12.2L8.5 15M10 12.2L11.8 14.8" stroke="#111" stroke-width="1.15" stroke-linecap="round" fill="none"/></svg>`,
    no: `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="${RED}" stroke="#fff" stroke-width="1"/><rect x="4.2" y="8.2" width="11.6" height="3.6" rx=".6" fill="#fff"/></svg>`,
    speed: n => `<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.6" fill="#fff" stroke="${RED}" stroke-width="2.7"/><text x="10" y="13.1" text-anchor="middle" font-size="8.6" font-weight="800" fill="#111" font-family="Arial,Helvetica,sans-serif">${n}</text></svg>`
  };

  const st = document.createElement('style');
  st.textContent = `
    .ts { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .ts-r { position: absolute; left: 0; top: 0; width: 0; height: 0; }
    .ts-r > div { position: absolute; }
    .ts-i { filter: drop-shadow(0 1px 1px rgba(0,0,0,.38)); }
    .ts-i svg { display: block; width: 100%; height: 100%; overflow: visible; }`;
  document.head.appendChild(st);
  map.createPane('signs'); map.getPane('signs').style.zIndex = 565;       // por encima de los semáforos, por debajo de coches y gente
  map.getPane('signs').style.pointerEvents = 'none';

  const act = new Map();     // clave → { key, src: 'x' (cruce con semáforo) | 's' (cruce sin semáforo), C, br: [{ th, u, cls, type, ne, ped, limit, half, xs, els }], mk, hasStops, fp, fv, box, k }

  function layout(S) {
    const z = map.sizes(), fp = z.fp;
    S.fp = fp; S.fv = z.fv;
    const dz = Math.max(...S.br.map(b => map.roadMetrics(b.cls).curb)) + 4 * fp;     // misma cuenta que crossings.js, para que cuadren con el paso de cebra
    const ds = Math.max(9, 11 * fp);                                                 // tamaño de una señal
    S.box = dz + 6 * fp;                                                              // radio del cruce (px de pantalla)
    S.br.forEach(b => {
      const half = map.roadMetrics(b.cls).half, depth = Math.max(8 * fp, half * 0.75);
      b.half = half; b.xs = dz + depth / 2 + 3 * fp;
      const yR = -(half + 3 * fp + ds / 2 + 1);                                       // lado derecho de quien llega al cruce
      const box = (el, cx, cy, w, h) => { const s = el.style; s.left = (cx - w / 2) + 'px'; s.top = (cy - h / 2) + 'px'; s.width = w + 'px'; s.height = h + 'px'; s.transform = `rotate(${(-b.th).toFixed(4)}rad)`; };   // contragira para que la señal se lea derecha
      if (b.els.ln) {                                                                 // línea de parada (continua en el stop, a trazos en el ceda)
        const s = b.els.ln.style, w = Math.max(1.6, half * 0.16);
        s.left = b.xs + 'px'; s.top = -half + 'px'; s.width = w + 'px'; s.height = half + 'px';
        s.background = b.type === 'stop' ? LINE : `repeating-linear-gradient(to bottom,${LINE} 0 ${Math.max(2, half * 0.22)}px,transparent ${Math.max(2, half * 0.22)}px ${Math.max(4, half * 0.44)}px)`;
      }
      if (b.els.sg) box(b.els.sg, b.xs + ds * 0.8, yR, ds, ds);
      if (b.els.pd) box(b.els.pd, b.xs + ds * 1.9, yR, ds, ds);
      if (b.els.sp) box(b.els.sp, b.xs + ds * 3.2, yR, ds, ds);
      if (b.els.ne) box(b.els.ne, dz + ds * 0.9, -yR, ds, ds);                        // en el lado derecho de quien ENTRARÍA por la calle
    });
    S.k = layoutKey();
  }
  const layoutKey = () => Math.round(map.roadMetrics('minor').half * 10) + ':' + Math.round(map.sizes().fp * 100);

  function build(key, src, C, br) {
    br.forEach(b => { b.u = { x: Math.cos(b.th), y: Math.sin(b.th) }; b.limit = LIMIT[b.cls] || 50; });
    const html = br.map(b => `<div class="ts-r" style="transform:rotate(${b.th.toFixed(4)}rad)">`
      + (b.type ? `<div class="ts-ln"></div><div class="ts-i ts-sg">${SVG[b.type]}</div>` : '')
      + (b.ped ? `<div class="ts-i ts-pd">${SVG.ped}</div>` : '')
      + `<div class="ts-i ts-sp">${SVG.speed(b.limit)}</div>`
      + (b.ne ? `<div class="ts-i ts-ne">${SVG.no}</div>` : '')
      + '</div>').join('');
    const mk = L.marker(map.unproject(C, REF_Z), { icon: L.divIcon({ className: 'ts', iconSize: [0, 0], iconAnchor: [0, 0], html }), pane: 'signs', interactive: false, keyboard: false }).addTo(map);
    const rs = mk.getElement().querySelectorAll('.ts-r');
    br.forEach((b, i) => { const r = rs[i], q = c => r.querySelector(c); b.els = { ln: q('.ts-ln'), sg: q('.ts-sg'), pd: q('.ts-pd'), sp: q('.ts-sp'), ne: q('.ts-ne') }; });
    const S = { key, src, C, br, mk, hasStops: br.some(b => b.type), fp: 1, fv: 1, box: 20, k: '' };
    act.set(key, S); layout(S);
    return S;
  }
  function removeS(k) { const S = act.get(k); if (S) { map.removeLayer(S.mk); act.delete(k); } }
  function clearAll() { Array.from(act.keys()).forEach(removeS); }

  // Quién cede el paso a quién en un cruce sin semáforo
  function assignTypes(br) {
    const top = Math.max(...br.map(b => RANK[b.cls]));
    br.forEach(b => { const d = top - RANK[b.cls]; b.type = d >= 2 ? 'stop' : d === 1 ? 'yield' : null; });
    if (br.length === 3 && br.every(b => !b.type)) {      // T de calles iguales: el palo de la T cede el paso a la calle que pasa de largo
      for (let i = 0; i < 3; i++) {
        const o = br.filter((_, j) => j !== i);
        if (Math.abs(Math.abs(angDiff(o[0].th, o[1].th)) - Math.PI) < 0.6) { br[i].type = 'yield'; break; }
      }
    }
  }

  function scan() {
    if (document.hidden) return;
    if (map.getZoom() < MIN_ZOOM) { clearAll(); return; }
    if (map.setRoads) map.setRoads(true, 'g');
    const g = window.roadGraph(); if (!g) return;
    const size = map.getSize(), cx = size.x / 2, cy = size.y / 2;
    const scr = p => map.latLngToContainerPoint(map.unproject(p, REF_Z));
    const X = window.Xings;

    // Cruces con semáforo (crossings.js): aquí solo van los rombos de paso de peatones, el límite y la dirección prohibida
    const live = new Set();
    if (X && X.list) X.list().forEach(J => {
      const key = 'x' + J.key; live.add(key);
      if (!act.has(key)) build(key, 'x', J.C, J.br.map(b => ({ th: b.th, cls: b.cls, ne: !!b.ne, ped: true, type: null })));
    });
    Array.from(act.entries()).forEach(([k, S]) => {
      if (S.src === 'x') { if (!live.has(k)) removeS(k); return; }
      const c = scr(S.C);
      if (c.x < -140 || c.y < -140 || c.x > size.x + 140 || c.y > size.y + 140 || (X && X.near && X.near(S.C, 40))) removeS(k);   // fuera de pantalla, o ya le ha tocado semáforo
    });

    let n = 0; act.forEach(S => { if (S.src === 's') n++; });
    if (n >= MAX_S) return;
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
        br.push({ th, cls: e.ln.cls, ne: !!(window.roadCanGo && !window.roadCanGo(e.ln, e.end)), ped: false, type: null });
      });
      if (br.length < 3) return;
      const C = { x: sx / arr.length, y: sy / arr.length }, key = 's' + Math.round(C.x / 4) + ',' + Math.round(C.y / 4);
      if (act.has(key)) return;
      const c = scr(C);
      if (c.x < 24 || c.y < 24 || c.x > size.x - 24 || c.y > size.y - 24) return;
      if (X && X.near && X.near(C, 40)) return;                                       // los cruces con semáforo no llevan stop
      for (const S of act.values()) if (Math.hypot(S.C.x - C.x, S.C.y - C.y) < 40) return;
      cand.push({ key, C, br, d: Math.hypot(c.x - cx, c.y - cy) });
    });
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand) {
      if (n >= MAX_S) break;
      if ([...act.values()].some(S => Math.hypot(S.C.x - c.C.x, S.C.y - c.C.y) < 40)) continue;
      c.br.sort((a, b) => RANK[b.cls] - RANK[a.cls]);
      const br = c.br.slice(0, 4);
      assignTypes(br);
      build(c.key, 's', c.C, br); n++;
    }
  }

  // ¿Viene alguien por el cruce que le toque pasar antes que a v? (otros coches que cruzan, o ya dentro del cruce)
  function clear(S, v, scale, vehicles) {
    for (const u of vehicles) {
      if (u === v) continue;
      const rx = (S.C.x - u.x) * scale, ry = (S.C.y - u.y) * scale, d = Math.hypot(rx, ry);
      if (d > 130) continue;
      const rel = Math.abs(angDiff(u.h, v.h));
      if (rel < 0.5 || rel > Math.PI - 0.5) continue;                               // mismo sentido (detrás) o de frente por mi misma calle: no estorba
      if (d <= S.box) return false;                                                // ya está en medio del cruce
      if (u.speed >= 3 && rx * Math.cos(u.h) + ry * Math.sin(u.h) > 0 && d < 110) return false;   // se acerca al cruce con prisa
    }
    return true;
  }

  // Para v: { rem: px hasta la línea de parada donde debe frenar (Infinity si nada le obliga), cap: velocidad máxima permitida }
  function check(v, scale, vehicles) {
    const out = { rem: Infinity, cap: Infinity };
    const cl = v.path && v.path.cl;
    if (cl) { const lim = LIMIT[cl[Math.min(v.seg + 1, cl.length - 1)]]; if (lim) out.cap = lim * KMH; }   // límite según la calle por la que va
    if (!act.size) return out;
    const ch = Math.cos(v.h), sh = Math.sin(v.h), now = Date.now() / 1000;
    act.forEach(S => {
      if (!S.hasStops) return;
      const rx = (S.C.x - v.x) * scale, ry = (S.C.y - v.y) * scale, a = rx * ch + ry * sh;
      if (a <= 0 || a > 240) return;
      const lat = Math.abs(-rx * sh + ry * ch);
      S.br.forEach((b, i) => {
        if (!b.type || Math.cos(v.h - b.th - Math.PI) < 0.8 || lat > b.half * 2 + 8) return;   // no viene por esta calle hacia el cruce
        const id = S.key + ':' + i, m = v.sg || (v.sg = {});
        let w = m[id];
        if (w === 1) return;                                                          // ya tiene permiso (o ya lo cruzó)
        const rem = a - b.xs - v.K.L / 2 * S.fv;
        if (rem < -3) { m[id] = 1; return; }                                           // ya pasó la línea
        const stopped = rem <= 3 && v.speed < 4;
        if (stopped && !w) w = m[id] = { t: now };
        const free = clear(S, v, scale, vehicles), waited = w ? now - w.t : 0;
        if (b.type === 'stop') {
          if (stopped && waited >= WAIT && (free || waited > GIVE_UP)) { m[id] = 1; return; }
          out.rem = Math.min(out.rem, Math.max(rem, 0));
        } else {                                                                       // ceda el paso: despacio, y solo para si viene alguien
          if ((free && rem <= 30) || (stopped && waited > GIVE_UP)) { m[id] = 1; return; }
          if (rem < 90) out.cap = Math.min(out.cap, 26);
          if (!free) out.rem = Math.min(out.rem, Math.max(rem, 0));
        }
      });
    });
    return out;
  }

  window.Signs = { check };
  setInterval(scan, 1300);
  setInterval(() => {
    if (!act.size || document.hidden) return;
    const k = layoutKey();
    act.forEach(S => { if (S.k !== k) layout(S); });
  }, 250);
  map.on('zoomend', () => { if (map.getZoom() < MIN_ZOOM) clearAll(); });
})();
