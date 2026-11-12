'use strict';
const $ = id => document.getElementById(id);
const MIN_ZOOM_PARCELS = 15;   // por debajo no se muestran parcelas
const MIN_ZOOM_BUY = 16;       // para comprar hay que acercarse
let cfg, map, gl, selected = null, paypalLoaded = null;
let sb = null, authToken = null, authUser = null, linkedFor = null;   // sesión (Supabase Auth)
let myNick = null;             // apodo fijo guardado en el servidor
const drawn = new Map();       // id -> { srcId, url, label }

// ---------- Mapa 3D (MapLibre GL): globo + satélite + relieve ----------
// Vista plana (tipo Atlas Earth): cámara cenital, sin inclinación y sin volúmenes 3D. Por defecto activada.
let flatView = true;
try { flatView = localStorage.getItem('flatView') !== '0'; } catch (e) {}
// Mapa base: 'estilizado' (dibujo limpio tipo Atlas Earth, vectorial) o 'satelite'
let baseMode = 'estilizado';
try { baseMode = localStorage.getItem('baseMode') === 'satelite' ? 'satelite' : 'estilizado'; } catch (e) {}
// Ancho del río según el zoom (el mismo para el mapa base y para la capa que lo dibuja encima de las parcelas)
const WATER_W = ['interpolate', ['exponential', 1.6], ['zoom'], 8, 0.5, 14, 2, 16, 5, 18, 13, 20, 30];
const WATER_W_EDGE = ['interpolate', ['exponential', 1.6], ['zoom'], 8, 1, 14, 3.2, 16, 6.8, 18, 15, 20, 32];   // borde algo más ancho
const FLAT_NEAR = 14;          // (zoom MapLibre) a partir de aquí el globo se ve plano
const MAP_STYLE = {
  version: 8,
  projection: { type: 'globe' },
  sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
  sources: {
    sat: {
      type: 'raster', tileSize: 256, maxzoom: 19,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics'
    },
    roads: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },   // solo para que los coches sigan las calles
    synth: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },   // calles horizontales del juego (ver SYNTH_*)
    dem: {
      type: 'raster-dem', tileSize: 256, maxzoom: 15, encoding: 'terrarium',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      attribution: 'Relieve: Mapzen / AWS Terrain Tiles'
    }
  },
  layers: [
    { id: 'st-bg', type: 'background', paint: { 'background-color': '#cfe6a5' } },
    { id: 'st-landcover', type: 'fill', source: 'roads', 'source-layer': 'landcover', paint: { 'fill-color': ['match', ['get', 'class'], 'wood', '#a9d68a', 'grass', '#bfe29a', 'farmland', '#dcebb0', 'sand', '#f1e6b8', 'rock', '#d6d3c8', 'ice', '#f4f8fb', '#cfe6a5'] } },
    { id: 'st-landuse', type: 'fill', source: 'roads', 'source-layer': 'landuse', paint: { 'fill-color': ['match', ['get', 'class'], 'residential', '#ece6d6', 'commercial', '#efdcc6', 'industrial', '#e2dde0', 'retail', '#efdcc6', 'cemetery', '#c3dfa6', 'school', '#f0e3c2', 'hospital', '#f4d7d2', '#e9e4d2'], 'fill-opacity': 0.9 } },
    { id: 'st-park', type: 'fill', source: 'roads', 'source-layer': 'park', paint: { 'fill-color': '#9fd58a', 'fill-opacity': 0.9 } },
    { id: 'st-water', type: 'fill', source: 'roads', 'source-layer': 'water', paint: { 'fill-color': '#7cc4e8' } },
    { id: 'st-waterway', type: 'line', source: 'roads', 'source-layer': 'waterway', paint: { 'line-color': '#7cc4e8', 'line-width': WATER_W } },
    { id: 'st-buildings', type: 'fill', source: 'roads', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': '#d9d2c3', 'fill-outline-color': '#c2baa8' } },
    { id: 'st-road-casing', type: 'line', source: 'roads', 'source-layer': 'transportation', minzoom: 11,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#b9b3a3', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 1, 16, 14, 19, 60] } },
    { id: 'st-sy-casing', type: 'line', source: 'synth', minzoom: 15,
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': '#b9b3a3', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 1, 16, 14, 19, 60] } },
    { id: 'st-road', type: 'line', source: 'roads', 'source-layer': 'transportation', minzoom: 11,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'class'], 'motorway', '#f6c76b', 'trunk', '#f6c76b', 'primary', '#fbe29a', '#ffffff'], 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 0.6, 16, 11, 19, 50] } },
    { id: 'st-sy-road', type: 'line', source: 'synth', minzoom: 15,
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 0.6, 16, 11, 19, 50] } },
    // Vías del tren (solo líneas principales, sin túneles ni apartaderos): trains.js hace circular el tren por ellas
    { id: 'st-rail-bed', type: 'line', source: 'roads', 'source-layer': 'transportation', minzoom: 11,
      filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]],
      paint: { 'line-color': '#8b8478', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 0.8, 16, 6, 19, 26] } },
    { id: 'st-rail', type: 'line', source: 'roads', 'source-layer': 'transportation', minzoom: 11,
      filter: ['all', ['==', ['get', 'class'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel'], ['!', ['has', 'service']]],
      paint: { 'line-color': '#f4f1ea', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 0.4, 16, 3.4, 19, 15], 'line-dasharray': [1, 1.3] } },
    { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: baseMode === 'satelite' ? 'visible' : 'none' } },
    // Calles horizontales del juego sobre el satélite (solo se ven con el mapa de satélite; en el estilizado van intercaladas con las reales)
    { id: 'sy-sat-casing', type: 'line', source: 'synth', minzoom: 15,
      layout: { 'line-cap': 'butt', visibility: baseMode === 'satelite' ? 'visible' : 'none' },
      paint: { 'line-color': '#b9b3a3', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 1, 16, 14, 19, 60] } },
    { id: 'sy-sat-road', type: 'line', source: 'synth', minzoom: 15,
      layout: { 'line-cap': 'butt', visibility: baseMode === 'satelite' ? 'visible' : 'none' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 11, 0.6, 16, 11, 19, 50] } },
    // Capa invisible: solo sirve para consultar la geometría de las calles (coches). Apagada hasta que se necesita.
    {
      id: 'roads-q', type: 'line', source: 'roads', 'source-layer': 'transportation', minzoom: 15,
      layout: { visibility: 'none' },
      filter: ['all', ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'line-opacity': 0.01, 'line-width': 3 }
    }
  ]
  // El relieve (source 'dem') queda apagado: se activa con el botón de montaña del mapa
};
try {
  gl = new maplibregl.Map({
    container: 'map', style: MAP_STYLE,
    center: [-5.3536, 36.1408], zoom: 1.6, pitch: 0, bearing: 0,    // empieza visto desde el espacio
    minZoom: 1, maxZoom: 19.5, maxPitch: flatView ? 0 : 60,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),          // menos píxeles = más fluidez en móvil
    fadeDuration: 0,
    attributionControl: { compact: true }                              // créditos del mapa: solo el botón «i» (se abre al tocarlo)
  });
} catch (e) {
  $('map').textContent = 'Tu dispositivo no puede mostrar el mapa 3D (WebGL no disponible).';
  throw e;
}
map = createCompatMap(gl);     // API tipo Leaflet usada por el resto del juego (ver mapshim.js)
// MapLibre enseña los créditos abiertos hasta el primer movimiento del mapa: se cierran al arrancar para que solo se vea la «i»
(function () {
  const closeAttrib = () => { const el = document.querySelector('#map .maplibregl-ctrl-attrib'); if (el) { el.removeAttribute('open'); el.classList.remove('maplibregl-compact-show'); } };
  gl.on('load', closeAttrib); [300, 1500, 4000].forEach(t => setTimeout(closeAttrib, t));
})();

let glReady = false;
// Entrada cinematográfica: del espacio a Gibraltar (inclinado, para ver el 3D)
let flightRequested = false;
const HOME = [-5.3536, 36.1408];   // Gibraltar: destino si no hay ubicación
function introFlight() {
  if (!glReady) { flightRequested = true; return; }
  const fly = (center, zoom) => gl.flyTo({ center, zoom, pitch: flatView ? 0 : 45, bearing: flatView ? 0 : -15, duration: 7000, essential: true });
  let done = false;
  const toHome = () => { if (done) return; done = true; fly(HOME, 16); };
  if (!navigator.geolocation) return toHome();
  // Pide la ubicación (el navegador pregunta al jugador); si no llega pronto o se niega, vamos a Gibraltar
  const timer = setTimeout(toHome, 10000);
  navigator.geolocation.getCurrentPosition(
    pos => {
      clearTimeout(timer);
      if (done) return;                       // ya se fue a Gibraltar: no le movemos el mapa de golpe
      done = true;
      fly([pos.coords.longitude, pos.coords.latitude], 16.5);
      const b = $('welcome-loc'); if (b) b.style.display = 'none';   // el aviso ya no necesita "Ir a mi ubicación"
    },
    () => { clearTimeout(timer); toHome(); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}
window.introFlight = introFlight;
function introAlreadySeen() { try { return localStorage.getItem('introSeen2') === '1'; } catch (e) { return false; } }
const pendingParcels = new Map();
const ownedFeatures = new Map();      // id -> Feature GeoJSON (volumen de la parcela)
let ownedDirty = false;

function colorFor(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return `hsl(${h % 360}, 70%, 42%)`;
}
function boundsOf(x, y) {
  const s = cfg.size, west = x * s - 180, south = y * s - 90;
  return [[south, west], [south + s, west + s]];
}
function authHeaders() { return authToken ? { 'X-Auth-Token': authToken } : {}; }
function setMsg(text, kind = '') {
  for (const id of ['msg', 'buy-msg']) { const m = $(id); if (m) { m.textContent = text; m.className = 'msg ' + kind; } }   // 'buy-msg': ventana de comprar créditos
}
// Aviso arriba de la pantalla (el #msg del panel queda al final y en el móvil no se ve sin bajar)
function flashToast(text) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = text; t.classList.add('show');
  clearTimeout(flashToast.t); flashToast.t = setTimeout(() => t.classList.remove('show'), 6000);
}
async function api(url, opts = {}) {
  // Siempre manda el token de sesión (antes, en los GET sin opciones no se enviaba y el servidor respondía "Inicia sesión")
  const hasBody = opts.body !== undefined;
  const r = await fetch(url, { ...opts, headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() }, body: hasBody ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}

// ---------- Parcelas compradas en pantalla ----------
const HOUSES = [
  'images/casa-1.webp',
  'images/casa-6.webp',
  'images/colegio.webp',
  'images/pisos.webp',
  'images/pisos-2.webp',
  'images/Farmacia.webp',
  'images/bosque.webp',
  'images/parque-infantil.webp',
  'images/supermercado.webp',
  'images/helipuerto.webp',
  'images/jardin.webp',
  'images/Restaurante.webp',
  'images/torre-metalica.webp',
  'images/casa-modernista.webp',
  'images/casa-modernista-2.webp',
  'images/estadio-1.webp',
  'images/estadio-2.webp',
  'images/rugby.webp',
  'images/estadio-3.webp',
  'images/estadio-4.webp',
  'images/plaza-de-toros.webp',
  'images/teatro.webp',
  'images/cine.webp',
  'images/supermercado-3.webp',
  'images/supermercado-4.webp',
  'images/supermercado-2.webp',
  'images/pisos-3.webp',
  'images/pisos-4.webp',
  'images/pisos-5.webp',
  'images/casa-7.webp',
  'images/casa-8.webp'
];

// Casas de cada planeta (6 por mundo; imágenes images/<mundo>-<casa>.webp, las genera tools/make-planet-houses.py). Deben coincidir con WORLD_HOUSES de server.js.
const WORLD_HOUSES = {
  luna: ['images/luna-cupula.webp', 'images/luna-rover.webp', 'images/luna-granja-solar.webp', 'images/luna-radiotelescopio.webp', 'images/luna-ciudad-lunar.webp', 'images/luna-estacion-lunar.webp', 'images/luna-complejo-lunar.webp', 'images/luna-base-geodesica.webp'],
  marte: ['images/marte-cupula-marciana.webp', 'images/marte-invernadero.webp', 'images/marte-base-rover.webp', 'images/marte-mina-roja.webp', 'images/marte-torre-radio.webp', 'images/marte-puerto-marte.webp'],
  mercurio: ['images/mercurio-base-crater.webp', 'images/mercurio-escudo-solar.webp', 'images/mercurio-observatorio.webp', 'images/mercurio-mina-metal.webp', 'images/mercurio-antena-solar.webp', 'images/mercurio-estacion-polar.webp'],
  venus: ['images/venus-ciudad-aerostato.webp', 'images/venus-plataforma-nube.webp', 'images/venus-laboratorio-acido.webp', 'images/venus-globo-dorado.webp', 'images/venus-torre-nubes.webp', 'images/venus-puerto-aereo.webp'],
  jupiter: ['images/jupiter-plataforma-flotante.webp', 'images/jupiter-globo-gas.webp', 'images/jupiter-refineria-hidrogeno.webp', 'images/jupiter-observatorio-tormenta.webp', 'images/jupiter-ciudad-nube.webp', 'images/jupiter-puerto-nubes.webp'],
  saturno: ['images/saturno-plataforma-anillos.webp', 'images/saturno-ciudad-flotante.webp', 'images/saturno-globo-anillo.webp', 'images/saturno-laboratorio-gas.webp', 'images/saturno-refineria-saturno.webp', 'images/saturno-puerto-saturno.webp'],
  urano: ['images/urano-cristal-hielo.webp', 'images/urano-plataforma-azul.webp', 'images/urano-globo-hielo.webp', 'images/urano-estacion-eje.webp', 'images/urano-refineria-metano.webp', 'images/urano-puerto-urano.webp'],
  neptuno: ['images/neptuno-plataforma-tormenta.webp', 'images/neptuno-globo-azul.webp', 'images/neptuno-refineria-diamante.webp', 'images/neptuno-ciudad-neptuno.webp', 'images/neptuno-laboratorio-frio.webp', 'images/neptuno-puerto-neptuno.webp'],
  pluton: ['images/pluton-cupula-hielo.webp', 'images/pluton-base-corazon.webp', 'images/pluton-criolaboratorio.webp', 'images/pluton-mina-nitrogeno.webp', 'images/pluton-sonda-horizontes.webp', 'images/pluton-refugio-polar.webp']
};
const worldOfId = id => { const m = /^([a-z]+):/.exec(String(id || '')); return m && WORLD_HOUSES[m[1]] ? m[1] : 'tierra'; };   // los ids de otros mundos son «<mundo>:x:y»

function houseFor(id, house) {
  if (house) house = String(house).replace(/\.png$/i, '.webp');   // terrenos guardados antes del cambio a webp
  if (house && (HOUSES.includes(house) || /^images\/[A-Za-z0-9_-]+\.webp$/.test(house))) return house;   // la que eligió el dueño (el servidor solo guarda casas válidas, incluidas las de eventos)
  let h = 2166136261;
  for (const c of id) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  const wl = WORLD_HOUSES[worldOfId(id)];   // en un planeta, la casa al azar es de ese planeta
  if (wl) return wl[(h >>> 16) % wl.length];
  return HOUSES[(h >>> 16) % HOUSES.length];
}
// Altura aproximada (en metros) de cada tipo de edificio: da volumen 3D a las parcelas
const HOUSE_HEIGHT = {
  'casa-1': 8, 'casa-6': 10, 'colegio': 15, 'pisos': 30, 'pisos-2': 30, 'farmacia': 9, 'bosque': 10, 'parque-infantil': 4, 'supermercado': 9, 'helipuerto': 14, 'jardin': 4, 'restaurante': 8,
  'torre-metalica': 60, 'casa-modernista': 20, 'casa-modernista-2': 20, 'estadio-1': 25, 'estadio-2': 25, 'rugby': 10, 'estadio-3': 40, 'estadio-4': 40, 'plaza-de-toros': 20, 'teatro': 14, 'cine': 10, 'supermercado-3': 8, 'supermercado-4': 8, 'supermercado-2': 8, 'pisos-3': 30, 'pisos-4': 30, 'pisos-5': 30, 'casa-7': 8, 'casa-8': 8
};
// Nivel del terreno (1 a 5): más estrellas junto al nombre y un edificio más alto
const maxLevel = () => (cfg && cfg.levels && cfg.levels.mults.length) || 5;
const levelOf = p => Math.max(1, Math.min(maxLevel(), Math.floor(Number(p && p.level)) || 1));
const multOf = lvl => (cfg && cfg.levels && cfg.levels.mults[lvl - 1]) || 1;
const fmtNum = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });
// Con tantos niveles, 1 estrella por cada 1/5 del camino (1 a 5) y el número de nivel al lado
const tierOf = lvl => Math.max(1, Math.ceil(lvl * 5 / maxLevel()));
const starsOf = lvl => `${'★'.repeat(tierOf(lvl))} ${lvl}`;
function heightOf(url, lvl = 1) {
  const k = String(url).split('/').pop().replace(/\.[a-z]+$/i, '').toLowerCase();
  const t = (lvl - 1) / Math.max(1, maxLevel() - 1);   // 0 en el nivel 1, 1 en el máximo: hasta ×1,8 de altura y +8 m
  return (HOUSE_HEIGHT[k] ?? 9) * (1 + 0.8 * t) + 8 * t;
}
function ringOf(x, y) {
  const [[s, w], [n, e]] = boundsOf(x, y);
  return [[w, s], [e, s], [e, n], [w, n], [w, s]];
}
function flushOwned() {
  if (!glReady || ownedDirty) return;
  ownedDirty = true;
  requestAnimationFrame(() => {
    ownedDirty = false;
    const src = gl.getSource('owned');
    if (src) src.setData({ type: 'FeatureCollection', features: [...ownedFeatures.values()] });
  });
}

