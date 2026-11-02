'use strict';
// Tráfico por el mapa:
//  - Policía cada 5 min, bomberos cada 12 min y ambulancia cada 17 min, con luces y sirena (sintetizada, sin archivos).
//  - Taxis que recogen o dejan gente; la luz verde del techo se enciende cuando está libre o parado en la acera.
// Para probar sin esperar, en la consola: spawnVehicle('police' | 'fire' | 'ambulance' | 'taxi')
(function () {
  if (typeof map === 'undefined' || !map) return;
  const KEY = 'vehiclesOn', MIN_ZOOM = 16, REF_Z = 17, MAX_TAXIS = 2;
  const PERIOD = { police: 5 * 60e3, fire: 12 * 60e3, ambulance: 17 * 60e3 };
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('vehicles-btn');
  let on = true;
  try { const s = localStorage.getItem(KEY); if (s !== null) on = s === '1'; } catch (e) {}

  const st = document.createElement('style');
  st.textContent = `
    .vh { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .vh-in, .vh-rot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    .vh-rot svg { position: absolute; left: 0; top: 0; overflow: visible; }
    .vh-glow { position: absolute; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; }
    .g-r { background: radial-gradient(circle, rgba(255,40,50,.8), rgba(255,40,50,0) 68%); }
    .g-b { background: radial-gradient(circle, rgba(50,120,255,.85), rgba(50,120,255,0) 68%); }
    .g-w { background: radial-gradient(circle, rgba(255,255,255,.85), rgba(255,255,255,0) 68%); }
    .g-g { background: radial-gradient(circle, rgba(60,255,130,.9), rgba(60,255,130,0) 68%); opacity: 0; transition: opacity .3s; }
    .tl { fill: #6b6b6b; transition: fill .3s; }
    .free .tl { fill: #3df57f; }
    .free .g-g { opacity: 1; }
    @keyframes vhA { 0%, 45% { opacity: 1; } 55%, 100% { opacity: .08; } }
    @keyframes vhB { 0%, 45% { opacity: .08; } 55%, 100% { opacity: 1; } }
    .la { animation: vhA .5s linear infinite; }
    .lb { animation: vhB .5s linear infinite; }
    @media (prefers-reduced-motion: reduce) { .la, .lb { animation: none; opacity: .55; } }`;
  document.head.appendChild(st);
  map.createPane('vehicles'); map.getPane('vehicles').style.zIndex = 580;
  map.createPane('emergency'); map.getPane('emergency').style.zIndex = 595;
  ['vehicles', 'emergency'].forEach(n => { map.getPane(n).style.pointerEvents = 'none'; });

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Dibujos (vista cenital, mirando a la derecha) ----------
  const glow = (cls, x, y, anim, size) =>
    `<div class="vh-glow ${cls} ${anim || ''}" style="left:${x}px;top:${y}px${size ? `;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px` : ''}"></div>`;
  const headlights = (L, W) => `<rect x="${L - 2}" y="2.5" width="2" height="3" rx="1" fill="#ffe9a0"/><rect x="${L - 2}" y="${W - 5.5}" width="2" height="3" rx="1" fill="#ffe9a0"/>`;

  const KINDS = {
    police: {
      L: 44, W: 20, v: 95, siren: true, pane: 'emergency',
      html: () => glow('g-r', 21.5, 6.5, 'la') + glow('g-b', 21.5, 13.5, 'lb') + `
        <svg width="44" height="20" viewBox="0 0 44 20">
          <rect x="1.5" y="2.5" width="43" height="18" rx="6" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="43" height="19" rx="6" fill="#f4f6f8" stroke="#1d3557"/>
          <rect x="5" y=".5" width="32" height="2.4" fill="#1d3557"/><rect x="5" y="17.1" width="32" height="2.4" fill="#1d3557"/>
          <path d="M30 3.5L36 5.5V14.5L30 16.5Z" fill="#26364f"/><path d="M12 4L8 5.5V14.5L12 16Z" fill="#26364f"/>
          <rect x="12" y="4" width="18" height="12" rx="2" fill="#dde3ea"/>
          <rect x="19" y="3.5" width="5" height="13" rx="1.5" fill="#222"/>
          <circle class="la" cx="21.5" cy="6.5" r="2.4" fill="#ff2a3a"/><circle class="lb" cx="21.5" cy="13.5" r="2.4" fill="#2f7bff"/>
          ${headlights(44, 20)}
        </svg>`
    },
    ambulance: {
      L: 56, W: 22, v: 90, siren: true, pane: 'emergency',
      html: () => glow('g-b', 36, 6.5, 'la') + glow('g-b', 36, 15.5, 'lb') + `
        <svg width="56" height="22" viewBox="0 0 56 22">
          <rect x="1.5" y="2.5" width="55" height="20" rx="5" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="55" height="21" rx="5" fill="#fff" stroke="#c9d0d6"/>
          <rect x="3" y="2" width="37" height="18" rx="3" fill="#f7f9fb" stroke="#d6dbe0" stroke-width=".8"/>
          <rect x="3" y="2" width="37" height="2.2" fill="#d62839"/><rect x="3" y="17.8" width="37" height="2.2" fill="#d62839"/>
          <rect x="16.5" y="8.5" width="10" height="5" fill="#d62839"/><rect x="19" y="6" width="5" height="10" fill="#d62839"/>
          <path d="M44 4L50 6V16L44 18Z" fill="#26364f"/>
          <rect x="34" y="3.5" width="4" height="15" rx="1.5" fill="#222"/>
          <circle class="la" cx="36" cy="6.5" r="2.4" fill="#3b82ff"/><circle class="lb" cx="36" cy="15.5" r="2.4" fill="#3b82ff"/>
          ${headlights(56, 22)}
        </svg>`
    },
    fire: {
      L: 74, W: 24, v: 80, siren: true, pane: 'emergency',
      html: () => {
        let rungs = ''; for (let x = 10; x < 52; x += 4) rungs += `M${x} 9V15`;
        return glow('g-r', 60, 6, 'la') + glow('g-w', 60, 18, 'lb') + `
        <svg width="74" height="24" viewBox="0 0 74 24">
          <rect x="1.5" y="2.5" width="73" height="22" rx="4" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="73" height="23" rx="4" fill="#c8102e" stroke="#7d0a1c"/>
          <rect x="5" y="5" width="48" height="14" rx="2" fill="#b00d27"/>
          <rect x="6" y="7" width="46" height="2" fill="#9aa0a6"/><rect x="6" y="15" width="46" height="2" fill="#9aa0a6"/>
          <path d="${rungs}" stroke="#d9dde2" stroke-width="1.2" fill="none"/>
          <rect x="2" y="11" width="3" height="2" fill="#fff"/>
          <path d="M60 3.5L68 5.5V18.5L60 20.5Z" fill="#26364f"/>
          <rect x="57.5" y="3" width="4" height="18" rx="1.5" fill="#222"/>
          <circle class="la" cx="60" cy="6" r="2.5" fill="#ff2a3a"/><circle class="lb" cx="60" cy="18" r="2.5" fill="#fff"/>
          <circle class="la" cx="3" cy="4" r="1.6" fill="#ff2a3a"/><circle class="lb" cx="3" cy="20" r="1.6" fill="#ff2a3a"/>
          ${headlights(74, 24)}
        </svg>`;
      }
    },
    taxi: {
      L: 44, W: 20, v: 62, siren: false, pane: 'vehicles',
      html: () => glow('g-g', 22, 10, '', 44) + `
        <svg width="44" height="20" viewBox="0 0 44 20">
          <rect x="1.5" y="2.5" width="43" height="18" rx="6" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="43" height="19" rx="6" fill="#fbfbf6" stroke="#8b8f96"/>
          <rect x="8" y=".5" width="26" height="1.8" fill="#d62839"/><rect x="8" y="17.7" width="26" height="1.8" fill="#d62839"/>
          <path d="M30 3.5L36 5.5V14.5L30 16.5Z" fill="#26364f"/><path d="M12 4L8 5.5V14.5L12 16Z" fill="#26364f"/>
          <rect x="12" y="4" width="18" height="12" rx="2" fill="#eceff1"/>
          <rect class="tl" x="19" y="7" width="6" height="6" rx="1.2" stroke="#333" stroke-width=".6"/>
          ${headlights(44, 20)}
        </svg>`
    }
  };

  // ---------- Sirenas (Web Audio) ----------
  let ac = null, bus = null;
  function initAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    bus = ac.createGain(); bus.gain.value = 0.8; bus.connect(ac.destination);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, function once() {
    if (on) initAudio();
    if (ac) ['pointerdown', 'keydown', 'touchstart'].forEach(e => removeEventListener(e, once));
  }, { passive: true }));

  function makeSiren() {
    if (!ac || ac.state === 'closed') return null;
    const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 700;
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.value = 0;
    o.connect(lp); lp.connect(g);
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pan) { g.connect(pan); pan.connect(bus); } else g.connect(bus);
    o.start();
    return { o, g, pan };
  }
  function sirenFreq(kind, a) {
    if (kind === 'police') {              // aúlla y de vez en cuando hace "yelp" rápido
      const c = a % 10;
      if (c < 6) return 650 + 700 * (1 - Math.cos(a * 6.2832 / 3.2)) / 2;
      return 650 + 700 * ((a % 0.32) / 0.32);
    }
    if (kind === 'ambulance') return Math.floor(a / 0.55) % 2 ? 960 : 725;      // ta-taa, ta-taa
    return 450 + 450 * (1 - Math.cos(a * 6.2832 / 5)) / 2;                      // bomberos: aullido lento y grave
  }
  function updateSiren(v, vol, pan) {
    const s = v.sirenObj; if (!s) return;
    const now = ac.currentTime;
    s.o.frequency.setTargetAtTime(sirenFreq(v.kind, v.age), now, 0.02);
    s.g.gain.setTargetAtTime(0.13 * vol, now, 0.08);
    if (s.pan) s.pan.pan.setTargetAtTime(pan, now, 0.1);
  }
  function killSiren(v) {
    const s = v.sirenObj; if (!s) return;
    v.sirenObj = null;
    try {
      const now = ac.currentTime;
      s.g.gain.setTargetAtTime(0, now, 0.06);
      s.o.stop(now + 0.4);
    } catch (e) {}
  }

  // ---------- Entidades ----------
  const vehicles = [], pax = [];
  let zooming = false;

  // Trayecto recto de un borde de la pantalla al contrario, empezando y acabando fuera de la vista
  function route(L) {
    const size = map.getSize();
    const f = () => rnd(0.2, 0.8);
    const side = Math.floor(Math.random() * 4);
    let a, b;
    if (side === 0) { a = [0, f() * size.y]; b = [size.x, f() * size.y]; }
    else if (side === 1) { a = [size.x, f() * size.y]; b = [0, f() * size.y]; }
    else if (side === 2) { a = [f() * size.x, 0]; b = [f() * size.x, size.y]; }
    else { a = [f() * size.x, size.y]; b = [f() * size.x, 0]; }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len, ext = L + 40;
    a = [a[0] - ux * ext, a[1] - uy * ext]; b = [b[0] + ux * ext, b[1] + uy * ext];
    const p0 = map.project(map.containerPointToLatLng(a), REF_Z), p1 = map.project(map.containerPointToLatLng(b), REF_Z);
    const total = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    return { p0, total, dx: (p1.x - p0.x) / total, dy: (p1.y - p0.y) / total };
  }

  function spawn(kind) {
    const K = KINDS[kind]; if (!K) return null;
    const r = route(K.L);
    const icon = L.divIcon({
      className: 'vh', iconSize: [K.L, K.W], iconAnchor: [K.L / 2, K.W / 2],
      html: `<div class="vh-in"><div class="vh-rot">${K.html()}</div></div>`
    });
    const mk = L.marker(map.unproject(r.p0, REF_Z), { icon, pane: K.pane, interactive: false, keyboard: false }).addTo(map);
    const el = mk.getElement();
    const rot = el && el.querySelector('.vh-rot');
    const h = Math.atan2(r.dy, r.dx);
    if (rot) rot.style.transform = `rotate(${h}rad)`;
    const v = {
      kind, K, mk, wrap: el && el.querySelector('.vh-in'), x: r.p0.x, y: r.p0.y, dx: r.dx, dy: r.dy, h,
      s: 0, total: r.total, speed: K.siren ? K.v : 0, age: 0, state: 'drive', t: 0, sirenObj: null
    };
    if (K.siren) { v.sirenObj = makeSiren(); }
    if (kind === 'taxi') {
      v.scenario = Math.random() < 0.5 ? 'pickup' : 'dropoff';
      v.sStop = r.total * rnd(0.4, 0.6);
      v.speed = K.v;
      setFree(v, v.scenario === 'pickup');
    }
    vehicles.push(v);
    return v;
  }
  function setFree(v, free) { if (v.wrap) v.wrap.classList.toggle('free', !!free); }
  function removeVehicle(i) {
    const v = vehicles[i]; killSiren(v);
    map.removeLayer(v.mk); vehicles.splice(i, 1);
  }
  function removePax(i) { map.removeLayer(pax[i].mk); pax.splice(i, 1); }
  function clearAll() {
    while (vehicles.length) removeVehicle(0);
    while (pax.length) removePax(0);
  }

  // Pasajero de taxi (reutiliza la figura de people.js)
  function spawnPax(v, mode) {
    if (!window.personSVG) return null;
    const right = [-Math.sin(v.h), Math.cos(v.h)], fwd = [Math.cos(v.h), Math.sin(v.h)];
    const scale = Math.pow(2, map.getZoom() - REF_Z), W2 = v.K.W / 2;
    const off = (mode === 'in' ? 58 : W2 + 3) / scale;
    const x = v.x + right[0] * off, y = v.y + right[1] * off;
    const raining = window.weatherIntensity && window.weatherIntensity() > 0.25;
    const icon = L.divIcon({
      className: 'pw', iconSize: [20, 30], iconAnchor: [10, 28],
      html: `<div class="pw-in${raining ? ' rain' : ''}" style="opacity:0">${window.personSVG(pick(['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703']), pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']), pick(['#2b2d42', '#3a3a3a', '#1d3557', '#5c4033']), false)}</div>`
    });
    const mk = L.marker(map.unproject(L.point(x, y), REF_Z), { icon, pane: 'people', interactive: false, keyboard: false }).addTo(map);
    const p = { mk, x, y, age: 0, el: null, flip: null, rain: !!raining, mode, taxi: v, speed: 24, life: mode === 'in' ? 20 : 6.5, h: 0 };
    if (mode === 'in') {                      // camina hacia la puerta del taxi
      p.tx = v.x + right[0] * (W2 + 4) / scale; p.ty = v.y + right[1] * (W2 + 4) / scale;
      p.h = Math.atan2(p.ty - y, p.tx - x);
    } else {                                  // se baja y se aleja por la acera
      const a = rnd(-0.7, 0.7);
      p.h = Math.atan2(right[1] * Math.cos(a) + fwd[1] * Math.sin(a), right[0] * Math.cos(a) + fwd[0] * Math.sin(a));
    }
    pax.push(p);
    return p;
  }

  // ---------- Bucle ----------
  const lastSpawn = { t: 0 };
  const nextAt = { police: Date.now() + PERIOD.police, fire: Date.now() + PERIOD.fire, ambulance: Date.now() + PERIOD.ambulance };
  let nextTaxi = rnd(5, 10), last = performance.now(), running = false;
  const approach = (cur, target, step) => cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);

  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    if (!document.hidden && !zooming) {
      const z = map.getZoom(), scale = Math.pow(2, z - REF_Z), now = Date.now();
      const raining = (window.weatherIntensity ? window.weatherIntensity() : 0) > 0.25;
      const size = map.getSize(), cx = size.x / 2, cy = size.y / 2, half = Math.hypot(cx, cy);

      // Emergencias periódicas (si el zoom es bajo, esperan a que te acerques)
      if (z >= MIN_ZOOM && now - lastSpawn.t > 10000) {
        for (const k of ['police', 'fire', 'ambulance']) {
          if (now >= nextAt[k]) { spawn(k); nextAt[k] = now + PERIOD[k]; lastSpawn.t = now; break; }
        }
      }
      // Taxis
      nextTaxi -= dt;
      if (nextTaxi <= 0) {
        if (z >= MIN_ZOOM && vehicles.filter(v => v.kind === 'taxi').length < MAX_TAXIS) spawn('taxi');
        nextTaxi = rnd(25, 55);
      }

      for (let i = vehicles.length - 1; i >= 0; i--) {
        const v = vehicles[i];
        v.age += dt;
        if (v.kind === 'taxi') {
          if (v.state === 'drive') {
            const rem = Math.max(0, (v.sStop - v.s) * scale);           // px de pantalla hasta la parada
            const target = Math.min(v.K.v, Math.sqrt(2 * 60 * rem) + 4);
            v.speed = approach(v.speed, target, (target > v.speed ? 50 : 180) * dt);
            if (rem <= 1.5) { v.speed = 0; v.state = 'stop'; v.t = 0; v.s = v.sStop; v.step = 0; }
          } else if (v.state === 'stop') {
            v.t += dt;
            if (v.scenario === 'pickup') {
              if (v.step === 0 && v.t > 0.8) { v.step = 1; v.p = spawnPax(v, 'in'); if (!v.p) { v.step = 3; v.t = 3; } }
              if (v.step === 1 && v.p && v.p.done) { v.step = 2; v.t = 0; }               // ya ha subido
              if (v.step === 2 && v.t > 1) { setFree(v, false); v.step = 3; v.t = 0; }    // ocupado: luz apagada
              if (v.step === 3 && v.t > 0.9) v.state = 'leave';
              if (v.step === 1 && v.t > 25) { v.state = 'leave'; }                        // por si acaso
            } else {
              if (v.step === 0 && v.t > 0.8) { v.step = 1; spawnPax(v, 'out'); }
              if (v.step === 1 && v.t > 1.8) { setFree(v, true); v.step = 2; }            // libre: luz verde
              if (v.t > 3.4) v.state = 'leave';
            }
          } else {
            v.speed = approach(v.speed, v.K.v, 70 * dt);
          }
        } else {
          // Sirena: más fuerte cuanto más cerca del centro de la pantalla
          const pt = map.latLngToContainerPoint(v.mk.getLatLng());
          const fade = Math.min(1, v.age / 1.5);
          const edge = Math.min(1, (v.total - v.s) * scale / 120);
          const vol = clamp(1.15 - Math.hypot(pt.x - cx, pt.y - cy) / half, 0.12, 1) * fade * edge;
          if (!v.sirenObj && ac) v.sirenObj = makeSiren();
          updateSiren(v, ac ? vol : 0, clamp((pt.x - cx) / cx, -1, 1) * 0.8);
        }
        const step = v.speed * dt / scale;
        v.x += v.dx * step; v.y += v.dy * step; v.s += step;
        if (v.s >= v.total || v.age > 120) { removeVehicle(i); continue; }
        v.mk.setLatLng(map.unproject(L.point(v.x, v.y), REF_Z));
      }

      for (let i = pax.length - 1; i >= 0; i--) {
        const p = pax[i];
        p.age += dt;
        if (!p.el) { const e = p.mk.getElement(); p.el = e && e.firstChild; }
        if (p.mode === 'in') {
          const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy) * scale;
          if (d <= 2 || p.age > p.life) { p.taxi.p = p; p.done = true; removePax(i); continue; }   // sube al taxi
          p.h = Math.atan2(dy, dx);
        } else if (p.age > p.life) { removePax(i); continue; }
        const step = p.speed * dt / scale;
        p.x += Math.cos(p.h) * step; p.y += Math.sin(p.h) * step;
        p.mk.setLatLng(map.unproject(L.point(p.x, p.y), REF_Z));
        if (p.el) {
          p.el.style.opacity = p.mode === 'in' ? Math.min(1, p.age / 0.6) : Math.max(0, Math.min(1, p.age / 0.4, (p.life - p.age) / 1.2));
          if (raining !== p.rain) { p.rain = raining; p.el.classList.toggle('rain', raining); }
          const f = Math.cos(p.h) < 0;
          if (f !== p.flip) { p.flip = f; p.el.classList.toggle('flip', f); }
        }
      }
    }
    requestAnimationFrame(frame);
  }

  map.on('zoomstart', () => { zooming = true; });
  map.on('zoomend', () => { zooming = false; if (map.getZoom() < MIN_ZOOM) clearAll(); });
  // Con la pestaña oculta no hay animación: se quitan los vehículos para que no se quede la sirena sonando
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearAll();
    else last = performance.now();
  });

  function apply() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.opacity = on ? '1' : '.55'; btn.title = on ? 'Coches y taxis: activados' : 'Coches y taxis: desactivados'; }
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!on) { running = false; clearAll(); }
  }
  if (btn) btn.onclick = function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) { initAudio(); nextTaxi = 1; }
    apply();
  };
  window.spawnVehicle = kind => { if (on && KINDS[kind]) { initAudio(); return !!spawn(kind); } return false; };
  apply();
})();
