'use strict';
const $ = id => document.getElementById(id);
const MIN_ZOOM_PARCELS = 15;   // por debajo no se muestran parcelas
const MIN_ZOOM_BUY = 16;       // para comprar hay que acercarse
let cfg, map, gl, selected = null, paypalLoaded = null;
let sb = null, authToken = null, authUser = null, linkedFor = null;   // sesión (Supabase Auth)
let myNick = null;             // apodo fijo guardado en el servidor
const drawn = new Map();       // id -> { srcId, url, label }

// ---------- Mapa 3D (MapLibre GL): globo + satélite + relieve ----------
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
    dem: {
      type: 'raster-dem', tileSize: 256, maxzoom: 15, encoding: 'terrarium',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      attribution: 'Relieve: Mapzen / AWS Terrain Tiles'
    }
  },
  layers: [
    { id: 'sat', type: 'raster', source: 'sat' },
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
    minZoom: 1, maxZoom: 19.5, maxPitch: 60,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),          // menos píxeles = más fluidez en móvil
    fadeDuration: 0
  });
} catch (e) {
  $('map').textContent = 'Tu dispositivo no puede mostrar el mapa 3D (WebGL no disponible).';
  throw e;
}
map = createCompatMap(gl);     // API tipo Leaflet usada por el resto del juego (ver mapshim.js)

