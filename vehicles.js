'use strict';
// Tráfico por el mapa:
//  - Coches, camiones y autobuses circulan todo el rato por las calles reales, por su carril, y frenan si hay otro delante.
//  - Policía cada 5 min, bomberos cada 12 min y ambulancia cada 17 min, con luces y sirena (sintetizada, sin archivos).
//  - Los coches siguen las calles reales (OpenStreetMap vía OpenFreeMap); si no hay calles, los taxis y las emergencias cruzan en línea recta.
//  - Taxis que recogen o dejan gente; la luz verde del techo se enciende cuando está libre o parado en la acera.
//  - También circulan motos, bicicletas (con pedaleo) y patinetes; las bicis y patinetes van por el borde de la calzada.
//  - Un avión cruza el cielo cada 5 min y un helicóptero llega cada 3 min, aterriza, para el rotor, arranca y se va (con sonido).
// Para probar sin esperar, en la consola: spawnVehicle('car' | 'truck' | 'bus' | 'moto' | 'bike' | 'scooter' | 'police' | 'fire' | 'ambulance' | 'taxi')
// y spawnAircraft('plane' | 'heli')
(function () {
  if (typeof map === 'undefined' || !map) return;
  const KEY = 'vehiclesOn', MIN_ZOOM = 16, REF_Z = 17, MAX_TAXIS = 3;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const MAX_TRAFFIC = SMALL ? 11 : 17;                      // coches, camiones, autobuses, motos, bicis y patinetes a la vez
  const MIX = [['car', 0.46], ['truck', 0.14], ['bus', 0.1], ['moto', 0.12], ['bike', 0.1], ['scooter', 0.08]];  // reparto del tráfico
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
    @media (prefers-reduced-motion: reduce) { .la, .lb { animation: none; opacity: .55; } }
    @keyframes vhPed { from { transform: translateX(-1.7px); } to { transform: translateX(1.7px); } }
    .pda { animation: vhPed .5s ease-in-out infinite alternate; }
    .pdb { animation: vhPed .5s ease-in-out infinite alternate-reverse; }
    @media (prefers-reduced-motion: reduce) { .pda, .pdb { animation: none; } }
    /* Cielo (aviones, por encima de todo) y helicóptero */
    .sky { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; z-index: 650; }
    .pl { position: absolute; left: 0; top: 0; width: 0; height: 0; will-change: transform; filter: drop-shadow(26px 46px 7px rgba(0,0,0,.22)); }
    .pl-rot { position: absolute; }
    .pl-rot svg { position: absolute; left: 0; top: 0; }
    .pl-trail { position: absolute; height: 2.5px; width: 340px; border-radius: 2px; background: linear-gradient(to left, rgba(255,255,255,.62), rgba(255,255,255,0)); filter: blur(.6px); }
    .hl { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .hl-in, .hl-rot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: 60px 22px; }
    .hl-rot svg { position: absolute; left: 0; top: 0; overflow: visible; }
    .hl-dust { position: absolute; left: 60px; top: 22px; width: 130px; height: 130px; margin: -65px 0 0 -65px; border-radius: 50%; opacity: 0; background: radial-gradient(circle, rgba(214,196,160,.55), rgba(214,196,160,0) 68%); }`;
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
  const taillights = W => `<rect x="0" y="2.5" width="1.8" height="3" rx=".9" fill="#d62839"/><rect x="0" y="${W - 5.5}" width="1.8" height="3" rx=".9" fill="#d62839"/>`;

  const CAR_COLORS = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703', '#e9ecef', '#3b4148', '#1d3557', '#b8bec6', '#6a994e', '#8d5524', '#ff7b9c'];
  const TRAILERS = ['#f4f6f8', '#2f6db5', '#e0a030', '#5f9e6e', '#c8102e', '#cfd4da'];
  const CABS = ['#c8102e', '#1d3557', '#2a9d8f', '#f4a261', '#3b4148', '#457b9d'];
  const BUSES = ['#d62839', '#1d6fb8', '#2a9d8f', '#f5b800', '#7b4fc9', '#f4f6f8'];
  const JACKETS = ['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703', '#264653', '#ff7b9c'];
  const HELMETS = ['#222', '#f4f6f8', '#d62839', '#ffb703', '#1d6fb8'];

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
    },

    // ----- Tráfico normal (coches, camiones, autobuses) -----
    car: {
      L: 38, W: 18, v: 68, siren: false, traffic: true, pane: 'vehicles',
      look: () => pick(CAR_COLORS),
      html: c => `
        <svg width="38" height="18" viewBox="0 0 38 18">
          <rect x="1.5" y="2.5" width="37" height="16" rx="5" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="37" height="17" rx="5" fill="${c}" stroke="rgba(0,0,0,.5)"/>
          <path d="M26 3L31 4.8V13.2L26 15Z" fill="#26364f"/><path d="M10 3.5L7 5V13L10 14.5Z" fill="#26364f"/>
          <rect x="10" y="3.5" width="16" height="11" rx="2" fill="rgba(255,255,255,.28)" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>
          ${headlights(38, 18)}${taillights(18)}
        </svg>`
    },
    truck: {
      L: 78, W: 24, v: 54, siren: false, traffic: true, pane: 'vehicles',
      look: () => ({ t: pick(TRAILERS), c: pick(CABS) }),
      html: k => {
        let ribs = ''; for (let x = 7; x < 52; x += 6) ribs += `M${x} 3V21`;
        return `
        <svg width="78" height="24" viewBox="0 0 78 24">
          <rect x="1.5" y="2.5" width="77" height="22" rx="4" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".8" width="54" height="22.4" rx="2.5" fill="${k.t}" stroke="rgba(0,0,0,.45)"/>
          <path d="${ribs}" stroke="rgba(0,0,0,.14)" stroke-width="1" fill="none"/>
          <rect x="54" y="8" width="5" height="8" fill="#2a2a2a"/>
          <rect x="57.5" y="1.5" width="20" height="21" rx="4.5" fill="${k.c}" stroke="rgba(0,0,0,.5)"/>
          <rect x="59" y="3.5" width="9" height="17" rx="2" fill="rgba(255,255,255,.25)"/>
          <path d="M69 4L74.5 6V18L69 20Z" fill="#26364f"/>
          ${headlights(78, 24)}${taillights(24)}
        </svg>`;
      }
    },
    bus: {
      L: 86, W: 24, v: 48, siren: false, traffic: true, pane: 'vehicles',
      look: () => pick(BUSES),
      html: c => `
        <svg width="86" height="24" viewBox="0 0 86 24">
          <rect x="1.5" y="2.5" width="85" height="22" rx="5" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="85" height="23" rx="5" fill="${c}" stroke="rgba(0,0,0,.5)"/>
          <rect x="3" y="2.5" width="70" height="19" rx="3" fill="rgba(255,255,255,.3)"/>
          <rect x="9" y="7" width="14" height="10" rx="2" fill="rgba(0,0,0,.14)"/><rect x="30" y="7" width="14" height="10" rx="2" fill="rgba(0,0,0,.14)"/><rect x="51" y="7" width="14" height="10" rx="2" fill="rgba(0,0,0,.14)"/>
          <rect x="73.5" y="2.5" width="3" height="19" rx="1" fill="rgba(0,0,0,.25)"/>
          <path d="M76.5 3L83.5 5V19L76.5 21Z" fill="#26364f"/>
          ${headlights(86, 24)}${taillights(24)}
        </svg>`
    },

    // ----- Dos ruedas y patinetes (entran en el tráfico normal) -----
    moto: {
      L: 26, W: 12, v: 78, siren: false, traffic: true, pane: 'vehicles',
      look: () => ({ b: pick(['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#3b4148', '#ffb703']), j: pick(JACKETS), h: pick(HELMETS) }),
      html: c => `
        <svg width="26" height="12" viewBox="0 0 26 12">
          <ellipse cx="13.5" cy="7.6" rx="12.5" ry="4.4" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y="4.6" width="7" height="2.8" rx="1.4" fill="#222"/><rect x="18.5" y="4.6" width="7" height="2.8" rx="1.4" fill="#222"/>
          <rect x="5" y="3.8" width="16" height="4.4" rx="2" fill="${c.b}" stroke="rgba(0,0,0,.5)" stroke-width=".6"/>
          <path d="M14 3.4L20.2 1.3M14 8.6L20.2 10.7" stroke="${c.j}" stroke-width="1.8" stroke-linecap="round"/>
          <rect x="19.6" y=".6" width="1.6" height="10.8" rx=".8" fill="#2b2b2b"/>
          <ellipse cx="11" cy="6" rx="4.2" ry="5" fill="${c.j}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>
          <circle cx="13.2" cy="6" r="2.9" fill="${c.h}" stroke="rgba(0,0,0,.45)" stroke-width=".6"/>
          <rect x="0" y="4.4" width="1.2" height="3.2" rx=".6" fill="#d62839"/><rect x="24.8" y="4.6" width="1.4" height="2.8" rx=".7" fill="#ffe9a0"/>
        </svg>`
    },
    bike: {
      L: 22, W: 10, v: 30, siren: false, traffic: true, outer: true, lane: 20, pane: 'vehicles',
      look: () => ({ f: pick(CAR_COLORS), j: pick(JACKETS), h: pick(HELMETS) }),
      html: c => `
        <svg width="22" height="10" viewBox="0 0 22 10">
          <ellipse cx="11.5" cy="6" rx="10.5" ry="3.2" fill="rgba(0,0,0,.26)"/>
          <rect x=".5" y="4.3" width="7" height="1.4" rx=".7" fill="#222"/><rect x="14.5" y="4.3" width="7" height="1.4" rx=".7" fill="#222"/>
          <path d="M4 5H18" stroke="${c.f}" stroke-width="1.3" stroke-linecap="round"/>
          <rect class="pda" x="6" y="2.2" width="4.2" height="1.6" rx=".8" fill="#2b2d42"/><rect class="pdb" x="6" y="6.2" width="4.2" height="1.6" rx=".8" fill="#2b2d42"/>
          <path d="M9 2.8L16.2 2.2M9 7.2L16.2 7.8" stroke="${c.j}" stroke-width="1.6" stroke-linecap="round"/>
          <rect x="16" y="1" width="1.4" height="8" rx=".7" fill="#333"/>
          <ellipse cx="9.4" cy="5" rx="3.6" ry="3.9" fill="${c.j}" stroke="rgba(0,0,0,.35)" stroke-width=".5"/>
          <circle cx="11.7" cy="5" r="2.3" fill="${c.h}" stroke="rgba(0,0,0,.45)" stroke-width=".5"/>
        </svg>`
    },
    scooter: {
      L: 18, W: 9, v: 36, siren: false, traffic: true, outer: true, lane: 20, pane: 'vehicles',
      look: () => ({ d: pick(['#2a2a2a', '#1d6fb8', '#d62839', '#2a9d8f', '#8d99ae']), j: pick(JACKETS), h: pick(HELMETS) }),
      html: c => `
        <svg width="18" height="9" viewBox="0 0 18 9">
          <ellipse cx="9.5" cy="5.4" rx="8.6" ry="3" fill="rgba(0,0,0,.26)"/>
          <rect x=".5" y="3.6" width="3.6" height="1.8" rx=".9" fill="#222"/><rect x="13" y="3.6" width="3.6" height="1.8" rx=".9" fill="#222"/>
          <rect x="2" y="3.2" width="12" height="2.6" rx="1.3" fill="${c.d}" stroke="rgba(0,0,0,.45)" stroke-width=".5"/>
          <path d="M10 2.3L14.4 1.8M10 6.7L14.4 7.2" stroke="${c.j}" stroke-width="1.5" stroke-linecap="round"/>
          <rect x="14.2" y=".8" width="1.4" height="7.4" rx=".7" fill="#333"/>
          <ellipse cx="8.2" cy="4.5" rx="3" ry="3.5" fill="${c.j}" stroke="rgba(0,0,0,.35)" stroke-width=".5"/>
          <circle cx="10.3" cy="4.5" r="2.1" fill="${c.h}" stroke="rgba(0,0,0,.45)" stroke-width=".5"/>
          <rect x="0" y="3.9" width="1" height="1.2" rx=".5" fill="#d62839"/><rect x="16.6" y="3.7" width="1.2" height="1.6" rx=".6" fill="#ffe9a0"/>
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

  //#roads-begin
  // ---------- Trayectos por calles reales ----------
  const SNAP = 3;                                   // px de mundo (REF_Z) para unir los extremos de dos calles
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  function makePath(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, total: cum[cum.length - 1] };
  }
  // Coloca el coche sobre su trayecto según la distancia recorrida v.s
  function advance(v) {
    const P = v.path;
    while (v.seg < P.pts.length - 2 && P.cum[v.seg + 1] <= v.s) v.seg++;
    const a = P.pts[v.seg], b = P.pts[v.seg + 1], len = (P.cum[v.seg + 1] - P.cum[v.seg]) || 1;
    const t = Math.min(1, Math.max(0, (v.s - P.cum[v.seg]) / len));
    v.x = a.x + (b.x - a.x) * t; v.y = a.y + (b.y - a.y) * t;
    v.dx = (b.x - a.x) / len; v.dy = (b.y - a.y) / len;
  }

  // Grafo de calles de lo que se ve ahora mismo. Se guarda un par de segundos (y se descarta en cuanto el mapa se mueve)
  // porque coches y peatones lo piden muchas veces y consultar las teselas vectoriales no es gratis.
  let graph = null, graphT = 0;
  map.on('move', () => { graph = null; });
  function roadGraph() {
    const now = performance.now();
    if (graph && now - graphT < 2500) return graph;
    if (!map.queryRoads) return null;
    const raw = map.queryRoads();
    if (!raw.length) return null;
    const lines = [], ends = new Map();
    raw.forEach(c => {
      if (c.length < 2) return;
      const pts = c.map(ll => map.project({ lat: ll[1], lng: ll[0] }, REF_Z));
      const ln = { pts, ll: c, sc: null };
      lines.push(ln);
      [[pts[0], 0], [pts[pts.length - 1], 1]].forEach(([p, e]) => {
        const k = Math.round(p.x / SNAP) + ',' + Math.round(p.y / SNAP);
        if (!ends.has(k)) ends.set(k, []);
        ends.get(k).push({ ln, end: e });
      });
    });
    if (!lines.length) return null;
    graph = { lines, ends }; graphT = now;
    return graph;
  }
  // Puntos de la calle en pantalla (se calculan una vez por grafo)
  const screenOf = ln => ln.sc || (ln.sc = ln.ll.map(ll => { const p = map.gl.project(ll); return { x: p.x, y: p.y }; }));

  // Busca un trayecto por las calles visibles siguiendo calles conectadas.
  //  - por defecto (coches): entra por fuera de la pantalla y la cruza.
  //  - opt.inside (peatones): empieza en algún punto de la pantalla; devuelve en `starts` las distancias de salida válidas.
  //  - opt.len = largo deseado en px de pantalla; opt.minLen = largo mínimo aceptable.
  function roadRoute(opt) {
    opt = opt || {};
    const g = roadGraph();
    if (!g) return null;
    const near = p => {
      const out = [], cx = Math.round(p.x / SNAP), cy = Math.round(p.y / SNAP);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = g.ends.get((cx + i) + ',' + (cy + j)); if (a) out.push(...a); }
      return out;
    };
    const size = map.getSize(), scale = Math.pow(2, map.getZoom() - REF_Z);
    const scr = p => map.latLngToContainerPoint(map.unproject(p, REF_Z));
    const inside = c => c.x >= 0 && c.y >= 0 && c.x <= size.x && c.y <= size.y;
    const cand = [];
    g.lines.forEach(ln => {
      const sc = screenOf(ln);
      if (opt.inside) { if (sc.some(inside)) cand.push({ ln, e: Math.random() < 0.5 ? 0 : 1 }); }
      else [0, 1].forEach(e => {
        const c = e ? sc[sc.length - 1] : sc[0];
        if (c.x < -10 || c.y < -10 || c.x > size.x + 10 || c.y > size.y + 10) cand.push({ ln, e });
      });
    });
    if (!cand.length) return null;
    const target = (opt.len || Math.hypot(size.x, size.y) * 1.4) / scale, minLen = opt.minLen || 250;
    for (let t = 0; t < 12; t++) {
      const s0 = pick(cand);
      const pts = (s0.e ? s0.ln.pts.slice().reverse() : s0.ln.pts.slice());
      const used = new Set([s0.ln]);
      let total = makePath(pts).total;
      for (let hop = 0; hop < 12 && total < target; hop++) {
        const a = pts[pts.length - 1], b = pts[pts.length - 2], hin = Math.atan2(a.y - b.y, a.x - b.x);
        const opts = [];
        near(a).forEach(o => {
          if (used.has(o.ln)) return;
          const q = o.end ? o.ln.pts.slice().reverse() : o.ln.pts;
          const turn = Math.abs(angDiff(Math.atan2(q[1].y - q[0].y, q[1].x - q[0].x), hin));
          if (turn < 2.0) opts.push({ o, q, turn });      // sin cambios de sentido bruscos
        });
        if (!opts.length) break;
        opts.sort((x, y) => x.turn - y.turn);
        const ch = Math.random() < 0.75 ? opts[0] : pick(opts);   // casi siempre sigue recto; a veces gira en la esquina
        used.add(ch.o.ln);
        for (let i = 1; i < ch.q.length; i++) pts.push(ch.q[i]);
        total = makePath(pts).total;
      }
      const P = makePath(pts);
      if (P.total * scale < minLen) continue;
      const cs = pts.map(scr);
      if (!cs.some(inside)) continue;
      // El taxi parará en el punto del trayecto más cercano al centro de la pantalla
      let focus = null, best = 1e9;
      cs.forEach((c, i) => { const d = Math.hypot(c.x - size.x / 2, c.y - size.y / 2); if (inside(c) && d < best && P.cum[i] > 40 / scale) { best = d; focus = P.cum[i]; } });
      let starts = null;
      if (opt.inside) {                                    // puntos del trayecto que ahora están en pantalla (con trecho por delante)
        starts = [];
        for (let i = 0; i + 1 < pts.length; i++) {
          const seg = P.cum[i + 1] - P.cum[i], n = Math.max(1, Math.round(seg * scale / 20));
          for (let k = 0; k < n; k++) {
            const f = k / n, s = P.cum[i] + seg * f;
            if ((P.total - s) * scale < 100) continue;
            if (inside(scr({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f }))) starts.push(s);
          }
        }
        if (!starts.length) continue;
      }
      return { path: P, focus, starts };
    }
    return null;
  }
  window.roadRoute = roadRoute;     // lo usa también people.js (peatones por las aceras)

  function pathRoute(Lc, roadsOnly) {
    const rr = roadRoute();
    if (rr) return rr;
    if (roadsOnly) return null;   // el tráfico normal solo circula por calles; el taxi y las emergencias, si no hay, cruzan recto
    const r = route(Lc);          // sin calles cerca (mar, campo…): línea recta como antes
    return { path: makePath([r.p0, { x: r.p0.x + r.dx * r.total, y: r.p0.y + r.dy * r.total }]), focus: null };
  }
  //#roads-end

  function spawn(kind, roadsOnly) {
    const K = KINDS[kind]; if (!K) return null;
    const r = pathRoute(K.L, roadsOnly); if (!r) return null;
    const P = r.path, p0 = P.pts[0], d0 = { dx: (P.pts[1].x - p0.x) / (P.cum[1] || 1), dy: (P.pts[1].y - p0.y) / (P.cum[1] || 1) };
    const look = K.look ? K.look() : null;
    const icon = L.divIcon({
      className: 'vh', iconSize: [K.L, K.W], iconAnchor: [K.L / 2, K.W / 2],
      html: `<div class="vh-in"><div class="vh-rot">${K.html(look)}</div></div>`
    });
    const mk = L.marker(map.unproject(p0, REF_Z), { icon, pane: K.pane, interactive: false, keyboard: false }).addTo(map);
    const el = mk.getElement();
    const rot = el && el.querySelector('.vh-rot');
    const h = Math.atan2(d0.dy, d0.dx);
    if (rot) rot.style.transform = `rotate(${h}rad)`;
    const v = {
      kind, K, mk, wrap: el && el.querySelector('.vh-in'), rot, x: p0.x, y: p0.y, dx: d0.dx, dy: d0.dy, h,
      path: P, seg: 0, s: 0, total: P.total, speed: K.siren ? K.v : 0, age: 0, state: 'drive', t: 0, sirenObj: null,
      vmax: K.v, lane: 0     // lane = separación (px de pantalla) del centro de la calle: cada uno va por su carril, a la derecha
    };
    if (K.siren) { v.sirenObj = makeSiren(); }
    if (K.traffic) { v.vmax = K.v * rnd(0.85, 1.1); v.speed = v.vmax * 0.8; v.lane = K.lane != null ? K.lane : K.W * 0.5 + 2; }
    if (kind === 'taxi') {
      v.scenario = Math.random() < 0.5 ? 'pickup' : 'dropoff';
      v.sStop = r.focus != null ? r.focus : P.total * rnd(0.4, 0.6);
      v.speed = K.v;
      v.lane = K.W * 0.5 + 2;
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
  const trafficCount = () => { let n = 0; for (const v of vehicles) if (v.K.traffic) n++; return n; };
  function pickTraffic() {
    let r = Math.random();
    for (const [k, p] of MIX) { if (r < p) return k; r -= p; }
    return 'car';
  }

  // Frenar si hay alguien justo delante (mismo sentido, mismo carril). Devuelve la velocidad máxima permitida.
  function followLimit(v, scale) {
    const ch = Math.cos(v.h), sh = Math.sin(v.h);
    let best = null, bf = 1e9;
    for (const u of vehicles) {
      if (u === v) continue;
      if (!!u.K.outer !== !!v.K.outer) continue;      // bicis y patinetes van por el borde: no frenan a los coches ni al revés
      const ux = (u.x - v.x) * scale, uy = (u.y - v.y) * scale;
      const f = ux * ch + uy * sh;
      const bump = (v.K.L + u.K.L) / 2;
      if (f <= 0 || f > bump + 36 || f >= bf) continue;
      if (Math.abs(-ux * sh + uy * ch) > (v.K.W + u.K.W) / 2) continue;   // en otro carril
      if (Math.cos(u.h - v.h) < 0.5) continue;                            // va en otro sentido o cruza
      best = { u, free: f - bump }; bf = f;
    }
    if (!best) return Infinity;
    if (best.free < 8) return 0;
    return Math.min(best.u.speed * 0.95, (best.free - 8) * 2.5);
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

  // ---------- Aviones y helicóptero ----------
  //  - Un avión cruza el cielo cada 5 min (con su estela y el ruido de un reactor que pasa).
  //  - Un helicóptero llega cada 3 min, aterriza cerca del centro de la pantalla, apaga rotor, lo arranca otra vez, despega y se va.
  //  Todo el sonido está sintetizado con Web Audio (sin archivos) y respeta el botón 🔊 (apagado = silencio).
  const PLANE_EVERY = 5 * 60e3, HELI_EVERY = 3 * 60e3, HELI_ZOOM = 15;
  const T_APP = 10, T_GROUND = 8, T_TAKEOFF = 3.2, T_LEAVE = 11, ROTOR_DEG = 1400;
  const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const sfxOn = () => (window.soundMode ? window.soundMode() : 2) >= 1;
  let volOn = null;
  function syncVol() {
    if (!ac || !bus) return;
    const o = sfxOn();
    if (o !== volOn) { volOn = o; bus.gain.setTargetAtTime(o ? 0.8 : 0, ac.currentTime, 0.08); }
  }
  let sky = null, noiseBuf = null;
  function getSky() {
    if (!sky) { sky = document.createElement('div'); sky.className = 'sky'; map.getContainer().appendChild(sky); }
    return sky;
  }
  function noise() {
    if (noiseBuf || !ac) return noiseBuf;
    const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  function outNode(g, pan) { if (pan) { g.connect(pan); pan.connect(bus); } else g.connect(bus); }
  function killSnd(s) {
    if (!s || !ac) return;
    try {
      const now = ac.currentTime;
      (s.out || s.g).gain.setTargetAtTime(0, now, 0.05);
      ['src', 'lfo', 'whine'].forEach(k => { if (s[k]) s[k].stop(now + 0.4); });
    } catch (e) {}
  }

  // Reactor que pasa: soplido de ruido que sube y baja de tono (efecto Doppler) + rumble grave
  function planeSound() {
    if (!ac || ac.state === 'closed' || !noise()) return null;
    const src = ac.createBufferSource(); src.buffer = noise(); src.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const hiss = ac.createGain(); hiss.gain.value = 0;
    const lo = ac.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 190;
    const rum = ac.createGain(); rum.gain.value = 0;
    const out = ac.createGain(); out.gain.value = 1;
    src.connect(bp); bp.connect(lp); lp.connect(hiss); hiss.connect(out);
    src.connect(lo); lo.connect(rum); rum.connect(out);
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    outNode(out, pan);
    src.start();
    return { src, bp, hiss, rum, out, pan };
  }
  function planeSoundUpdate(s, u, vol, panX) {
    const now = ac.currentTime, env = Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 1.4) * vol;
    s.bp.frequency.setTargetAtTime(330 + 820 * Math.sin(Math.PI * clamp(u, 0, 1)), now, 0.08);
    s.hiss.gain.setTargetAtTime(0.3 * env, now, 0.08);
    s.rum.gain.setTargetAtTime(1.0 * env, now, 0.1);
    if (s.pan) s.pan.pan.setTargetAtTime(panX, now, 0.1);
  }

  // Helicóptero: "tac-tac-tac" de las palas (ruido troceado) + silbido de turbina; el ritmo sigue a las revoluciones del rotor
  function heliSound() {
    if (!ac || ac.state === 'closed' || !noise()) return null;
    const src = ac.createBufferSource(); src.buffer = noise(); src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const chop = ac.createGain(); chop.gain.value = 0.5;
    const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 12;
    const lfoLp = ac.createBiquadFilter(); lfoLp.type = 'lowpass'; lfoLp.frequency.value = 45;
    const lfoAmt = ac.createGain(); lfoAmt.gain.value = 0.5;
    lfo.connect(lfoLp); lfoLp.connect(lfoAmt); lfoAmt.connect(chop.gain);
    src.connect(lp); lp.connect(chop);
    const whine = ac.createOscillator(); whine.type = 'sawtooth'; whine.frequency.value = 520;
    const wl = ac.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 1400;
    const wg = ac.createGain(); wg.gain.value = 0;
    whine.connect(wl); wl.connect(wg);
    const g = ac.createGain(); g.gain.value = 0;
    chop.connect(g); wg.connect(g);
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    outNode(g, pan);
    src.start(); lfo.start(); whine.start();
    return { src, lfo, whine, lp, wg, g, pan };
  }
  function heliSoundUpdate(s, rpm, vol, panX) {
    const now = ac.currentTime;
    s.lfo.frequency.setTargetAtTime(5 + 9 * rpm, now, 0.1);
    s.whine.frequency.setTargetAtTime(240 + 380 * rpm, now, 0.1);
    s.wg.gain.setTargetAtTime(0.03 * rpm * rpm, now, 0.1);
    s.lp.frequency.setTargetAtTime(350 + 450 * rpm, now, 0.1);
    s.g.gain.setTargetAtTime(0.8 * vol * (0.3 + 0.7 * rpm), now, 0.1);
    if (s.pan) s.pan.pan.setTargetAtTime(panX, now, 0.1);
  }

  // ---------- Dibujos ----------
  const planeSVG = (acc, w) => `
    <svg width="${w}" height="${Math.round(w * 0.75)}" viewBox="0 0 160 120" style="overflow:visible">
      <path d="M108 53L58 6H42L80 53Z" fill="#e8edf2" stroke="#9aa5b1" stroke-width="1"/><path d="M108 67L58 114H42L80 67Z" fill="#e8edf2" stroke="#9aa5b1" stroke-width="1"/>
      <path d="M36 53L16 36H6L20 53Z" fill="#e8edf2" stroke="#9aa5b1" stroke-width="1"/><path d="M36 67L16 84H6L20 67Z" fill="#e8edf2" stroke="#9aa5b1" stroke-width="1"/>
      <ellipse cx="84" cy="31" rx="10" ry="4.4" fill="#aab4be" stroke="#7d8894" stroke-width=".8"/><ellipse cx="84" cy="89" rx="10" ry="4.4" fill="#aab4be" stroke="#7d8894" stroke-width=".8"/>
      <path d="M4 57Q4 53 12 53H140Q158 55 158 60Q158 65 140 67H12Q4 67 4 63Z" fill="#fbfcfd" stroke="#9aa5b1" stroke-width="1"/>
      <rect x="22" y="58" width="104" height="4" fill="${acc}"/><rect x="6" y="57" width="22" height="6" rx="2" fill="${acc}"/>
      <path d="M142 56.5Q150 57 152 60Q150 63 142 63.5Z" fill="#2a3542"/>
    </svg>`;
  const heliSVG = (body, acc) => `
    <svg width="96" height="44" viewBox="0 0 96 44" style="overflow:visible">
      <rect x="2" y="20.3" width="48" height="3.4" rx="1.7" fill="${body}" stroke="rgba(0,0,0,.45)" stroke-width=".6"/>
      <rect x="1" y="15.5" width="8" height="13" rx="2.5" fill="${acc}" stroke="rgba(0,0,0,.45)" stroke-width=".6"/>
      <ellipse cx="4.5" cy="22" rx="2" ry="8.5" fill="rgba(40,40,40,.32)"/>
      <rect x="44" y="3.5" width="42" height="2.2" rx="1.1" fill="#2b2f36"/><rect x="44" y="38.3" width="42" height="2.2" rx="1.1" fill="#2b2f36"/>
      <rect x="52" y="3.5" width="2.2" height="37" rx="1" fill="#2b2f36"/><rect x="76" y="3.5" width="2.2" height="37" rx="1" fill="#2b2f36"/>
      <ellipse cx="62" cy="22" rx="25" ry="12.5" fill="${body}" stroke="rgba(0,0,0,.5)" stroke-width=".8"/>
      <path d="M74 13Q92 22 74 31Z" fill="#26364f" stroke="rgba(0,0,0,.4)" stroke-width=".5"/>
      <rect x="48" y="19" width="22" height="6" rx="2" fill="${acc}"/>
      <circle class="hl-disc" cx="60" cy="22" r="44" fill="rgba(255,255,255,.16)"/>
      <g class="hl-rotor"><rect x="16" y="20.6" width="88" height="2.8" rx="1.4" fill="#262a30"/><rect x="58.6" y="-22" width="2.8" height="88" rx="1.4" fill="#262a30"/></g>
      <circle cx="60" cy="22" r="3.2" fill="#1f2329" stroke="#555" stroke-width=".6"/>
    </svg>`;

  // ---------- Avión: cruza la pantalla en el cielo (no está pegado al suelo, el mapa se mueve por debajo) ----------
  const planes = [], helis = [];
  function spawnPlane() {
    const size = map.getSize(), W = SMALL ? 96 : 140, H = Math.round(W * 0.75), ext = W + 60;
    const f = () => rnd(0.18, 0.82), side = Math.floor(Math.random() * 4);
    let a, b;
    if (side === 0) { a = [0, f() * size.y]; b = [size.x, f() * size.y]; }
    else if (side === 1) { a = [size.x, f() * size.y]; b = [0, f() * size.y]; }
    else if (side === 2) { a = [f() * size.x, 0]; b = [f() * size.x, size.y]; }
    else { a = [f() * size.x, size.y]; b = [f() * size.x, 0]; }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    a = [a[0] - ux * ext, a[1] - uy * ext]; b = [b[0] + ux * ext, b[1] + uy * ext];
    const acc = pick(['#1d6fb8', '#d62839', '#2a9d8f', '#f4a261', '#7b4fc9']);
    const el = document.createElement('div'); el.className = 'pl';
    const trail = y => `<i class="pl-trail" style="right:${W * (1 - 84 / 160)}px;top:${(y / 120 * H - 1).toFixed(1)}px"></i>`;
    el.innerHTML = `<div class="pl-rot" style="left:${-W / 2}px;top:${-H / 2}px;width:${W}px;height:${H}px;transform:rotate(${Math.atan2(uy, ux)}rad)">${trail(31)}${trail(89)}${planeSVG(acc, W)}</div>`;
    getSky().appendChild(el);
    const p = { el, a, b, t: 0, dur: Math.hypot(b[0] - a[0], b[1] - a[1]) / rnd(75, 95), snd: planeSound() };
    el.style.transform = `translate3d(${a[0]}px,${a[1]}px,0)`;
    planes.push(p);
    return p;
  }
  function removePlane(i) { killSnd(planes[i].snd); planes[i].el.remove(); planes.splice(i, 1); }
  function updatePlanes(dt) {
    if (!planes.length) return;
    const size = map.getSize();
    for (let i = planes.length - 1; i >= 0; i--) {
      const p = planes[i];
      p.t += dt;
      const u = p.t / p.dur;
      if (u >= 1) { removePlane(i); continue; }
      const x = p.a[0] + (p.b[0] - p.a[0]) * u, y = p.a[1] + (p.b[1] - p.a[1]) * u;
      p.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      if (p.snd && ac) planeSoundUpdate(p.snd, u, sfxOn() ? 1 : 0, clamp((x - size.x / 2) / (size.x / 2), -1, 1) * 0.9);
    }
  }

  // ---------- Helicóptero: llega, aterriza, para el rotor, lo arranca, despega y se va ----------
  function spawnHeli() {
    const scale = Math.pow(2, map.getZoom() - REF_Z), size = map.getSize();
    const lz = map.project(map.containerPointToLatLng({ x: size.x * rnd(0.35, 0.65), y: size.y * rnd(0.38, 0.62) }), REF_Z);
    const ang = rnd(0, Math.PI * 2), D = (Math.hypot(size.x, size.y) / 2 + 170) / scale;
    const start = { x: lz.x + Math.cos(ang) * D, y: lz.y + Math.sin(ang) * D };
    const body = pick(['#f4f6f8', '#f4f6f8', '#c8102e', '#1d6fb8']), acc = body === '#f4f6f8' ? pick(['#d62839', '#1d6fb8', '#2a9d8f']) : '#f4f6f8';
    const icon = L.divIcon({
      className: 'hl', iconSize: [96, 44], iconAnchor: [60, 22],
      html: `<div class="hl-in"><div class="hl-dust"></div><div class="hl-rot">${heliSVG(body, acc)}</div></div>`
    });
    const mk = L.marker(map.unproject(start, REF_Z), { icon, pane: 'emergency', interactive: false, keyboard: false }).addTo(map);
    const el = mk.getElement();
    const q = s => el && el.querySelector(s);
    const H = {
      mk, wrap: q('.hl-in'), rot: q('.hl-rot'), rotor: q('.hl-rotor'), disc: q('.hl-disc'), dust: q('.hl-dust'),
      x: start.x, y: start.y, start, lz, h: ang + Math.PI, dep: 0, t: 0, age: 0, spin: 0, state: 'approach', snd: heliSound()
    };
    if (H.rot) H.rot.style.transform = `rotate(${H.h}rad)`;
    helis.push(H);
    return H;
  }
  function removeHeli(i) { killSnd(helis[i].snd); map.removeLayer(helis[i].mk); helis.splice(i, 1); }
  function updateHelis(dt, scale) {
    if (!helis.length) return;
    const size = map.getSize(), cx = size.x / 2, cy = size.y / 2, half = Math.hypot(cx, cy);
    for (let i = helis.length - 1; i >= 0; i--) {
      const H = helis[i];
      H.t += dt; H.age += dt;
      let rpm = 1, alt = 0, fade = 1;
      if (H.state === 'approach') {
        const u = Math.min(1, H.t / T_APP), e = 1 - (1 - u) * (1 - u);          // frena al llegar
        H.x = H.start.x + (H.lz.x - H.start.x) * e; H.y = H.start.y + (H.lz.y - H.start.y) * e;
        alt = u < 0.45 ? 1 : 1 - sm((u - 0.45) / 0.55);
        fade = Math.min(1, H.age / 2.5);
        if (u >= 1) { H.state = 'ground'; H.t = 0; H.x = H.lz.x; H.y = H.lz.y; }
      } else if (H.state === 'ground') {
        const t = H.t;                                                            // rotor: gira, se para, queda al ralentí, arranca
        rpm = t < 0.6 ? 1 : t < 3.2 ? 1 - 0.88 * sm((t - 0.6) / 2.6) : t < 5 ? 0.12 : t < 7.4 ? 0.12 + 0.88 * sm((t - 5) / 2.4) : 1;
        if (H.t >= T_GROUND) { H.state = 'takeoff'; H.t = 0; H.dep = rnd(0, Math.PI * 2); }
      } else if (H.state === 'takeoff') {
        const u = Math.min(1, H.t / T_TAKEOFF);
        alt = sm(u);
        H.h += clamp(angDiff(H.dep, H.h), -1.6 * dt, 1.6 * dt);                  // se orienta hacia donde se va
        const v = 14 * alt / scale * dt;
        H.x += Math.cos(H.h) * v; H.y += Math.sin(H.h) * v;
        if (u >= 1) { H.state = 'leave'; H.t = 0; }
      } else {
        alt = 1;
        fade = clamp((T_LEAVE - H.t) / 3, 0, 1);
        H.h += clamp(angDiff(H.dep, H.h), -1.2 * dt, 1.2 * dt);
        const v = (28 + 150 * Math.min(1, H.t / 6)) * dt / scale;
        H.x += Math.cos(H.h) * v; H.y += Math.sin(H.h) * v;
        if (H.t >= T_LEAVE) { removeHeli(i); continue; }
      }
      H.spin = (H.spin + ROTOR_DEG * rpm * dt) % 360;
      H.mk.setLatLng(map.unproject({ x: H.x, y: H.y }, REF_Z));
      if (H.rot) H.rot.style.transform = `rotate(${H.h}rad)`;
      if (H.rotor) H.rotor.setAttribute('transform', `rotate(${H.spin.toFixed(1)} 60 22)`);
      if (H.disc) H.disc.style.opacity = (rpm * rpm).toFixed(2);
      if (H.rotor) H.rotor.style.opacity = (0.95 - 0.6 * rpm).toFixed(2);
      if (H.dust) H.dust.style.opacity = (Math.max(0, rpm - 0.15) * (1 - alt) * 0.9).toFixed(2);
      if (H.wrap) {                                                               // más alto = más grande y su sombra más lejos
        H.wrap.style.transform = `scale(${(1 + 0.4 * alt).toFixed(3)})`;
        H.wrap.style.filter = `drop-shadow(${(3 + 14 * alt).toFixed(1)}px ${(5 + 22 * alt).toFixed(1)}px ${(2 + 7 * alt).toFixed(1)}px rgba(0,0,0,${(0.4 - 0.16 * alt).toFixed(2)}))`;
      }
      if (H.snd && ac) {
        const pt = map.latLngToContainerPoint(H.mk.getLatLng());
        const vol = clamp(1.2 - Math.hypot(pt.x - cx, pt.y - cy) / half, 0.08, 1) * fade * (sfxOn() ? 1 : 0);
        heliSoundUpdate(H.snd, rpm, vol, clamp((pt.x - cx) / cx, -1, 1) * 0.85);
      }
    }
  }
  function clearAircraft() {
    while (planes.length) removePlane(0);
    while (helis.length) removeHeli(0);
  }

  // ---------- Bucle ----------
  const lastSpawn = { t: 0 };
  const nextAt = { police: Date.now() + PERIOD.police, fire: Date.now() + PERIOD.fire, ambulance: Date.now() + PERIOD.ambulance };
  let nextPlane = Date.now() + 45e3, nextHeli = Date.now() + 100e3;   // el primero sale pronto; luego cada 5 y cada 3 min
  let nextTaxi = rnd(5, 10), nextTraffic = rnd(0.5, 1.5), last = performance.now(), running = false;
  const approach = (cur, target, step) => cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);

  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    syncVol();
    if (!document.hidden && !zooming) {
      const z = map.getZoom(), scale = Math.pow(2, z - REF_Z), now = Date.now();
      const raining = (window.weatherIntensity ? window.weatherIntensity() : 0) > 0.25;
      const size = map.getSize(), cx = size.x / 2, cy = size.y / 2, half = Math.hypot(cx, cy);

      if (map.setRoads) map.setRoads(z >= MIN_ZOOM, 'v');   // carga las calles solo cuando hacen falta
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
        nextTaxi = rnd(18, 40);
      }
      // Avión (cada 5 min) y helicóptero (cada 3 min; este espera a que te acerques lo bastante)
      if (now >= nextPlane && !planes.length) { spawnPlane(); nextPlane = now + PLANE_EVERY; }
      if (now >= nextHeli && !helis.length && z >= HELI_ZOOM) { spawnHeli(); nextHeli = now + HELI_EVERY; }
      updateHelis(dt, scale);

      // Tráfico normal: al principio llegan rápido hasta llenar la calle, luego se mantiene el flujo
      nextTraffic -= dt;
      if (nextTraffic <= 0) {
        const n = trafficCount();
        let ok = true;
        if (z >= MIN_ZOOM && n < (raining ? Math.round(MAX_TRAFFIC * 0.7) : MAX_TRAFFIC)) ok = !!spawn(pickTraffic(), true);
        nextTraffic = !ok ? 1 : (n < MAX_TRAFFIC * 0.5 ? rnd(0.4, 0.9) : rnd(1.2, 2.6));
      }

      for (let i = vehicles.length - 1; i >= 0; i--) {
        const v = vehicles[i];
        v.age += dt;
        if (v.kind === 'taxi') {
          if (v.state === 'drive') {
            const rem = Math.max(0, (v.sStop - v.s) * scale);           // px de pantalla hasta la parada
            const target = Math.min(v.K.v, Math.sqrt(2 * 60 * rem) + 4, followLimit(v, scale));
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
        } else if (v.K.traffic) {
          const target = Math.min(v.vmax, followLimit(v, scale));
          v.speed = approach(v.speed, target, (target > v.speed ? 40 : 170) * dt);
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
        v.s += step;
        if (v.s >= v.total || v.age > 120) { removeVehicle(i); continue; }
        advance(v);
        // gira suavemente en las curvas y esquinas
        const dh = angDiff(Math.atan2(v.dy, v.dx), v.h), maxT = 6 * dt;
        v.h += Math.max(-maxT, Math.min(maxT, dh));
        if (v.rot) v.rot.style.transform = `rotate(${v.h}rad)`;
        // por su carril: a la derecha del sentido de la marcha (la derecha de (cos h, sin h) en pantalla es (-sin h, cos h))
        if (v.lane) { const o = v.lane / scale; v.x -= Math.sin(v.h) * o; v.y += Math.cos(v.h) * o; }
        // aparece y desaparece suavemente (por si el trayecto termina dentro de la pantalla)
        if (v.wrap) v.wrap.style.opacity = Math.min(1, v.s * scale / 40, (v.total - v.s) * scale / 40).toFixed(2);
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
    if (!document.hidden) updatePlanes(dt);
    requestAnimationFrame(frame);
  }

  map.on('zoomstart', () => { zooming = true; });
  map.on('zoomend', () => { zooming = false; if (map.getZoom() < MIN_ZOOM) clearAll(); });
  // Con la pestaña oculta no hay animación: se quitan los vehículos para que no se quede la sirena sonando
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearAll(); clearAircraft(); }
    else { last = performance.now(); nextPlane = Math.max(nextPlane, Date.now() + 15e3); nextHeli = Math.max(nextHeli, Date.now() + 20e3); }
  });

  function apply() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.opacity = on ? '1' : '.55'; btn.title = on ? 'Tráfico, aviones y helicóptero: activados' : 'Tráfico, aviones y helicóptero: desactivados'; }
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!on) { running = false; clearAll(); clearAircraft(); if (map.setRoads) map.setRoads(false, 'v'); }
  }
  if (btn) btn.onclick = function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) { initAudio(); nextTaxi = 1; nextTraffic = 0.3; }
    apply();
  };
  window.spawnAircraft = kind => { if (!on) return false; initAudio(); if (kind === 'plane') return !!spawnPlane(); if (kind === 'heli') return !!spawnHeli(); return false; };
  window.spawnVehicle = kind => { if (on && KINDS[kind]) { initAudio(); return !!spawn(kind); } return false; };
  apply();
})();