// Para ir fluido, la foto del suelo y la etiqueta con el nombre solo existen en las parcelas más cercanas al centro.
// El volumen 3D (una sola capa para todas) se mantiene siempre.
// Cuántas parcelas (las más cercanas al centro) mantienen su foto a la vez. Con el zoom lejano la foto pesa poco (128 px) y caben muchas;
// al acercar, cada foto es mayor (256 / 512 px) y se baja para no agotar la memoria del móvil.
const DETAIL_CAP = { t: 120, s: 70, m: 40 }, DETAIL_KEEP = 20;   // DETAIL_KEEP: margen para que no parpadeen las del borde al mover un poco el mapa
let detailQueued = false;
// ---------- Casas recortadas por las calles ----------
// Las calles reales (teselas de OpenFreeMap) se restan de cada parcela: la casa queda cortada por la carretera.
// - Volumen 3D: se sustituye el polígono de la parcela por "parcela - calles" (turf).
// - Foto: se borra la franja de la calle en un canvas y se usa ese resultado como imagen de la parcela.
// Solo se calcula para parcelas que se ven enteras y cerca del centro (ahí las teselas tienen todo su detalle).
const ROAD_WIDTH = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 9, minor: 7 };   // ancho total, en metros
// ---------- Calles horizontales entre edificios pegados ----------
// Cuando dos edificios están pegados uno encima del otro, se traza una calle horizontal justo en la frontera entre los dos.
// Si hay más de dos apilados, hay calle en todas las fronteras.
// Las calles de parcelas que se tocan en la misma fila se unen en una sola; al cruzar una calle real se empalman con ella
// (mapshim.withSynth parte las dos en el cruce), y por ellas circulan coches y peatones como por cualquier otra calle.
// Cuentan todas las parcelas ocupadas, también parques, bosques, jardines y prados.
const SYNTH_HALF_M = 3.5, SYNTH_MIN_Z = 15, SYNTH_MAX_LINES = 400;
function synthLat(y) { return y * cfg.size - 90; }
let synthRuns = [], synthPairs = new Set(), synthDirty = true;
function rebuildSynth() {
  synthDirty = false;
  if (!cfg) return;
  const occ = new Map();                                            // "x,y" -> parcela dibujada
  for (const ex of drawn.values()) {
    const p = ex.p; if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    occ.set(p.x + ',' + p.y, ex);
  }
  const all = [];                                                   // pareja = parcela (x,y) justo encima de otra (x,y-1)
  for (const k of occ.keys()) {
    const [x, y] = k.split(',').map(Number);
    if (occ.has(x + ',' + (y - 1))) all.push([x, y]);
  }
  all.sort((m, n) => m[1] - n[1]);
  const pairs = new Set(), byY = new Map();
  for (const [x, y] of all) {                                       // TODAS las fronteras entre parcelas apiladas llevan calle (sin saltarse ninguna)
    pairs.add(x + ',' + y);
    if (!byY.has(y)) byY.set(y, []);
    byY.get(y).push(x);
  }
  const runs = [], sz = cfg.size;
  for (const [y, xs] of byY) {                                      // parejas seguidas en la misma frontera = una sola calle
    xs.sort((m, n) => m - n);
    let a = xs[0], b = a;
    for (let i = 1; i <= xs.length; i++) {
      if (xs[i] === b + 1) { b = xs[i]; continue; }
      runs.push({ lat: synthLat(y), w: a * sz - 180, e: (b + 1) * sz - 180 });
      a = b = xs[i];
    }
  }
  // las parcelas que ganan o pierden calle vuelven a calcular su recorte (y se restauran si la pierden)
  const changed = [...pairs].filter(k => !synthPairs.has(k)).concat([...synthPairs].filter(k => !pairs.has(k)));
  synthRuns = runs; synthPairs = pairs;
  for (const k of changed) {
    const [x, y] = k.split(',').map(Number);
    for (const ex of [occ.get(k), occ.get(x + ',' + (y - 1))]) {
      if (!ex) continue;
      const old = roadCut.get(ex.p.id);
      if (old && old.road) ex.hadCut = true;
      roadCut.delete(ex.p.id);
    }
  }
  if (changed.length) queueCuts();
}
function markSynthDirty() { synthDirty = true; if (typeof queueSynth === 'function') queueSynth(); }
function synthLines(w, e, s, n) {
  const out = [];
  if (!cfg) return out;
  if (synthDirty) rebuildSynth();
  for (const r of synthRuns) {
    if (r.lat < s || r.lat > n || r.e < w || r.w > e) continue;
    out.push([[Math.max(r.w, w), r.lat], [Math.min(r.e, e), r.lat]]);
    if (out.length >= SYNTH_MAX_LINES) break;
  }
  return out;
}
let synthQueued = false;
function updateSynth() {
  if (!glReady || !cfg) return;
  const src = gl.getSource('synth'); if (!src) return;
  let feats = [];
  if (synthDirty) rebuildSynth();
  if (map.getZoom() - 1 >= SYNTH_MIN_Z) {
    const b = gl.getBounds(), padLng = (b.getEast() - b.getWest()) * 0.5, padLat = (b.getNorth() - b.getSouth()) * 0.5;
    feats = synthLines(b.getWest() - padLng, b.getEast() + padLng, b.getSouth() - padLat, b.getNorth() + padLat)
      .map(l => ({ type: 'Feature', properties: { class: 'minor' }, geometry: { type: 'LineString', coordinates: l } }));
  }
  src.setData({ type: 'FeatureCollection', features: feats });
}
function queueSynth() {
  if (synthQueued) return;
  synthQueued = true;
  setTimeout(() => { synthQueued = false; try { updateSynth(); } catch (e) {} }, 120);
}
window.synthRoadLines = synthLines;     // mapshim.queryRoads() las une a las calles reales para que circulen coches y peatones
gl.on('moveend', queueSynth);
gl.on('load', queueSynth);

const roadCut = new Map();       // id -> { road: Feature|null (zona de calle), rest: Feature|null (parcela sin calle) }
const CUT_MAX_D = 0.004;         // grados (~400 m) alrededor del centro
const CUT_PER_PASS = 6;          // parcelas por pasada (turf pesa un poco)
let cutQueued = false;

function queueCuts() {
  if (!glReady || cutQueued) return;
  cutQueued = true;
  setTimeout(() => { cutQueued = false; try { runCuts(); } catch (e) {} }, 200);
}
window.queueCuts = queueCuts;     // index.html la llama cuando termina de cargar turf
gl.on('moveend', queueCuts);
gl.on('idle', queueCuts);

function runCuts() {
  if (!glReady || !cfg || typeof turf === 'undefined') return;     // sin turf: las casas se ven enteras, como antes
  const on = map.getZoom() >= 16 && drawn.size > 0;
  if (map.setRoads) map.setRoads(on, 'h');                          // enciende la capa de calles solo mientras hace falta
  if (!on || !gl.areTilesLoaded()) return;                          // 'idle' volverá a llamar cuando haya teselas
  const c = gl.getCenter();
  const todo = [...drawn.values()].filter(ex => !roadCut.has(ex.p.id)).map(ex => {
    const [[s, w], [n, e]] = boundsOf(ex.p.x, ex.p.y);
    ex.cd = Math.hypot((s + n) / 2 - c.lat, (w + e) / 2 - c.lng); return ex;
  }).filter(ex => ex.cd < CUT_MAX_D).sort((x, y) => x.cd - y.cd);
  let done = 0;
  for (const ex of todo) {
    if (done >= CUT_PER_PASS) { queueCuts(); break; }
    const r = roadAreaFor(ex.p);
    if (r === undefined) continue;                                  // todavía no se ve entera
    done++;
    roadCut.set(ex.p.id, r);
    if (r.road) { ex.hadCut = false; applyCut(ex, r); }
    else if (ex.hadCut) {                                           // ya no hay calle: la parcela vuelve a verse entera
      ex.hadCut = false;
      const f = ownedFeatures.get(ex.p.id); if (f) { f.geometry = { type: 'Polygon', coordinates: [ringOf(ex.p.x, ex.p.y)] }; flushOwned(); }
      refreshPhoto(ex);
    }
  }
}

function lineParts(coords, box) {
  let r; try { r = turf.bboxClip(turf.lineString(coords), box); } catch (e) { return []; }
  const g = r.geometry;
  return (g.type === 'LineString' ? [g.coordinates] : g.coordinates).filter(l => l.length >= 2);
}

// Devuelve { road, rest } para la parcela, o undefined si aún no se puede calcular
function roadAreaFor(p) {
  const [[s, w], [n, e]] = boundsOf(p.x, p.y);
  const pts = [[w, s], [e, s], [e, n], [w, n]].map(q => gl.project(q));
  const cv = gl.getCanvas(), W = cv.clientWidth, H = cv.clientHeight;
  const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (!(x0 >= 0 && y0 >= 0 && x1 <= W && y1 <= H)) return undefined;
  const feats = gl.queryRenderedFeatures([[x0, y0], [x1, y1]], { layers: ['roads-q'] });
  const none = { road: null, rest: null };
  const pad = cfg.size * 0.3, box = [w - pad, s - pad, e + pad, n + pad];
  const sy = synthLines(w - pad, e + pad, s - 1e-9, n + 1e-9);           // calles horizontales que pasan por los bordes de esta parcela
  if (!feats.length && !sy.length) return none;
  let area = null;
  for (const l of sy) {
    try {
      const bf = turf.buffer(turf.lineString(l), SYNTH_HALF_M, { units: 'meters', steps: 2 });
      if (bf) area = area ? turf.union(area, bf) : bf;
    } catch (err) {}
  }
  for (const f of feats) {
    const g = f.geometry; if (!g) continue;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    const half = (ROAD_WIDTH[f.properties && f.properties.class] || 7) / 2;
    for (const l of lines) for (const part of lineParts(l, box)) {
      try {
        const bf = turf.buffer(turf.lineString(part), half, { units: 'meters', steps: 2 });
        if (bf) area = area ? turf.union(area, bf) : bf;
      } catch (err) {}
    }
  }
  if (!area) return none;
  try {
    const parcel = turf.polygon([ringOf(p.x, p.y)]);
    const rest = turf.difference(parcel, area);
    if (!rest) return none;                                          // la calle cubriría todo: se deja la casa entera
    if (turf.area(rest) / turf.area(parcel) > 0.995) return none;    // la calle no toca realmente la parcela
    return { road: area, rest };
  } catch (err) { return none; }
}

function applyCut(ex, cut) {
  const f = ownedFeatures.get(ex.p.id);
  if (f && cut.rest) { f.geometry = cut.rest.geometry; flushOwned(); }   // volumen 3D (y borde) con la forma recortada
  refreshPhoto(ex);                                                      // foto con la calle borrada
}

// Tres tamaños según el zoom (la parcela se ve más grande al acercar): -t 128 px, -s 256 px y -m 512 px (el original de 768 px ya no se descarga)
const THUMB_ZOOM = 17.5, SMALL_ZOOM = 18.5;
const resOf = () => { const z = map.getZoom(); return z < THUMB_ZOOM ? 't' : z < SMALL_ZOOM ? 's' : 'm'; };
const sizedUrl = (u, r) => String(u).replace(/\.webp$/i, '-' + r + '.webp');
const srcUrl = (ex, r = resOf()) => sizedUrl(ex.url, r);
function updateRes() {      // al acercar o alejar el zoom, cambia de tamaño de foto (128, 256 o 512 px)
  if (!glReady) return;
  const th = resOf();
  for (const ex of drawn.values()) if (ex.hasDetail && ex.res !== th) refreshPhoto(ex);
}
gl.on('moveend', updateRes);

