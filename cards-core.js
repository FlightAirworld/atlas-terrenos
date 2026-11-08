'use strict';
// CARTAS COLECCIONABLES: definición de las 10.000 cartas de una temporada. Lo usan el servidor (cards-server.js) y el navegador (cards.js).
// Las cartas NO se guardan: cada una sale siempre igual a partir de su número (1..10000) y de la temporada. En la base de datos solo se
// guarda QUIÉN tiene cada número. Así cambiar de temporada = cambiar SEASON (nueva sal → otras cartas, otros nombres, otros poderes).
// Estructura: 100 grupos ("niveles") de 100 cartas. Dentro de cada grupo, las posiciones 1-60 son comunes, 61-85 raras, 86-95 épicas,
// 96-99 legendarias y la 100 es la LEGENDARIA DE ORO (100 doradas en total, una por grupo). Cuanto más alto el grupo, más fuertes las cartas.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardsCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TOTAL = 10000, GROUP = 100, GROUPS = TOTAL / GROUP;
  const SEASONS = { T1: { name: 'Temporada 1 · Fundadores' } };

  // key, nombre, color principal, color de brillo, rango de poder base [min, max]
  const RARITIES = [
    { key: 'comun',      name: 'Común',            c1: '#9aa5b1', c2: '#d9dee4', lo: 20, hi: 42 },
    { key: 'rara',       name: 'Rara',             c1: '#3b82f6', c2: '#93c5fd', lo: 42, hi: 62 },
    { key: 'epica',      name: 'Épica',            c1: '#9b5de5', c2: '#d8b4fe', lo: 62, hi: 80 },
    { key: 'legendaria', name: 'Legendaria',       c1: '#f59e0b', c2: '#fde68a', lo: 80, hi: 93 },
    { key: 'oro',        name: 'Legendaria de Oro', c1: '#d4a017', c2: '#fff3b0', lo: 93, hi: 100 }
  ];

  const CREATURES = [['🐉', 'Dragón'], ['🦅', 'Águila'], ['🐺', 'Lobo'], ['🦁', 'León'], ['🐻', 'Oso'], ['🦈', 'Tiburón'], ['🐍', 'Serpiente'],
    ['🦊', 'Zorro'], ['🐗', 'Jabalí'], ['🦂', 'Escorpión'], ['🦉', 'Búho'], ['🐯', 'Tigre'], ['🦍', 'Gorila'], ['🐘', 'Elefante'],
    ['🦌', 'Ciervo'], ['🐙', 'Pulpo'], ['🦇', 'Murciélago'], ['🐢', 'Tortuga'], ['🦏', 'Rinoceronte'], ['🐎', 'Corcel']];
  // Elementos = los mismos de las luchas (fight.js): 🔥 > 🌿 > 💧 > 🔥
  const ELEMENTS = [{ icon: '🔥', name: 'Fuego' }, { icon: '🌿', name: 'Planta' }, { icon: '💧', name: 'Agua' }];
  const EPITHETS = [
    ['de Fuego', 'Ardiente', 'de las Brasas', 'Volcánico', 'Incandescente', 'de Ceniza'],
    ['del Bosque', 'Esmeralda', 'Salvaje', 'de las Raíces', 'Primaveral', 'de la Selva'],
    ['de las Mareas', 'Glacial', 'del Abismo', 'de la Tormenta', 'Cristalino', 'del Océano']
  ];
  const GOLD_TITLES = ['el Eterno', 'Dorado', 'el Inmortal', 'Supremo', 'del Amanecer'];

  function hash32(str) {   // mezcla de texto a número de 32 bits (cyrb53 reducido)
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return (h1 ^ (h1 >>> 15)) >>> 0;
  }
  function rng(seed) {   // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const groupOf = id => Math.ceil(id / GROUP);               // 1..100
  const posOf = id => ((id - 1) % GROUP) + 1;                // 1..100 dentro del grupo
  const rarityIndexOf = id => { const p = posOf(id); return p <= 60 ? 0 : p <= 85 ? 1 : p <= 95 ? 2 : p <= 99 ? 3 : 4; };
  const valid = id => Number.isInteger(id) && id >= 1 && id <= TOTAL;

  function cardInfo(id, season) {
    id = Number(id); season = season || 'T1';
    if (!valid(id)) return null;
    const r = rng(hash32(season + ':' + id));
    const g = groupOf(id), pos = posOf(id), ri = rarityIndexOf(id), rar = RARITIES[ri];
    const el = Math.floor(r() * 3);
    const bonus = Math.floor((g - 1) / 12);                  // +0 en el grupo 1 … +8 en el 100
    const stat = () => Math.max(1, Math.min(100, Math.round(rar.lo + r() * (rar.hi - rar.lo) + bonus)));
    const fuerza = stat(), defensa = stat(), velocidad = stat(), suerte = stat();
    const poder = Math.min(100, Math.round(fuerza * 0.4 + defensa * 0.3 + velocidad * 0.2 + suerte * 0.1));
    let cr, name;
    if (ri === 4) { cr = CREATURES[g % CREATURES.length]; name = cr[1] + ' ' + GOLD_TITLES[Math.floor((g - 1) / 20) % GOLD_TITLES.length]; }   // 20×5 = las 100 doradas, todas distintas
    else { cr = CREATURES[Math.floor(r() * CREATURES.length)]; const ep = EPITHETS[el]; name = cr[1] + ' ' + ep[Math.floor(r() * ep.length)]; }
    return { id, season, group: g, pos, rarity: rar.key, rarityIdx: ri, rarityName: rar.name, c1: rar.c1, c2: rar.c2, gold: ri === 4,
      name, emoji: cr[0], elementIdx: el, element: ELEMENTS[el].icon, elementName: ELEMENTS[el].name, fuerza, defensa, velocidad, suerte, poder,
      serial: String(id).padStart(5, '0') + '/' + TOTAL };
  }

  // ---------- CARTA NEGRA 🖤: una carta única al mes que se consigue por puja (no sale en sobres ni se intercambia) ----------
  // Todo al máximo (100) y con Carisma, que las normales no tienen. Se dibuja negra con letras doradas (ver cards.js).
  const BLACKS = [['🐉', 'Dragón de Ébano'], ['🦅', 'Águila de Obsidiana'], ['🐺', 'Lobo de la Noche Eterna'], ['🦁', 'León de Azabache'],
    ['🐍', 'Serpiente del Abismo'], ['🦇', 'Murciélago Sombra Dorada'], ['🐯', 'Tigre de Medianoche'], ['🦉', 'Búho del Eclipse'],
    ['🐻', 'Oso del Cráter Negro'], ['🦂', 'Escorpión de Ónix'], ['🐎', 'Corcel del Ocaso'], ['🦈', 'Tiburón de Aguas Negras']];
  const monthRe = /^(\d{4})-(0[1-9]|1[0-2])$/;
  const validMonth = m => monthRe.test(String(m));
  function blackInfo(month) {   // month = 'AAAA-MM'. Meses seguidos → cartas distintas (12 nombres que se repiten con otra edición cada año)
    if (!validMonth(month)) return null;
    const [, y, mm] = monthRe.exec(month), idx = (Number(y) * 12 + Number(mm) - 1) % BLACKS.length, cr = BLACKS[idx];
    return { special: true, black: true, month, id: 'N' + month, season: 'NEGRA', rarity: 'negra', rarityName: 'Carta Negra · Única', gold: true,
      c1: '#050505', c2: '#1c1608', name: cr[1], emoji: cr[0], element: '🌑', elementName: 'Oscuridad',
      fuerza: 100, defensa: 100, velocidad: 100, suerte: 100, carisma: 100, poder: 100, edition: 'Edición ' + month };
  }
  // Mes (AAAA-MM) de un instante según una zona horaria, y cuándo acaba ese mes (= empieza el siguiente, a las 00:00 de esa zona)
  const monthKeyOf = (ms, tz) => new Date(ms).toLocaleDateString('en-CA', { timeZone: tz || 'Europe/Madrid' }).slice(0, 7);
  function nextMonthKey(key) { const [, y, m] = monthRe.exec(key); return Number(m) === 12 ? (Number(y) + 1) + '-01' : y + '-' + String(Number(m) + 1).padStart(2, '0'); }
  function tzOffsetMs(ms, tz) {   // cuánto adelanta la zona sobre UTC en ese instante
    const t = Math.floor(ms / 1000) * 1000;
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(t)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
  }
  function monthStartMs(key, tz) {   // instante en que empieza el día 1 de ese mes a las 00:00 en esa zona (con horario de verano)
    tz = tz || 'Europe/Madrid';
    const [, y, m] = monthRe.exec(key), guess = Date.UTC(Number(y), Number(m) - 1, 1);
    let res = guess - tzOffsetMs(guess, tz); const off2 = tzOffsetMs(res, tz);
    if (guess - off2 !== res) res = guess - off2;
    return res;
  }
  const monthEndMs = (key, tz) => monthStartMs(nextMonthKey(key), tz);

  // Ordena las pujas: la mejor de cada jugador, de mayor a menor; si empatan gana quien pujó antes
  function rankBids(bids) {
    const best = new Map();
    for (const b of bids) { const c = best.get(b.user_id); if (!c || b.amount > c.amount || (b.amount === c.amount && b.created_at < c.created_at)) best.set(b.user_id, b); }
    return [...best.values()].sort((a, b) => b.amount - a.amount || a.created_at - b.created_at);
  }
  // Recorre las pujas de mejor a peor y se queda con la primera que se pueda cobrar (charge(puja) → true si se cobró).
  // Así, si el que iba ganando se ha gastado los créditos, la carta pasa al siguiente en vez de quedar desierta.
  async function pickWinner(bids, charge) {
    const skipped = [];
    for (const b of rankBids(bids)) { if (await charge(b)) return { winner: b, skipped }; skipped.push(b); }
    return { winner: null, skipped };
  }

  return { TOTAL, GROUP, GROUPS, SEASONS, RARITIES, valid, groupOf, posOf, rarityIndexOf, cardInfo,
    BLACKS, validMonth, blackInfo, monthKeyOf, nextMonthKey, monthStartMs, monthEndMs, rankBids, pickWinner };
});
