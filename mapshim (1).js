'use strict';
// Capa de compatibilidad Leaflet → MapLibre GL.
// people.js y vehicles.js (y partes de app.js) hablan "Leaflet": zoom de 256 px, project/unproject,
// L.marker + L.divIcon, panes… Este archivo traduce esas llamadas al mapa 3D de MapLibre
// para no tener que reescribirlos. Se carga ANTES de app.js.
(function () {
  const ZOFF = 1;                      // MapLibre usa teselas de 512 px: su zoom = zoom Leaflet - 1
  const toLngLat = ll => Array.isArray(ll) ? [ll[1], ll[0]] : [ll.lng, ll.lat];
  const rad = Math.PI / 180;

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
    const api = {
      gl,
      getContainer: () => gl.getContainer(),
      getZoom: () => gl.getZoom() + ZOFF,
      getSize: () => { const c = gl.getContainer(); return { x: c.clientWidth, y: c.clientHeight }; },
      getCenter: () => { const c = gl.getCenter(); return { lat: c.lat, lng: c.lng }; },
      flyTo(ll, z) { gl.flyTo({ center: toLngLat(ll), zoom: (z == null ? api.getZoom() : z) - ZOFF, essential: true }); return api; },
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
            const g = f.geometry;
            const cls = f.properties && f.properties.class;      // tipo de calle: da su ancho real (coches y peatones van justo por su sitio)
            if (g.type === 'LineString') { g.coordinates.cls = cls; out.push(g.coordinates); }
            else if (g.type === 'MultiLineString') g.coordinates.forEach(c => { c.cls = cls; out.push(c); });
          });
          return out;
        } catch (e) { return []; }
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
