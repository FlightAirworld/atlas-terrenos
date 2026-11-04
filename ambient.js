'use strict';
// Ambiente simulado: contador de jugadores en línea que sube y baja solo, y "vecinos" virtuales que escriben en el
// chat de cada zona. Todo vive en memoria (no toca la base de datos). Los mensajes llevan npc:true y el cliente los
// marca con 🤖 y no deja reaccionar ni añadirlos como amigos (no son cuentas reales).
//
// Variables de entorno (todas opcionales):
//   AMBIENT=off              apaga todo (el contador vuelve a mostrar solo jugadores reales)
//   AMBIENT_ONLINE_BASE=500  nivel medio de "jugadores" simulados en la hora punta media (varía según la hora del día)
//   AMBIENT_CHAT=off         apaga solo los mensajes del chat
const ON = String(process.env.AMBIENT || '').toLowerCase() !== 'off';
const CHAT_ON = ON && String(process.env.AMBIENT_CHAT || '').toLowerCase() !== 'off';
const BASE = Math.max(0, Number(process.env.AMBIENT_ONLINE_BASE || 500)) || 500;

const rnd = (a, b) => a + Math.random() * (b - a);
const int = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ---------- Jugadores en línea ----------
// Curva diaria (hora de Madrid): de madrugada hay la mitad de gente que en la hora punta de la noche.
const DAY = [.75, .65, .58, .52, .5, .52, .58, .68, .78, .85, .9, .95, 1, 1, .97, .95, .97, 1.02, 1.08, 1.15, 1.2, 1.22, 1.12, .92];
const madridFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
function target(now = Date.now()) {
  const parts = madridFmt.formatToParts(new Date(now));
  const h = Number(parts.find(p => p.type === 'hour').value), m = Number(parts.find(p => p.type === 'minute').value);
  const a = DAY[h], b = DAY[(h + 1) % 24];
  return BASE * (a + (b - a) * m / 60);
}
let level = target() * rnd(0.95, 1.05);
// Un paso de la caminata aleatoria: tira suave hacia la curva diaria y añade ruido, con alguna "ráfaga" de entradas o salidas.
function step(now = Date.now()) {
  if (!ON) return 0;
  level += (target(now) - level) * 0.04 + rnd(-4, 4);
  if (Math.random() < 0.12) level += rnd(-14, 14);
  level = Math.max(BASE * 0.3, Math.min(BASE * 1.6, level));
  return Math.round(level);
}
const online = () => ON ? Math.round(level) : 0;

// ---------- Vecinos virtuales del chat ----------
const NICKS = ['Marta_92', 'PacoTerrenos', 'LuciaG', 'carlitos', 'Sofi', 'ElTerrateniente', 'Nuria.R', 'JavierM', 'Anaaa', 'DaniBCN',
  'MariCarmen', 'Rafa77', 'Paula_', 'Toni', 'LauraV', 'Pepe', 'Irene', 'AlexRM', 'Cris', 'ManoloGZ', 'Elena', 'Jorge_88', 'Valeria',
  'Nacho', 'Rocío', 'Sergio', 'Alba', 'Dani', 'Mireia', 'Fran', 'Lola', 'Hugo', 'Carmen', 'Raúl', 'Inés', 'Pablo_', 'Teresa',
  'MarcosV', 'Noe', 'Guille', 'Ainhoa', 'Bea', 'Joan', 'Pilar', 'Álvaro', 'Silvia', 'Kike', 'Eva', 'Tomás', 'Rosa', 'Mateo',
  'Camila', 'Santi', 'Vero', 'Leo', 'Marina', 'Iker', 'Gala', 'Óscar', 'Yaiza', 'Adri', 'Celia', 'Ramón', 'Julia', 'Biel', 'Sara_T'];
const AVATARS = ['😀', '😎', '🤠', '🦊', '🐱', '🐶', '🦁', '🐼', '🚀', '👑', '⚽', '🌟'];
const avatarOf = nick => { let h = 0; for (const c of nick) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATARS[h % AVATARS.length]; };

// País aproximado según la zona (cajas muy básicas); si no encaja, un país hispanohablante al azar.
const BOXES = [['ES', 35.8, 43.9, -9.5, 4.5], ['PT', 36.9, 42.2, -9.6, -6.1], ['FR', 41.3, 51.1, -5, 8.3], ['IT', 36.5, 47.1, 6.6, 18.6],
  ['DE', 47.2, 55, 5.8, 15.1], ['GB', 49.9, 58.7, -8.2, 1.8], ['MX', 14.5, 32.7, -118.4, -86.7], ['CO', -4.2, 12.5, -79, -66.8],
  ['PE', -18.4, -0.1, -81.4, -68.6], ['CL', -55.9, -17.5, -75.7, -66.4], ['AR', -55, -21.8, -73.6, -53.6], ['BR', -33.7, 5.3, -74, -34.8],
  ['US', 24.5, 49.4, -125, -66.9]];
const FALLBACK = ['ES', 'MX', 'AR', 'CO', 'CL', 'US'];
const countryAt = at => { const b = BOXES.find(([, s, n, w, e]) => at.lat >= s && at.lat <= n && at.lng >= w && at.lng <= e); return b ? b[0] : pick(FALLBACK); };