let glReady = false;
// Entrada cinematográfica: del espacio a Gibraltar (inclinado, para ver el 3D)
let flightRequested = false;
const HOME = [-5.3536, 36.1408];   // Gibraltar: destino si no hay ubicación
function introFlight() {
  if (!glReady) { flightRequested = true; return; }
  const fly = (center, zoom) => gl.flyTo({ center, zoom, pitch: 45, bearing: -15, duration: 7000, essential: true });
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
function setMsg(text, kind = '') { const m = $('msg'); m.textContent = text; m.className = 'msg ' + kind; }
async function api(url, opts) {
  const r = await fetch(url, opts && { ...opts, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(opts.body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}

// ---------- Parcelas compradas en pantalla ----------
const HOUSES = [
    'images/casa-aerea.png',
    'images/casa-frente.png',
    'images/policia.png',
    'images/pisos.png',
    'images/gasolinera.png',
    'images/choza.png',
    'images/Restaurante.png',
    'images/McDonald.png',
    'images/Burgerking.png',
    'images/Farmacia.png',
    'images/colegio.png',
    'images/parque.png',
    'images/rascacielos.png',
    'images/casa-1.png',
    'images/casa-2.png',
    'images/casa-3.png',
    'images/casa-4.png',
    'images/casa-5.png'
];

function houseFor(id, house) {
  if (house && HOUSES.includes(house)) return house;   // la que eligió el dueño
  let h = 2166136261;
  for (const c of id) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  return HOUSES[(h >>> 16) % HOUSES.length];
}
// Altura aproximada (en metros) de cada tipo de edificio: da volumen 3D a las parcelas
const HOUSE_HEIGHT = {
  'casa-aerea': 9, 'casa-frente': 9, 'policia': 12, 'pisos': 30, 'gasolinera': 6, 'choza': 4,
  'restaurante': 8, 'mcdonald': 9, 'burgerking': 9, 'farmacia': 9, 'colegio': 15, 'parque': 0.6,
  'rascacielos': 120, 'casa-1': 8, 'casa-2': 10, 'casa-3': 12, 'casa-4': 9, 'casa-5': 11
};
function heightOf(url) {
  const k = String(url).split('/').pop().replace(/\.[a-z]+$/i, '').toLowerCase();
  return HOUSE_HEIGHT[k] ?? 9;
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
const MAX_DETAIL = 40;
let detailQueued = false;
// ---------- Casas recortadas por las calles ----------
// Las calles reales (teselas de OpenFreeMap) se restan de cada parcela: la casa queda cortada por la carretera.
// - Volumen 3D: se sustituye el polígono de la parcela por "parcela - calles" (turf).
// - Foto: se borra la franja de la calle en un canvas y se usa ese resultado como imagen de la parcela.
// Solo se calcula para parcelas que se ven enteras y cerca del centro (ahí las teselas tienen todo su detalle).
const ROAD_WIDTH = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 9, minor: 7 };   // ancho total, en metros
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
    if (r.road) applyCut(ex, r);
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
  if (!feats.length) return none;
  const pad = cfg.size * 0.3, box = [w - pad, s - pad, e + pad, n + pad];
  let area = null;
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
  const tok = ex.tok = (ex.tok || 0) + 1, url = ex.url, cut = roadCut.get(ex.p.id);
  let u = url, blob = null;
  if (cut && cut.road) { try { blob = await clippedPhoto(url, ex.p, cut.road); u = blob; } catch (e) {} }
  const src = ex.hasDetail && tok === ex.tok && url === ex.url && gl.getSource(ex.srcId);
  if (!src) { if (blob) URL.revokeObjectURL(blob); return; }
  freeBlob(ex); ex.blob = blob;
  src.updateImage({ url: u });
}

function addDetail(ex) {
  ex.want = true;
  if (ex.hasDetail || ex.adding) return;
  const cut = roadCut.get(ex.p.id);
  if (!(cut && cut.road)) return mountDetail(ex, ex.url, null);
  // Con calle: primero se prepara la foto recortada y luego se monta (así no parpadea la casa entera)
  ex.adding = true;
  const used = ex.url;
  clippedPhoto(used, ex.p, cut.road).catch(() => null).then(u => {
    ex.adding = false;
    if (!ex.want || ex.hasDetail) { if (u) URL.revokeObjectURL(u); return; }
    if (used !== ex.url) { if (u) URL.revokeObjectURL(u); return addDetail(ex); }   // cambió la casa mientras tanto
    mountDetail(ex, u || ex.url, u);
  });
}
function mountDetail(ex, imgUrl, blob) {
  const [[s, w], [n, e]] = boundsOf(ex.p.x, ex.p.y);
  ex.blob = blob;
  gl.addSource(ex.srcId, { type: 'image', url: imgUrl, coordinates: [[w, n], [e, n], [e, s], [w, s]] });
  gl.addLayer({ id: ex.srcId, type: 'raster', source: ex.srcId, paint: { 'raster-fade-duration': 0 } }, 'owned-3d');
  const pill = document.createElement('span');
  pill.className = 'owner-pill';
  pill.textContent = labelOf(ex.p);          // textContent: sin HTML
  ex.label = L.marker([(s + n) / 2, (w + e) / 2], {   // en el centro de la parcela, dentro de la casa
    icon: L.divIcon({ className: 'owner-label', html: pill, iconSize: [0, 0] }),
    interactive: false, keyboard: false
  }).addTo(map);
  ex.hasDetail = true;
}
function dropDetail(ex) {
  ex.want = false;
  if (!ex.hasDetail) return;
  ex.tok = (ex.tok || 0) + 1;
  if (ex.label) { ex.label.remove(); ex.label = null; }
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
    all.forEach((ex, i) => i < MAX_DETAIL ? addDetail(ex) : dropDetail(ex));
  });
}
gl.on('moveend', updateDetail);

function drawOwned(p) {
  if (!glReady) { pendingParcels.set(p.id, p); return; }
  const url = houseFor(p.id, p.house);
  const ex = drawn.get(p.id);
  if (ex) {   // ya dibujada: solo actualiza foto y altura si el dueño cambió la casa
    if (ex.url !== url) {
      ex.url = url;
      refreshPhoto(ex);
      const f = ownedFeatures.get(p.id); if (f) { f.properties.h = heightOf(url); flushOwned(); }
    }
    return;
  }
  const col = colorFor(p.owner);
  const [[s, w], [n, e]] = boundsOf(p.x, p.y);
  // Volumen 3D de la parcela (neutro, para no teñir la foto; el color del dueño va en el borde)
  ownedFeatures.set(p.id, {
    type: 'Feature', id: p.x * 1000003 + p.y,
    properties: { pid: p.id, color: col, h: heightOf(url), clat: (s + n) / 2, clng: (w + e) / 2 },
    geometry: { type: 'Polygon', coordinates: [ringOf(p.x, p.y)] }
  });
  drawn.set(p.id, { p, srcId: 'img-' + p.id, url, label: null, hasDetail: false });
  flushOwned();
  updateDetail();
  queueCuts();
}

// Capas del mapa que dependen de que el estilo esté cargado
gl.on('load', () => {
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
    paint: { 'line-color': ['get', 'color'], 'line-width': 2 }
  });
  gl.addSource('sel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  gl.addLayer({
    id: 'sel-plate', type: 'fill-extrusion', source: 'sel',
    paint: { 'fill-extrusion-color': '#ffb703', 'fill-extrusion-height': 1.5, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.55 }
  });
  gl.addLayer({ id: 'sel-line', type: 'line', source: 'sel', paint: { 'line-color': '#ffb703', 'line-width': 3.5 } });
  glReady = true;
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