function loadImg(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}
// Foto de la casa con la zona de calle transparente → URL de blob
async function clippedPhoto(url, p, road) {
  const img = await loadImg(url);
  const W = Math.min(img.naturalWidth || 256, 512), H = Math.min(img.naturalHeight || 256, 512);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-out';
  const [[s, w], [n, e]] = boundsOf(p.x, p.y);
  const polys = road.geometry.type === 'Polygon' ? [road.geometry.coordinates] : road.geometry.coordinates;
  ctx.beginPath();
  for (const poly of polys) for (const ring of poly) {
    ring.forEach(([lng, lat], i) => {
      const x = (lng - w) / (e - w) * W, y = (n - lat) / (n - s) * H;   // la imagen va de (oeste, norte) a (este, sur)
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
  }
  ctx.fill('evenodd');
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  if (!blob) throw new Error('canvas');
  return URL.createObjectURL(blob);
}
function freeBlob(ex) {
  if (!ex.blob) return;
  const b = ex.blob; ex.blob = null;
  setTimeout(() => URL.revokeObjectURL(b), 3000);
}
// Pone en la parcela la foto que toca: recortada si tiene calle, la normal si no
async function refreshPhoto(ex) {
  if (!ex.hasDetail) return;
  const th = resOf();
  const tok = ex.tok = (ex.tok || 0) + 1, url = srcUrl(ex, th), cut = roadCut.get(ex.p.id);
  let u = url, blob = null;
  if (cut && cut.road) { try { blob = await clippedPhoto(url, ex.p, cut.road); u = blob; } catch (e) {} }
  const src = ex.hasDetail && tok === ex.tok && url === srcUrl(ex, th) && gl.getSource(ex.srcId);
  if (!src) { if (blob) URL.revokeObjectURL(blob); return; }
  freeBlob(ex); ex.blob = blob; ex.res = th;
  if (cut && cut.road) { const [[s, w], [n, e]] = boundsOf(ex.p.x, ex.p.y); src.updateImage({ url: u, coordinates: [[w, n], [e, n], [e, s], [w, s]] }); }
  else src.updateImage({ url: u });
}

function addDetail(ex) {
  ex.want = true;
  if (ex.hasDetail || ex.adding) return;
  const cut = roadCut.get(ex.p.id);
  if (!(cut && cut.road)) return mountDetail(ex, srcUrl(ex), null);
  // Con calle: primero se prepara la foto recortada y luego se monta (así no parpadea la casa entera)
  ex.adding = true;
  const used = srcUrl(ex);
  clippedPhoto(used, ex.p, cut.road).catch(() => null).then(u => {
    ex.adding = false;
    if (!ex.want || ex.hasDetail) { if (u) URL.revokeObjectURL(u); return; }
    if (used !== srcUrl(ex)) { if (u) URL.revokeObjectURL(u); return addDetail(ex); }   // cambió la casa (o el zoom) mientras tanto
    mountDetail(ex, u || used, u);
  });
}
function mountDetail(ex, imgUrl, blob) {
  const [[s, w], [n, e]] = boundsOf(ex.p.x, ex.p.y);
  ex.blob = blob;
  // La casa llena su cuadrado de la cuadrícula hasta el borde; sin calle se ensancha un 0,4 % para que dos vecinas no dejen rendija
  const cutNow = roadCut.get(ex.p.id), k = (cutNow && cutNow.road) ? 0 : 0.004, dw = (e - w) * k, dh = (n - s) * k;
  gl.addSource(ex.srcId, { type: 'image', url: imgUrl, coordinates: [[w - dw, n + dh], [e + dw, n + dh], [e + dw, s - dh], [w - dw, s - dh]] });
  gl.addLayer({ id: ex.srcId, type: 'raster', source: ex.srcId, paint: { 'raster-fade-duration': 0 } }, gl.getLayer('wt-water') ? 'wt-water' : 'owned-3d');
  const stars = document.createElement('span');
  stars.className = 'owner-stars';
  stars.textContent = starsOf(ex.level);
  ex.starsEl = stars;
  const wrap = document.createElement('span');
  const flag = flagOf(ex.p && ex.p.country);   // bandera del país del dueño, encima de la casa
  if (flag) { const fl = document.createElement('span'); fl.className = 'owner-flag'; fl.textContent = flag; wrap.append(fl); }
  wrap.append(stars);   // las estrellas del nivel: el nombre del dueño ya no se muestra sobre la parcela
  ex.label = L.marker([(s + n) / 2, (w + e) / 2], {   // en el centro de la parcela, dentro de la casa
    icon: L.divIcon({ className: 'owner-label', html: wrap, iconSize: [0, 0] }),
    interactive: false, keyboard: false
  }).addTo(map);
  ex.hasDetail = true;
  ex.res = resOf();
}
function dropDetail(ex) {
  ex.want = false;
  if (!ex.hasDetail) return;
  ex.tok = (ex.tok || 0) + 1;
  if (ex.label) { ex.label.remove(); ex.label = null; }
  ex.starsEl = null;
  if (gl.getLayer(ex.srcId)) gl.removeLayer(ex.srcId);
  if (gl.getSource(ex.srcId)) gl.removeSource(ex.srcId);
  freeBlob(ex);
  ex.hasDetail = false;
}
function updateDetail() {
  if (!glReady || detailQueued) return;
  detailQueued = true;
  requestAnimationFrame(() => {
    detailQueued = false;
    const all = [...drawn.values()];
    if (map.getZoom() < 16) { all.forEach(dropDetail); return; }
    const c = gl.getCenter();
    all.forEach(ex => { const [[s, w], [n, e]] = boundsOf(ex.p.x, ex.p.y); ex.d = Math.hypot((s + n) / 2 - c.lat, (w + e) / 2 - c.lng); });
    all.sort((a, b) => a.d - b.d);
    const cap = window.Perf ? Perf.cap(DETAIL_CAP[resOf()] || 40, 10) : (DETAIL_CAP[resOf()] || 40);   // modo ligero (ligero.js)
    all.forEach((ex, i) => (i < cap || (ex.hasDetail && i < cap + DETAIL_KEEP)) ? addDetail(ex) : dropDetail(ex));
  });
}
gl.on('moveend', updateDetail);
window.addEventListener('perfchange', updateDetail);   // al cambiar el modo ligero se ajusta cuántas fotos se muestran

const isOtherWorld = p => !!(p && p.world && p.world !== 'tierra');   // parcela de la Luna, Marte… (cada mundo tiene las suyas)
function drawOwned(p) {
  if (isOtherWorld(p)) { if (window.worldDraw) window.worldDraw(p); return; }   // mundos.js la pinta en el mapa del planeta
  if (!glReady) { pendingParcels.set(p.id, p); return; }
  const url = houseFor(p.id, p.house);
  const ex = drawn.get(p.id);
  if (ex) {   // ya dibujada: solo actualiza foto, altura y estrellas si cambió la casa o el nivel
    const lvl = p.level ? levelOf(p) : ex.level;
    if (ex.url !== url || ex.level !== lvl) {
      const newHouse = ex.url !== url;
      ex.url = url; ex.level = lvl;
      if (newHouse) { refreshPhoto(ex); markSynthDirty(); }
      if (ex.starsEl) ex.starsEl.textContent = starsOf(lvl);
      const f = ownedFeatures.get(p.id); if (f) { f.properties.h = heightOf(url, lvl); flushOwned(); }
    }
    return;
  }
  const lvl = levelOf(p);
  const col = colorFor(p.owner);
  const [[s, w], [n, e]] = boundsOf(p.x, p.y);
  // Volumen 3D de la parcela (neutro, para no teñir la foto; el color del dueño va en el borde)
  ownedFeatures.set(p.id, {
    type: 'Feature', id: p.x * 1000003 + p.y,
    properties: { pid: p.id, color: col, h: heightOf(url, lvl), clat: (s + n) / 2, clng: (w + e) / 2 },
    geometry: { type: 'Polygon', coordinates: [ringOf(p.x, p.y)] }
  });
  drawn.set(p.id, { p, srcId: 'img-' + p.id, url, level: lvl, starsEl: null, label: null, hasDetail: false });
  markSynthDirty();
  flushOwned();
  updateDetail();
  queueCuts();
}

// ---------- Mapa base: estilizado / satélite ----------
function applyBaseMode() {
  if (!gl || !gl.getLayer('sat')) return;
  const sat = baseMode === 'satelite';
  gl.setLayoutProperty('sat', 'visibility', sat ? 'visible' : 'none');
  for (const l of gl.getStyle().layers) if (l.id.startsWith('st-')) gl.setLayoutProperty(l.id, 'visibility', sat ? 'none' : 'visible');
  for (const id of ['sy-sat-casing', 'sy-sat-road']) if (gl.getLayer(id)) gl.setLayoutProperty(id, 'visibility', sat ? 'visible' : 'none');
  if (gl.getLayer('wt-waterway')) {
    gl.setPaintProperty('wt-water', 'fill-opacity', sat ? 0.3 : 0.55);
    gl.setPaintProperty('wt-waterway', 'line-opacity', sat ? 0.6 : 0.9);
    gl.setPaintProperty('wt-waterway-edge', 'line-opacity', sat ? 0.35 : 0.7);
  }
  const b = document.getElementById('base-btn');
  if (b) { b.setAttribute('aria-pressed', sat ? 'true' : 'false'); b.title = sat ? 'Mapa: satélite' : 'Mapa: estilizado'; b.textContent = sat ? '🛰️' : '🎨'; }
}
function toggleBaseMode() {
  baseMode = baseMode === 'satelite' ? 'estilizado' : 'satelite';
  try { localStorage.setItem('baseMode', baseMode); } catch (e) {}
  applyBaseMode();
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#base-btn')) toggleBaseMode(); });


// ---------- Vista plana / 3D ----------
function applyViewMode(animate) {
  if (!gl) return;
  const vis = flatView ? 'none' : 'visible';
  for (const id of ['owned-3d', 'sel-plate']) if (gl.getLayer(id)) gl.setLayoutProperty(id, 'visibility', vis);
  gl.setMaxPitch(flatView ? 0 : 60);
  if (flatView) {
    if (animate) gl.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    else gl.jumpTo({ pitch: 0, bearing: 0 });
  }
  const b = document.getElementById('view-btn');
  if (b) { b.setAttribute('aria-pressed', flatView ? 'true' : 'false'); b.title = flatView ? 'Vista plana: activada' : 'Vista 3D: activada'; b.textContent = flatView ? '🗺️' : '🏙️'; }
}
function toggleViewMode() {
  flatView = !flatView;
  try { localStorage.setItem('flatView', flatView ? '1' : '0'); } catch (e) {}
  applyViewMode(true);
  if (!flatView) gl.easeTo({ pitch: 45, duration: 600 });
}
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#view-btn')) toggleViewMode(); });

// Quita una parcela del mapa al instante (la usa el piromano, arson.js)
function removeParcelClient(id) {
  const ex = drawn.get(id);
  if (ex) { dropDetail(ex); drawn.delete(id); }
  ownedFeatures.delete(id);
  if (typeof roadCut !== 'undefined' && roadCut.delete) roadCut.delete(id);
  markSynthDirty();
  flushOwned();
  if (selected && selected.id === id) { try { setSelected(null); } catch (e) {} selected = null; }
}
window.removeParcelClient = removeParcelClient;

// Capas del mapa que dependen de que el estilo esté cargado
gl.on('load', () => {
  // Ríos y lagos por encima de las parcelas: la casa no los tapa (las fotos de las casas se insertan justo debajo de 'wt-water')
  gl.addLayer({ id: 'wt-water', type: 'fill', source: 'roads', 'source-layer': 'water', minzoom: 13, paint: { 'fill-color': '#7cc4e8', 'fill-opacity': 0.55 } });
  gl.addLayer({ id: 'wt-waterway-edge', type: 'line', source: 'roads', 'source-layer': 'waterway', minzoom: 13,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#4f9fcf', 'line-opacity': 0.7, 'line-width': WATER_W_EDGE } });
  gl.addLayer({ id: 'wt-waterway', type: 'line', source: 'roads', 'source-layer': 'waterway', minzoom: 13,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#7cc4e8', 'line-opacity': 0.9, 'line-width': WATER_W } });
  gl.addSource('owned', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  gl.addLayer({
    id: 'owned-3d', type: 'fill-extrusion', source: 'owned',
    paint: {
      'fill-extrusion-color': '#f1ede4',
      'fill-extrusion-height': ['get', 'h'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.35,
      'fill-extrusion-vertical-gradient': false
    }
  });
  gl.addLayer({
    id: 'owned-line', type: 'line', source: 'owned',
    layout: { visibility: 'none' },   // sin marco de color alrededor de las casas (se ve más limpio); para volver a verlo: 'visible'
    paint: { 'line-color': ['get', 'color'], 'line-width': 2 }
  });
  gl.addSource('sel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  gl.addLayer({
    id: 'sel-plate', type: 'fill-extrusion', source: 'sel',
    paint: { 'fill-extrusion-color': '#ffb703', 'fill-extrusion-height': 1.5, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.55 }
  });
  gl.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': '#ffb703', 'line-width': 3.5 } });
  glReady = true;
  applyViewMode(false);
  applyBaseMode();
  pendingParcels.forEach(drawOwned); pendingParcels.clear();
  loadParcels();
  // Quien ya vio la introducción entra volando directamente; el nuevo espera a que acabe el vídeo
  if (flightRequested || introAlreadySeen()) introFlight();
});

function setSelected(p) {
  const src = gl.getSource('sel'); if (!src) return;
  src.setData(p
    ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ringOf(p.x, p.y)] } }] }
    : { type: 'FeatureCollection', features: [] });
}

// Parcelas por teselas fijas de TILE×TILE casillas (las mismas que el servidor): cada tesela se guarda en el cliente TILE_TTL_MS
// y, al mover el mapa, solo se piden las que faltan. Antes se pedía todo el recuadro visible en cada movimiento.
const TILE = 16, TILE_TTL_MS = 60_000, MAX_TILES_PER_LOAD = 36, TILE_PARALLEL = 6;   // TILE debe coincidir con server.js
const tileCache = new Map();   // "tx,ty" -> { at, busy }
function invalidateTile(x, y) { tileCache.delete(Math.floor(x / TILE) + ',' + Math.floor(y / TILE)); }   // p. ej. tras comprar una parcela
async function loadTile(tx, ty) {
  const key = tx + ',' + ty, ent = tileCache.get(key);
  if (ent && (ent.busy || Date.now() - ent.at < TILE_TTL_MS)) return;
  tileCache.set(key, { at: ent ? ent.at : 0, busy: true });
  try {
    const list = await api('/api/parcels/tile?tx=' + tx + '&ty=' + ty);
    list.forEach(drawOwned);
    tileCache.set(key, { at: Date.now(), busy: false });
  } catch { if (ent) tileCache.set(key, { at: ent.at, busy: false }); else tileCache.delete(key); }   // si falla, se reintenta en el próximo movimiento
}
async function loadParcels() {
  if (!cfg || map.getZoom() < MIN_ZOOM_PARCELS) return;
  const b = map.getBounds(), s = cfg.size;
  const maxX = Math.round(360 / s) - 1, maxY = Math.round(180 / s) - 1;
  const cell = (v, off, max) => Math.max(0, Math.min(max, Math.floor((v + off) / s)));
  const tx0 = Math.floor(cell(b.getWest(), 180, maxX) / TILE), tx1 = Math.floor(cell(b.getEast(), 180, maxX) / TILE);
  const ty0 = Math.floor(cell(b.getSouth(), 90, maxY) / TILE), ty1 = Math.floor(cell(b.getNorth(), 90, maxY) / TILE);
  const c = map.getCenter(), ctx = Math.floor(cell(c.lng, 180, maxX) / TILE), cty = Math.floor(cell(c.lat, 90, maxY) / TILE);
  const todo = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) todo.push([tx, ty]);
  todo.sort((a, b) => Math.hypot(a[0] - ctx, a[1] - cty) - Math.hypot(b[0] - ctx, b[1] - cty));   // primero las del centro
  const queue = todo.slice(0, MAX_TILES_PER_LOAD);
  await Promise.all(Array.from({ length: Math.min(TILE_PARALLEL, queue.length) }, async () => {
    for (let t; (t = queue.shift());) await loadTile(t[0], t[1]);
  }));
}
map.on('moveend', loadParcels);

function syncLabels() {
  map.getContainer().classList.toggle('labels-off', map.getZoom() < 17);
  // Ancho de una parcela en píxeles: el nombre se escala para caber dentro de la casa (ver .owner-pill en style.css)
  if (cfg) {
    const ppx = cfg.size * 512 * Math.pow(2, gl.getZoom()) / 360;
    map.getContainer().style.setProperty('--ppx', ppx.toFixed(1));
    // En Mercator la parcela es más alta que ancha (1/cos(lat)): así el nombre queda en el borde de abajo
    map.getContainer().style.setProperty('--ppy', (ppx / Math.max(0.2, Math.cos(gl.getCenter().lat * Math.PI / 180))).toFixed(1));
  }
}
map.on('zoomend', syncLabels); gl.on('zoom', syncLabels); gl.on('moveend', syncLabels); syncLabels();

// ---------- Selección de parcela ----------
async function selectAt(latlng) {
  if (map.getZoom() < MIN_ZOOM_BUY) { map.flyTo(latlng, MIN_ZOOM_BUY + 1); return; }
  const lng = ((latlng.lng + 180) % 360 + 360) % 360 - 180;     // normaliza al dar la vuelta al mundo
  let p;
  try { p = await api(`/api/parcel?lat=${latlng.lat}&lng=${lng}`, { method: 'GET' }); } catch (e) { return; }
  selected = p;
  setSelected(p);
  showPanel(p);
  sfx('select');
}
map.on('click', e => {
  // Si se pulsa un edificio 3D, se elige su parcela (no el suelo que queda detrás)
  const hit = glReady ? gl.queryRenderedFeatures(e.point, { layers: ['owned-3d'] })[0] : null;
  selectAt(hit ? { lat: hit.properties.clat, lng: hit.properties.clng } : e.latlng);
});
// ---------- Administración: reclamar parcelas gratis ----------
// El cuadro solo aparece si abres el juego con #admin al final de la dirección (se recuerda en ese dispositivo).
// La seguridad real está en el servidor: sin la clave correcta no se puede hacer nada.
function adminViewEnabled() {
  try {
    if (location.hash === '#admin') localStorage.setItem('adminView', '1');
    if (location.hash === '#noadmin') localStorage.removeItem('adminView');
    return localStorage.getItem('adminView') === '1';
  } catch { return location.hash === '#admin'; }
}
function setupAdminControls() {
  if ($('admin-box')) return;

  const box = document.createElement('details');
  box.id = 'admin-box';
  box.style.cssText = 'margin-top:10px;padding:8px 12px;border:1px solid #d6a900;border-radius:12px;';

  const title = document.createElement('summary');
  title.style.cssText = 'cursor:pointer;font-weight:bold;';
  title.textContent = '🔑 Administración';

  const description = document.createElement('p');
  description.textContent = 'Reclamar esta parcela gratis como administrador.';

  const token = document.createElement('input');
  token.id = 'admin-token';
  token.type = 'password';
  token.placeholder = 'Clave privada de administrador';
  token.autocomplete = 'off';
  token.style.cssText = 'width:100%;box-sizing:border-box;margin:8px 0;padding:10px;';

  const button = document.createElement('button');
  button.id = 'admin-claim';
  button.type = 'button';
  button.textContent = '🔑 Reclamar gratis';
  button.style.cssText = 'width:100%;padding:12px;cursor:pointer;';

  button.onclick = async () => {
    if (!selected || selected.owner) return;

    const secret = token.value.trim();
    if (!secret) {
      setMsg('Introduce tu clave de administrador', 'err');
      return;
    }

    button.disabled = true;
    button.textContent = 'Reclamando...';

    try {
      const response = await fetch('/api/admin/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + secret
        },
        body: JSON.stringify({
          lat: selected.south + cfg.size / 2,
          lng: selected.west + cfg.size / 2,
          owner: $('name').value.trim(),
          avatar,
          country,
          house: chosenHouse
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudo reclamar');

      selected.owner = result.owner;
      selected.house = chosenHouse; selected.mine = false;
      selected.avatar = avatar;
      selected.country = country;
      selected.since = Date.now();

      token.value = '';
      setMsg('¡Parcela reclamada gratis! 🎉', 'ok');

      showPanel(selected);
      drawOwned({
        world: selected.world,
        id: selected.id,
        x: selected.x,
        y: selected.y,
        owner: selected.owner,
        avatar: selected.avatar,
        country: selected.country,
        house: selected.house
      });

      if (!isOtherWorld(selected)) invalidateTile(selected.x, selected.y);
      loadStats();
      loadParcels();

    } catch (error) {
      setMsg(error.message, 'err');
    } finally {
      button.disabled = false;
      button.textContent = '🔑 Reclamar gratis';
    }
  };

  const statsBtn = document.createElement('button');
  statsBtn.type = 'button';
  statsBtn.textContent = '📊 Ver estadísticas';
  statsBtn.style.cssText = 'width:100%;padding:12px;margin-top:8px;cursor:pointer;';
  const statsOut = document.createElement('pre');
  statsOut.style.cssText = 'white-space:pre-wrap;font-size:13px;margin:8px 0 0;';
  statsBtn.onclick = async () => {
    const secret = token.value.trim();
    if (!secret) { setMsg('Introduce tu clave de administrador', 'err'); return; }
    statsBtn.disabled = true;
    try {
      const r = await fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + secret } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo cargar');
      const lines = [`Terrenos: ${j.parcels} · Cuentas: ${j.accounts}`, 'Visitantes únicos por día:'];
      (j.visitors || []).forEach(v => lines.push(`  ${v.day}: ${v.n}`));
      if (!(j.visitors || []).length) lines.push('  (aún sin datos)');
      statsOut.textContent = lines.join('\n');
    } catch (e) { setMsg(e.message, 'err'); }
    finally { statsBtn.disabled = false; }
  };

  box.append(title, description, token, button, statsBtn, statsOut);
  $('p-free').appendChild(box);
}
function showPanel(p) {
  $('panel').classList.remove('hidden');
  const wi = isOtherWorld(p) && window.worldInfo ? window.worldInfo(p.world) : null;   // {name, radiusKm} del planeta
  $('p-title').textContent = wi ? `Terreno en ${wi.name} · ${p.x}:${p.y}` : `Terreno ${p.id}`;
  const mPerDeg = wi ? wi.radiusKm * 1000 * Math.PI / 180 : 111320;   // metros por grado en ese mundo
  const mLat = Math.round(cfg.size * mPerDeg), mLng = Math.round(cfg.size * mPerDeg * Math.cos(p.south * Math.PI / 180));
  $('p-coords').textContent = `Lat ${p.south.toFixed(3)}° · Lng ${p.west.toFixed(3)}° · ~${mLng} × ${mLat} m`;
  setMsg('');
  const owned = !!p.owner;
  $('p-owned').classList.toggle('hidden', !owned);
  $('p-free').classList.toggle('hidden', owned);
  if (owned) {
    $('p-owner').textContent = [flagOf(p.country), p.owner].filter(Boolean).join(' ');
    $('p-owner-icon').textContent = p.avatar || '👤';
    $('p-photo').src = houseFor(p.id, p.house);
    $('house-edit').classList.toggle('hidden', !p.mine);
    $('gift-owner-btn').classList.toggle('hidden', !!p.mine || !p.giftable);   // solo en terrenos de otros jugadores con cuenta
    $('house-pick-wrap').classList.add('hidden');
    { const c = cfg.houseCost ?? 1; $('house-change-btn').textContent = '🏠 CAMBIAR CASA' + (c > 0 ? ` (${c} 🎟️)` : ' (gratis)'); }
    if (p.mine) markHouse($('house-pick-edit'), p.house && String(p.house).replace(/\.png$/i, '.webp'));
    $('p-avatar').textContent = p.avatar || '';
    $('p-since').textContent = 'Comprado el ' + new Date(p.since).toLocaleDateString('es-ES');
    renderLevelBox(p);
  } else {
    buildPackPicker();
  }
  { const w = (p && p.world) || worldOfId(p && p.id); if (w !== pickerWorld) { pickerWorld = w; chosenHouse = null; if (window.rebuildHousePickers) window.rebuildHousePickers(); } }   // cada mundo, sus casas
  if (window.visitaPanel) window.visitaPanel(p);   // botón «ENTRA A LA CASA» (visita.js)
  if (window.retosPanel) window.retosPanel(p);   // botón ❤️ «Me gusta» (retos.js)
  if (window.vecinosPanel) window.vecinosPanel(p);   // vecinos de al lado (vecinos.js)
  updateBuyParcelBtn(p);
}
// Botón «Reclamar terreno» (debajo de Compartir): solo en terrenos libres. Con créditos reclama el terreno; sin créditos lleva a los packs
function updateBuyParcelBtn(p) {
  const b = $('buy-parcel-btn'); if (!b) return;
  const cur = p || selected;
  const open = !$('panel').classList.contains('hidden');
  b.classList.toggle('hidden', !(open && cur && !cur.owner));
}
$('close').onclick = () => { $('panel').classList.add('hidden'); setSelected(null); selected = null; if (window.worldClearSel) window.worldClearSel(); };
// Ganchos para mundos.js: abrir el mismo panel de compra con una parcela de otro planeta, y cerrarlo al viajar
window.selectWorldParcel = p => { selected = p; showPanel(p); sfx('select'); };
window.closeWorldPanel = () => { $('panel').classList.add('hidden'); if (isOtherWorld(selected)) selected = null; };
$('gift-owner-btn').onclick = () => { if (selected && selected.owner && window.openGift) openGift(selected.owner); };

// ---------- Nivel del terreno y botón de mejora ----------
function renderLevelBox(p) {
  if (!cfg || !cfg.levels) { $('p-level').textContent = ''; $('level-edit').classList.add('hidden'); return; }
  const lvl = levelOf(p), max = maxLevel();
  $('p-level').textContent = `${'⭐'.repeat(tierOf(lvl))} Nivel ${lvl} de ${max} · produce ×${fmtNum(multOf(lvl))}`;
  $('level-edit').classList.toggle('hidden', !p.mine);
  if (!p.mine) return;
  const btn = $('upgrade-btn'), note = $('level-note');
  if (lvl >= max) { btn.classList.add('hidden'); note.textContent = '🏆 Nivel máximo: tu terreno produce al máximo.'; return; }
  const cost = cfg.levels.costs[lvl - 1];
  btn.classList.remove('hidden');
  const fu = window.freeUpgrades || 0;       // mejoras gratis ganadas en los premios del mes
  btn.textContent = fu > 0 ? `⬆️ Subir a nivel ${lvl + 1} · GRATIS 🎁 (${fu})` : `⬆️ Subir a nivel ${lvl + 1} · ${cost} 🎟️`;
  note.textContent = `Pasará a producir ×${fmtNum(multOf(lvl + 1))} (ahora ×${fmtNum(multOf(lvl))}). La mejora cuenta desde el momento en que la compras.`;
}
$('upgrade-btn').onclick = async () => {
  if (!selected || !selected.mine || !cfg || !cfg.levels) return;
  const lvl = levelOf(selected);
  if (lvl >= maxLevel()) return;
  const cost = cfg.levels.costs[lvl - 1];
  const useFree = (window.freeUpgrades || 0) > 0;
  if (!useFree && credits < cost) return setMsg('NO TIENES CRÉDITOS PARA ESTA MEJORA. COMPRA CRÉDITOS.', 'err');
  if (!confirm(useFree ? `Subir este terreno al nivel ${lvl + 1} gratis, con una de tus mejoras de los premios del mes. ¿Continuar?` : `Subir este terreno al nivel ${lvl + 1} cuesta ${cost} ${plural(cost, 'crédito', 'créditos')}. ¿Continuar?`)) return;
  const btn = $('upgrade-btn');
  btn.disabled = true;
  try {
    const j = await api('/api/parcel/upgrade', { method: 'POST', body: { id: selected.id, from: lvl } });
    credits = j.credits; updateCreditUi();
    if (j.free) window.freeUpgrades = j.freeUpgrades || 0;
    selected.level = j.level;
    showPanel(selected);
    drawOwned({ world: selected.world, id: selected.id, x: selected.x, y: selected.y, owner: selected.owner, avatar: selected.avatar, country: selected.country, house: selected.house, level: j.level });
    sfx('claim');
    setMsg(j.free ? `⭐ ¡Nivel ${j.level} GRATIS! Te quedan ${window.freeUpgrades} ${window.freeUpgrades === 1 ? 'mejora gratis' : 'mejoras gratis'}` : `⭐ ¡Nivel ${j.level}! Te quedan ${credits} ${plural(credits, 'crédito', 'créditos')}`, 'ok');
    if (window.monthlyRefresh) monthlyRefresh();
    loadProduction();
  } catch (e) { setMsg(e.message, 'err'); sfx('error'); refreshCredits(); }
  finally { btn.disabled = false; }
};

// ---------- Avatar ----------
const AVATARS = ['😀','😎','🤠','🦊','🐱','🐶','🦁','🐼','🚀','👑','⚽','🌟'];
let avatar = AVATARS[0];
try { const s = localStorage.getItem('avatar'); if (AVATARS.includes(s)) avatar = s; } catch {}
(function buildAvatarPicker() {
  const box = $('avatars');
  const mark = () => [...box.children].forEach(b => { b.style.outline = b.textContent === avatar ? '2px solid #ffb703' : ''; });
  AVATARS.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = a; b.style.fontSize = '22px';
    b.onclick = () => { avatar = a; try { localStorage.setItem('avatar', a); } catch {} mark(); };
    box.appendChild(b);
  });
  mark();
})();

// ---------- Elegir casa ----------
let chosenHouse = null;   // casa elegida para el terreno que vas a reclamar (null = al azar)
// Casas que el servidor acepta pero que no estaban en el selector, y casas de eventos activos (se rellenan solas desde /api/events).
// OJO: HOUSES NO se toca (el reparto al azar de las parcelas sin casa elegida depende de su orden y tamaño).
const EXTRA_HOUSES = ['images/cesped-2.webp', 'images/parque-picnic.webp', 'images/desierto-1.webp', 'images/desierto-2.webp', 'images/prado.webp', 'images/claro-bosque.webp', 'images/parque-futbol.webp', 'images/mar.webp', 'images/mar-peces.webp'];
// Casas del Pase Oro 👑 (mismas que GOLD_HOUSES de server.js). Sin pase salen con candado; window.atlasGold lo pone retos.js.
const GOLD_HOUSES = ['images/casa-2.webp', 'images/casa-3.webp', 'images/rascacielos.webp', 'images/parque-atracciones.webp', 'images/puerto.webp', 'images/aeropuerto.webp', 'images/ayuntamiento.webp', 'images/banco.webp', 'images/hospital.webp', 'images/iglesia.webp', 'images/piscina.webp', 'images/estacion.webp'];
let eventHouses = [];
let pickerWorld = 'tierra';   // mundo de la parcela abierta: en un planeta el selector solo enseña las casas de ese planeta
const pickableHouses = () => pickerWorld !== 'tierra' ? WORLD_HOUSES[pickerWorld] : HOUSES.concat(EXTRA_HOUSES, GOLD_HOUSES, eventHouses);
const houseName = h => h.replace(/^images\//, '').replace(/\.(png|webp)$/i, '').replace(/[-_]/g, ' ');
// Categorías del selector de casas: al tocar una (🎬 Cines, 🏠 Casas…) solo salen las de ese tipo. Lo que no esté aquí va a «Otros» (así las casas nuevas siempre se ven).
const HOUSE_CATS = [
  { icon: '🏠', name: 'Casas', files: ['casa-1', 'casa-6', 'casa-7', 'casa-8', 'casa-modernista', 'casa-modernista-2'] },
  { icon: '🏢', name: 'Edificios', files: ['pisos', 'pisos-2', 'pisos-3', 'pisos-4', 'pisos-5', 'torre-metalica'] },
  { icon: '🛒', name: 'Tiendas', files: ['supermercado', 'supermercado-2', 'supermercado-3', 'supermercado-4', 'Farmacia'] },
  { icon: '🍽️', name: 'Restaurantes', files: ['Restaurante'] },
  { icon: '🎬', name: 'Cines', files: ['cine', 'teatro'] },
  { icon: '⚽', name: 'Deportes', files: ['estadio-1', 'estadio-2', 'estadio-3', 'estadio-4', 'rugby', 'plaza-de-toros', 'parque-futbol'] },
  { icon: '🌳', name: 'Parques', files: ['bosque', 'parque-infantil', 'jardin', 'cesped-2', 'parque-picnic', 'prado', 'claro-bosque', 'desierto-1', 'desierto-2', 'mar', 'mar-peces'] },
  { icon: '🏫', name: 'Servicios', files: ['colegio', 'helipuerto'] },
  { icon: '🚀', name: 'Espacio', files: Object.values(WORLD_HOUSES).flat().map(h => h.replace(/^images\//, '').replace(/\.webp$/, '')) },
  { icon: '👑', name: 'Oro', files: GOLD_HOUSES.map(h => h.replace(/^images\//, '').replace(/\.webp$/, '')) },
  { icon: '🎉', name: 'Eventos', files: [] }   // casas de edición limitada del evento activo (se rellena sola)
];
// Si una casa no está en la lista de arriba, su categoría sale del nombre del archivo: cine-2.webp → Cines, casa-9.webp → Casas, etc.
const HOUSE_PREFIX = [
  ['Casas', ['casa', 'chalet', 'villa', 'mansion', 'adosado']],
  ['Edificios', ['piso', 'edificio', 'torre', 'bloque', 'rascacielos', 'apartamento', 'hotel', 'oficina']],
  ['Tiendas', ['super', 'supermercado', 'tienda', 'farmacia', 'panaderia', 'banco', 'centro-comercial', 'mercado']],
  ['Restaurantes', ['restaurante', 'cafe', 'cafeteria', 'bar', 'pizzeria', 'heladeria']],
  ['Cines', ['cine', 'teatro', 'museo', 'discoteca']],
  ['Deportes', ['estadio', 'rugby', 'plaza-de-toros', 'futbol', 'baloncesto', 'tenis', 'piscina', 'pabellon', 'gimnasio', 'golf']],
  ['Parques', ['parque', 'bosque', 'jardin', 'claro', 'cesped', 'desierto', 'lago', 'playa', 'huerto']],
  ['Motor', ['gasolinera', 'taller', 'parking', 'garaje', 'lavadero']],
  ['Servicios', ['colegio', 'hospital', 'bomberos', 'policia', 'iglesia', 'aeropuerto', 'helipuerto', 'fabrica', 'ayuntamiento', 'estacion']]
];
const houseCatOf = h => {
  if (eventHouses.includes(h)) return 'Eventos';
  const base = h.replace(/^images\//, '').replace(/\.(png|webp)$/i, '');
  const c = HOUSE_CATS.find(c => c.files.includes(base));
  if (c) return c.name;
  const k = base.toLowerCase().replace(/^iso-/, ''), word = k.split(/[-_0-9]/)[0].replace(/s$/, '');
  const p = HOUSE_PREFIX.find(([, keys]) => keys.some(w => word === w.replace(/s$/, '') || k.startsWith(w + '-')));
  return p ? p[0] : 'Otros';
};
function buildHousePicker(box, onPick, withRandom) {
  box.replaceChildren();
  const add = (value, content, label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.house = value || ''; b.title = label; b.setAttribute('aria-label', label);
    b.style.cssText = 'flex:0 0 auto;width:52px;height:52px;padding:2px;border-radius:10px;font-size:22px';
    b.append(content);
    const locked = value && GOLD_HOUSES.includes(value) && !window.atlasGold;
    if (locked) { b.style.position = 'relative'; b.style.opacity = '.6'; const k = document.createElement('span'); k.textContent = '🔒'; k.style.cssText = 'position:absolute;right:2px;top:0;font-size:14px'; b.append(k); }
    b.onclick = () => { if (locked) { setMsg('👑 Casa del Pase Oro: consíguelo en 🎯 Retos → 👑 Pase Oro', 'err'); if (window.openRetos) window.openRetos('p'); return; } onPick(value); };
    box.appendChild(b);
  };
  if (withRandom) add(null, '🎲', 'Al azar');
  pickableHouses().forEach(h => {
    const i = document.createElement('img');
    i.src = sizedUrl(h, 't'); i.alt = ''; i.loading = 'lazy';
    i.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;display:block';
    add(h, i, houseName(h));
    box.lastChild.dataset.cat = houseCatOf(h);
  });
  // Fila de categorías encima de las casas
  const prev = box.previousElementSibling; if (prev && prev.classList.contains('house-cats')) prev.remove();
  const present = new Set([...box.children].map(b => b.dataset.cat).filter(Boolean));
  const list = HOUSE_CATS.filter(c => present.has(c.name)).map(c => ({ key: c.name, label: c.icon + ' ' + c.name }));
  if (present.has('Otros')) list.push({ key: 'Otros', label: '📦 Otros' });
  list.unshift({ key: '', label: '✨ Todas' });
  const row = document.createElement('div'); row.className = 'house-cats';
  row.style.cssText = 'display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:2px 3px 6px';
  const show = key => {
    [...box.children].forEach(b => { b.style.display = !key || !b.dataset.cat || b.dataset.cat === key ? '' : 'none'; });   // el 🎲 (sin categoría) siempre se ve
    [...row.children].forEach(c => { c.style.background = c.dataset.key === key ? '#ffb703' : ''; c.style.color = c.dataset.key === key ? '#111' : ''; });
    box.scrollLeft = 0;
  };
  list.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = c.label; b.dataset.key = c.key;
    b.style.cssText = 'flex:0 0 auto;padding:6px 10px;border-radius:999px;font-size:13px;white-space:nowrap';
    b.onclick = () => show(c.key); row.appendChild(b);
  });
  box.before(row); show('');
}
function markHouse(box, current) {
  [...box.children].forEach(b => { b.style.outline = (b.dataset.house || '') === (current || '') ? '3px solid #ffb703' : ''; });
}
(function setupHousePickers() {
  const freeBox = $('house-pick-free'), editBox = $('house-pick-edit');
  const onFree = h => { chosenHouse = h; markHouse(freeBox, h); };
  const onEdit = async h => {
    if (!selected || !selected.mine || h === selected.house) return;
    const cost = cfg.houseCost ?? 1;
    if (cost > 0) {
      if (credits < cost) return setMsg('NO TIENES CRÉDITOS PARA ESTA MEJORA. COMPRA CRÉDITOS.', 'err');
      if (!confirm(`Cambiar la casa cuesta ${cost} ${plural(cost, 'crédito', 'créditos')}. ¿Continuar?`)) return;
    }
    try {
      const j = await api('/api/parcel/house', { method: 'POST', body: { id: selected.id, house: h } });
      credits = j.credits; updateCreditUi();
      selected.house = j.house;
      markHouse(editBox, j.house);
      $('p-photo').src = houseFor(selected.id, j.house);
      drawOwned({ world: selected.world, id: selected.id, x: selected.x, y: selected.y, owner: selected.owner, avatar: selected.avatar, country: selected.country, house: j.house, level: selected.level });
      sfx('claim');
      $('house-pick-wrap').classList.add('hidden');
      setMsg(`🏠 ¡Casa cambiada! Te quedan ${credits} ${plural(credits, 'crédito', 'créditos')}`, 'ok');
    } catch (e) { setMsg(e.message, 'err'); }
  };
  const build = () => {
    buildHousePicker(freeBox, onFree, true); markHouse(freeBox, chosenHouse);
    buildHousePicker(editBox, onEdit, false); if (selected && selected.mine) markHouse(editBox, selected.house);
  };
  build();
  window.rebuildHousePickers = build;
  // Casas de los eventos activos (🎃 Halloween, 🎄 Navidad…): salen en la categoría «Eventos» solo mientras dura el evento
  api('/api/events').then(j => {
    eventHouses = ((j && j.events) || []).filter(e => e.active).flatMap(e => e.houses || []);
    if (eventHouses.length) build();
  }).catch(() => {});
  $('house-change-btn').onclick = () => $('house-pick-wrap').classList.toggle('hidden');
})();

// ---------- País (bandera) ----------
const COUNTRY_CODES = ('AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ '
  + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
  + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '
  + 'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '
  + 'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '
  + 'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ '
  + 'UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
const flagOf = c => /^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map(ch => 127397 + ch.charCodeAt(0))) : '';
const labelOf = p => [flagOf(p.country), p.avatar, p.owner].filter(Boolean).join(' ');
let country = '';
(function buildCountryPicker() {
  const sel = $('country');
  let names = null;
  try { names = new Intl.DisplayNames(['es'], { type: 'region' }); } catch {}
  const nameOf = c => { try { return (names && names.of(c)) || c; } catch { return c; } };
  const none = document.createElement('option');
  none.value = ''; none.textContent = '🌍 Sin especificar';
  sel.appendChild(none);
  COUNTRY_CODES.map(c => ({ c, n: nameOf(c) })).sort((a, b) => a.n.localeCompare(b.n, 'es'))
    .forEach(({ c, n }) => { const o = document.createElement('option'); o.value = c; o.textContent = flagOf(c) + ' ' + n; sel.appendChild(o); });
  let saved = null;
  try { saved = localStorage.getItem('country'); } catch {}
  if (saved === null) { const m = (navigator.language || '').match(/-([A-Za-z]{2})$/); saved = m ? m[1].toUpperCase() : ''; }
  sel.value = COUNTRY_CODES.includes(saved) ? saved : '';
  country = sel.value;
  sel.onchange = () => { country = sel.value; try { localStorage.setItem('country', country); } catch {} };
})();

// ---------- Packs de terrenos (créditos) ----------
let packCode = null, credits = 0;
try { packCode = localStorage.getItem('packCode'); } catch {}
// Enlace VIP (/?vip=CODIGO, lo da el administrador): entra con ese pack sin iniciar sesión y se borra de la dirección
try {
  const sp0 = new URLSearchParams(location.search), vip = (sp0.get('vip') || '').trim().toUpperCase().slice(0, 40);
  if (vip) { packCode = vip; localStorage.setItem('packCode', vip); sp0.delete('vip'); history.replaceState(null, '', location.pathname + (sp0.toString() ? '?' + sp0 : '') + location.hash); }
} catch {}
function saveCode(c) {
  packCode = c;
  try { if (c) localStorage.setItem('packCode', c); else localStorage.removeItem('packCode'); } catch {}
}
function updateCreditUi() {
  const has = !!packCode && credits > 0;
  $('credit-box').classList.toggle('hidden', !has);
  $('buy-box').classList.toggle('hidden', has);
  const fn = $('free-note'); if (fn) fn.classList.toggle('hidden', !(cfg && cfg.free) || has);   // juego gratuito: sin créditos se explica cómo conseguir más
  $('credits-left').textContent = credits;
  $('my-code').textContent = packCode || '';
  const cc = $('credit-count'); if (cc) cc.textContent = credits;
}
async function fetchPack(code) {
  const r = await fetch('/api/pack', { headers: { Authorization: 'Bearer ' + code } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 200 && j.nick) applyFixedNick(j.nick, j.country);
  return { status: r.status, credits: j.credits };
}
// Pack VIP: el nombre (y el país) vienen fijos del servidor y no se pueden cambiar
function applyFixedNick(nick, ctry) {
  const n = $('name'); if (n) { n.value = nick; n.readOnly = true; }
  const c = $('country'); if (c && ctry) { c.value = ctry; country = ctry; c.disabled = true; }
}
async function refreshCredits() {
  if (packCode) {
    try {
      const r = await fetchPack(packCode);
      if (r.status === 403) { saveCode(null); credits = 0; }
      else if (r.status === 200) credits = r.credits;
    } catch {}
  } else credits = 0;
  updateCreditUi();
}
$('recover-btn').onclick = async () => {
  const code = $('recover-code').value.trim().toUpperCase();
  if (!code) return;
  try {
    const r = await fetchPack(code);
    if (r.status !== 200) throw new Error('Código no válido');
    saveCode(code); credits = r.credits; updateCreditUi();
    $('recover-code').value = '';
    setMsg(`Código recuperado: te quedan ${credits} terrenos`, 'ok');
  } catch (e) { setMsg(e.message, 'err'); }
};
$('buy-parcel-btn').onclick = async () => {
  if (!(!!packCode && credits > 0) && !authToken && loginRequired() && cfg.guestCredits > 0 && (window.firstGuide ? window.firstGuide.isGuest() : false)) {   // usó sus parcelas de prueba: ahora toca crear cuenta
    openLogin('Crea tu cuenta para guardar tus parcelas y seguir jugando 🎁'); return;
  }
  if (cfg.free && !(!!packCode && credits > 0)) { const m = 'Te faltan créditos. Consíguelos con el regalo diario, la ruleta, invitando amigos o con la producción de tus terrenos.'; setMsg(m); flashToast(m); return; }
  if (!(!!packCode && credits > 0)) { $('buy-box').scrollIntoView({ behavior: 'smooth', block: 'center' }); setMsg('Elige un pack de créditos para reclamar este terreno.'); flashToast('Elige un pack de créditos para reclamar este terreno.'); return; }
  if (!selected || selected.owner) return;
  let owner;
  try { owner = nameOrThrow(true); } catch (e) { return; }   // sin nombre se pone uno por defecto
  const btn = $('buy-parcel-btn');
  btn.disabled = true;
  try {
    const r = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + packCode, ...authHeaders() },
      body: JSON.stringify({ lat: selected.south + cfg.size / 2, lng: selected.west + cfg.size / 2, owner, avatar, country, house: chosenHouse, world: selected.world || 'tierra' })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo reclamar');
    credits = j.credits; updateCreditUi();
    try { document.dispatchEvent(new CustomEvent('parcel:claimed', { detail: { credits: j.credits, lat: selected.south + cfg.size / 2, lng: selected.west + cfg.size / 2, id: selected.id } })); } catch (e) {}
    selected.owner = j.owner; selected.avatar = avatar; selected.country = country; selected.since = Date.now();
    selected.house = chosenHouse; selected.mine = !!authToken;
    showPanel(selected);
    setMsg('¡Listo! Es tuyo. 🎉' + (j.referralBonus ? ` 👫 (incluye +${j.referralBonus} de regalo por venir invitado)` : ''), 'ok'); sfx('claim');
    drawOwned({ world: selected.world, id: selected.id, x: selected.x, y: selected.y, owner: selected.owner, avatar: selected.avatar, country: selected.country, house: selected.house });
    if (!isOtherWorld(selected)) invalidateTile(selected.x, selected.y);
    loadStats(); loadParcels(); loadProduction();
    // Celebración: la cámara va a la casa nueva, confeti y cartel (celebrar.js); la primera vez de este navegador, más grande
    let firstClaim = false;
    try { firstClaim = !localStorage.getItem('firstClaimDone'); localStorage.setItem('firstClaimDone', '1'); } catch (e) {}
    if (window.celebrateClaim) window.celebrateClaim({ lat: selected.south + cfg.size / 2, lng: selected.west + cfg.size / 2, first: firstClaim });
  } catch (e) {
    setMsg(e.message, 'err'); flashToast('⚠️ ' + e.message); sfx('error');
    refreshCredits();
  } finally { btn.disabled = false; }
};

// ---------- Regalo diario ----------
let dailyState = null;
const plural = (n, one, many) => n === 1 ? one : many;
async function loadDaily() {
  try {
    const r = await fetch('/api/daily', { headers: { ...(packCode ? { Authorization: 'Bearer ' + packCode } : {}), ...authHeaders() } });
    if (r.status === 403) { saveCode(null); credits = 0; updateCreditUi(); return loadDaily(); }
    if (!r.ok) return;
    dailyState = await r.json();
  } catch { return; }
  renderDaily();
}
function renderDaily() {
  const d = dailyState;
  if (!d) return;
  $('daily-dot').classList.toggle('hidden', !d.canClaim);
  const racha = `${d.streak} ${plural(d.streak, 'día', 'días')}`;
  const premio = `+${d.next} ${plural(d.next, 'terreno', 'terrenos')}`;
  $('daily-info').textContent = d.canClaim
    ? (d.streak > 0 ? `🔥 Racha actual: ${racha}. ¡No la pierdas! Hoy te llevas ${premio}.` : `Hoy te llevas ${premio}.`)
    : `¡Hoy ya lo has cobrado! Vuelve mañana: ${premio}. Racha: ${racha}.`;
  const nextIdx = d.canClaim ? d.dayInCycle : d.dayInCycle % 7, left = 6 - nextIdx;   // días hasta el premio grande (el último de la racha)
  const big = d.rewards[6];
  $('daily-info').textContent += left === 0 ? ` 🏆 ¡Hoy es el premio grande: +${big}!`
    : (d.canClaim || nextIdx > 0 ? ` 🏆 ${left === 1 ? 'Mañana' : `En ${left} días`} llega el premio grande: +${big}.` : '');
  const box = $('daily-days');
  box.replaceChildren();
  d.rewards.forEach((n, i) => {
    const done = i < d.dayInCycle, today = d.canClaim && i === d.dayInCycle;
    const cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;padding:6px 2px;border-radius:8px;border:1px solid var(--line);font-size:12px;white-space:pre-line;'
      + (done ? 'background:var(--accent);color:#fff;' : '') + (today ? 'outline:2px solid #ffb703;' : '') + (i === 6 && !done ? 'background:#ffb70322;border-color:#ffb703;font-weight:800;' : '');
    cell.textContent = `Día ${i + 1}\n${done ? '✅' : (i === 6 ? '🏆' : '🎟️')}\n+${n}`;
    box.appendChild(cell);
  });
  const btn = $('daily-claim');
  btn.disabled = !d.canClaim;
  btn.textContent = d.canClaim ? `🎁 Reclamar ${premio}` : 'Vuelve mañana';
  if (d.canClaim && needLoginForDaily()) btn.textContent = `👤 Entra para reclamar ${premio}`;
}
function setDailyMsg(text, kind = '') { const m = $('daily-msg'); m.textContent = text; m.className = 'msg ' + kind; }
$('daily-btn').onclick = () => { setDailyMsg(''); $('daily').classList.remove('hidden'); loadDaily(); };
$('daily-close').onclick = () => $('daily').classList.add('hidden');
$('daily-claim').onclick = async () => {
  if (needLoginForDaily()) { $('daily').classList.add('hidden'); openLogin('Entra para reclamar tu regalo diario 🎁'); return; }
  const btn = $('daily-claim');
  btn.disabled = true;
  try {
    const r = await fetch('/api/daily/claim', { method: 'POST', headers: { ...(packCode ? { Authorization: 'Bearer ' + packCode } : {}), ...authHeaders() } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo reclamar el regalo');
    saveCode(j.code); credits = j.credits; updateCreditUi();
    sfx('gift');
    setDailyMsg(`🎉 +${j.reward} ${plural(j.reward, 'terreno', 'terrenos')}. Ahora tienes ${j.credits}.`, 'ok');
    $('daily-code').textContent = j.newCode
      ? `🔑 Tu código: ${j.code}. Guárdalo: lo necesitas para no perder tus terrenos si cambias de móvil o borras los datos del navegador.`
      : '';
    await loadDaily();
  } catch (e) {
    setDailyMsg(e.message, 'err');
    loadDaily();
  }
};

// ---------- Compra ----------
function nameOrThrow(auto = false) {
  const inp = $('name');
  let n = inp.value.replace(/\s+/g, ' ').trim();
  // Reclamar en un toque: si no se escribió nombre, se pone uno por defecto («Vecino1234») en vez de pedirlo
  if (n.length < 2 && auto && !inp.readOnly) {
    n = 'Vecino' + (1000 + Math.floor(Math.random() * 9000));
    inp.value = n;
    flashToast('Tu nombre es «' + n + '». Puedes elegir otro en «Personalizar» antes de reclamar.');
  }
  if (n.length < 2) { setMsg('Escribe tu nombre (mínimo 2 letras) antes de pagar', 'err'); flashToast('⚠️ Escribe tu nombre (mínimo 2 letras)'); throw new Error('nombre'); }
  return n;
}
// Packs a la venta (vienen del servidor): el elegido se manda al crear el pedido de PayPal
let chosenPack = null;
function buildPackPicker(boxId = 'pack-list') {
  const box = $(boxId);
  if (!box || !cfg.packs || !cfg.packs.length) return;
  if (!cfg.packs.some(p => p.credits === chosenPack)) chosenPack = cfg.packs[0].credits;
  const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: cfg.currency });
  const mark = () => [...box.children].forEach(b => { b.style.outline = Number(b.dataset.pack) === chosenPack ? '3px solid #ffb703' : ''; });
  box.replaceChildren();
  cfg.packs.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.pack = p.credits; b.dataset.nosound = '';
    b.style.cssText = 'padding:8px 6px;border-radius:10px;line-height:1.25;text-align:center';
    const top = document.createElement('strong'); top.textContent = `🎟️ ${p.credits} créditos`;
    const price = document.createElement('div'); price.textContent = money.format(Number(p.price));
    b.append(top, price);
    b.onclick = () => { chosenPack = p.credits; mark(); };
    box.appendChild(b);
  });
  mark();
}
async function createOrder() {
  const o = await api('/api/packs/orders', { method: 'POST', body: { pack: chosenPack, method: 'paypal' } });
  return o.orderId;
}
// Stripe (pago principal): Stripe Checkout en su propia página; al terminar vuelve aquí (ver resumePayment)
async function payWithStripe(btn) {
  btn.disabled = true;
  try {
    setMsg('Abriendo el pago…');
    const here = location.origin + location.pathname;
    const o = await api('/api/packs/orders', { method: 'POST', body: { pack: chosenPack, method: 'stripe', returnUrl: here } });
    if (!o.approveUrl) throw new Error('No se pudo abrir el pago');
    localStorage.setItem('pendingPay', o.orderId);
    location.href = o.approveUrl;
  } catch (e) { btn.disabled = false; fail(e); }
}
// Muestra el botón de Stripe (principal) y, debajo, PayPal (secundario) según lo que tenga configurado el servidor
function setupPayBoxes(sfx = '', ppSel = '#paypal-box') {
  const sbox = $('stripe-box' + sfx), btn = $('stripe-pay' + sfx), or = $('pay-or' + sfx), ppBox = document.querySelector(ppSel);
  if (cfg.stripe && sbox) {
    sbox.classList.remove('hidden');
    btn.onclick = () => payWithStripe(btn);
    const gp = $('gpay-pay' + sfx);   // Google Pay: abre el mismo pago de Stripe, que ofrece Google Pay arriba si tu móvil lo admite
    if (gp) {
      gp.onclick = () => payWithStripe(gp);
      // Si existe images/gpay-button.svg (botón oficial de Google Pay), se usa en lugar del texto
      const img = new Image(); img.alt = 'Pagar con Google Pay'; img.className = 'gpay-img';
      img.onload = () => { gp.replaceChildren(img); gp.classList.add('official'); };
      img.src = 'images/gpay-button.svg';
    }
    if (or) or.classList.toggle('hidden', !cfg.paypal);
  }
  if (cfg.paypal && cfg.clientId) renderPaypal(ppSel);
  else if (ppBox) ppBox.classList.add('hidden');
}
async function captureOrder(orderId) {
  const r = await api(`/api/packs/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', body: {} });
  saveCode(r.code); credits = r.credits; updateCreditUi();
  setMsg(`¡Pack comprado! Tienes ${credits} créditos. Guarda tu código 🔑`, 'ok'); sfx('claim');
}
function fail(e) { if (e.message !== 'nombre') setMsg(e.message, 'err'); }

const isSmallPay = () => matchMedia('(max-width: 700px), (pointer: coarse)').matches;
function loadPaypalSdk() {
  if (paypalLoaded) return paypalLoaded;
  paypalLoaded = new Promise((ok, ko) => {
    const s = document.createElement('script');
    // En móvil se quita el botón "Tarjeta" incrustado (su formulario se sale de la pantalla): el botón "Tarjeta" que se ve
    // debajo de PayPal abre el mismo pago de PayPal, y allí se paga con tarjeta como invitado en su propia ventana, que sí se desplaza bien.
    const small = isSmallPay();
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=${cfg.currency}&intent=capture${small || cfg.stripe ? '&disable-funding=card' : ''}`;
    s.onload = ok; s.onerror = () => ko(new Error('No se pudo cargar PayPal'));
    document.head.appendChild(s);
  });
  return paypalLoaded;
}
const paypalOpts = () => ({
  style: { layout: 'vertical', shape: 'rect', label: 'pay', height: 30 },
  createOrder: () => createOrder().catch(e => { fail(e); throw e; }),
  onApprove: data => captureOrder(data.orderID).catch(fail),
  onError: e => setMsg('Error con PayPal: ' + (e.message || e), 'err'),
});
async function renderPaypal(sel = '#paypal-box') {
  try {
    await loadPaypalSdk();
    if (!isSmallPay() || cfg.stripe) { paypal.Buttons(paypalOpts()).render(sel); return; }   // escritorio (o con Stripe, que ya cobra con tarjeta): solo el botón PayPal
    // Móvil: botón PayPal y, debajo, un botón "Tarjeta" que lleva a la página de pago de PayPal (donde se paga con tarjeta como invitado)
    const box = document.querySelector(sel);
    box.innerHTML = '<div class="pp-main"></div><button type="button" class="pp-card">💳 Tarjeta</button>';
    paypal.Buttons(paypalOpts()).render(box.querySelector('.pp-main'));
    const card = box.querySelector('.pp-card');
    card.dataset.nosound = '';
    card.onclick = async () => {
      card.disabled = true;
      try {
        setMsg('Abriendo el pago…');
        const here = location.origin + location.pathname;
        const o = await api('/api/packs/orders', { method: 'POST', body: { pack: chosenPack, method: 'paypal', returnUrl: here } });
        if (!o.approveUrl) throw new Error('No se pudo abrir el pago con tarjeta');
        localStorage.setItem('pendingPay', o.orderId);
        location.href = o.approveUrl;   // PayPal -> pago con tarjeta -> vuelve aquí (ver resumePayment)
      } catch (e) { card.disabled = false; fail(e); }
    };
  } catch (e) { setMsg(e.message, 'err'); }
}
// Al volver de PayPal tras pagar con el botón "Tarjeta": cobra el pedido
async function resumePayment() {
  const sp = new URLSearchParams(location.search);
  const token = sp.get('token') || (sp.get('stripe') === 'ok' ? sp.get('session_id') : null), cancelled = sp.get('pay') === 'cancel';
  if (!token && !cancelled) return;
  let pending = null;
  try { pending = localStorage.getItem('pendingPay'); } catch {}
  if (!pending || (token && token !== pending)) return;
  try { localStorage.removeItem('pendingPay'); } catch {}
  ['token', 'PayerID', 'pay', 'stripe', 'session_id'].forEach(k => sp.delete(k));
  history.replaceState(null, '', location.pathname + (sp.toString() ? '?' + sp : '') + location.hash);
  if (cancelled) return setMsg('Pago cancelado', 'err');
  for (let i = 0; i < 40 && loginRequired() && !authToken; i++) await new Promise(r => setTimeout(r, 150));   // espera a la sesión
  try { await captureOrder(token); } catch (e) { fail(e); }
}

// ---------- Comprar créditos desde "Mis terrenos" ----------
let buyReady = false;
function openBuy() {
  if (cfg && cfg.free) return;   // juego gratuito: no hay compras
  buildPackPicker('pack-list-2');
  setMsg('');
  $('buy').classList.remove('hidden');
  if (cfg.demo) $('demo-pay-2').classList.remove('hidden');
  else if (!buyReady) { buyReady = true; setupPayBoxes('-2', '#paypal-box-2'); }   // los botones de PayPal se crean al abrir (no se dibujan bien en una ventana oculta)
}
$('mine-buy').onclick = () => { $('mine').classList.add('hidden'); openBuy(); };
$('panel-buy').onclick = openBuy;   // el mismo botón, desde el panel de tu terreno
$('credit-buy').onclick = openBuy;   // «Comprar créditos» del panel de terreno libre: lleva al pago
$('buy-close').onclick = () => $('buy').classList.add('hidden');
$('demo-pay-2').onclick = async () => { try { await captureOrder(await createOrder()); } catch (e) { fail(e); } };
$('demo-pay').onclick = async () => {
  try { await captureOrder(await createOrder()); } catch (e) { fail(e); }
};

// ---------- Estadísticas, ranking, ubicación ----------
const regionNames = (() => { try { return new Intl.DisplayNames(['es'], { type: 'region' }); } catch { return null; } })();
const countryName = c => { try { return (regionNames && regionNames.of(c)) || c; } catch { return c; } };
async function loadStats() {
  try {
    const s = await api('/api/stats');
    $('stats').textContent = `${s.sold} terrenos vendidos`;
    const ol = $('rank-list'); ol.replaceChildren();
    s.top.forEach((t, i) => { const li = document.createElement('li'); li.textContent = `${i === 0 ? '🏛️ ' : ''}${flagOf(t.country) ? flagOf(t.country) + ' ' : ''}${t.owner} — ${t.n}${i === 0 ? ' · Presidente' : ''}`; if (i === 0) li.style.fontWeight = '800'; ol.appendChild(li); });
    if (!s.top.length) ol.textContent = 'Aún no hay propietarios. ¡Sé el primero!';
    const oc = $('rank-countries'); oc.replaceChildren();
    (s.countries || []).forEach(c => { const li = document.createElement('li'); li.className = 'rank-link'; li.tabIndex = 0; li.setAttribute('role', 'button'); li.textContent = `${flagOf(c.country)} ${countryName(c.country)} — ${c.n}`; li.onclick = () => showCities(c.country); li.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showCities(c.country); } }; oc.appendChild(li); });
    if (!(s.countries || []).length) oc.textContent = 'Aún no hay países. Elige el tuyo al reclamar un terreno.';
  } catch {}
}
// Ranking por ciudades: al tocar un país salen sus ciudades con más terrenos y los propietarios de cada una
function showRankMain() { $('rank-cities').classList.add('hidden'); $('rank-main').classList.remove('hidden'); }
async function showCities(code) {
  $('rank-main').classList.add('hidden'); $('rank-cities').classList.remove('hidden');
  $('rank-cities-title').textContent = `${flagOf(code)} ${countryName(code)} — ciudades`;
  const ol = $('rank-cities-list'), note = $('rank-cities-note');
  ol.replaceChildren(); note.textContent = 'Cargando…';
  try {
    const j = await api('/api/rank/cities?country=' + encodeURIComponent(code));
    j.cities.forEach((c, i) => {
      const li = document.createElement('li');
      const head = document.createElement('button'); head.type = 'button'; head.className = 'rank-city';
      head.textContent = `${c.city} — ${c.n}`;
      const owners = document.createElement('div'); owners.className = 'rank-owners' + (i ? ' hidden' : '');   // la primera ciudad sale abierta
      c.owners.forEach(o => { const d = document.createElement('div'); d.textContent = `${o.owner} — ${o.n}`; owners.appendChild(d); });
      head.onclick = () => owners.classList.toggle('hidden');
      li.append(head, owners); ol.appendChild(li);
    });
    note.textContent = !j.cities.length ? 'Aún no hay ciudades para este país.' + (j.other ? ' Se están calculando, vuelve en un rato.' : '')
      : j.other ? `${j.other} terreno${j.other === 1 ? '' : 's'} sin ciudad asignada todavía (se van completando solos).` : '';
  } catch (e) { note.textContent = 'No se pudieron cargar las ciudades: ' + e.message; }
}
$('rank-back').onclick = showRankMain;
$('rank-btn').onclick = () => { showRankMain(); loadStats(); $('rank').classList.remove('hidden'); };
$('rank-close').onclick = () => $('rank').classList.add('hidden');
$('locate').onclick = () => {
  if (!navigator.geolocation) return alert('Tu navegador no permite geolocalización');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      // Estés donde estés en el mundo, al volver a tu ubicación el paracaidista siempre baja en paracaídas hasta ella
      const FLIGHT_MS = 6500;
      map.flyTo(ll, 18, { duration: FLIGHT_MS });
      if (window.skydive) window.skydive(FLIGHT_MS, { target: 'map' });
      map.once('moveend', () => selectAt(ll));
    },
    () => alert('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'),
    { enableHighAccuracy: true, timeout: 10000 });
};

