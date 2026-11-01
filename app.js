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

function houseFor(id) {
  let h = 2166136261;
  for (const c of id) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  }
  return HOUSES[(h >>> 16) % HOUSES.length];
}
map.createPane('houses').style.zIndex = 395; // fotos por debajo de los bordes y de la selección

function drawOwned(p) {
  if (drawn.has(p.id)) return;
  const col = colorFor(p.owner);
  const bounds = boundsOf(p.x, p.y);
  const open = e => { L.DomEvent.stopPropagation(e); selectAt(e.latlng); };

  // Foto de la casa ocupando toda la parcela
  const img = L.imageOverlay(houseFor(p.id), bounds, { pane: 'houses', className: 'house-img', alt: 'Casa de ' + p.owner });
  // Borde de color del dueño (también recibe los clics)
  const rect = L.rectangle(bounds, { color: col, weight: 2, fillColor: col, fillOpacity: 0.08, interactive: true }).on('click', open);
  // Nombre del dueño bajo la parcela
  const pill = document.createElement('span');
  pill.className = 'owner-pill';
  pill.textContent = labelOf(p);             // textContent: sin HTML
  const label = L.marker([bounds[0][0], (bounds[0][1] + bounds[1][1]) / 2], {
    icon: L.divIcon({ className: 'owner-label', html: pill, iconSize: [0, 0] }),
    interactive: false, keyboard: false
  });

  img.addTo(ownedLayer); rect.addTo(ownedLayer); label.addTo(ownedLayer);
  drawn.set(p.id, [img, rect, label]);
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

function syncLabels() { map.getContainer().classList.toggle('labels-off', map.getZoom() < 17); }
map.on('zoomend', syncLabels); syncLabels();

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
// ---------- Administración: reclamar parcelas gratis ----------
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
          country
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudo reclamar');

      selected.owner = result.owner;
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
        country: selected.country
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

  box.append(title, description, token, button);
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
    $('p-owner').textContent = labelOf(p);
    $('p-photo').src = houseFor(p.id);
    $('p-avatar').textContent = p.avatar || '';
    $('p-since').textContent = 'Comprado el ' + new Date(p.since).toLocaleDateString('es-ES');
  } else {
    $('p-price').textContent = new Intl.NumberFormat('es-ES', { style: 'currency', currency: cfg.currency }).format(cfg.price);
    $('pack-size').textContent = cfg.packSize;
  }
}
$('close').onclick = () => { $('panel').classList.add('hidden'); if (selectedRect) selectedRect.remove(); selected = null; };

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
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + packCode },
      body: JSON.stringify({ lat: selected.south + cfg.size / 2, lng: selected.west + cfg.size / 2, owner, avatar, country })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo reclamar');
    credits = j.credits; updateCreditUi();
    selected.owner = j.owner; selected.avatar = avatar; selected.country = country; selected.since = Date.now();
    showPanel(selected);
    setMsg(`¡Listo! Es tuyo. Te quedan ${credits} terrenos 🎉`, 'ok');
    drawOwned({ id: selected.id, x: selected.x, y: selected.y, owner: selected.owner, avatar: selected.avatar, country: selected.country });
    loadStats(); loadParcels();
  } catch (e) {
    setMsg(e.message, 'err');
    refreshCredits();
  } finally { btn.disabled = false; }
};

// ---------- Regalo diario ----------
let dailyState = null;
const plural = (n, one, many) => n === 1 ? one : many;
async function loadDaily() {
  try {
    const r = await fetch('/api/daily', { headers: packCode ? { Authorization: 'Bearer ' + packCode } : {} });
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
    ? `Racha actual: ${racha}. Hoy te llevas ${premio}.`
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
}
function setDailyMsg(text, kind = '') { const m = $('daily-msg'); m.textContent = text; m.className = 'msg ' + kind; }
$('daily-btn').onclick = () => { setDailyMsg(''); $('daily').classList.remove('hidden'); loadDaily(); };
$('daily-close').onclick = () => $('daily').classList.add('hidden');
$('daily-claim').onclick = async () => {
  const btn = $('daily-claim');
  btn.disabled = true;
  try {
    const r = await fetch('/api/daily/claim', { method: 'POST', headers: packCode ? { Authorization: 'Bearer ' + packCode } : {} });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo reclamar el regalo');
    saveCode(j.code); credits = j.credits; updateCreditUi();
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
  setMsg(`¡Pack comprado! Tienes ${credits} terrenos. Guarda tu código 🔑`, 'ok');
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
    s.top.forEach(t => { const li = document.createElement('li'); li.textContent = `${flagOf(t.country) ? flagOf(t.country) + ' ' : ''}${t.owner} — ${t.n}`; ol.appendChild(li); });
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

  setupAdminControls();

  if (cfg.demo) $('demo-pay').classList.remove('hidden');
  else renderPaypal();

  if (cfg.demo) {
    const h = document.createElement('p');
    h.className = 'muted';
    h.textContent = 'MODO DEMO: no se cobra dinero real.';
    $('paypal-box').before(h);
  }

  refreshCredits().then(loadDaily);
  loadStats();
  loadParcels();
})();
