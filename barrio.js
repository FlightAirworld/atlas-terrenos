'use strict';
// Tu barrio 🔴 (solo en la Tierra): solo se pueden reclamar terrenos dentro del círculo rojo parpadeante que rodea al jugador.
//   · El centro del círculo es la ubicación real del jugador (GPS del móvil, navigator.geolocation.watchPosition) y mide cfg.barrioM metros de radio
//     (variable BARRIO_M en el servidor; por defecto 500; con BARRIO_M=0 se desactiva todo esto).
//   · Cuando el jugador se mueve de verdad, el círculo se mueve con él y, si el mapa estaba con él, el mapa se desliza hasta su nueva posición:
//     como el muñeco está fijo en el centro del mapa y camina cuando el mapa se mueve (jugador.js), el muñeco camina. Así puede reclamar en más sitios,
//     siempre dentro del círculo rojo.
//   · Fuera del círculo, el botón «Reclamar terreno» queda apagado («📍 Fuera de tu barrio»). El servidor lo vuelve a comprobar en /api/claim con la
//     posición que manda el cliente (BARRIO_M + BARRIO_SLACK_M de margen para la imprecisión del GPS).
//   · En la Luna, Marte y el resto de mundos no hay límite.
// Este fichero lo cargan el navegador y el servidor (las funciones de abajo son las mismas en los dos).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.barrio = factory(root);
})(typeof self !== 'undefined' ? self : this, function (W) {
  const M_LAT = 111320;                                          // metros por grado de latitud
  const rad = d => d * Math.PI / 180;
  // Distancia en metros entre dos puntos (Haversine)
  function distM(lat1, lng1, lat2, lng2) {
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  // Los puntos [lng, lat] de un círculo de `r` metros alrededor de un punto (para dibujarlo en el mapa)
  function circle(lat, lng, r, n = 72) {
    const dLat = r / M_LAT, dLng = r / (M_LAT * Math.max(0.01, Math.cos(rad(lat))));
    const ring = [];
    for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); }
    ring.push(ring[0].slice());   // el anillo se cierra con el primer punto exacto (GeoJSON)
    return ring;
  }
  const api = { distM, circle };
  if (!W || typeof document === 'undefined') return api;   // en el servidor solo las funciones

  // ---------------- Navegador ----------------
  const radius = () => (typeof cfg !== 'undefined' && cfg && Number(cfg.barrioM)) || 0;
  let pos = null;            // { lat, lng, acc } la última ubicación del jugador
  let asked = false, denied = false, watchId = null;
  const SRC = 'barrio';

  // ¿Se puede reclamar este terreno? p = parcela del servidor ({ south, west, world... }) → { ok, msg }
  function check(p) {
    const r = radius();
    if (!r || !p || (p.world && p.world !== 'tierra')) return { ok: true };
    if (!pos) return { ok: false, msg: denied ? '📍 Permite tu ubicación para reclamar' : '📍 Buscando tu ubicación…' };
    const size = (typeof cfg !== 'undefined' && cfg && cfg.size) || 0.00025;
    const lat = Number.isFinite(p.south) ? p.south + size / 2 : pos.lat, lng = Number.isFinite(p.west) ? p.west + size / 2 : pos.lng;
    const d = distM(pos.lat, pos.lng, lat, lng);
    if (d > r) return { ok: false, msg: `🔴 A ${Math.round(d)} m: fuera de tu barrio`, dist: d };
    return { ok: true, dist: d };
  }
  // Pide (o vuelve a pedir) la ubicación; la usa el botón de reclamar si todavía no hay
  function ask() {
    return new Promise(res => {
      if (!navigator.geolocation) { denied = true; return res(null); }
      navigator.geolocation.getCurrentPosition(p => { onPos(p); res(pos); }, () => { denied = true; res(null); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
    });
  }

  // --- el círculo rojo parpadeante ---
  let layersOk = false;
  function ensureLayers() {
    if (layersOk) return true;
    if (typeof glReady === 'undefined' || !glReady || typeof gl === 'undefined' || !gl.getStyle) return false;
    try {
      if (!gl.getSource(SRC)) gl.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      if (!gl.getLayer('barrio-line')) gl.addLayer({ id: 'barrio-line', type: 'line', source: SRC, paint: { 'line-color': '#ff1f1f', 'line-width': 5, 'line-opacity': 1 } });
      layersOk = true;
    } catch (e) { return false; }
    return true;
  }
  function drawCircle() {
    if (!ensureLayers() || !pos || !radius()) return;
    try { gl.getSource(SRC).setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(pos.lat, pos.lng, radius())] } }); } catch (e) {}
  }
  let on = false;
  const still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  setInterval(() => {   // parpadeo: del rojo vivo al rojo suave (sin movimiento si el sistema pide menos animación)
    if (!layersOk) { if (pos) drawCircle(); return; }
    try {
      const show = !!pos && !!radius() && gl.getZoom() >= 12 && !document.body.classList.contains('en-mundo');
      const v = show ? 'visible' : 'none';
      if (gl.getLayoutProperty('barrio-line', 'visibility') !== v) { gl.setLayoutProperty('barrio-line', 'visibility', v); }
      if (!show) return;
      on = !on;
      gl.setPaintProperty('barrio-line', 'line-opacity', still || on ? 1 : 0.15);   // solo parpadea la franja exterior (sin relleno)
    } catch (e) {}
  }, 450);

  // --- seguir al jugador: el mapa se desliza a su nueva posición y el muñeco camina ---
  function onPos(p) {
    const c = p.coords, next = { lat: c.latitude, lng: c.longitude, acc: c.accuracy || 0 };
    const prev = pos; pos = next; denied = false;
    drawCircle();
    try {
      if (prev && typeof gl !== 'undefined' && typeof glReady !== 'undefined' && glReady) {
        const moved = distM(prev.lat, prev.lng, next.lat, next.lng);
        const mc = gl.getCenter();
        // solo si de verdad se movió (más que el ruido del GPS) y el mapa estaba con él (no lo ha llevado a mirar otro sitio)
        if (moved >= 4 && distM(prev.lat, prev.lng, mc.lat, mc.lng) <= 60 && gl.getZoom() >= 14 && !document.body.classList.contains('en-mundo'))
          gl.easeTo({ center: [next.lng, next.lat], duration: Math.max(600, Math.min(4000, moved * 40)), easing: x => x, essential: true });
      }
    } catch (e) {}
    try { if (typeof updateBuyParcelBtn === 'function') updateBuyParcelBtn(); } catch (e) {}
  }
  function start() {
    if (asked || !radius() || !navigator.geolocation) { if (!navigator.geolocation) denied = true; return; }
    asked = true;
    watchId = navigator.geolocation.watchPosition(onPos, e => { if (!pos) denied = true; try { if (typeof updateBuyParcelBtn === 'function') updateBuyParcelBtn(); } catch (_) {} },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  // cfg llega del servidor un poco después de cargar la página: se espera a tenerlo
  const wait = setInterval(() => { if (typeof cfg === 'undefined' || !cfg) return; clearInterval(wait); if (radius()) start(); }, 400);

  const st = document.createElement('style');
  st.textContent = '#toast.toast-s { width: auto; max-width: 86vw; padding: 6px 14px; border-radius: 99px; font-size: 13px; line-height: 1.25; text-align: center; white-space: nowrap; }' +
    '#buy-parcel-btn.barrio-off { background: #8d2b2b !important; border-color: #8d2b2b !important; opacity: .9; }' +
    '#barrio-go { display: block; width: auto; padding: 6px 14px; font-size: 14px; font-weight: 700; border-radius: 10px; margin: 0; cursor: pointer; color: #fff; background: #1faa4b; border: 1px solid #148a3a; animation: barrioGo 1s infinite ease-in-out; }' +
    '#barrio-go.hidden { display: none !important; }' +
    '@keyframes barrioGo { 0%, 100% { background: #1faa4b; box-shadow: 0 0 0 0 rgba(31,170,75,.6); } 50% { background: #5be07f; box-shadow: 0 0 0 6px rgba(31,170,75,0); } }' +
    '@media (prefers-reduced-motion: reduce) { #barrio-go { animation: none; } }';
  const goBtn = document.getElementById('barrio-go');
  if (goBtn) goBtn.addEventListener('click', () => { const l = document.getElementById('locate'); if (l) l.click(); });   // lleva al jugador a su ubicación (mismo botón de «Mi ubicación»)
  document.head.appendChild(st);

  Object.assign(api, { check, ask, pos: () => pos, radius });
  return api;
});
