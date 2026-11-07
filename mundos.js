'use strict';
// Mundos: la Luna, Marte y el resto de planetas, mapas aparte (otra instancia de MapLibre cada uno) que se abren encima del juego con el botón "Mundos".
// En cada planeta se pueden comprar parcelas con los mismos créditos, precio, casas, niveles y producción que en la Tierra,
// pero cada mundo tiene SUS parcelas (el servidor las guarda con su campo «world»; id "<mundo>:x:y"). Se usa el mismo panel de compra de app.js.
// Los viajes (cohete, planetas por el camino y paracaídas) los dibuja viaje.js. Desde cualquier mundo se puede ir a cualquier otro:
//   Tierra → Luna → Marte están en línea, así que ir de la Tierra a Marte pasa por delante de la Luna.
(function () {
  const btn = document.getElementById('mundos-btn');
  if (!btn || !window.maplibregl) return;

  const API = window.API_BASE || location.origin;
  // Ayudas para los mapas ilustrados (sin imágenes reales): cráteres repetibles, bandas de nubes y manchas
  const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const circ = (lo, la, r) => Array.from({ length: 14 }, (_, i) => { const a = i / 14 * 6.2832; return [lo + r * Math.cos(a), Math.max(-80, Math.min(80, la + r * Math.sin(a)))]; });
  const craters = (c, n, seed, r0, r1) => { const r = rnd(seed); return Array.from({ length: n }, () => [c, circ(r() * 300 - 150, r() * 140 - 70, r0 + r() * (r1 - r0))]); };
  const bands = list => list.map(b => [b[0], [[-179, b[1]], [179, b[1]], [179, b[2]], [-179, b[2]]]]);
  const G = (name, bg, land, note, sites, shapes) => ({ name, short: name, bg, attr: name + ': mapa ilustrado (sin imágenes reales)', land, note, sites, shapes });
  const GAS = ' Es un gigante gaseoso: no tiene suelo, lo que ves son nubes ilustradas. Solo se explora.';
  const WORLDS = {
    tierra: { name: 'La Tierra', short: 'Tierra' },
    luna: {
      name: 'La Luna', short: 'Luna',
      tiles: API + '/api/moon-tile/{z}/{x}/{y}.png', bg: '#8a8a8a',
      attr: 'Luna: NASA / LOLA / USGS · OpenPlanetaryMap',
      land: [23.47, 0.67],   // Mar de la Tranquilidad (Apolo 11)
      note: 'Mapa lunar de prueba: de momento solo se explora. Pronto podrás reclamar terrenos aquí.',
      sites: [['Apolo 11', 23.4730, 0.6741], ['Apolo 12', -23.4219, -3.0128], ['Apolo 14', -17.4714, -3.6453],
        ['Apolo 15', 3.6339, 26.1322], ['Apolo 16', 15.5002, -8.9730], ['Apolo 17', 30.7717, 20.1908]]   // [nombre, longitud, latitud]
    },
    marte: {
      name: 'Marte', short: 'Marte',
      tiles: API + '/api/mars-tile/{z}/{x}/{y}.png', bg: '#a85a36',
      attr: 'Marte: NASA / USGS Viking MDIM 2.1 · OpenPlanetaryMap',
      land: [77.45, 18.44],   // cráter Jezero (Perseverance)
      note: 'Mapa de Marte de prueba: de momento solo se explora. Pronto podrás reclamar terrenos aquí.',
      sites: [['Viking 1', -47.95, 22.27], ['Viking 2', 134.26, 47.67], ['Pathfinder', -33.22, 19.13], ['Spirit', 175.47, -14.57],
        ['Opportunity', -5.53, -1.95], ['Curiosity', 137.44, -4.59], ['Phoenix', -125.7, 68.22], ['InSight', 135.62, 4.5],
        ['Perseverance', 77.45, 18.44], ['Zhurong', 109.93, 25.07]]
    },
    pluton: {
      name: 'Plutón', short: 'Plutón', bg: '#b99b84',
      attr: 'Plutón: mapa ilustrado a partir de New Horizons (NASA / JHUAPL / SwRI)',
      land: [165, 22],   // el «corazón» de Plutón (Tombaugh Regio y Sputnik Planitia)
      note: 'Plutón: mapa ilustrado (sin imágenes reales todavía). Solo se explora; las posiciones son aproximadas.',
      sites: [['Sputnik Planitia', 178, 25], ['Tombaugh Regio', 150, 22], ['Cthulhu Macula', 95, -15]],
      shapes: [   // [color, [[lon, lat], ...]]
        ['#f7efe3', [[165, -18], [148, 2], [142, 22], [150, 36], [163, 34], [166, 26], [172, 36], [179, 32], [180, 18], [176, 0]]],
        ['#5a3f33', [[60, -5], [80, -12], [110, -10], [125, -20], [100, -28], [70, -24]]]
      ]
    },
    mercurio: G('Mercurio', '#a39a8f', [162, 31], 'Mercurio: mapa ilustrado de cráteres. Solo se explora.',
      [['Caloris Planitia', 162, 31], ['Cráter Rembrandt', 88, -33]], craters('#8a8075', 40, 7, 3, 9).concat(craters('#d2c9bb', 14, 11, 1.5, 3.5))),
    venus: G('Venus', '#e3a93f', [-165.5, 0.5], 'Venus: mapa ilustrado bajo las nubes ácidas. Solo se explora.',
      [['Maat Mons', -165.5, 0.5], ['Maxwell Montes', 3, 65]], craters('#c98a2b', 18, 5, 8, 20).concat(craters('#f6d27a', 14, 9, 6, 14))),
    jupiter: G('Júpiter', '#ead3ab', [20, -22], 'Júpiter:' + GAS,
      [['Gran Mancha Roja', 20, -22]], bands([['#b87a4a', -62, -48], ['#9a5a30', -34, -22], ['#a8683a', -10, 0], ['#c98f5a', 14, 24], ['#9a5a30', 40, 50]]).concat([['#c0392b', circ(20, -22, 9)]])),
    saturno: G('Saturno', '#ecd9a0', [0, 10], 'Saturno:' + GAS,
      [['Tormenta del norte', 40, 60]], bands([['#cfae6c', -58, -42], ['#b4915a', -26, -12], ['#d9bc7a', 4, 18], ['#b4915a', 30, 42], ['#cfae6c', 54, 66]])),
    urano: G('Urano', '#a9e5ea', [0, 0], 'Urano:' + GAS,
      [['Polo (eje tumbado)', 0, 70]], bands([['#8fd3da', -30, -18], ['#c9f4f4', 14, 26], ['#8fd3da', 44, 54]])),
    neptuno: G('Neptuno', '#3f63e0', [-60, -22], 'Neptuno:' + GAS,
      [['Gran Mancha Oscura', -60, -22]], bands([['#2c46b8', -46, -34], ['#7fa3ff', 8, 16], ['#2c46b8', 34, 46]]).concat([['#10195e', circ(-60, -22, 8)]]))
  };
  const R_KM = { tierra: 6371, luna: 1737.4, marte: 3389.5, mercurio: 2439.7, venus: 6051.8, jupiter: 69911, saturno: 58232, urano: 25362, neptuno: 24622, pluton: 1188.3 };   // para el tamaño real de una parcela en metros
  window.worldInfo = w => ({ name: WORLDS[w] ? WORLDS[w].name : w, radiusKm: R_KM[w] || 6371 });
  const FLOAT = { jupiter: 1, saturno: 1, urano: 1, neptuno: 1 };   // gigantes gaseosos: sin suelo
  Object.keys(WORLDS).forEach(k => {
    const w = WORLDS[k]; if (k === 'tierra') return;
    w.note = '🏗️ ' + w.name + ': acércate con el zoom y toca un cuadrado para comprar tu parcela' + (FLOAT[k] ? ' (flotante, sobre las nubes)' : '') + '. Aquí las parcelas son solo de este mundo.';
    w.attr = (w.attr || '').replace(/ ?: mapa ilustrado \(sin imágenes reales\)/, ': mapa ilustrado');
  });
  const ORDER = ['mercurio', 'venus', 'luna', 'marte', 'jupiter', 'saturno', 'urano', 'neptuno', 'pluton'];
  const planet = w => (window.planetSVG ? window.planetSVG(w) : '');

  const st = document.createElement('style');
  st.textContent = `
    .mundo { position: fixed; inset: 0; z-index: 1900; background: #02030a; color: #fff; }
    .mundo.hidden { display: none !important; }
    .mundo-map { position: absolute; inset: 0; }
    .mundo .mundo-top { position: absolute; left: 0; right: 0; top: 0; padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px 0; display: flex; gap: 8px; align-items: center; justify-content: space-between; pointer-events: none; z-index: 2; flex-wrap: wrap; }
    .mundo .mundo-top > * { pointer-events: auto; }
    .mundo .mundo-title { background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.25); border-radius: 99px; padding: 8px 14px; font: 800 15px/1 system-ui, sans-serif; display: flex; align-items: center; gap: 8px; }
    .mundo .mundo-title svg, .mundo-go svg, #mundos-menu svg { width: 22px; height: 22px; flex: none; display: block; }
    .mundo .mundo-gos { position: relative; display: flex; justify-content: flex-end; }
    .mundo .mundo-drop b { font-size: 13px; margin-left: 2px; }
    .mundo .mundo-list { display: none; position: absolute; right: 0; top: calc(100% + 8px); flex-direction: column; align-items: stretch; gap: 6px; max-height: calc(100vh - 150px); overflow-y: auto; padding: 2px; }
    .mundo .mundo-list.open { display: flex; animation: mundosIn .17s cubic-bezier(.2,.85,.25,1) both; }
    .mundo .mundo-list .mundo-go { white-space: nowrap; background: rgba(0,0,0,.75); }
    .mundo .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group { margin-bottom: 120px; }
    .mundo-go { border: 1px solid rgba(255,255,255,.28); border-radius: 99px; padding: 6px 12px 6px 7px; background: rgba(0,0,0,.55); color: #fff; font: 800 14px/1 system-ui, sans-serif; cursor: pointer; display: flex; align-items: center; gap: 7px; }
    .mundo-go:active { transform: scale(.96); }
    .mundo .mundo-note { position: absolute; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 28px); background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.2); border-radius: 14px; padding: 10px 14px; font: 600 14px/1.35 system-ui, sans-serif; text-align: center; z-index: 2; pointer-events: none; }
    .mundo .mundo-pin { display: flex; flex-direction: column; align-items: center; pointer-events: none; }
    .mundo .mundo-pin i { width: 12px; height: 12px; border-radius: 50%; background: #ffd23f; border: 2px solid #fff; box-shadow: 0 0 8px rgba(255,210,63,.9); }
    .mundo .mundo-pin span { margin-top: 3px; font: 700 11px/1 system-ui, sans-serif; color: #fff; text-shadow: 0 1px 3px #000, 0 0 6px #000; white-space: nowrap; }
    .mundo .maplibregl-ctrl-attrib { font-size: 10px; }
    .mundo-owner { padding: 2px 7px; border-radius: 99px; border: 2px solid #fff; background: rgba(0,0,0,.72); color: #fff; font: 700 11px/1.1 system-ui, sans-serif; white-space: nowrap; pointer-events: none; transform: translateY(-3px); }
    body.en-mundo .panel { z-index: 2100; }   /* el panel de compra va por encima del mapa del planeta */
    #mundos-menu { max-height: calc(100vh - 150px); overflow-y: auto; position: fixed; left: 10px; top: 120px; z-index: 1001; display: none; flex-direction: column; gap: 2px; min-width: 190px; padding: 6px;
      border-radius: 16px; background: var(--mp-bg, #fff); border: 1px solid var(--mp-bd, rgba(0,0,0,.14)); box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 14px 34px rgba(0,0,0,.22);
      -webkit-backdrop-filter: blur(14px) saturate(1.5); backdrop-filter: blur(14px) saturate(1.5); transform-origin: top right; }
    #mundos-menu.open { display: flex; animation: mundosIn .17s cubic-bezier(.2,.85,.25,1) both; }
    @keyframes mundosIn { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
    #mundos-menu button { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; border-radius: 12px; padding: 9px 12px 9px 9px; background: transparent; color: var(--mp-ink, #16211c); font: 600 15px/1.1 system-ui, sans-serif; text-align: left; cursor: pointer; }
    #mundos-menu button:active { background: var(--mp-hover, rgba(0,0,0,.06)); }
    @media (hover: hover) { #mundos-menu button:hover { background: var(--mp-hover, rgba(0,0,0,.06)); } }
    #mundos-menu svg { width: 30px; height: 30px; }`;
  document.head.appendChild(st);

  // ---------- Menú del botón "Mundos" (en la Tierra) ----------
  const menu = document.createElement('div');
  menu.id = 'mundos-menu'; menu.setAttribute('role', 'menu');
  ORDER.forEach(id => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.world = id; b.setAttribute('data-nosound', '');
    b.innerHTML = planet(id) + '<span></span>'; b.lastChild.textContent = WORLDS[id].name;
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const setMenu = open => {
    if (open) { const r = (document.getElementById('menu-btn') || btn).getBoundingClientRect(); menu.style.top = Math.round(r.bottom + 8) + 'px'; menu.style.right = Math.max(10, Math.round(innerWidth - r.right)) + 'px'; menu.style.left = 'auto'; }
    menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    btn.addEventListener('click', () => setMenu(true));   // el menú Menú se cierra solo (lo hace menu.js) y debajo de su botón sale la lista de mundos
  menu.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setMenu(false); travel(b.dataset.world); } });
  document.addEventListener('pointerdown', e => { if (menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) setMenu(false); });

  // ---------- Un mapa por mundo ----------
  const boxes = {}, maps = {};
  function closeLists() { document.querySelectorAll('.mundo-list.open').forEach(l => { l.classList.remove('open'); const d = l.parentNode.querySelector('.mundo-drop'); if (d) d.setAttribute('aria-expanded', 'false'); }); }
  document.addEventListener('pointerdown', e => { if (!e.target.closest || !e.target.closest('.mundo-gos')) closeLists(); });
  // Los sonidos de la Tierra (ciudad, tráfico, trenes, lluvia, clics) se callan fuera de ella; solo suenan los del viaje
  function earthMute(v) {
    window.earthMuted = !!v;
    try { if (window.weatherMute) window.weatherMute(!!v); if (v && window.cityAudio) window.cityAudio.level(0); } catch (e) {}
  }
  // Iconos de línea para la barra de arriba
  const SV = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC = {
    chart: SV('<path d="M5 20v-6M12 20V5M19 20v-9"/>'),
    list: SV('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    globe: SV('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
    info: SV('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>').replace('<svg ', '<svg class="mundo-i" ')
  };
  // Ficha de cada mundo (al tocar el nombre del planeta): [tipo, descripción, diámetro, distancia, gravedad, día, año, temperatura, lunas, dato curioso]
  const INFO = {
    luna: ['Satélite natural de la Tierra', 'La Luna es el único satélite natural de la Tierra. Entre 1969 y 1972 alunizaron en ella seis misiones Apolo.', '3.474 km', '384.400 km de la Tierra', '1,62 m/s² (una sexta parte de la Tierra)', '29,5 días terrestres', '27,3 días (una vuelta a la Tierra)', 'de −173 °C a 127 °C', 'Ninguna', 'Desde la Tierra siempre vemos la misma cara de la Luna.'],
    marte: ['Planeta rocoso', 'Marte es el cuarto planeta del Sistema Solar y se le llama el planeta rojo por el óxido de hierro de su superficie.', '6.779 km', '227,9 millones de km del Sol', '3,71 m/s² (38 % de la Tierra)', '24 h 37 min', '687 días terrestres', 'media de −63 °C', '2: Fobos y Deimos', 'Tiene el volcán más alto del Sistema Solar: el Monte Olimpo, de unos 22 km.'],
    mercurio: ['Planeta rocoso', 'Mercurio es el planeta más cercano al Sol y el más pequeño del Sistema Solar.', '4.879 km', '57,9 millones de km del Sol', '3,70 m/s² (38 % de la Tierra)', 'Un día solar dura 176 días terrestres', '88 días terrestres', 'de −180 °C a 430 °C', 'Ninguna', 'Un día solar en Mercurio dura el doble que su año.'],
    venus: ['Planeta rocoso', 'Venus es el planeta más caliente del Sistema Solar por el efecto invernadero de su densa atmósfera.', '12.104 km', '108,2 millones de km del Sol', '8,87 m/s² (90 % de la Tierra)', '243 días terrestres (gira al revés que la Tierra)', '225 días terrestres', 'unos 465 °C', 'Ninguna', 'En Venus un día dura más que un año.'],
    jupiter: ['Gigante gaseoso', 'Júpiter es el planeta más grande del Sistema Solar. Su Gran Mancha Roja es una tormenta gigante que lleva siglos activa.', '139.820 km', '778,5 millones de km del Sol', '24,79 m/s² (2,5 veces la Tierra)', '9 h 56 min', 'casi 12 años terrestres', 'unos −110 °C en las nubes', 'Más de 90 conocidas', 'Dentro de Júpiter cabrían más de 1.300 Tierras.'],
    saturno: ['Gigante gaseoso', 'Saturno es el segundo planeta más grande y es famoso por sus anillos de hielo y roca.', '116.460 km', '1.434 millones de km del Sol', '10,44 m/s² (1,1 veces la Tierra)', '10 h 33 min', 'unos 29 años terrestres', 'unos −140 °C en las nubes', 'Más de 140 conocidas, como Titán', 'Saturno es menos denso que el agua: flotaría en un océano gigante.'],
    urano: ['Gigante helado', 'Urano es un gigante helado que gira prácticamente tumbado sobre su órbita.', '50.724 km', '2.871 millones de km del Sol', '8,69 m/s² (89 % de la Tierra)', '17 h 14 min', '84 años terrestres', 'unos −195 °C', 'Más de 25 conocidas', 'Su eje está inclinado unos 98 grados.'],
    neptuno: ['Gigante helado', 'Neptuno es el planeta más lejano del Sol. La sonda Voyager 2 lo visitó en 1989 y vio su Gran Mancha Oscura.', '49.244 km', '4.495 millones de km del Sol', '11,15 m/s² (1,1 veces la Tierra)', '16 h 6 min', '165 años terrestres', 'unos −200 °C', 'Al menos 14 conocidas, como Tritón', 'Tiene los vientos más rápidos del Sistema Solar, de más de 2.000 km/h.'],
    pluton: ['Planeta enano', 'Plutón es un planeta enano desde 2006. La sonda New Horizons pasó junto a él en 2015 y descubrió su gran «corazón» de hielo.', '2.377 km', '5.906 millones de km del Sol (media)', '0,62 m/s² (6 % de la Tierra)', '6,4 días terrestres', '248 años terrestres', 'unos −230 °C', '5: Caronte, Estigia, Nix, Cerbero e Hidra', 'Su «corazón» está formado por Tombaugh Regio y Sputnik Planitia.']
  };
  ORDER.forEach(id => {
    const w = WORLDS[id], box = document.createElement('div');
    box.id = 'mundo-' + id; box.className = 'mundo hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', w.name);
    box.innerHTML = `<div class="mundo-map" id="mundo-map-${id}"></div>
      <div class="mundo-top"><button type="button" class="mundo-title" data-nosound>${planet(id)}<span></span>${IC.info}</button><div class="mundo-gos"></div><button type="button" class="mundo-pres hidden" data-nosound></button></div>
      <div class="mundo-note"></div>
      <div class="mundo-sheet hidden"><div class="mundo-card"><button type="button" class="mundo-x" aria-label="Cerrar">×</button><h2 class="mundo-h"></h2><div class="mundo-body"></div></div></div>`;
    box.querySelector('.mundo-title span').textContent = w.name;
    const ttl = box.querySelector('.mundo-title'); ttl.setAttribute('aria-label', 'Información de ' + w.name); ttl.addEventListener('click', () => openInfo(id));
    box.querySelector('.mundo-note').textContent = w.note;
    const gos = box.querySelector('.mundo-gos');   // solo un botón «Mundos»; la lista de planetas se despliega al tocarlo
    gos.innerHTML = '<button type="button" class="mundo-tb mundo-xtra" data-nosound aria-label="Extras" title="Extras">' + IC.chart + '<span class="tb-l">Extras</span></button>'
      + '<button type="button" class="mundo-tb mundo-menus" data-nosound aria-label="Menús" title="Menús">' + IC.list + '<span class="tb-l">Menús</span></button>'
      + '<button type="button" class="mundo-tb mundo-drop" data-nosound aria-haspopup="true" aria-expanded="false" aria-label="Mundos" title="Mundos">' + IC.globe + '<span class="tb-l tb-w">Mundos</span><b>▾</b></button><div class="mundo-list"></div>';
    gos.querySelector('.mundo-xtra').addEventListener('click', () => openSheet(id));
    gos.querySelector('.mundo-menus').addEventListener('click', () => openMenus(id));
    box.querySelector('.mundo-pres').addEventListener('click', () => openSheet(id));
    box.querySelector('.mundo-x').addEventListener('click', () => box.querySelector('.mundo-sheet').classList.add('hidden'));
    box.querySelector('.mundo-sheet').addEventListener('pointerdown', e => { if (e.target.classList.contains('mundo-sheet')) e.currentTarget.classList.add('hidden'); });
    const list = gos.querySelector('.mundo-list'), drop = gos.querySelector('.mundo-drop');
    drop.addEventListener('click', () => { const o = !list.classList.contains('open'); closeLists(); if (o) { list.classList.add('open'); drop.setAttribute('aria-expanded', 'true'); } });
    ['tierra'].concat(ORDER).filter(o => o !== id).forEach(o => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mundo-go'; b.setAttribute('data-nosound', ''); b.setAttribute('aria-label', 'Viajar a ' + WORLDS[o].name);
      b.innerHTML = planet(o) + '<span></span>'; b.lastChild.textContent = WORLDS[o].short;
      b.addEventListener('click', () => travel(o));
      list.appendChild(b);
    });
    document.body.appendChild(box);
    boxes[id] = box;
  });

  // ---------- Estadísticas, presidente y Extras de cada mundo (todos menos la Tierra, que tiene los suyos) ----------
  const css2 = document.createElement('style');
  css2.textContent = `
    .mundo .mundo-top { flex-wrap: nowrap; justify-content: flex-start; gap: 8px; }
    .mundo .mundo-title, .mundo .mundo-gos { height: 40px; background: rgba(10,14,28,.62); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.2); box-shadow: 0 2px 10px rgba(0,0,0,.25); }
    .mundo .mundo-title { color: #fff; cursor: pointer; padding: 0 12px 0 10px; flex: 0 1 auto; min-width: 0; white-space: nowrap; }
    .mundo .mundo-title:active { transform: scale(.97); }
    .mundo .mundo-title .mundo-i { width: 16px; height: 16px; opacity: .65; }
    .mundo .mundo-gos { border-radius: 99px; flex: none; gap: 0; }
    .mundo .mundo-tb { display: flex; align-items: center; gap: 6px; height: 100%; padding: 0 12px; border: 0; background: transparent; color: #fff; font: 700 13px/1 system-ui, sans-serif; cursor: pointer; }
    .mundo .mundo-tb svg { width: 18px; height: 18px; flex: none; display: block; }
    .mundo .mundo-tb:active { background: rgba(255,255,255,.16); }
    .mundo .mundo-xtra { border-radius: 99px 0 0 99px; }
    .mundo .mundo-drop { border-radius: 0 99px 99px 0; }
    .mundo .mundo-menus, .mundo .mundo-drop { border-left: 1px solid rgba(255,255,255,.16); }
    @media (max-width: 459px) { .mundo .mundo-tb .tb-l { display: none; } .mundo .mundo-tb .tb-w { display: inline; } .mundo .mundo-tb { padding: 0 11px; } }
    @media (max-width: 384px) { .mundo .mundo-tb .tb-w { display: none; } }
    .mundo .mundo-facts { display: grid; grid-template-columns: auto 1fr; gap: 7px 14px; margin: 12px 0; }
    .mundo .mundo-facts dt { opacity: .7; }
    .mundo .mundo-facts dd { margin: 0; font-weight: 700; text-align: right; }
    .mundo .mundo-kind { margin: 0 0 6px; font: 800 12px/1 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .06em; opacity: .65; }
    .mundo .mundo-fun { margin: 10px 0 12px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.07); }
    .mundo .mundo-play { display: block; width: 100%; border: 0; border-radius: 99px; padding: 12px; background: #3ddc97; color: #04281d; font: 800 15px/1 system-ui, sans-serif; cursor: pointer; }
    .mundo .mundo-pres.fade { opacity: 0; }
    .mundo .mundo-pres { position: absolute; left: 12px; top: 100%; margin-top: 8px; max-width: calc(100% - 24px); transition: opacity .4s; border: 1px solid rgba(255,210,63,.55); background: rgba(0,0,0,.6); color: #ffe08a; border-radius: 99px; padding: 6px 12px; font: 800 13px/1 system-ui, sans-serif; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mundo .mundo-pres.hidden { display: none; }
    .mundo .mundo-sheet { position: absolute; inset: 0; z-index: 5; background: rgba(0,0,0,.55); display: grid; place-items: center; padding: 16px; }
    .mundo .mundo-sheet.hidden { display: none; }
    .mundo .mundo-card { position: relative; width: min(420px, 100%); max-height: calc(100% - 24px); overflow-y: auto; background: #0e1424; border: 1px solid rgba(255,255,255,.2); border-radius: 20px; padding: 18px 16px 16px; box-shadow: 0 18px 50px rgba(0,0,0,.6); }
    .mundo .mundo-x { position: absolute; right: 10px; top: 8px; border: 0; background: transparent; color: #fff; font-size: 28px; line-height: 1; cursor: pointer; }
    .mundo .mundo-h { margin: 0 34px 10px 0; font: 800 20px/1.2 system-ui, sans-serif; }
    .mundo .mundo-body { font: 500 14px/1.4 system-ui, sans-serif; }
    .mundo .mundo-pres-card { background: linear-gradient(135deg, rgba(255,210,63,.22), rgba(255,210,63,.06)); border: 1px solid rgba(255,210,63,.5); border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; }
    .mundo .mundo-pres-card b { display: block; font-size: 18px; margin-top: 2px; }
    .mundo .mundo-nums { display: flex; gap: 8px; margin-bottom: 10px; }
    .mundo .mundo-nums div { flex: 1; background: rgba(255,255,255,.08); border-radius: 12px; padding: 8px 10px; text-align: center; }
    .mundo .mundo-nums b { display: block; font-size: 20px; }
    .mundo .mundo-nums span { font-size: 12px; opacity: .75; }
    .mundo .mundo-sub { margin: 12px 0 6px; font: 800 13px/1 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .05em; opacity: .7; }
    .mundo .mundo-rank { margin: 0; padding: 0; list-style: none; }
    .mundo .mundo-rank li { display: flex; justify-content: space-between; gap: 10px; padding: 6px 10px; border-radius: 10px; }
    .mundo .mundo-rank li:nth-child(odd) { background: rgba(255,255,255,.05); }
    .mundo .mundo-rank li.first { font-weight: 800; color: #ffe08a; }
    .mundo .mundo-rank li.click { cursor: pointer; }
    .mundo .mundo-rank li.click:active { background: rgba(255,255,255,.18); }
    @media (hover: hover) { .mundo .mundo-rank li.click:hover { background: rgba(255,255,255,.14); } }
    .mundo .mundo-claim { display: block; width: 100%; margin-top: 8px; border: 0; border-radius: 99px; padding: 10px 12px; background: #ffd23f; color: #3a2a00; font: 800 15px/1.1 system-ui, sans-serif; cursor: pointer; }
    .mundo .mundo-claim:disabled { opacity: .6; }
    .mundo .mundo-ok { margin-top: 8px; font-weight: 800; color: #9be7b8; }
    .mundo .mundo-hint { display: block; margin-top: 6px; opacity: .8; font-size: 12px; line-height: 1.3; }
    .mundo .mundo-extras { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .mundo .mundo-extras button { border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.08); color: #fff; border-radius: 12px; padding: 10px 8px; font: 700 14px/1.15 system-ui, sans-serif; cursor: pointer; }
    .mundo .mundo-extras button:active { transform: scale(.97); }
    .mundo .mundo-menulist { display: grid; gap: 8px; }
    .mundo .mundo-menulist button, .mundo .mundo-back { border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.08); color: #fff; border-radius: 12px; padding: 12px 14px; font: 700 15px/1.15 system-ui, sans-serif; cursor: pointer; text-align: left; }
    .mundo .mundo-menulist button:active, .mundo .mundo-back:active { transform: scale(.97); }
    .mundo .mundo-back { padding: 8px 12px; font-size: 13px; margin-bottom: 8px; }
    .mundo .mundo-frame { display: block; width: 100%; height: min(62vh, 520px); border: 0; border-radius: 12px; background: #050816; }
    .mundo .mundo-mine { background: rgba(8,127,91,.25); border: 1px solid rgba(8,127,91,.6); border-radius: 12px; padding: 8px 12px; margin-bottom: 10px; }`;
  document.head.appendChild(css2);

  const EXTRAS = [['daily-btn', '🎁 Regalo diario'], ['roulette-btn', '🎡 Ruleta diaria'], ['monthly-btn', '🗓️ Premios del mes'], ['gift-btn', '💝 Regalar créditos'], ['mine-btn', '🏠 Mis terrenos'], ['howto-btn', '📖 Cómo jugar'], ['share-app-btn', '📤 Compartir']];
  const fmt = n => Number(n || 0).toLocaleString('es');
  const stats = {};   // última respuesta por mundo
  async function loadWorldStats(id) {   // trae las estadísticas y pone al presidente bajo el nombre del mundo
    try {
      const j = await api('/api/world/stats?world=' + encodeURIComponent(id));
      stats[id] = j;
      const chip = boxes[id].querySelector('.mundo-pres');
      chip.textContent = j.president ? `👑 Presidente de ${WORLDS[id].name}: ${j.president.owner} · ${fmt(j.president.n)}` : `👑 ${WORLDS[id].name} aún no tiene presidente: ¡sé el primero!`;
      return j;
    } catch (e) { return null; }
  }
  async function flashPresident(id) {   // al aterrizar: el presidente se ve 5 segundos y se quita solo
    const j = await loadWorldStats(id); if (!j || current !== id) return;
    const chip = boxes[id].querySelector('.mundo-pres');
    clearTimeout(chip._t1); clearTimeout(chip._t2);
    chip.classList.remove('hidden', 'fade');
    chip._t1 = setTimeout(() => chip.classList.add('fade'), 4600);
    chip._t2 = setTimeout(() => chip.classList.add('hidden'), 5000);
  }
  function renderSheet(id, j) {
    const box = boxes[id], body = box.querySelector('.mundo-body'), name = WORLDS[id].name;
    box.querySelector('.mundo-h').textContent = '📊 ' + name;
    body.replaceChildren();
    const add = (tag, cls, text, parent) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; (parent || body).appendChild(el); return el; };
    if (!j) { add('p', '', 'No se pudieron cargar las estadísticas. Inténtalo de nuevo en un rato.'); }
    else {
      const pc = add('div', 'mundo-pres-card');
      add('span', '', `👑 Presidente de ${name}`, pc);
      add('b', '', j.president ? `${j.president.owner} — ${fmt(j.president.n)} terreno${j.president.n === 1 ? '' : 's'}` : 'Aún nadie. ¡Compra un terreno y serás el primero!', pc);
      if (j.prize > 0) {
        if (j.canClaim) {
          const cb = add('button', 'mundo-claim', `🎁 Cobrar ${j.prize} créditos de este mes`, pc); cb.type = 'button';
          cb.addEventListener('click', async () => {
            cb.disabled = true;
            try {
              const r = await api('/api/world/president/claim', { method: 'POST', body: { world: id } });
              if (typeof credits !== 'undefined') { credits = r.credits; if (typeof updateCreditUi === 'function') updateCreditUi(); }
              if (window.sfx) sfx('claim');
              cb.replaceWith(Object.assign(document.createElement('span'), { className: 'mundo-ok', textContent: `🎉 +${r.amount} créditos` }));
              if (stats[id]) { stats[id].canClaim = false; stats[id].claimed = true; }
            } catch (e) { cb.disabled = false; cb.textContent = e.message; }
          });
        } else if (j.claimed) add('div', 'mundo-ok', '✅ Premio de este mes cobrado', pc);
        else add('small', 'mundo-hint', `El presidente de ${name} cobra ${j.prize} créditos gratis cada mes. Para serlo hay que tener cuenta.`, pc);
      }
      const nums = add('div', 'mundo-nums');
      [[j.sold, 'terrenos vendidos'], [j.owners, 'propietarios']].forEach(([n, t]) => { const d = add('div', '', null, nums); add('b', '', fmt(n), d); add('span', '', t, d); });
      if (j.mine && j.mine.n) add('div', 'mundo-mine', `🏠 Tienes ${fmt(j.mine.n)} terreno${j.mine.n === 1 ? '' : 's'} aquí · puesto nº ${j.mine.rank}`);
      add('div', 'mundo-sub', 'Ranking · toca un jugador para ir a su terreno');
      const ol = add('ol', 'mundo-rank');
      j.top.forEach((t, i) => {
        const li = add('li', 'click' + (t.president ? ' first' : ''), null, ol);
        li.tabIndex = 0; li.setAttribute('role', 'button'); li.title = 'Ir a su terreno';
        add('span', '', `${t.president ? '👑 ' : (i + 1) + '. '}${t.owner}${t.me ? ' (tú)' : ''}`, li); add('span', '', fmt(t.n), li);
        const go = () => { box.querySelector('.mundo-sheet').classList.add('hidden'); flyToOwner(id, t); };
        li.addEventListener('click', go); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
      if (!j.top.length) add('li', '', 'Aún no hay propietarios.', ol);
    }
    add('div', 'mundo-sub', 'Extras');
    const ex = add('div', 'mundo-extras');
    EXTRAS.forEach(([bid, label]) => {
      const target = document.getElementById(bid); if (!target) return;
      const b = add('button', '', label, ex); b.type = 'button';
      b.addEventListener('click', () => { box.querySelector('.mundo-sheet').classList.add('hidden'); target.click(); });   // abre lo mismo que en la Tierra (sus ventanas van por encima del mapa del planeta)
    });
  }
  async function openSheet(id) {
    const sheet = boxes[id].querySelector('.mundo-sheet');
    renderSheet(id, stats[id] || null);
    if (!stats[id]) boxes[id].querySelector('.mundo-body').prepend(Object.assign(document.createElement('p'), { textContent: 'Cargando…' }));
    sheet.classList.remove('hidden');
    renderSheet(id, await loadWorldStats(id) || stats[id] || null);
  }

  // Ficha del planeta: sale al tocar su nombre (arriba a la izquierda)
  function openInfo(id) {
    const I = INFO[id]; if (!I) return;
    const box = boxes[id], sheet = box.querySelector('.mundo-sheet'), body = box.querySelector('.mundo-body');
    box.querySelector('.mundo-h').textContent = WORLDS[id].name; body.replaceChildren();
    const add = (tag, cls, text, parent) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; (parent || body).appendChild(el); return el; };
    add('p', 'mundo-kind', I[0]); add('p', '', I[1]);
    const dl = add('dl', 'mundo-facts');
    [['Diámetro', I[2]], [id === 'luna' ? 'Distancia' : 'Distancia al Sol', I[3]], ['Gravedad', I[4]], ['Un día', I[5]], ['Un año', I[6]], ['Temperatura', I[7]], ['Lunas', I[8]]]
      .forEach(([k, v]) => { add('dt', '', k, dl); add('dd', '', v, dl); });
    add('p', 'mundo-fun', '💡 ' + I[9]);
    const go = add('button', 'mundo-play', '🚀 Jugar en ' + WORLDS[id].name.replace(/^La /, 'la ')); go.type = 'button';
    go.addEventListener('click', () => openMenus(id, true));
    sheet.classList.remove('hidden');
  }

  // Pestaña «Menús» de cada planeta: dentro está la página del planeta («Jugar en la Luna», «Jugar en Marte»…), que se abre sin salir del juego
  function openMenus(id, direct) {
    const box = boxes[id], sheet = box.querySelector('.mundo-sheet'), body = box.querySelector('.mundo-body'), h = box.querySelector('.mundo-h');
    const label = 'Jugar en ' + WORLDS[id].name.replace(/^La /, 'la ');
    function list() {
      h.textContent = '📋 Menús'; body.replaceChildren();
      const ul = document.createElement('div'); ul.className = 'mundo-menulist';
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '🚀 ' + label;
      b.addEventListener('click', page); ul.appendChild(b); body.appendChild(ul);
    }
    function page() {
      h.textContent = label; body.replaceChildren();
      const back = document.createElement('button'); back.type = 'button'; back.className = 'mundo-back'; back.textContent = '← Menús';
      back.addEventListener('click', list);
      const f = document.createElement('iframe'); f.className = 'mundo-frame'; f.title = label; f.loading = 'lazy'; f.src = '/mundo-' + id + '.html';
      body.append(back, f);
    }
    if (direct) page(); else list();
    sheet.classList.remove('hidden');
  }

  // Vuela hasta el terreno de un jugador del ranking y lo selecciona
  function flyToOwner(id, t) {
    const m = maps[id]; if (!m || t.lat == null) return;
    const ll = { lng: t.lng, lat: t.lat };
    m.flyTo({ center: [ll.lng, ll.lat], zoom: 17.5, duration: 2500, essential: true });
    m.once('moveend', () => { try { selectAt(id, m, ll); } catch (e) {} });
  }
  // Enlace directo desde las páginas de cada planeta: /?nocover&mundo=luna[&lat=..&lng=..] viaja al mundo (y a ese terreno) en cuanto se pueda
  (function deepLink() {
    const sp = new URLSearchParams(location.search), id = sp.get('mundo');
    if (!id || !WORLDS[id] || id === 'tierra') return;
    const lat = parseFloat(sp.get('lat')), lng = parseFloat(sp.get('lng')), has = isFinite(lat) && isFinite(lng);
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > 80) return clearInterval(t);    // 40 s como mucho
      if (window.coverOpen) return;                  // espera a que se pulse «Jugar» si sale la portada
      clearInterval(t);
      setTimeout(() => {
        if (has) { const after = () => flyToOwner(id, { lat, lng }); pendingGoto = { world: id, lng, lat, after }; }
        travel(id);
      }, 1500);
    }, 500);
  })();

  function build(id) {
    const w = WORLDS[id], note = boxes[id].querySelector('.mundo-note');
    const m = new maplibregl.Map({
      container: 'mundo-map-' + id,
      style: {
        version: 8,
        projection: { type: 'globe' },
        sources: Object.assign(
          { formas: { type: 'geojson', attribution: w.tiles ? '' : w.attr, data: { type: 'FeatureCollection', features: (w.shapes || []).map(s => ({ type: 'Feature', properties: { c: s[0] }, geometry: { type: 'Polygon', coordinates: [s[1].concat([s[1][0]])] } })) } } },
          w.tiles ? { mundo: { type: 'raster', tileSize: 256, maxzoom: 7, tiles: [w.tiles], attribution: w.attr } } : {}),
        layers: [{ id: 'mundo-bg', type: 'background', paint: { 'background-color': w.bg } }]
          .concat(w.tiles ? [{ id: 'mundo', type: 'raster', source: 'mundo' }] : [])
          .concat([{ id: 'formas', type: 'fill', source: 'formas', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.9 } }])
      },
      center: w.land, zoom: 0.8, minZoom: 0.6, maxZoom: 19, pitch: 0, attributionControl: { compact: true },
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5)
    });
    const closeAttrib = () => { const el = boxes[id].querySelector('.maplibregl-ctrl-attrib'); if (el) { el.removeAttribute('open'); el.classList.remove('maplibregl-compact-show'); } };
    m.on('load', closeAttrib); [300, 1500, 4000].forEach(t => setTimeout(closeAttrib, t));   // créditos cerrados: solo la «i»
    m.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');
    w.sites.forEach(s => {
      const el = document.createElement('div'); el.className = 'mundo-pin';
      el.innerHTML = '<i></i><span></span>'; el.querySelector('span').textContent = s[0];
      new maplibregl.Marker({ element: el, anchor: 'top' }).setLngLat([s[1], s[2]]).addTo(m);
    });
    parcelLayer(id, m);   // parcelas de este mundo (cuadrícula, dueños, casas y selección)
    // Textura real opcional (mundos sin teselas): si existe images/planetas/mapa-<mundo>.jpg (.webp/.png), cuadrada en Mercator (la genera tools/make-planets.py), se pone sobre el globo
    if (!w.tiles) {
      let ready = false, texUrl = null;
      const addTex = () => {
        if (!ready || !texUrl || m.getSource('tex')) return;
        m.addSource('tex', { type: 'image', url: texUrl, coordinates: [[-180, 85.051], [180, 85.051], [180, -85.051], [-180, -85.051]] });
        m.addLayer({ id: 'tex', type: 'raster', source: 'tex', paint: { 'raster-fade-duration': 0 } }, m.getLayer('grid') ? 'grid' : undefined);   // por debajo de las parcelas
        if (m.getLayer('formas')) m.setLayoutProperty('formas', 'visibility', 'none');   // con la textura real sobran las manchas ilustradas
      };
      m.on('load', () => { ready = true; addTex(); });
      const tryTex = i => {
        const exts = ['jpg', 'webp', 'png']; if (i >= exts.length) return;
        const url = new URL('images/planetas/mapa-' + id + '.' + exts[i], location.href).href, im = new Image();
        im.onload = () => { texUrl = url; addTex(); }; im.onerror = () => tryTex(i + 1); im.src = url;
      };
      tryTex(0);
    }
    // Si en unos segundos no ha llegado ninguna tesela, se avisa (con el motivo, para poder arreglarlo)
    let got = false, lastErr = '';
    m.on('data', e => { if (e.sourceId === 'mundo' && e.tile) got = true; });
    m.on('error', e => { if (e && e.sourceId === 'mundo') lastErr = String((e.error && (e.error.status || e.error.message)) || ''); else if (e && e.error) console.warn('[mundos] ' + id, e.error); });
    setTimeout(() => {
      if (w.tiles && !got) note.textContent = 'No se pudo cargar el mapa de ' + w.name + (lastErr ? ' (' + lastErr + ')' : '') + '. Inténtalo de nuevo en un rato.';
    }, 8000);
    return m;
  }

  // ---------- Parcelas en cada mundo ----------
  // Mismo reparto que en la Tierra: teselas de 16×16 casillas que se piden al servidor (/api/parcels/tile?world=…) y se guardan un minuto.
  const SHOW_Z = 14, GRID_Z = 15, BUY_Z = 15.5, LABEL_Z = 17, TILE = 16, TILE_TTL = 60000, PAR = 6;
  const cellSize = () => (typeof cfg !== 'undefined' && cfg && cfg.size) || 0.0005;
  const ringOf = (x, y) => { const s = cellSize(), w = x * s - 180, so = y * s - 90; return [[w, so], [w + s, so], [w + s, so + s], [w, so + s], [w, so]]; };
  const colorOf = n => (typeof colorFor === 'function' ? colorFor(n) : '#3ddc97');
  const houseOf = p => (typeof houseFor === 'function' ? houseFor(p.id, p.house) : 'images/casa-1.webp');
  const pw = {};   // mundo -> { owned: Map(id -> parcela), tiles: Map, sel, labels, map, ready }
  const EMPTY = { type: 'FeatureCollection', features: [] };
  const isMine = id => current === id;
  // el icono mide justo lo que una parcela en pantalla: 512·0,0005/360·2^z px (imagen de 128 px)
  const ICON = ['interpolate', ['exponential', 2], ['zoom'], 14, 0.0005 * 512 * Math.pow(2, 14) / 360 / 128, 22, 0.0005 * 512 * Math.pow(2, 22) / 360 / 128];

  function loadHouse(m, url) {   // pinta la foto de la casa en 128×128 y la da de alta como imagen del mapa
    const tryLoad = u => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = u; });
    tryLoad(url.replace(/\.webp$/i, '-s.webp')).catch(() => tryLoad(url)).then(im => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0, 128, 128);
      if (!m.hasImage(url)) m.addImage(url, g.getImageData(0, 0, 128, 128));
    }).catch(() => {});
  }
  function feature(p) {
    return { type: 'Feature', properties: { pid: p.id, color: colorOf(p.owner || ''), img: houseOf(p) }, geometry: { type: 'Polygon', coordinates: [ringOf(p.x, p.y)] } };
  }
  let flushT = 0;
  function flush(id) {
    clearTimeout(flushT);
    flushT = setTimeout(() => {
      const st = pw[id]; if (!st || !st.ready) return;
      st.map.getSource('parcelas').setData({ type: 'FeatureCollection', features: Array.from(st.owned.values()).map(feature) });
      labels(id);
    }, 40);
  }
  function labels(id) {   // nombre del dueño y estrellas sobre cada parcela cuando estás muy cerca
    const st = pw[id]; if (!st) return;
    st.labels.forEach(l => l.remove()); st.labels = [];
    const m = st.map; if (!st.ready || m.getZoom() < LABEL_Z) return;
    const b = m.getBounds(), s = cellSize();
    let n = 0;
    st.owned.forEach(p => {
      if (n >= 80) return;
      const lng = (p.x + 0.5) * s - 180, lat = p.y * s - 90;
      if (lng < b.getWest() || lng > b.getEast() || lat < b.getSouth() || lat > b.getNorth()) return;
      const el = document.createElement('div'); el.className = 'mundo-owner';
      const lvl = typeof levelOf === 'function' ? levelOf(p) : 1;
      el.textContent = (p.owner || '') + (lvl > 1 && typeof starsOf === 'function' ? ' ' + starsOf(lvl) : '');
      el.style.borderColor = colorOf(p.owner || '');
      st.labels.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(m)); n++;
    });
  }
  function grid(id) {   // casillas libres: una cuadrícula fina para ver dónde se puede comprar
    const st = pw[id]; if (!st || !st.ready) return;
    const m = st.map, src = m.getSource('grid'); if (!src) return;
    if (m.getZoom() < GRID_Z) { src.setData(EMPTY); return; }
    const b = m.getBounds(), s = cellSize();
    const x0 = Math.floor((Math.max(-180, b.getWest()) + 180) / s), x1 = Math.ceil((Math.min(180, b.getEast()) + 180) / s);
    const y0 = Math.floor((Math.max(-90, b.getSouth()) + 90) / s), y1 = Math.ceil((Math.min(90, b.getNorth()) + 90) / s);
    if (x1 - x0 > 90 || y1 - y0 > 90) { src.setData(EMPTY); return; }
    const w = x0 * s - 180, e = x1 * s - 180, so = y0 * s - 90, n = y1 * s - 90, lines = [];
    for (let x = x0; x <= x1; x++) lines.push([[x * s - 180, so], [x * s - 180, n]]);
    for (let y = y0; y <= y1; y++) lines.push([[w, y * s - 90], [e, y * s - 90]]);
    src.setData({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } });
  }
  async function loadTiles(id) {
    const st = pw[id]; if (!st || !st.ready) return;
    const m = st.map; if (m.getZoom() < SHOW_Z) return;
    const b = m.getBounds(), s = cellSize(), maxX = Math.round(360 / s) - 1, maxY = Math.round(180 / s) - 1;
    const cell = (v, off, max) => Math.max(0, Math.min(max, Math.floor((v + off) / s)));
    const tx0 = Math.floor(cell(b.getWest(), 180, maxX) / TILE), tx1 = Math.floor(cell(b.getEast(), 180, maxX) / TILE);
    const ty0 = Math.floor(cell(b.getSouth(), 90, maxY) / TILE), ty1 = Math.floor(cell(b.getNorth(), 90, maxY) / TILE);
    const c = m.getCenter(), cx = Math.floor(cell(c.lng, 180, maxX) / TILE), cy = Math.floor(cell(c.lat, 90, maxY) / TILE);
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 400) return;   // límites absurdos (mapa muy alejado o proyección en transición): no se recorre nada, así el móvil no se bloquea
    const todo = [];
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) todo.push([tx, ty]);
    todo.sort((a, d) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(d[0] - cx, d[1] - cy));
    const queue = todo.slice(0, 36);
    const one = async (tx, ty) => {
      const key = tx + ',' + ty, ent = st.tiles.get(key);
      if (ent && (ent.busy || Date.now() - ent.at < TILE_TTL)) return;
      st.tiles.set(key, { at: ent ? ent.at : 0, busy: true });
      try {
        const r = await fetch(API + '/api/parcels/tile?world=' + encodeURIComponent(id) + '&tx=' + tx + '&ty=' + ty);
        if (!r.ok) throw new Error('tile');
        (await r.json()).forEach(p => { p.world = id; st.owned.set(p.id, p); });
        st.tiles.set(key, { at: Date.now(), busy: false });
        flush(id);
      } catch (e) { if (ent) st.tiles.set(key, { at: ent.at, busy: false }); else st.tiles.delete(key); }
    };
    await Promise.all(Array.from({ length: Math.min(PAR, queue.length) }, async () => { for (let t; (t = queue.shift());) await one(t[0], t[1]); }));
  }
  function setSel(id, p) {
    const st = pw[id]; if (!st || !st.ready) return;
    st.map.getSource('sel').setData(p ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ringOf(p.x, p.y)] } } : EMPTY);
  }
  async function selectAt(id, m, ll) {
    if (m.getZoom() < BUY_Z) { m.flyTo({ center: ll, zoom: BUY_Z + 1.2, essential: true }); return; }   // como en la Tierra: hay que acercarse para comprar
    const lng = ((ll.lng + 180) % 360 + 360) % 360 - 180;
    let p; try { p = await api('/api/parcel?world=' + encodeURIComponent(id) + '&lat=' + ll.lat + '&lng=' + lng, { method: 'GET' }); } catch (e) { return; }
    p.world = id;
    setSel(id, p);
    if (window.selectWorldParcel) window.selectWorldParcel(p);
  }
  function parcelLayer(id, m) {
    const st = pw[id] = { owned: new Map(), tiles: new Map(), map: m, ready: false };
    m.on('load', () => {
      m.addSource('grid', { type: 'geojson', data: EMPTY });
      m.addSource('parcelas', { type: 'geojson', data: EMPTY });
      m.addSource('sel', { type: 'geojson', data: EMPTY });
      m.addLayer({ id: 'grid', type: 'line', source: 'grid', paint: { 'line-color': '#ffffff', 'line-opacity': 0.3, 'line-width': 1 } });
      m.addLayer({ id: 'p-fill', type: 'fill', source: 'parcelas', minzoom: SHOW_Z, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.4 } });
      m.addLayer({ id: 'p-line', type: 'line', source: 'parcelas', minzoom: SHOW_Z, paint: { 'line-color': ['get', 'color'], 'line-width': 2 } });
      m.addLayer({ id: 'p-house', type: 'symbol', source: 'parcelas', minzoom: SHOW_Z,
        layout: { 'icon-image': ['get', 'img'], 'icon-size': ICON, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'map', 'icon-rotation-alignment': 'map' } });
      m.addLayer({ id: 'sel-fill', type: 'fill', source: 'sel', paint: { 'fill-color': '#ffd23f', 'fill-opacity': 0.28 } });
      m.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': '#ffd23f', 'line-width': 3 } });
      st.ready = true; flush(id); grid(id); loadTiles(id);
    });
    const loading = new Set();
    m.on('styleimagemissing', e => { if (!loading.has(e.id)) { loading.add(e.id); loadHouse(m, e.id); } });   // la foto de cada casa se carga una vez, cuando hace falta
    // Cada paso va en su try: si uno falla, los demás (y el movimiento del mapa) siguen. La cuadrícula también se redibuja mientras te mueves
    // (antes solo al terminar el movimiento, y por eso quedaba un rectángulo fijo que no cubría toda la pantalla).
    const step = f => { try { f(id); } catch (e) { console.error('[mundos] ' + id, e); } };
    const refresh = () => { step(grid); step(loadTiles); step(labels); };
    let moveT = 0;
    const refreshLive = () => { if (moveT) return; moveT = setTimeout(() => { moveT = 0; step(grid); }, 120); };
    // El globo 3D solo se usa de lejos. Cerca del suelo (parcelas, cuadrícula, texturas enormes) se pasa a mapa plano: se ve igual y no se bloquea al moverte.
    const proj = () => {
      try {
        const z = m.getZoom(), cur = m.getProjection && m.getProjection(), isGlobe = !cur || cur.type === 'globe';
        if (z > 9 && isGlobe) m.setProjection({ type: 'mercator' });
        else if (z < 4 && !isGlobe) m.setProjection({ type: 'globe' });
      } catch (e) { console.warn('[mundos] proyección', e); }
    };
    m.on('moveend', refresh); m.on('zoomend', refresh); m.on('move', refreshLive);
    m.on('zoomend', proj); m.on('moveend', proj);
    ['dragPan', 'touchZoomRotate', 'scrollZoom', 'doubleClickZoom'].forEach(h => { try { if (m[h]) m[h].enable(); } catch (e) {} });
    m.on('click', e => selectAt(id, m, e.lngLat));
  }
  window.worldDraw = p => {   // app.js la llama al comprar, cambiar la casa o subir de nivel un terreno de este mundo
    const st = pw[p.world]; if (!st) return;
    st.owned.set(p.id, Object.assign({}, st.owned.get(p.id) || {}, p));
    st.tiles.clear();   // las teselas se vuelven a pedir con calma (así se ve lo que compraron otros)
    flush(p.world);
  };
  window.worldClearSel = () => { Object.keys(pw).forEach(k => setSel(k, null)); };
  let pendingGoto = null;
  window.goToWorldParcel = p => {   // desde «Mis terrenos»: viaja al planeta (si hace falta) y se acerca a la parcela
    const s = cellSize(), ll = { lng: (p.x + 0.5) * s - 180, lat: (p.y + 0.5) * s - 90 };
    const go = () => { const m = maps[p.world]; if (!m) return; m.flyTo({ center: [ll.lng, ll.lat], zoom: 17.5, duration: 2500, essential: true }); m.once('moveend', () => selectAt(p.world, m, ll)); };
    if (current === p.world) { go(); return; }
    pendingGoto = { world: p.world, lng: ll.lng, lat: ll.lat, after: go };
    travel(p.world);
  };
  const showNote = (id, txt, ms) => {
    const n = boxes[id] && boxes[id].querySelector('.mundo-note'); if (!n) return;
    n.textContent = txt; n.style.transition = 'opacity .8s'; n.style.opacity = '1';
    clearTimeout(n._t); if (ms) n._t = setTimeout(() => { n.style.opacity = '0'; }, ms);
  };

  // ---------- Viaje ----------
  // Se despega del mundo actual, se vuela (cartel "Viajando a …" y planetas por el camino) y se baja en paracaídas en el destino:
  // con traje de astronauta en la Luna y en Marte, sin traje al volver a la Tierra.
  let current = 'tierra', traveling = false;
  // Aterrizaje del mapa: vuelo suave hasta el punto de llegada. Si el vuelo no arranca o no termina (mapa sin tamaño, error al dibujar…),
  // pasados unos segundos se salta directamente al destino: así nunca se queda el planeta «pillado» a mil kilómetros de altura.
  function land(map, center) {
    const ZOOM = 16.2, MS = 6500;
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(guard); };
    const jump = () => { if (done) return; finish(); try { map.stop(); map.jumpTo({ center, zoom: ZOOM }); } catch (e) { console.error('[mundos] aterrizaje', e); } };
    const guard = setTimeout(jump, MS + 4000);
    try {
      map.resize();   // por si el tamaño cambió mientras el cohete tapaba el mapa (barra del navegador en el móvil)
      map.once('moveend', () => { finish(); try { map.triggerRepaint(); } catch (e) {} });
      map.flyTo({ center, zoom: ZOOM, duration: MS, essential: true });
      setTimeout(() => { if (!done && Math.abs(map.getZoom() - 0.8) < 0.05) jump(); }, 1500);   // a los 1,5 s el zoom ni se ha movido: el vuelo no ha arrancado
    } catch (e) { console.error('[mundos] flyTo', e); jump(); }
  }
  function travel(to) {
    if (traveling || !WORLDS[to] || to === current) return;
    traveling = true;
    const from = current;
    closeLists();
    if (window.closeWorldPanel) window.closeWorldPanel();   // el panel de compra del mundo que dejamos se cierra
    if (window.worldClearSel) window.worldClearSel();
    if (to !== 'tierra') earthMute(true);
    const launch = window.rocketLaunch ? window.rocketLaunch(from, to) : Promise.resolve();
    // Debajo de la pantalla del cohete se cambia de mundo
    if (boxes[from]) boxes[from].classList.add('hidden');
    let map = null;
    if (to !== 'tierra') {
      boxes[to].classList.remove('hidden');
      try {
        if (!maps[to]) maps[to] = build(to); else maps[to].resize();
        map = maps[to];
        map.jumpTo({ center: [10, 10], zoom: 0.8 });
        loadWorldStats(to);
      } catch (e) { console.error('[mundos] no se pudo preparar el mapa de ' + to, e); }   // aunque el mapa falle, el viaje termina y se puede volver
    }
    current = to;
    document.body.classList.toggle('en-mundo', to !== 'tierra');
    const goto = pendingGoto && pendingGoto.world === to ? pendingGoto : null; pendingGoto = null;   // «Mis terrenos»: se aterriza ya junto a la parcela
    const cap = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);   // si algo no termina, el viaje sigue igualmente
    cap(launch, 60000).then(() => {
      if (to === 'tierra') earthMute(false);
      // Se aterriza a nivel de calle (zoom 16): desde el primer momento se pueden comprar parcelas
      if (map) land(map, goto ? [goto.lng, goto.lat] : WORLDS[to].land);
      return window.rocketDrop ? cap(window.rocketDrop({ target: to === 'tierra' ? 'map' : 'mundo-map-' + to, suit: to !== 'tierra', world: to }), 30000) : null;
    }).catch(e => console.error('[mundos] viaje', e)).then(() => {
      traveling = false;
      try { if (window.rocketEngine) window.rocketEngine.stop(); } catch (e) {}   // por si algo falló antes de aterrizar: el motor nunca se queda sonando
      if (to !== 'tierra') { showNote(to, WORLDS[to].note, 12000); flashPresident(to); }
      if (goto && goto.after) goto.after();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && current !== 'tierra') travel('tierra');
    else if (e.key === 'Escape') setMenu(false);
  });
  window.mundoMaps = maps;   // consola: mundoMaps.marte.getZoom(), .isMoving()…
  window.travelTo = travel;   // por si se quiere probar desde la consola: travelTo('marte')
})();
