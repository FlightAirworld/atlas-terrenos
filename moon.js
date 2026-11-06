'use strict';
// Mundo 2 (fase 1): la Luna. Es un mapa aparte (otra instancia de MapLibre) que se abre encima del juego con el botón 🌙 de Extras.
// De momento solo se explora; reclamar terrenos en la Luna vendrá en la fase 2 (parcelas separadas por mundo en la base de datos).
(function () {
  const btn = document.getElementById('moon-btn');
  if (!btn || !window.maplibregl) return;

  // Imágenes lunares en Web Mercator: LOLA hillshade + albedo (NASA / USGS) de OpenPlanetaryMap, a través de nuestro servidor (/api/moon-tile)
  const TILES = location.origin + '/api/moon-tile/{z}/{x}/{y}.png';
  const SITES = [   // alunizajes del programa Apolo
    ['Apolo 11', 23.4730, 0.6741], ['Apolo 12', -23.4219, -3.0128], ['Apolo 14', -17.4714, -3.6453],
    ['Apolo 15', 3.6339, 26.1322], ['Apolo 16', 15.5002, -8.9730], ['Apolo 17', 30.7717, 20.1908]
  ];

  const st = document.createElement('style');
  st.textContent = `
    #moon { position: fixed; inset: 0; z-index: 1900; background: #02030a; color: #fff; }
    #moon.hidden { display: none !important; }
    #moon-map { position: absolute; inset: 0; }
    #moon .moon-top { position: absolute; left: 0; right: 0; top: 0; padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px 0; display: flex; gap: 10px; align-items: center; justify-content: space-between; pointer-events: none; z-index: 2; }
    #moon .moon-top > * { pointer-events: auto; }
    #moon .moon-title { background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.25); border-radius: 99px; padding: 8px 14px; font: 800 15px/1 system-ui, sans-serif; }
    #moon-back { border: 0; border-radius: 99px; padding: 10px 14px; background: #3ddc97; color: #04281d; font: 800 14px/1 system-ui, sans-serif; cursor: pointer; }
    #moon .moon-note { position: absolute; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom, 0px) + 28px); background: rgba(0,0,0,.6); border: 1px solid rgba(255,255,255,.2); border-radius: 14px; padding: 10px 14px; font: 600 14px/1.35 system-ui, sans-serif; text-align: center; z-index: 2; pointer-events: none; }
    #moon .moon-pin { display: flex; flex-direction: column; align-items: center; pointer-events: none; }
    #moon .moon-pin i { width: 12px; height: 12px; border-radius: 50%; background: #ffd23f; border: 2px solid #fff; box-shadow: 0 0 8px rgba(255,210,63,.9); }
    #moon .moon-pin span { margin-top: 3px; font: 700 11px/1 system-ui, sans-serif; color: #fff; text-shadow: 0 1px 3px #000, 0 0 6px #000; white-space: nowrap; }
    #moon .maplibregl-ctrl-attrib { font-size: 10px; }`;
  document.head.appendChild(st);

  const box = document.createElement('div');
  box.id = 'moon'; box.className = 'hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'La Luna');
  box.innerHTML = `
    <div id="moon-map"></div>
    <div class="moon-top"><div class="moon-title">🌙 La Luna</div><button id="moon-back" type="button" data-nosound>🌍 Volver a la Tierra</button></div>
    <div class="moon-note" id="moon-note">Mapa lunar de prueba: de momento solo se explora. Pronto podrás reclamar terrenos aquí.</div>`;
  document.body.appendChild(box);

  let mm = null;
  function build() {
    mm = new maplibregl.Map({
      container: 'moon-map',
      style: {
        version: 8,
        projection: { type: 'globe' },
        sources: { moon: { type: 'raster', tileSize: 256, maxzoom: 7, tiles: [TILES], attribution: 'Luna: NASA / LOLA / USGS · OpenPlanetaryMap' } },
        layers: [
          { id: 'moon-bg', type: 'background', paint: { 'background-color': '#8a8a8a' } },
          { id: 'moon', type: 'raster', source: 'moon' }
        ]
      },
      center: [23.47, 0.67], zoom: 0.8, minZoom: 0.6, maxZoom: 10, pitch: 0, attributionControl: { compact: true },
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5)
    });
    mm.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');
    SITES.forEach(s => {
      const el = document.createElement('div'); el.className = 'moon-pin';
      el.innerHTML = '<i></i><span></span>'; el.querySelector('span').textContent = s[0];
      new maplibregl.Marker({ element: el, anchor: 'top' }).setLngLat([s[1], s[2]]).addTo(mm);
    });
    // Si en unos segundos no ha llegado ninguna tesela, se avisa (con el motivo, para poder arreglarlo)
    let got = false, lastErr = '';
    mm.on('data', e => { if (e.sourceId === 'moon' && e.tile) got = true; });
    mm.on('error', e => { if (e && e.sourceId === 'moon') lastErr = String((e.error && (e.error.status || e.error.message)) || ''); });
    setTimeout(() => {
      if (!got) document.getElementById('moon-note').textContent = 'No se pudo cargar el mapa lunar' + (lastErr ? ' (' + lastErr + ')' : '') + '. Inténtalo de nuevo en un rato.';
    }, 8000);
  }

  function open() {
    box.classList.remove('hidden');
    if (!mm) build(); else mm.resize();
    // Llegada: de lejos al lugar del Apolo 11 (Mar de la Tranquilidad)
    mm.jumpTo({ center: [10, 10], zoom: 0.8 });
    mm.flyTo({ center: [23.47, 0.67], zoom: 4.2, duration: 6500, essential: true });
  }
  function close() { box.classList.add('hidden'); }
  btn.addEventListener('click', open);
  document.getElementById('moon-back').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) close(); });
})();