// ---------- Cuenta (Google o email con contraseña) ----------
const loginRequired = () => !!(cfg && cfg.auth && cfg.auth.required);
const needLoginToBuy = () => loginRequired() && !authToken;
const needLoginForDaily = () => loginRequired() && !authToken && (!packCode || !!(window.firstGuide && window.firstGuide.isGuest()));

// El apodo vive en el servidor (tabla profiles) y no se puede cambiar una vez fijado
const nickOf = () => myNick || '';
function applyNick() {
  const nm = $('name'), n = nickOf();
  if (!nm) return;
  if (n) { nm.value = n; nm.readOnly = true; } else nm.readOnly = false;
  // Con la cuenta iniciada y el apodo ya fijado, el campo sobra: se oculta (el apodo se sigue usando al reclamar)
  const hide = !!(authToken && n), lb = document.querySelector('label[for="name"]');
  nm.style.display = hide ? 'none' : ''; if (lb) lb.style.display = hide ? 'none' : '';
}
function setLoginMsg(text, kind = '') { const m = $('login-msg'); m.textContent = text; m.className = 'msg ' + kind; }
function openLogin(reason) {
  setLoginMsg(reason || '');
  updateAuthUi();
  $('login').classList.remove('hidden');
}
function updateAuthUi() {
  const on = !!(cfg && cfg.auth && cfg.auth.enabled);
  $('account-btn').classList.toggle('hidden', !on);
  const inv = $('invite-btn'); if (inv) inv.classList.toggle('hidden', !on);   // Invita y gana solo si hay cuentas
  if (!on) return;
  const logged = !!authToken;
  $('mine-btn').classList.toggle('hidden', !logged);
  $('account-btn').textContent = '👤';
  $('account-btn').title = logged ? 'Mi cuenta' : 'Entrar';
  $('account-btn').setAttribute('aria-label', logged ? 'Mi cuenta' : 'Entrar');
  $('login-out').classList.toggle('hidden', logged);
  $('login-in').classList.toggle('hidden', !logged);
  if (!logged) { $('login-delete-confirm').classList.add('hidden'); $('login-delete').classList.remove('hidden'); $('login-delete-yes').disabled = false; }
  $('login-email-shown').textContent = (authUser && authUser.email) || '';
  if (logged && document.activeElement !== $('login-nick')) $('login-nick').value = nickOf();
  const fixed = !!myNick;
  $('login-nick').readOnly = fixed;
  $('login-nick-btn').classList.toggle('hidden', fixed);
  const lab = document.querySelector('label[for="login-nick"]');
  if (lab) lab.textContent = fixed ? 'Tu apodo (fijo, no se puede cambiar)' : 'Elige tu apodo (no podrás cambiarlo después)';
  if (logged) applyNick();
  $('code-note').classList.toggle('hidden', logged);          // con cuenta ya no hace falta guardar el código
  const gate = needLoginToBuy();
  $('buy-login').classList.toggle('hidden', !gate);
  $('paypal-box').classList.toggle('hidden', gate);
  $('stripe-box').classList.toggle('hidden', gate || !cfg.stripe);
  if (cfg.demo) $('demo-pay').classList.toggle('hidden', gate);
  if (dailyState) renderDaily();
  updateBuyParcelBtn();
}
function showWelcomeGift(n) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = `🎁 ¡Bienvenido! Te regalamos ${n} ${plural(n, 'crédito', 'créditos')} para empezar. ¡Reclama tu primer terreno!`;
  t.classList.add('show');
  clearTimeout(showWelcomeGift.t); showWelcomeGift.t = setTimeout(() => t.classList.remove('show'), 7000);
  try { sfx('gift'); } catch {}
}
async function linkAccountOnServer() {
  try {
    const r = await fetch('/api/auth/link', { method: 'POST', headers: { ...(packCode ? { Authorization: 'Bearer ' + packCode } : {}), ...authHeaders() } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo vincular la cuenta');
    saveCode(j.code); credits = j.credits; updateCreditUi();
    myNick = j.nickname || null;
    updateAuthUi();
    applyNick();
    let asked = false;
    try { asked = !!sessionStorage.getItem('nickAsked'); } catch {}
    if (!nickOf() && !asked) {                    // primera vez sin apodo: lo pedimos una vez
      try { sessionStorage.setItem('nickAsked', '1'); } catch {}
      openLogin('Elige tu apodo: es el nombre que verá la gente en tus terrenos y NO se podrá cambiar después 👤');
    } else {
      $('login').classList.add('hidden');
    }
    loadDaily(); loadProduction();
    if (j.adopted > 0) { try { loadParcels(); loadMine && loadMine(); } catch (e) {} }
    try { document.dispatchEvent(new CustomEvent('account:linked', { detail: { adopted: j.adopted || 0, credits: j.credits, welcomeBonus: j.welcomeBonus || 0 } })); } catch (e) {}
    if (j.welcomeBonus > 0) showWelcomeGift(j.welcomeBonus);   // regalo de bienvenida (solo la primera vez)
    if (j.ownerBonus > 0 && window.giftToast) giftToast(`👑 ¡Paga del mes! Te han ingresado ${Number(j.ownerBonus).toLocaleString('es-ES')} créditos.`);
    if (window.inviteAfterLink) inviteAfterLink();      // Invita y gana: apunta de quién viene
  } catch (e) { linkedFor = null; setLoginMsg(e.message, 'err'); }
}
async function onSession(session) {
  const wasLogged = !!authToken;
  authToken = session ? session.access_token : null;
  authUser = session ? session.user : null;
  if (!authToken) {
    linkedFor = null;
    if (wasLogged) {
      saveCode(null); credits = 0; updateCreditUi(); loadDaily();   // al salir, este móvil olvida el código de la cuenta
      myNick = null; $('name').value = ''; applyNick(); prodState = null; renderLive();
    }
    updateAuthUi();
    return;
  }
  updateAuthUi();
  if (authUser && authUser.id !== linkedFor) { linkedFor = authUser.id; await linkAccountOnServer(); }
}
$('account-btn').onclick = () => openLogin();
$('login-close').onclick = () => $('login').classList.add('hidden');
$('buy-login').onclick = () => openLogin('Entra para comprar tu pack 🎁');
// "Entrar con Google" con el botón de Google (Google Identity Services): Google enseña tu dominio en vez de supabase.co.
// Si algo falla (sin conexión, script bloqueado, origen no autorizado...) se queda el botón de siempre.
// Casilla de edad (16+): hace falta para crear cuenta y para entrar con Google (que también puede crear una)
const ageOk = () => !!($('age-ok') && $('age-ok').checked);
const syncAge = () => document.body.classList.toggle('age-pending', !ageOk());
function needAge() {
  if (ageOk()) return true;
  setLoginMsg('Marca la casilla para confirmar que tienes 16 años o más', 'err');
  return false;
}
if ($('age-ok')) { $('age-ok').onchange = () => { syncAge(); if (ageOk()) setLoginMsg(''); }; syncAge(); }

async function initGoogleId() {
  try {
    const cid = cfg.auth && cfg.auth.googleClientId, box = $('login-google-gsi');
    if (!cid || !sb || !box || !window.crypto || !crypto.subtle) return;
    if (!(window.google && google.accounts && google.accounts.id)) {
      await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    }
    const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));   // nonce: se manda a Google con hash y a Supabase sin hash
    const hashed = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))).map(b => b.toString(16).padStart(2, '0')).join('');
    google.accounts.id.initialize({
      client_id: cid, nonce: hashed, ux_mode: 'popup', use_fedcm_for_prompt: true, itp_support: true,
      callback: async resp => {
        if (!needAge()) return;
        setLoginMsg('Entrando…');
        const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: resp.credential, nonce: raw });
        if (error) setLoginMsg(error.message, 'err'); else setLoginMsg('');
      }
    });
    // El botón que se ve es el nuestro (con la «G» de index.html). El de Google va encima, invisible, para recibir el toque:
    // así se conserva el inicio de sesión con tu dominio, pero con tu diseño.
    const btn = $('login-google');
    const wrap = document.createElement('div'); wrap.style.cssText = 'position:relative;width:100%';
    btn.parentNode.insertBefore(wrap, btn); wrap.appendChild(btn); wrap.appendChild(box);
    box.classList.remove('hidden');
    box.style.cssText = 'position:absolute;inset:0;opacity:.01;overflow:hidden;display:flex;align-items:center;justify-content:center;z-index:2;pointer-events:none;min-height:0';
    const inner = document.createElement('div'); inner.style.transform = 'scaleY(1.5)'; box.appendChild(inner);   // el botón de Google mide 40 px: se estira para tapar el nuestro
    google.accounts.id.renderButton(inner, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'left', width: 400, locale: 'es' });
    setTimeout(() => { if (inner.querySelector('iframe')) box.style.pointerEvents = 'auto'; else box.remove(); }, 1000);   // si el de Google no carga, queda el botón de siempre
  } catch (e) { /* se queda el botón de siempre */ }
}
$('login-google').onclick = async () => {
  if (!sb) return setLoginMsg('El login no está disponible ahora mismo', 'err');
  if (!needAge()) return;
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) setLoginMsg(error.message, 'err');
};

