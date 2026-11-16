'use strict';
// Capa de compatibilidad Leaflet → MapLibre GL.
// people.js y vehicles.js (y partes de app.js) hablan "Leaflet": zoom de 256 px, project/unproject,
// L.marker + L.divIcon, panes… Este archivo traduce esas llamadas al mapa 3D de MapLibre
// para no tener que reescribirlos. Se carga ANTES de app.js.
(function () {
  const ZOFF = 1;                      // MapLibre usa teselas de 512 px: su zoom = zoom Leaflet - 1
  const toLngLat = ll => Array.isArray(ll) ? [ll[1], ll[0]] : [ll.lng, ll.lat];
  const rad = Math.PI / 180;

  // Ancho (px) con el que el estilo del mapa dibuja las calles (ver MAP_STYLE en app.js: st-road y st-road-casing)
  const ROAD_STOPS = [[11, 0.6], [16, 11], [19, 50]], CASING_STOPS = [[11, 1], [16, 14], [19, 60]];
  const ROAD_M = { motorway: 16, trunk: 14, primary: 12, secondary: 10, tertiary: 9, minor: 7, service: 5 };   // metros (satélite)
  function expo(z, stops, base = 1.6) {                 // interpolación ['exponential', 1.6] de MapLibre
    if (z <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (z <= stops[i][0]) {
        const [z0, v0] = stops[i - 1], [z1, v1] = stops[i];
        return v0 + (v1 - v0) * (Math.pow(base, z - z0) - 1) / (Math.pow(base, z1 - z0) - 1);
      }
    }
    return stops[stops.length - 1][1];
  }

  // ---------- Mini "L" ----------
  const L = {
    point: (x, y) => ({ x, y }),
    latLng: (lat, lng) => ({ lat, lng }),
    divIcon: o => ({ ...o, _div: true }),
    marker(ll, opts = {}) { return new CompatMarker(ll, opts); }
  };

  // ---------- Marcadores (DOM sobre el mapa) ----------
  class CompatMarker {
    constructor(ll, opts) {
      this._ll = { lat: Array.isArray(ll) ? ll[0] : ll.lat, lng: Array.isArray(ll) ? ll[1] : ll.lng };
      this._opts = opts;
      const icon = opts.icon || {};
      const el = document.createElement('div');
      el.className = icon.className || '';
      const sz = icon.iconSize || [0, 0];
      el.style.width = sz[0] + 'px'; el.style.height = sz[1] + 'px';
      if (icon.html instanceof Node) el.appendChild(icon.html); else if (icon.html != null) el.innerHTML = icon.html;
      if (opts.interactive === false) el.style.pointerEvents = 'none';
      this._el = el;
      this._anchor = icon.iconAnchor || [sz[0] / 2, sz[1] / 2];
    }
    addTo(map) {
      this._map = map;
      const pane = map.getPane(this._opts.pane);
      if (pane && pane.style.zIndex) this._el.style.zIndex = pane.style.zIndex;
      this._mk = new maplibregl.Marker({
        element: this._el, anchor: 'top-left', offset: [-this._anchor[0], -this._anchor[1]],
        pitchAlignment: 'viewport', rotationAlignment: 'viewport'
      }).setLngLat([this._ll.lng, this._ll.lat]).addTo(map.gl);
      return this;
    }
    setLatLng(ll) { this._ll = { lat: ll.lat, lng: ll.lng }; if (this._mk) this._mk.setLngLat([ll.lng, ll.lat]); return this; }
    getLatLng() { return this._ll; }
    getElement() { return this._el; }
    remove() { if (this._mk) { this._mk.remove(); this._mk = null; } return this; }
  }

  // ---------- Mapa con la API de Leaflet que usa el juego ----------
  function createCompatMap(gl) {
    const panes = {};
    let roadsOn = false;
    const roadUsers = new Set();
    const worldPx = z => 256 * Math.pow(2, z);
    function withSynth(out) {
      if (!window.synthRoadLines) return out;
      let synth;
      try {
        const b = gl.getBounds(), pl = (b.getEast() - b.getWest()) * 0.5, pa = (b.getNorth() - b.getSouth()) * 0.5;
        synth = window.synthRoadLines(b.getWest() - pl, b.getEast() + pl, b.getSouth() - pa, b.getNorth() + pa);
      } catch (e) { return out; }
      if (!synth.length) return out;
      const sy = synth.map(l => ({ lat: l[0][1], w: l[0][0], e: l[1][0], xs: [] })), res = [];
      const TOL = 4 / 111320;      // ~4 m en grados: una calle real que acaba tan cerca de la horizontal (o encima) se empalma con ella
      out.forEach(c => {
        [0, c.length - 1].forEach(idx => {   // calle real que termina tocando la horizontal (cruce en T): el extremo se pega a la línea
          const q = c[idx], nb = c[idx === 0 ? 1 : c.length - 2];
          if (!q || !nb) return;
          for (const s of sy) {
            const d = Math.abs(q[1] - s.lat);
            if (d <= TOL && Math.abs(nb[1] - s.lat) > d && q[0] >= s.w && q[0] <= s.e) { c[idx] = [q[0], s.lat]; s.xs.push(q[0]); break; }
          }
        });
        const cuts = [];
        for (let i = 0; i + 1 < c.length; i++) {
          const a = c[i], b = c[i + 1];
          for (const s of sy) {
            if ((a[1] - s.lat) * (b[1] - s.lat) < 0) {
              const t = (s.lat - a[1]) / (b[1] - a[1]), x = a[0] + (b[0] - a[0]) * t;
              if (x >= s.w && x <= s.e) { cuts.push({ i, t, x, lat: s.lat }); s.xs.push(x); }
            }
          }
        }
        if (!cuts.length) { res.push(c); return; }
        cuts.sort((p, q) => p.i - q.i || p.t - q.t);
        const keep = part => { if (part.length >= 2) { part.cls = c.cls; part.ow = c.ow; res.push(part); } };
        let cur = [c[0]], k = 0;
        for (let i = 0; i + 1 < c.length; i++) {
          while (k < cuts.length && cuts[k].i === i) { const pt = [cuts[k].x, cuts[k].lat]; cur.push(pt); keep(cur); cur = [pt]; k++; }
          cur.push(c[i + 1]);
        }
        keep(cur);
      });
      sy.forEach(s => {
        const xs = [s.w, ...s.xs.sort((p, q) => p - q), s.e];
        for (let i = 0; i + 1 < xs.length; i++) {
          if (xs[i + 1] - xs[i] < 1e-9) continue;
          const seg = [[xs[i], s.lat], [xs[i + 1], s.lat]]; seg.cls = 'minor'; seg.ow = 0; res.push(seg);
        }
      });
      return res;
    }
    const api = {
      gl,
      getContainer: () => gl.getContainer(),
      getZoom: () => gl.getZoom() + ZOFF,
      getSize: () => { const c = gl.getContainer(); return { x: c.clientWidth, y: c.clientHeight }; },
      getCenter: () => { const c = gl.getCenter(); return { lat: c.lat, lng: c.lng }; },
      flyTo(ll, z, o) { gl.flyTo({ center: toLngLat(ll), zoom: (z == null ? api.getZoom() : z) - ZOFF, essential: true, ...(o && o.duration ? { duration: o.duration } : {}) }); return api; },   // o.duration (ms) opcional: vuelo más lento
      setView(ll, z) { gl.jumpTo({ center: toLngLat(ll), zoom: (z == null ? api.getZoom() : z) - ZOFF }); return api; },
      on(ev, fn) {
        if (ev === 'click') gl.on('click', e => fn({ latlng: { lat: e.lngLat.lat, lng: e.lngLat.lng }, point: e.point, originalEvent: e.originalEvent }));
        else gl.on(ev, fn);
        return api;
      },
      once(ev, fn) { gl.once(ev, fn); return api; },
      createPane(name) { return (panes[name] = document.createElement('div')); },
      getPane: name => panes[name],
      removeLayer(l) { if (l && l.remove) l.remove(); return api; },

      // Coordenadas "de mundo" en píxeles a un zoom dado (y crece hacia el sur), como Leaflet
      project(ll, z) {
        const s = worldPx(z), lat = Math.max(-85.0511, Math.min(85.0511, ll.lat));
        return { x: (ll.lng + 180) / 360 * s, y: (0.5 - Math.log(Math.tan(Math.PI / 4 + lat * rad / 2)) / (2 * Math.PI)) * s };
      },
      unproject(pt, z) {
        const s = worldPx(z);
        return { lng: pt.x / s * 360 - 180, lat: (2 * Math.atan(Math.exp((0.5 - pt.y / s) * 2 * Math.PI)) - Math.PI / 2) / rad };
      },
      // Punto de pantalla → coordenadas, tratando el mapa como plano (sin inclinación) para que
      // las personas y los coches aparezcan por los bordes aunque el mapa esté inclinado.
      containerPointToLatLng(p) {
        const pt = Array.isArray(p) ? { x: p[0], y: p[1] } : p;
        const z = api.getZoom(), size = api.getSize(), c = api.project(api.getCenter(), z);
        const dx = pt.x - size.x / 2, dy = pt.y - size.y / 2, b = gl.getBearing() * rad;
        return api.unproject({ x: c.x + dx * Math.cos(b) - dy * Math.sin(b), y: c.y + dx * Math.sin(b) + dy * Math.cos(b) }, z);
      },
      latLngToContainerPoint(ll) { const p = gl.project(toLngLat(ll)); return { x: p.x, y: p.y }; },
      // Calles reales (teselas vectoriales de OpenFreeMap). La capa está apagada hasta que alguien la pide
      // (coches 'v' o peatones 'p'); se mantiene encendida mientras la pida al menos uno.
      setRoads(on, who = 'v') {
        try {
          if (on) roadUsers.add(who); else roadUsers.delete(who);
          const want = roadUsers.size > 0;
          if (want === roadsOn || !gl.getLayer('roads-q')) return;
          roadsOn = want; gl.setLayoutProperty('roads-q', 'visibility', want ? 'visible' : 'none');
        } catch (e) {}
      },
      queryRoads() {
        try {
          if (!roadsOn || !gl.getLayer('roads-q')) return [];
          const out = [];
          gl.queryRenderedFeatures({ layers: ['roads-q'] }).forEach(f => {
            const g = f.geometry, cls = f.properties && f.properties.class, o = f.properties && f.properties.oneway;
            const ow = (o === 1 || o === '1' || o === 'yes' || o === true) ? 1 : (o === -1 || o === '-1') ? -1 : 0;   // sentido único: 1 = en el orden de los puntos, -1 = al revés, 0 = doble sentido
            const add = c => { const a = c.slice(); a.cls = cls; a.ow = ow; out.push(a); };     // cls: clase de la calle (para saber su ancho)
            if (g.type === 'LineString') add(g.coordinates);
            else if (g.type === 'MultiLineString') g.coordinates.forEach(add);
          });
          return withSynth(out);
        } catch (e) { return []; }
      },
      // ---------- Ancho real de las calles en pantalla ----------
      // Coches y peatones se colocan con esto: el carril y la acera salen del ancho con el que se DIBUJA la calle
      // (mapa estilizado: las mismas curvas de ancho que usa el estilo; satélite: metros reales por tipo de calle).
      pxPerM() {
        const lat = gl.getCenter().lat * rad;
        return Math.pow(2, api.getZoom()) * 256 / (40075016.686 * Math.max(0.05, Math.cos(lat)));
      },
      // { half: mitad del ancho de la calzada, curb: distancia del eje al centro de la acera } en px de pantalla
      roadMetrics(cls) {
        let sat = false;
        try { sat = gl.getLayer('sat') && gl.getLayoutProperty('sat', 'visibility') === 'visible'; } catch (e) {}
        if (sat) {
          const m = ROAD_M[cls] || 7, k = api.pxPerM();
          return { half: m / 2 * k, curb: (m / 2 + 1.6) * k };
        }
        const z = gl.getZoom();
        return { half: expo(z, ROAD_STOPS) / 2, curb: expo(z, CASING_STOPS) / 2 + 1 };
      },
      // Tamaños que mantienen las proporciones REALES: el coche ocupa ~1/3 de la calzada (1,8 m de ancho)
      // y el peatón (1,75 m de alto) mide casi lo mismo que el ANCHO del coche, o sea ~0,4 de la longitud de un coche.
      // El cuerpo dibujado de la persona mide ~22,5 px (a fp=1) y el coche 18 px de ancho (a fv=1): de ahí el 0,78.
      sizes() {
        const w = api.roadMetrics('minor').half * 2;
        const fv = Math.max(0.36, Math.min(1.5, w * 0.36 / 18));
        return { fv, fp: Math.max(0.28, Math.min(1.17, fv * 0.78)) };
      },
      getBounds() {
        // Con inclinación el rectángulo visible puede ser enorme: lo limitamos alrededor del centro
        const b = gl.getBounds(), c = gl.getCenter(), cap = 0.04;
        const s = Math.max(b.getSouth(), c.lat - cap), n = Math.min(b.getNorth(), c.lat + cap);
        const w = Math.max(b.getWest(), c.lng - cap), e = Math.min(b.getEast(), c.lng + cap);
        const mk = (s, w, n, e) => ({
          getSouth: () => s, getNorth: () => n, getWest: () => w, getEast: () => e,
          contains: ll => ll.lat >= s && ll.lat <= n && ll.lng >= w && ll.lng <= e,
          pad(r) { const dy = (n - s) * r, dx = (e - w) * r; return mk(s - dy, w - dx, n + dy, e + dx); }
        });
        return mk(s, w, n, e);
      }
    };
    return api;
  }

  window.L = L;
  window.createCompatMap = createCompatMap;
})();

