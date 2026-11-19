'use strict';
// CASCADA (servidor). La tragaperras usa los MISMOS créditos que el jugador tiene en todo el juego (tabla packs).
// El servidor sortea con crypto y cobra/paga en una sola operación atómica; el navegador (cascada/game.js) solo dibuja el resultado.
// APUESTA: cada partida cuesta m créditos (m de 1 a 50) y todos sus premios se multiplican por m.
// BOTES: cada partida suma 10 × m a cada bote.
// PERDIDO: saldo neto = apuestas − premios (botes y tesoro incluidos).
// TESORO: tres cofres en la línea central abren una partida especial de 15 cartas (3 bombas). El tablero lo sortea el SERVIDOR
//   al jugar la partida y no sale de aquí hasta que el jugador destapa cada carta; el acumulado solo se paga al cobrar.
// Rutas: GET /api/cascada → get, POST /api/cascada/play {n, m} → play, POST /api/cascada/bonus/{state|pick|cash} → bonus.
const crypto = require('node:crypto');
const Engine = require('./cascada/engine.js');
const { advance: advanceJackpots } = require('./cascada/jackpots.js');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, HttpError, rateHit } = d;
  const ON = String(process.env.CASCADA || 'on').toLowerCase() !== 'off';
  const MAX_N = 100;          // partidas máximas por petición
  const MAX_M = 50;           // apuesta máxima por partida (multiplicador)
  const MAX_PER_MIN = 150;    // peticiones por minuto y jugador
  const CARDS = 15, BOMBS = 3, SAFE = CARDS - BOMBS;
  // 12 cartas con premio (se multiplican por la apuesta) + 3 bombas
  const BASE = [1, 1, 1, 2, 2, 2, 3, 3, 5, 5, 10, 20];

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const newBoard = (m) => shuffle(BASE.map((v) => v * m).concat(new Array(BOMBS).fill(0)));   // 0 = bomba

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS cascada_stats (user_id TEXT PRIMARY KEY, spins BIGINT NOT NULL DEFAULT 0, won BIGINT NOT NULL DEFAULT 0, best INT NOT NULL DEFAULT 0, botes_rio INT NOT NULL DEFAULT 0, botes_mar INT NOT NULL DEFAULT 0, botes_cas INT NOT NULL DEFAULT 0, last TEXT, updated_at BIGINT NOT NULL)');
    await run('ALTER TABLE cascada_stats ADD COLUMN IF NOT EXISTS spent BIGINT NOT NULL DEFAULT 0');   // créditos gastados
    await run('ALTER TABLE cascada_stats ADD COLUMN IF NOT EXISTS lost BIGINT NOT NULL DEFAULT 0');     // pérdida neta acumulada (apuestas − premios)
    await run('CREATE TABLE IF NOT EXISTS cascada_jackpots (id SMALLINT PRIMARY KEY CHECK (id = 1), rio BIGINT NOT NULL DEFAULT 0, mar BIGINT NOT NULL DEFAULT 0, cas BIGINT NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL)');
    await run('INSERT INTO cascada_jackpots (id, rio, mar, cas, updated_at) VALUES (1,0,0,0,$1) ON CONFLICT (id) DO NOTHING', [Date.now()]);
    await run('CREATE TABLE IF NOT EXISTS cascada_bonus (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, mult INT NOT NULL, board TEXT NOT NULL, picked TEXT NOT NULL DEFAULT \'[]\', acc BIGINT NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT \'open\', created_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS cascada_bonus_user ON cascada_bonus (user_id, state)');
  }

  const statsOf = row => {
    if (!row) return { spins: 0, won: 0, best: 0, spent: 0, lost: 0, botes: [0, 0, 0, 0], last: null };
    let last = null; try { last = row.last ? JSON.parse(row.last) : null; } catch (e) { /* sin último premio */ }
    return { spins: Number(row.spins), won: Number(row.won), best: Number(row.best), spent: Number(row.spent || 0), lost: Number(row.lost || 0), botes: [0, Number(row.botes_rio), Number(row.botes_mar), Number(row.botes_cas)], last };
  };

  async function get(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req); const uid = String(user.id);
    const pack = await ensureUserPack(user);
    const cr = (await all('SELECT credits FROM packs WHERE code = $1', [pack.code]))[0];
    const st = (await all('SELECT * FROM cascada_stats WHERE user_id = $1', [uid]))[0];
    const jp = (await all('SELECT rio, mar, cas FROM cascada_jackpots WHERE id = 1'))[0] || { rio: 0, mar: 0, cas: 0 };
    const pend = (await all('SELECT COUNT(*) AS n FROM cascada_bonus WHERE user_id = $1 AND state = $2', [uid, 'open']))[0];
    return { ok: true, on: true, credits: Number((cr || {}).credits || 0), maxMult: MAX_M, stats: statsOf(st), jackpots: { rio: Number(jp.rio), mar: Number(jp.mar), cas: Number(jp.cas) }, bonusPending: Number((pend || {}).n || 0) };
  }

  async function play(req, body) {
    if (!ON) throw new HttpError(404, 'Cascada está desactivada');
    const user = await needUser(req); const uid = String(user.id);
    const n = Math.floor(Number(body && body.n));
    if (!Number.isFinite(n) || n < 1 || n > MAX_N) throw new HttpError(400, `Se pueden jugar de 1 a ${MAX_N} partidas cada vez`);
    const m = body && body.m !== undefined && body.m !== null ? Math.floor(Number(body.m)) : 1;
    if (!Number.isFinite(m) || m < 1 || m > MAX_M) throw new HttpError(400, `La apuesta va de 1 a ${MAX_M} créditos por partida`);
    if (rateHit('cascada:' + uid, 60_000) > MAX_PER_MIN) throw new HttpError(429, 'Vas muy rápido. Espera un momento');
    const pack = await ensureUserPack(user);
    const cost = n * m;         // lo que cuestan todas las partidas pedidas

    // El sorteo se hace antes de tocar la base de datos; si luego no hay créditos, no se guarda nada
    // Los botes (tier) los marca el premio base; el premio que se paga es el base × apuesta.
    const results = []; let prize = 0, best = 0, lost = 0; const bt = [0, 0, 0, 0]; let last = null;
    for (let i = 0; i < n; i++) {
      const r = Engine.play();
      r.prize *= m; r.mult = m;
      results.push(r); prize += r.prize; lost += m - r.prize; bt[r.tier]++;
      if (r.prize > best) best = r.prize;
      if (r.prize) last = { prize: r.prize, tier: r.tier, sym: r.sym, count: r.count };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Bloqueo global: todos los jugadores comparten una única fila de botes.
      // Se suma exactamente una vez por partida (10 × apuesta), nunca por cada línea o símbolo premiado.
      const jpq = await client.query('SELECT rio, mar, cas FROM cascada_jackpots WHERE id = 1 FOR UPDATE');
      if (!jpq.rows.length) throw new Error('No existe la fila global de botes de Cascada');
      let pots = [0, Number(jpq.rows[0].rio), Number(jpq.rows[0].mar), Number(jpq.rows[0].cas)];
      for (const r of results) {
        const moved = advanceJackpots(pots, r.tier, m);
        pots = moved.jackpots;
        if (moved.payout > 0) {
          r.jackpot = moved.payout;
          r.prize += moved.payout;
        }
      }
      // Recalcular importes incluyendo los botes progresivos antes de actualizar saldo y estadísticas.
      prize = results.reduce((sum, r) => sum + r.prize, 0);
      lost = results.reduce((sum, r) => sum + (m - r.prize), 0);   // pérdida neta: apuesta − premio (puede ser negativa)
      best = results.reduce((v, r) => Math.max(v, r.prize), 0);
      last = null;
      for (let i = results.length - 1; i >= 0; i--) {
        const r = results[i];
        if (r.prize > 0) { last = { prize: r.prize, tier: r.tier, sym: r.sym, count: r.count }; break; }
      }
      await client.query('UPDATE cascada_jackpots SET rio=$1, mar=$2, cas=$3, updated_at=$4 WHERE id=1', [pots[1], pots[2], pots[3], Date.now()]);
      // Cobra y paga en la misma transacción que actualiza los botes.
      const up = await client.query('UPDATE packs SET credits = credits - $1 + $2 WHERE code = $3 AND credits >= $1 RETURNING credits', [cost, prize, pack.code]);
      if (!up.rows.length) throw new HttpError(402, 'No tienes créditos suficientes');
      // cada «tres cofres» crea su partida del tesoro con el tablero ya sorteado (el cliente solo recibe el id)
      for (const r of results) {
        if (!r.bonus) continue;
        const ins = await client.query('INSERT INTO cascada_bonus (user_id, mult, board, created_at) VALUES ($1,$2,$3,$4) RETURNING id', [uid, m, JSON.stringify(newBoard(m)), Date.now()]);
        r.bonusId = Number(ins.rows[0].id);
      }
      const st = await client.query(
        'INSERT INTO cascada_stats (user_id, spins, won, best, botes_rio, botes_mar, botes_cas, last, updated_at, spent, lost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ' +
        'ON CONFLICT (user_id) DO UPDATE SET spins = cascada_stats.spins + EXCLUDED.spins, won = cascada_stats.won + EXCLUDED.won, best = GREATEST(cascada_stats.best, EXCLUDED.best), ' +
        'botes_rio = cascada_stats.botes_rio + EXCLUDED.botes_rio, botes_mar = cascada_stats.botes_mar + EXCLUDED.botes_mar, botes_cas = cascada_stats.botes_cas + EXCLUDED.botes_cas, ' +
        'last = COALESCE(EXCLUDED.last, cascada_stats.last), updated_at = EXCLUDED.updated_at, spent = cascada_stats.spent + EXCLUDED.spent, lost = cascada_stats.lost + EXCLUDED.lost RETURNING *',
        [uid, n, prize, best, bt[1], bt[2], bt[3], last ? JSON.stringify(last) : null, Date.now(), cost, lost]);
      await client.query('COMMIT');
      return { ok: true, credits: Number(up.rows[0].credits), mult: m, results, stats: statsOf(st.rows[0]), jackpots: { rio: pots[1], mar: pots[2], cas: pots[3] } };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  /* ---------------- partida especial del tesoro ---------------- */
  const parse = (s, def) => { try { return JSON.parse(s); } catch (e) { return def; } };
  const view = (row) => {
    const board = parse(row.board, []), picked = parse(row.picked, []);
    return { id: Number(row.id), mult: Number(row.mult), acc: Number(row.acc), cards: CARDS, bombs: BOMBS, safe: SAFE, picked: picked.map((i) => ({ i, v: board[i] })) };
  };

  // Cierra la partida: paga el acumulado (cobro) o no paga nada (bomba) y apunta las estadísticas. Se llama dentro de la transacción.
  async function finish(client, row, uid, packCode, pay) {
    await client.query('UPDATE cascada_bonus SET state = $1 WHERE id = $2', [pay > 0 ? 'cashed' : 'done', row.id]);
    if (pay <= 0) {
      const cr = await client.query('SELECT credits FROM packs WHERE code = $1', [packCode]);
      return Number((cr.rows[0] || {}).credits || 0);
    }
    const up = await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING credits', [pay, packCode]);
    const last = JSON.stringify({ prize: pay, tier: 0, sym: 7, count: 3, bonus: true });
    // el premio del tesoro también se descuenta de PERDIDO (lost = lost - pay)
    await client.query(
      'INSERT INTO cascada_stats (user_id, spins, won, best, last, updated_at, lost) VALUES ($1,0,$2,$3,$4,$5,$6) ' +
      'ON CONFLICT (user_id) DO UPDATE SET won = cascada_stats.won + EXCLUDED.won, best = GREATEST(cascada_stats.best, EXCLUDED.best), last = EXCLUDED.last, updated_at = EXCLUDED.updated_at, lost = cascada_stats.lost - EXCLUDED.won',
      [uid, pay, pay, last, Date.now(), -pay]);
    return Number(up.rows[0].credits);
  }

  async function bonus(req, action, body) {
    if (!ON) throw new HttpError(404, 'Cascada está desactivada');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cascada-b:' + uid, 60_000) > 200) throw new HttpError(429, 'Vas muy rápido. Espera un momento');
    body = body || {};
    if (action === 'state') {
      const id = Math.floor(Number(body.id));
      const rows = Number.isFinite(id) && id > 0
        ? await all('SELECT * FROM cascada_bonus WHERE id = $1 AND user_id = $2 AND state = $3', [id, uid, 'open'])
        : await all('SELECT * FROM cascada_bonus WHERE user_id = $1 AND state = $2 ORDER BY id LIMIT 1', [uid, 'open']);
      return { ok: true, bonus: rows[0] ? view(rows[0]) : null };
    }
    if (action !== 'pick' && action !== 'cash') throw new HttpError(404, 'No existe');
    const id = Math.floor(Number(body.id));
    if (!Number.isFinite(id) || id < 1) throw new HttpError(400, 'Partida no válida');
    const pack = await ensureUserPack(user);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sel = await client.query('SELECT * FROM cascada_bonus WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, uid]);   // bloquea la fila: no se puede pagar dos veces
      const row = sel.rows[0];
      if (!row || row.state !== 'open') throw new HttpError(409, 'Esta partida especial ya ha terminado');
      const board = parse(row.board, []), picked = parse(row.picked, []);
      let acc = Number(row.acc);

      if (action === 'cash') {
        const credits = await finish(client, row, uid, pack.code, acc);
        await client.query('COMMIT');
        return { ok: true, done: true, paid: acc, credits, board };
      }

      const i = Math.floor(Number(body.i));
      if (!Number.isInteger(i) || i < 0 || i >= CARDS) throw new HttpError(400, 'Carta no válida');
      if (picked.includes(i)) throw new HttpError(400, 'Esa carta ya está destapada');
      const v = board[i];
      if (v === 0) {   // BOMBA: se pierde todo el acumulado
        await client.query('UPDATE cascada_bonus SET state = $1, acc = 0 WHERE id = $2', ['bomb', id]);
        const cr = await client.query('SELECT credits FROM packs WHERE code = $1', [pack.code]);
        await client.query('COMMIT');
        return { ok: true, bomb: true, done: true, lost: acc, i, credits: Number((cr.rows[0] || {}).credits || 0), board };
      }
      acc += v; picked.push(i);
      if (picked.length >= SAFE) {   // ha destapado todas las cartas sin bomba: se cobra solo
        await client.query('UPDATE cascada_bonus SET picked = $1, acc = $2 WHERE id = $3', [JSON.stringify(picked), acc, id]);
        const credits = await finish(client, Object.assign({}, row), uid, pack.code, acc);
        await client.query('COMMIT');
        return { ok: true, i, v, acc, done: true, all: true, paid: acc, credits, board };
      }
      await client.query('UPDATE cascada_bonus SET picked = $1, acc = $2 WHERE id = $3', [JSON.stringify(picked), acc, id]);
      await client.query('COMMIT');
      return { ok: true, i, v, acc, done: false, left: SAFE - picked.length };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  return { ON, init, get, play, bonus };
};
