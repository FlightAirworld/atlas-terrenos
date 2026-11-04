'use strict';
// Tren por las vías reales (OpenStreetMap vía OpenFreeMap; el estilo del mapa las dibuja: st-rail en app.js).
//  - Cada ~70 s sale un tren (locomotora + 2 o 3 vagones) que recorre una vía visible, con zoom >= 16.
//  - ESTACIONES: el mundo se divide en celdas de ~650 m y en 4 de cada 10 hay una estación junto a la vía (andén con marquesina).
//    El tren frena en cada estación que encuentra, abre puertas (luces amarillas), baja gente, sube gente, avisa y arranca.
//  - SONIDO (Web Audio, sin archivos; respeta el botón 🔊): traqueteo y rumor que dependen de la velocidad, bocina al entrar y al salir,
//    campana al llegar a la estación y pitidos antes de cerrar puertas. Suena más fuerte cuanto más cerca del centro de la pantalla.
// Para probar: spawnTrain() en la consola (hace falta una vía a la vista; con zoom >= 16).
(function () {
  if (typeof map === 'undefined' || !map || !map.gl) return;
  const KEY = 'trainsOn', MIN_ZOOM = 16, REF_Z = 17, MAX_ST = 5, GAP = 3, CELL = 0.006, STATION_RATE = 0.4;
  const gl = map.gl, btn = document.getElementById('train-btn');
  let on = true;
  try { const s = localStorage.getItem(KEY); if (s !== null) on = s === '1'; } catch (e) {}

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (c, t, s) => c < t ? Math.min(t, c + s) : Math.max(t, c - s);
  const hash3 = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
  const unit3 = (a, b, c) => hash3(a, b, c) / 4294967296;

  const st = document.createElement('style');
  st.textContent = '.tr-door { fill: #27384a; transition: fill .3s; } .open .tr-door { fill: #ffd24a; }';
  document.head.appendChild(st);

  let FV = 1, FP = 1, SPD = 1;
  function refresh() { const z = map.sizes(); FV = z.fv; FP = z.fp; SPD = Math.pow(FV, 0.75); }
  refresh();

  // ---------- Vías: se juntan los trozos que da el mapa (uno por tesela) en recorridos continuos ----------
  function makePath(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, total: cum[cum.length - 1] };
  }
  function at(P, s) {
    s = clamp(s, 0, P.total);
    let lo = 0, hi = P.cum.length - 2;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P.cum[m] <= s) lo = m; else hi = m - 1; }
    const a = P.pts[lo], b = P.pts[lo + 1], l = (P.cum[lo + 1] - P.cum[lo]) || 1, t = (s - P.cum[lo]) / l;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function railChains() {
    if (!gl.getLayer('st-rail')) return [];
    const raw = [];
    try {
      gl.queryRenderedFeatures({ layers: ['st-rail'] }).forEach(f => {
        const g = f.geometry; if (!g) return;
        (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []).forEach(c => {
          if (c.length > 1) raw.push(c.map(p => map.project({ lat: p[1], lng: p[0] }, REF_Z)));
        });
      });
    } catch (e) { return []; }
    const key = p => Math.round(p.x) + ',' + Math.round(p.y), ends = new Map();
    raw.forEach((pts, i) => [0, pts.length - 1].forEach(j => { const k = key(pts[j]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push({ i, j }); }));
    const used = new Set(), out = [];
    raw.forEach((q0, s) => {
      if (used.has(s)) return;
      used.add(s);
      let pts = q0.slice();
      for (let pass = 0; pass < 2; pass++) {                  // se alarga por la cola y, dado la vuelta, por la cabeza
        for (let guard = 0; guard < 80; guard++) {
          const c = (ends.get(key(pts[pts.length - 1])) || []).filter(e => !used.has(e.i));
          if (!c.length) break;
          const e = c[0], q = raw[e.i]; used.add(e.i);
          pts = pts.concat(e.j === 0 ? q.slice(1) : q.slice(0, -1).reverse());
        }
        pts.reverse();
      }
      const P = makePath(pts);
      if (P.total >= 200) out.push(P);
    });
    return out;
  }

  // ---------- Estaciones ----------
  const stations = new Map();       // 'ix:iy' -> { x, y, th, side, mk, wrap, k }
  const platSVG = `<svg width="260" height="60" viewBox="0 0 260 60" style="overflow:visible">
      <rect x="2" y="44" width="260" height="16" rx="2" fill="rgba(0,0,0,.22)"/>
      <rect x="0" y="42" width="260" height="16" fill="#cfd2d8" stroke="#9aa0a8" stroke-width=".8"/>
      <rect x="0" y="42" width="260" height="2.2" fill="#f2c200"/>
      <rect x="72" y="46" width="116" height="9" rx="1.5" fill="#4a6fa5" opacity=".9" stroke="#2f4a73" stroke-width=".6"/>
      <rect x="84" y="56" width="16" height="2" fill="#7a5c3a"/><rect x="160" y="56" width="16" height="2" fill="#7a5c3a"/>
    </svg>`;
  function stationShow(e) {
    const icon = L.divIcon({
      className: 'vh', iconSize: [260, 60], iconAnchor: [130, 30],
      html: `<div class="vh-in"><div class="vh-rot" style="transform:rotate(${e.th}rad)"><div style="transform:scaleY(${e.side});transform-origin:130px 30px">${platSVG}</div></div></div>`
    });
    e.mk = L.marker(map.unproject(e, REF_Z), { icon, pane: 'pads', interactive: false, keyboard: false }).addTo(map);
    const el = e.mk.getElement(); e.wrap = el && el.querySelector('.vh-in');
  }
  function stationsTick(chains) {
    const size = map.getSize(), scr = p => map.latLngToContainerPoint(map.unproject(p, REF_Z)), best = new Map();
    chains.forEach(P => {
      for (let i = 0; i + 1 < P.pts.length; i++) {
        const a = P.pts[i], b = P.pts[i + 1], n = Math.max(1, Math.ceil((P.cum[i + 1] - P.cum[i]) / 15));
        for (let k = 0; k < n; k++) {
          const p = { x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }, ll = map.unproject(p, REF_Z);
          const ix = Math.floor((ll.lng + 180) / CELL), iy = Math.floor((ll.lat + 90) / CELL);
          if (unit3(ix, iy, 5) >= STATION_RATE) continue;
          const d = Math.pow(ll.lng - ((ix + 0.5) * CELL - 180), 2) + Math.pow(ll.lat - ((iy + 0.5) * CELL - 90), 2), id = ix + ':' + iy, o = best.get(id);
          if (!o || d < o.d) { let th = Math.atan2(b.y - a.y, b.x - a.x); if (Math.cos(th) < 0) th += Math.PI; best.set(id, { d, x: p.x, y: p.y, th, side: unit3(ix, iy, 6) < 0.5 ? 1 : -1 }); }
        }
      }
    });
    best.forEach((o, id) => {
      if (stations.has(id) || stations.size >= MAX_ST) return;
      const c = scr(o); if (c.x < 40 || c.y < 40 || c.x > size.x - 40 || c.y > size.y - 40) return;
      const e = { x: o.x, y: o.y, th: o.th, side: o.side, mk: null, wrap: null, k: null };
      stationShow(e); stations.set(id, e);
    });
    stations.forEach((e, id) => {
      const c = scr(e);
      if (c.x < -260 || c.y < -260 || c.x > size.x + 260 || c.y > size.y + 260) { if (!trains.some(T => T.cur === e)) { map.removeLayer(e.mk); stations.delete(id); } return; }
      if (e.wrap && e.k !== FV) { e.wrap.style.scale = FV.toFixed(3); e.k = FV; }
    });
  }

  // ---------- Dibujo del tren (vista cenital, mirando a la derecha) ----------
  const COLORS = [['#c8102e', '#eef1f4'], ['#1d6fb8', '#eef1f4'], ['#1f8a70', '#eef1f4'], ['#e8a600', '#e9ecef'], ['#6a3fb5', '#eef1f4'], ['#2b3a55', '#dfe4ea']];   // [color de la franja y la cabina, color del techo]
  let svgN = 0;
  // Contorno del coche: morro aerodinámico delante (fF > 0) y testero redondeado detrás (fR > 0) en las cabezas de tren
  function hullPath(L_, W, fF, fR) {
    const m = W / 2, r = 4.5;
    let d = fR ? `M${fR} .5` : `M${r + .5} .5`;
    d += fF ? ` H${L_ - fF} C${L_ - fF * .5} .5 ${L_ - 2} ${W * .17} ${L_ - .5} ${m} C${L_ - 2} ${W * .83} ${L_ - fF * .5} ${W - .5} ${L_ - fF} ${W - .5}`
            : ` H${L_ - r - .5} Q${L_ - .5} .5 ${L_ - .5} ${r + .5} V${W - r - .5} Q${L_ - .5} ${W - .5} ${L_ - r - .5} ${W - .5}`;
    d += fR ? ` H${fR} C${fR * .5} ${W - .5} 2 ${W * .83} .5 ${m} C2 ${W * .17} ${fR * .5} .5 ${fR} .5Z`
            : ` H${r + .5} Q.5 ${W - .5} .5 ${W - r - .5} V${r + .5} Q.5 .5 ${r + .5} .5Z`;
    return d;
  }
  // Vista cenital, mirando a la derecha: techo con sombreado curvo, aires acondicionados, pantógrafo, ventanas y puertas a los lados,
  // bogies asomando, fuelle entre coches, cabina con parabrisas y faros delante, luces rojas y cabina detrás.
  function carSVG(L_, W, c, head, last) {
    const id = 'trn' + (++svgN), m = W / 2, liv = c[0], body = c[1];
    const fF = head ? 14 : 0, fR = last ? 9 : 0, hull = hullPath(L_, W, fF, fR);
    const dX = [L_ * 0.28, L_ * 0.72];
    const xa = fR ? fR + 4 : 5, xb = L_ - (fF ? fF + 3 : 5);
    let win = '', doors = '', roof = '';
    for (let x = xa; x + 6.8 <= xb; x += 9.4) {                                      // ventanas (se saltan las puertas)
      if (dX.some(d => Math.abs(x + 3.4 - d) < 6.4)) continue;
      win += `<rect x="${x.toFixed(1)}" y="1.25" width="6.8" height="2.7" rx="1" fill="#1b2a42"/><rect x="${(x + .5).toFixed(1)}" y="1.45" width="3.2" height=".7" rx=".35" fill="#fff" opacity=".28"/>`
           + `<rect x="${x.toFixed(1)}" y="${W - 3.95}" width="6.8" height="2.7" rx="1" fill="#1b2a42"/><rect x="${(x + .5).toFixed(1)}" y="${W - 3.75}" width="3.2" height=".7" rx=".35" fill="#fff" opacity=".28"/>`;
    }
    dX.forEach(x => {                                                                   // puertas (se iluminan al abrir: .tr-door)
      doors += `<rect class="tr-door" x="${x - 3}" y="1" width="6" height="3.4" rx="1"/><rect class="tr-door" x="${x - 3}" y="${W - 4.4}" width="6" height="3.4" rx="1"/>`
             + `<rect x="${x - .2}" y="1" width=".4" height="3.4" fill="#fff" opacity=".4"/><rect x="${x - .2}" y="${W - 4.4}" width=".4" height="3.4" fill="#fff" opacity=".4"/>`;
    });
    const acX = head ? [L_ * 0.14, L_ * 0.66 - 5] : [L_ * 0.16, L_ * 0.58];            // aires acondicionados del techo
    acX.forEach(x => {
      if (x < xa - 2 || x + 10 > xb + 2) return;
      roof += `<rect x="${x.toFixed(1)}" y="${m - 3.2}" width="10" height="6.4" rx="1.3" fill="#c3cad2" stroke="#98a1ab" stroke-width=".5"/>`
            + `<circle cx="${(x + 3).toFixed(1)}" cy="${m}" r="2" fill="#8f98a3" stroke="#6f7782" stroke-width=".3"/><circle cx="${(x + 7).toFixed(1)}" cy="${m}" r="2" fill="#8f98a3" stroke="#6f7782" stroke-width=".3"/>`
            + `<path d="M${(x + 1.6).toFixed(1)} ${m}H${(x + 4.4).toFixed(1)}M${(x + 5.6).toFixed(1)} ${m}H${(x + 8.4).toFixed(1)}" stroke="#6f7782" stroke-width=".3"/>`;
    });
    let pant = '';
    if (head) {                                                                         // pantógrafo de la locomotora
      const px = L_ * 0.4;
      pant = `<rect x="${(px - 6).toFixed(1)}" y="${m - 2}" width="5" height="4" rx=".8" fill="#2b2f36"/>`
           + `<path d="M${(px - 3.5).toFixed(1)} ${m - 1.2}L${(px + 1.6).toFixed(1)} ${m - 5}M${(px - 3.5).toFixed(1)} ${m + 1.2}L${(px + 1.6).toFixed(1)} ${m + 5}M${(px - 3.5).toFixed(1)} ${m - 1.2}L${(px + 1.6).toFixed(1)} ${m + 5}M${(px - 3.5).toFixed(1)} ${m + 1.2}L${(px + 1.6).toFixed(1)} ${m - 5}" stroke="#4a4f58" stroke-width=".7" fill="none"/>`
           + `<rect x="${(px + .7).toFixed(1)}" y="${m - 5.8}" width="1.8" height="11.6" rx=".6" fill="#2b2f36"/>`;
    }
    let front = '', rear = '', beam = '', bell = '';
    if (head) {
      front = `<path d="M${L_ - 14} ${W * .19}C${L_ - 8} ${W * .19} ${L_ - 5.2} ${W * .3} ${L_ - 3.2} ${m}C${L_ - 5.2} ${W * .7} ${L_ - 8} ${W * .81} ${L_ - 14} ${W * .81}Z" fill="#17233a"/>`
            + `<path d="M${L_ - 12} ${W * .27}C${L_ - 8.5} ${W * .27} ${L_ - 6.5} ${W * .34} ${L_ - 5} ${m - 1.2}" stroke="#fff" stroke-opacity=".35" stroke-width=".8" fill="none" stroke-linecap="round"/>`
            + `<line x1="${L_ - 14}" y1="${m}" x2="${L_ - 3.4}" y2="${m}" stroke="#000" stroke-opacity=".25" stroke-width=".5"/>`
            + `<circle cx="${L_ - 3.4}" cy="5.6" r="3.2" fill="url(#${id}h)"/><circle cx="${L_ - 3.4}" cy="${W - 5.6}" r="3.2" fill="url(#${id}h)"/>`
            + `<circle cx="${L_ - 3.4}" cy="5.6" r="1.25" fill="#fff6c4"/><circle cx="${L_ - 3.4}" cy="${W - 5.6}" r="1.25" fill="#fff6c4"/>`;
      beam = `<path d="M${L_ - 1} 4.5L${L_ + 42} -5V${W + 5}L${L_ - 1} ${W - 4.5}Z" fill="url(#${id}b)"/>`;
    }
    if (last) {
      rear = `<path d="M10.5 ${W * .21}C7 ${W * .21} 5 ${W * .31} 3.4 ${m}C5 ${W * .69} 7 ${W * .79} 10.5 ${W * .79}Z" fill="#17233a"/>`
           + `<rect x=".9" y="4.2" width="1.7" height="2.4" rx=".8" fill="#e3283a"/><rect x=".9" y="${W - 6.6}" width="1.7" height="2.4" rx=".8" fill="#e3283a"/>`;
    } else {
      bell = `<rect x="-3.6" y="${m - 4.2}" width="4.4" height="8.4" rx="1.4" fill="#262b33"/><path d="M-2.6 ${m - 4}V${m + 4}M-1.2 ${m - 4}V${m + 4}" stroke="#4b525d" stroke-width=".5"/>`;   // fuelle entre coches
    }
    return `<svg width="${L_}" height="${W}" viewBox="0 0 ${L_} ${W}" style="overflow:visible">
      <defs>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
        <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff3b8" stop-opacity=".3"/><stop offset="1" stop-color="#fff3b8" stop-opacity="0"/></linearGradient>
        <radialGradient id="${id}h"><stop offset="0" stop-color="#fff6c4" stop-opacity=".95"/><stop offset="1" stop-color="#fff6c4" stop-opacity="0"/></radialGradient>
        <filter id="${id}s" x="-15%" y="-50%" width="130%" height="200%"><feGaussianBlur stdDeviation="1.3"/></filter>
        <clipPath id="${id}c"><path d="${hull}"/></clipPath>
      </defs>
      ${beam}
      <path d="${hull}" transform="translate(2.2 3.2)" fill="rgba(0,0,0,.36)" filter="url(#${id}s)"/>
      <path d="M7 -.9H15M${L_ - 15} -.9H${L_ - 7}M7 ${W + .9}H15M${L_ - 15} ${W + .9}H${L_ - 7}" stroke="#2a2e35" stroke-width="1.7" stroke-linecap="round"/>
      ${bell}
      <path d="${hull}" fill="${body}" stroke="rgba(0,0,0,.55)" stroke-width=".8"/>
      <g clip-path="url(#${id}c)">
        ${fF ? `<rect x="${L_ - 17}" y="0" width="18" height="${W}" fill="${liv}"/>` : ''}${fR ? `<rect x="0" y="0" width="12" height="${W}" fill="${liv}"/>` : ''}
        <rect x="0" y="0" width="${L_}" height="4.9" fill="${liv}"/><rect x="0" y="${W - 4.9}" width="${L_}" height="4.9" fill="${liv}"/>
        <rect x="0" y="${m - .6}" width="${L_}" height="1.2" fill="${liv}" opacity=".55"/>
        <rect x="0" y="4.9" width="${L_}" height=".5" fill="rgba(0,0,0,.2)"/><rect x="0" y="${W - 5.4}" width="${L_}" height=".5" fill="rgba(0,0,0,.2)"/>
        <rect x="0" y="0" width="${L_}" height="${W}" fill="url(#${id}g)"/>
      </g>
      ${win}${doors}${roof}${pant}${front}${rear}
      <path d="${hull}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".4" transform="translate(0 .35)"/>
    </svg>`;
  }

  // ---------- Sonido ----------
  let ac = null, bus = null, noiseBuf = null;
  function initAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); bus = ac.createGain(); bus.gain.value = 0.9; bus.connect(ac.destination);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, function once() {
    if (on) initAudio();
    if (ac) ['pointerdown', 'keydown', 'touchstart'].forEach(e => removeEventListener(e, once));
  }, { passive: true }));
  const sfxOn = () => (window.soundMode ? window.soundMode() : 2) >= 1;
  function noise() {
    if (noiseBuf || !ac) return noiseBuf;
    const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  // Traqueteo: ruido grave troceado por una onda cuadrada (el "tacatá" de las juntas de la vía) + rumor muy grave
  function rollSound() {
    if (!ac || ac.state === 'closed' || !noise()) return null;
    const src = ac.createBufferSource(); src.buffer = noise(); src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const clack = ac.createGain(); clack.gain.value = 0.5;
    const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 4;
    const lfl = ac.createBiquadFilter(); lfl.type = 'lowpass'; lfl.frequency.value = 40;
    const la = ac.createGain(); la.gain.value = 0.5;
    lfo.connect(lfl); lfl.connect(la); la.connect(clack.gain);
    src.connect(lp); lp.connect(clack);
    const lo = ac.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 130;
    const rum = ac.createGain(); rum.gain.value = 0.9; src.connect(lo); lo.connect(rum);
    const g = ac.createGain(); g.gain.value = 0; clack.connect(g); rum.connect(g);
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan) { g.connect(pan); pan.connect(bus); } else g.connect(bus);
    src.start(); lfo.start();
    return { src, lfo, lp, g, pan };
  }
  function rollUpdate(s, r, vol, pan) {
    const now = ac.currentTime;
    s.lfo.frequency.setTargetAtTime(1.5 + 9 * r, now, 0.2);
    s.lp.frequency.setTargetAtTime(300 + 500 * r, now, 0.2);
    s.g.gain.setTargetAtTime(0.55 * vol * r, now, 0.15);
    if (s.pan) s.pan.pan.setTargetAtTime(pan, now, 0.1);
  }
  function killRoll(s) {
    if (!s || !ac) return;
    try { const now = ac.currentTime; s.g.gain.setTargetAtTime(0, now, 0.05); s.src.stop(now + 0.4); s.lfo.stop(now + 0.4); } catch (e) {}
  }
  function horn(vol) {   // "tuut… tuuuut": dos tonos (acorde) en dos bocinazos
    if (!ac || !sfxOn() || vol < 0.05) return;
    const t0 = ac.currentTime + 0.02;
    [[0, 0.4], [0.6, 1.2]].forEach(([d, len]) => [311.1, 392].forEach(f => {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain(), v = 0.09 * vol;
      o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 1100;
      g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(v, t0 + d + 0.06); g.gain.setValueAtTime(v, t0 + d + len - 0.1); g.gain.linearRampToValueAtTime(0, t0 + d + len);
      o.connect(lp); lp.connect(g); g.connect(bus); o.start(t0 + d); o.stop(t0 + d + len + 0.05);
    }));
  }
  function ping(f, t, dur, v, type) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function bell(vol) { if (!ac || !sfxOn() || vol < 0.05) return; const t = ac.currentTime + 0.02; ping(784, t, 1.1, 0.2 * vol); ping(622, t + 0.5, 1.4, 0.2 * vol); }                     // ding-dong al llegar
  function chime(vol) { if (!ac || !sfxOn() || vol < 0.05) return; const t = ac.currentTime + 0.02; [0, 0.22, 0.44].forEach(d => ping(1480, t + d, 0.14, 0.09 * vol, 'square')); }   // pi-pi-pi: se cierran las puertas

  // ---------- Trenes y pasajeros ----------
  const trains = [], pax = [];
  let zooming = false, lastChains = [];
  const nrm = e => ({ x: -Math.sin(e.th) * e.side, y: Math.cos(e.th) * e.side });       // del eje de la vía hacia el andén

  function addPax(x, y, mode, tx, ty, h, life) {
    if (!window.personSVG) return;
    const icon = L.divIcon({
      className: 'pw', iconSize: [20, 30], iconAnchor: [10, 28],
      html: `<div class="pw-in" style="opacity:0;scale:${FP.toFixed(3)}">${window.personSVG(pick(['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703']), pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']), pick(['#2b2d42', '#3a3a3a', '#1d3557', '#5c4033']), false)}</div>`
    });
    const mk = L.marker(map.unproject({ x, y }, REF_Z), { icon, pane: 'people', interactive: false, keyboard: false }).addTo(map);
    pax.push({ mk, x, y, mode, tx, ty, h, age: 0, life, speed: 22 * FP, el: null, flip: null });
  }
  function doors(T, open) { T.cars.forEach(c => { if (c.wrap) c.wrap.classList.toggle('open', open); }); }
  function alight(T, scale) {
    const e = T.cur, n = nrm(e), tg = { x: Math.cos(e.th), y: Math.sin(e.th) }, cnt = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < cnt; i++) {
      const c = pick(T.cars), off = (9 * FV + 3 * FP) / scale, along = rnd(-6, 6) * FV / scale, dir = Math.random() < 0.5 ? 1 : -1;
      const x = c.x + n.x * off + tg.x * along, y = c.y + n.y * off + tg.y * along, h = Math.atan2(n.y * 0.8 + tg.y * 0.6 * dir, n.x * 0.8 + tg.x * 0.6 * dir);
      addPax(x, y, 'out', 0, 0, h, rnd(5, 8));
    }
  }
  function board(T, scale) {
    const e = T.cur, n = nrm(e), tg = { x: Math.cos(e.th), y: Math.sin(e.th) }, cnt = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < cnt; i++) {
      const c = pick(T.cars), off = (9 * FV + 3 * FP) / scale, far = (30 * FV) / scale, along = rnd(-70, 70) * FV / scale;
      addPax(c.x + n.x * far + tg.x * along, c.y + n.y * far + tg.y * along, 'in', c.x + n.x * off, c.y + n.y * off, 0, 14);
    }
  }
  function removePax(i) { map.removeLayer(pax[i].mk); pax.splice(i, 1); }

  function spawnTrain(chains) {
    refresh();
    const cands = (chains || lastChains).filter(P => P.total >= 260);
    if (!cands.length) return null;
    let P = pick(cands);
    if (Math.random() < 0.5) P = makePath(P.pts.slice().reverse());
    const col = pick(COLORS), kinds = [{ L: 62, head: true }]; for (let i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++) kinds.push({ L: 56 });
    kinds[kinds.length - 1].last = true;
    const cars = kinds.map(k => {
      const icon = L.divIcon({ className: 'vh', iconSize: [k.L, 18], iconAnchor: [k.L / 2, 9], html: `<div class="vh-in"><div class="vh-rot">${carSVG(k.L, 18, col, k.head, k.last)}</div></div>` });
      const mk = L.marker(map.unproject(P.pts[0], REF_Z), { icon, pane: 'vehicles', interactive: false, keyboard: false }).addTo(map), el = mk.getElement();
      return { mk, L: k.L, wrap: el && el.querySelector('.vh-in'), rot: el && el.querySelector('.vh-rot'), x: P.pts[0].x, y: P.pts[0].y };
    });
    // Estaciones que quedan en esta vía (la más cercana de la vía a cada una)
    const stops = [];
    stations.forEach(e => {
      let bs = -1, bd = 1e9;
      for (let i = 0; i + 1 < P.pts.length; i++) {                           // punto de la vía más cercano a la estación (proyección sobre cada tramo)
        const a = P.pts[i], b = P.pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
        const u = clamp(((e.x - a.x) * dx + (e.y - a.y) * dy) / l2, 0, 1), d = Math.hypot(a.x + dx * u - e.x, a.y + dy * u - e.y);
        if (d < bd) { bd = d; bs = P.cum[i] + Math.sqrt(l2) * u; }
      }
      if (bd < 14 && bs > 40 && bs < P.total - 40) stops.push({ e, s: bs });
    });
    stops.sort((a, b) => a.s - b.s);
    const T = { P, cars, stops, next: 0, s: 0, speed: rnd(60, 80), vmax: rnd(80, 100), state: 'run', t: 0, step: 0, cur: null, age: 0, vol: 0, hornDone: false, snd: rollSound() };
    trains.push(T);
    return T;
  }
  function removeTrain(i) { const T = trains[i]; killRoll(T.snd); T.cars.forEach(c => map.removeLayer(c.mk)); trains.splice(i, 1); }
  function clearAll() { while (trains.length) removeTrain(0); while (pax.length) removePax(0); stations.forEach(e => map.removeLayer(e.mk)); stations.clear(); }

  function updateTrains(dt, scale) {
    const size = map.getSize(), cx = size.x / 2, cy = size.y / 2, half = Math.hypot(cx, cy);
    for (let i = trains.length - 1; i >= 0; i--) {
      const T = trains[i], P = T.P;
      T.age += dt;
      const lenW = T.cars.reduce((a, c) => a + (c.L + GAP) * FV, 0) / scale;
      if (T.state === 'run') {
        let target = T.vmax;
        const nx = T.stops[T.next];
        if (nx) {
          const sFront = nx.s + lenW / 2, rem = (sFront - T.s) * scale;       // px de pantalla hasta donde para el morro (el tren queda centrado en el andén)
          if (rem <= 0.8) { T.state = 'dwell'; T.t = 0; T.step = 0; T.speed = 0; T.s = sFront; T.cur = nx.e; }
          else target = Math.min(target, Math.sqrt(2 * 40 * rem) / SPD + 3);
        }
        T.speed = approach(T.speed, target, (target > T.speed ? 24 : 200) * dt);
      } else {
        T.t += dt;
        const v = T.vol;
        if (T.step === 0 && T.t > 0.4) { T.step = 1; doors(T, true); bell(v); alight(T, scale); }
        else if (T.step === 1 && T.t > 2.2) { T.step = 2; board(T, scale); }
        else if (T.step === 2 && T.t > 7.2) { T.step = 3; chime(v); }
        else if (T.step === 3 && T.t > 8.6) { T.step = 4; doors(T, false); horn(v); }
        else if (T.step === 4 && T.t > 9.8) { T.state = 'run'; T.next++; T.cur = null; }
      }
      T.s += T.speed * SPD * dt / scale;
      if (T.s - lenW > P.total + 10) { removeTrain(i); continue; }
      let off = 0;
      T.cars.forEach(c => {
        const Ls = c.L * FV / scale, mid = T.s - off - Ls / 2;
        off += (c.L + GAP) * FV / scale;
        const a = at(P, mid + Ls * 0.4), b = at(P, mid - Ls * 0.4);
        c.x = (a.x + b.x) / 2; c.y = (a.y + b.y) / 2;
        c.mk.setLatLng(map.unproject(c, REF_Z));
        if (a.x !== b.x || a.y !== b.y) c.h = Math.atan2(a.y - b.y, a.x - b.x);
        if (c.rot) c.rot.style.transform = `rotate(${c.h || 0}rad)`;
        if (c.wrap) { c.wrap.style.scale = FV.toFixed(3); c.wrap.style.opacity = clamp(Math.min(mid, P.total - mid) * scale / 30, 0, 1).toFixed(2); }
      });
      // Sonido según la distancia de la locomotora al centro de la pantalla
      const pt = map.latLngToContainerPoint(T.cars[0].mk.getLatLng());
      T.vol = clamp(1.2 - Math.hypot(pt.x - cx, pt.y - cy) / half, 0.08, 1) * (sfxOn() ? 1 : 0);
      if (!T.hornDone && T.s * scale > 20) { T.hornDone = true; horn(T.vol); }
      if (T.snd && ac) rollUpdate(T.snd, T.state === 'run' ? clamp(T.speed / T.vmax, 0, 1) : 0, T.vol, clamp((pt.x - cx) / cx, -1, 1) * 0.85);
    }
  }
  function updatePax(dt, scale) {
    for (let i = pax.length - 1; i >= 0; i--) {
      const p = pax[i];
      p.age += dt;
      if (!p.el) { const e = p.mk.getElement(); p.el = e && e.firstChild; }
      if (p.mode === 'in') {
        const dx = p.tx - p.x, dy = p.ty - p.y;
        if (Math.hypot(dx, dy) * scale <= 2 || p.age > p.life) { removePax(i); continue; }   // sube al tren
        p.h = Math.atan2(dy, dx);
      } else if (p.age > p.life) { removePax(i); continue; }
      const step = p.speed * dt / scale;
      p.x += Math.cos(p.h) * step; p.y += Math.sin(p.h) * step;
      p.mk.setLatLng(map.unproject(p, REF_Z));
      if (p.el) {
        p.el.style.opacity = p.mode === 'in' ? Math.min(1, p.age / 0.5) : Math.max(0, Math.min(1, p.age / 0.4, (p.life - p.age) / 1.2));
        const f = Math.cos(p.h) < 0; if (f !== p.flip) { p.flip = f; p.el.classList.toggle('flip', f); }
      }
    }
  }

  // ---------- Bucle ----------
  let running = false, last = performance.now(), timer = null, nextTrain = Date.now() + 12e3;
  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    if (!document.hidden && !zooming) {
      refresh();
      const scale = Math.pow(2, map.getZoom() - REF_Z);
      updateTrains(dt, scale); updatePax(dt, scale);
    }
    requestAnimationFrame(frame);
  }
  function tick() {
    if (!running) return;
    if (document.hidden) { while (trains.length) removeTrain(0); return; }
    const z = map.getZoom();
    if (z < MIN_ZOOM) return;
    lastChains = railChains();
    if (!lastChains.length) return;
    stationsTick(lastChains);
    const now = Date.now();
    if (now >= nextTrain && !trains.length && spawnTrain(lastChains)) nextTrain = now + rnd(60e3, 80e3);
  }
  map.on('zoomstart', () => { zooming = true; });
  map.on('zoomend', () => { zooming = false; if (map.getZoom() < MIN_ZOOM) clearAll(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); nextTrain = Math.max(nextTrain, Date.now() + 8e3); } });

  function apply() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.opacity = on ? '1' : '.55'; btn.title = on ? 'Tren: activado' : 'Tren: desactivado'; }
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); timer = setInterval(tick, 1500); }
    if (!on) { running = false; clearInterval(timer); clearAll(); }
  }
  if (btn) btn.onclick = function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) { initAudio(); nextTrain = Date.now() + 3e3; }
    apply();
  };
  window.spawnTrain = () => { if (!on) return false; initAudio(); lastChains = railChains(); if (lastChains.length) stationsTick(lastChains); return !!spawnTrain(lastChains); };
  apply();
})();
