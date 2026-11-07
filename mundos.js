'use strict';
// Mundos: la Luna y Marte, mapas aparte (otra instancia de MapLibre cada uno) que se abren encima del juego con el botón "Mundos".
// De momento solo se explora; reclamar terrenos en otros mundos vendrá después (parcelas separadas por mundo en la base de datos).
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
  ORDER.forEach(id => {
    const w = WORLDS[id], box = document.createElement('div');
    box.id = 'mundo-' + id; box.className = 'mundo hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', w.name);
    box.innerHTML = `<div class="mundo-map" id="mundo-map-${id}"></div>
      <div class="mundo-top"><div class="mundo-title">${planet(id)}<span></span></div><div class="mundo-gos"></div></div>
      <div class="mundo-note"></div>`;
    box.querySelector('.mundo-title span').textContent = w.name;
    box.querySelector('.mundo-note').textContent = w.note;
    const gos = box.querySelector('.mundo-gos');   // solo un botón «Mundos»; la lista de planetas se despliega al tocarlo
    gos.innerHTML = '<button type="button" class="mundo-go mundo-drop" data-nosound aria-haspopup="true" aria-expanded="false"><span>🌎 Mundos</span><b>▾</b></button><div class="mundo-list"></div>';
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
      center: w.land, zoom: 0.8, minZoom: 0.6, maxZoom: 10, pitch: 0, attributionControl: { compact: true },
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
    // Si en unos segundos no ha llegado ninguna tesela, se avisa (con el motivo, para poder arreglarlo)
    let got = false, lastErr = '';
    m.on('data', e => { if (e.sourceId === 'mundo' && e.tile) got = true; });
    m.on('error', e => { if (e && e.sourceId === 'mundo') lastErr = String((e.error && (e.error.status || e.error.message)) || ''); });
    setTimeout(() => {
      if (w.tiles && !got) note.textContent = 'No se pudo cargar el mapa de ' + w.name + (lastErr ? ' (' + lastErr + ')' : '') + '. Inténtalo de nuevo en un rato.';
    }, 8000);
    return m;
  }

  // ---------- Viaje ----------
  // Se despega del mundo actual, se vuela (cartel "Viajando a …" y planetas por el camino) y se baja en paracaídas en el destino:
  // con traje de astronauta en la Luna y en Marte, sin traje al volver a la Tierra.
  let current = 'tierra', traveling = false;
  function travel(to) {
    if (traveling || !WORLDS[to] || to === current) return;
    traveling = true;
    const from = current;
    closeLists();
    if (to !== 'tierra') earthMute(true);
    const launch = window.rocketLaunch ? window.rocketLaunch(from, to) : Promise.resolve();
    // Debajo de la pantalla del cohete se cambia de mundo
    if (boxes[from]) boxes[from].classList.add('hidden');
    let map = null;
    if (to !== 'tierra') {
      boxes[to].classList.remove('hidden');
      if (!maps[to]) maps[to] = build(to); else maps[to].resize();
      map = maps[to];
      map.jumpTo({ center: [10, 10], zoom: 0.8 });
    }
    current = to;
    launch.then(() => {
      if (to === 'tierra') earthMute(false);
      if (map) map.flyTo({ center: WORLDS[to].land, zoom: 4.2, duration: 6500, essential: true });
      return window.rocketDrop ? window.rocketDrop({ target: to === 'tierra' ? 'map' : 'mundo-map-' + to, suit: to !== 'tierra', world: to }) : null;
    }).catch(() => {}).then(() => { traveling = false; });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && current !== 'tierra') travel('tierra');
    else if (e.key === 'Escape') setMenu(false);
  });
  window.travelTo = travel;   // por si se quiere probar desde la consola: travelTo('marte')
})();
