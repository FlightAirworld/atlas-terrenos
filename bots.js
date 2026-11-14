'use strict';
// Jugadores automáticos 🌍: uno por país, en TODOS los países del mundo (197: los 193 de la ONU + Vaticano, Palestina, Kosovo y
// Taiwán), cada uno con su bandera y un apodo típico de su país. Los datos están en bots-data.js (16 países a mano) y en
// bots-data-mundo.js + bots-mundo-<región>.js (el resto). Cada uno reclama UNA parcela al día, al azar, siempre dentro de su país.
//   · Sin cuenta (user_id NULL): no cobran, no reciben ni gastan créditos y no pueden ser presidentes de pueblo.
//   · Salen en el mapa y en el ranking con su nombre y su bandera (campo country de la parcela).
//   · Para no caer nunca fuera de su país no usan coordenadas al azar: eligen un municipio del INTERIOR de una lista (lejos de
//     costas y fronteras) y se desplazan como mucho jitterKm del centro. Además hay una caja de seguridad por país.
//   · Una vez al día, a una hora distinta cada día (entre las 08:00 y las 22:00 de la zona horaria del país). La tabla bot_runs
//     tiene clave primaria (bot, day): aunque haya dos servidores o se reinicie, cada bot reclama solo una vez al día.
//   · La casa sale al azar y el pueblo lo pone cityTick solo.
//
// Variables de entorno (todas opcionales):
//   BOTS=off              apaga todos los jugadores automáticos
//   BOTS_OFF=DE,RU        apaga solo los de esos países (códigos de 2 letras)
//   BOT_NAME_DE=Hans      cambia el nombre del de Alemania (BOT_NAME_<PAÍS>); también vale FRANCOIS_NAME para Francia
//   FRANCOIS=off          apaga solo a Francóis (compatibilidad)
// Para quitar las parcelas de un bot:  DELETE FROM parcels WHERE currency = 'BOT' AND country = 'DE';
const DATA = require('./bots-data').concat(require('./bots-data-mundo'));   // 16 países a mano + el resto del mundo (bots-data-mundo.js)

const ALL_ON = String(process.env.BOTS || '').toLowerCase() !== 'off';
const OFF = new Set(String(process.env.BOTS_OFF || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean));
if (String(process.env.FRANCOIS || '').toLowerCase() === 'off') OFF.add('FR');
const FROM_MIN = 8 * 60, TO_MIN = 22 * 60;     // franja del día en que reclaman (minutos desde medianoche, hora del país)
const TRIES = 60;                              // intentos de encontrar una parcela libre cada día

const nameOf = b => {
  const env = (b.cc === 'FR' && process.env.FRANCOIS_NAME) || process.env['BOT_NAME_' + b.cc] || '';
  const n = env.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 30);
  return n.length >= 2 ? n : b.name;
};
const BOTS = DATA.map(b => ({ ...b, name: nameOf(b) }));
const activeBots = () => (ALL_ON ? BOTS.filter(b => !OFF.has(b.cc)) : []);

const insideBox = (b, lat, lng) => lat >= b.box.latMin && lat <= b.box.latMax && lng >= b.box.lngMin && lng <= b.box.lngMax;

// Un punto al azar dentro de un municipio de la lista del bot (como mucho jitterKm del centro).
function pickSpot(b, rand = Math.random) {
  const [town, lat0, lng0] = b.towns[Math.floor(rand() * b.towns.length)];
  const r = b.jitterKm * Math.sqrt(rand()), a = rand() * Math.PI * 2;
  const lat = lat0 + (r * Math.sin(a)) / 111.32;
  const lng = lng0 + (r * Math.cos(a)) / (111.32 * Math.cos(lat0 * Math.PI / 180));
  return { town, lat, lng };
}

// Minuto del día (entre FROM_MIN y TO_MIN) en el que reclama ese bot ese día; sale del propio día y del bot, así que no cambia si se reinicia el servidor.
function plannedMinute(botId, day) {
  let h = 2166136261;
  for (const ch of String(day) + '|' + botId) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0;
  return FROM_MIN + (h % (TO_MIN - FROM_MIN));
}

// deps: { run, q, parcelFromLatLng, isUniqueViolation }  (todo viene de server.js; `now` y `manual` solo los usan las pruebas)
function start(deps) {
  const bots = activeBots();
  if (!bots.length) return;
  const { run, q, parcelFromLatLng, isUniqueViolation } = deps, now = deps.now || Date.now;
  const clocks = new Map(bots.map(b => [b.id, new Intl.DateTimeFormat('en-GB', { timeZone: b.tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })]));
  const dayOf = b => new Date(now()).toLocaleDateString('en-CA', { timeZone: b.tz });   // AAAA-MM-DD en la zona del país
  const minuteOf = b => {
    const p = clocks.get(b.id).formatToParts(new Date(now()));
    return Number(p.find(x => x.type === 'hour').value) * 60 + Number(p.find(x => x.type === 'minute').value);
  };
  let busy = false;

  async function claimOne(b) {
    for (let i = 0; i < TRIES; i++) {
      const s = pickSpot(b);
      if (!insideBox(b, s.lat, s.lng)) continue;
      const p = parcelFromLatLng(s.lat, s.lng);
      if (!p) continue;
      const t = now();
      if (await q.parcelById(p.id) || await q.activeOrderForParcel(p.id, t)) continue;   // ocupada: prueba otra
      try {
        await q.insertParcel(p.id, p.x, p.y, b.name, null, '0.00', 'BOT', t, b.avatar, b.cc, null);   // casa null = al azar
      } catch (e) { if (isUniqueViolation(e)) continue; throw e; }
      return { id: p.id, town: s.town };
    }
    return null;
  }

  async function runBot(b) {
    const day = dayOf(b);
    if (minuteOf(b) < plannedMinute(b.id, day)) return;                                   // todavía no es su hora de hoy
    const ins = await run('INSERT INTO bot_runs (bot, day, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [b.id, day, now()]);
    if (!ins.rowCount) return;                                                             // hoy ya reclamó
    let got = null;
    try { got = await claimOne(b); } catch (e) { console.error(`Bot ${b.name} (${b.cc}):`, e.message); }
    if (got) console.log(`Bot ${b.name} (${b.cc}) ha reclamado ${got.id} en ${got.town}`);
    else await run('DELETE FROM bot_runs WHERE bot = $1 AND day = $2', [b.id, day]).catch(() => {});   // sin hueco o con error: reintenta en 10 min
  }

  async function tick() {
    if (busy) return;
    busy = true;
    try { for (const b of bots) { try { await runBot(b); } catch (e) { console.error(`Bot ${b.name} (${b.cc}):`, e.message); } } }
    finally { busy = false; }
  }

  if (deps.manual) return tick;   // pruebas: devuelve la función en vez de programar el reloj
  run('CREATE TABLE IF NOT EXISTS bot_runs (bot TEXT NOT NULL, day TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (bot, day))')
    .then(() => { setTimeout(tick, 30_000).unref(); setInterval(tick, 10 * 60_000).unref(); })
    .catch(e => console.error('Bots: no se pudo crear bot_runs:', e.message));
}

module.exports = { BOTS, activeBots, insideBox, pickSpot, plannedMinute, FROM_MIN, TO_MIN, start };
