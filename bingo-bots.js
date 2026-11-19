'use strict';
// BINGO · jugadores ficticios (bots) y reparto del resultado.
//  · pickBots(n): n jugadores ficticios distintos, cada uno con apodo, país (bandera) y avatar. Son siempre los mismos "habituales" (se reconocen de una partida a otra).
//  · botCount(): cuántos jugadores ficticios entran en cada partida (entre BINGO_BOTS_MIN y BINGO_BOTS_MAX, por defecto 120–240).
//  · botPlan(): cuántos cartones compra cada uno: el total de la partida sale entre 200 y 700 (BINGO_CARDS_MIN / MAX), cada jugador de 1 a 24.
//  · planOrder(cards, humanLine, humanBingo, base): reordena las 90 bolas para que la línea y/o el bingo los cante un jugador REAL (o un bot)
//    según se haya decidido de antemano. Solo se llama cuando se cierra la compra, antes de que caiga la primera bola.
const crypto = require('node:crypto');

const ri = (a, b) => a + crypto.randomInt(b - a + 1);
const pick = a => a[crypto.randomInt(a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Los avatares que acepta el servidor (los mismos que bots-data-mundo.js)
const AVATARS = ['😀', '😎', '🤠', '🦊', '🐱', '🐶', '🦁', '🐼', '🚀', '👑', '⚽', '🌟'];

// País y peso (más jugadores hispanohablantes). [código, peso, ¿apodos en español?]
const COUNTRIES = [
  ['ES', 30, 1], ['MX', 10, 1], ['AR', 8, 1], ['CO', 7, 1], ['CL', 4, 1], ['PE', 4, 1], ['VE', 3, 1], ['EC', 2, 1], ['UY', 2, 1], ['DO', 2, 1],
  ['CU', 1, 1], ['PY', 1, 1], ['BO', 1, 1], ['CR', 1, 1], ['PA', 1, 1], ['GT', 1, 1], ['HN', 1, 1], ['SV', 1, 1], ['NI', 1, 1], ['PR', 1, 1],
  ['US', 3, 0], ['BR', 3, 0], ['PT', 2, 0], ['FR', 2, 0], ['IT', 2, 0], ['DE', 2, 0], ['GB', 2, 0], ['MA', 2, 0], ['CA', 1, 0], ['NL', 1, 0],
  ['RO', 1, 0], ['PL', 1, 0], ['TR', 1, 0], ['JP', 1, 0], ['AU', 1, 0], ['IE', 1, 0], ['SE', 1, 0], ['GR', 1, 0]
];
const COUNTRY_BAG = COUNTRIES.flatMap(([c, w, es]) => Array.from({ length: w }, () => [c, es]));

const ES_NAMES = ['Lola', 'Pepe', 'Carmen', 'Juanito', 'Maria', 'Paco', 'Rosa', 'Toni', 'Marta', 'Nacho', 'Sofi', 'Dani', 'Lucia', 'Javi', 'Elena', 'Rafa', 'Ana', 'Kiko', 'Nuria', 'Pablo',
  'Vero', 'Sergio', 'Isa', 'Manu', 'Cris', 'Alex', 'Luis', 'Pili', 'Mari', 'Quique', 'Bea', 'Jose', 'Paula', 'Chema', 'Mireia', 'Oscar', 'Alba', 'Hugo', 'Inma', 'Adri',
  'Lara', 'Fran', 'Yolanda', 'Rocio', 'Tomas', 'Gloria', 'Raul', 'Teresa', 'Ivan', 'Silvia', 'Charo', 'Nando', 'Eva', 'Gabi', 'Lupe', 'Moni', 'Salva', 'Tere', 'Julio', 'Noe'];
const ES_TAILS = ['', '', '', '', '_bingo', '_suerte', 'Pro', '_77', 'Reina', 'Rey', 'Crack', '_oficial', '_feliz', 'Loca', 'Wapa', 'Fiestera'];
const INTL = ['StarPlayer', 'LuckyFox', 'NightOwl', 'BingoQueen', 'MrLucky', 'SunnyDay', 'Blue7', 'TigerEye', 'Zorro', 'Mango', 'Luna', 'Pixel', 'Rocket', 'Panda', 'Neo',
  'Cherry', 'Jackpot', 'Lime', 'Wolfie', 'Coco', 'Misty', 'Atlas', 'Nova', 'Echo', 'Maple', 'Ruby', 'Storm', 'Bella', 'Max', 'Sky'];

function makePool(size) {
  const seen = new Set(), pool = [];
  let guard = 0;
  while (pool.length < size && guard++ < size * 50) {
    const [country, es] = pick(COUNTRY_BAG);
    let nick;
    if (es) nick = pick(ES_NAMES) + pick(ES_TAILS) + (crypto.randomInt(100) < 55 ? ri(1, 99) : '');
    else nick = pick(INTL) + (crypto.randomInt(100) < 65 ? ri(1, 99) : '');
    nick = nick.slice(0, 16);
    if (seen.has(nick.toLowerCase())) continue;
    seen.add(nick.toLowerCase());
    pool.push({ id: 'bot:' + pool.length, nick, country, avatar: pick(AVATARS) });
  }
  return pool;
}
const POOL = makePool(520);   // los "habituales": en cada partida juegan entre 120 y 240 de ellos

const BOT_MIN = Math.max(1, Math.floor(Number(process.env.BINGO_BOTS_MIN) || 120));
const BOT_MAX = Math.max(BOT_MIN, Math.min(POOL.length, Math.floor(Number(process.env.BINGO_BOTS_MAX) || 240)));
const botCount = () => ri(BOT_MIN, BOT_MAX);
const CARDS_MIN = Math.max(1, Math.floor(Number(process.env.BINGO_CARDS_MIN) || 200));
const CARDS_MAX = Math.max(CARDS_MIN, Math.floor(Number(process.env.BINGO_CARDS_MAX) || 700));
// Reparto de cartones de los ficticios: el total de la partida cae entre 200 y 700; cada jugador compra al menos 1 y como mucho maxCards.
// Devuelve la lista de cartones por jugador (su longitud es el número de jugadores ficticios, entre 120 y 240 salvo que el total sea menor).
function botPlan(maxCards) {
  const total = ri(CARDS_MIN, CARDS_MAX);
  const n = Math.min(botCount(), total, POOL.length);
  const counts = Array(n).fill(1);
  let left = total - n;
  while (left > 0) {
    const i = crypto.randomInt(n);
    if (counts[i] < maxCards) { counts[i]++; left--; }
  }
  return counts;
}
const pickBots = n => shuffle(POOL.slice()).slice(0, Math.min(n, POOL.length));
const isBot = userId => typeof userId === 'string' && userId.startsWith('bot:');

// ---------- Quién canta la línea y el bingo ----------
// cards: [{ rows: [[5 números], [5 números], [5 números]], bot: boolean }]. base: orden actual de las 90 bolas (se devuelve si no hace falta o no se logra).
// humanLine / humanBingo: true = debe cantarlo un jugador real; false = uno ficticio.
// Para que lo cante uno real se "acerca" al principio del bombo la fila (línea) o el cartón entero (bingo) de uno de sus cartones y se comprueba por simulación
// que nadie más la completa antes ni a la vez. Para que lo cante un ficticio basta el orden aleatorio y se comprueba lo mismo.
const BALLS = 90;
const JP_PCT = Math.max(0, Math.min(100, Number(process.env.BINGO_HUMAN_JACKPOT_PCT) || 5));
function pull(order, nums, limit, locked) {
  nums.forEach(n => locked.add(n));
  for (const n of nums) {
    const p = order.indexOf(n);
    if (p < limit) continue;
    let q;
    do { q = crypto.randomInt(limit); } while (locked.has(order[q]));
    [order[p], order[q]] = [order[q], order[p]];
  }
}
function simulate(order, cards) {
  const pos = new Int16Array(BALLS + 1);
  order.forEach((n, i) => { pos[n] = i + 1; });
  let minLine = 999, lineHuman = false, lineBot = false, minBingo = 999, bingoHuman = false, bingoBot = false;
  for (const c of cards) {
    let lo = 999, hi = 0;
    for (const row of c.rows) {
      let m = 0;
      for (const n of row) if (pos[n] > m) m = pos[n];
      if (m < lo) lo = m;
      if (m > hi) hi = m;
    }
    if (lo < minLine) { minLine = lo; lineHuman = lineBot = false; }
    if (lo === minLine) { if (c.bot) lineBot = true; else lineHuman = true; }
    if (hi < minBingo) { minBingo = hi; bingoHuman = bingoBot = false; }
    if (hi === minBingo) { if (c.bot) bingoBot = true; else bingoHuman = true; }
  }
  return { minLine, lineHuman, lineBot, minBingo, bingoHuman, bingoBot };
}
function planOrder(cards, humanLine, humanBingo, base) {
  const hum = cards.filter(c => !c.bot), bot = cards.filter(c => c.bot);
  if (!hum.length || !bot.length) return base;
  const attempts = 500;
  // Casi siempre el bingo del jugador real llega después de la bola 48 (donde empieza el bote acumulado); solo de vez en cuando (por defecto 5 %) apunta a llevárselo
  const jpTry = crypto.randomInt(100) < JP_PCT;
  const bingoFrom = jpTry ? 36 : 55;
  for (let t = 0; t < attempts; t++) {
    const order = shuffle(Array.from({ length: BALLS }, (_, i) => i + 1));
    const locked = new Set();
    if (humanLine) {
      const L = pick(hum);
      pull(order, pick(L.rows), Math.min(40, 10 + Math.floor(t / 25)), locked);   // línea: la fila entra en las primeras 10-30 bolas (sube poco a poco si hay mucha competencia)
    }
    if (humanBingo) {
      const W = pick(hum);
      pull(order, W.rows.flat(), Math.min(90, Math.min(85, bingoFrom + Math.floor(t / 10)) + crypto.randomInt(6)), locked);   // bingo: el cartón entero entre las primeras ~55-85 bolas
    }
    const s = simulate(order, cards);
    const okLine = humanLine ? (s.lineHuman && !s.lineBot) : (s.lineBot && !s.lineHuman);
    const okBingo = humanBingo ? (s.bingoHuman && !s.bingoBot) : (s.bingoBot && !s.bingoHuman);
    if (okLine && okBingo) return order;
  }
  return base;
}

module.exports = { pickBots, botCount, botPlan, ri, isBot, planOrder, simulate, POOL };
