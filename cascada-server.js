'use strict';
// CASCADA (servidor). La tragaperras usa los MISMOS créditos que el jugador tiene en todo el juego (tabla packs).
// El servidor sortea con crypto y cobra/paga en una sola operación atómica; el navegador (cascada/game.js) solo dibuja el resultado.
// Se monta desde server.js igual que el rasca y gana (lo hace cascada-wire.js al instalar):
//   const cascadaMod = () => cascadaMod.m || (cascadaMod.m = require('./cascada-server')({ pool, run, all, needUser, ensureUserPack, HttpError, rateHit }));
// y se llama a cascadaMod().init() al arrancar. Rutas: GET /api/cascada → get, POST /api/cascada/play {n} → play.
const Engine = require('./cascada/engine.js');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, HttpError, rateHit } = d;
  const ON = String(process.env.CASCADA || 'on').toLowerCase() !== 'off';
  const MAX_N = 100;          // partidas máximas por petición
  const MAX_PER_MIN = 150;    // peticiones por minuto y jugador

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS cascada_stats (user_id TEXT PRIMARY KEY, spins BIGINT NOT NULL DEFAULT 0, won BIGINT NOT NULL DEFAULT 0, best INT NOT NULL DEFAULT 0, botes_rio INT NOT NULL DEFAULT 0, botes_mar INT NOT NULL DEFAULT 0, botes_cas INT NOT NULL DEFAULT 0, last TEXT, updated_at BIGINT NOT NULL)');
  }

  const statsOf = row => {
    if (!row) return { spins: 0, won: 0, best: 0, botes: [0, 0, 0, 0], last: null };
    let last = null; try { last = row.last ? JSON.parse(row.last) : null; } catch (e) { /* sin último premio */ }
    return { spins: Number(row.spins), won: Number(row.won), best: Number(row.best), botes: [0, Number(row.botes_rio), Number(row.botes_mar), Number(row.botes_cas)], last };
  };

  async function get(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req); const uid = String(user.id);
    const pack = await ensureUserPack(user);
    const cr = (await all('SELECT credits FROM packs WHERE code = $1', [pack.code]))[0];
    const st = (await all('SELECT * FROM cascada_stats WHERE user_id = $1', [uid]))[0];
    return { ok: true, on: true, credits: Number((cr || {}).credits || 0), stats: statsOf(st) };
  }

  async function play(req, body) {
    if (!ON) throw new HttpError(404, 'Cascada está desactivada');
    const user = await needUser(req); const uid = String(user.id);
    const n = Math.floor(Number(body && body.n));
    if (!Number.isFinite(n) || n < 1 || n > MAX_N) throw new HttpError(400, `Se pueden jugar de 1 a ${MAX_N} partidas cada vez`);
    if (rateHit('cascada:' + uid, 60_000) > MAX_PER_MIN) throw new HttpError(429, 'Vas muy rápido. Espera un momento');
    const pack = await ensureUserPack(user);

    // El sorteo se hace antes de tocar la base de datos; si luego no hay créditos, no se guarda nada
    const results = []; let prize = 0, best = 0; const bt = [0, 0, 0, 0]; let last = null;
    for (let i = 0; i < n; i++) {
      const r = Engine.play();
      results.push(r); prize += r.prize; bt[r.tier]++;
      if (r.prize > best) best = r.prize;
      if (r.prize) last = { prize: r.prize, tier: r.tier, sym: r.sym, count: r.count };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // cobra n y paga los premios en UNA sola sentencia: no se puede gastar dos veces el mismo saldo
      const up = await client.query('UPDATE packs SET credits = credits - $1 + $2 WHERE code = $3 AND credits >= $1 RETURNING credits', [n, prize, pack.code]);
      if (!up.rows.length) throw new HttpError(402, 'No tienes créditos suficientes');
      const st = await client.query(
        'INSERT INTO cascada_stats (user_id, spins, won, best, botes_rio, botes_mar, botes_cas, last, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ' +
        'ON CONFLICT (user_id) DO UPDATE SET spins = cascada_stats.spins + EXCLUDED.spins, won = cascada_stats.won + EXCLUDED.won, best = GREATEST(cascada_stats.best, EXCLUDED.best), ' +
        'botes_rio = cascada_stats.botes_rio + EXCLUDED.botes_rio, botes_mar = cascada_stats.botes_mar + EXCLUDED.botes_mar, botes_cas = cascada_stats.botes_cas + EXCLUDED.botes_cas, ' +
        'last = COALESCE(EXCLUDED.last, cascada_stats.last), updated_at = EXCLUDED.updated_at RETURNING *',
        [uid, n, prize, best, bt[1], bt[2], bt[3], last ? JSON.stringify(last) : null, Date.now()]);
      await client.query('COMMIT');
      return { ok: true, credits: Number(up.rows[0].credits), results, stats: statsOf(st.rows[0]) };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  return { ON, init, get, play };
};
