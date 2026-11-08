'use strict';
// CARTAS COLECCIONABLES (servidor). Cada carta (1..10000 de la temporada) existe UNA sola vez: la clave primaria (season, card_id) de
// card_owned impide que dos jugadores tengan la misma. Los sobres se ganan o se compran y se abren aquí: el servidor elige la carta al azar
// entre las que aún no ha sacado nadie (con las probabilidades de cada tipo de sobre). El cliente solo dibuja (cards.js).
// Se monta desde server.js:  const cards = require('./cards-server')({ pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv });
const crypto = require('node:crypto');
const core = require('./cards-core');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv } = d;
  const ON = String(process.env.CARDS || 'on').toLowerCase() !== 'off';
  const SEASON = String(process.env.CARDS_SEASON || 'T1');
  // Probabilidades (%) de [común, rara, épica, legendaria, oro] y precio en créditos de cada sobre
  const PACKS = {
    bronce: { name: 'Sobre de Bronce', odds: [78, 18, 3.5, 0.5, 0],   cost: numEnv('CARDS_COST_BRONCE', 2) },
    plata:  { name: 'Sobre de Plata',  odds: [45, 38, 14, 2.9, 0.1], cost: numEnv('CARDS_COST_PLATA', 8) },
    oro:    { name: 'Sobre de Oro',    odds: [0, 40, 45, 13.5, 1.5], cost: numEnv('CARDS_COST_ORO', 30) }
  };
  const BUY_DAILY_MAX = numEnv('CARDS_BUY_DAILY_MAX', 20);
  // Premios por tener N cartas de un mismo grupo (se pagan una sola vez por jugador, grupo y premio): [cartas, sobre, créditos]
  const GROUP_CREDITS = numEnv('CARDS_GROUP_CREDITS', 100);
  const MILESTONES = [[10, 'bronce', 0], [25, 'plata', 0], [50, 'oro', 0], [100, 'oro', GROUP_CREDITS]];
  const TRADE_MIN_AGE_H = numEnv('CARDS_TRADE_MIN_AGE_H', 24), TRADE_OPEN_MAX = 10;

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS card_owned (season TEXT NOT NULL, card_id INT NOT NULL, user_id TEXT NOT NULL, obtained_at BIGINT NOT NULL, source TEXT, PRIMARY KEY (season, card_id))');
    await run('CREATE INDEX IF NOT EXISTS card_owned_user ON card_owned (user_id, season)');
    await run('CREATE TABLE IF NOT EXISTS card_packs (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, season TEXT NOT NULL, kind TEXT NOT NULL, source TEXT, created_at BIGINT NOT NULL, opened_at BIGINT, card_id INT)');
    await run('CREATE INDEX IF NOT EXISTS card_packs_user ON card_packs (user_id, opened_at)');
    await run('CREATE TABLE IF NOT EXISTS card_daily (user_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day))');
    await run('CREATE TABLE IF NOT EXISTS card_claims (user_id TEXT NOT NULL, season TEXT NOT NULL, key TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, season, key))');
    await run('CREATE TABLE IF NOT EXISTS card_trades (id BIGSERIAL PRIMARY KEY, season TEXT NOT NULL, from_user TEXT NOT NULL, to_user TEXT NOT NULL, from_nick TEXT NOT NULL, to_nick TEXT NOT NULL, offer_card INT NOT NULL, want_card INT, status TEXT NOT NULL DEFAULT \'open\', created_at BIGINT NOT NULL, resolved_at BIGINT)');
    await run('CREATE INDEX IF NOT EXISTS card_trades_to ON card_trades (to_user, status)');
    await run('CREATE INDEX IF NOT EXISTS card_trades_from ON card_trades (from_user, status)');
    for (const t of ['card_claims', 'card_trades']) await run(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`).catch(() => {});
    for (const t of ['card_owned', 'card_packs', 'card_daily']) await run(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`).catch(() => {});
  }

  // Da un sobre a un jugador (lo usan el regalo diario, las luchas, la compra y lo que añadas: misiones, álbum, subir de nivel…)
  async function grantPack(uid, kind, source, q) {
    if (!ON || !PACKS[kind]) return null;
    const r = await (q || run)('INSERT INTO card_packs (user_id, season, kind, source, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id', [String(uid), SEASON, kind, String(source || ''), Date.now()]);
    return r.rows[0].id;
  }

  function weightedIndex(weights, allowed) {   // elige un índice de rareza según los pesos, solo entre los que aún tienen cartas libres
    let sum = 0; weights.forEach((w, i) => { if (allowed[i]) sum += w; });
    if (sum <= 0) return -1;
    let x = (crypto.randomInt(0, 1_000_000) / 1_000_000) * sum;
    for (let i = 0; i < weights.length; i++) { if (!allowed[i]) continue; if (x < weights[i]) return i; x -= weights[i]; }
    return weights.findLastIndex((w, i) => allowed[i]);
  }

  async function state(uid) {
    const [owned, packs, minted, daily, claims, tin] = await Promise.all([
      all('SELECT card_id AS id, obtained_at AS at FROM card_owned WHERE season = $1 AND user_id = $2 ORDER BY card_id', [SEASON, uid]),
      all('SELECT id, kind, source FROM card_packs WHERE user_id = $1 AND season = $2 AND opened_at IS NULL ORDER BY id', [uid, SEASON]),
      all('SELECT COUNT(*)::int AS n FROM card_owned WHERE season = $1', [SEASON]),
      all('SELECT 1 FROM card_daily WHERE user_id = $1 AND day = $2', [uid, dayKey()]),
      all('SELECT key FROM card_claims WHERE user_id = $1 AND season = $2', [uid, SEASON]),
      all("SELECT COUNT(*)::int AS n FROM card_trades WHERE to_user = $1 AND season = $2 AND status = 'open'", [uid, SEASON])
    ]);
    return { ok: true, on: true, season: SEASON, seasonName: (core.SEASONS[SEASON] || {}).name || SEASON, total: core.TOTAL, group: core.GROUP,
      owned: owned.map(r => ({ id: r.id, at: Number(r.at) })), packs, minted: minted[0].n, dailyReady: !daily.length, claims: claims.map(r => r.key), tradesIn: tin[0].n,
      milestones: MILESTONES.map(([n, kind, cr]) => ({ n, kind, credits: cr })),
      shop: Object.fromEntries(Object.entries(PACKS).map(([k, v]) => [k, { name: v.name, cost: v.cost, odds: v.odds }])) };
  }

  async function get(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req);
    return state(String(user.id));
  }

  async function daily(req) {   // 1 sobre de bronce gratis al día
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cards:' + uid, 60_000) > 30) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const ins = await run('INSERT INTO card_daily (user_id, day) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, dayKey()]);
    if (!ins.rowCount) throw new HttpError(409, 'Ya has recogido el sobre de hoy. ¡Vuelve mañana!');
    await grantPack(uid, 'bronce', 'diario');
    return state(uid);
  }

  async function buy(req, body) {   // compra un sobre con créditos
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cards:' + uid, 60_000) > 30) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const kind = String((body && body.kind) || ''); const P = PACKS[kind];
    if (!P) throw new HttpError(400, 'Ese sobre no existe');
    const pack = await ensureUserPack(user);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const bought = Number((await client.query("SELECT COUNT(*) AS n FROM card_packs WHERE user_id = $1 AND source = 'compra' AND created_at > $2", [uid, Date.now() - 86_400_000])).rows[0].n);
      if (bought >= BUY_DAILY_MAX) throw new HttpError(429, `Máximo ${BUY_DAILY_MAX} sobres comprados cada 24 h`);
      const r = await client.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [P.cost, pack.code]);
      if (!r.rows.length) throw new HttpError(402, `Te faltan créditos: este sobre cuesta ${P.cost}`);
      await grantPack(uid, kind, 'compra', (t, p) => client.query(t, p));
      await client.query('COMMIT');
      return { ...(await state(uid)), credits: Number(r.rows[0].credits) };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  async function open(req, body) {   // abre un sobre: el servidor reparte una carta que nadie tenga
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cards:' + uid, 60_000) > 30) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const wanted = Math.floor(Number(body && body.packId)) || 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['cards:' + SEASON]);   // un reparto a la vez: nunca salen dos cartas iguales
      const pk = (await client.query(
        `SELECT id, kind FROM card_packs WHERE user_id = $1 AND season = $2 AND opened_at IS NULL ${wanted ? 'AND id = $3' : ''} ORDER BY id LIMIT 1 FOR UPDATE`,
        wanted ? [uid, SEASON, wanted] : [uid, SEASON])).rows[0];
      if (!pk) throw new HttpError(404, 'No tienes sobres para abrir');
      const taken = new Set((await client.query('SELECT card_id FROM card_owned WHERE season = $1', [SEASON])).rows.map(r => r.card_id));
      const free = [[], [], [], [], []];
      for (let id = 1; id <= core.TOTAL; id++) if (!taken.has(id)) free[core.rarityIndexOf(id)].push(id);
      const ri = weightedIndex(PACKS[pk.kind].odds, free.map(l => l.length > 0));
      let ridx = ri;
      if (ridx < 0) ridx = free.findIndex(l => l.length > 0);   // si ya no quedan de lo que toca, sale lo que haya
      if (ridx < 0) throw new HttpError(409, '¡La colección de esta temporada está completa! Ya no quedan cartas');
      const list = free[ridx], cardId = list[crypto.randomInt(0, list.length)];
      const now = Date.now();
      await client.query('INSERT INTO card_owned (season, card_id, user_id, obtained_at, source) VALUES ($1,$2,$3,$4,$5)', [SEASON, cardId, uid, now, pk.kind]);
      await client.query('UPDATE card_packs SET opened_at = $1, card_id = $2 WHERE id = $3', [now, cardId, pk.id]);
      await client.query('COMMIT');
      const left = Number((await all('SELECT COUNT(*) AS n FROM card_packs WHERE user_id = $1 AND season = $2 AND opened_at IS NULL', [uid, SEASON]))[0].n);
      const rewards = await payMilestones(uid).catch(() => []);
      return { ok: true, cardId, season: SEASON, packsLeft: left, minted: taken.size + 1, rewards };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  // Paga los premios de grupo que el jugador ya merece y aún no ha cobrado (la clave primaria evita cobrar dos veces)
  async function payMilestones(uid) {
    const rows = await all('SELECT card_id FROM card_owned WHERE season = $1 AND user_id = $2', [SEASON, uid]);
    const per = {}; rows.forEach(r => { const g = core.groupOf(r.card_id); per[g] = (per[g] || 0) + 1; });
    const out = [];
    for (const g of Object.keys(per)) for (const [n, kind, cr] of MILESTONES) {
      if (per[g] < n) continue;
      const ins = await run('INSERT INTO card_claims (user_id, season, key, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [uid, SEASON, `g${g}:${n}`, Date.now()]);
      if (!ins.rowCount) continue;
      await grantPack(uid, kind, 'grupo');
      if (cr > 0) await run('UPDATE packs SET credits = credits + $1 WHERE user_id::text = $2', [cr, uid]);
      out.push({ group: Number(g), n, kind, credits: cr });
    }
    return out;
  }

  const nickOf = async uid => ((await all('SELECT nickname FROM profiles WHERE user_id::text = $1', [uid]))[0] || {}).nickname || null;

  async function trades(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req); const uid = String(user.id);
    const rows = await all(`SELECT id, from_user, from_nick, to_nick, offer_card, want_card, created_at FROM card_trades
                            WHERE season = $1 AND status = 'open' AND (from_user = $2 OR to_user = $2) ORDER BY id DESC LIMIT 50`, [SEASON, uid]);
    return { ok: true, trades: rows.map(r => ({ id: Number(r.id), dir: r.from_user === uid ? 'out' : 'in', from: r.from_nick, to: r.to_nick, offer: r.offer_card, want: r.want_card, at: Number(r.created_at) })) };
  }

  // Ofrecer una carta a otro jugador: por otra carta suya (want) o como regalo (sin want)
  async function trade(req, body) {
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cardtrade:' + uid, 60_000) > 8) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const pack = await ensureUserPack(user);
    const age = (await all('SELECT created_at FROM packs WHERE code = $1', [pack.code]))[0];
    if (TRADE_MIN_AGE_H > 0 && Date.now() - Number((age || {}).created_at || 0) < TRADE_MIN_AGE_H * 3_600_000)
      throw new HttpError(403, `Tu cuenta debe tener al menos ${TRADE_MIN_AGE_H} h para intercambiar cartas`);
    const offer = Math.floor(Number(body && body.offer)), want = body && body.want ? Math.floor(Number(body.want)) : null;
    if (!core.valid(offer) || (want !== null && !core.valid(want))) throw new HttpError(400, 'Número de carta no válido (1 a ' + core.TOTAL + ')');
    const toNick = String((body && body.nick) || '').trim().slice(0, 30);
    if (!toNick) throw new HttpError(400, 'Escribe el apodo del jugador');
    const found = await all('SELECT user_id::text AS uid, nickname FROM profiles WHERE lower(nickname) = lower($1) LIMIT 2', [toNick]);
    const to = found.find(r => r.nickname === toNick) || (found.length === 1 ? found[0] : null);
    if (!to) throw new HttpError(404, 'No existe ningún jugador con ese apodo');
    if (to.uid === uid) throw new HttpError(400, 'No puedes intercambiar contigo mismo 🙂');
    const myNick = await nickOf(uid);
    if (!myNick) throw new HttpError(403, 'Elige tu apodo antes de intercambiar');
    const own = async (id, u) => (await all('SELECT 1 FROM card_owned WHERE season = $1 AND card_id = $2 AND user_id = $3', [SEASON, id, u])).length > 0;
    if (!(await own(offer, uid))) throw new HttpError(403, 'Esa carta no es tuya');
    if (want !== null && !(await own(want, to.uid))) throw new HttpError(409, `${to.nickname} no tiene la carta ${want}`);
    const open = Number((await all("SELECT COUNT(*) AS n FROM card_trades WHERE from_user = $1 AND season = $2 AND status = 'open'", [uid, SEASON]))[0].n);
    if (open >= TRADE_OPEN_MAX) throw new HttpError(429, `Máximo ${TRADE_OPEN_MAX} ofertas abiertas a la vez`);
    await run('INSERT INTO card_trades (season, from_user, to_user, from_nick, to_nick, offer_card, want_card, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [SEASON, uid, to.uid, myNick, to.nickname, offer, want, Date.now()]);
    return trades(req);
  }

  // Responder a una oferta: accept / reject (el que recibe) o cancel (el que la hizo). El cambio de dueño es una sola transacción.
  async function answer(req, body) {
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cardtrade:' + uid, 60_000) > 20) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const id = Math.floor(Number(body && body.id)), action = String((body && body.action) || '');
    if (!id || !['accept', 'reject', 'cancel'].includes(action)) throw new HttpError(400, 'Petición no válida');
    const client = await pool.connect(); let t;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['cards:' + SEASON]);
      t = (await client.query('SELECT * FROM card_trades WHERE id = $1 AND season = $2 FOR UPDATE', [id, SEASON])).rows[0];
      if (!t || t.status !== 'open') throw new HttpError(404, 'Esa oferta ya no está disponible');
      const now = Date.now(), setStatus = st => client.query('UPDATE card_trades SET status = $1, resolved_at = $2 WHERE id = $3', [st, now, id]);
      if (action === 'cancel') { if (t.from_user !== uid) throw new HttpError(403, 'No es tu oferta'); await setStatus('cancelled'); }
      else {
        if (t.to_user !== uid) throw new HttpError(403, 'Esta oferta no es para ti');
        if (action === 'reject') await setStatus('rejected');
        else {
          const has = async (cid, u) => (await client.query('SELECT 1 FROM card_owned WHERE season = $1 AND card_id = $2 AND user_id = $3 FOR UPDATE', [SEASON, cid, u])).rows.length > 0;
          if (!(await has(t.offer_card, t.from_user)) || (t.want_card !== null && !(await has(t.want_card, t.to_user))))
            throw new HttpError(409, 'Una de las cartas ya no está disponible. Rechaza o cancela la oferta');
          const move = (cid, to, from) => client.query("UPDATE card_owned SET user_id = $1, obtained_at = $2, source = 'intercambio' WHERE season = $3 AND card_id = $4 AND user_id = $5", [to, now, SEASON, cid, from]);
          await move(t.offer_card, t.to_user, t.from_user);
          if (t.want_card !== null) await move(t.want_card, t.from_user, t.to_user);
          await setStatus('accepted');
        }
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    let rewards = [];
    if (action === 'accept') { rewards = await payMilestones(uid).catch(() => []); await payMilestones(t.from_user).catch(() => {}); }
    return { ...(await state(uid)), rewards };
  }

  return { ON, SEASON, init, grantPack, get, daily, buy, open, trades, trade, answer };
};
