'use strict';
// TRIVIA DE GEOGRAFÍA (servidor). El jugador responde N preguntas y gana créditos según los aciertos.
// El servidor decide TODO: elige las preguntas, baraja las opciones, mide el tiempo y paga. El navegador solo dibuja (trivia.js)
// y nunca recibe la respuesta correcta antes de contestar, así que no se puede hacer trampa desde el cliente.
// Se monta desde server.js igual que las cartas:
//   const trivia = require('./trivia-server')({ pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv });
// y se llama a trivia.init() al arrancar. Rutas: GET /api/trivia → trivia.get, POST /api/trivia/start → trivia.start, POST /api/trivia/answer → trivia.answer.
const crypto = require('node:crypto');
const BANK = require('./trivia-bank');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv } = d;
  const ON = String(process.env.TRIVIA || 'on').toLowerCase() !== 'off';
  const N = 5, PASS = 4;                                              // preguntas por partida y aciertos mínimos para ganar
  const GAMES_PER_DAY = numEnv('TRIVIA_GAMES_PER_DAY', 3);            // partidas al día por jugador
  const DAILY_MAX = numEnv('TRIVIA_DAILY_MAX_CREDITS', 4);            // tope de créditos que se pueden ganar al día
  const R_PASS = numEnv('TRIVIA_CREDITS_PASS', 1);                    // premio con 4 aciertos
  const R_PERFECT = numEnv('TRIVIA_CREDITS_PERFECT', 2);              // premio con 5 aciertos
  const TIME_MS = numEnv('TRIVIA_SECONDS', 20) * 1000;                // tiempo por pregunta
  const GRACE_MS = 4000;                                              // margen por la red

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS trivia_games (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, day TEXT NOT NULL, qs TEXT NOT NULL, pos INT NOT NULL DEFAULT 0, correct INT NOT NULL DEFAULT 0, asked_at BIGINT NOT NULL, finished BOOLEAN NOT NULL DEFAULT FALSE, credits INT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS trivia_games_user ON trivia_games (user_id, day)');
  }

  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  // Pregunta que ve el jugador: opciones ya barajadas y SIN decir cuál es la correcta.
  function view(g) {
    const qs = JSON.parse(g.qs), cur = qs[g.pos], b = BANK[cur.q], opts = [b.a, ...b.w];
    return { id: String(g.id), n: N, pos: Number(g.pos), correct: Number(g.correct), q: b.q, options: cur.o.map(i => opts[i]), seconds: TIME_MS / 1000 };
  }
  const gameRow = r => ({ id: r.id, qs: r.qs, pos: Number(r.pos), correct: Number(r.correct), asked_at: Number(r.asked_at), finished: !!r.finished, credits: Number(r.credits) });

  async function status(uid) {
    const rows = (await all('SELECT id, qs, pos, correct, asked_at, finished, credits FROM trivia_games WHERE user_id = $1 AND day = $2 ORDER BY id', [uid, dayKey()])).map(gameRow);
    const earned = rows.reduce((s, r) => s + r.credits, 0);
    return {
      ok: true, on: true, n: N, pass: PASS, rewardPass: R_PASS, rewardPerfect: R_PERFECT,
      gamesMax: GAMES_PER_DAY, gamesLeft: Math.max(0, GAMES_PER_DAY - rows.length), earned, dailyMax: DAILY_MAX,
      active: rows.some(r => !r.finished)
    };
  }

  async function get(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req);
    return status(String(user.id));
  }

  // Empieza una partida (o retoma la que quedó a medias hoy, con el tiempo de la pregunta reiniciado).
  async function start(req) {
    if (!ON) throw new HttpError(404, 'La trivia está desactivada');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('trivia:' + uid, 60_000) > 20) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const day = dayKey();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['trivia:' + uid]);   // evita crear dos partidas a la vez
      const rows = (await client.query('SELECT id, qs, pos, correct, asked_at, finished, credits FROM trivia_games WHERE user_id = $1 AND day = $2 ORDER BY id', [uid, day])).rows.map(gameRow);
      const open = rows.find(r => !r.finished);
      let g;
      if (open) {
        await client.query('UPDATE trivia_games SET asked_at = $1 WHERE id = $2', [Date.now(), open.id]);
        g = open;
      } else {
        if (rows.length >= GAMES_PER_DAY) throw new HttpError(429, `Hoy ya has jugado tus ${GAMES_PER_DAY} partidas. ¡Vuelve mañana!`);
        const recent = new Set();   // no repetir las preguntas de las últimas partidas
        for (const r of (await client.query('SELECT qs FROM trivia_games WHERE user_id = $1 ORDER BY id DESC LIMIT 3', [uid])).rows) for (const q of JSON.parse(r.qs)) recent.add(q.q);
        let pool_ = BANK.map((_, i) => i).filter(i => !recent.has(i));
        if (pool_.length < N) pool_ = BANK.map((_, i) => i);
        const qs = shuffle(pool_).slice(0, N).map(i => ({ q: i, o: shuffle([0, 1, 2, 3]) }));   // o: orden en que se muestran [correcta, mala1, mala2, mala3]
        const ins = await client.query('INSERT INTO trivia_games (user_id, day, qs, asked_at, created_at) VALUES ($1,$2,$3,$4,$4) RETURNING id', [uid, day, JSON.stringify(qs), Date.now()]);
        g = { id: ins.rows[0].id, qs: JSON.stringify(qs), pos: 0, correct: 0 };
      }
      await client.query('COMMIT');
      return { ok: true, game: view(g) };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  // Responde la pregunta actual. choice = posición de la opción elegida (0..3) o -1 si se acabó el tiempo.
  async function answer(req, body) {
    if (!ON) throw new HttpError(404, 'La trivia está desactivada');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('trivia:' + uid, 60_000) > 40) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const gid = String((body && body.game) || ''), choice = Math.floor(Number(body && body.choice));
    if (!/^\d{1,18}$/.test(gid) || !Number.isFinite(choice) || choice < -1 || choice > 3) throw new HttpError(400, 'Respuesta no válida');
    const pack = await ensureUserPack(user);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const row = (await client.query('SELECT id, user_id, day, qs, pos, correct, asked_at, finished, credits FROM trivia_games WHERE id = $1 AND user_id = $2 FOR UPDATE', [gid, uid])).rows[0];
      if (!row) throw new HttpError(404, 'Esa partida no existe');
      const g = gameRow(row);
      if (g.finished) throw new HttpError(409, 'Esa partida ya terminó');
      const cur = JSON.parse(g.qs)[g.pos], correctIndex = cur.o.indexOf(0);
      const late = Date.now() - g.asked_at > TIME_MS + GRACE_MS;
      const right = !late && choice === correctIndex;
      const pos = g.pos + 1, correct = g.correct + (right ? 1 : 0);
      if (pos < N) {
        await client.query('UPDATE trivia_games SET pos = $1, correct = $2, asked_at = $3 WHERE id = $4', [pos, correct, Date.now(), g.id]);
        await client.query('COMMIT');
        return { ok: true, right, late, correctIndex, done: false, correct, next: view({ id: g.id, qs: g.qs, pos, correct }) };
      }
      // Última pregunta: se cierra la partida y se paga UNA sola vez (la fila está bloqueada con FOR UPDATE).
      const reward = correct >= N ? R_PERFECT : correct >= PASS ? R_PASS : 0;
      const earned = Number((await client.query('SELECT COALESCE(SUM(credits), 0) AS n FROM trivia_games WHERE user_id = $1 AND day = $2', [uid, g.day])).rows[0].n);
      const grant = Math.min(reward, Math.max(0, DAILY_MAX - earned));
      await client.query('UPDATE trivia_games SET pos = $1, correct = $2, finished = TRUE, credits = $3 WHERE id = $4', [pos, correct, grant, g.id]);
      let credits;
      if (grant > 0) credits = Number((await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING credits', [grant, pack.code])).rows[0].credits);
      else credits = Number(((await client.query('SELECT credits FROM packs WHERE code = $1', [pack.code])).rows[0] || {}).credits || 0);
      await client.query('COMMIT');
      return { ok: true, right, late, correctIndex, done: true, correct, n: N, reward: grant, capped: grant < reward, credits };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  return { ON, init, get, start, answer };
};
