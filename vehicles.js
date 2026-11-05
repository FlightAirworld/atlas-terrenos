'use strict';
// Tráfico por el mapa:
//  - Coches, camiones y autobuses circulan todo el rato por las calles reales, por su carril (a la derecha), y frenan si hay otro delante.
//    Su tamaño y su carril salen del ancho con el que el mapa dibuja la calle en cada zoom (ver roadMetrics/sizes en mapshim.js).
//  - Policía cada 2 min, ambulancia cada 3 min y bomberos cada 5 min, con luces y sirena (sintetizada, sin archivos).
//  - Los coches siguen las calles reales (OpenStreetMap vía OpenFreeMap); si no hay calles, los taxis y las emergencias cruzan en línea recta.
//  - Taxis que recogen o dejan gente; la luz verde del techo se enciende cuando está libre o parado en la acera.
//  - También circulan motos, bicicletas (con pedaleo) y patinetes; las bicis y patinetes van por el borde de la calzada.
//  - Un avión cruza el cielo cada 5 min y un helicóptero llega cada 3 min, aterriza en un HELIPUERTO del mapa, para el rotor, arranca y se va (con sonido).
//    Los helipuertos se reparten por el mundo en huecos libres (ni calle, ni edificio, ni agua, ni parcela comprada).
//  - AEROPUERTO: en las afueras y descampados (recintos libres de calles y edificios) hay aeropuertos pequeños con pista, calles de rodaje, plataforma,
//    terminal, torre y hangares. Cada ~100 s un avión aterriza, rueda hasta la terminal, espera, retrocede, rueda a la cabecera y despega (con sonido).
//  - VIDA URBANA (ver ciudad.js): los autobuses paran en paradas y recogen/dejan gente; camión de la basura que va parando; furgonetas de reparto en doble fila
//    con las luces de emergencia; coche de autoescuela que se cala; tranvía por las calles con paradas; bodas con coches decorados; ambulancia que sale de un hospital.
//    Las obras (conos) desvían el tráfico y los desfiles lo frenan (CityLife.zones y CityLife.blockers).
// Para probar sin esperar, en la consola: spawnVehicle('car' | 'truck' | 'bus' | 'moto' | 'bike' | 'scooter' | 'police' | 'fire' | 'ambulance' | 'taxi')
// spawnAircraft('plane' | 'heli' | 'airliner')   (helicóptero y avión de línea necesitan un helipuerto / aeropuerto a la vista)
// y spawnAirport()   (coloca un aeropuerto de prueba en el centro de la pantalla, en cualquier sitio, y hace aterrizar un avión)
(function () {
  if (typeof map === 'undefined' || !map) return;
  const KEY = 'vehiclesOn', MIN_ZOOM = 16, REF_Z = 17, MAX_TAXIS = 4;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const MAX_TRAFFIC = SMALL ? 22 : 34;                      // coches, camiones, autobuses, motos, bicis y patinetes a la vez
  const MIX = [['car', 0.46], ['truck', 0.14], ['bus', 0.1], ['moto', 0.12], ['bike', 0.1], ['scooter', 0.08]];  // reparto del tráfico
  const PERIOD = { police: 2 * 60e3, ambulance: 3 * 60e3, fire: 5 * 60e3 };   // cada cuánto sale cada emergencia
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('vehicles-btn');
  let on = true;

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
    .hz { position: absolute; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; border-radius: 50%; background: #ffa31a; box-shadow: 0 0 6px 2px rgba(255,163,26,.9); pointer-events: none; }
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
    .pad { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .pad-in { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    .pad-in svg { position: absolute; left: 0; top: 0; overflow: visible; }
    .pad-l { fill: #8a9099; }
    .pad.on .pad-l { fill: #3df57f; animation: padBlink .7s steps(1) infinite; }
    @keyframes padBlink { 50% { opacity: .15; } }
    @media (prefers-reduced-motion: reduce) { .pad.on .pad-l { animation: none; } }
    .hl { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .hl-in, .hl-rot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: 60px 22px; }
    .hl-rot svg { position: absolute; left: 0; top: 0; overflow: visible; }
    .hl-dust { position: absolute; left: 60px; top: 22px; width: 130px; height: 130px; margin: -65px 0 0 -65px; border-radius: 50%; opacity: 0; background: radial-gradient(circle, rgba(214,196,160,.55), rgba(214,196,160,0) 68%); }
    /* Aeropuerto: recinto con la pista, y avión que aterriza y despega */
    .ap, .al { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .ap-in, .al-in, .al-rot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    .ap-in svg, .al-rot svg { position: absolute; left: 0; top: 0; overflow: visible; }
    .ap-l { fill: #c9ced6; }
    .ap.on .ap-l { fill: #ffe27a; animation: padBlink .7s steps(1) infinite; }
    @media (prefers-reduced-motion: reduce) { .ap.on .ap-l { animation: none; } }`;
  document.head.appendChild(st);
  map.createPane('vehicles'); map.getPane('vehicles').style.zIndex = 580;
  map.createPane('emergency'); map.getPane('emergency').style.zIndex = 595;
  map.createPane('pads'); map.getPane('pads').style.zIndex = 560;            // los helipuertos van por debajo de coches y gente
  ['vehicles', 'emergency'].forEach(n => { map.getPane(n).style.pointerEvents = 'none'; });

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Tamaño de vehículos (FV) y personas (FP) según el ancho con el que se dibuja la calle ahora mismo.
  // SPD: los coches no van tan despacio como dicta la escala real (si no, parecerían parados): crece más despacio que FV.
  let FV = 1, FP = 1, SPD = 1;
  function refreshSizes() {
    const z = map.sizes ? map.sizes() : { fv: 1, fp: 1 };
    FV = z.fv; FP = z.fp; SPD = Math.pow(FV, 0.75);
  }
  refreshSizes();

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
      L: 86, W: 24, v: 48, siren: false, traffic: true, pane: 'vehicles', stops: { n: [1, 2], dwell: [4, 6], kind: 'bus' },
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

    // ----- Vida urbana: basura, reparto, autoescuela, boda y tranvía (ver ciudad.js) -----
    garbage: {
      L: 66, W: 23, v: 38, siren: false, traffic: true, pane: 'vehicles', stops: { n: [2, 3], dwell: [3, 4.5], kind: 'garbage' },
      html: () => `
        <svg width="66" height="23" viewBox="0 0 66 23">
          <rect x="1.5" y="2.5" width="65" height="21" rx="4" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".8" width="47" height="21.4" rx="3" fill="#2f8f5b" stroke="rgba(0,0,0,.45)"/>
          <rect x="1.5" y="3" width="7" height="17" rx="1.5" fill="#1f6b42"/><path d="M12 3V20M20 3V20M28 3V20M36 3V20" stroke="rgba(0,0,0,.16)" fill="none"/>
          <rect x="47" y="1.5" width="18" height="20" rx="4.5" fill="#f4f6f8" stroke="rgba(0,0,0,.5)"/>
          <rect x="49" y="3.5" width="7" height="16" rx="2" fill="rgba(0,0,0,.14)"/><path d="M58 4L63.5 6V17L58 19Z" fill="#26364f"/>
          <circle class="la" cx="52" cy="11.5" r="2.3" fill="#ffa31a"/><circle class="lb" cx="52" cy="11.5" r="2.3" fill="#ffd27a"/>
          ${headlights(66, 23)}${taillights(23)}
        </svg>`
    },
    van: {
      L: 46, W: 20, v: 56, siren: false, traffic: true, pane: 'vehicles', stops: { n: [1, 1], dwell: [8, 11], kind: 'van', haz: true },
      look: () => ({ b: pick(['#f4f6f8', '#f4f6f8', '#fff3d6']), s: pick(['#1d6fb8', '#d62839', '#2a9d8f', '#f5b800', '#7b4fc9']) }),
      html: c => `
        <svg width="46" height="20" viewBox="0 0 46 20">
          <rect x="1.5" y="2.5" width="45" height="18" rx="4" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="45" height="19" rx="4" fill="${c.b}" stroke="rgba(0,0,0,.5)"/>
          <rect x="3" y="7.5" width="26" height="5" fill="${c.s}"/>
          <rect x="31" y="2.5" width="4" height="15" rx="1.5" fill="rgba(0,0,0,.14)"/><path d="M36 3.5L41.5 5.5V14.5L36 16.5Z" fill="#26364f"/>
          ${headlights(46, 20)}${taillights(20)}
        </svg>`
    },
    driving: {
      L: 38, W: 18, v: 40, siren: false, traffic: true, pane: 'vehicles', stops: { n: [2, 3], dwell: [1.2, 2.2], kind: 'stall' },
      html: () => `
        <svg width="38" height="18" viewBox="0 0 38 18">
          <rect x="1.5" y="2.5" width="37" height="16" rx="5" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="37" height="17" rx="5" fill="#f4f6f8" stroke="rgba(0,0,0,.5)"/>
          <path d="M26 3L31 4.8V13.2L26 15Z" fill="#26364f"/><path d="M10 3.5L7 5V13L10 14.5Z" fill="#26364f"/>
          <rect x="10" y="3.5" width="16" height="11" rx="2" fill="rgba(255,255,255,.35)" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>
          <rect x="14" y="5.2" width="8" height="7.6" rx="1.3" fill="#2f9e44" stroke="#fff" stroke-width=".8"/>
          <path d="M16.6 6.6V11H20" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          ${headlights(38, 18)}${taillights(18)}
        </svg>`
    },
    wedcar: {
      L: 40, W: 18, v: 50, siren: false, traffic: true, pane: 'vehicles',
      look: () => pick(['#f8f4ec', '#fff', '#1f2430', '#f8f4ec']),
      html: c => `
        <svg width="40" height="18" viewBox="0 0 40 18">
          <path d="M1 9H-9" stroke="#777" stroke-width=".6" fill="none"/><rect x="-12" y="7.4" width="3" height="3.2" rx=".6" fill="#b8bec6"/><rect x="-7" y="7.4" width="3" height="3.2" rx=".6" fill="#b8bec6"/>
          <rect x="1.5" y="2.5" width="39" height="16" rx="5" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="39" height="17" rx="5" fill="${c}" stroke="rgba(0,0,0,.5)"/>
          <path d="M27 3L32 4.8V13.2L27 15Z" fill="#26364f"/><path d="M10 3.5L7 5V13L10 14.5Z" fill="#26364f"/>
          <rect x="10" y="3.5" width="17" height="11" rx="2" fill="rgba(255,255,255,.3)" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>
          <path d="M33 .8V17.2M24 .8L33 9L24 17.2" stroke="#ff6b9a" stroke-width="1.6" fill="none"/>
          <circle cx="33" cy="9" r="2" fill="#ff6b9a"/>
          ${headlights(40, 18)}${taillights(18)}
        </svg>`
    },
    tram: {
      L: 112, W: 22, v: 38, siren: false, traffic: true, center: true, pane: 'vehicles', stops: { n: [2, 3], dwell: [5, 7], kind: 'tram' },
      html: () => `
        <svg width="112" height="22" viewBox="0 0 112 22">
          <rect x="1.5" y="2.5" width="111" height="20" rx="4" fill="rgba(0,0,0,.28)"/>
          <rect x=".5" y=".5" width="54" height="21" rx="4" fill="#f4f6f8" stroke="rgba(0,0,0,.45)"/><rect x="57.5" y=".5" width="54" height="21" rx="4" fill="#f4f6f8" stroke="rgba(0,0,0,.45)"/>
          <rect x="54" y="6" width="4" height="10" fill="#333"/>
          <rect x="1" y="9" width="53" height="4" fill="#d62839"/><rect x="58" y="9" width="53" height="4" fill="#d62839"/>
          <path d="M6 3H50M6 19H50M62 3H106M62 19H106" stroke="#26364f" stroke-width="3" stroke-linecap="round"/>
          <path d="M104 3.5L110 5.5V16.5L104 18.5Z" fill="#26364f"/>
          <path d="M30 11H80" stroke="#444" stroke-width="1" opacity=".5"/>
          ${headlights(112, 22)}${taillights(22)}
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

  // ¿Se puede circular por la calle ln empezando por su extremo `from` (0 = primer punto, 1 = último)? Respeta los sentidos únicos.
  // Solo lo aplican los coches; los peatones (opt.inside) van por donde quieran.
  const canGo = (ln, from) => !ln.ow || (ln.ow === 1 ? from === 0 : from === 1);
  window.roadCanGo = canGo;          // lo usan crossings.js y signs.js (señal de dirección prohibida)

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
      const ln = { pts, ll: c, sc: null, cls: c.cls, ow: c.ow || 0 };
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
    const oneWay = !opt.inside && !opt.anyWay;          // sentidos únicos: los respetan los coches, no los peatones ni las emergencias
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
        if (oneWay && !canGo(ln, e)) return;              // calle de sentido único: solo entra por su entrada (las emergencias van por donde necesiten)
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
      const cl = pts.map(() => s0.ln.cls);               // clase de la calle de cada punto (para saber su ancho)
      let total = makePath(pts).total;
      for (let hop = 0; hop < 60 && total < target; hop++) {   // 60: las calles reales se parten en cada cruce con una horizontal
        const a = pts[pts.length - 1], b = pts[pts.length - 2], hin = Math.atan2(a.y - b.y, a.x - b.x);
        const opts = [];
        near(a).forEach(o => {
          if (used.has(o.ln)) return;
          if (oneWay && !canGo(o.ln, o.end)) return;        // no entran en una calle de sentido único por su salida
          const q = o.end ? o.ln.pts.slice().reverse() : o.ln.pts;
          const turn = Math.abs(angDiff(Math.atan2(q[1].y - q[0].y, q[1].x - q[0].x), hin));
          if (turn < 2.0) opts.push({ o, q, turn });      // sin cambios de sentido bruscos
        });
        if (!opts.length) break;
        opts.sort((x, y) => x.turn - y.turn);
        const ch = Math.random() < 0.75 ? opts[0] : pick(opts);   // casi siempre sigue recto; a veces gira en la esquina
        used.add(ch.o.ln);
        for (let i = 1; i < ch.q.length; i++) { pts.push(ch.q[i]); cl.push(ch.o.ln.cls); }
        total = makePath(pts).total;
      }
      const P = makePath(pts);
      P.cl = cl;
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
  window.roadGraph = roadGraph;     // lo usa crossings.js (semáforos y pasos de peatones en los cruces)

  function pathRoute(Lc, roadsOnly, emergency) {
    const rr = roadRoute(emergency ? { anyWay: true } : undefined);
    if (rr) return rr;
    if (roadsOnly) return null;   // el tráfico normal solo circula por calles; el taxi y las emergencias, si no hay, cruzan recto
    const r = route(Lc);          // sin calles cerca (mar, campo…): línea recta como antes
    return { path: makePath([r.p0, { x: r.p0.x + r.dx * r.total, y: r.p0.y + r.dy * r.total }]), focus: null };
  }
  //#roads-end

  // Distancia (px de pantalla) del eje de la calle al centro de su carril: carril derecho, o el borde para bicis y patinetes.
  // Las emergencias (y todo lo que no sigue una calle real) van por el centro.
  function laneTarget(v) {
    const cl = v.path.cl;
    if (!cl || (!v.K.traffic && v.kind !== 'taxi')) return 0;
    if (v.K.center || zoneFor(v)) return 0;                // el tranvía va por el centro; con obras delante, el tráfico se desvía hacia el centro
    const m = map.roadMetrics(cl[Math.min(v.seg + 1, cl.length - 1)]);
    return m.half * (v.K.outer ? 0.88 : 0.48);
  }

  function spawn(kind, roadsOnly, rOverride) {
    const K = KINDS[kind]; if (!K) return null;
    refreshSizes();
    const r = rOverride || pathRoute(K.L, roadsOnly || !!K.siren || kind === 'taxi', !!K.siren); if (!r) return null;   // emergencias y taxis SOLO van por calles (si no hay ruta, no salen y lo reintentan)
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
      vmax: K.v, lane: 0, fvA: null     // lane = separación (px de pantalla) del eje de la calle: cada uno va por su carril, a la derecha
    };
    if (K.siren) { v.sirenObj = makeSiren(); }
    if (K.traffic) { v.vmax = K.v * rnd(0.85, 1.1); v.speed = v.vmax * 0.8; }
    if (kind === 'taxi') {
      v.scenario = Math.random() < 0.5 ? 'pickup' : 'dropoff';
      v.sStop = r.focus != null ? r.focus : P.total * rnd(0.4, 0.6);
      v.speed = K.v;
      setFree(v, v.scenario === 'pickup');
    }
    if (K.stops && CLife() && P.cl) makeStops(v, K.stops);
    if (kind === 'garbage') haz(v, true);                  // el girofaro naranja del camión de la basura va siempre encendido
    if (kind === 'wedcar') v.honk = rnd(0.5, 2);
    v.lane = laneTarget(v);
    if (v.wrap) { v.wrap.style.scale = FV.toFixed(3); v.fvA = FV; }
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
  // Velocidad máxima permitida: lo más restrictivo entre el coche de delante y un semáforo en rojo (crossings.js)
  // ---------- Vida urbana: obras, desfiles y paradas ----------
  const CLife = () => window.CityLife && window.CityLife.on ? window.CityLife : null;
  function zoneFor(v) {                                  // obra delante en el mismo sentido (ciudad.js crea CityLife.zones)
    const cl = CLife(); if (!cl || !cl.zones.length || v.K.siren) return null;
    for (const z of cl.zones) if ((v.x - z.x) * (v.x - z.x) + (v.y - z.y) * (v.y - z.y) < z.r * z.r && v.dx * z.dx + v.dy * z.dy > 0.4) return z;
    return null;
  }
  function blockLimit(v, scale) {                        // gente de un desfile en la calzada: frenan antes de llegar
    const cl = CLife(); if (!cl || !cl.blockers.length) return Infinity;
    const ch = Math.cos(v.h), sh = Math.sin(v.h); let m = Infinity;
    for (const b of cl.blockers) {
      const ux = (b.x - v.x) * scale, uy = (b.y - v.y) * scale, f = ux * ch + uy * sh;
      if (f <= 0 || f > 70 * FV) continue;
      if (Math.abs(-ux * sh + uy * ch) > v.K.W / 2 * FV + 9 * FP) continue;
      const free = f - v.K.L / 2 * FV - 6;
      m = Math.min(m, free < 6 ? 0 : free * 2.5 / SPD);
    }
    return m;
  }
  function haz(v, on) {                                  // luces de emergencia (cuatro intermitentes naranjas)
    if (!v.rot) return;
    if (on && !v.hzEls) {
      v.hzEls = [[3, 3], [3, v.K.W - 3], [v.K.L - 3, 3], [v.K.L - 3, v.K.W - 3]].map(([x, y]) => {
        const e = document.createElement('i'); e.className = 'hz ' + (x < v.K.L / 2 ? 'la' : 'lb'); e.style.left = x + 'px'; e.style.top = y + 'px'; v.rot.appendChild(e); return e;
      });
    } else if (!on && v.hzEls) { v.hzEls.forEach(e => e.remove()); v.hzEls = null; }
  }
  function makeStops(v, spec) {
    const P = v.path, sc = Math.pow(2, map.getZoom() - REF_Z), lo = 70 / sc, hi = P.total - 100 / sc, n = Math.round(rnd(spec.n[0], spec.n[1]));
    if (hi < lo + 60 / sc) return;
    v.stops = []; v.stopI = 0;
    const seg = (hi - lo) / n;
    for (let i = 0; i < n; i++) {
      const st = { s: lo + seg * (i + rnd(0.2, 0.8)), dwell: rnd(spec.dwell[0], spec.dwell[1]), kind: spec.kind, haz: !!spec.haz, did: false };
      v.stops.push(st);
      if ((spec.kind === 'bus' || spec.kind === 'tram') && window.CityLife) window.CityLife.shelter(P, st.s, P.cl ? P.cl[Math.min(P.pts.length - 1, 1)] : 'minor', spec.kind);
    }
  }
  function stopAct(v, st) {
    const alive = () => vehicles.indexOf(v) >= 0, later = (fn, ms) => setTimeout(() => { if (alive()) fn(); }, ms);
    if (st.kind === 'bus' || st.kind === 'tram') {
      spawnPax(v, 'out'); if (Math.random() < 0.6) later(() => spawnPax(v, 'out'), 500);
      for (let i = 0, n = 1 + Math.floor(rnd(0, 3)); i < n; i++) later(() => spawnPax(v, 'in'), 900 + i * 600);
    } else if (st.kind === 'garbage') spawnPax(v, 'out');
    else if (st.kind === 'van') { spawnPax(v, 'out'); later(() => spawnPax(v, 'in'), Math.max(1000, (st.dwell - 3.2) * 1000)); }
  }
  // Velocidad máxima que permite la siguiente parada (0 si ya está parado en ella)
  function stopCap(v, scale, dt) {
    if (!v.stops || v.stopI >= v.stops.length) return Infinity;
    const st = v.stops[v.stopI];
    if (v.state === 'stop') {
      v.speed = 0; v.t += dt;
      if (!st.did && v.t > 0.5) { st.did = true; stopAct(v, st); }
      if (v.t >= st.dwell) { v.state = 'drive'; v.stopI++; haz(v, false); return Infinity; }
      return 0;
    }
    const rem = Math.max(0, (st.s - v.s) * scale);
    if (rem <= 1.5) { v.speed = 0; v.state = 'stop'; v.t = 0; if (st.haz) haz(v, true); return 0; }
    return Math.sqrt(2 * 60 * rem) / SPD + 3;
  }

  function followLimit(v, scale) {
    let m = Math.min(followLimit0(v, scale), blockLimit(v, scale)), rem = window.Xings ? window.Xings.stopRem(v, scale) : Infinity;
    const sg = window.Signs ? window.Signs.check(v, scale, vehicles) : null;   // señales (signs.js): límite de velocidad, stop y ceda el paso
    if (sg) { m = Math.min(m, sg.cap); rem = Math.min(rem, sg.rem); }
    if (rem === Infinity) return m;
    return Math.min(m, rem <= 1 ? 0 : Math.sqrt(2 * 60 * rem) / SPD + 2);
  }
  function followLimit0(v, scale) {
    const ch = Math.cos(v.h), sh = Math.sin(v.h);
    let best = null, bf = 1e9;
    for (const u of vehicles) {
      if (u === v) continue;
      if (!!u.K.outer !== !!v.K.outer) continue;      // bicis y patinetes van por el borde: no frenan a los coches ni al revés
      const ux = (u.x - v.x) * scale, uy = (u.y - v.y) * scale;
      const f = ux * ch + uy * sh;
      const bump = (v.K.L + u.K.L) / 2 * FV;
      if (f <= 0 || f > bump + 36 * FV || f >= bf) continue;
      if (Math.abs(-ux * sh + uy * ch) > (v.K.W + u.K.W) / 2 * FV) continue;   // en otro carril
      if (Math.cos(u.h - v.h) < 0.5) continue;                            // va en otro sentido o cruza
      best = { u, free: f - bump }; bf = f;
    }
    if (!best) return Infinity;
    if (best.free < 8 * FV) return 0;
    return Math.min(best.u.speed * 0.95, (best.free - 8 * FV) * 2.5 / SPD);
  }

  // Pasajero de taxi (reutiliza la figura de people.js)
  function spawnPax(v, mode) {
    if (!window.personSVG) return null;
    const right = [-Math.sin(v.h), Math.cos(v.h)], fwd = [Math.cos(v.h), Math.sin(v.h)];
    const scale = Math.pow(2, map.getZoom() - REF_Z), W2 = v.K.W / 2 * FV;
    const off = (mode === 'in' ? 44 * FP : W2 + 3 * FP) / scale;
    const x = v.x + right[0] * off, y = v.y + right[1] * off;
    const raining = window.weatherIntensity && window.weatherIntensity() > 0.25;
    const icon = L.divIcon({
      className: 'pw', iconSize: [20, 30], iconAnchor: [10, 28],
      html: `<div class="pw-in${raining ? ' rain' : ''}" style="opacity:0;scale:${FP.toFixed(3)}">${window.personSVG(pick(['#e63946', '#457b9d', '#f4a261', '#2a9d8f', '#9b5de5', '#ffb703']), pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']), pick(['#2b2d42', '#3a3a3a', '#1d3557', '#5c4033']), false)}</div>`
    });
    const mk = L.marker(map.unproject(L.point(x, y), REF_Z), { icon, pane: 'people', interactive: false, keyboard: false }).addTo(map);
    const p = { mk, x, y, age: 0, el: null, flip: null, rain: !!raining, mode, taxi: v, speed: 24 * FP, life: mode === 'in' ? 20 : 6.5, h: 0 };
    if (mode === 'in') {                      // camina hacia la puerta del taxi
      p.tx = v.x + right[0] * (W2 + 4 * FP) / scale; p.ty = v.y + right[1] * (W2 + 4 * FP) / scale;
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
  //  - Un helicóptero llega cada 3 min, aterriza en un helipuerto (el más cercano al centro de la pantalla), apaga rotor, lo arranca otra vez, despega y se va.
  //  Todo el sonido está sintetizado con Web Audio (sin archivos) y respeta el botón 🔊 (apagado = silencio).
  const PLANE_EVERY = 5 * 60e3, HELI_EVERY = 3 * 60e3, HELI_ZOOM = 16;
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

  // ---------- Helipuertos ----------
  // Se reparten por el mundo de forma fija (la misma posición para todos los jugadores): el mundo se divide en celdas de
  // ~250 m y en una de cada tres hay un helipuerto. Dentro de la celda se prueban hasta 6 sitios, siempre en el mismo orden,
  // y vale el primero libre (sin calle, edificio, agua ni parcela comprada); si no hay hueco, esa celda no tiene helipuerto.
  // Solo se comprueba con el mapa cargado y el sitio entero a la vista, para que el resultado sea siempre el mismo.
  const PAD_CELL = 0.0025, PAD_RATE = 0.34, PAD_TRIES = 6, PAD_M = 40, PAD_MIN_Z = 16, PAD_LAYERS = ['st-road', 'st-buildings', 'st-water', 'st-waterway'];
  const pads = new Map();     // 'ix:iy' -> { ix, iy, state: 'pending' | 'ok' | 'none', k, ll, mk, el }
  const hash3 = (a, b, c) => {
    let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  };
  const unit3 = (a, b, c) => hash3(a, b, c) / 4294967296;
  const padCand = (e, k) => ({ lat: (e.iy + 0.12 + 0.76 * unit3(e.ix, e.iy, 10 + 2 * k)) * PAD_CELL - 90, lng: (e.ix + 0.12 + 0.76 * unit3(e.ix, e.iy, 11 + 2 * k)) * PAD_CELL - 180 });

  // ¿Hay una parcela comprada bajo el helipuerto? (entonces ahí hay una casa y el helipuerto desaparece)
  function padOwned(ll) {
    try {
      if (typeof drawn === 'undefined' || typeof cfg === 'undefined' || !cfg || !cfg.size) return false;
      const r = PAD_M / 2 / 111320, rx = r / Math.max(0.1, Math.cos(ll.lat * Math.PI / 180)), sz = cfg.size;
      for (const dy of [-r, 0, r]) for (const dx of [-rx, 0, rx]) {
        if (drawn.has(Math.floor((ll.lng + dx + 180) / sz) + ':' + Math.floor((ll.lat + dy + 90) / sz))) return true;
      }
    } catch (e) {}
    return false;
  }
  const inAirport = ll => { let r = false; airports.forEach(a => { if (r || !a.ll || (a.state !== 'ok')) return; const cl = Math.max(0.1, Math.cos(a.ll.lat * Math.PI / 180)); if (Math.abs(ll.lng - a.ll.lng) * 111320 * cl < AP_W / 2 + 12 && Math.abs(ll.lat - a.ll.lat) * 111320 < AP_H / 2 + 12) r = true; }); return r; };
  const padUsable = e => e.state === 'ok' && !padOwned(e.ll) && !inAirport(e.ll);
  const padSVG = `
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="8" y="9" width="92" height="92" rx="10" fill="rgba(0,0,0,.25)"/>
      <rect x="3" y="3" width="94" height="94" rx="10" fill="#596069" stroke="#eef1f4" stroke-width="2.4"/>
      <circle cx="50" cy="50" r="37" fill="none" stroke="#f7c531" stroke-width="3.6"/>
      <path d="M37 32V68M63 32V68M37 50H63" stroke="#fff" stroke-width="7.5" fill="none"/>
      <circle class="pad-l" cx="11" cy="11" r="2.8"/><circle class="pad-l" cx="89" cy="11" r="2.8"/>
      <circle class="pad-l" cx="11" cy="89" r="2.8"/><circle class="pad-l" cx="89" cy="89" r="2.8"/>
    </svg>`;
  const padScale = () => Math.pow(2, map.getZoom() - REF_Z);
  function padShow(e) {
    if (e.mk) return;
    const S = PAD_M / (40075016.686 * Math.cos(e.ll.lat * Math.PI / 180) / (256 * Math.pow(2, REF_Z)));   // px a zoom de referencia
    const icon = L.divIcon({ className: 'pad', iconSize: [S, S], iconAnchor: [S / 2, S / 2], html: `<div class="pad-in">${padSVG}</div>` });
    e.mk = L.marker(e.ll, { icon, pane: 'pads', interactive: false, keyboard: false }).addTo(map);
    e.el = e.mk.getElement();
    e.inner = e.el && e.el.firstChild;
    if (e.inner) e.inner.style.scale = padScale().toFixed(4);
  }
  function padHide(e) { if (e.mk) { map.removeLayer(e.mk); e.mk = e.el = e.inner = null; } }
  function padRescale() {
    const k = padScale().toFixed(4);
    pads.forEach(e => { if (e.inner) e.inner.style.scale = k; });
  }
  map.on('zoom', padRescale);

  // ¿Está libre el sitio k de la celda? true / false, o null si ahora no se puede saber (fuera de pantalla o mapa sin cargar)
  function padCheck(e, k) {
    const gl = map.gl, c = padCand(e, k), size = map.getSize();
    const rpx = (PAD_M / 2 + 3) * map.pxPerM(), p = map.latLngToContainerPoint(c);
    if (p.x - rpx < 0 || p.y - rpx < 0 || p.x + rpx > size.x || p.y + rpx > size.y || !gl.areTilesLoaded()) return null;
    try {
      const layers = PAD_LAYERS.filter(l => gl.getLayer(l));
      if (!layers.length) return null;
      return gl.queryRenderedFeatures([[p.x - rpx, p.y - rpx], [p.x + rpx, p.y + rpx]], { layers }).length === 0;
    } catch (err) { return null; }
  }
  let padT = 0;
  function padsTick(dt, z) {
    padT -= dt;
    if (padT > 0) return;
    padT = 0.8;
    if (z < PAD_MIN_Z - 0.5) { pads.forEach(padHide); return; }
    const b = map.getBounds(), q = b.pad(0.15), keep = b.pad(0.6);
    const x0 = Math.floor((q.getWest() + 180) / PAD_CELL), x1 = Math.floor((q.getEast() + 180) / PAD_CELL);
    const y0 = Math.floor((q.getSouth() + 90) / PAD_CELL), y1 = Math.floor((q.getNorth() + 90) / PAD_CELL);
    let budget = 3;
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      if (unit3(ix, iy, 1) >= PAD_RATE) continue;
      const key = ix + ':' + iy;
      let e = pads.get(key);
      if (!e) pads.set(key, e = { ix, iy, state: 'pending', k: 0, ll: null, mk: null, el: null, inner: null });
      while (e.state === 'pending' && budget > 0 && z >= PAD_MIN_Z) {     // se resuelve en orden: el sitio k solo cuenta si los anteriores ya estaban descartados
        const r = padCheck(e, e.k);
        if (r === null) break;
        budget--;
        if (r) { e.state = 'ok'; e.ll = padCand(e, e.k); }
        else if (++e.k >= PAD_TRIES) e.state = 'none';
      }
      if (e.state === 'ok') { if (padUsable(e)) padShow(e); else padHide(e); }
    }
    pads.forEach(e => { if (e.state === 'ok' && !keep.contains(e.ll)) padHide(e); });   // fuera de la zona visible se quitan del mapa
    if (pads.size > 1500) pads.forEach((e, key) => { if (e.state === 'none') pads.delete(key); });   // (los descartados solo se olvidan si se acumulan muchos)
  }
  // El helipuerto usable más cercano al centro de la pantalla (y entero a la vista)
  function pickPad() {
    const size = map.getSize(), cx = size.x / 2, cy = size.y / 2;
    let best = null, bd = 1e9;
    pads.forEach(e => {
      if (!padUsable(e) || !e.mk) return;
      const p = map.latLngToContainerPoint(e.ll);
      if (p.x < size.x * 0.1 || p.x > size.x * 0.9 || p.y < size.y * 0.12 || p.y > size.y * 0.88) return;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  }
  const padLights = (e, on) => { if (e && e.el) e.el.classList.toggle('on', !!on); };
  function clearPads() { pads.forEach(padHide); pads.clear(); }

  // ---------- Aeropuerto ----------
  // Igual que los helipuertos, se reparten por el mundo de forma fija (misma posición para todos los jugadores): el mundo se divide en celdas de
  // ~1,1 km y en algo menos de la mitad hay un aeropuerto pequeño (pista de 300 m, calles de rodaje, plataforma, terminal, torre y hangares).
  // Dentro de la celda se prueban hasta 8 sitios, siempre en el mismo orden, y vale el primero libre (sin calle, edificio, agua ni parcela comprada
  // en todo su recinto): por eso salen en las afueras y descampados, no en el centro de una ciudad. Con zoom >= 14,5.
  // Los aviones aterrizan en la pista (de oeste a este), ruedan hasta la plataforma, esperan, retroceden, rodan hasta la cabecera y despegan hacia el oeste.
  // Coordenadas del recinto en metros con el origen en el centro de la pista (x al este, y al sur).
  const AP_CELL = 0.01, AP_RATE = 0.45, AP_TRIES = 8, AP_MIN_Z = 14.5;
  const AP_X0 = -170, AP_Y0 = -26, AP_W = 340, AP_H = 130, AP_CY = AP_Y0 + AP_H / 2;     // recinto
  const AP_PLANE_M = 26, AP_EVERY = 100e3, AP_VAPP = 32, AP_VTAXI = 10, AP_ACC = 2.8;
  const airports = new Map();     // 'ix:iy' -> { ix, iy, state: 'pending' | 'ok' | 'none', k, ll, mk, el, inner, forced }
  const apCand = (e, k) => ({ lat: (e.iy + 0.1 + 0.8 * unit3(e.ix, e.iy, 30 + 2 * k)) * AP_CELL - 90, lng: (e.ix + 0.1 + 0.8 * unit3(e.ix, e.iy, 31 + 2 * k)) * AP_CELL - 180 });

  // Recorridos de los aviones (en metros): se redondean las esquinas con curvas de Bézier
  function apRound(V, R) {
    const out = [V[0]];
    for (let i = 1; i < V.length - 1; i++) {
      const a = V[i - 1], b = V[i], c = V[i + 1], d1 = Math.hypot(b[0] - a[0], b[1] - a[1]), d2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const cut = Math.min(R[i] || 12, d1 * 0.45, d2 * 0.45);
      const p1 = [b[0] + (a[0] - b[0]) / d1 * cut, b[1] + (a[1] - b[1]) / d1 * cut], p2 = [b[0] + (c[0] - b[0]) / d2 * cut, b[1] + (c[1] - b[1]) / d2 * cut];
      for (let k = 0; k <= 8; k++) { const t = k / 8, u = 1 - t; out.push([u * u * p1[0] + 2 * u * t * b[0] + t * t * p2[0], u * u * p1[1] + 2 * u * t * b[1] + t * t * p2[1]]); }
    }
    out.push(V[V.length - 1]);
    const cum = [0];
    for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
    return { pts: out, cum, total: cum[cum.length - 1] };
  }
  function apAt(P, s) {
    s = clamp(s, 0, P.total);
    let lo = 0, hi = P.cum.length - 2;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P.cum[m] <= s) lo = m; else hi = m - 1; }
    const a = P.pts[lo], b = P.pts[lo + 1], l = (P.cum[lo + 1] - P.cum[lo]) || 1, t = (s - P.cum[lo]) / l;
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, h: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  const AP_IN = apRound([[-530, 0], [-55, 0], [-55, 46], [15, 46], [15, 70]], [0, 14, 12, 12, 0]);      // final, pista, calle de salida, plataforma y puesto
  const AP_OUT = apRound([[15, 52], [45, 52], [45, 0], [-600, 0]], [0, 12, 14, 0]);                      // puesto -> cabecera -> despegue hacia el oeste
  const apS = (P, test) => { for (let i = 0; i < P.pts.length; i++) if (test(P.pts[i])) return P.cum[i]; return P.total; };
  const AP_S_TD = 530 - 138;                                      // toma de contacto (x = -138 m: la pista empieza en -150)
  const AP_S_RUN = apS(AP_OUT, p => p[1] <= 0.001);               // ya está en la pista (x = 31): empieza a acelerar
  const AP_S_LO = AP_S_RUN + 31 + 130;                            // despega al llegar a x = -130 m
  const apPd = P => P.pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const apPlaneG = (x, y, deg, acc) => `<g transform="translate(${x} ${y}) rotate(${deg}) translate(${-AP_PLANE_M / 2} ${-AP_PLANE_M * 0.375})">${planeSVG(acc, AP_PLANE_M)}</g>`;

  const AP_SVG = (() => {
    let s = `<svg viewBox="${AP_X0} ${AP_Y0} ${AP_W} ${AP_H}" preserveAspectRatio="none">`;
    s += `<rect x="${AP_X0 + 2}" y="${AP_Y0 + 2}" width="${AP_W - 4}" height="${AP_H - 4}" rx="9" fill="#c6e0a0" stroke="#a5c47e" stroke-width="1.2"/>`;         // terreno del aeródromo
    s += `<rect x="${AP_X0 + 7}" y="${AP_Y0 + 7}" width="${AP_W - 14}" height="${AP_H - 14}" rx="6" fill="none" stroke="#7d8590" stroke-width=".7" stroke-dasharray="2.2 1.8"/>`;   // valla
    [[-160, -18, 4], [-153, -21, 3], [-162, 90, 5], [-154, 96, 3.5], [158, -14, 4], [162, 95, 4.5], [150, 99, 3]].forEach(t => { s += `<circle cx="${t[0] + 1}" cy="${t[1] + 1.2}" r="${t[2]}" fill="rgba(0,0,0,.18)"/><circle cx="${t[0]}" cy="${t[1]}" r="${t[2]}" fill="#6fb35e"/><circle cx="${t[0] - 1}" cy="${t[1] - 1}" r="${t[2] * 0.5}" fill="#8cca76"/>`; });
    // plataforma de hormigón (con juntas) y calles de rodaje
    s += `<rect x="-76" y="36" width="231" height="46" rx="3" fill="#aab0b8" stroke="#8a9099" stroke-width="1"/>`;
    let j = '';
    for (let x = -64; x < 155; x += 12) j += `M${x} 36V82`;
    for (let y = 47; y < 82; y += 11) j += `M-76 ${y}H155`;
    s += `<path d="${j}" stroke="#8d939b" stroke-width=".35" opacity=".5" fill="none"/>`;
    s += `<rect x="-61" y="14" width="12" height="24" fill="#565c66"/><rect x="39" y="14" width="12" height="24" fill="#565c66"/>`;
    // pista
    s += `<rect x="-150" y="-16" width="300" height="32" rx="3" fill="#464b54" stroke="#2f343b" stroke-width="1"/>`;
    s += `<path d="M-146 -13.6H146M-146 13.6H146" stroke="#f1f3f5" stroke-width="1" fill="none"/>`;
    s += `<path d="M-122 0H122" stroke="#f1f3f5" stroke-width="1.3" stroke-dasharray="11 8" fill="none"/>`;
    for (let i = 0; i < 8; i++) { const y = -12.2 + i * 3.5; s += `<rect x="-147" y="${y}" width="10" height="1.7" fill="#f1f3f5"/><rect x="137" y="${y}" width="10" height="1.7" fill="#f1f3f5"/>`; }
    s += `<text transform="translate(-124 0) rotate(90)" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="9" fill="#f1f3f5">09</text>`;
    s += `<text transform="translate(124 0) rotate(-90)" text-anchor="middle" dominant-baseline="central" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="9" fill="#f1f3f5">27</text>`;
    for (let x = -140; x <= 140; x += 14) s += `<circle class="ap-l" cx="${x}" cy="-17.6" r="1.1"/><circle class="ap-l" cx="${x}" cy="17.6" r="1.1"/>`;
    // líneas amarillas de rodaje, líneas de espera y puestos de estacionamiento
    const yl = 'stroke="#f2c200" stroke-width=".9" fill="none"';
    s += `<path d="${apPd(apRound([[-55, 3], [-55, 46], [15, 46], [15, 70]], [0, 12, 12, 0]))}" ${yl}/><path d="${apPd(apRound([[15, 52], [45, 52], [45, 3]], [0, 12, 0]))}" ${yl}/>`;
    s += `<path d="M-61 20H-49M-61 21.6H-49M39 20H51M39 21.6H51" stroke="#f2c200" stroke-width=".6" fill="none"/>`;
    [-62, -36, 15].forEach(x => { s += `<path d="M${x} 56V82" stroke="#f2c200" stroke-width=".6" fill="none" stroke-dasharray="3 2"/>`; });
    s += apPlaneG(-62, 71, 90, '#d62839') + apPlaneG(-36, 71, 90, '#2a9d8f');                                // aviones aparcados mirando a la terminal
    // terminal con pasarelas, torre de control y hangares
    s += `<rect x="-71" y="88" width="120" height="16" rx="2" fill="rgba(0,0,0,.2)"/>`;
    [-62, -36, 15].forEach(x => { s += `<rect x="${x - 1.6}" y="80" width="3.2" height="8" fill="#9aa3ad" stroke="#7b838d" stroke-width=".4"/>`; });
    s += `<rect x="-75" y="86" width="120" height="16" rx="2" fill="#e3e7ec" stroke="#98a1ac" stroke-width=".8"/><rect x="-75" y="86" width="120" height="3.4" fill="#79a3c8" opacity=".9"/>`;
    s += `<path d="M-67 93H37M-67 97H37" stroke="#c4cad2" stroke-width=".6"/><rect x="-24" y="86" width="22" height="3.4" fill="#3d6d99"/>`;
    s += `<circle cx="66" cy="96" r="7.6" fill="rgba(0,0,0,.2)"/><circle cx="64" cy="94" r="3.6" fill="#cfd4db" stroke="#98a1ac" stroke-width=".5"/><circle cx="64" cy="94" r="6.2" fill="#5b86ad" stroke="#3d5f80" stroke-width=".8"/><circle cx="64" cy="94" r="4" fill="#93bde0"/><path d="M61.4 92.2A3.4 3.4 0 0 1 65 91" stroke="#fff" stroke-width=".8" fill="none" opacity=".8"/>`;
    [[92, 40], [92, 62]].forEach(h => {
      s += `<rect x="${h[0] + 2}" y="${h[1] + 2.4}" width="58" height="16" rx="1.5" fill="rgba(0,0,0,.22)"/><rect x="${h[0]}" y="${h[1]}" width="58" height="16" rx="1.5" fill="#c8ced6" stroke="#8f97a1" stroke-width=".8"/>`;
      let r = ''; for (let x = h[0] + 6; x < h[0] + 58; x += 6) r += `M${x} ${h[1]}V${h[1] + 16}`;
      s += `<path d="${r}" stroke="#aab1ba" stroke-width=".6"/><rect x="${h[0]}" y="${h[1] + 2}" width="2.4" height="12" fill="#5b6370"/>`;
    });
    // manga de viento
    s += `<g transform="translate(128 -21)"><circle r="1.7" fill="#555"/><path d="M0 0L16 -2.5V2.5Z" fill="#ff7a1a"/><path d="M5.3 -.8V.8M10.6 -1.6V1.6" stroke="#fff" stroke-width="2.4"/></g>`;
    return s + '</svg>';
  })();

  const apScale = () => Math.pow(2, map.getZoom() - REF_Z);
  const apPpm17 = lat => 256 * Math.pow(2, REF_Z) / (40075016.686 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
  function apShow(e) {
    if (e.mk) return;
    const k = apPpm17(e.ll.lat), Wp = AP_W * k, Hp = AP_H * k;
    const icon = L.divIcon({ className: 'ap', iconSize: [Wp, Hp], iconAnchor: [Wp / 2, Hp / 2], html: `<div class="ap-in">${AP_SVG}</div>` });
    e.mk = L.marker(e.ll, { icon, pane: 'pads', interactive: false, keyboard: false }).addTo(map);
    e.el = e.mk.getElement();
    e.inner = e.el && e.el.firstChild;
    if (e.inner) e.inner.style.scale = apScale().toFixed(4);
  }
  function apHide(e) { if (e.mk) { map.removeLayer(e.mk); e.mk = e.el = e.inner = null; } }
  map.on('zoom', () => { const k = apScale().toFixed(4); airports.forEach(e => { if (e.inner) e.inner.style.scale = k; }); });

  // ¿Hay una parcela comprada dentro del recinto? (entonces ahí hay una casa y el aeropuerto desaparece)
  function apOwned(e) {
    try {
      if (typeof drawn === 'undefined' || typeof cfg === 'undefined' || !cfg || !cfg.size) return false;
      const sz = cfg.size, cl = Math.max(0.1, Math.cos(e.ll.lat * Math.PI / 180));
      for (let dx = -AP_W / 2; dx <= AP_W / 2 + 1; dx += 45) for (let dy = -AP_H / 2; dy <= AP_H / 2 + 1; dy += 45) {
        if (drawn.has(Math.floor((e.ll.lng + dx / (111320 * cl) + 180) / sz) + ':' + Math.floor((e.ll.lat + dy / 111320 + 90) / sz))) return true;
      }
    } catch (err) {}
    return false;
  }
  const apUsable = e => e.state === 'ok' && (e.forced || !apOwned(e));

  // ¿Está libre el sitio k de la celda? true / false, o null si ahora no se puede saber (recinto no entero a la vista o mapa sin cargar)
  function apCheck(e, k) {
    const gl = map.gl, c = apCand(e, k), size = map.getSize(), ppm = map.pxPerM(), p = map.latLngToContainerPoint(c);
    const hw = (AP_W / 2 + 6) * ppm, hh = (AP_H / 2 + 6) * ppm;
    if (p.x - hw < 0 || p.y - hh < 0 || p.x + hw > size.x || p.y + hh > size.y || !gl.areTilesLoaded()) return null;
    try {
      const layers = PAD_LAYERS.filter(l => gl.getLayer(l));
      if (!layers.length) return null;
      return gl.queryRenderedFeatures([[p.x - hw, p.y - hh], [p.x + hw, p.y + hh]], { layers }).length === 0;
    } catch (err) { return null; }
  }
  let apT = 0;
  function airportsTick(dt, z) {
    apT -= dt;
    if (apT > 0) return;
    apT = 1;
    if (z < AP_MIN_Z - 0.3) { airports.forEach(apHide); return; }
    const b = map.getBounds(), q = b.pad(0.1), keep = b.pad(0.6);
    const x0 = Math.floor((q.getWest() + 180) / AP_CELL), x1 = Math.floor((q.getEast() + 180) / AP_CELL);
    const y0 = Math.floor((q.getSouth() + 90) / AP_CELL), y1 = Math.floor((q.getNorth() + 90) / AP_CELL);
    let budget = 2;
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      if (unit3(ix, iy, 2) >= AP_RATE) continue;
      const key = ix + ':' + iy;
      let e = airports.get(key);
      if (!e) airports.set(key, e = { ix, iy, state: 'pending', k: 0, ll: null, mk: null, el: null, inner: null, forced: false });
      while (e.state === 'pending' && budget > 0) {          // en orden: el sitio k solo cuenta si los anteriores ya estaban descartados
        const r = apCheck(e, e.k);
        if (r === null) break;
        budget--;
        if (r) { e.state = 'ok'; e.ll = apCand(e, e.k); }
        else if (++e.k >= AP_TRIES) e.state = 'none';
      }
      if (e.state === 'ok') { if (apUsable(e)) apShow(e); else apHide(e); }
    }
    airports.forEach(e => { if (e.forced && keep.contains(e.ll)) apShow(e); });
    airports.forEach(e => { if (e.state === 'ok' && !keep.contains(e.ll)) apHide(e); });
    if (airports.size > 600) airports.forEach((e, key) => { if (e.state === 'none') airports.delete(key); });
  }
  // El aeropuerto usable más cercano al centro de la pantalla (con el centro del recinto a la vista)
  function pickAirport() {
    const size = map.getSize(), cx = size.x / 2, cy = size.y / 2;
    let best = null, bd = 1e9;
    airports.forEach(e => {
      if (!apUsable(e) || !e.mk) return;
      const p = map.latLngToContainerPoint(e.ll);
      if (p.x < size.x * 0.05 || p.x > size.x * 0.95 || p.y < size.y * 0.08 || p.y > size.y * 0.92) return;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  }
  const apLights = (e, on) => { if (e && e.el) e.el.classList.toggle('on', !!on); };
  function clearAirports() { airports.forEach(apHide); airports.clear(); }
  // Para probar en cualquier sitio (también en una ciudad): coloca un aeropuerto en el centro de la pantalla, sin mirar si hay calles debajo
  function forceAirport() {
    const ll = map.getCenter(), e = { ix: 0, iy: 0, state: 'ok', k: 0, ll: { lat: ll.lat, lng: ll.lng }, mk: null, el: null, inner: null, forced: true };
    airports.forEach((o, key) => { if (o.forced) { apHide(o); airports.delete(key); } });
    airports.set('forced:' + Date.now(), e);
    apShow(e);
    return e;
  }

  // ---------- Avión de línea: aterriza, rueda hasta la plataforma, espera, retrocede, rueda a la cabecera y despega ----------
  const airliners = [];
  const apWorld = (e, x, y) => { const k = apPpm17(e.ll.lat), c = e.c0 || (e.c0 = map.project(e.ll, REF_Z)); return { x: c.x + x * k, y: c.y + (y - AP_CY) * k }; };
  function spawnAirliner(forced) {
    const e = pickAirport();
    if (!e) return null;
    const acc = pick(['#1d6fb8', '#d62839', '#2a9d8f', '#f4a261', '#7b4fc9']);
    const icon = L.divIcon({ className: 'al', iconSize: [160, 120], iconAnchor: [80, 60], html: `<div class="al-in"><div class="al-rot">${planeSVG(acc, 160)}</div></div>` });
    const w0 = apWorld(e, AP_IN.pts[0][0], AP_IN.pts[0][1]);
    const mk = L.marker(map.unproject(w0, REF_Z), { icon, pane: 'emergency', interactive: false, keyboard: false }).addTo(map), el = mk.getElement();
    const A = { e, mk, wrap: el && el.querySelector('.al-in'), rot: el && el.querySelector('.al-rot'), state: 'in', s: 0, v: AP_VAPP, h: 0, t: 0, age: 0, pb: 0, snd: planeSound(), sndK: 'in', gone: false };
    apLights(e, true);
    airliners.push(A);
    return A;
  }
  function removeAirliner(i) { const A = airliners[i]; apLights(A.e, false); killSnd(A.snd); map.removeLayer(A.mk); airliners.splice(i, 1); }
  function updateAirliners(dt, scale) {
    if (!airliners.length) return;
    const size = map.getSize(), cx = size.x / 2, cy = size.y / 2, half = Math.hypot(cx, cy), ppm = map.pxPerM();
    for (let i = airliners.length - 1; i >= 0; i--) {
      const A = airliners[i], e = A.e;
      if (!e.mk && !e.forced) { removeAirliner(i); continue; }   // el aeropuerto ha desaparecido (alguien compró una parcela)
      A.t += dt; A.age += dt;
      let alt = 0, fade = 1, px = 0, py = 0, th = A.h, su = null;
      if (A.state === 'in') {
        const rem = AP_IN.total - A.s;
        let tgt = A.s < AP_S_TD ? AP_VAPP : Math.max(AP_VTAXI, Math.sqrt(Math.max(0, AP_VAPP * AP_VAPP - 2 * 6.8 * (A.s - AP_S_TD))));
        if (rem < 45) tgt = Math.min(tgt, Math.sqrt(2 * 2.4 * rem) + 0.5);
        A.v = approach(A.v, tgt, (tgt > A.v ? 4 : 9) * dt);
        A.s = Math.min(AP_IN.total, A.s + A.v * dt);
        const p = apAt(AP_IN, A.s); px = p.x; py = p.y; th = p.h;
        alt = A.s < AP_S_TD ? Math.pow(clamp((AP_S_TD - A.s) / 330, 0, 1), 1.2) : 0;
        fade = Math.min(1, A.age / 2);
        su = clamp(A.s / (AP_S_TD + 130), 0, 1);
        if (A.s > AP_S_TD + 130 && A.snd) { killSnd(A.snd); A.snd = null; }
        if (rem <= 0.6) { A.state = 'park'; A.t = 0; A.v = 0; }
        A.h += clamp(angDiff(th, A.h), -2.2 * dt, 2.2 * dt);
      } else if (A.state === 'park') {
        const p = apAt(AP_IN, AP_IN.total); px = p.x; py = p.y;
        if (A.t > 14) { A.state = 'push'; A.t = 0; A.pb = 0; }
      } else if (A.state === 'push') {                    // retrocede empujado por un tractor (sin cambiar de rumbo)
        A.pb += 2.6 * dt;
        const p = apAt(AP_IN, AP_IN.total); px = p.x; py = p.y - Math.min(18, A.pb);
        if (A.pb >= 18) { A.state = 'turn'; A.t = 0; }
      } else if (A.state === 'turn') {                    // gira en su sitio hacia la calle de rodaje
        const p = apAt(AP_OUT, 0); px = p.x; py = p.y;
        A.h += clamp(angDiff(p.h, A.h), -0.75 * dt, 0.75 * dt);
        if (Math.abs(angDiff(p.h, A.h)) < 0.03) { A.state = 'out'; A.s = 0; A.v = 0; A.t = 0; }
      } else {
        const tgt = A.s < AP_S_RUN ? 9 : 46;
        A.v = approach(A.v, tgt, (A.s < AP_S_RUN ? 2.5 : AP_ACC) * dt);
        A.s = Math.min(AP_OUT.total, A.s + A.v * dt);
        const p = apAt(AP_OUT, A.s); px = p.x; py = p.y; th = p.h;
        A.h += clamp(angDiff(th, A.h), -2.2 * dt, 2.2 * dt);
        alt = Math.pow(clamp((A.s - AP_S_LO) / 240, 0, 1), 1.3);
        fade = clamp((AP_OUT.total - A.s) / 120, 0, 1);
        if (A.s > AP_S_RUN - 12 && !A.snd && A.sndK !== 'out') { A.sndK = 'out'; A.snd = planeSound(); }
        su = clamp((A.s - AP_S_RUN + 12) / 430, 0, 1);
        if (A.s >= AP_OUT.total) { removeAirliner(i); continue; }
      }
      const w = apWorld(e, px, py);
      A.mk.setLatLng(map.unproject(w, REF_Z));
      if (A.rot) A.rot.style.transform = `rotate(${A.h}rad)`;
      if (A.wrap) {                                       // más alto = más grande y su sombra más lejos; el tamaño sigue al de la pista
        const f = clamp(ppm * AP_PLANE_M / 160, 0.03, 4) * (1 + 0.45 * alt), z = clamp(ppm / 0.7, 0.3, 1.6);
        A.wrap.style.transform = `scale(${f.toFixed(4)})`;
        A.wrap.style.opacity = fade.toFixed(2);
        A.wrap.style.filter = `drop-shadow(${((2 + 30 * alt) * z / f).toFixed(1)}px ${((3 + 46 * alt) * z / f).toFixed(1)}px ${((1 + 8 * alt) * z / f).toFixed(1)}px rgba(0,0,0,${(0.34 - 0.14 * alt).toFixed(2)}))`;
      }
      if (A.snd && ac && su !== null) {
        const pt = map.latLngToContainerPoint(A.mk.getLatLng());
        const vol = clamp(1.2 - Math.hypot(pt.x - cx, pt.y - cy) / half, 0.08, 1) * fade * (sfxOn() ? 1 : 0);
        planeSoundUpdate(A.snd, su, vol, clamp((pt.x - cx) / cx, -1, 1) * 0.85);
      }
    }
  }

  // ---------- Helicóptero: llega, aterriza en el helipuerto, para el rotor, lo arranca, despega y se va ----------
  // El tamaño sigue al del helipuerto (que mide PAD_M metros) para que el aparato quepa en él a cualquier zoom.
  let HF = 1;
  const heliScale = () => clamp(PAD_M * map.pxPerM() * 0.55 / 88, 0.22, 1.1);
  function spawnHeli() {
    const pad = pickPad();
    if (!pad) return null;                                   // sin helipuerto a la vista no hay dónde aterrizar
    HF = heliScale();
    const scale = Math.pow(2, map.getZoom() - REF_Z), size = map.getSize();
    const lz = map.project(pad.ll, REF_Z);
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
      mk, wrap: q('.hl-in'), rot: q('.hl-rot'), rotor: q('.hl-rotor'), disc: q('.hl-disc'), dust: q('.hl-dust'), pad,
      x: start.x, y: start.y, start, lz, h: ang + Math.PI, dep: 0, t: 0, age: 0, spin: 0, state: 'approach', snd: heliSound()
    };
    if (H.rot) H.rot.style.transform = `rotate(${H.h}rad)`;
    padLights(pad, true);                                    // las luces del helipuerto parpadean mientras hay un helicóptero
    helis.push(H);
    return H;
  }
  function removeHeli(i) { padLights(helis[i].pad, false); killSnd(helis[i].snd); map.removeLayer(helis[i].mk); helis.splice(i, 1); }
  function updateHelis(dt, scale) {
    if (!helis.length) return;
    HF = heliScale();
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
        H.x = H.lz.x; H.y = H.lz.y;                                               // posado sobre la H
        if (H.t >= T_GROUND) { H.state = 'takeoff'; H.t = 0; H.dep = rnd(0, Math.PI * 2); }
      } else if (H.state === 'takeoff') {
        const u = Math.min(1, H.t / T_TAKEOFF);
        alt = sm(u);
        H.h += clamp(angDiff(H.dep, H.h), -1.6 * dt, 1.6 * dt);                  // se orienta hacia donde se va
        const v = 14 * alt * HF / scale * dt;
        H.x += Math.cos(H.h) * v; H.y += Math.sin(H.h) * v;
        if (u >= 1) { H.state = 'leave'; H.t = 0; padLights(H.pad, false); }
      } else {
        alt = 1;
        fade = clamp((T_LEAVE - H.t) / 3, 0, 1);
        H.h += clamp(angDiff(H.dep, H.h), -1.2 * dt, 1.2 * dt);
        const v = (28 + 150 * Math.min(1, H.t / 6)) * HF * dt / scale;
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
        H.wrap.style.transform = `scale(${(HF * (1 + 0.4 * alt)).toFixed(3)})`;
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
    while (airliners.length) removeAirliner(0);
  }

  // ---------- Bucle ----------
  const lastSpawn = { t: 0 };
  const nextAt = { police: Date.now() + PERIOD.police, fire: Date.now() + PERIOD.fire, ambulance: Date.now() + PERIOD.ambulance };
  let nextAirliner = Date.now() + 20e3;                            // el primer avión de línea sale pronto (si hay un aeropuerto a la vista)
  let nextPlane = Date.now() + 45e3, nextHeli = Date.now() + 100e3;   // el primero sale pronto; luego cada 5 y cada 3 min
  let nextTaxi = rnd(5, 10), nextTraffic = rnd(0.5, 1.5), last = performance.now(), running = false;
  const approach = (cur, target, step) => cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);

  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    syncVol();
    if (!document.hidden && !zooming) {
      const z = map.getZoom(), scale = Math.pow(2, z - REF_Z), now = Date.now();
      refreshSizes();
      const raining = (window.weatherIntensity ? window.weatherIntensity() : 0) > 0.25;
      const size = map.getSize(), cx = size.x / 2, cy = size.y / 2, half = Math.hypot(cx, cy);

      if (map.setRoads) map.setRoads(z >= MIN_ZOOM, 'v');   // carga las calles solo cuando hacen falta
      // Emergencias periódicas (si el zoom es bajo, esperan a que te acerques)
      if (z >= MIN_ZOOM && now - lastSpawn.t > 10000) {
        for (const k of ['police', 'fire', 'ambulance']) {
          if (now >= nextAt[k]) { const ok = !!spawn(k); nextAt[k] = now + (ok ? PERIOD[k] : 4000); if (ok) lastSpawn.t = now; break; }   // sin ruta por calle, reintenta en 4 s
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
      padsTick(dt, z);
      if (now >= nextHeli && !helis.length && z >= HELI_ZOOM) { if (spawnHeli()) nextHeli = now + HELI_EVERY; else nextHeli = now + 1500; }   // sin helipuerto a la vista, vuelve a mirar enseguida
      updateHelis(dt, scale);
      airportsTick(dt, z);
      if (now >= nextAirliner && !airliners.length && z >= AP_MIN_Z) { if (spawnAirliner()) nextAirliner = now + AP_EVERY * rnd(0.8, 1.2); else nextAirliner = now + 2000; }   // sin aeropuerto a la vista, vuelve a mirar enseguida
      updateAirliners(dt, scale);

      // Tráfico normal: al principio llegan rápido hasta llenar la calle, luego se mantiene el flujo
      nextTraffic -= dt;
      if (nextTraffic <= 0) {
        const n = trafficCount();
        let ok = true;
        const maxT = Math.max(6, Math.round(MAX_TRAFFIC * (window.CityLife ? window.CityLife.mult() : 1)));   // más tráfico en el centro, menos en las afueras
        if (z >= MIN_ZOOM && n < (raining ? Math.round(maxT * 0.7) : maxT)) ok = !!spawn(pickTraffic(), true);
        nextTraffic = !ok ? 1 : (n < maxT * 0.7 ? rnd(0.3, 0.7) : rnd(0.7, 1.5));
      }

      for (let i = vehicles.length - 1; i >= 0; i--) {
        const v = vehicles[i];
        v.age += dt;
        if (v.kind === 'taxi') {
          if (v.state === 'drive') {
            const rem = Math.max(0, (v.sStop - v.s) * scale);           // px de pantalla hasta la parada
            const target = Math.min(v.K.v, Math.sqrt(2 * 60 * rem) / SPD + 4, followLimit(v, scale));
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
          let target = Math.min(v.vmax, followLimit(v, scale));
          const sCap = stopCap(v, scale, dt); if (sCap < target) target = sCap;      // paradas (autobús, basura, reparto…)
          if (zoneFor(v)) target = Math.min(target, 22);                              // pasando junto a unas obras
          v.speed = approach(v.speed, target, (target > v.speed ? 40 : 170) * dt);
          if (v.state === 'stop') v.speed = 0;
          if (v.honk != null && window.cityAudio) {                                   // los coches de la boda tocan el claxon
            v.honk -= dt;
            if (v.honk <= 0) { v.honk = rnd(1.2, 3.4); const pt = map.latLngToContainerPoint(v.mk.getLatLng()); window.cityAudio.horn(clamp(1.1 - Math.hypot(pt.x - cx, pt.y - cy) / half, 0.1, 0.8), true); }
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
        const step = v.speed * SPD * dt / scale;
        v.s += step;
        if (v.s >= v.total || v.age > 120 / SPD) { removeVehicle(i); continue; }
        advance(v);
        // tamaño según el ancho de la calle y carril según el ancho de ESA calle (cambia suave al pasar de una a otra)
        if (v.wrap && v.fvA !== FV) { v.wrap.style.scale = FV.toFixed(3); v.fvA = FV; }
        { const lt = laneTarget(v); v.lane += clamp(lt - v.lane, -30 * dt, 30 * dt); }
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
    if (document.hidden) { clearAll(); clearAircraft(); pads.forEach(e => padLights(e, false)); airports.forEach(e => apLights(e, false)); }
    else { last = performance.now(); nextPlane = Math.max(nextPlane, Date.now() + 15e3); nextHeli = Math.max(nextHeli, Date.now() + 20e3); nextAirliner = Math.max(nextAirliner, Date.now() + 12e3); }
  });

  function apply() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.opacity = on ? '1' : '.55'; btn.title = on ? 'Tráfico, aviones y helicóptero: activados' : 'Tráfico, aviones y helicóptero: desactivados'; }
    if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    if (!on) { running = false; clearAll(); clearAircraft(); clearPads(); clearAirports(); if (map.setRoads) map.setRoads(false, 'v'); }
  }
  if (btn) btn.onclick = function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) { initAudio(); nextTaxi = 1; nextTraffic = 0.3; }
    apply();
  };
  window.spawnAircraft = kind => { if (!on) return false; initAudio(); if (kind === 'plane') return !!spawnPlane(); if (kind === 'heli') return !!spawnHeli(); if (kind === 'airliner') return !!spawnAirliner(); return false; };
  // Aeropuerto de prueba en el centro de la pantalla (sin mirar si hay calles debajo) y un avión que aterriza enseguida
  window.spawnAirport = () => { if (!on) return false; initAudio(); forceAirport(); setTimeout(spawnAirliner, 1200); return true; };
  // API para ciudad.js (eventos de vida urbana)
  window.CityVeh = {
    spawn(kind) { if (!on || map.getZoom() < MIN_ZOOM || !KINDS[kind]) return null; initAudio(); return spawn(kind, true) || null; },
    // Sale desde un punto concreto (p. ej. un hospital): la ambulancia recorre el tramo hasta la calle más cercana y sigue por ella
    spawnFrom(kind, x, y) {
      if (!on || map.getZoom() < MIN_ZOOM || !KINDS[kind]) return null;
      refreshSizes(); const scale = Math.pow(2, map.getZoom() - REF_Z);
      for (let t = 0; t < 6; t++) {
        const rr = roadRoute({ anyWay: true, len: 900, minLen: 320 }); if (!rr) continue;
        const P = rr.path; let bi = -1, bd = 260 * 260;
        P.pts.forEach((p, i) => { const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < bd && i < P.pts.length - 2) { bd = d; bi = i; } });
        if (bi < 0) continue;
        const pts = [{ x, y }, ...P.pts.slice(bi)], Q = makePath(pts); Q.cl = pts.map(() => 'minor');
        if (Q.total * scale < 260) continue;
        initAudio(); const v = spawn(kind, true, { path: Q, focus: null }); if (v) return v;
      }
      return null;
    },
    // Boda: 4 coches decorados por la misma ruta, tocando el claxon
    convoy() {
      if (!on || map.getZoom() < MIN_ZOOM) return false;
      refreshSizes(); const r = pathRoute(40, true, false); if (!r) return false;
      initAudio(); let k = 0; const n = SMALL ? 3 : 4;
      const go = () => { if (!on) return; spawn('wedcar', true, r); if (++k < n) setTimeout(go, 1700); };
      go(); return true;
    }
  };
  window.spawnVehicle = kind => { if (on && KINDS[kind]) { initAudio(); return !!spawn(kind); } return false; };
  apply();
})();
