'use strict';
// VIDA URBANA: todo lo que da densidad y "razones para mirar" al mapa. Se apaga y enciende con el botón 🏙️ del menú.
//  - Humo de chimeneas (casas), vapor en bares y restaurantes y vapor de alcantarilla en las calles.
//  - Globos de texto sobre los peatones y algunos paseando al perro.
//  - Gente con actividad en los negocios y parques: sentados en bancos y terrazas, colas en farmacia/súper, niños en el parque infantil,
//    gente entrando y saliendo de las tiendas, coches en el autoservicio y en la gasolinera.
//  - Obras en la calle (conos, excavadora, operarios) con el tráfico desviándose (ver vehicles.js).
//  - Eventos: desfile / manifestación pequeña, boda con coches decorados y ambulancia que sale de un hospital.
//  - Barrios con carácter: más tráfico y gente en zonas con muchos edificios; menos en las afueras.
//  - Sonido ambiente según el zoom (murmullo, bocinazos lejanos, campanas a las horas en punto; ver sounds.js).
// Los vehículos nuevos (basura, reparto, autoescuela, autobuses con paradas, tranvía) viven en vehicles.js.
// Para probar sin esperar, en la consola:
//   cityEvent('works' | 'parade' | 'wedding' | 'ambulance' | 'steam' | 'bubble' | 'tram' | 'garbage' | 'van' | 'driving')
(function () {
  if (typeof map === 'undefined' || !map || !map.gl || !window.L) return;
  const gl = map.gl, KEY = 'cityLifeOn', REF_Z = 17, MIN_Z = 16, ACT_Z = 16.6, RAD = Math.PI / 180;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('city-btn');
  let on = true;
  try { const s = localStorage.getItem(KEY); if (s !== null) on = s === '1'; } catch (e) {}

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
  const scaleNow = () => Math.pow(2, map.getZoom() - REF_Z);
  const fpNow = () => (map.sizes ? map.sizes().fp : 1);
  const toLL = (x, y) => map.unproject(L.point(x, y), REF_Z);
  const toXY = ll => map.project(ll, REF_Z);
  const dark = () => (window.cityDark ? window.cityDark() : 0);
  const rainy = () => (window.weatherIntensity ? window.weatherIntensity() : 0);

  // ---------- Estado compartido (lo leen vehicles.js y people.js) ----------
  const CL = window.CityLife = {
    on, zones: [], blockers: [], _m: 1, _d: 0.5,
    mult: () => (CL.on ? CL._m : 1),            // multiplicador de tráfico y gente según el barrio
    density: () => CL._d,                          // 0 = afueras, 1 = centro
    shelter: (P, s, cls, kind) => (CL.on ? addShelter(P, s, cls, kind) : null)
  };

  // ---------- Estilos ----------
  const st = document.createElement('style');
  st.textContent = `
    .cl { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .cf { position: relative; width: 16px; height: 26px; transform-origin: 8px 24px; transition: opacity .3s; }
    .cf svg { overflow: visible; display: block; }
    .cf.flip svg { transform: scaleX(-1); }
    .cf.kj { animation: clkj .55s ease-in-out infinite alternate; }
    .cf.sit { animation: clsit 2.6s ease-in-out infinite alternate; }
    @keyframes clkj { from { transform: translateY(0); } to { transform: translateY(-5px); } }
    @keyframes clsit { from { transform: translateY(0); } to { transform: translateY(-1px); } }
    .sm-in { position: relative; width: 0; height: 0; }
    .sm-in i { position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 50%; opacity: 0;
      background: radial-gradient(circle, rgba(236,236,236,.9), rgba(236,236,236,0) 70%); animation: clsm 4.4s linear infinite; }
    .sm-in.st i { background: radial-gradient(circle, rgba(255,255,255,.85), rgba(255,255,255,0) 70%); animation-duration: 3s; }
    .sm-in.vp i { width: 8px; height: 8px; animation-duration: 2.6s; }
    @keyframes clsm { 0% { transform: translate(0,0) scale(.4); opacity: 0; } 14% { opacity: .85; }
      100% { transform: translate(var(--dx,14px), -48px) scale(2.8); opacity: 0; } }
    .sm-in.vp i { animation-name: clvp; }
    @keyframes clvp { 0% { transform: translate(0,0) scale(.4); opacity: 0; } 20% { opacity: .75; } 100% { transform: translate(var(--dx,6px), -30px) scale(2.2); opacity: 0; } }
    .cb { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); white-space: nowrap; font: 700 11px system-ui, sans-serif;
      background: #fff; color: #222; padding: 2px 7px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,.35); z-index: 5; opacity: 0;
      animation: clcb 3.3s ease-in-out forwards; }
    .cb::after { content: ''; position: absolute; left: 50%; bottom: -4px; margin-left: -4px; border: 4px solid transparent; border-top-color: #fff; border-bottom: 0; }
    @keyframes clcb { 0% { opacity: 0; transform: translateX(-50%) translateY(4px); } 12%, 82% { opacity: 1; transform: translateX(-50%) translateY(0); } 100% { opacity: 0; } }
    .dgw { position: absolute; left: 20px; top: 17px; width: 18px; height: 12px; }
    .dgw svg { overflow: visible; }
    .dgw .l1 { animation: cldg .28s ease-in-out infinite alternate; }
    .dgw .l2 { animation: cldg .28s ease-in-out infinite alternate-reverse; }
    .dgw .tl { animation: cltl .25s ease-in-out infinite alternate; transform-origin: 3px 5px; }
    @keyframes cldg { from { transform: translateX(-1.4px); } to { transform: translateX(1.4px); } }
    @keyframes cltl { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }
    .pw-in .sg { position: absolute; left: 2px; top: -24px; font-size: 15px; line-height: 1; font-style: normal; }
    .cn { position: relative; width: 8px; height: 8px; }
    .cn::before { content: ''; position: absolute; inset: 0; border-radius: 50% 50% 2px 2px; background: #ff7a1a; border: 1px solid #fff; box-sizing: border-box; }
    .cn.lit::after { content: ''; position: absolute; left: 1px; top: -4px; width: 6px; height: 6px; border-radius: 50%; background: #ffcf40; box-shadow: 0 0 6px 2px rgba(255,190,40,.9); animation: clbl 1s steps(1) infinite; }
    @keyframes clbl { 50% { opacity: .15; } }
    .exa-arm { transform-origin: 20px 15px; animation: clarm 2.2s ease-in-out infinite alternate; }
    @keyframes clarm { from { transform: rotate(-14deg); } to { transform: rotate(16deg); } }
    .hp-in { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    .hp-in svg { position: absolute; left: 0; top: 0; overflow: visible; }
    @media (prefers-reduced-motion: reduce) {
      .cf.kj, .cf.sit, .dgw .l1, .dgw .l2, .dgw .tl, .exa-arm, .cn.lit::after { animation: none; }
      .sm-in i { animation: none; opacity: .3; transform: translate(0,-14px); }
    }`;
  document.head.appendChild(st);
  map.createPane('life'); const pLife = map.getPane('life'); pLife.style.zIndex = 592; pLife.style.pointerEvents = 'none';
  map.createPane('fx'); const pFx = map.getPane('fx'); pFx.style.zIndex = 640; pFx.style.pointerEvents = 'none';
  map.createPane('lifelow'); const pLow = map.getPane('lifelow'); pLow.style.zIndex = 565; pLow.style.pointerEvents = 'none';

  // ---------- Utilidades de marcadores ----------
  function mark(pane, html, w, h, ax, ay, x, y, cls) {
    const icon = L.divIcon({ className: 'cl ' + (cls || ''), iconSize: [w, h], iconAnchor: [ax, ay], html });
    const mk = L.marker(toLL(x, y), { icon, pane, interactive: false, keyboard: false }).addTo(map);
    const el = mk.getElement();
    return { mk, el, inner: el && el.firstChild, x, y };
  }
  const put = (o, x, y) => { o.x = x; o.y = y; if (o.mk) o.mk.setLatLng(toLL(x, y)); };
  const drop = o => { if (o && o.mk) { map.removeLayer(o.mk); o.mk = null; } };

  // Persona quieta (sin animación de piernas). sit: solo medio cuerpo (se ve sentada detrás de un banco o mesa)
  const SHIRTS = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703', '#06d6a0', '#ef476f'];
  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const PANTS = ['#2b2d42', '#3a3a3a', '#1d3557', '#5c4033'];
  function fig(sit, o) {
    o = o || {};
    const shirt = o.shirt || pick(SHIRTS), skin = pick(SKINS), pants = pick(PANTS);
    const legs = sit ? '' : `<rect x="5.2" y="15" width="2.4" height="9" rx="1.2" fill="${pants}"/><rect x="8.4" y="15" width="2.4" height="9" rx="1.2" fill="${pants}"/>`;
    const hat = o.hat ? `<path d="M4.2 3.4Q8 -2 11.8 3.4Z" fill="${o.hat}"/>` : '';
    return `<svg width="16" height="${sit ? 17 : 26}" viewBox="0 0 16 ${sit ? 17 : 26}" aria-hidden="true">
      ${sit ? '' : '<ellipse cx="8" cy="24.5" rx="5" ry="1.4" fill="rgba(0,0,0,.25)"/>'}${legs}
      <rect x="4" y="7" width="8" height="10" rx="3" fill="${shirt}"/>
      <rect x="2.6" y="8" width="2" height="7" rx="1" fill="${skin}"/><rect x="11.4" y="8" width="2" height="7" rx="1" fill="${skin}"/>
      <circle cx="8" cy="4" r="3.4" fill="${skin}"/>${hat}</svg>`;
  }
  const figHTML = (sit, o, cls) => `<div class="cf ${cls || ''}" style="opacity:0">${fig(sit, o)}</div>`;

  // ---------- Calles: un punto cualquiera sobre una calle visible ----------
  function roadSpot(len, minLen, margin) {
    if (!window.roadRoute) return null;
    const rr = window.roadRoute({ inside: true, len, minLen });
    if (!rr || !rr.starts || !rr.starts.length) return null;
    const P = rr.path, sc = scaleNow(), m = (margin || 0) / sc;
    const ok = rr.starts.filter(s => s > m && P.total - s > m);
    if (!ok.length) return null;
    return { P, s: pick(ok) };
  }
  function atPath(P, s) {
    s = clamp(s, 0, P.total);
    let i = 0; while (i < P.pts.length - 2 && P.cum[i + 1] < s) i++;
    const a = P.pts[i], b = P.pts[i + 1], len = (P.cum[i + 1] - P.cum[i]) || 1, t = clamp((s - P.cum[i]) / len, 0, 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, cls: P.cl ? P.cl[Math.min(i + 1, P.cl.length - 1)] : 'minor' };
  }

  // ---------- Objetos fijos sobre la calle (conos, paradas, obras…): se recolocan al cambiar el zoom ----------
  const statics = new Set();
  function placeStatic(o) {
    if (!o.P) return;                                          // objetos sueltos (mesas, bancos): ya están en su sitio
    const sc = scaleNow(), half = map.roadMetrics(o.cls || 'minor').half;
    const b = atPath(o.P, o.s + o.ds / sc), nx = -b.dy, ny = b.dx, off = (o.side * half + (o.px || 0)) / sc;
    put(o.m, b.x + nx * off, b.y + ny * off);
    if (o.rot && o.m.inner) o.m.inner.style.rotate = Math.atan2(b.dy, b.dx) + 'rad';
  }
  function addStatic(P, s, cls, ds, side, px, html, w, h, o2) {
    const m = mark(o2 && o2.pane || 'lifelow', html, w, h, w / 2, h / 2, 0, 0);
    if (m.inner) m.inner.style.scale = fpNow().toFixed(3);
    const o = Object.assign({ P, s, cls, ds, side, px, m }, o2 || {});
    if (P) placeStatic(o);
    statics.add(o); return o;
  }
  function dropStatic(o) { drop(o.m); statics.delete(o); }

  // ---------- Paradas de autobús y tranvía ----------
  const shelters = [];
  function addShelter(P, s, cls, kind) {
    if (shelters.length >= 6) dropShelter(shelters[0]);
    const tram = kind === 'tram';
    const svg = tram
      ? `<svg width="40" height="12" viewBox="0 0 40 12"><rect x="0" y="1" width="40" height="10" rx="2" fill="#9aa3ad" stroke="#59616b"/><rect x="3" y="3" width="34" height="6" rx="1" fill="#c8ced6"/><rect x="16" y="0" width="8" height="3" fill="#d62839"/></svg>`
      : `<svg width="26" height="12" viewBox="0 0 26 12"><rect x="0" y="1" width="26" height="9" rx="2" fill="rgba(120,170,220,.6)" stroke="#3b5f8a"/><rect x="3" y="6" width="20" height="2" rx="1" fill="#7a5230"/><rect x="21" y="-3" width="3" height="6" fill="#1d6fb8"/></svg>`;
    const o = addStatic(P, s, cls, 0, 1.18, tram ? 6 : 3, `<div>${svg}</div>`, tram ? 40 : 26, 12, { rot: true });
    o.until = performance.now() + 75e3; shelters.push(o); return o;
  }
  function dropShelter(o) { const i = shelters.indexOf(o); if (i >= 0) shelters.splice(i, 1); dropStatic(o); }

  // ---------- Humo y vapor ----------
  const puffs = (n, spread) => { let s = ''; for (let k = 0; k < n; k++) s += `<i style="--dx:${(rnd(-spread, spread)).toFixed(1)}px;animation-delay:${(-k * (4.4 / n)).toFixed(2)}s"></i>`; return s; };

  // ---------- Parcelas con actividad ----------
  const scenes = new Map();
  const actors = [];
  const keyOf = url => String(url || '').split('/').pop().replace(/\.[a-z]+$/i, '').toLowerCase();
  function kindOf(k) {
    if (/^(casa|choza)/.test(k)) return 'home';
    if (k === 'parque-infantil') return 'play';
    if (/^(parque|jardin|bosque|cesped|cesped-2|parque-picnic|parque-futbol|prado|claro-bosque)$/.test(k)) return 'park';
    if (/^(farmacia|supermercado)$/.test(k)) return 'shop';
    if (/^gasolinera$/.test(k)) return 'gas';
    if (/^iglesia/.test(k)) return 'church';
    if (/^restaurante$/.test(k)) return 'bar';
    return null;
  }
  const P_ = (sc, u, v) => ({ x: sc.cx + u * sc.hw, y: sc.cy + v * sc.hh });

  function mkActor(sc, html, w, h, ax, ay, x, y, o2) {
    const o = mark('life', html, w, h, ax, ay, x, y);
    const a = Object.assign({ o, x, y, tx: null, ty: null, sp: 18, op: 0, opT: 1, kill: false, sc, k: 1, flip: null }, o2 || {});
    if (o.inner) o.inner.style.scale = (fpNow() * a.k).toFixed(3);
    actors.push(a); if (sc) sc.actors.push(a);
    return a;
  }
  function person(sc, x, y, o2, sit, opt, cls) { return mkActor(sc, figHTML(sit, opt, cls), 16, sit ? 17 : 26, 8, sit ? 15 : 24, x, y, o2); }
  const carV = c => `<svg width="14" height="28" viewBox="0 0 14 28" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="26" rx="4" fill="rgba(0,0,0,.25)"/>
    <rect x=".5" y=".5" width="13" height="27" rx="4" fill="${c}" stroke="rgba(0,0,0,.5)"/><rect x="2" y="13" width="10" height="7" rx="1.5" fill="rgba(255,255,255,.35)"/>
    <rect x="2" y="21" width="10" height="3" rx="1" fill="#26364f"/><rect x="1.5" y="25.5" width="3" height="2" fill="#ffe9a0"/><rect x="9.5" y="25.5" width="3" height="2" fill="#ffe9a0"/></svg>`;
  const CARCOL = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703', '#e9ecef', '#3b4148', '#1d3557'];
  function disposeActor(a) { drop(a.o); const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); if (a.sc) { const j = a.sc.actors.indexOf(a); if (j >= 0) a.sc.actors.splice(j, 1); } }
  function fadeOut(a) { a.opT = 0; a.kill = true; }

  function stepActors(dt) {
    const sc = scaleNow(), fp = fpNow();
    for (let i = actors.length - 1; i >= 0; i--) {
      const a = actors[i];
      if (a.tx != null) {
        const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), step = a.sp * fp * dt / sc;
        if (d <= step) {
          put(a.o, a.tx, a.ty); a.tx = null;
          if (a.onArrive) { const f = a.onArrive; a.onArrive = null; f(a); }
        } else {
          put(a.o, a.x + dx / d * step, a.y + dy / d * step);
          if (!a.fixed && Math.abs(dx) > 0.02 && a.o.inner) { const f = dx < 0; if (f !== a.flip) { a.flip = f; a.o.inner.classList.toggle('flip', f); } }
        }
      }
      a.op += clamp(a.opT - a.op, -dt / 0.5, dt / 0.5);
      if (a.o.inner) a.o.inner.style.opacity = a.op.toFixed(2);
      if (a.kill && a.op <= 0.02) disposeActor(a);
    }
  }
  let lastFp = 0, lastZ = 0;
  function rescale() {
    const fp = fpNow();
    actors.forEach(a => { if (a.o.inner) a.o.inner.style.scale = (fp * a.k).toFixed(3); });
    statics.forEach(o => { if (o.m.inner) o.m.inner.style.scale = fp.toFixed(3); placeStatic(o); });
    hosp.forEach(e => { if (e.m && e.m.inner) e.m.inner.style.scale = scaleNow().toFixed(4); });
    updateWorksZone();
  }

  // ----- Escenas por tipo de parcela -----
  const INIT = {
    home(sc, d) {
      if (hashStr(sc.id) % 100 > 58) return;                      // no todas las casas tienen chimenea encendida
      const o = mark('fx', `<div class="sm-in">${puffs(4, 16)}</div>`, 0, 0, 0, 0, sc.cx + sc.hw * 0.22, sc.cy - sc.hh * 0.12);
      sc.smoke = o; sc.hM = (typeof heightOf === 'function') ? heightOf(d.url, d.level || 1) : 9;
    },
    bar(sc, d) {
      const o = mark('fx', `<div class="sm-in st">${puffs(3, 10)}</div>`, 0, 0, 0, 0, sc.cx - sc.hw * 0.25, sc.cy - sc.hh * 0.1);
      sc.smoke = o; sc.hM = (typeof heightOf === 'function') ? heightOf(d.url, d.level || 1) : 8;
      for (const u of [-0.42, 0.42]) {                            // terraza: mesa con dos personas
        const p = P_(sc, u, 0.62);
        const t = addStatic(null, 0, 'minor', 0, 0, 0, '<div style="width:12px;height:12px;border-radius:50%;background:#e8dcc4;border:1.5px solid #7a5230;box-sizing:border-box"></div>', 12, 12, {});
        put(t.m, p.x, p.y); sc.statics.push(t);
        [-1, 1].forEach(sd => person(sc, p.x + sd * 7 / scaleNow(), p.y - 3 / scaleNow(), { fixed: true }, true, null, 'sit'));
      }
      sc.timer = rnd(2, 5);
    },
    park(sc) {
      [[-0.45, 0.35], [0.4, -0.1]].forEach(([u, v]) => {
        const p = P_(sc, u, v);
        const b = addStatic(null, 0, 'minor', 0, 0, 0, '<div style="width:20px;height:6px;border-radius:2px;background:#8a5a2b;border:1px solid #4d3216;box-sizing:border-box"></div>', 20, 6, {});
        put(b.m, p.x, p.y); sc.statics.push(b);
        const n = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let k = 0; k < n; k++) person(sc, p.x + (k ? 7 : -3) / scaleNow(), p.y - 5 / scaleNow(), { fixed: true }, true, null, 'sit');
      });
    },
    play(sc) {
      for (let k = 0; k < (SMALL ? 3 : 4); k++) {
        const p = P_(sc, rnd(-0.4, 0.4), rnd(-0.2, 0.45));
        const a = person(sc, p.x, p.y, { k: 0.62, sp: 22 }, false, { shirt: pick(['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#ff924c']) }, 'kj');
        if (a.o.inner) a.o.inner.style.animationDelay = (-rnd(0, 0.6)).toFixed(2) + 's';
      }
      sc.timer = rnd(2, 4);
    },
    shop(sc) { sc.q = []; sc.timer = rnd(1, 3); sc.timer2 = rnd(3, 6); for (let i = 0; i < 2; i++) { const t = slot(sc, i); const a = person(sc, t.x, t.y, { sp: 20 }); sc.q.push(a); } },
    drive(sc) { sc.state = 'idle'; sc.timer = rnd(1, 4); sc.timer2 = rnd(4, 8); },
    gas(sc) { sc.state = 'idle'; sc.timer = rnd(1, 4); }
  };
  function slot(sc, i) { const d = P_(sc, 0, 0.42), sp = scaleNow(), fp = fpNow(); return { x: d.x, y: d.y + (13 + i * 14) * fp / sp }; }

  function visitor(sc) {                                           // alguien entra o sale por la puerta
    const door = P_(sc, 0, 0.42), scl = scaleNow(), fp = fpNow(), away = { x: door.x + rnd(-1, 1) * 35 / scl, y: door.y + 46 * fp / scl };
    if (Math.random() < 0.5) { const a = person(sc, door.x, door.y, { sp: 20, onArrive: fadeOut }); a.tx = away.x; a.ty = away.y; }
    else { const a = person(sc, away.x, away.y, { sp: 20, onArrive: fadeOut }); a.tx = door.x; a.ty = door.y; }
  }
  const TICK = {
    play(sc, dt) {
      sc.timer -= dt;
      if (sc.timer <= 0 && sc.actors.length) { sc.timer = rnd(1.5, 3.5); const a = pick(sc.actors), p = P_(sc, rnd(-0.4, 0.4), rnd(-0.2, 0.45)); a.tx = p.x; a.ty = p.y; }
    },
    shop(sc, dt) {
      sc.timer -= dt;
      if (sc.timer <= 0) {
        sc.timer = rnd(5, 9);
        const f = sc.q.shift(), door = P_(sc, 0, 0.42);
        if (f) { f.tx = door.x; f.ty = door.y; f.onArrive = fadeOut; }
        if (sc.q.length < 4) {
          const t = slot(sc, sc.q.length), scl = scaleNow(), a = person(sc, t.x + 38 / scl, t.y + 28 / scl, { sp: 22 });
          a.tx = t.x; a.ty = t.y; sc.q.push(a);
        }
      }
      sc.q.forEach((a, i) => { const t = slot(sc, i); if (Math.hypot(a.x - t.x, a.y - t.y) * scaleNow() > 1 && a.tx == null && !a.kill) { a.tx = t.x; a.ty = t.y; } });
      sc.timer2 -= dt; if (sc.timer2 <= 0) { sc.timer2 = rnd(4, 9); visitor(sc); }
    },
    home(sc, dt) { sc.timer -= dt; if (sc.timer <= 0) { sc.timer = rnd(14, 30); visitor(sc); } },   // de vez en cuando alguien entra o sale de casa
    church(sc, dt) {                                               // iglesia: gente que entra y sale, y de vez en cuando sale un grupo (fin de misa)
      sc.timer -= dt; if (sc.timer <= 0) { sc.timer = rnd(6, 12); visitor(sc); }
      sc.timer2 -= dt;
      if (sc.timer2 <= 0) { sc.timer2 = rnd(45, 75); const n = SMALL ? 3 : 4; for (let i = 0; i < n; i++) setTimeout(() => { if (scenes.get(sc.id) === sc) visitor(sc); }, i * 700); }
    },
    bar(sc, dt) { sc.timer -= dt; if (sc.timer <= 0) { sc.timer = rnd(5, 10); visitor(sc); } },
    drive(sc, dt) {                                                // autoservicio: llega un coche, espera en la ventanilla y se va
      sc.timer -= dt;
      if (sc.timer > 0) return;
      if (sc.state === 'idle') {
        const a = mkActor(sc, `<div class="cf" style="opacity:0;width:14px;height:28px">${carV(pick(CARCOL))}</div>`, 14, 28, 7, 14, 0, 0, { sp: 34, fixed: true, k: 1.05 });
        const s0 = P_(sc, 0.62, -0.95), w = P_(sc, 0.62, 0.05); put(a.o, s0.x, s0.y); a.tx = w.x; a.ty = w.y;
        a.onArrive = () => { sc.state = 'serve'; sc.timer = rnd(5, 8); }; sc.car = a; sc.state = 'in'; sc.timer = 0.01;
      } else if (sc.state === 'serve') {
        const e = P_(sc, 0.62, 1.05); sc.car.tx = e.x; sc.car.ty = e.y; sc.car.onArrive = fadeOut; sc.state = 'out'; sc.timer = rnd(4, 7);
      } else if (sc.state === 'out') { sc.state = 'idle'; sc.timer = rnd(1, 3); }
      else sc.timer = 0.3;
      sc.timer2 -= dt; if (sc.timer2 <= 0) { sc.timer2 = rnd(5, 10); visitor(sc); }
    },
    gas(sc, dt) {                                                  // gasolinera: un coche repostando con su conductor
      sc.timer -= dt;
      if (sc.timer > 0) return;
      if (sc.state === 'idle') {
        const a = mkActor(sc, `<div class="cf" style="opacity:0;width:14px;height:28px">${carV(pick(CARCOL))}</div>`, 14, 28, 7, 14, 0, 0, { sp: 30, fixed: true, k: 1.05 });
        const s0 = P_(sc, -0.45, -0.95), w = P_(sc, -0.45, 0.05); put(a.o, s0.x, s0.y); a.tx = w.x; a.ty = w.y;
        a.onArrive = () => {
          sc.state = 'serve'; sc.timer = rnd(9, 13);
          const sp = scaleNow(); sc.man = person(sc, a.x + 14 / sp, a.y + 4 / sp, { fixed: true }, false, { shirt: pick(SHIRTS) });
        };
        sc.car = a; sc.state = 'in'; sc.timer = 0.01;
      } else if (sc.state === 'serve') {
        if (sc.man) fadeOut(sc.man); sc.man = null;
        const e = P_(sc, -0.45, 1.05); sc.car.tx = e.x; sc.car.ty = e.y; sc.car.onArrive = fadeOut; sc.state = 'out'; sc.timer = rnd(4, 7);
      } else if (sc.state === 'out') { sc.state = 'idle'; sc.timer = rnd(2, 5); }
      else sc.timer = 0.3;
    }
  };

  function disposeScene(sc) {
    sc.actors.slice().forEach(disposeActor);
    sc.statics.forEach(dropStatic);
    drop(sc.smoke);
    scenes.delete(sc.id);
  }
  function scanScenes() {
    if (!on || map.getZoom() < ACT_Z || typeof ownedFeatures === 'undefined' || typeof drawn === 'undefined' || typeof cfg === 'undefined' || !cfg || !cfg.size) {
      scenes.forEach(disposeScene); return;
    }
    const view = map.getBounds(), size = map.getSize(), cands = [];
    ownedFeatures.forEach((f, id) => {
      const pr = f.properties, ll = { lat: pr.clat, lng: pr.clng };
      if (!view.contains(ll)) return;
      const d = drawn.get(id); if (!d) return;
      const kind = kindOf(keyOf(d.url)); if (!kind) return;
      const p = map.latLngToContainerPoint(ll), dist = Math.hypot(p.x - size.x / 2, p.y - size.y / 2);
      cands.push({ id, kind, pr, d, dist });
    });
    cands.sort((a, b) => a.dist - b.dist);
    const pc = n => window.Perf ? Perf.cap(n, 2) : n;           // modo ligero (ligero.js)
    const capHome = pc(SMALL ? 5 : 9), capAct = pc(SMALL ? 5 : 9);
    let nh = 0, na = 0; const want = new Set();
    for (const c of cands) {
      if (c.kind === 'home') { if (nh >= capHome) continue; nh++; } else { if (na >= capAct) continue; na++; }
      want.add(c.id);
      if (!scenes.has(c.id)) {
        const cx = toXY({ lat: c.pr.clat, lng: c.pr.clng }), hw = cfg.size / 360 * 256 * Math.pow(2, REF_Z) / 2;
        const sc = { id: c.id, kind: c.kind, cx: cx.x, cy: cx.y, hw: hw * 0.8, hh: hw / Math.cos(c.pr.clat * RAD) * 0.8, actors: [], statics: [], smoke: null, hM: 9, timer: 1, timer2: 1 };
        scenes.set(c.id, sc);
        if (INIT[c.kind]) INIT[c.kind](sc, c.d);
      }
    }
    scenes.forEach(sc => { if (!want.has(sc.id)) disposeScene(sc); });
  }
  function smokeRoof() {                                           // el humo sube por encima del tejado cuando el mapa está inclinado
    const pitch = gl.getPitch() * RAD, k = map.pxPerM(), fp = fpNow();
    scenes.forEach(sc => {
      const o = sc.smoke; if (!o || !o.inner) return;
      o.inner.style.translate = `0 ${(-(sc.hM || 9) * k * Math.sin(pitch)).toFixed(1)}px`;
      o.inner.style.scale = clamp(fp * 1.1, 0.5, 1.6).toFixed(2);
      o.inner.style.opacity = (1 - 0.35 * dark()).toFixed(2);
    });
  }

  // ---------- Vapor de alcantarilla ----------
  const vents = [];
  function steamVent() {
    if (vents.length >= (SMALL ? 2 : 3)) return false;
    const sp = roadSpot(220, 70, 20); if (!sp) return false;
    const b = atPath(sp.P, sp.s), nx = -b.dy, ny = b.dx, off = map.roadMetrics(b.cls).half * 0.4 / scaleNow();
    const o = mark('fx', `<div class="sm-in vp">${puffs(3, 6)}</div>`, 0, 0, 0, 0, b.x + nx * off, b.y + ny * off);
    if (o.inner) o.inner.style.scale = clamp(fpNow() * 1.1, 0.5, 1.5).toFixed(2);
    vents.push({ o, until: performance.now() + rnd(18, 30) * 1000 });
    return true;
  }

  // ---------- Globos de texto y perros ----------
  const bubbles = [];
  // Nombres de los jugadores: los de los terrenos que se ven en pantalla (los vecinos de verdad) más una muestra de todos los jugadores del juego
  // que pide el servidor (/api/names, se renueva solo, así los jugadores nuevos también salen). Los peatones los dicen en sus frases.
  let allNames = [], namesAt = 0;
  async function loadNames() {
    namesAt = Date.now();
    try { const j = await api('/api/names'); if (j && Array.isArray(j.names)) allNames = j.names.filter(n => typeof n === 'string' && n.length <= 24); } catch (e) {}
  }
  function nearNames() {
    const out = [];
    if (typeof drawn !== 'undefined') drawn.forEach(d => { if (d && d.p && d.p.owner && out.indexOf(d.p.owner) < 0) out.push(d.p.owner); });
    return out;
  }
  let lastName = '';
  function someName() {
    if (Date.now() - namesAt > 240000) loadNames();
    const near = nearNames();
    const pool = near.length && (Math.random() < 0.6 || !allNames.length) ? near : allNames;
    if (!pool.length) return '';
    let n = pick(pool), t = 0;
    while (n === lastName && pool.length > 1 && ++t < 6) n = pick(pool);
    return (lastName = n);
  }
  const NAMED = [
    'Hola {n}, ¿cómo estás?', 'Por fin volviste, {n}', '¡{n}! ¡Cuánto tiempo!', 'Vaya, {n}, ya tienes más casas que yo', 'Te llevo en coche, {n}',
    'Vamos al súper, {n} 🛒', '{n}, ¿quedamos luego?', '¡Qué casa más bonita la de {n}! 🏠', 'Dicen que {n} ha subido de nivel ⭐', 'Buenos días, {n} ☀️',
    '{n}, ¿tomamos un café? ☕', 'Ayer vi a {n} por aquí', '¿Sabes algo de {n}?', 'Qué buen vecino es {n}', 'Me encanta el terreno de {n} 😍',
    '¡Eh, {n}! ¡Espérame!', '{n}, ¡te invito a cenar! 🍽️', 'Mira, ahí va {n} 👋', 'A {n} le salen las cuentas, y bien', 'Oye {n}, ¿me dejas tu parcela? 😄',
    '¡Felicidades, {n}! 🎉', '{n}, ¡qué ganas de verte!', 'Voy a casa de {n}', 'Cuando sea mayor quiero ser como {n}', '{n} me prometió una barbacoa 🍖',
    'Saluda a {n} de mi parte', '¿Has visto el barrio de {n}? Impresionante', 'Hoy toca paseo con {n} 🚶', '¡Qué suerte tiene {n}! 🍀', '{n}, ¿vienes al parque? 🌳',
    'Pásate por mi casa, {n}', 'Esto se lo cuento a {n} 🤫', 'Anda, {n}, ¡qué sorpresa!', 'Te echaba de menos, {n} 🤗', '{n} es el rey del barrio 👑', '{n}, ¡me debes un café!'
  ];
  function phrase() {
    const r = rainy();
    if (r > 0.25) return pick(['¡Qué chaparrón!', '☔', 'Me estoy empapando', 'Menos mal que traje paraguas', '🌧️']);
    const n = Math.random() < 0.65 ? someName() : '';
    if (n) return pick(NAMED).replace(/\{n\}/g, n);
    if (dark() > 0.6) return pick(['Qué tarde es…', '🌙', 'A casa, que ya es hora', '😴', '¿Qué cenamos?', '✨']);
    return pick(['¡Qué buen día!', 'Llego tarde', '🎵', '☕', '¡Hola!', '¿Dónde aparco?', 'Voy al súper 🛒', 'Qué bonito el barrio', '😄', 'Tengo hambre 🍔', '¡Qué calor!', '📱', '¡Feliz día!', 'Mira qué casas 🏠', '🐶', 'Quedamos luego']);
  }
  function bubble(force) {
    const ws = window.peopleWalkers;
    if (!ws || !ws.length || map.getZoom() < 16.8 || (!force && bubbles.length >= (SMALL ? 2 : 3))) return false;
    const view = map.getBounds();
    const c = ws.filter(w => w.age > 3 && w.age < w.life - 5 && !w.cb && w.mk && view.contains(map.unproject(L.point(w.x, w.y), REF_Z)));
    if (!c.length) return false;
    const w = pick(c), el = w.mk.getElement(); if (!el) return false;
    const txt = phrase(), b = document.createElement('div'); b.className = 'cb'; b.textContent = txt; el.appendChild(b); w.cb = b;
    if (window.atlasVoice && !window.earthMuted) window.atlasVoice.speak(txt.replace(/[_.]+/g, ' '), w.vp || (w.vp = window.atlasVoice.profile('human')), { vol: 0.85 });   // el peatón dice su frase en voz alta (voices.js)
    bubbles.push({ w, b, until: performance.now() + 3400 });
    return true;
  }
  const DOGC = [['#c8a165', '#7a5230'], ['#2b2b2b', '#111'], ['#e8e0d0', '#9a8f7a'], ['#d9822b', '#8a4b12'], ['#8d8d8d', '#555']];
  function dogSVG() {
    const [c, d] = pick(DOGC);
    return `<div class="dgw"><svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true">
      <path d="M3 5L-8 -1" stroke="#c0392b" stroke-width=".9" fill="none"/>
      <rect class="l1" x="5" y="7.5" width="1.7" height="3.6" rx=".8" fill="${d}"/><rect class="l2" x="11" y="7.5" width="1.7" height="3.6" rx=".8" fill="${d}"/>
      <ellipse cx="9" cy="6" rx="6" ry="3.2" fill="${c}"/><circle cx="15" cy="4.6" r="2.6" fill="${c}"/>
      <path d="M16.2 2.6L17.8 .5L18.4 3.2Z" fill="${d}"/><circle cx="16.3" cy="4.4" r=".55" fill="#111"/>
      <path class="tl" d="M3.4 5Q.8 2.5 1.8 .4" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg></div>`;
  }
  const dogs = [];
  function addDog() {
    const ws = window.peopleWalkers;
    if (!ws || dogs.length >= (SMALL ? 2 : 4) || map.getZoom() < 16.5) return;
    const c = ws.filter(w => w.age < 12 && !w.dog && w.mk && w.mk.getElement());
    if (!c.length) return;
    const w = pick(c), inner = w.mk.getElement().firstChild; if (!inner) return;
    const wrap = document.createElement('div'); wrap.innerHTML = dogSVG(); const dg = wrap.firstChild;
    inner.appendChild(dg); w.dog = dg; dogs.push({ w, dg, f: null });
  }
  function dogsTick() {
    for (let i = dogs.length - 1; i >= 0; i--) {
      const d = dogs[i], ws = window.peopleWalkers || [];
      if (ws.indexOf(d.w) < 0 || !d.w.mk) { dogs.splice(i, 1); continue; }   // el peatón ya se fue: el perro se va con él
      const f = !!d.w.flip;
      if (f !== d.f) { d.f = f; d.dg.style.left = f ? '-17px' : '20px'; }
    }
  }

  // ---------- Obras ----------
  let works = null;
  function updateWorksZone() {
    if (!works) return;
    const sc = scaleNow(), b = atPath(works.P, works.s);
    works.zone.x = b.x; works.zone.y = b.y; works.zone.dx = b.dx; works.zone.dy = b.dy; works.zone.r = 130 / sc;
  }
  function startWorks() {
    if (works) return false;
    const sp = roadSpot(700, 320, 110); if (!sp) return false;
    const { P, s } = sp, b = atPath(P, s), cls = b.cls, objs = [];
    for (let ds = -48; ds <= 48; ds += 19) {                                   // conos cortando el carril de la derecha
      const lit = dark() > 0.4;
      objs.push(addStatic(P, s, cls, ds, 0.62, 0, `<div class="cn${lit ? ' lit' : ''}"></div>`, 8, 8, {}));
    }
    objs.push(addStatic(P, s, cls, -76, 0.7, 0, '<svg width="22" height="8" viewBox="0 0 22 8"><rect x="0" y="1" width="22" height="6" rx="1" fill="#fff" stroke="#b21f2d"/><path d="M2 7L6 1M8 7L12 1M14 7L18 1" stroke="#d62839" stroke-width="2"/></svg>', 22, 8, { rot: true }));
    objs.push(addStatic(P, s, cls, 0, 1.55, 6, `<svg width="46" height="26" viewBox="0 0 46 26" aria-hidden="true">
      <rect x="1" y="9" width="26" height="14" rx="3" fill="#f2b705" stroke="#8a6500"/><rect x="3" y="21" width="22" height="4" rx="2" fill="#333"/>
      <rect x="5" y="11" width="11" height="9" rx="2" fill="#26364f"/><rect x="17" y="12" width="8" height="7" rx="1" fill="#d99e00"/>
      <g class="exa-arm"><rect x="18" y="13" width="26" height="3.2" rx="1.5" fill="#d99e00" stroke="#8a6500" stroke-width=".6"/><path d="M40 12L46 18L40 20Z" fill="#555"/></g></svg>`, 46, 26, { rot: true }));
    [-22, 26].forEach(ds => objs.push(addStatic(P, s, cls, ds, 1.2, 0, `<div class="cf" style="width:16px;height:26px">${fig(false, { shirt: '#ffb703', hat: '#f4d03f' })}</div>`, 16, 26, { pane: 'life' })));
    const zone = { x: b.x, y: b.y, dx: b.dx, dy: b.dy, r: 130 / scaleNow() };
    CL.zones.push(zone);
    works = { P, s, objs, zone, until: performance.now() + rnd(120, 170) * 1000 };
    return true;
  }
  function endWorks() {
    if (!works) return;
    works.objs.forEach(dropStatic);
    const i = CL.zones.indexOf(works.zone); if (i >= 0) CL.zones.splice(i, 1);
    works = null;
  }

  // ---------- Desfile / manifestación ----------
  let parade = null;
  const SIGNS_P = ['🎈', '🚩', '🎺', '🎉'], SIGNS_M = ['🌳', '🚲', '🐶', '📢', '🌍'];
  const SAYS_P = ['¡Viva el barrio! 🎉', '¡Fiesta! 🎶', '¡Que vivan los vecinos!'], SAYS_M = ['¡Más parques! 🌳', '¡Más carriles bici! 🚲', '¡Queremos más bancos!'];
  function startParade() {
    if (parade || !window.personSVG) return false;
    const sp = roadSpot(900, 460, 40); if (!sp) return false;
    const { P } = sp, sc = scaleNow(), fest = Math.random() < 0.5, n = SMALL ? 6 : 9, members = [];
    const s0 = Math.min(P.total * 0.55, Math.max(30 / sc, sp.s));
    for (let i = 0; i < n; i++) {
      const sg = pick(fest ? SIGNS_P : SIGNS_M), sh = pick(SHIRTS), sk = pick(SKINS), pn = pick(PANTS);
      const html = `<div class="pw-in" style="opacity:0">${window.personSVG(sh, sk, pn, false)}<i class="sg">${sg}</i></div>`;
      const o = mark('life', html, 20, 30, 10, 28, 0, 0, 'pw');
      if (o.inner) o.inner.style.scale = fpNow().toFixed(3);
      members.push({ o, ds: -i * 15 - (i > 0 ? rnd(0, 6) : 0), lat: (i % 2 ? 1 : -1) * rnd(0.12, 0.3), flip: null });
    }
    parade = { P, s: s0, members, until: performance.now() + 75e3, blk: [] };
    const lead = members[0]; setTimeout(() => { if (parade && lead.o.el) { const b = document.createElement('div'); b.className = 'cb'; b.textContent = pick(fest ? SAYS_P : SAYS_M); lead.o.el.appendChild(b); setTimeout(() => b.remove(), 3500); } }, 1500);
    return true;
  }
  function paradeTick(dt) {
    const p = parade, sc = scaleNow(), fp = fpNow();
    p.s += 12 * fp * dt / sc;
    const half = map.roadMetrics('minor').half, blk = [];
    let allEnd = true;
    p.members.forEach(m => {
      const s = p.s + m.ds * fp / sc;
      if (s < p.P.total) allEnd = false;
      const b = atPath(p.P, s), off = m.lat * half / sc;
      const x = b.x - b.dy * off, y = b.y + b.dx * off;
      put(m.o, x, y); blk.push({ x, y });
      if (m.o.inner) {
        const f = b.dx < 0; if (f !== m.flip) { m.flip = f; m.o.inner.classList.toggle('flip', f); }
        m.o.inner.style.opacity = clamp(Math.min(s * sc / 40, (p.P.total - s) * sc / 40, (p.until - performance.now()) / 1500, 1), 0, 1).toFixed(2);
        m.o.inner.style.scale = fp.toFixed(3);
      }
    });
    CL.blockers = blk;
    if (allEnd || performance.now() > p.until) endParade();
  }
  function endParade() { if (!parade) return; parade.members.forEach(m => drop(m.o)); parade = null; CL.blockers = []; }

  // ---------- Hospital (fijo en el mundo, en solares libres) y su ambulancia ----------
  const H_CELL = 0.006, H_RATE = 0.16, H_TRIES = 4, H_M = 56, H_LAYERS = ['st-road', 'st-buildings', 'st-water', 'st-waterway'];
  const hosp = new Map();
  const hu = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const hCand = (e, k) => ({ lat: (e.iy + 0.15 + 0.7 * hu(e.ix, e.iy, 30 + 2 * k)) * H_CELL - 90, lng: (e.ix + 0.15 + 0.7 * hu(e.ix, e.iy, 31 + 2 * k)) * H_CELL - 180 });
  const HSVG = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x="8" y="10" width="92" height="90" rx="6" fill="rgba(0,0,0,.25)"/><rect x="3" y="3" width="94" height="94" rx="6" fill="#f3f5f7" stroke="#9aa6b2" stroke-width="2"/>
    <rect x="3" y="3" width="94" height="20" rx="6" fill="#d8e4f0"/><rect x="12" y="30" width="52" height="58" rx="3" fill="#e4e9ee" stroke="#b6c0ca"/>
    <path d="M30 52H46M38 44V60" stroke="#d62839" stroke-width="7" stroke-linecap="round"/><rect x="70" y="30" width="20" height="58" rx="3" fill="#cdd6de"/>
    <text x="80" y="64" font-size="18" font-weight="800" fill="#1d6fb8" text-anchor="middle" font-family="system-ui,sans-serif">H</text></svg>`;
  function hospCheck(e, k) {
    const c = hCand(e, k), size = map.getSize(), rpx = (H_M / 2 + 3) * map.pxPerM(), p = map.latLngToContainerPoint(c);
    if (p.x - rpx < 0 || p.y - rpx < 0 || p.x + rpx > size.x || p.y + rpx > size.y || !gl.areTilesLoaded()) return null;
    try {
      const layers = H_LAYERS.filter(l => gl.getLayer(l)); if (!layers.length) return null;
      return gl.queryRenderedFeatures([[p.x - rpx, p.y - rpx], [p.x + rpx, p.y + rpx]], { layers }).length === 0;
    } catch (err) { return null; }
  }
  function hospOwned(ll) {
    try {
      if (typeof drawn === 'undefined' || typeof cfg === 'undefined' || !cfg || !cfg.size) return false;
      const r = H_M / 2 / 111320, rx = r / Math.max(0.1, Math.cos(ll.lat * RAD)), sz = cfg.size;
      for (const dy of [-r, 0, r]) for (const dx of [-rx, 0, rx]) if (drawn.has(Math.floor((ll.lng + dx + 180) / sz) + ':' + Math.floor((ll.lat + dy + 90) / sz))) return true;
    } catch (e) {}
    return false;
  }
  function hospShow(e) {
    if (e.m) return;
    const S = H_M / (40075016.686 * Math.cos(e.ll.lat * RAD) / (256 * Math.pow(2, REF_Z)));
    e.S = S; e.m = mark('lifelow', `<div class="hp-in">${HSVG}</div>`, S, S, S / 2, S / 2, 0, 0);
    e.m.mk.setLatLng(e.ll); if (e.m.inner) e.m.inner.style.scale = scaleNow().toFixed(4);
  }
  const hospHide = e => { drop(e.m); e.m = null; };
  let hospT = 0;
  function hospTick(dt, z) {
    hospT -= dt; if (hospT > 0) return; hospT = 1;
    if (z < MIN_Z - 0.5) { hosp.forEach(hospHide); return; }
    const b = map.getBounds(), q = b.pad(0.1), keep = b.pad(0.6);
    const x0 = Math.floor((q.getWest() + 180) / H_CELL), x1 = Math.floor((q.getEast() + 180) / H_CELL), y0 = Math.floor((q.getSouth() + 90) / H_CELL), y1 = Math.floor((q.getNorth() + 90) / H_CELL);
    let budget = 3;
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      if (hu(ix, iy, 21) >= H_RATE) continue;
      const key = ix + ':' + iy; let e = hosp.get(key);
      if (!e) hosp.set(key, e = { ix, iy, state: 'pending', k: 0, ll: null, m: null });
      while (e.state === 'pending' && budget > 0 && z >= MIN_Z) {
        const r = hospCheck(e, e.k); if (r === null) break; budget--;
        if (r) { e.state = 'ok'; e.ll = hCand(e, e.k); } else if (++e.k >= H_TRIES) e.state = 'none';
      }
      if (e.state === 'ok') { if (!hospOwned(e.ll)) hospShow(e); else hospHide(e); }
    }
    hosp.forEach(e => { if (e.state === 'ok' && !keep.contains(e.ll)) hospHide(e); });
  }
  function hospitalNearest() {
    const size = map.getSize(); let best = null, bd = 1e9;
    hosp.forEach(e => {
      if (e.state !== 'ok' || !e.m) return;
      const p = map.latLngToContainerPoint(e.ll), d = Math.hypot(p.x - size.x / 2, p.y - size.y / 2);
      if (p.x > 0 && p.y > 0 && p.x < size.x && p.y < size.y && d < bd) { bd = d; best = e; }
    });
    return best;
  }
  function ambulanceEvent() {
    const h = hospitalNearest();
    if (!h || !window.CityVeh) return false;
    const p = toXY(h.ll);
    const ok = window.CityVeh.spawnFrom('ambulance', p.x, p.y);
    if (ok && window.sfx) { /* la sirena la pone vehicles.js */ }
    return !!ok;
  }

  // ---------- Barrios: más o menos densidad según los edificios a la vista ----------
  function neighbourhood() {
    let n = 0;
    try { if (gl.getLayer('st-buildings') && map.getZoom() >= 14) n = gl.queryRenderedFeatures({ layers: ['st-buildings'] }).length; } catch (e) {}
    const d = n ? clamp(n / 110, 0, 1) : 0.45;
    CL._d += (d - CL._d) * 0.35;
    const target = 0.55 + 0.9 * CL._d;                           // 0,55 en las afueras … 1,45 en el centro
    CL._m += (target - CL._m) * 0.35;
  }

  // ---------- Sonido ambiente ----------
  let lastBell = -1, nextHorn = performance.now() / 1000 + rnd(6, 14);
  function audioTick(nowS) {
    const au = window.cityAudio; if (!au) return;
    const z = map.getZoom(), t = clamp((z - 14.5) / 3, 0, 1), lv = on ? t * t * (3 - 2 * t) * (0.3 + 0.7 * CL._d) * (1 - 0.45 * clamp(rainy(), 0, 1)) : 0;
    au.level(lv);
    if (on && lv > 0.08 && nowS > nextHorn) { nextHorn = nowS + rnd(7, 18); au.horn(0.25 + 0.5 * CL._d); }
    const d = new Date();
    if (on && d.getMinutes() === 0 && d.getSeconds() < 3 && lastBell !== d.getHours() && z >= 15) { lastBell = d.getHours(); au.bells(d.getHours() % 12 || 12, clamp(t, 0.3, 1)); }
  }

  // ---------- Bucle principal ----------
  let running = false, last = performance.now();
  const T = { scan: 0, dens: 0, vent: rnd(3, 8), bub: rnd(2, 5), dog: rnd(4, 8), snd: 0, roof: 0, works: rnd(35, 60), parade: rnd(60, 100), wedding: rnd(80, 130), amb: rnd(50, 90), tram: rnd(20, 40), gar: rnd(25, 50), van: rnd(15, 35), dri: rnd(40, 70) };
  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    const nowMs = performance.now(), z = map.getZoom();
    if (!document.hidden) {
      if (z >= MIN_Z && map.setRoads) map.setRoads(true, 'c'); else if (map.setRoads) map.setRoads(false, 'c');
      const fp = fpNow();
      if (Math.abs(fp - lastFp) > 0.004 || Math.abs(z - lastZ) > 0.02) { lastFp = fp; lastZ = z; rescale(); }
      T.scan -= dt; if (T.scan <= 0) { T.scan = 1.3; scanScenes(); }
      T.dens -= dt; if (T.dens <= 0) { T.dens = 3.5; neighbourhood(); }
      T.roof -= dt; if (T.roof <= 0) { T.roof = 0.35; smokeRoof(); dogsTick(); }
      T.snd -= dt; if (T.snd <= 0) { T.snd = 0.6; audioTick(nowMs / 1000); }
      scenes.forEach(sc => { const f = TICK[sc.kind]; if (f) f(sc, dt); });
      stepActors(dt);
      hospTick(dt, z);
      if (z >= ACT_Z) {
        T.vent -= dt; if (T.vent <= 0) { T.vent = rnd(5, 11); steamVent(); }
        T.bub -= dt; if (T.bub <= 0) { T.bub = rnd(1.8, 4.5); bubble(false); }
        T.dog -= dt; if (T.dog <= 0) { T.dog = rnd(5, 10); addDog(); }
        // eventos
        T.works -= dt; if (T.works <= 0) T.works = startWorks() ? rnd(170, 280) : 6;
        T.parade -= dt; if (T.parade <= 0) T.parade = startParade() ? rnd(210, 330) : 6;
        T.wedding -= dt; if (T.wedding <= 0) T.wedding = (window.CityVeh && window.CityVeh.convoy()) ? rnd(260, 420) : 6;
        T.amb -= dt; if (T.amb <= 0) T.amb = ambulanceEvent() ? rnd(150, 240) : 8;
        T.tram -= dt; if (T.tram <= 0) T.tram = (window.CityVeh && window.CityVeh.spawn('tram')) ? rnd(70, 110) : 8;
        T.gar -= dt; if (T.gar <= 0) T.gar = (window.CityVeh && window.CityVeh.spawn('garbage')) ? rnd(90, 150) : 8;
        T.van -= dt; if (T.van <= 0) T.van = (window.CityVeh && window.CityVeh.spawn('van')) ? rnd(50, 90) : 8;
        T.dri -= dt; if (T.dri <= 0) T.dri = (window.CityVeh && window.CityVeh.spawn('driving')) ? rnd(100, 170) : 8;
      }
      if (parade) paradeTick(dt);
      if (works && (nowMs > works.until || z < ACT_Z - 0.4)) endWorks();
      if (z < ACT_Z - 0.4 && parade) endParade();
      // cosas que caducan
      for (let i = vents.length - 1; i >= 0; i--) { const v = vents[i]; if (nowMs > v.until || z < ACT_Z - 0.4) { drop(v.o); vents.splice(i, 1); } }
      for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; if (nowMs > b.until) { b.b.remove(); if (b.w) b.w.cb = null; bubbles.splice(i, 1); } }
      for (let i = shelters.length - 1; i >= 0; i--) if (nowMs > shelters[i].until || z < ACT_Z - 0.4) dropShelter(shelters[i]);
    }
    requestAnimationFrame(frame);
  }
  map.on('zoomend', () => { if (map.getZoom() < ACT_Z - 0.4) { scenes.forEach(disposeScene); } });

  function clearAll() {
    scenes.forEach(disposeScene); while (actors.length) disposeActor(actors[0]);
    vents.forEach(v => drop(v.o)); vents.length = 0;
    bubbles.forEach(b => { b.b.remove(); if (b.w) b.w.cb = null; }); bubbles.length = 0;
    dogs.forEach(d => { d.dg.remove(); if (d.w) d.w.dog = null; }); dogs.length = 0;
    shelters.slice().forEach(dropShelter);
    endWorks(); endParade();
    hosp.forEach(hospHide);
    CL.zones.length = 0; CL.blockers = [];
    if (window.cityAudio) window.cityAudio.level(0);
    if (map.setRoads) map.setRoads(false, 'c');
  }
  function apply() {
    CL.on = on;
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.opacity = on ? '1' : '.55'; btn.title = on ? 'Vida urbana: activada' : 'Vida urbana: desactivada'; btn.dataset.label = 'Vida urbana: ' + (on ? 'sí' : 'no'); }
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!on) { running = false; clearAll(); }
  }
  if (btn) btn.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    apply();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });

  // Consola: forzar un evento sin esperar
  window.cityEvent = what => {
    if (!on) return 'Vida urbana desactivada (botón 🏙️ del menú)';
    const V = window.CityVeh;
    const m = {
      works: () => startWorks(), parade: () => startParade(), steam: () => steamVent(), bubble: () => bubble(true), ambulance: () => ambulanceEvent(),
      wedding: () => V && V.convoy(), tram: () => V && V.spawn('tram'), garbage: () => V && V.spawn('garbage'), van: () => V && V.spawn('van'), driving: () => V && V.spawn('driving')
    };
    return m[what] ? (m[what]() ? 'ok' : 'no se pudo (acércate a unas calles con zoom alto)') : 'prueba: ' + Object.keys(m).join(' | ');
  };
  apply();
})();