const greet = h => h >= 6 && h < 13 ? 'buenos días' : h >= 13 && h < 21 ? 'buenas tardes' : 'buenas noches';
const TEXTS = [
  '{g} a todos 👋', '{g}! alguien por aquí?', 'hola hola', 'acabo de comprar mi primera parcela 🏡', 'qué bonito se ve el mapa desde aquí',
  'ya tengo 3 terrenos!!', 'cuánto producen vuestras casas por hora?', 'alguien sabe cómo subir de nivel un terreno?',
  'subí mi terreno a nivel 3 y se nota la producción', 'las rotondas decoradas quedan geniales 😍', 'he visto una fuente en una rotonda jaja',
  'quiero comprar justo al lado de mi casa, ¿se puede?', 'esta zona se está llenando de casitas', 'mañana sigo, a ver cuántos créditos junto',
  'qué ganas de llegar al nivel 5 ⭐', 'alguien más vuelve cada día por la racha?', 'racha de 5 días 🔥', 'me encanta este juego', 'vaya, ya no queda ni un hueco cerca del parque',
  'ayer pasé por aquí y esto estaba vacío', 'quién ha puesto la gasolinera ahí jajaja', 'yo voy a por el edificio más alto del barrio 😎',
  'cuántos créditos hace falta para el nivel 4?', 'me están saliendo bien las cuentas con los créditos por hora', 'pasad por mi terreno que lo he decorado 🌳',
  'hay buen ambiente hoy', 'primera vez que entro, qué tal funciona esto?', 'bienvenidos los nuevos!', 'qué tren más chulo acaba de pasar 🚆',
  'veo animalitos por el mapa jaja 🐕', 'alguien juega desde el móvil? a mí me va fluido', 'voy a mirar el ranking de mi país 🏆',
  'jajaja', 'buah 🔥', 'a ver si llego al top de mi ciudad', 'cuánto llevas ya acumulado?', 'recoge los créditos antes de irte a dormir 😴',
  'qué buena idea lo de comprar sitios reales', 'he encontrado mi calle en el mapa!!', 'ya he comprado la casa de mis abuelos 🥹',
  'este finde me pongo a mejorar todos mis terrenos', 'gracias por el consejo!', 'me encanta ver el nombre de la gente en el mapa'
];
const REPLIES = ['{n} yo también!', '{n} jajaja totalmente', '{n} bienvenid@ 👋', '{n} sí, a mí me pasó igual', '{n} buena idea!', '{n} eso mismo pensaba yo',
  '{n} gracias! 😊', '{n} pues yo llevo poco, pero me gusta', '{n} nivel 2 ya da mucha diferencia', '{n} cuenta con ello 👍', '{n} jaja qué bueno'];

let nextId = -1;
const recentTexts = [];
const ring = [];           // últimos mensajes simulados { lat, lng, msg }, para que el historial coincida con lo visto en directo
const RING_MAX = 300;

function make(at, t, prev) {
  const nick = pick(NICKS.filter(n => !prev || n !== prev.nick));
  const localHour = (((new Date(t).getUTCHours() + at.lng / 15) % 24) + 24) % 24;
  let text, tries = 0;
  do {
    text = prev && Math.random() < 0.3 ? pick(REPLIES).replace('{n}', prev.nick + ':') : pick(TEXTS).replace('{g}', greet(Math.floor(localHour)));
  } while (recentTexts.includes(text) && ++tries < 8);
  recentTexts.push(text); if (recentTexts.length > 25) recentTexts.shift();
  const r = {};
  if (Math.random() < 0.3) r[pick(['❤️', '😂', '👍', '😮', '🔥'])] = int(1, 4);
  return { id: nextId--, nick, avatar: avatarOf(nick), country: countryAt(at), text, t, r, mine: null, npc: true };
}
function lastNear(at, km, dist) {
  for (let i = ring.length - 1; i >= 0; i--) if (dist(at, ring[i]) <= km) return ring[i].msg;
  return null;
}
function remember(at, msg) { ring.push({ lat: at.lat, lng: at.lng, msg }); if (ring.length > RING_MAX) ring.shift(); }

// Mensaje nuevo para una zona (se publica en directo)
function live(at, km, dist) {
  if (!CHAT_ON) return null;
  const msg = make(at, Date.now(), lastNear(at, km, dist));
  remember(at, msg);
  return msg;
}
// Historial de una zona: si casi no hay mensajes simulados cerca, se generan unos cuantos de los últimos minutos
function history(at, km, dist) {
  if (!CHAT_ON) return [];
  let near = ring.filter(r => dist(at, r) <= km).map(r => r.msg);
  if (near.length < 4) {
    const n = int(5, 8), now = Date.now();
    const ts = Array.from({ length: n }, () => now - int(60, 45 * 60) * 1000).sort((a, b) => a - b);
    let prev = null;
    for (const t of ts) { const m = make(at, t, prev); prev = m; remember(at, m); near.push(m); }
  }
  return near.slice(-20);
}

module.exports = { ON, CHAT_ON, step, online, live, history, rnd, int };