// Email + contraseña
function mapAuthError(e) {
  const m = (e && e.message) || '';
  if (/Invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos';
  if (/Email not confirmed/i.test(m)) return 'Aún no has confirmado tu email. Revisa tu correo (y el spam).';
  if (/already registered/i.test(m)) return 'Ese email ya tiene cuenta. Pulsa Entrar.';
  if (/at least 6/i.test(m)) return 'La contraseña necesita al menos 6 caracteres';
  if (/rate limit/i.test(m)) return 'Demasiados intentos. Espera unos minutos.';
  return m || 'No se pudo completar';
}
function readCreds() {
  const email = $('login-email').value.trim(), password = $('login-pass').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) { setLoginMsg('Escribe un email válido', 'err'); return null; }
  if (password.length < 6) { setLoginMsg('La contraseña necesita al menos 6 caracteres', 'err'); return null; }
  return { email, password };
}
$('login-signup-btn').onclick = async () => {
  if (!sb) return setLoginMsg('El login no está disponible ahora mismo', 'err');
  if (!needAge()) return;
  const c = readCreds(); if (!c) return;
  const btn = $('login-signup-btn'); btn.disabled = true;
  try {
    const { data, error } = await sb.auth.signUp({ email: c.email, password: c.password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
    if (data.user && data.user.identities && data.user.identities.length === 0) throw new Error('Ese email ya tiene cuenta. Pulsa Entrar.');
    setLoginMsg('📧 Te hemos enviado un correo. Ábrelo y pulsa el enlace para confirmar tu cuenta (mira el spam).', 'ok');
  } catch (e) { setLoginMsg(mapAuthError(e), 'err'); }
  finally { btn.disabled = false; }
};
$('login-signin-btn').onclick = async () => {
  if (!sb) return setLoginMsg('El login no está disponible ahora mismo', 'err');
  const c = readCreds(); if (!c) return;
  const btn = $('login-signin-btn'); btn.disabled = true;
  try {
    const { error } = await sb.auth.signInWithPassword(c);
    if (error) throw error;
    $('login-pass').value = '';
  } catch (e) { setLoginMsg(mapAuthError(e), 'err'); }
  finally { btn.disabled = false; }
};

// Apodo fijo: se guarda una sola vez en el servidor
$('login-nick-btn').onclick = async () => {
  if (myNick) return setLoginMsg('Tu apodo ya está fijado', 'err');
  const nick = $('login-nick').value.replace(/\s+/g, ' ').trim();
  if (nick.length < 2) return setLoginMsg('El apodo necesita al menos 2 letras', 'err');
  if (!confirm(`Tu apodo será "${nick}" y no podrás cambiarlo nunca. ¿Confirmas?`)) return;
  const btn = $('login-nick-btn');
  btn.disabled = true;
  try {
    const j = await api('/api/profile', { method: 'POST', body: { nickname: nick } });
    myNick = j.nickname;
    applyNick(); updateAuthUi();
    setLoginMsg('✅ Apodo guardado para siempre', 'ok');
  } catch (e) { setLoginMsg(e.message, 'err'); }
  finally { btn.disabled = false; }
};
$('login-logout').onclick = async () => {
  try { if (sb) await sb.auth.signOut(); } catch {}
  await onSession(null);
  $('login').classList.add('hidden');
};
// Borrar la cuenta: pide confirmación y borra todo en el servidor (datos + usuario)
$('login-delete').onclick = () => { $('login-delete').classList.add('hidden'); $('login-delete-confirm').classList.remove('hidden'); };
$('login-delete-no').onclick = () => { $('login-delete-confirm').classList.add('hidden'); $('login-delete').classList.remove('hidden'); };
$('login-delete-yes').onclick = async () => {
  const btn = $('login-delete-yes'); btn.disabled = true;
  try {
    await api('/api/account/delete', { method: 'POST', body: { confirm: true } });
    try { if (sb) await sb.auth.signOut(); } catch {}
    try { localStorage.clear(); sessionStorage.clear(); } catch {}   // fuera también lo guardado en este navegador
    setLoginMsg('Tu cuenta se ha borrado.', 'ok');
    setTimeout(() => location.reload(), 1800);
  } catch (e) { setLoginMsg(e.message, 'err'); btn.disabled = false; }
};

// ---------- Compartir terreno ----------
$('share-btn').onclick = async () => {
  if (!selected) return;
  const url = `${location.origin}${location.pathname}?t=${selected.id}`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Redecora El Mundo', text: 'Mira este terreno en Redecora El Mundo', url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); setMsg('🔗 Enlace copiado', 'ok'); }
  catch { setMsg(url); }
};
function openSharedParcel() {
  const m = location.search.match(/[?&]t=(\d{1,6}):(\d{1,6})/);
  if (!m) return;
  const x = Number(m[1]), y = Number(m[2]);
  if (x >= Math.round(360 / cfg.size) || y >= Math.round(180 / cfg.size)) return;
  const b = boundsOf(x, y);
  const ll = L.latLng((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2);
  map.setView(ll, 18);
  selectAt(ll);
}

// ---------- Buscador de lugares (OpenStreetMap / Nominatim) ----------
function setSearchMsg(text, kind = '') { const m = $('search-msg'); m.textContent = text; m.className = 'msg ' + kind; }
async function doSearch() {
  const q = $('search-q').value.trim();
  if (q.length < 3) return setSearchMsg('Escribe al menos 3 letras', 'err');
  const list = $('search-results'); list.replaceChildren();
  setSearchMsg('Buscando…');
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=es&q=' + encodeURIComponent(q));
    if (!r.ok) throw new Error('El buscador no responde ahora mismo');
    const res = await r.json();
    if (!res.length) return setSearchMsg('No he encontrado ese lugar', 'err');
    setSearchMsg('');
    res.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.cssText = 'display:block;width:100%;text-align:left;margin:6px 0;padding:10px';
      b.textContent = p.display_name;
      b.onclick = () => { $('search').classList.add('hidden'); map.flyTo([Number(p.lat), Number(p.lon)], 17); };
      list.appendChild(b);
    });
  } catch (e) { setSearchMsg(e.message || 'Error al buscar', 'err'); }
}
$('search-btn').onclick = () => { $('search').classList.remove('hidden'); setTimeout(() => $('search-q').focus(), 50); };
$('search-close').onclick = () => $('search').classList.add('hidden');
$('search-go').onclick = doSearch;
$('search-q').onkeydown = e => { if (e.key === 'Enter') doSearch(); };

