'use strict';
// JUEGOS NUEVOS (servidor): racha diaria, Adivina el lugar, ¿Más o menos?, Cofres del mapa y Duelos.
// El servidor decide y paga todo (igual que rasca-server.js); el navegador (minijuegos.js) solo dibuja.
// Se monta desde server.js:
//   const mjMod = () => mjMod.m || (mjMod.m = require('./minijuegos-server')({ pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, cardsMod, pushToUser }));
// Rutas: GET /api/mj/racha, POST /api/mj/racha/claim, GET /api/mj/adivina, POST /api/mj/adivina/answer,
//        GET /api/mj/mm, POST /api/mj/mm/guess, GET /api/mj/cofres, POST /api/mj/cofres/claim,
//        GET /api/mj/duelos, POST /api/mj/duelos/reto | aceptar | rechazar
const crypto = require('node:crypto');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit } = d;
  const ON = String(process.env.MINIJUEGOS || 'on').toLowerCase() !== 'off';
  const rnd = n => crypto.randomInt(n);

  // ---------- Datos ----------
  const STREAK_REWARDS = [1, 1, 2, 2, 3, 3, 5];   // créditos de cada día de la racha; el día 7 trae además un sobre

  const ADIVINA = [   // [pista, [opciones], índice correcto]
    ['🗼 Torre de hierro de 330 m inaugurada en 1889', ['París', 'Londres', 'Berlín', 'Roma'], 0],
    ['🏛️ Aquí se levantó el Partenón, sobre la Acrópolis', ['Atenas', 'Estambul', 'El Cairo', 'Belgrado'], 0],
    ['🗽 Estatua de la Libertad en su isla', ['Boston', 'Nueva York', 'Chicago', 'Miami'], 1],
    ['🎭 Ópera con forma de velas junto a su bahía', ['Auckland', 'Sídney', 'Melbourne', 'Singapur'], 1],
    ['🕌 Santa Sofía y la Mezquita Azul', ['Teherán', 'Bagdad', 'Estambul', 'Damasco'], 2],
    ['⛪ La Sagrada Familia de Gaudí', ['Valencia', 'Sevilla', 'Barcelona', 'Lisboa'], 2],
    ['🏯 Castillo de Himeji y ciudad de los cerezos en flor', ['Seúl', 'Tokio', 'Pekín', 'Hanói'], 1],
    ['🗿 Moáis en una isla remota del Pacífico', ['Isla de Pascua', 'Tahití', 'Fiyi', 'Hawái'], 0],
    ['🔺 Pirámides de Guiza junto al Nilo', ['Jartum', 'Alejandría', 'El Cairo', 'Luxor'], 2],
    ['🌉 Puente Golden Gate cubierto de niebla', ['San Francisco', 'Seattle', 'Los Ángeles', 'San Diego'], 0],
    ['🎡 Coliseo romano y la Fontana de Trevi', ['Milán', 'Roma', 'Nápoles', 'Florencia'], 1],
    ['🏰 Alhambra con vistas a Sierra Nevada', ['Córdoba', 'Toledo', 'Granada', 'Málaga'], 2],
    ['🌆 Cristo Redentor sobre el Pan de Azúcar', ['Río de Janeiro', 'Lima', 'Buenos Aires', 'Caracas'], 0],
    ['🕍 Machu Picchu entre montañas andinas', ['Bogotá', 'Quito', 'La Paz', 'Cusco'], 3],
    ['🎪 Puerta de Brandeburgo y restos del Muro', ['Viena', 'Berlín', 'Praga', 'Varsovia'], 1],
    ['🌃 Burj Khalifa, el edificio más alto del mundo', ['Doha', 'Dubái', 'Riad', 'Abu Dabi'], 1],
    ['🎠 Taj Mahal de mármol blanco junto al río Yamuna', ['Agra', 'Jaipur', 'Bombay', 'Lahore'], 0],
    ['🚋 Canales, góndolas y la Plaza de San Marcos', ['Ámsterdam', 'Brujas', 'Venecia', 'Estocolmo'], 2]
  ];

  const CIUDADES = [   // [nombre, millones de habitantes (área urbana, aprox.)]
    ['Tokio', 37], ['Delhi', 33], ['Shanghái', 29], ['Dhaka', 23.2], ['São Paulo', 22.6], ['Ciudad de México', 22.4], ['El Cairo', 22.2],
    ['Mumbai', 21.7], ['Pekín', 21.5], ['Osaka', 19], ['Nueva York', 18.8], ['Lagos', 15.9], ['Estambul', 15.8], ['Buenos Aires', 15.4],
    ['Moscú', 12.6], ['Los Ángeles', 12.5], ['Bogotá', 11.3], ['París', 11.2], ['Lima', 11.2], ['Bangkok', 11], ['Yakarta', 10.6],
    ['Seúl', 9.9], ['Londres', 9.8], ['Madrid', 6.8], ['Santiago', 6.8], ['Toronto', 6.3], ['Johannesburgo', 6.1], ['Barcelona', 5.7],
    ['Sídney', 5.3], ['Roma', 4.3], ['Berlín', 3.7], ['Dubái', 3.6], ['Lisboa', 2.9], ['Viena', 2], ['Ámsterdam', 1.2]
  ];

  const COFRES = [   // [lugar, lat, lng]
    ['París', 48.8584, 2.2945], ['Madrid', 40.4168, -3.7038], ['Roma', 41.8902, 12.4922], ['Londres', 51.5007, -0.1246], ['Berlín', 52.5163, 13.3777],
    ['Nueva York', 40.7484, -73.9857], ['Los Ángeles', 34.1341, -118.3215], ['Ciudad de México', 19.4326, -99.1332], ['Río de Janeiro', -22.9519, -43.2105],
    ['Buenos Aires', -34.6037, -58.3816], ['El Cairo', 29.9792, 31.1342], ['Ciudad del Cabo', -33.9249, 18.4241], ['Estambul', 41.0082, 28.9784],
    ['Dubái', 25.1972, 55.2744], ['Delhi', 28.6139, 77.209], ['Bangkok', 13.7563, 100.5018], ['Tokio', 35.6586, 139.7454], ['Pekín', 39.9163, 116.3972],
    ['Sídney', -33.8568, 151.2153], ['Moscú', 55.7539, 37.6208], ['Lisboa', 38.7223, -9.1393], ['Atenas', 37.9715, 23.7257], ['Lima', -12.0464, -77.0428],
    ['Toronto', 43.6426, -79.3871]
  ];
  const COFRE_CREDITOS = [1, 1, 2, 2, 3, 5];

  // ---------- Utilidades ----------
  function seeded(seed) {   // generador repetible a partir de un texto (mismo día = mismo resultado para todos)
    let h = crypto.createHash('sha256').update(seed).digest(), i = 0;
    return n => { if (i + 4 > h.length) { h = crypto.createHash('sha256').update(h).digest(); i = 0; } const v = h.readUInt32BE(i); i += 4; return v % n; };
  }
  function pick(arr, k, seed) {   // k elementos distintos, siempre los mismos para esa semilla
    const r = seeded(seed), idx = arr.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = r(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.slice(0, k);
  }
  const yesterday = day => new Date(new Date(day + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
  const credit = (q, code, n) => q.query('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING credits', [n, code]).then(r => Number(r.rows[0].credits));
  const nick = async uid => ((await all('SELECT nickname FROM profiles WHERE user_id = $1', [uid]))[0] || {}).nickname || 'Jugador';
  async function tx(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const r = await fn(client); await client.query('COMMIT'); return r; }
    catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }
  async function gift(uid, kind, source, client) { const c = d.cardsMod && d.cardsMod(); return c && c.ON ? c.grantPack(uid, kind, source, (t, p) => client.query(t, p)) : null; }
  function gate(uid, what) { if (rateHit('mj:' + what + ':' + uid, 60_000) > 40) throw new HttpError(429, 'Vas muy rápido. Espera un minuto'); }

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS mj_streak (user_id TEXT PRIMARY KEY, last_day TEXT NOT NULL, streak INT NOT NULL)');
    await run('CREATE TABLE IF NOT EXISTS mj_streak_days (user_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day))');
    await run('CREATE TABLE IF NOT EXISTS mj_play (user_id TEXT NOT NULL, day TEXT NOT NULL, game TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY (user_id, day, game))');
    await run('CREATE TABLE IF NOT EXISTS mj_chests (day TEXT NOT NULL, id INT NOT NULL, user_id TEXT NOT NULL, credits INT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (day, id))');
    await run('CREATE TABLE IF NOT EXISTS mj_duels (id BIGSERIAL PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, stake INT NOT NULL, status TEXT NOT NULL, from_roll INT, to_roll INT, created_at BIGINT NOT NULL, done_at BIGINT)');
  }
  const off = () => { if (!ON) throw new HttpError(404, 'Los juegos nuevos están desactivados'); };

  // ---------- Racha diaria ----------
  async function rachaGet(req) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey();
    const r = (await all('SELECT last_day, streak FROM mj_streak WHERE user_id = $1', [uid]))[0];
    const alive = r && (r.last_day === day || r.last_day === yesterday(day));
    const month = (await all('SELECT day FROM mj_streak_days WHERE user_id = $1 AND day LIKE $2', [uid, day.slice(0, 7) + '%'])).map(x => x.day);
    return { ok: true, streak: alive ? Number(r.streak) : 0, best: r ? Number(r.streak) : 0, claimedToday: !!(r && r.last_day === day), rewards: STREAK_REWARDS, today: day, month };
  }
  async function rachaClaim(req) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey(); gate(uid, 'racha');
    const pack = await ensureUserPack(user);
    return tx(async c => {
      const r = (await c.query('SELECT last_day, streak FROM mj_streak WHERE user_id = $1 FOR UPDATE', [uid])).rows[0];
      if (r && r.last_day === day) throw new HttpError(409, 'Ya has cobrado la racha de hoy. ¡Vuelve mañana!');
      const streak = r && r.last_day === yesterday(day) ? Number(r.streak) + 1 : 1;
      await c.query('INSERT INTO mj_streak (user_id, last_day, streak) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET last_day = $2, streak = $3', [uid, day, streak]);
      await c.query('INSERT INTO mj_streak_days (user_id, day) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, day]);
      const step = (streak - 1) % 7, prize = STREAK_REWARDS[step], packGiven = step === 6 ? await gift(uid, 'bronce', 'racha', c) : null;
      return { ok: true, streak, prize, pack: !!packGiven, credits: await credit(c, pack.code, prize) };
    });
  }

  // ---------- Adivina el lugar (5 preguntas al día, las mismas para todos) ----------
  const adivinaSet = day => pick(ADIVINA, 5, 'adivina:' + day);
  const adivinaView = (day, st) => ({
    ok: true, done: st.answers.length >= 5, score: st.score, i: st.answers.length,
    q: st.answers.length < 5 ? (q => ({ clue: q[0], opts: q[1] }))(ADIVINA[adivinaSet(day)[st.answers.length]]) : null,
    paid: st.paid || 0
  });
  async function adivinaGet(req) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey();
    const r = (await all("SELECT state FROM mj_play WHERE user_id = $1 AND day = $2 AND game = 'adivina'", [uid, day]))[0];
    return adivinaView(day, r ? JSON.parse(r.state) : { answers: [], score: 0 });
  }
  async function adivinaAnswer(req, body) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey(); gate(uid, 'adivina');
    const a = Number(body && body.a); if (!Number.isInteger(a) || a < 0 || a > 3) throw new HttpError(400, 'Respuesta no válida');
    const pack = await ensureUserPack(user);
    return tx(async c => {
      await c.query("INSERT INTO mj_play (user_id, day, game, state) VALUES ($1,$2,'adivina',$3) ON CONFLICT DO NOTHING", [uid, day, JSON.stringify({ answers: [], score: 0 })]);
      const row = (await c.query("SELECT state FROM mj_play WHERE user_id = $1 AND day = $2 AND game = 'adivina' FOR UPDATE", [uid, day])).rows[0];
      const st = JSON.parse(row.state);
      if (st.answers.length >= 5) throw new HttpError(409, 'Hoy ya has jugado. ¡Vuelve mañana!');
      const q = ADIVINA[adivinaSet(day)[st.answers.length]], ok = a === q[2];
      st.answers.push(a); if (ok) st.score++;
      let credits = null, packGiven = false;
      if (st.answers.length === 5) {
        st.paid = st.score >= 5 ? 3 : st.score >= 3 ? 2 : st.score >= 1 ? 1 : 0;
        if (st.paid) credits = await credit(c, pack.code, st.paid);
        if (st.score === 5) packGiven = !!(await gift(uid, 'bronce', 'adivina', c));
      }
      await c.query("UPDATE mj_play SET state = $4 WHERE user_id = $1 AND day = $2 AND game = $3", [uid, day, 'adivina', JSON.stringify(st)]);
      return { ...adivinaView(day, st), correct: ok, right: q[2], prize: st.paid || 0, pack: packGiven, credits };
    });
  }

  // ---------- ¿Más o menos? (una partida al día; se acaba al fallar) ----------
  const mmView = st => ({ ok: true, over: !!st.over, streak: st.streak, a: { name: CIUDADES[st.a][0], pop: CIUDADES[st.a][1] }, b: st.over ? { name: CIUDADES[st.b][0], pop: CIUDADES[st.b][1] } : { name: CIUDADES[st.b][0] } });
  function mmNew(exclude) { let i; do { i = rnd(CIUDADES.length); } while (i === exclude || (exclude != null && CIUDADES[i][1] === CIUDADES[exclude][1])); return i; }
  async function mmGet(req) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey();
    const r = (await all("SELECT state FROM mj_play WHERE user_id = $1 AND day = $2 AND game = 'mm'", [uid, day]))[0];
    if (r) return { ...mmView(JSON.parse(r.state)), started: true };
    return { ok: true, started: false };
  }
  async function mmGuess(req, body) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey(); gate(uid, 'mm');
    const pack = await ensureUserPack(user);
    return tx(async c => {
      let row = (await c.query("SELECT state FROM mj_play WHERE user_id = $1 AND day = $2 AND game = 'mm' FOR UPDATE", [uid, day])).rows[0];
      if (!row) {   // primera pregunta del día: el sorteo se guarda para que no se pueda repetir
        const a = mmNew(null), b = mmNew(a);
        await c.query("INSERT INTO mj_play (user_id, day, game, state) VALUES ($1,$2,'mm',$3)", [uid, day, JSON.stringify({ a, b, streak: 0, over: false })]);
        if (!body || body.more === undefined) return { ...mmView({ a, b, streak: 0, over: false }), started: true };
        row = (await c.query("SELECT state FROM mj_play WHERE user_id = $1 AND day = $2 AND game = 'mm' FOR UPDATE", [uid, day])).rows[0];
      }
      const st = JSON.parse(row.state);
      if (st.over) throw new HttpError(409, 'Hoy ya has terminado. ¡Vuelve mañana!');
      if (!body || typeof body.more !== 'boolean') return { ...mmView(st), started: true };
      const bigger = CIUDADES[st.b][1] > CIUDADES[st.a][1], ok = body.more === bigger, shown = { a: st.a, b: st.b };
      let prize = 0, credits = null, packGiven = false;
      if (ok) { st.streak++; st.a = st.b; st.b = mmNew(st.a); }
      else {
        st.over = true;
        prize = Math.min(3, Math.floor(st.streak / 3));
        if (prize) credits = await credit(c, pack.code, prize);
        if (st.streak >= 8) packGiven = !!(await gift(uid, 'bronce', 'mas-o-menos', c));
      }
      await c.query("UPDATE mj_play SET state = $4 WHERE user_id = $1 AND day = $2 AND game = $3", [uid, day, 'mm', JSON.stringify(st)]);
      const view = ok ? mmView(st) : mmView({ ...st, a: shown.a, b: shown.b });
      return { ...view, correct: ok, revealed: { a: CIUDADES[shown.a], b: CIUDADES[shown.b] }, prize, pack: packGiven, credits, started: true };
    });
  }

  // ---------- Cofres del mapa (6 al día, los mismos para todos; el primero que llega se los lleva) ----------
  const cofresDeHoy = day => pick(COFRES, 6, 'cofres:' + day).map((ci, id) => ({ id, name: COFRES[ci][0], lat: COFRES[ci][1], lng: COFRES[ci][2], credits: COFRE_CREDITOS[id] }));
  async function cofresGet(req) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey();
    const taken = await all('SELECT id, user_id FROM mj_chests WHERE day = $1', [day]);
    return { ok: true, chests: cofresDeHoy(day).map(c => { const t = taken.find(x => x.id === c.id); return { id: c.id, lat: c.lat, lng: c.lng, taken: !!t, mine: !!t && t.user_id === uid }; }), max: 2 };
  }
  async function cofresClaim(req, body) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey(); gate(uid, 'cofres');
    const id = Number(body && body.id), chest = cofresDeHoy(day).find(c => c.id === id);
    if (!chest) throw new HttpError(404, 'Ese cofre no existe');
    const pack = await ensureUserPack(user);
    return tx(async c => {
      const mine = Number((await c.query('SELECT count(*)::int AS n FROM mj_chests WHERE day = $1 AND user_id = $2', [day, uid])).rows[0].n);
      if (mine >= 2) throw new HttpError(409, 'Hoy ya has abierto 2 cofres. ¡Deja alguno a los demás!');
      const ins = await c.query('INSERT INTO mj_chests (day, id, user_id, credits, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [day, id, uid, chest.credits, Date.now()]);
      if (!ins.rowCount) throw new HttpError(409, 'Alguien se te adelantó: ese cofre ya está abierto');
      return { ok: true, prize: chest.credits, credits: await credit(c, pack.code, chest.credits) };
    });
  }

  // ---------- Duelos (apuestas de 1 a 3 créditos; se resuelven al aceptar, sin estar conectados a la vez) ----------
  const EXPIRE_MS = 48 * 3600 * 1000;
  async function expireOld() {
    const old = await all("SELECT id FROM mj_duels WHERE status = 'pending' AND created_at < $1", [Date.now() - EXPIRE_MS]);
    for (const o of old) await tx(async c => {
      const dl = (await c.query("SELECT * FROM mj_duels WHERE id = $1 AND status = 'pending' FOR UPDATE", [o.id])).rows[0];
      if (!dl) return;
      await c.query('UPDATE packs SET credits = credits + $1 WHERE user_id = $2', [dl.stake, dl.from_id]);
      await c.query("UPDATE mj_duels SET status = 'expired', done_at = $2 WHERE id = $1", [dl.id, Date.now()]);
    }).catch(() => {});
  }
  async function duelosGet(req) {
    off(); const user = await needUser(req), uid = String(user.id); await expireOld();
    const rows = await all("SELECT d.*, pf.nickname AS from_nick, pt.nickname AS to_nick FROM mj_duels d LEFT JOIN profiles pf ON pf.user_id::text = d.from_id LEFT JOIN profiles pt ON pt.user_id::text = d.to_id WHERE (d.from_id = $1 OR d.to_id = $1) AND (d.status = 'pending' OR d.done_at > $2) ORDER BY d.id DESC LIMIT 20", [uid, Date.now() - 7 * 86400000]);
    const shape = r => ({ id: Number(r.id), stake: r.stake, status: r.status, from: r.from_nick || 'Jugador', to: r.to_nick || 'Jugador', mineIsFrom: r.from_id === uid, from_roll: r.from_roll, to_roll: r.to_roll });
    return { ok: true, incoming: rows.filter(r => r.status === 'pending' && r.to_id === uid).map(shape), outgoing: rows.filter(r => r.status === 'pending' && r.from_id === uid).map(shape), recent: rows.filter(r => r.status === 'done').slice(0, 5).map(shape) };
  }
  async function duelosReto(req, body) {
    off(); const user = await needUser(req), uid = String(user.id); gate(uid, 'duelo');
    const stake = Number(body && body.stake), name = String((body && body.nick) || '').trim().slice(0, 40);
    if (!Number.isInteger(stake) || stake < 1 || stake > 3) throw new HttpError(400, 'La apuesta es de 1 a 3 créditos');
    const to = (await all('SELECT user_id FROM profiles WHERE lower(nickname) = lower($1)', [name]))[0];
    if (!to) throw new HttpError(404, 'No hay ningún jugador con ese apodo');
    if (String(to.user_id) === uid) throw new HttpError(400, 'No puedes retarte a ti mismo');
    const pend = Number((await all("SELECT count(*)::int AS n FROM mj_duels WHERE from_id = $1 AND status = 'pending'", [uid]))[0].n);
    if (pend >= 3) throw new HttpError(409, 'Ya tienes 3 retos esperando respuesta');
    const pack = await ensureUserPack(user);
    const r = await tx(async c => {
      const up = await c.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [stake, pack.code]);
      if (!up.rowCount) throw new HttpError(402, 'No tienes créditos suficientes para esa apuesta');
      await c.query("INSERT INTO mj_duels (from_id, to_id, stake, status, created_at) VALUES ($1,$2,$3,'pending',$4)", [uid, String(to.user_id), stake, Date.now()]);
      return { ok: true, credits: Number(up.rows[0].credits) };
    });
    if (d.pushToUser) Promise.resolve(nick(uid)).then(n => d.pushToUser(String(to.user_id), { title: '⚔️ ¡Te han retado a un duelo!', body: n + ' apuesta ' + stake + ' 🎟️. Ábrelo en Extras → Juegos → Duelos.' })).catch(() => {});
    return r;
  }
  async function duelosAceptar(req, body) {
    off(); const user = await needUser(req), uid = String(user.id); gate(uid, 'duelo');
    const pack = await ensureUserPack(user);
    return tx(async c => {
      const dl = (await c.query("SELECT * FROM mj_duels WHERE id = $1 AND to_id = $2 AND status = 'pending' FOR UPDATE", [Number(body && body.id) || 0, uid])).rows[0];
      if (!dl) throw new HttpError(404, 'Ese duelo ya no está disponible');
      const up = await c.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [dl.stake, pack.code]);
      if (!up.rowCount) throw new HttpError(402, 'No tienes créditos suficientes para aceptar');
      let a, b; do { a = 1 + rnd(100); b = 1 + rnd(100); } while (a === b);
      const winner = a > b ? dl.from_id : uid;
      await c.query('UPDATE packs SET credits = credits + $1 WHERE user_id = $2', [dl.stake * 2, winner]);
      await c.query("UPDATE mj_duels SET status = 'done', from_roll = $2, to_roll = $3, done_at = $4 WHERE id = $1", [dl.id, a, b, Date.now()]);
      const credits = Number((await c.query('SELECT credits FROM packs WHERE code = $1', [pack.code])).rows[0].credits);
      return { ok: true, won: winner === uid, my_roll: b, their_roll: a, stake: dl.stake, credits };
    });
  }
  async function duelosRechazar(req, body) {
    off(); const user = await needUser(req), uid = String(user.id);
    const pack = await ensureUserPack(user);
    return tx(async c => {
      const dl = (await c.query("SELECT * FROM mj_duels WHERE id = $1 AND (to_id = $2 OR from_id = $2) AND status = 'pending' FOR UPDATE", [Number(body && body.id) || 0, uid])).rows[0];
      if (!dl) throw new HttpError(404, 'Ese duelo ya no está disponible');
      await c.query('UPDATE packs SET credits = credits + $1 WHERE user_id = $2', [dl.stake, dl.from_id]);
      await c.query("UPDATE mj_duels SET status = $2, done_at = $3 WHERE id = $1", [dl.id, dl.to_id === uid ? 'declined' : 'cancelled', Date.now()]);
      return { ok: true, credits: Number((await c.query('SELECT credits FROM packs WHERE code = $1', [pack.code])).rows[0].credits) };
    });
  }

  // ---------- Casino de créditos: tragaperras, plinko y cara o cruz ----------
  // Se juega con créditos ganados en el juego (la web no cobra dinero). El servidor sortea con crypto y paga al momento;
  // devuelve algo menos de lo apostado de media (≈ 90–96 %) para que los créditos no se inflen, y hay un tope de tiradas al día.
  const CASINO_MAX = Number(process.env.MJ_CASINO_MAX || 30);
  const REELS = [['🍒', 35], ['🍋', 25], ['🔔', 18], ['⭐', 12], ['💎', 7], ['7️⃣', 3]];
  const PAY3 = { '🍒': 5, '🍋': 6, '🔔': 10, '⭐': 20, '💎': 50, '7️⃣': 150 };   // tres iguales (por crédito apostado); dos 🍒 = 2×
  const PLINKO_ROWS = 8, PLINKO_MULT = [10, 3, 1.5, 0.5, 0.5, 0.5, 1.5, 3, 10], PLINKO_STAKE = 2;   // 2 créditos: premios enteros
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const reel = () => { let x = rnd(100); for (const [sym, w] of REELS) { if (x < w) return sym; x -= w; } return REELS[0][0]; };

  async function casinoGet(req) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey();
    const rows = await all("SELECT game, state FROM mj_play WHERE user_id = $1 AND day = $2 AND game IN ('slots','plinko','moneda','ruleta','minas')", [uid, day]);
    const left = { slots: CASINO_MAX, plinko: CASINO_MAX, moneda: CASINO_MAX, ruleta: CASINO_MAX, minas: CASINO_MAX };
    rows.forEach(r => { left[r.game] = Math.max(0, CASINO_MAX - Number(JSON.parse(r.state).n || 0)); });
    return { ok: true, left, max: CASINO_MAX, plinko: { stake: PLINKO_STAKE, mult: PLINKO_MULT, rows: PLINKO_ROWS }, pay3: PAY3 };
  }
  async function casinoPlay(game, req, body) {   // cobra la apuesta, sortea, paga y cuenta la tirada del día; todo en una transacción
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey(); gate(uid, 'casino');
    const pack = await ensureUserPack(user);
    if (!['slots', 'plinko', 'moneda', 'ruleta'].includes(game)) throw new HttpError(400, 'Juego no válido');
    let stake = game === 'plinko' ? PLINKO_STAKE : game === 'slots' ? 1 : Number(body && body.stake);
    if (!Number.isInteger(stake) || stake < 1 || stake > 3) throw new HttpError(400, 'La apuesta es de 1 a 3 créditos');
    return tx(async c => {
      await c.query("INSERT INTO mj_play (user_id, day, game, state) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [uid, day, game, JSON.stringify({ n: 0 })]);
      const row = (await c.query('SELECT state FROM mj_play WHERE user_id = $1 AND day = $2 AND game = $3 FOR UPDATE', [uid, day, game])).rows[0];
      const st = JSON.parse(row.state);
      if (st.n >= CASINO_MAX) throw new HttpError(409, 'Hoy ya has hecho todas tus tiradas (' + CASINO_MAX + '). ¡Vuelve mañana!');
      const pay = await c.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [stake, pack.code]);
      if (!pay.rowCount) throw new HttpError(402, 'No tienes créditos suficientes');
      let out, win = 0;
      if (game === 'slots') {
        const r = [reel(), reel(), reel()], cherries = r.filter(x => x === '🍒').length;
        win = r[0] === r[1] && r[1] === r[2] ? PAY3[r[0]] : cherries === 2 ? 2 : 0;
        out = { reels: r };
      } else if (game === 'plinko') {
        const path = Array.from({ length: PLINKO_ROWS }, () => rnd(2)), slot = path.reduce((a, b) => a + b, 0);
        win = PLINKO_MULT[slot] * stake; out = { path, slot, mult: PLINKO_MULT[slot] };
      } else if (game === 'ruleta') {   // ruleta europea 0–36: rojo/negro/par/impar pagan el doble, un número exacto ×36
        const n = rnd(37), bet = (body && body.bet) || {}, red = RED.has(n);
        const ok = bet.type === 'rojo' ? n > 0 && red : bet.type === 'negro' ? n > 0 && !red : bet.type === 'par' ? n > 0 && n % 2 === 0 : bet.type === 'impar' ? n % 2 === 1 : bet.type === 'num' ? n === Number(bet.n) : null;
        if (ok === null || (bet.type === 'num' && !(Number.isInteger(Number(bet.n)) && Number(bet.n) >= 0 && Number(bet.n) <= 36))) throw new HttpError(400, 'Apuesta no válida');
        win = ok ? stake * (bet.type === 'num' ? 36 : 2) : 0; out = { n, color: n === 0 ? 'verde' : red ? 'rojo' : 'negro' };
      } else {
        const heads = rnd(100) < 48, pick = body && body.side === 'cruz' ? 'cruz' : 'cara';   // 48 % de acertar: paga el doble
        win = (heads ? 'cara' : 'cruz') === pick ? stake * 2 : 0; out = { side: heads ? 'cara' : 'cruz', pick };
      }
      st.n++;
      await c.query('UPDATE mj_play SET state = $4 WHERE user_id = $1 AND day = $2 AND game = $3', [uid, day, game, JSON.stringify(st)]);
      const credits = win ? await credit(c, pack.code, win) : Number(pay.rows[0].credits);
      return { ok: true, ...out, stake, win, net: win - stake, credits, left: CASINO_MAX - st.n };
    });
  }

  // ---------- Minas: 25 casillas con 3 bombas; destapa las seguras y cobra cuando quieras (devuelve ≈ 95 % de media) ----------
  const MINAS_N = 25, MINAS_BOMBS = 3;
  const minasMult = k => { let m = 0.95; for (let j = 0; j < k; j++) m *= (MINAS_N - j) / (MINAS_N - MINAS_BOMBS - j); return m; };
  const minasView = (st, extra) => ({ ok: true, active: !!st.active, stake: st.active && st.active.stake, revealed: st.active ? st.active.revealed : [], mult: st.active ? minasMult(st.active.revealed.length) : 0,
    next: st.active ? minasMult(st.active.revealed.length + 1) : 0, left: Math.max(0, CASINO_MAX - (st.n || 0)), ...extra });
  async function minasState(c, uid, day) {
    await c.query("INSERT INTO mj_play (user_id, day, game, state) VALUES ($1,$2,'minas',$3) ON CONFLICT DO NOTHING", [uid, day, JSON.stringify({ n: 0, active: null })]);
    const st = JSON.parse((await c.query("SELECT state FROM mj_play WHERE user_id = $1 AND day = $2 AND game = 'minas' FOR UPDATE", [uid, day])).rows[0].state);
    return { st, save: () => c.query("UPDATE mj_play SET state = $3 WHERE user_id = $1 AND day = $2 AND game = 'minas'", [uid, day, JSON.stringify(st)]) };
  }
  async function minasGet(req) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey();
    const r = (await all("SELECT state FROM mj_play WHERE user_id = $1 AND day = $2 AND game = 'minas'", [uid, day]))[0];
    return minasView(r ? JSON.parse(r.state) : { n: 0, active: null });
  }
  async function minasStart(req, body) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey(); gate(uid, 'minas');
    const stake = Number(body && body.stake); if (!Number.isInteger(stake) || stake < 1 || stake > 3) throw new HttpError(400, 'La apuesta es de 1 a 3 créditos');
    const pack = await ensureUserPack(user);
    return tx(async c => {
      const { st, save } = await minasState(c, uid, day);
      if (st.active) throw new HttpError(409, 'Ya tienes una partida abierta');
      if (st.n >= CASINO_MAX) throw new HttpError(409, 'Hoy ya has hecho todas tus partidas (' + CASINO_MAX + '). ¡Vuelve mañana!');
      const pay = await c.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [stake, pack.code]);
      if (!pay.rowCount) throw new HttpError(402, 'No tienes créditos suficientes');
      const cells = Array.from({ length: MINAS_N }, (_, i) => i); for (let i = cells.length - 1; i > 0; i--) { const j = rnd(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
      st.n++; st.active = { stake, bombs: cells.slice(0, MINAS_BOMBS), revealed: [] }; await save();
      return minasView(st, { credits: Number(pay.rows[0].credits) });
    });
  }
  async function minasEnd(c, st, save, pack, win) {   // cierra la partida y paga si toca
    const bombs = st.active.bombs, stake = st.active.stake, revealed = st.active.revealed; st.active = null; await save();
    const credits = win ? await credit(c, pack.code, win) : Number((await c.query('SELECT credits FROM packs WHERE code = $1', [pack.code])).rows[0].credits);
    return { ...minasView(st), bombs, revealed, stake, win, net: win - stake, credits, ended: true };
  }
  async function minasReveal(req, body) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey(); gate(uid, 'minas');
    const i = Number(body && body.i); if (!Number.isInteger(i) || i < 0 || i >= MINAS_N) throw new HttpError(400, 'Casilla no válida');
    const pack = await ensureUserPack(user);
    return tx(async c => {
      const { st, save } = await minasState(c, uid, day);
      if (!st.active) throw new HttpError(409, 'No tienes ninguna partida abierta');
      if (st.active.revealed.includes(i)) throw new HttpError(409, 'Esa casilla ya está destapada');
      if (st.active.bombs.includes(i)) { st.active.revealed.push(i); return { ...(await minasEnd(c, st, save, pack, 0)), boom: true, hit: i }; }
      st.active.revealed.push(i);
      if (st.active.revealed.length === MINAS_N - MINAS_BOMBS) return { ...(await minasEnd(c, st, save, pack, Math.floor(st.active.stake * minasMult(st.active.revealed.length)))), cleared: true };
      await save(); return minasView(st);
    });
  }
  async function minasCash(req) {
    off(); const user = await needUser(req), uid = String(user.id), day = dayKey(); gate(uid, 'minas');
    const pack = await ensureUserPack(user);
    return tx(async c => {
      const { st, save } = await minasState(c, uid, day);
      if (!st.active) throw new HttpError(409, 'No tienes ninguna partida abierta');
      if (!st.active.revealed.length) throw new HttpError(409, 'Destapa al menos una casilla antes de cobrar');
      return { ...(await minasEnd(c, st, save, pack, Math.floor(st.active.stake * minasMult(st.active.revealed.length)))), cashed: true };
    });
  }

  return { ON, init, minasGet, minasStart, minasReveal, minasCash, ruleta: (r, b) => casinoPlay('ruleta', r, b), casinoGet, slots: (r, b) => casinoPlay('slots', r, b), plinko: (r, b) => casinoPlay('plinko', r, b), moneda: (r, b) => casinoPlay('moneda', r, b), rachaGet, rachaClaim, adivinaGet, adivinaAnswer, mmGet, mmGuess, cofresGet, cofresClaim, duelosGet, duelosReto, duelosAceptar, duelosRechazar };
};