let loadSeq = 0;
async function loadParcels() {
  if (!cfg || map.getZoom() < MIN_ZOOM_PARCELS) return;
  const b = map.getBounds(), seq = ++loadSeq;
  const qs = new URLSearchParams({
    south: Math.max(-90, b.getSouth()), north: Math.min(90, b.getNorth()),
    west: Math.max(-180, b.getWest()), east: Math.min(180, b.getEast())
  });
  try {
    const list = await api('/api/parcels?' + qs);
    if (seq === loadSeq) list.forEach(drawOwned);
  } catch {}
}
map.on('moveend', loadParcels);

function syncLabels() {
  map.getContainer().classList.toggle('labels-off', map.getZoom() < 17);
  // Ancho de una parcela en píxeles: el nombre se escala para caber dentro de la casa (ver .owner-pill en style.css)
  if (cfg) map.getContainer().style.setProperty('--ppx', (cfg.size * 512 * Math.pow(2, gl.getZoom()) / 360).toFixed(1));
}
map.on('zoomend', syncLabels); gl.on('zoom', syncLabels); syncLabels();

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
        id: selected.id,
        x: selected.x,
        y: selected.y,
        owner: selected.owner,
        avatar: selected.avatar,
        country: selected.country,
        house: selected.house
      });

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
  $('p-title').textContent = `Terreno ${p.id}`;
  const mLat = Math.round(cfg.size * 111320), mLng = Math.round(cfg.size * 111320 * Math.cos(p.south * Math.PI / 180));
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
    if (p.mine) markHouse($('house-pick-edit'), p.house);
    $('p-avatar').textContent = p.avatar || '';
    $('p-since').textContent = 'Comprado el ' + new Date(p.since).toLocaleDateString('es-ES');
  } else {
    $('p-price').textContent = new Intl.NumberFormat('es-ES', { style: 'currency', currency: cfg.currency }).format(cfg.price);
    $('pack-size').textContent = cfg.packSize;
  }
}
$('close').onclick = () => { $('panel').classList.add('hidden'); setSelected(null); selected = null; };

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
const houseName = h => h.replace(/^images\//, '').replace(/\.png$/i, '').replace(/[-_]/g, ' ');
function buildHousePicker(box, onPick, withRandom) {
  box.replaceChildren();
  const add = (value, content, label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.house = value || ''; b.title = label; b.setAttribute('aria-label', label);
    b.style.cssText = 'flex:0 0 auto;width:52px;height:52px;padding:2px;border-radius:10px;font-size:22px';
    b.append(content); b.onclick = () => onPick(value); box.appendChild(b);
  };
  if (withRandom) add(null, '🎲', 'Al azar');
  HOUSES.forEach(h => {
    const i = document.createElement('img');
    i.src = h; i.alt = ''; i.loading = 'lazy';
    i.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;display:block';
    add(h, i, houseName(h));
  });
}
function markHouse(box, current) {
  [...box.children].forEach(b => { b.style.outline = (b.dataset.house || '') === (current || '') ? '3px solid #ffb703' : ''; });
}
(function setupHousePickers() {
  const freeBox = $('house-pick-free'), editBox = $('house-pick-edit');
  buildHousePicker(freeBox, h => { chosenHouse = h; markHouse(freeBox, h); }, true);
  markHouse(freeBox, null);
  buildHousePicker(editBox, async h => {
    if (!selected || !selected.mine || h === selected.house) return;
    const cost = cfg.houseCost ?? 1;
    if (cost > 0) {
      if (credits < cost) return setMsg(`Cambiar la casa cuesta ${cost} ${plural(cost, 'crédito', 'créditos')} y no te quedan`, 'err');
      if (!confirm(`Cambiar la casa cuesta ${cost} ${plural(cost, 'crédito', 'créditos')}. ¿Continuar?`)) return;
    }
    try {
      const j = await api('/api/parcel/house', { method: 'POST', body: { id: selected.id, house: h } });
      credits = j.credits; updateCreditUi();
      selected.house = j.house;
      markHouse(editBox, j.house);
      $('p-photo').src = houseFor(selected.id, j.house);
      drawOwned({ id: selected.id, x: selected.x, y: selected.y, owner: selected.owner, avatar: selected.avatar, country: selected.country, house: j.house });
      sfx('claim');
      setMsg(`🏠 ¡Casa cambiada! Te quedan ${credits} ${plural(credits, 'crédito', 'créditos')}`, 'ok');
    } catch (e) { setMsg(e.message, 'err'); }
  }, false);
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
function saveCode(c) {
  packCode = c;
  try { if (c) localStorage.setItem('packCode', c); else localStorage.removeItem('packCode'); } catch {}
}
function updateCreditUi() {
  const has = !!packCode && credits > 0;
  $('credit-box').classList.toggle('hidden', !has);
  $('buy-box').classList.toggle('hidden', has);
  $('credits-left').textContent = credits;
  $('my-code').textContent = packCode || '';
  const cc = $('credit-count'); if (cc) cc.textContent = credits;
}
async function fetchPack(code) {
  const r = await fetch('/api/pack', { headers: { Authorization: 'Bearer ' + code } });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, credits: j.credits };
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
$('use-credit').onclick = async () => {
  if (!selected || selected.owner) return;
  let owner;
  try { owner = nameOrThrow(); } catch (e) { return; }   // nameOrThrow ya muestra el aviso
  const btn = $('use-credit');
  btn.disabled = true;
  try {
    const r = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + packCode, ...authHeaders() },
      body: JSON.stringify({ lat: selected.south + cfg.size / 2, lng: selected.west + cfg.size / 2, owner, avatar, country, house: chosenHouse })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo reclamar');
    credits = j.credits; updateCreditUi();
    selected.owner = j.owner; selected.avatar = avatar; selected.country = country; selected.since = Date.now();
    selected.house = chosenHouse; selected.mine = !!authToken;
    showPanel(selected);
    setMsg(`¡Listo! Es tuyo. Te quedan ${credits} terrenos 🎉`, 'ok'); sfx('claim');
    drawOwned({ id: selected.id, x: selected.x, y: selected.y, owner: selected.owner, avatar: selected.avatar, country: selected.country, house: selected.house });
    loadStats(); loadParcels(); loadProduction();
  } catch (e) {
    setMsg(e.message, 'err'); sfx('error');
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
  const box = $('daily-days');
  box.replaceChildren();
  d.rewards.forEach((n, i) => {
    const done = i < d.dayInCycle, today = d.canClaim && i === d.dayInCycle;
    const cell = document.createElement('div');
    cell.style.cssText = 'text-align:center;padding:6px 2px;border-radius:8px;border:1px solid var(--line);font-size:12px;white-space:pre-line;'
      + (done ? 'background:var(--accent);color:#fff;' : '') + (today ? 'outline:2px solid #ffb703;' : '');
    cell.textContent = `Día ${i + 1}\n${done ? '✅' : '🎟️'}\n+${n}`;
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
function nameOrThrow() {
  const n = $('name').value.replace(/\s+/g, ' ').trim();
  if (n.length < 2) { setMsg('Escribe tu nombre (mínimo 2 letras) antes de pagar', 'err'); throw new Error('nombre'); }
  return n;
}
async function createOrder() {
  const o = await api('/api/packs/orders', { method: 'POST', body: {} });
  return o.orderId;
}
async function captureOrder(orderId) {
  const r = await api(`/api/packs/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', body: {} });
  saveCode(r.code); credits = r.credits; updateCreditUi();
  setMsg(`¡Pack comprado! Tienes ${credits} terrenos. Guarda tu código 🔑`, 'ok'); sfx('claim');
}
function fail(e) { if (e.message !== 'nombre') setMsg(e.message, 'err'); }

function loadPaypalSdk() {
  if (paypalLoaded) return paypalLoaded;
  paypalLoaded = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=${cfg.currency}&intent=capture`;
    s.onload = ok; s.onerror = () => ko(new Error('No se pudo cargar PayPal'));
    document.head.appendChild(s);
  });
  return paypalLoaded;
}
async function renderPaypal() {
  try {
    await loadPaypalSdk();
    paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'pay', height: 30 },
      createOrder: () => createOrder().catch(e => { fail(e); throw e; }),
      onApprove: data => captureOrder(data.orderID).catch(fail),
      onError: e => setMsg('Error con PayPal: ' + (e.message || e), 'err'),
    }).render('#paypal-box');
  } catch (e) { setMsg(e.message, 'err'); }
}
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
    s.top.forEach(t => { const li = document.createElement('li'); li.textContent = `${flagOf(t.country) ? flagOf(t.country) + ' ' : ''}${t.owner} — ${t.n}`; ol.appendChild(li); });
    if (!s.top.length) ol.textContent = 'Aún no hay propietarios. ¡Sé el primero!';
    const oc = $('rank-countries'); oc.replaceChildren();
    (s.countries || []).forEach(c => { const li = document.createElement('li'); li.textContent = `${flagOf(c.country)} ${countryName(c.country)} — ${c.n}`; oc.appendChild(li); });
    if (!(s.countries || []).length) oc.textContent = 'Aún no hay países. Elige el tuyo al reclamar un terreno.';
  } catch {}
}
$('rank-btn').onclick = () => { loadStats(); $('rank').classList.remove('hidden'); };
$('rank-close').onclick = () => $('rank').classList.add('hidden');
$('locate').onclick = () => {
  if (!navigator.geolocation) return alert('Tu navegador no permite geolocalización');
  navigator.geolocation.getCurrentPosition(
    pos => { const ll = L.latLng(pos.coords.latitude, pos.coords.longitude); map.flyTo(ll, 18); map.once('moveend', () => selectAt(ll)); },
    () => alert('No se pudo obtener tu ubicación. Revisa los permisos del navegador.'),
    { enableHighAccuracy: true, timeout: 10000 });
};