// ---------- Mis terrenos y producción de créditos ----------
// Contador en vivo: el servidor da el total acumulado y la velocidad; el navegador lo va sumando cada segundo
// (se detiene solo cuando los terrenos llegan al tope de horas) y se re-sincroniza con el servidor cada minuto.
let prodState = null, resyncPending = false;
function setProd(prod) {
  prodState = { total: prod.total || 0, rate: prod.activeRate || 0, nextCapMs: prod.nextCapMs, parcels: prod.parcels, t0: performance.now() };
}
function liveTotal() {
  if (!prodState) return 0;
  let ms = performance.now() - prodState.t0;
  if (prodState.nextCapMs != null && ms > prodState.nextCapMs) {   // un terreno llegó al tope: pedir datos nuevos al servidor
    ms = prodState.nextCapMs;
    if (!resyncPending) { resyncPending = true; setTimeout(() => { resyncPending = false; loadProduction(); }, 500); }
  }
  return prodState.total + prodState.rate * ms / HOUR_MS;
}
const HOUR_MS = 3600000;
function renderLive() {
  const pill = $('credit-live'), show = !!(authToken && prodState && prodState.parcels);
  const v = show ? liveTotal() : 0;
  pill.textContent = show ? `+${v.toFixed(4)}` : '';
  pill.title = show ? 'Créditos que están produciendo tus terrenos (aún sin recoger)' : '';
  const live = $('mine-live');
  if (live) live.textContent = show ? `⏳ Acumulado: ${v.toFixed(4)} créditos` : '';
  const btn = $('mine-collect');
  if (btn && !btn.dataset.busy) {
    const ready = Math.floor(v + 1e-9);
    btn.disabled = !show || ready < 1;
    btn.textContent = ready >= 1 ? `🎟️ Recoger ${ready} ${plural(ready, 'crédito', 'créditos')}` : 'Aún no hay créditos listos';
  }
}
async function loadProduction() {
  if (!authToken) return;
  try { setProd(await api('/api/production', { method: 'GET' })); renderLive(); } catch {}
}
setInterval(renderLive, 1000);
setInterval(() => { if (authToken && !document.hidden) loadProduction(); }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadProduction(); });

