'use strict';
const $ = id => document.getElementById(id);
const MIN_ZOOM_PARCELS = 15;   // por debajo no se muestran parcelas
const MIN_ZOOM_BUY = 16;       // para comprar hay que acercarse
let cfg, map, ownedLayer, selectedRect, selected = null, paypalLoaded = null;
let sb = null, authToken = null, authUser = null, linkedFor = null;   // sesión (Supabase Auth)
let myNick = null;             // apodo fijo guardado en el servidor
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
    loadDaily();
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
      myNick = null; $('name').value = ''; applyNick();
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
function setMineMsg(text, kind = '') { const m = $('mine-msg'); m.textContent = text; m.className = 'msg ' + kind; }
function renderMine(prod, mine) {
  const n = prod.parcels;
  $('mine-prod').textContent = n
    ? `⏱️ Tienes ${n} ${plural(n, 'terreno', 'terrenos')}: producen ${prod.perHour.toLocaleString('es-ES', { maximumFractionDigits: 4 })} créditos por hora. Se acumulan hasta ${prod.capHours} h, ¡recógelos antes de que se llene!`
    : 'Aún no tienes terrenos con producción. Reclama uno y empezará a producir créditos.';
  const btn = $('mine-collect');
  btn.disabled = prod.ready < 1;
  btn.textContent = prod.ready >= 1 ? `🎟️ Recoger ${prod.ready} ${plural(prod.ready, 'crédito', 'créditos')}` : 'Aún no hay créditos listos';
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
  btn.disabled = true;
  try {
    const j = await api('/api/production/collect', { method: 'POST', body: {} });
    credits = j.credits; updateCreditUi();
    setMineMsg(`🎉 +${j.collected} ${plural(j.collected, 'crédito', 'créditos')}. Ahora tienes ${j.credits}.`, 'ok');
  } catch (e) { setMineMsg(e.message, 'err'); }
  loadMine();
};

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
