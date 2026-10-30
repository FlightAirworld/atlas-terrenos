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
