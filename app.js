'use strict';
const $ = id => document.getElementById(id);
const MIN_ZOOM_PARCELS = 15;   // por debajo no se muestran parcelas
const MIN_ZOOM_BUY = 16;       // para comprar hay que acercarse
let cfg, map, ownedLayer, selectedRect, selected = null, paypalLoaded = null;
const drawn = new Map();       // id -> rectángulo

const map_ = L.map('map', { worldCopyJump: true, minZoom: 2 }).setView([36.1408, -5.3536], 17); // Gibraltar por defecto
map = map_;
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
ownedLayer = L.layerGroup().addTo(map);

function colorFor(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return `hsl(${h % 360} 70% 42%)`;
}
function boundsOf(x, y) {
  const s = cfg.size, west = x * s - 180, south = y * s - 90;
  return [[south, west], [south + s, west + s]];
}
function setMsg(text, kind = '') { const m = $('msg'); m.textContent = text; m.className = 'msg ' + kind; }
async function api(url, opts) {
  const r = await fetch(url, opts && { ...opts, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts.body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}

// ---------- Parcelas compradas en pantalla ----------

function drawOwned(p) {
  if (drawn.has(p.id)) return;

  const col = colorFor(p.owner);
  const bounds = boundsOf(p.x, p.y);

  // Dibujar el terreno comprado
  const rect = L.rectangle(bounds, {
    color: col,
    weight: 1,
    fillColor: col,
    fillOpacity: 0.30,
    interactive: true
  });

  const tip = document.createElement('span');
  tip.textContent = p.owner;

  rect.bindTooltip(tip, {
    permanent: map.getZoom() >= 17,
    direction: 'center',
    className: 'owner-tip'
  });

  rect.on('click', e => {
    L.DomEvent.stopPropagation(e);
    selectAt(e.latlng);
  });

  rect.addTo(ownedLayer);

  // Crear la casa en el centro exacto de la parcela
  const south = bounds[0][0];
  const west = bounds[0][1];
  const north = bounds[1][0];
  const east = bounds[1][1];

  const centerLat = (south + north) / 2;
  const centerLng = (west + east) / 2;

  const houseIcon = L.divIcon({
    className: 'house-marker',
    html: '<span aria-hidden="true">🏠</span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  const house = L.marker([centerLat, centerLng], {
    icon: houseIcon,
    interactive: true,
    keyboard: true,
    title: 'Casa de ' + p.owner,
    zIndexOffset: 1000
  });

  house.on('click', e => {
    L.DomEvent.stopPropagation(e);
    selectAt(e.latlng);
  });

  house.addTo(ownedLayer);

  // Guardar la parcela para evitar duplicados
  drawn.set(p.id, rect);
}


// ---------- Selección de parcela ----------
async function selectAt(latlng) {
  if (map.getZoom() < MIN_ZOOM_BUY) { map.flyTo(latlng, MIN_ZOOM_BUY + 1); return; }
  const lng = ((latlng.lng + 180) % 360 + 360) % 360 - 180;     // normaliza al dar la vuelta al mundo
  let p;
  try { p = await api(`/api/parcel?lat=${latlng.lat}&lng=${lng}`); } catch (e) { return; }
  selected = p;
  if (selectedRect) selectedRect.remove();
  selectedRect = L.rectangle(boundsOf(p.x, p.y), { color: '#ffb703', weight: 3, fill: false, interactive: false }).addTo(map);
  showPanel(p);
}
map.on('click', e => selectAt(e.latlng));

function showPanel(p) {
  $('panel').classList.remove('hidden');
  $('p-title').textContent = `Terreno ${p.id}`;
  $('p-coords').textContent = `Lat ${p.south.toFixed(3)}° · Lng ${p.west.toFixed(3)}° · ~111 × 111 m`;
  setMsg('');
  const owned = !!p.owner;
  $('p-owned').classList.toggle('hidden', !owned);
  $('p-free').classList.toggle('hidden', owned);
  if (owned) {
    $('p-owner').textContent = p.owner;
    $('p-since').textContent = 'Comprado el ' + new Date(p.since).toLocaleDateString('es-ES');
  } else {
    $('p-price').textContent = new Intl.NumberFormat('es-ES', { style: 'currency', currency: cfg.currency }).format(cfg.price);
  }
}
$('close').onclick = () => { $('panel').classList.add('hidden'); if (selectedRect) selectedRect.remove(); selected = null; };

// ---------- Compra ----------
function nameOrThrow() {
  const n = $('name').value.replace(/\s+/g, ' ').trim();
  if (n.length < 2) { setMsg('Escribe tu nombre (mínimo 2 letras) antes de pagar', 'err'); throw new Error('nombre'); }
  return n;
}
async function createOrder() {
  const owner = nameOrThrow();
  const o = await api('/api/orders', { method: 'POST', body: { lat: selected.south + cfg.size / 2, lng: selected.west + cfg.size / 2, owner } });
  return o.orderId;
}
async function captureOrder(orderId) {
  const r = await api(`/api/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', body: {} });
  setMsg(`¡Listo! El terreno ${r.parcel} ahora es de ${r.owner} 🎉`, 'ok');
  selected.owner = r.owner; selected.since = Date.now();
  setTimeout(() => { showPanel(selected); loadParcels(); loadStats(); }, 1500);
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
async function loadStats() {
  try {
    const s = await api('/api/stats');
    $('stats').textContent = `${s.sold} terrenos vendidos`;
    const ol = $('rank-list'); ol.replaceChildren();
    s.top.forEach(t => { const li = document.createElement('li'); li.textContent = `${t.owner} — ${t.n}`; ol.appendChild(li); });
    if (!s.top.length) ol.textContent = 'Aún no hay propietarios. ¡Sé el primero!';
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

// ---------- Inicio ----------
(async () => {
  cfg = await api('/api/config');
  if (cfg.demo) $('demo-pay').classList.remove('hidden'); else renderPaypal();
  if (cfg.demo) { const h = document.createElement('p'); h.className = 'muted'; h.textContent = 'MODO DEMO: no se cobra dinero real.'; $('paypal-box').before(h); }
  loadStats(); loadParcels();
})();