function setMineMsg(text, kind = '') { const m = $('mine-msg'); m.textContent = text; m.className = 'msg ' + kind; }
function renderMine(prod, mine) {
  const n = prod.parcels;
  $('mine-prod').textContent = n
    ? `⏱️ Tienes ${n} ${plural(n, 'terreno', 'terrenos')}: producen ${prod.perHour.toLocaleString('es-ES', { maximumFractionDigits: 4 })} créditos por hora (según el nivel de cada uno). Se acumulan hasta ${prod.capHours} h, ¡recógelos antes de que se llene!`
    : 'Aún no tienes terrenos con producción. Reclama uno y empezará a producir créditos.';
  setProd(prod); renderLive();
  $('mine-count').textContent = mine.total > mine.parcels.length ? `Mostrando los ${mine.parcels.length} más recientes de ${mine.total}.` : (mine.total ? `${mine.total} ${plural(mine.total, 'terreno', 'terrenos')} en total.` : '');
  const box = $('mine-list'); box.replaceChildren();
  mine.parcels.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = 'display:block;width:100%;text-align:left;margin:6px 0;padding:10px';
    const wi = isOtherWorld(p) && window.worldInfo ? window.worldInfo(p.world) : null;
    b.textContent = `${flagOf(p.country)} ${p.avatar || ''} Terreno ${wi ? wi.name + ' ' + p.x + ':' + p.y : p.id} · ${starsOf(levelOf(p))} · ${new Date(p.since).toLocaleDateString('es-ES')}${p.likes ? ' · ❤️ ' + p.likes : ''}`.trim();
    b.onclick = () => {
      $('mine').classList.add('hidden');
      if (wi) { if (window.goToWorldParcel) window.goToWorldParcel(p); return; }   // en otro planeta: se viaja hasta él
      const bb = boundsOf(p.x, p.y);
      const ll = L.latLng((bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2);
      map.flyTo(ll, 18);
      map.once('moveend', () => selectAt(ll));
    };
    box.appendChild(b);
  });
}
async function loadMine() {
  try {
    const [prod, mine] = await Promise.all([api('/api/production', { method: 'GET' }), api('/api/my-parcels', { method: 'GET' })]);
    renderMine(prod, mine);
  } catch (e) { setMineMsg(e.message, 'err'); }
}
$('mine-btn').onclick = () => { setMineMsg(''); $('mine').classList.remove('hidden'); loadMine(); };
$('mine-close').onclick = () => $('mine').classList.add('hidden');
$('credit-pill').onclick = () => {
  if (authToken) { setMineMsg(''); $('mine').classList.remove('hidden'); loadMine(); }
  else if (cfg && cfg.auth && cfg.auth.enabled) openLogin('Entra para guardar tus terrenos y créditos 🎟️');
};
$('mine-collect').onclick = async () => {
  const btn = $('mine-collect');
  btn.disabled = true; btn.dataset.busy = '1';
  try {
    const j = await api('/api/production/collect', { method: 'POST', body: {} });
    credits = j.credits; updateCreditUi();
    sfx('coin');
    setMineMsg(`🎉 +${j.collected} ${plural(j.collected, 'crédito', 'créditos')}. Ahora tienes ${j.credits}.`, 'ok');
  } catch (e) { setMineMsg(e.message, 'err'); }
  delete btn.dataset.busy;
  loadMine();
};

