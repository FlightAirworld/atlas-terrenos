'use strict';
// PREHISTORIA, un mundo a 4.200 años luz de la Tierra donde aún mandan los dinosaurios.
// Este archivo pinta el mundo encima del mapa que abre mundos.js (evento «mundo:map»):
//  - el terreno (lagos, ríos, pantanos, selva, montañas y un volcán humeante), calculado al vuelo por prehistoria-terreno.js;
//  - los árboles de la época (palmeras, cícadas, helechos gigantes, araucarias, colas de caballo);
//  - la fauna (prehistoria-dibujos.js): dinosaurios que pasean y CAZAN (los grandes persiguen a los pequeños, que huyen; el triceratops planta cara al T-Rex),
//    reptavoladores que sobrevuelan y se lanzan a por su presa, un plesiosaurio en el lago y bichos gigantes, todos con su sonido (voices.js);
//  - el volcán, que echa humo y de vez en cuando entra en erupción.
// Solo se ve de cerca (zoom 14,6 o más). La fauna se apaga con el botón 🚶 (el mismo de la gente de la Tierra). Para probar en la consola: prehistoriaRugido().
(function () {
  const PT = window.PrehistoriaTerreno, DR = window.PrehistoriaDibujos;
  if (!PT || !DR || !window.maplibregl) return;
  const ID = 'prehistoria', MC = maplibregl.MercatorCoordinate, SMALL = Math.min(innerWidth, innerHeight) < 600;
  const REF_Z = 16.2, U = 1 / (512 * Math.pow(2, REF_Z)), MIN_Z = 14.6;   // U = un píxel (al zoom 16,2) en unidades de Mercator
  const peopleBtn = document.getElementById('people-btn');
  const isOn = () => !peopleBtn || peopleBtn.getAttribute('aria-pressed') !== 'false';
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const llOf = (x, y) => new MC(x, clamp(y, 0.0001, 0.9999), 0).toLngLat();
  const mOf = (lng, lat) => { const c = MC.fromLngLat({ lng, lat }); return { x: c.x, y: c.y }; };
  const classM = (x, y, oct) => { const l = llOf(x, y); return PT.classAt(l.lng, l.lat, oct || 12); };
  const landM = (x, y) => { const c = classM(x, y); return c > PT.C.RIVER && c !== PT.C.LAVA && c !== PT.C.PEAK; };   // donde pueden pisar los animales
  const waterM = (x, y) => { const c = classM(x, y); return c === PT.C.WATER || c === PT.C.DEEP; };
  const div = (cls, html) => { const d = document.createElement('div'); if (cls) d.className = cls; if (html) d.innerHTML = html; return d; };
  const playerName = () => { try { return (window.atlasPlayerName && window.atlasPlayerName()) || ''; } catch (e) { return ''; } };

  // ---------- Estilos ----------
  const st = document.createElement('style');
  st.textContent = `
    .pr-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
    .pr-layer.off { display: none; }
    .pr-e { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; pointer-events: none; transition: opacity .5s; }
    .pr-sp { position: absolute; left: 0; top: 0; transform: translate(-50%, -93%); transform-origin: 50% 93%; pointer-events: none; }
    .pr-e.air .pr-sp { transform: translate(-50%, -55%); }
    .pr-sp svg { display: block; overflow: visible; }
    .pr-leg { transform-box: fill-box; transform-origin: 50% 0; animation: prstep .5s ease-in-out infinite alternate; }
    .pr-leg.b { animation-direction: alternate-reverse; }
    .pr-e.still .pr-leg { animation: none; }
    .pr-e.fast .pr-leg { animation-duration: .24s; }
    .pr-e.walk .pr-sp svg, .pr-e.fast .pr-sp svg { animation: prbob .5s ease-in-out infinite alternate; }
    .pr-e.fast .pr-sp svg { animation-duration: .24s; }
    .pr-e.eat .pr-sp svg { animation: prchew .45s ease-in-out infinite alternate; transform-origin: 30% 100%; }
    .pr-e.fight .pr-sp svg { animation: prfight .25s ease-in-out infinite alternate; }
    .pr-wing { transform-box: fill-box; transform-origin: 50% 100%; animation: prflap .42s ease-in-out infinite alternate; }
    .pr-wing.far { animation-delay: -.15s; opacity: .85; }
    .pr-e.bug .pr-wing { animation-duration: .07s; transform-origin: 50% 50%; }
    .pr-neck { transform-box: fill-box; transform-origin: 15% 100%; animation: prneck 3.4s ease-in-out infinite alternate; }
    .pr-e.dive .pr-sp svg { transform: rotate(24deg); }
    .pr-e.sub { opacity: .25; }
    .pr-sh { position: absolute; left: 0; top: 0; width: 70px; height: 20px; margin: -10px 0 0 -35px; border-radius: 50%; background: rgba(0,0,0,.28); pointer-events: none; will-change: transform; }
    .pr-b { position: absolute; left: 0; top: 0; max-width: 190px; padding: 6px 10px; border-radius: 14px; background: #fff8e1; color: #3a2a12; font: 800 12px/1.25 system-ui, sans-serif; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,.4); pointer-events: none; opacity: 0; transition: opacity .25s; z-index: 99999; }
    .pr-b.on { opacity: 1; }
    .pr-b.fact { font-weight: 600; font-style: italic; background: #eef7e0; max-width: 220px; }
    .pr-b::after { content: ''; position: absolute; left: 50%; bottom: -6px; margin-left: -6px; border: 6px solid transparent; border-bottom: 0; border-top-color: #fff8e1; }
    .pr-b.fact::after { border-top-color: #eef7e0; }
    .pr-puff { position: absolute; left: 0; top: 0; width: 50px; height: 50px; margin: -25px 0 0 -25px; border-radius: 50%; background: radial-gradient(#fff 0, rgba(255,255,255,.7) 40%, rgba(255,255,255,0) 70%); pointer-events: none; animation: prpuff .9s ease-out forwards; }
    .pr-volc { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; will-change: transform; transform-origin: 0 0; z-index: 5; }
    .pr-volc.off { display: none; }
    .pr-volc i { position: absolute; left: 0; top: 0; width: 70px; height: 70px; border-radius: 50%; background: radial-gradient(circle at 40% 40%, #8a837c 0, #4b4642 55%, rgba(60,55,52,0) 72%); opacity: 0; animation: prsmoke 8s linear infinite; }
    .pr-volc i:nth-child(2) { animation-delay: -1.6s; } .pr-volc i:nth-child(3) { animation-delay: -3.2s; } .pr-volc i:nth-child(4) { animation-delay: -4.8s; } .pr-volc i:nth-child(5) { animation-delay: -6.4s; }
    .pr-volc b { position: absolute; left: -26px; top: -22px; width: 52px; height: 44px; border-radius: 50%; background: radial-gradient(#ffb23d 0, rgba(255,110,20,.55) 45%, rgba(255,80,0,0) 72%); animation: prglow 1.8s ease-in-out infinite alternate; mix-blend-mode: screen; }
    .pr-volc.erupt i { animation-duration: 3.2s; background: radial-gradient(circle at 40% 40%, #c9732b 0, #5a3a28 50%, rgba(60,55,52,0) 72%); }
    .pr-volc.erupt b { width: 90px; height: 80px; left: -45px; top: -40px; }
    @keyframes prstep { from { transform: rotate(-24deg); } to { transform: rotate(24deg); } }
    @keyframes prbob { from { transform: translateY(0); } to { transform: translateY(-2.2px); } }
    @keyframes prchew { from { transform: rotate(0); } to { transform: rotate(5deg) translateY(2px); } }
    @keyframes prfight { from { transform: translateX(-3px) rotate(-3deg); } to { transform: translateX(3px) rotate(3deg); } }
    @keyframes prflap { from { transform: scaleY(1); } to { transform: scaleY(-.45); } }
    @keyframes prneck { from { transform: rotate(-7deg); } to { transform: rotate(8deg); } }
    @keyframes prpuff { from { transform: scale(.3); opacity: 1; } to { transform: scale(2.4); opacity: 0; } }
    @keyframes prsmoke { 0% { transform: translate(-50%, -50%) scale(.25); opacity: 0; } 12% { opacity: .75; } 100% { transform: translate(calc(-50% + 55px), calc(-50% - 210px)) scale(3.2); opacity: 0; } }
    @keyframes prglow { from { opacity: .55; transform: scale(.9); } to { opacity: 1; transform: scale(1.12); } }
    @media (prefers-reduced-motion: reduce) { .pr-leg, .pr-wing, .pr-neck, .pr-sp svg, .pr-volc i, .pr-volc b { animation: none !important; } .pr-volc i { opacity: .35; } }`;
  document.head.appendChild(st);

  // ---------- Árboles: dibujos en canvas, uno de cada tipo ----------
  const TREES = ['palmera', 'cicada', 'helecho-arbol', 'araucaria', 'helecho', 'cola-caballo'];
  function frond(c, x, y, ang, len, wid, col, droop) {
    c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(len * 0.3, -wid, len * 0.7, -wid + (droop || 0), len, (droop || 0) * 1.5);
    c.bezierCurveTo(len * 0.7, wid * 0.4 + (droop || 0), len * 0.3, wid * 0.5, 0, 0); c.fill(); c.restore();
  }
  function drawTree(k) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(32, 60, 17, 4.5, 0, 0, 7); c.fill();
    const trunk = (x0, y0, x1, y1, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + 3, (y0 + y1) / 2, x1, y1); c.stroke(); };
    if (k === 0) { trunk(32, 60, 37, 26, 4.4, '#7b5a36'); [-2.9, -2.4, -1.9, -1.3, -0.75, -0.25, 0.2].forEach((a, i) => frond(c, 37, 26, a, 23, 5, i % 2 ? '#2f8a3c' : '#43a24a', 9)); c.fillStyle = '#6b4a28'; c.beginPath(); c.arc(36, 28, 2.2, 0, 7); c.fill(); }
    else if (k === 1) { c.fillStyle = '#6e4d2c'; c.beginPath(); c.roundRect ? c.roundRect(27, 40, 11, 20, 4) : c.rect(27, 40, 11, 20); c.fill(); c.strokeStyle = '#4f361d'; c.lineWidth = 1.2; for (let y = 44; y < 60; y += 4) { c.beginPath(); c.moveTo(27, y); c.lineTo(38, y); c.stroke(); } for (let i = 0; i < 9; i++) frond(c, 32.5, 41, -3.0 + i * 0.33, 19, 3.8, i % 2 ? '#2b7a3a' : '#3f9a47', 2); c.fillStyle = '#d9822b'; c.beginPath(); c.ellipse(32.5, 40, 4, 5, 0, 0, 7); c.fill(); }
    else if (k === 2) { trunk(32, 60, 32, 30, 3.4, '#4e3a26'); for (let i = 0; i < 11; i++) frond(c, 32, 30, -3.1 + i * 0.3, 22, 3.2, i % 2 ? '#5fae4a' : '#77c35a', 10); }
    else if (k === 3) { trunk(32, 60, 32, 20, 4.2, '#6a4a2e'); [[46, 13], [38, 17], [30, 21], [22, 25], [14, 29]].forEach((t, i) => { c.fillStyle = i % 2 ? '#2c6a34' : '#3a7f3d'; c.beginPath(); c.ellipse(32, t[0] - 4 + i * 1, t[1], 4.5 - i * 0.2, 0, 0, 7); c.fill(); }); c.fillStyle = '#4a9a48'; c.beginPath(); c.ellipse(32, 17, 6, 3, 0, 0, 7); c.fill(); }
    else if (k === 4) { for (let i = 0; i < 10; i++) frond(c, 32, 57, -3.05 + i * 0.3, 27, 4, ['#3f8f37', '#56a843', '#2e7a30'][i % 3], 9); }
    else { for (let i = 0; i < 6; i++) { const x = 18 + i * 5.6, top = 12 + (i % 3) * 7, bend = (i - 2.5) * 1.6; c.strokeStyle = i % 2 ? '#6f9a3f' : '#86b04f'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(32, 60); c.quadraticCurveTo(x, 40, x + bend, top); c.stroke(); c.lineWidth = 1.4; for (let y = top + 6; y < 54; y += 7) { const u = (y - top) / (60 - top), px = x + bend * (1 - u) * 0.9 + (32 - x) * u * 0.55; c.beginPath(); c.moveTo(px - 4, y - 2); c.lineTo(px, y); c.lineTo(px + 4, y - 2); c.stroke(); } c.fillStyle = '#5a8a30'; c.beginPath(); c.ellipse(x + bend, top - 1, 2, 4, 0, 0, 7); c.fill(); } }
    return c.getImageData(0, 0, 64, 64);
  }
  // 40 m de alto de «juego»: tamaño del dibujo (64 px) según el zoom
  const TREE_SIZE = z => 40 / (40075016 / (512 * Math.pow(2, z)) * 0.985) / 64;

  // ---------- El mundo ----------
  let W = null;
  const volc = PT.SITES.length ? mOf(PT.LAND[0] + PT.VOLCANO.dx, PT.LAND[1] + PT.VOLCANO.dy) : null;

  function init(map) {
    if (W) return;
    const box = document.getElementById('mundo-' + ID); if (!box) return;
    const layer = div('pr-layer'), cv = map.getCanvas(), c = map.getContainer();
    cv.parentNode.insertBefore(layer, cv.nextSibling);
    const v = div('pr-volc off', '<b></b><i></i><i></i><i></i><i></i><i></i>'); layer.appendChild(v);
    W = { map, box, layer, volc: v, w: c.clientWidth, h: c.clientHeight, off: true, ents: [], bubs: [], view: null, viewT: 0, ready: false, want: null, respT: 3, ambT: rnd(4, 9), eruptT: rnd(25, 50), nImg: 0, cur: null, tseq: 0, tkey: '', gurl: null, urls: {}, hunts: 0 };
    map.on('resize', () => { W.w = c.clientWidth; W.h = c.clientHeight; });
    const setup = () => {
      try { TREES.forEach((n, i) => { if (!map.hasImage('pt-' + n)) map.addImage('pt-' + n, drawTree(i)); }); } catch (e) { console.warn('[prehistoria] árboles', e); }
      const before = map.getLayer('grid') ? 'grid' : undefined;
      map.addSource('pt-trees', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      const a = (z, s) => ['*', ['get', 's'], TREE_SIZE(z) * s];
      map.addLayer({ id: 'pt-trees', type: 'symbol', source: 'pt-trees', minzoom: MIN_Z - 0.6,
        layout: { 'icon-image': ['get', 'img'], 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'symbol-z-order': 'source', 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
          'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 14, a(14, 1), 22, a(22, 1)] } }, before);
      W.ready = true; schedule(0);
    };
    if (map.loaded()) setup(); else map.once('load', setup);
    ['moveend', 'zoomend'].forEach(ev => map.on(ev, () => schedule(160)));
  }
  window.addEventListener('mundo:map', e => { if (e.detail.id === ID) init(e.detail.map); });
  if (window.mundoMaps && window.mundoMaps[ID]) init(window.mundoMaps[ID]);

  // ---------- Terreno (imagen que sigue a la pantalla) ----------
  let schT = 0;
  function schedule(ms) { clearTimeout(schT); schT = setTimeout(() => { try { renderTerrain(); updateTrees(); } catch (e) { console.error('[prehistoria] terreno', e); } }, ms); }
  function renderTerrain() {
    if (!W || !W.ready) return;
    const m = W.map, z = m.getZoom();
    let west, south, east, north, N, oct, key;
    if (z < 2.4) { west = -180; east = 180; north = 85.0511; south = -85.0511; N = SMALL ? 384 : 512; oct = 7; key = 'g'; }
    else {
      const b = m.getBounds(), w0 = b.getWest(), e0 = b.getEast(), s0 = b.getSouth(), n0 = b.getNorth(), ex = (e0 - w0) * 0.25, ey = (n0 - s0) * 0.25;
      west = Math.max(-180, w0 - ex); east = Math.min(180, e0 + ex); south = Math.max(-85, s0 - ey); north = Math.min(85, n0 + ey);
      N = z >= 13 ? (SMALL ? 224 : 320) : (SMALL ? 256 : 384); oct = PT.octFor((east - west) / N);
      key = [west, south, east, north].map(v => v.toFixed(5)).join(',');
    }
    if (key === W.tkey) return;
    W.tkey = key; const seq = ++W.tseq, coords = [[west, north], [east, north], [east, south], [west, south]];
    if (key === 'g' && W.gurl) { showImage(W.gurl, coords, true); return; }
    const data = new Uint8ClampedArray(N * N * 4), job = PT.makeJob(data, N, west, south, east, north, oct);
    const run = () => {
      if (seq !== W.tseq) return;
      let done = false; try { done = job.step(12); } catch (e) { console.error('[prehistoria] pintando', e); return; }
      if (!done) { setTimeout(run, 5); return; }
      const cv = document.createElement('canvas'); cv.width = cv.height = N; cv.getContext('2d').putImageData(new ImageData(data, N, N), 0, 0);
      cv.toBlob(bl => { if (!bl || seq !== W.tseq) return; const url = URL.createObjectURL(bl); if (key === 'g') W.gurl = url; showImage(url, coords, key === 'g'); }, 'image/png');
    };
    run();
  }
  function showImage(url, coords, keep) {
    const m = W.map, id = 'pt-img-' + (++W.nImg), before = m.getLayer('pt-trees') ? 'pt-trees' : (m.getLayer('grid') ? 'grid' : undefined);
    m.addSource(id, { type: 'image', url, coordinates: coords });
    m.addLayer({ id, type: 'raster', source: id, paint: { 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, before);
    const old = W.cur; W.cur = { id, url, keep }; let done = false;
    const fin = () => { if (done) return; done = true; m.off('sourcedata', onData); if (!old) return; try { m.removeLayer(old.id); m.removeSource(old.id); } catch (e) {} if (!old.keep) setTimeout(() => URL.revokeObjectURL(old.url), 2000); };
    const onData = e => { if (e.sourceId === id && m.isSourceLoaded(id)) setTimeout(fin, 80); };
    m.on('sourcedata', onData); setTimeout(fin, 1200);
  }
  function updateTrees() {
    if (!W || !W.ready) return;
    const m = W.map, z = m.getZoom(), src = m.getSource('pt-trees'); if (!src) return;
    if (z < MIN_Z - 0.6) { src.setData({ type: 'FeatureCollection', features: [] }); return; }
    const b = m.getBounds(), ex = (b.getEast() - b.getWest()) * 0.18, ey = (b.getNorth() - b.getSouth()) * 0.18;
    const w0 = b.getWest() - ex, e0 = b.getEast() + ex, s0 = b.getSouth() - ey, n0 = b.getNorth() + ey;
    const step = Math.max(0.00028, Math.sqrt((e0 - w0) * (n0 - s0) / 9000));
    const list = PT.trees(w0, s0, e0, n0, step, SMALL ? 1600 : 2800);
    src.setData({ type: 'FeatureCollection', features: list.map(t => ({ type: 'Feature', properties: { img: 'pt-' + TREES[t.k], s: t.s }, geometry: { type: 'Point', coordinates: [t.lon, t.lat] } })) });
  }

  // ---------- Fauna ----------
  const WANT = SMALL
    ? { trex: 1, raptor: 2, compy: 3, galli: 1, parasau: 1, tricer: 1, brachio: 1, ptero: 1, rhampho: 1, libelula: 2, plesio: 1, artropleura: 1 }
    : { trex: 1, allo: 1, raptor: 3, dilo: 1, compy: 4, galli: 2, parasau: 2, tricer: 2, stego: 1, anky: 1, brachio: 1, spino: 1, ptero: 2, quetzal: 1, rhampho: 2, libelula: 3, artropleura: 1, escorpion: 1, plesio: 2 };
  const viewOf = () => {
    const b = W.map.getBounds(), a = MC.fromLngLat(b.getSouthWest()), d = MC.fromLngLat(b.getNorthEast());
    return { x0: Math.min(a.x, d.x), x1: Math.max(a.x, d.x), y0: Math.min(a.y, d.y), y1: Math.max(a.y, d.y) };
  };
  const inView = (v, x, y, m) => { const mx = (v.x1 - v.x0) * m, my = (v.y1 - v.y0) * m; return x > v.x0 - mx && x < v.x1 + mx && y > v.y0 - my && y < v.y1 + my; };
  const randIn = (v, m) => ({ x: rnd(v.x0 + (v.x1 - v.x0) * m, v.x1 - (v.x1 - v.x0) * m), y: rnd(v.y0 + (v.y1 - v.y0) * m, v.y1 - (v.y1 - v.y0) * m) });
  function edgePoint(v) {   // un punto justo fuera de la pantalla: así los animales «llegan» andando
    const k = rnd(0.03, 0.12), side = Math.floor(Math.random() * 4), w = v.x1 - v.x0, h = v.y1 - v.y0;
    return side === 0 ? { x: v.x0 - w * k, y: rnd(v.y0, v.y1) } : side === 1 ? { x: v.x1 + w * k, y: rnd(v.y0, v.y1) } : side === 2 ? { x: rnd(v.x0, v.x1), y: v.y0 - h * k } : { x: rnd(v.x0, v.x1), y: v.y1 + h * k };
  }
  const count = k => W.ents.filter(e => e.k === k && !e.dead).length;

  function spawn(k, atEdge) {
    const d = DR.SP[k], v = W.view || (W.view = viewOf()), fly = DR.FLY.includes(k), water = DR.WATER.includes(k);
    let p = null;
    for (let i = 0; i < 24 && !p; i++) {
      const q = atEdge && !water ? edgePoint(v) : randIn(v, 0.08);
      if (fly || (water ? waterM(q.x, q.y) : landM(q.x, q.y))) p = q;
    }
    if (!p) return null;
    const el = div('pr-e still' + (fly ? ' air' : '') + (DR.BUGS.includes(k) && k === 'libelula' ? ' bug air' : '')), sp = div('pr-sp'), fl = div('', DR.svg(k));
    if (!DR.WATER.includes(k)) fl.firstChild.style.filter = pick(DR.TINT);
    sp.appendChild(fl); el.appendChild(sp); el.style.opacity = '0'; W.layer.appendChild(el);
    let sh = null; if (fly) { sh = div('pr-sh'); W.layer.insertBefore(sh, W.volc.nextSibling); }
    const e = { k, d, el, sp, fl, sh, mx: p.x, my: p.y, tx: p.x, ty: p.y, v: d.v * rnd(0.85, 1.15), run: (d.run || d.v * 2) * rnd(0.9, 1.1), dir: Math.random() < 0.5 ? -1 : 1, state: 'idle', t: rnd(0.3, 2), cool: rnd(3, 12), cry: rnd(5, 18),
      alt: fly ? rnd(40, 90) : k === 'libelula' ? rnd(18, 40) : 0, bub: null, prey: null, hunter: null, huntT: 0, sx: 0, sy: 0, sc: 1, lk: '', chk: 0, dead: false, h: d.w * d.vb[1] / d.vb[0] * 0.9, fdir: 0, fish: false };
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    W.ents.push(e); return e;
  }
  function kill(e, puff) {
    if (e.dead) return; e.dead = true; if (e.bub) dropBub(e.bub, true);
    if (puff) { const p = div('pr-puff'); p.style.transform = 'translate(' + e.sx.toFixed(1) + 'px,' + (e.sy - e.h * e.sc * 0.4).toFixed(1) + 'px)'; W.layer.appendChild(p); setTimeout(() => p.remove(), 1000); }
    e.el.remove(); if (e.sh) e.sh.remove(); W.ents.splice(W.ents.indexOf(e), 1);
    if (e.hunter && e.hunter.prey === e) { e.hunter.prey = null; }
  }
  function relocate(e, p) { e.mx = p.x; e.my = p.y; e.tx = p.x; e.ty = p.y; e.state = 'idle'; e.t = rnd(0.3, 2); e.prey = null; e.hunter = null; e.el.style.transition = 'none'; e.el.style.opacity = '0'; void e.el.offsetWidth; e.el.style.transition = ''; e.el.style.opacity = '1'; }

  // Sonido y bocadillos
  const near = e => clamp(1 - Math.hypot(e.sx - W.w / 2, e.sy - W.h / 2) / Math.max(W.w, W.h), 0.3, 1);
  function snd(e, name, o) { const v = window.atlasVoice; if (!v || !name) return; v.sfx(name, Object.assign({ vol: near(e) * 0.9, pan: clamp((e.sx - W.w / 2) / (W.w / 2), -1, 1) * 0.8 }, o)); }
  function say(e, text, cls, dur) {
    if (e.bub || W.bubs.length >= 3) return;
    const el = div('pr-b ' + (cls || '')); el.textContent = text; W.layer.appendChild(el);
    const b = { el, e, t: dur || Math.max(2.4, text.length * 0.06 + 1.6), w: el.offsetWidth }; W.bubs.push(b); e.bub = b; requestAnimationFrame(() => el.classList.add('on'));
  }
  function dropBub(b, now) { const i = W.bubs.indexOf(b); if (i >= 0) W.bubs.splice(i, 1); if (b.e && b.e.bub === b) b.e.bub = null; if (now) b.el.remove(); else { b.el.classList.remove('on'); setTimeout(() => b.el.remove(), 300); } }
  function cry(e, withText) {
    const d = e.d; snd(e, d.snd, d.f ? { f: d.f } : {});
    if (withText === false || e.bub) return;
    if (Math.random() < 0.13) say(e, d.name + ': ' + d.fact, 'fact', 6); else say(e, pick(d.say), '', 2.2);
  }

  // Movimiento
  function pickTarget(e, v) {
    const fly = DR.FLY.includes(e.k), water = DR.WATER.includes(e.k), bug = e.k === 'libelula';
    for (let i = 0; i < 8; i++) {
      const r = (fly ? rnd(260, 520) : bug ? rnd(30, 110) : rnd(50, 190)) * U, a = Math.random() * 6.283, x = e.mx + Math.cos(a) * r, y = e.my + Math.sin(a) * r;
      if (fly) { if (inView(v, x, y, 0.5)) { e.tx = x; e.ty = y; e.state = 'walk'; return; } continue; }
      if (water ? (waterM(x, y) && waterM((x + e.mx) / 2, (y + e.my) / 2)) : (landM(x, y) && landM((x + e.mx) / 2, (y + e.my) / 2))) { e.tx = x; e.ty = y; e.state = 'walk'; return; }
    }
    e.state = 'idle'; e.t = rnd(1, 3);
  }
  function moveTo(e, dt, speed) {
    const dx = e.tx - e.mx, dy = e.ty - e.my, d = Math.hypot(dx, dy), step = speed * U * dt;
    if (d <= step) { e.mx = e.tx; e.my = e.ty; return true; }
    e.mx += dx / d * step; e.my += dy / d * step; if (Math.abs(dx) > 0.2 * U) e.dir = dx < 0 ? -1 : 1; return false;
  }
  const edible = (h, p) => !p.dead && h.d.eats.includes(p.k) && !p.hunter && p.state !== 'fight';
  function startHunt(h, p) {
    h.prey = p; p.hunter = h; h.state = 'hunt'; h.huntT = rnd(9, 15); p.state = 'flee'; W.hunts++;
    cry(h, true); if (p.d.diet !== 'b' && Math.random() < 0.7) { snd(p, p.d.snd === 'roar' ? 'grunt' : p.d.snd); if (!p.bub) say(p, pick(['¡Aaah!', '¡Socorro!', '¡Corre, corre!', '¡Ayuda!']), '', 1.6); }
  }
  function endHunt(h, cool) { const p = h.prey; if (p) { p.hunter = null; if (p.state === 'flee') { p.state = 'idle'; p.t = rnd(1, 2); } } h.prey = null; h.state = 'idle'; h.t = rnd(1, 3); h.cool = cool || rnd(8, 18); W.hunts = Math.max(0, W.hunts - 1); }
  function catchPrey(h, p) {
    if (p.d.fight) {   // el triceratops, el estegosaurio y el anquilosaurio plantan cara
      p.state = h.state = 'fight'; p.fightT = h.fightT = 2.6; p.hunter = h; snd(h, 'clash'); say(p, pick(p.d.say), '', 2); return;
    }
    if (p.run > h.run * 0.95 && Math.random() < 0.7) { say(p, '¡Casi me pillas!', '', 1.8); endHunt(h, rnd(10, 18)); return; }
    snd(h, 'crunch'); kill(p, true); h.prey = null; h.state = 'eat'; h.t = rnd(4, 6); W.hunts = Math.max(0, W.hunts - 1); say(h, pick(['¡ÑAM!', '¡Ñam ñam!', '¡Qué rico!']), '', 2);
  }

  function stepAnimal(e, dt, v) {
    const k = e.k, d = e.d, fly = DR.FLY.includes(k), bug = k === 'libelula', crawl = d.diet === 'b' && !bug;
    e.cool -= dt; e.cry -= dt;
    if (e.cry <= 0) { e.cry = rnd(9, 24); if (inView(v, e.mx, e.my, -0.02) && !(W.hush > performance.now())) cry(e, true); }
    if (e.state === 'fight') {
      e.fightT -= dt;
      if (e.fightT <= 0) {
        if (d.fight) { e.state = 'idle'; e.t = rnd(1, 3); e.hunter = null; if (Math.random() < 0.4) snd(e, d.snd); }
        else { const h = e.prey; e.state = 'idle'; e.t = 4; e.cool = 26; say(e, '¡Ay, ay, ay!', '', 2); snd(e, 'grunt'); if (h) { h.hunter = null; } e.prey = null; W.hunts = Math.max(0, W.hunts - 1); }
      } return;
    }
    if (e.state === 'eat') { e.t -= dt; if (e.t <= 0) { e.state = 'idle'; e.t = rnd(1, 3); e.fish = false; } return; }
    if (fly) return stepFlyer(e, dt, v);
    // presa que huye
    if (e.state === 'flee') {
      const h = e.hunter;
      if (!h || h.dead || h.prey !== e) { e.hunter = null; e.state = 'idle'; e.t = rnd(1, 2); return; }
      const dx = e.mx - h.mx, dy = e.my - h.my, dd = Math.hypot(dx, dy) || 1;
      e.chk -= dt;
      if (e.chk <= 0) { e.chk = 0.5; let a = Math.atan2(dy, dx), ok = false; for (let i = 0; i < 6 && !ok; i++) { const aa = a + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.55, x = e.mx + Math.cos(aa) * 160 * U, y = e.my + Math.sin(aa) * 160 * U; if (landM(x, y)) { e.tx = x; e.ty = y; ok = true; } } if (!ok) { e.tx = e.mx + dx / dd * 40 * U; e.ty = e.my + dy / dd * 40 * U; } }
      moveTo(e, dt, e.run); return;
    }
    // cazador
    if (e.state === 'hunt') {
      const p = e.prey; e.huntT -= dt;
      if (!p || p.dead || e.huntT <= 0 || !inView(v, p.mx, p.my, 0.3)) { endHunt(e, rnd(8, 16)); return; }
      e.tx = p.mx; e.ty = p.my;
      if (Math.hypot(p.mx - e.mx, p.my - e.my) < 16 * U * (d.w / 90)) { catchPrey(e, p); return; }
      e.chk -= dt; if (e.chk <= 0) { e.chk = 0.4; const ax = e.mx + Math.sign(e.tx - e.mx) * 30 * U, ay = e.my + Math.sign(e.ty - e.my) * 30 * U; if (!landM(ax, ay)) { endHunt(e, 10); return; } }
      moveTo(e, dt, e.run); if (Math.abs(p.mx - e.mx) > 0.2 * U) e.dir = p.mx < e.mx ? -1 : 1; return;
    }
    if (d.diet === 'c' && e.cool <= 0 && W.hunts < 2 && inView(v, e.mx, e.my, -0.04)) {
      let best = null, bd = 1e9; W.ents.forEach(p => { if (p !== e && edible(e, p) && inView(v, p.mx, p.my, 0)) { const dd = Math.hypot(p.mx - e.mx, p.my - e.my); if (dd < bd && dd < 330 * U) { bd = dd; best = p; } } });
      if (best && Math.random() < 0.55) { startHunt(e, best); return; } e.cool = rnd(3, 7);
    }
    // paseo
    if (e.state === 'idle') {
      e.t -= dt;
      if (e.t <= 0) {
        if (k === 'spino' && Math.random() < 0.3) { const x = e.mx + e.dir * 70 * U; if (waterM(x, e.my) || waterM(x, e.my + 30 * U)) { e.state = 'eat'; e.t = 4; e.fish = true; snd(e, 'splosh'); say(e, '¡Ñam, pescado!', '', 2); return; } }
        pickTarget(e, v);
      }
    } else if (e.state === 'walk') {
      e.chk -= dt; if (e.chk <= 0) { e.chk = 0.6; const ax = e.mx + Math.sign(e.tx - e.mx) * e.v * U, ay = e.my + Math.sign(e.ty - e.my) * e.v * U; if (!(fly || bug) && !(DR.WATER.includes(k) ? waterM(ax, ay) : landM(ax, ay))) { e.state = 'idle'; e.t = rnd(0.5, 2); return; } }
      if (moveTo(e, dt, e.v)) { e.state = 'idle'; e.t = crawl ? rnd(2, 5) : bug ? rnd(0.2, 1) : rnd(1.5, 5); }
    }
    if ((k === 'trex' || k === 'brachio') && e.state === 'walk' && inView(v, e.mx, e.my, -0.05)) { e.stomp = (e.stomp || 0) - dt; if (e.stomp <= 0) { e.stomp = rnd(0.9, 1.3); snd(e, 'stomp', { vol: near(e) * 0.4 }); } }
    if (k === 'plesio') { e.sub = (e.sub || rnd(8, 16)) - dt; if (e.sub <= 0) { e.sub = rnd(10, 20); snd(e, 'splosh', { vol: near(e) * 0.5 }); e.dive = 3; } if (e.dive > 0) e.dive -= dt; }
  }
  function stepFlyer(e, dt, v) {
    if (e.state === 'dive') {
      const p = e.prey; if (!p || p.dead || !inView(v, p.mx, p.my, 0.2)) { e.state = 'walk'; e.prey = null; if (p) p.hunter = null; return; }
      e.tx = p.mx; e.ty = p.my; const d0 = Math.hypot(p.mx - e.mx, p.my - e.my);
      moveTo(e, dt, e.v * 1.9); e.alt = Math.max(3, Math.min(e.alt, d0 / U * 0.5));
      if (d0 < 14 * U && e.alt < 14) { snd(e, 'screech'); snd(p, 'squeak'); kill(p, true); e.prey = null; e.state = 'walk'; e.cool = rnd(25, 45); e.alt = 60; pickTarget(e, v); say(e, '¡Ñam, picotazo!', '', 2); }
      return;
    }
    if (e.state === 'idle' || e.state === 'walk') {
      if (e.state === 'idle') pickTarget(e, v);
      if (e.state === 'walk') { if (moveTo(e, dt, e.v)) { e.state = 'idle'; } }
      e.alt += Math.sin(performance.now() / 900 + e.mx * 1e4) * dt * 6; e.alt = clamp(e.alt, 35, 110);
      if (e.k !== 'rhampho' && e.cool <= 0 && W.hunts < 2) {
        const c = W.ents.filter(p => !p.dead && (p.k === 'compy' || p.k === 'galli') && !p.hunter && inView(v, p.mx, p.my, 0))[0];
        if (c && Math.random() < 0.01) { e.prey = c; c.hunter = e; c.state = 'flee'; e.state = 'dive'; snd(e, 'screech'); } else e.cool = rnd(2, 5);
      }
    }
  }

  // ---------- Bucle ----------
  let last = 0;
  function tick(dt, ts) {
    const m = W.map, z = m.getZoom(), vis = z >= MIN_Z && isOn();
    // volcán
    if (volc && z >= 12) {
      const p = m.project(llOf(volc.x, volc.y)); W.volc.classList.remove('off');
      W.volc.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) scale(' + clamp(Math.pow(2, z - 15), 0.12, 6).toFixed(3) + ')';
      W.eruptT -= dt; if (W.eruptT <= 0) { W.eruptT = rnd(45, 80); W.volc.classList.add('erupt'); const fake = { sx: p.x, sy: p.y }; try { window.atlasVoice && window.atlasVoice.sfx('stomp', { vol: 0.7 }); window.atlasVoice && window.atlasVoice.sfx('roar', { vol: 0.5, f: 0.45 }); } catch (e) {} setTimeout(() => W.volc.classList.remove('erupt'), 7000); }
    } else W.volc.classList.add('off');
    if (!vis) { if (!W.off) { W.layer.classList.add('off'); W.off = true; W.bubs.slice().forEach(b => dropBub(b, true)); } return; }
    if (W.off) { W.layer.classList.remove('off'); W.off = false; W.viewT = 0; }
    W.viewT -= dt; if (W.viewT <= 0 || !W.view) { W.view = viewOf(); W.viewT = 0.25; }
    const v = W.view, s = clamp(Math.pow(2, z - REF_Z), 0.45, 6);
    if (!W.ready || !W.want) { if (W.ready) { W.want = WANT; Object.keys(WANT).forEach(k => { for (let i = 0; i < WANT[k]; i++) spawn(k, false); }); } return; }
    // la población se repone sola (los animales nuevos llegan por el borde de la pantalla)
    W.respT -= dt; if (W.respT <= 0) { W.respT = 2.5; for (const k of Object.keys(W.want)) { if (count(k) < W.want[k]) { spawn(k, true); break; } } }
    // ruidos lejanos de la selva
    W.ambT -= dt; if (W.ambT <= 0) { W.ambT = rnd(7, 15); const a = window.atlasVoice; if (a && !a.muted) { const n = pick(['roar', 'screech', 'trumpet', 'honk', 'cricket', 'frog', 'archaeo', 'plesio', 'cricket']); a.sfx(n, { vol: rnd(0.12, 0.3), pan: rnd(-0.9, 0.9), f: n === 'roar' ? rnd(0.5, 0.8) : 1 }); } }
    W.ents.slice().forEach(e => {
      if (e.dead) return;
      if (!inView(v, e.mx, e.my, 0.5)) { if (e.hunter || e.prey) { if (e.prey) endHunt(e, 6); if (e.hunter && e.hunter.prey === e) endHunt(e.hunter, 8); } relocate(e, DR.WATER.includes(e.k) ? (() => { for (let i = 0; i < 12; i++) { const q = randIn(v, 0.08); if (waterM(q.x, q.y)) return q; } return { x: e.mx, y: e.my }; })() : randIn(v, 0.06)); }
      try { stepAnimal(e, dt, v); } catch (err) { console.error('[prehistoria] ' + e.k, err); }
    });
    W.ents.forEach(e => {
      if (e.dead) return;
      const p = W.map.project(llOf(e.mx, e.my)), fly = DR.FLY.includes(e.k) || e.k === 'libelula', alt = (e.alt || 0) * s; e.sx = p.x; e.sy = p.y - (fly ? alt : 0); e.sc = s;
      e.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + (p.y - (fly ? alt : 0)).toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
      e.el.style.zIndex = fly ? 3000 + Math.round(p.y) : Math.round(p.y) + 10;
      if (e.sh) { e.sh.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) scale(' + (s * clamp(1.1 - (e.alt || 0) / 140, 0.35, 1)).toFixed(3) + ',' + (s * 0.6).toFixed(3) + ')'; }
      const moving = e.state === 'walk' || e.state === 'hunt' || e.state === 'flee' || e.state === 'dive' || DR.FLY.includes(e.k) || e.k === 'libelula';
      const cls = 'pr-e' + (fly ? ' air' : '') + (e.k === 'libelula' ? ' bug' : '') + (e.state === 'eat' ? ' eat' : e.state === 'fight' ? ' fight' : moving ? ((e.state === 'hunt' || e.state === 'flee') ? ' fast' : ' walk') : ' still') + (e.state === 'dive' ? ' dive' : '') + (e.dive > 0 ? ' sub' : '');
      if (e.lk !== cls) { e.lk = cls; e.el.className = cls; }
      if (e.fdir !== e.dir) { e.fdir = e.dir; e.fl.style.transform = 'scaleX(' + e.dir + ')'; }
    });
    W.bubs.slice().forEach(b => {
      b.t -= dt; const e = b.e;
      if (b.t <= 0 || e.dead || e.sx < -30 || e.sx > W.w + 30 || e.sy < 0 || e.sy > W.h + 40) { dropBub(b, false); return; }
      const bw = b.w || 100, x = clamp(e.sx, bw / 2 + 6, W.w - bw / 2 - 6), y = Math.max(80, e.sy - e.h * e.sc * (DR.FLY.includes(e.k) ? 0.45 : 0.95) - 10);
      b.el.style.transform = 'translate(' + (x - bw / 2).toFixed(1) + 'px,' + y.toFixed(1) + 'px) translateY(-100%)';
    });
  }
  function frame(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
    if (W && !W.box.classList.contains('hidden') && !document.hidden) { try { tick(dt, ts); } catch (e) { console.error('[prehistoria]', e); } requestAnimationFrame(frame); }
    else setTimeout(() => requestAnimationFrame(frame), 400);
  }
  requestAnimationFrame(frame);

  // ---------- Bienvenida ----------
  window.addEventListener('mundo:llegada', e => {
    if (e.detail.id !== ID || !W) return;
    schedule(0); W.hush = performance.now() + 4000;
    setTimeout(() => {
      try {
        const e0 = W.ents.find(x => x.k === 'brachio' && !x.dead) || W.ents.find(x => !x.dead && x.d.diet === 'h'); if (!e0) return;
        const n = playerName(); W.hush = 0; if (e0.bub) dropBub(e0.bub, true);
        snd(e0, e0.d.snd, { vol: 0.9 }); say(e0, '¡Bienvenid@ a Prehistoria' + (n ? ', ' + n : '') + '!', '', 4.5);
        setTimeout(() => { const t = W.ents.find(x => x.k === 'trex' && !x.dead); if (t) snd(t, 'roar', { vol: 0.55, f: 0.85 }); }, 2200);
      } catch (err) { console.error('[prehistoria] bienvenida', err); }
    }, 1500);
  });
  window.prehistoriaRugido = () => { if (!W) return; const t = W.ents.find(x => x.k === 'trex') || W.ents[0]; if (t) { cry(t, true); } };
})();