// ---------- Cuenta (Google o email con contraseña) ----------
const loginRequired = () => !!(cfg && cfg.auth && cfg.auth.required);
const needLoginToBuy = () => loginRequired() && !authToken;
const needLoginForDaily = () => loginRequired() && !authToken && !packCode;

// El apodo vive en el servidor (tabla profiles) y no se puede cambiar una vez fijado
const nickOf = () => myNick || '';
function applyNick() {
  const nm = $('name'), n = nickOf();
  if (!nm) return;
  if (n) { nm.value = n; nm.readOnly = true; } else nm.readOnly = false;
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
  if (!on) return;
  const logged = !!authToken;
  $('mine-btn').classList.toggle('hidden', !logged);
  $('account-btn').textContent = '👤';
  $('account-btn').title = logged ? 'Mi cuenta' : 'Entrar';
  $('account-btn').setAttribute('aria-label', logged ? 'Mi cuenta' : 'Entrar');
  $('login-out').classList.toggle('hidden', logged);
  $('login-in').classList.toggle('hidden', !logged);
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
  if (cfg.demo) $('demo-pay').classList.toggle('hidden', gate);
  if (dailyState) renderDaily();
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
$('login-google').onclick = async () => {
  if (!sb) return setLoginMsg('El login no está disponible ahora mismo', 'err');
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
    ? `⏱️ Tienes ${n} ${plural(n, 'terreno', 'terrenos')}: producen ${prod.perHour.toLocaleString('es-ES', { maximumFractionDigits: 4 })} créditos por hora. Se acumulan hasta ${prod.capHours} h, ¡recógelos antes de que se llene!`
    : 'Aún no tienes terrenos con producción. Reclama uno y empezará a producir créditos.';
  setProd(prod); renderLive();
  $('mine-count').textContent = mine.total > mine.parcels.length ? `Mostrando los ${mine.parcels.length} más recientes de ${mine.total}.` : (mine.total ? `${mine.total} ${plural(mine.total, 'terreno', 'terrenos')} en total.` : '');
  const box = $('mine-list'); box.replaceChildren();
  mine.parcels.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = 'display:block;width:100%;text-align:left;margin:6px 0;padding:10px';
    b.textContent = `${flagOf(p.country)} ${p.avatar || ''} Terreno ${p.id} · ${new Date(p.since).toLocaleDateString('es-ES')}`.trim();
    b.onclick = () => {
      $('mine').classList.add('hidden');
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

  if (adminViewEnabled()) setupAdminControls();

  if (cfg.demo) $('demo-pay').classList.remove('hidden');
  else renderPaypal();

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
})();


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