// ---------- Muñeco que pasea: tócalo y gana una fracción de crédito ----------
// El servidor decide cuándo puede salir (límite entre muñecos y por día); aquí solo se dibuja y se avisa del toque.
const WALKERS = ['🚶', '🚶‍♀️', '🏃', '🧙', '🤠', '🦸', '🧑‍🚀', '🧟'];
let walkerBusy = false, walkerTimer = null;
const randBetween = (a, b) => a + Math.random() * (b - a);
function scheduleWalker(ms) { clearTimeout(walkerTimer); walkerTimer = setTimeout(trySpawnWalker, ms); }
function walkerUiBusy() {
  return document.hidden || !!document.querySelector('.modal:not(.hidden)') || !$('intro').classList.contains('hidden');
}
async function trySpawnWalker() {
  if (walkerBusy) return;
  if (!authToken) return scheduleWalker(20000);           // solo con cuenta: así el premio se guarda
  if (walkerUiBusy()) return scheduleWalker(10000);
  let r;
  try { r = await api('/api/walker/spawn', { method: 'POST', body: {} }); } catch { return scheduleWalker(60000); }
  if (!r.spawn) return scheduleWalker((r.waitMs || 60000) + randBetween(5000, 60000));
  showWalker(r);
}
function floatText(rect, text) {
  const f = document.createElement('div');
  f.className = 'walker-float';
  f.textContent = text;
  f.style.left = Math.max(8, Math.min(innerWidth - 120, rect.left)) + 'px';
  f.style.top = Math.max(8, rect.top - 10) + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1600);
}
function showWalker(r) {
  walkerBusy = true;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'walker'; b.dataset.nosound = '1';
  b.setAttribute('aria-label', 'Toca al muñeco para ganar créditos');
  const sp = document.createElement('span');
  sp.textContent = WALKERS[Math.floor(Math.random() * WALKERS.length)];
  b.appendChild(sp);
  const fromLeft = Math.random() < 0.5, dur = randBetween(8000, 12000), off = 70;
  b.style.top = Math.round(randBetween(0.22, 0.7) * innerHeight) + 'px';
  b.style.left = (fromLeft ? -off : innerWidth + 10) + 'px';
  b.style.transform = fromLeft ? 'scaleX(-1)' : 'none';
  document.body.appendChild(b);
  sfx('pop');
  let done = false, tm = null;
  const end = () => {
    if (done) return; done = true; clearTimeout(tm); b.remove(); walkerBusy = false;
    scheduleWalker(randBetween(90000, 240000));
  };
  requestAnimationFrame(() => requestAnimationFrame(() => {
    b.style.transition = `left ${dur}ms linear`;
    b.style.left = (fromLeft ? innerWidth + 10 : -off) + 'px';
  }));
  tm = setTimeout(end, dur + 300);
  b.onclick = async () => {
    if (done || b.disabled) return;
    b.disabled = true;
    const rect = b.getBoundingClientRect();
    b.style.transition = 'none'; b.style.left = rect.left + 'px';     // se queda quieto mientras se confirma
    try {
      const j = await api('/api/walker/tap', { method: 'POST', body: { id: r.id } });
      floatText(rect, `+${j.reward} 🎟️`);
      sfx('coin');
      if (prodState) { prodState.total += j.reward; renderLive(); }
      loadProduction();
    } catch (e) {
      floatText(rect, e.message);
      sfx('error');
    }
    end();
  };
}
scheduleWalker(randBetween(20000, 60000));

// ---------- Inicio ----------
(async () => {
  cfg = await api('/api/config');
  if (cfg.free) document.body.classList.add('free-mode');   // oculta por CSS todos los botones de compra
  if (cfg.coffee) {   // botón ☕ "Invítame a un café": abre el enlace de PayPal en otra pestaña
    const cb = $('coffee-btn');
    cb.classList.remove('hidden');
    cb.addEventListener('click', () => window.open(cfg.coffee, '_blank', 'noopener'));
  }

  if (adminViewEnabled()) setupAdminControls();

  if (cfg.demo) $('demo-pay').classList.remove('hidden');
  else if (!cfg.free) setupPayBoxes();

  if (cfg.demo) {
    const h = document.createElement('p');
    h.className = 'muted';
    h.textContent = 'MODO DEMO: no se cobra dinero real.';
    $('paypal-box').before(h);
  }

  if (cfg.auth && cfg.auth.enabled && window.supabase) {
    sb = window.supabase.createClient(cfg.auth.url, cfg.auth.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    sb.auth.onAuthStateChange((_event, session) => { setTimeout(() => onSession(session), 0); });   // setTimeout: no usar Supabase dentro del callback
  }
  updateAuthUi();
  initGoogleId();

  refreshCredits().then(loadDaily);
  try {
    if (!sessionStorage.getItem('visited')) {
      sessionStorage.setItem('visited', '1');
      fetch('/api/visit', { method: 'POST' }).catch(() => {});
    }
  } catch {}
  loadStats();
  loadParcels();
  openSharedParcel();
  resumePayment();
})();


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// ---------- Primer minuto: guía para reclamar el primer terreno ----------
// Aparece cuando la cuenta tiene créditos y ningún terreno. Paso 1: tocar una parcela libre; paso 2: reclamarla;
// al conseguirlo se felicita y se explica cómo recoger créditos. Se puede cerrar (solo hasta recargar).
(function () {
  const KEY = 'coachDone';
  const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const ssGet = k => { try { return sessionStorage.getItem(k); } catch { return null; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };

  const box = document.createElement('div');
  box.id = 'coach'; box.className = 'hidden'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
  box.innerHTML = '<div class="coach-step"></div><div class="coach-text"></div><div class="coach-btns"><button type="button" class="coach-go"></button><button type="button" class="coach-x" aria-label="Cerrar guía">✕</button></div>';
  document.body.appendChild(box);
  const stepEl = box.querySelector('.coach-step'), textEl = box.querySelector('.coach-text'), goBtn = box.querySelector('.coach-go');
  let mode = '', shown = false;

  function toast(text, ms) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms);
  }
  function set(m, step, text, btn) {
    if (m === mode) return;
    mode = m; stepEl.textContent = step; textEl.textContent = text; goBtn.textContent = btn;
  }
  goBtn.onclick = () => {
    if (mode === 'pick') { const b = document.getElementById('locate'); if (b) b.click(); }
    else { const b = document.getElementById('buy-parcel-btn'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };
  box.querySelector('.coach-x').onclick = () => { ssSet('coachHide', '1'); box.classList.add('hidden'); };

  function tick() {
    if (typeof authToken === 'undefined' || !authToken || !prodState || lsGet(KEY) === '1') { box.classList.add('hidden'); return; }
    const owned = Number(prodState.parcels) || 0;
    if (owned > 0) {                                  // ya tiene terreno: si la guía estaba en pantalla, se celebra
      box.classList.add('hidden');
      if (shown) { toast('🏠 ¡Ya tienes tu primer terreno! Produce créditos cada hora: recógelos en 🏠 Mis terrenos.', 9000); try { sfx('claim'); } catch {} }
      lsSet(KEY, '1'); return;
    }
    const welcome = document.getElementById('welcome');
    if (credits < 1 || ssGet('coachHide') === '1' || (welcome && !welcome.classList.contains('hidden'))) { box.classList.add('hidden'); return; }
    const panelOpen = !document.getElementById('panel').classList.contains('hidden');
    if (panelOpen && typeof selected !== 'undefined' && selected && !selected.owner) {
      set('claim', 'Paso 2 de 2', 'Elige tu casa (o deja el dado, que la elige por ti) y pulsa «Reclamar terreno». El nombre es opcional.', '⬇ Ir al botón');
    } else {
      set('pick', 'Paso 1 de 2', `Tienes ${credits} ${plural(credits, 'crédito', 'créditos')}. Toca una parcela libre del mapa para hacerla tuya.`, '📍 Ir a mi ubicación');
    }
    box.classList.remove('hidden'); shown = true;
  }
  setInterval(tick, 700);
})();
