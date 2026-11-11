'use strict';
// RASCA Y GANA (servidor). Cada jugador tiene UNA tarjeta gratis al día. El servidor sortea el premio y lo paga en el momento;
// el navegador solo dibuja la tarjeta y deja rascar (rasca.js), así que no se puede "rascar de nuevo" ni cambiar el resultado.
// Se monta desde server.js igual que las cartas y la trivia:
//   const rascaMod = () => rascaMod.m || (rascaMod.m = require('./rasca-server')({ pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv }));
// y se llama a rascaMod().init() al arrancar. Rutas: GET /api/rasca → get, POST /api/rasca/play → play.
const crypto = require('node:crypto');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit } = d;
  const ON = String(process.env.RASCA || 'on').toLowerCase() !== 'off';
  // Premios: créditos, símbolo que sale 3 veces en la tarjeta y probabilidad (suman 100). Media ≈ 1,1 créditos por tarjeta.
  const PRIZES = [
    { credits: 0,  sym: null, p: 35 },
    { credits: 1,  sym: '🍀', p: 40 },
    { credits: 2,  sym: '⭐', p: 15 },
    { credits: 3,  sym: '💎', p: 7 },
    { credits: 5,  sym: '👑', p: 2.5 },
    { credits: 10, sym: '🚀', p: 0.5 }
  ];
  const SYMS = ['🍀', '⭐', '💎', '👑', '🚀', '🌎'];   // 🌎 solo sirve de relleno
  const CELLS = 6;

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS scratch_cards (user_id TEXT NOT NULL, day TEXT NOT NULL, credits INT NOT NULL, grid TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, day))');
  }

  function roll() {   // sorteo con la fuente de aleatoriedad del sistema
    const x = crypto.randomInt(0, 100_000) / 1000;   // 0 … 99,999
    let acc = 0;
    for (const pr of PRIZES) { acc += pr.p; if (x < acc) return pr; }
    return PRIZES[0];
  }
  const shuffle = a => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const counts = g => g.reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {});

  // Tarjeta de 6 casillas: con premio, el símbolo ganador sale EXACTAMENTE 3 veces y ningún otro llega a 3; sin premio, ninguno llega a 3.
  function makeGrid(prize) {
    for (;;) {
      const g = [];
      if (prize.sym) for (let i = 0; i < 3; i++) g.push(prize.sym);
      const fill = SYMS.filter(s => s !== prize.sym);
      while (g.length < CELLS) g.push(prize.sym ? fill[crypto.randomInt(fill.length)] : SYMS[crypto.randomInt(SYMS.length)]);
      const c = counts(g);
      const ok = prize.sym ? c[prize.sym] === 3 && Object.keys(c).every(s => s === prize.sym || c[s] <= 2) : Object.values(c).every(n => n <= 2);
      if (ok) return shuffle(g);
    }
  }

  async function get(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req); const uid = String(user.id);
    const r = (await all('SELECT credits, grid FROM scratch_cards WHERE user_id = $1 AND day = $2', [uid, dayKey()]))[0];
    const prizes = PRIZES.filter(p => p.credits > 0).map(p => ({ credits: p.credits, sym: p.sym }));
    return r ? { ok: true, on: true, played: true, prize: Number(r.credits), grid: JSON.parse(r.grid), prizes }
             : { ok: true, on: true, played: false, prizes };
  }

  async function play(req) {
    if (!ON) throw new HttpError(404, 'El rasca y gana está desactivado');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('rasca:' + uid, 60_000) > 10) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const pack = await ensureUserPack(user);
    const prize = roll(), grid = makeGrid(prize);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query('INSERT INTO scratch_cards (user_id, day, credits, grid, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [uid, dayKey(), prize.credits, JSON.stringify(grid), Date.now()]);
      if (!ins.rowCount) throw new HttpError(409, 'Ya has rascado tu tarjeta de hoy. ¡Vuelve mañana!');
      let credits;
      if (prize.credits > 0) credits = Number((await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING credits', [prize.credits, pack.code])).rows[0].credits);
      else credits = Number(((await client.query('SELECT credits FROM packs WHERE code = $1', [pack.code])).rows[0] || {}).credits || 0);
      await client.query('COMMIT');
      return { ok: true, grid, prize: prize.credits, sym: prize.sym, credits };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  return { ON, init, get, play };
};
