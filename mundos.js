'use strict';
// Mundos: la Luna y Marte, mapas aparte (otra instancia de MapLibre cada uno) que se abren encima del juego con el botón "Mundos".
// De momento solo se explora; reclamar terrenos en otros mundos vendrá después (parcelas separadas por mundo en la base de datos).
// Los viajes (cohete, planetas por el camino y paracaídas) los dibuja viaje.js. Desde cualquier mundo se puede ir a cualquier otro:
//   Tierra → Luna → Marte están en línea, así que ir de la Tierra a Marte pasa por delante de la Luna.
(function () {
  const btn = document.getElementById('mundos-btn');
  if (!btn || !window.maplibregl) return;

  const API = window.API_BASE || location.origin;
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
    }
  };
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
    .mundo .mundo-gos { display: flex; gap: 8px; }
    .mundo-go { border: 1px solid rgba(255,255,255,.28); border-radius: 99px; padding: 6px 12px 6px 7px; background: rgba(0,0,0,.55); color: #fff; font: 800 14px/1 system-ui, sans-serif; cursor: pointer; display: flex; align-items: center; gap: 7px; }
    .mundo-go:active { transform: scale(.96); }
    .mundo .mundo-note { position: absolute; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 28px); background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.2); border-radius: 14px; padding: 10px 14px; font: 600 14px/1.35 system-ui, sans-serif; text-align: center; z-index: 2; pointer-events: none; }
    .mundo .mundo-pin { display: flex; flex-direction: column; align-items: center; pointer-events: none; }
    .mundo .mundo-pin i { width: 12px; height: 12px; border-radius: 50%; background: #ffd23f; border: 2px solid #fff; box-shadow: 0 0 8px rgba(255,210,63,.9); }
    .mundo .mundo-pin span { margin-top: 3px; font: 700 11px/1 system-ui, sans-serif; color: #fff; text-shadow: 0 1px 3px #000, 0 0 6px #000; white-space: nowrap; }
    .mundo .maplibregl-ctrl-attrib { font-size: 10px; }
    #mundos-menu { position: fixed; left: calc(10px + env(safe-area-inset-left, 0px)); bottom: calc(14px + 76px + 8px + env(safe-area-inset-bottom, 0px)); z-index: 1001; display: none; flex-direction: column; gap: 2px; min-width: 190px; padding: 6px;
      border-radius: 16px; background: var(--mp-bg, #fff); border: 1px solid var(--mp-bd, rgba(0,0,0,.14)); box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 14px 34px rgba(0,0,0,.22);
      -webkit-backdrop-filter: blur(14px) saturate(1.5); backdrop-filter: blur(14px) saturate(1.5); transform-origin: bottom left; }
    #mundos-menu.open { display: flex; animation: mundosIn .17s cubic-bezier(.2,.85,.25,1) both; }
    @keyframes mundosIn { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
    #mundos-menu button { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; border-radius: 12px; padding: 9px 12px 9px 9px; background: transparent; color: var(--mp-ink, #16211c); font: 600 15px/1.1 system-ui, sans-serif; text-align: left; cursor: pointer; }
    #mundos-menu button:active { background: var(--mp-hover, rgba(0,0,0,.06)); }
    @media (hover: hover) { #mundos-menu button:hover { background: var(--mp-hover, rgba(0,0,0,.06)); } }
    #mundos-menu svg { width: 30px; height: 30px; }
    #mundos-btn[aria-expanded="true"] { background: var(--mp-acc, #087f5b) !important; border-color: transparent !important; color: #fff !important; }`;
  document.head.appendChild(st);

  // ---------- Menú del botón "Mundos" (en la Tierra) ----------
  const menu = document.createElement('div');
  menu.id = 'mundos-menu'; menu.setAttribute('role', 'menu');
  ['luna', 'marte'].forEach(id => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.world = id; b.setAttribute('data-nosound', '');
    b.innerHTML = planet(id) + '<span></span>'; b.lastChild.textContent = WORLDS[id].name;
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const setMenu = open => { menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
  btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', e => { e.stopPropagation(); setMenu(!menu.classList.contains('open')); });
  menu.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setMenu(false); travel(b.dataset.world); } });
  document.addEventListener('pointerdown', e => { if (menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) setMenu(false); });

  // ---------- Un mapa por mundo ----------
  const boxes = {}, maps = {};
  ['luna', 'marte'].forEach(id => {
    const w = WORLDS[id], box = document.createElement('div');
    box.id = 'mundo-' + id; box.className = 'mundo hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', w.name);
    box.innerHTML = `<div class="mundo-map" id="mundo-map-${id}"></div>
      <div class="mundo-top"><div class="mundo-title">${planet(id)}<span></span></div><div class="mundo-gos"></div></div>
      <div class="mundo-note"></div>`;
    box.querySelector('.mundo-title span').textContent = w.name;
    box.querySelector('.mundo-note').textContent = w.note;
    ['tierra', 'luna', 'marte'].filter(o => o !== id).forEach(o => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mundo-go'; b.setAttribute('data-nosound', ''); b.setAttribute('aria-label', 'Viajar a ' + WORLDS[o].name);
      b.innerHTML = planet(o) + '<span></span>'; b.lastChild.textContent = WORLDS[o].short;
      b.addEventListener('click', () => travel(o));
      box.querySelector('.mundo-gos').appendChild(b);
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
        sources: { mundo: { type: 'raster', tileSize: 256, maxzoom: 7, tiles: [w.tiles], attribution: w.attr } },
        layers: [
          { id: 'mundo-bg', type: 'background', paint: { 'background-color': w.bg } },
          { id: 'mundo', type: 'raster', source: 'mundo' }
        ]
      },
      center: w.land, zoom: 0.8, minZoom: 0.6, maxZoom: 10, pitch: 0, attributionControl: { compact: true },
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5)
    });
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
      if (!got) note.textContent = 'No se pudo cargar el mapa de ' + w.name + (lastErr ? ' (' + lastErr + ')' : '') + '. Inténtalo de nuevo en un rato.';
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
