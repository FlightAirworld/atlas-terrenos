'use strict';
// PAREJAS CON TUS CARTAS (servidor). Memory de 12 casillas = 6 cartas repetidas. Se usan cartas coleccionables que tiene el jugador
// (si tiene menos de 6, se completa con otras al azar). El servidor guarda dónde está cada carta y SOLO enseña la que se gira, así que
// no se puede ver el tablero entero desde el navegador. Gana créditos según los intentos (un intento = girar 2 casillas).
// Se monta desde server.js igual que las demás:
//   const parejasMod = () => parejasMod.m || (parejasMod.m = require('./parejas-server')({ pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv }));
// y se llama a parejasMod().init() al arrancar. Rutas: GET /api/parejas, POST /api/parejas/start, POST /api/parejas/flip.
const crypto = require('node:crypto');
const core = require('./cards-core');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv } = d;
  const ON = String(process.env.PAREJAS || 'on').toLowerCase() !== 'off';
  const SEASON = String(process.env.CARDS_SEASON || 'T1');          // la misma temporada que las cartas
  const PAIRS = 6, CELLS = PAIRS * 2;
  const GAMES_PER_DAY = numEnv('PAREJAS_GAMES_PER_DAY', 2);          // partidas al día por jugador
  const DAILY_MAX = numEnv('PAREJAS_DAILY_MAX_CREDITS', 3);          // tope de créditos al día en este juego
  // Premio según los intentos (con memoria perfecta salen 6; al azar, bastantes más): [máx. intentos, créditos]
  const REWARDS = [[8, 3], [11, 2], [14, 1]];

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS pairs_games (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, day TEXT NOT NULL, layout TEXT NOT NULL, matched TEXT NOT NULL DEFAULT \'[]\', first_pos INT NOT NULL DEFAULT -1, attempts INT NOT NULL DEFAULT 0, mine INT NOT NULL DEFAULT 0, finished BOOLEAN NOT NULL DEFAULT FALSE, credits INT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS pairs_games_user ON pairs_games (user_id, day)');
  }

  const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const rewardFor = attempts => { for (const [max, cr] of REWARDS) if (attempts <= max) return cr; return 0; };
  function brief(id) {   // lo mínimo que necesita el navegador para dibujar la carta
    const i = core.cardInfo(id, SEASON);
    return { id: i.id, emoji: i.emoji, name: i.name, rarity: i.rarityName, c1: i.c1, c2: i.c2, element: i.element };
  }
  const row = r => ({ id: String(r.id), user_id: String(r.user_id), day: r.day, layout: JSON.parse(r.layout), matched: JSON.parse(r.matched), first: Number(r.first_pos), attempts: Number(r.attempts), mine: Number(r.mine), finished: !!r.finished, credits: Number(r.credits) });
  const COLS = 'id, user_id, day, layout, matched, first_pos, attempts, mine, finished, credits';
  // Vista para el jugador: SOLO las cartas ya descubiertas (parejas encontradas y la primera del giro pendiente).
  const view = g => ({
    id: g.id, pairs: PAIRS, cells: CELLS, attempts: g.attempts, mine: g.mine,
    matched: g.matched.map(p => ({ pos: p, card: brief(g.layout[p]) })),
    first: g.first >= 0 ? { pos: g.first, card: brief(g.layout[g.first]) } : null
  });

  async function myCardIds(uid) {
    try { return (await all('SELECT card_id FROM card_owned WHERE user_id = $1 AND season = $2', [uid, SEASON])).map(r => Number(r.card_id)); }
    catch (e) { return []; }   // cartas desactivadas o tabla aún sin crear: se juega con cartas de regalo
  }

  async function status(uid) {
    const rows = (await all(`SELECT ${COLS} FROM pairs_games WHERE user_id = $1 AND day = $2 ORDER BY id`, [uid, dayKey()])).map(row);
    return {
      ok: true, on: true, pairs: PAIRS, gamesMax: GAMES_PER_DAY, gamesLeft: Math.max(0, GAMES_PER_DAY - rows.length),
      earned: rows.reduce((s, r) => s + r.credits, 0), dailyMax: DAILY_MAX, active: rows.some(r => !r.finished),
      rewards: REWARDS.map(([max, credits]) => ({ max, credits }))
    };
  }
  async function get(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req);
    return status(String(user.id));
  }

  async function start(req) {
    if (!ON) throw new HttpError(404, 'Las parejas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('parejas:' + uid, 60_000) > 20) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const day = dayKey();
    const mineAll = await myCardIds(uid);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['parejas:' + uid]);
      const rows = (await client.query(`SELECT ${COLS} FROM pairs_games WHERE user_id = $1 AND day = $2 ORDER BY id`, [uid, day])).rows.map(row);
      let g = rows.find(r => !r.finished);
      if (!g) {
        if (rows.length >= GAMES_PER_DAY) throw new HttpError(429, `Hoy ya has jugado tus ${GAMES_PER_DAY} partidas. ¡Vuelve mañana!`);
        const chosen = shuffle(mineAll).slice(0, PAIRS), mine = chosen.length;
        const used = new Set(chosen);
        while (chosen.length < PAIRS) { const id = 1 + crypto.randomInt(core.TOTAL); if (!used.has(id)) { used.add(id); chosen.push(id); } }   // cartas de relleno
        const layout = shuffle([...chosen, ...chosen]);
        const ins = await client.query('INSERT INTO pairs_games (user_id, day, layout, mine, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id', [uid, day, JSON.stringify(layout), mine, Date.now()]);
        g = { id: String(ins.rows[0].id), layout, matched: [], first: -1, attempts: 0, mine };
      }
      await client.query('COMMIT');
      return { ok: true, game: view(g) };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  // Gira una casilla. 1.ª del intento → solo se enseña. 2.ª → se cuenta el intento y se dice si hay pareja.
  async function flip(req, body) {
    if (!ON) throw new HttpError(404, 'Las parejas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('parejas-flip:' + uid, 60_000) > 120) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const gid = String((body && body.game) || ''), pos = Math.floor(Number(body && body.pos));
    if (!/^\d{1,18}$/.test(gid) || !Number.isInteger(pos) || pos < 0 || pos >= CELLS) throw new HttpError(400, 'Casilla no válida');
    const pack = await ensureUserPack(user);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = (await client.query(`SELECT ${COLS} FROM pairs_games WHERE id = $1 AND user_id = $2 FOR UPDATE`, [gid, uid])).rows[0];
      if (!r) throw new HttpError(404, 'Esa partida no existe');
      const g = row(r);
      if (g.finished) throw new HttpError(409, 'Esa partida ya terminó');
      if (g.matched.includes(pos) || pos === g.first) throw new HttpError(409, 'Esa casilla ya está descubierta');
      const card = brief(g.layout[pos]);
      if (g.first < 0) {   // primera casilla del intento
        await client.query('UPDATE pairs_games SET first_pos = $1 WHERE id = $2', [pos, g.id]);
        await client.query('COMMIT');
        return { ok: true, card, match: null, attempts: g.attempts };
      }
      const attempts = g.attempts + 1, match = g.layout[g.first] === g.layout[pos], first = g.first;
      if (!match) {
        await client.query('UPDATE pairs_games SET first_pos = -1, attempts = $1 WHERE id = $2', [attempts, g.id]);
        await client.query('COMMIT');
        return { ok: true, card, match: false, first, attempts, done: false };
      }
      const matched = [...g.matched, first, pos];
      if (matched.length < CELLS) {
        await client.query('UPDATE pairs_games SET first_pos = -1, attempts = $1, matched = $2 WHERE id = $3', [attempts, JSON.stringify(matched), g.id]);
        await client.query('COMMIT');
        return { ok: true, card, match: true, first, attempts, done: false, found: matched.length / 2 };
      }
      // Última pareja: se cierra y se paga UNA vez (fila bloqueada con FOR UPDATE).
      const reward = rewardFor(attempts);
      const earned = Number((await client.query('SELECT COALESCE(SUM(credits), 0) AS n FROM pairs_games WHERE user_id = $1 AND day = $2', [uid, g.day])).rows[0].n);
      const grant = Math.min(reward, Math.max(0, DAILY_MAX - earned));
      await client.query('UPDATE pairs_games SET first_pos = -1, attempts = $1, matched = $2, finished = TRUE, credits = $3 WHERE id = $4', [attempts, JSON.stringify(matched), grant, g.id]);
      let credits;
      if (grant > 0) credits = Number((await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING credits', [grant, pack.code])).rows[0].credits);
      else credits = Number(((await client.query('SELECT credits FROM packs WHERE code = $1', [pack.code])).rows[0] || {}).credits || 0);
      await client.query('COMMIT');
      return { ok: true, card, match: true, first, attempts, done: true, found: PAIRS, reward: grant, capped: grant < reward, credits };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  return { ON, init, get, start, flip };
};