// ---------- Casas por DEBAJO de las calles (estilos «estilizado» y «verde») ----------
// Antes las fotos de las casas se dibujaban encima de todo y a cada una se le «borraba» la calle con turf + un canvas
// (app.js: roadAreaFor / clippedPhoto). Ahora, salvo en satélite, las casas se insertan justo debajo de las capas de
// aeropuerto, calles y vías del propio mapa: el mapa dibuja la calle encima de la casa y no hace falta recortar nada.
// En satélite no hay calles dibujadas, así que ahí se conserva el recorte de siempre.
// Para comparar con lo de antes: abrir el juego con ?capas=0 al final de la dirección.
(function () {
  let off = false;
  try { off = new URLSearchParams(location.search).get('capas') === '0'; } catch (e) {}
  if (off || !window.maplibregl || !maplibregl.Map || window.__capasCalles) return;
  window.__capasCalles = true;
  const FLAT_ANCHOR = 'st-aero-fill';   // primera capa del mapa que va por ENCIMA de las casas (después vienen pistas, calles y vías)
  const isSat = () => { try { return baseMode === 'satelite'; } catch (e) { return false; } };
  const isHouse = id => id === 'owned-flat' || /^img-/.test(id || '');
  // Dónde van las casas ahora mismo en este mapa (undefined = no tocar: satélite, o no es el mapa principal)
  const anchorOf = m => (isSat() || !m.getLayer(FLAT_ANCHOR)) ? undefined : FLAT_ANCHOR;
  // Los edificios beige del mapa quedan DEBAJO de las casas (antes las casas ya iban por encima de ellos)
  function buildingsDown(m) {
    try { if (m.getLayer('st-buildings') && m.getLayer(FLAT_ANCHOR)) m.moveLayer('st-buildings', FLAT_ANCHOR); } catch (e) {}
  }
  const addLayer = maplibregl.Map.prototype.addLayer;
  maplibregl.Map.prototype.addLayer = function (layer, before) {
    try {
      if (layer && isHouse(layer.id)) {
        const a = anchorOf(this);
        if (a) { buildingsDown(this); before = a; }
      }
    } catch (e) {}
    return addLayer.call(this, layer, before);
  };
  // Recoloca las casas ya dibujadas: debajo de las calles, o encima de todo en satélite
  function placeAll() {
    try {
      const m = gl;   // mapa principal (app.js)
      if (!m || !m.getLayer('wt-water')) return;
      const target = isSat() ? 'wt-water' : FLAT_ANCHOR;
      if (!m.getLayer(target)) return;
      if (!isSat()) buildingsDown(m);
      m.getStyle().layers.map(l => l.id).filter(id => id === 'owned-far' || isHouse(id)).forEach(id => m.moveLayer(id, target));
    } catch (e) {}
  }
  // Los recortes de calle (turf + canvas) solo hacen falta en satélite: al cambiar de estilo se restauran o se recalculan
  function afterModeChange() {
    placeAll();
    try {
      if (!isSat()) {
        for (const ex of drawn.values()) {
          const c = roadCut.get(ex.p.id);
          if (!(c && c.road)) continue;
          const f = ownedFeatures.get(ex.p.id);
          if (f) f.geometry = { type: 'Polygon', coordinates: [ringOf(ex.p.x, ex.p.y)] };
          roadCut.set(ex.p.id, { road: null, rest: null });
          refreshPhoto(ex);
        }
        flushOwned();
      } else { roadCut.clear(); queueCuts(); }
    } catch (e) {}
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#base-btn')) setTimeout(afterModeChange, 0); });
  // app.js se carga después de este archivo: cuando ya está cargado, fuera de satélite roadAreaFor no recorta nada
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.roadAreaFor !== 'function') return;
    const orig = window.roadAreaFor;
    window.roadAreaFor = p => isSat() ? orig(p) : { road: null, rest: null };
    afterModeChange();
  });
})();
