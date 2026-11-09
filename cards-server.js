'use strict';
// CARTAS COLECCIONABLES (servidor). Cada carta (1..10000 de la temporada) existe UNA sola vez: la clave primaria (season, card_id) de
// card_owned impide que dos jugadores tengan la misma. Los sobres se ganan o se compran y se abren aquí: el servidor elige la carta al azar
// entre las que aún no ha sacado nadie (con las probabilidades de cada tipo de sobre). El cliente solo dibuja (cards.js).
// Se monta desde server.js:  const cards = require('./cards-server')({ pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv });
const crypto = require('node:crypto');
const core = require('./cards-core');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, dayKey, HttpError, rateHit, numEnv } = d;
  const pushSocial = d.pushSocial || (async () => false), pushToUser = d.pushToUser || (async () => false);
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
  const PRICE_MAX = numEnv('CARDS_PRICE_MAX', 1_000_000);   // máximo de créditos en una oferta de compra
  // Carta Negra 🖤: puja mensual. Sale a CARDS_BLACK_MIN créditos y cada puja debe superar la anterior en CARDS_BLACK_STEP como mínimo.
  const BLACK_MIN = Math.max(1, Math.floor(numEnv('CARDS_BLACK_MIN', 100))), BLACK_STEP = Math.max(1, Math.floor(numEnv('CARDS_BLACK_STEP', 1)));
  const TZ = process.env.DAILY_TZ || 'Europe/Madrid';   // el mes acaba a medianoche de esta zona (la misma de «el día» del resto del juego)

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS card_owned (season TEXT NOT NULL, card_id INT NOT NULL, user_id TEXT NOT NULL, obtained_at BIGINT NOT NULL, source TEXT, PRIMARY KEY (season, card_id))');
    await run('CREATE INDEX IF NOT EXISTS card_owned_user ON card_owned (user_id, season)');
    await run('CREATE TABLE IF NOT EXISTS card_packs (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, season TEXT NOT NULL, kind TEXT NOT NULL, source TEXT, created_at BIGINT NOT NULL, opened_at BIGINT, card_id INT)');
    await run('CREATE INDEX IF NOT EXISTS card_packs_user ON card_packs (user_id, opened_at)');
    await run('ALTER TABLE card_packs ADD COLUMN IF NOT EXISTS offered TEXT');   // las 3 cartas que el cartero ofrece al abrir el sobre (ids separados por comas)
    await run('CREATE TABLE IF NOT EXISTS card_daily (user_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day))');
    await run('CREATE TABLE IF NOT EXISTS card_claims (user_id TEXT NOT NULL, season TEXT NOT NULL, key TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (user_id, season, key))');
    await run('CREATE TABLE IF NOT EXISTS card_trades (id BIGSERIAL PRIMARY KEY, season TEXT NOT NULL, from_user TEXT NOT NULL, to_user TEXT NOT NULL, from_nick TEXT NOT NULL, to_nick TEXT NOT NULL, offer_card INT NOT NULL, want_card INT, status TEXT NOT NULL DEFAULT \'open\', created_at BIGINT NOT NULL, resolved_at BIGINT)');
    await run('CREATE INDEX IF NOT EXISTS card_trades_to ON card_trades (to_user, status)');
    await run('CREATE INDEX IF NOT EXISTS card_trades_from ON card_trades (from_user, status)');
    await run('ALTER TABLE card_trades ADD COLUMN IF NOT EXISTS price INT');            // oferta de compra: créditos que ofrece el comprador
    await run('ALTER TABLE card_trades ALTER COLUMN offer_card DROP NOT NULL');         // en una compra no se da ninguna carta
    await run('CREATE TABLE IF NOT EXISTS card_notifs (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, created_at BIGINT NOT NULL, seen_at BIGINT)');
    await run('CREATE INDEX IF NOT EXISTS card_notifs_user ON card_notifs (user_id, seen_at)');
    await run('CREATE TABLE IF NOT EXISTS card_auctions (month TEXT PRIMARY KEY, ends_at BIGINT NOT NULL, status TEXT NOT NULL DEFAULT \'open\', winner_id TEXT, winner_nick TEXT, winning_bid INT, closed_at BIGINT)');
    await run('CREATE TABLE IF NOT EXISTS card_bids (id BIGSERIAL PRIMARY KEY, month TEXT NOT NULL, user_id TEXT NOT NULL, nick TEXT NOT NULL, amount INT NOT NULL, created_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS card_bids_month ON card_bids (month, amount DESC)');
    await run('CREATE TABLE IF NOT EXISTS card_black (month TEXT PRIMARY KEY, user_id TEXT NOT NULL, nick TEXT, bid INT NOT NULL, obtained_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS card_black_user ON card_black (user_id)');
    for (const t of ['card_notifs', 'card_auctions', 'card_bids', 'card_black']) await run(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`).catch(() => {});
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
    const [owned, packs, minted, daily, claims, tin, cr, black] = await Promise.all([
      all('SELECT card_id AS id, obtained_at AS at FROM card_owned WHERE season = $1 AND user_id = $2 ORDER BY card_id', [SEASON, uid]),
      all('SELECT id, kind, source FROM card_packs WHERE user_id = $1 AND season = $2 AND opened_at IS NULL ORDER BY id', [uid, SEASON]),
      all('SELECT COUNT(*)::int AS n FROM card_owned WHERE season = $1', [SEASON]),
      all('SELECT 1 FROM card_daily WHERE user_id = $1 AND day = $2', [uid, dayKey()]),
      all('SELECT key FROM card_claims WHERE user_id = $1 AND season = $2', [uid, SEASON]),
      all("SELECT COUNT(*)::int AS n FROM card_trades WHERE to_user = $1 AND season = $2 AND status = 'open'", [uid, SEASON]),
      all('SELECT credits FROM packs WHERE user_id::text = $1', [uid]),
      all('SELECT month, bid FROM card_black WHERE user_id = $1 ORDER BY month DESC', [uid])
    ]);
    return { ok: true, on: true, season: SEASON, seasonName: (core.SEASONS[SEASON] || {}).name || SEASON, total: core.TOTAL, group: core.GROUP,
      owned: owned.map(r => ({ id: r.id, at: Number(r.at) })), packs, minted: minted[0].n, dailyReady: !daily.length, claims: claims.map(r => r.key), tradesIn: tin[0].n, credits: cr.length ? Number(cr[0].credits) : 0, black: black.map(b => ({ month: b.month, bid: b.bid })),
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

  // Elegir carta (animación del cartero): offer reparte 3 cartas libres de UNA misma rareza (la que toca según las probabilidades del sobre,
  // así el precio y las probabilidades no cambian) y las apunta en el sobre; pick guarda la que elige el jugador. Hasta que se elige, las 3 siguen libres.
  function sample(list, n) {   // n elementos distintos al azar (Fisher-Yates parcial sobre una copia)
    const a = list.slice(), out = [];
    for (let i = 0; i < n && a.length; i++) { const j = crypto.randomInt(0, a.length); out.push(a[j]); a[j] = a[a.length - 1]; a.pop(); }
    return out;
  }

  async function offer(req, body) {
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cards:' + uid, 60_000) > 30) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const wanted = Math.floor(Number(body && body.packId)) || 0;
    if (!wanted) throw new HttpError(400, 'Falta el sobre');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['cards:' + SEASON]);
      const pk = (await client.query('SELECT id, kind, offered FROM card_packs WHERE id = $1 AND user_id = $2 AND season = $3 AND opened_at IS NULL FOR UPDATE', [wanted, uid, SEASON])).rows[0];
      if (!pk) throw new HttpError(404, 'No tienes ese sobre para abrir');
      const taken = new Set((await client.query('SELECT card_id FROM card_owned WHERE season = $1', [SEASON])).rows.map(r => r.card_id));
      const prev = pk.offered ? pk.offered.split(',').map(Number).filter(core.valid) : [];
      let ids = prev;
      if (!prev.length || prev.some(id => taken.has(id))) {   // oferta nueva (o la anterior ya no sirve porque alguien se llevó una de las 3)
        const free = [[], [], [], [], []];
        for (let id = 1; id <= core.TOTAL; id++) if (!taken.has(id)) free[core.rarityIndexOf(id)].push(id);
        let ridx = weightedIndex(PACKS[pk.kind].odds, free.map(l => l.length > 0));
        if (ridx < 0) ridx = free.findIndex(l => l.length > 0);
        if (ridx < 0) throw new HttpError(409, '¡La colección de esta temporada está completa! Ya no quedan cartas');
        ids = sample(free[ridx], 3);
        await client.query('UPDATE card_packs SET offered = $1 WHERE id = $2', [ids.join(','), pk.id]);
      }
      await client.query('COMMIT');
      return { ok: true, packId: Number(pk.id), kind: pk.kind, season: SEASON, offer: ids };
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
  }

  async function pick(req, body) {
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cards:' + uid, 60_000) > 30) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const wanted = Math.floor(Number(body && body.packId)) || 0, cardId = Math.floor(Number(body && body.cardId)) || 0;
    if (!wanted || !core.valid(cardId)) throw new HttpError(400, 'Petición no válida');
    const client = await pool.connect(); let taken409 = false, res;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['cards:' + SEASON]);
      const pk = (await client.query('SELECT id, kind, offered FROM card_packs WHERE id = $1 AND user_id = $2 AND season = $3 AND opened_at IS NULL FOR UPDATE', [wanted, uid, SEASON])).rows[0];
      if (!pk) throw new HttpError(404, 'Ese sobre ya se abrió');
      const offered = pk.offered ? pk.offered.split(',').map(Number) : [];
      if (!offered.includes(cardId)) throw new HttpError(403, 'Esa carta no estaba entre las que te ofreció el cartero');
      if ((await client.query('SELECT 1 FROM card_owned WHERE season = $1 AND card_id = $2', [SEASON, cardId])).rows.length) {
        await client.query('UPDATE card_packs SET offered = NULL WHERE id = $1', [pk.id]);   // alguien se la llevó mientras elegías: se vuelve a ofrecer
        taken409 = true;
      } else {
        const now = Date.now();
        await client.query('INSERT INTO card_owned (season, card_id, user_id, obtained_at, source) VALUES ($1,$2,$3,$4,$5)', [SEASON, cardId, uid, now, pk.kind]);
        await client.query('UPDATE card_packs SET opened_at = $1, card_id = $2 WHERE id = $3', [now, cardId, pk.id]);
        res = { others: offered.filter(x => x !== cardId) };
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    if (taken409) throw new HttpError(409, 'Justo esa carta se la acaba de llevar otro jugador. El cartero te ofrecerá otras tres');
    const left = Number((await all('SELECT COUNT(*) AS n FROM card_packs WHERE user_id = $1 AND season = $2 AND opened_at IS NULL', [uid, SEASON]))[0].n);
    const minted = Number((await all('SELECT COUNT(*) AS n FROM card_owned WHERE season = $1', [SEASON]))[0].n);
    const rewards = await payMilestones(uid).catch(() => []);
    return { ok: true, cardId, season: SEASON, packsLeft: left, minted, rewards, others: res.others };
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
  const findPlayer = async nick => {   // por apodo exacto (o único sin mirar mayúsculas)
    const found = await all('SELECT user_id::text AS uid, nickname, avatar FROM profiles WHERE lower(nickname) = lower($1) LIMIT 2', [String(nick || '').trim().slice(0, 30)]);
    return found.find(r => r.nickname === String(nick || '').trim()) || (found.length === 1 ? found[0] : null);
  };
  const countryOf = async uid => ((await all('SELECT country FROM parcels WHERE user_id::text = $1 AND country IS NOT NULL ORDER BY created_at LIMIT 1', [uid]))[0] || {}).country || null;
  const cname = (id) => { const i = core.cardInfo(id, SEASON); return i ? `${i.emoji} ${i.name} (Nº ${id})` : 'Nº ' + id; };
  const nf = n => Number(n).toLocaleString('es-ES');

  // ---------- Avisos (punto rojo): alguien quiere comprarte / cambiarte una carta, te han vendido una, te superan en la puja, ganas la carta negra… ----------
  async function notify(uid, kind, text, q, push) {
    await (q || run)('INSERT INTO card_notifs (user_id, kind, text, created_at) VALUES ($1,$2,$3,$4)', [String(uid), kind, String(text).slice(0, 300), Date.now()]);
    if (push) pushSocial(String(uid), { title: push, body: String(text).slice(0, 140), tag: 'cards', url: '/' }).catch(() => {});
  }
  async function notifs(req, sp) {
    if (!ON) return { ok: true, on: false, unseen: 0 };
    const user = await needUser(req); const uid = String(user.id);
    const unseen = Number((await all('SELECT COUNT(*) AS n FROM card_notifs WHERE user_id = $1 AND seen_at IS NULL', [uid]))[0].n);
    if (sp && sp.get('brief') === '1') return { ok: true, unseen, fresh: await all('SELECT id, kind, text FROM card_notifs WHERE user_id = $1 AND seen_at IS NULL ORDER BY id DESC LIMIT 3', [uid]) };   // el móvil lo pregunta cada minuto
    const items = await all('SELECT id, kind, text, created_at AS at, seen_at IS NOT NULL AS seen FROM card_notifs WHERE user_id = $1 ORDER BY id DESC LIMIT 30', [uid]);
    return { ok: true, unseen, items: items.map(r => ({ id: Number(r.id), kind: r.kind, text: r.text, at: Number(r.at), seen: !!r.seen })) };
  }
  async function notifsSeen(req) {
    if (!ON) return { ok: true };
    const user = await needUser(req);
    await run('UPDATE card_notifs SET seen_at = $2 WHERE user_id = $1 AND seen_at IS NULL', [String(user.id), Date.now()]);
    return { ok: true };
  }
  // Limpieza: avisos ya vistos de más de 60 días
  let lastPurge = 0;
  const purgeNotifs = () => { if (Date.now() - lastPurge < 3_600_000) return; lastPurge = Date.now(); run('DELETE FROM card_notifs WHERE seen_at IS NOT NULL AND created_at < $1', [Date.now() - 60 * 86_400_000]).catch(() => {}); };

  // ---------- Ranking de jugadores por país y cartas de un jugador ----------
  async function ranking(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cardsrank:' + uid, 60_000) > 30) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const rows = await all(`SELECT o.user_id AS uid, COUNT(*)::int AS n, MAX(p.nickname) AS nick, MAX(p.avatar) AS avatar,
        (SELECT pa.country FROM parcels pa WHERE pa.user_id::text = o.user_id AND pa.country IS NOT NULL ORDER BY pa.created_at LIMIT 1) AS country
      FROM card_owned o JOIN profiles p ON p.user_id::text = o.user_id WHERE o.season = $1 GROUP BY o.user_id ORDER BY n DESC, MAX(p.nickname) LIMIT 300`, [SEASON]);
    const blacks = new Map((await all('SELECT user_id, COUNT(*)::int AS n FROM card_black GROUP BY user_id')).map(r => [r.user_id, r.n]));
    const by = new Map();
    for (const r of rows) {
      const c = r.country || '';
      if (!by.has(c)) by.set(c, { country: c || null, total: 0, players: [] });
      const g = by.get(c); g.total += r.n;
      g.players.push({ nick: r.nick, avatar: r.avatar || null, count: r.n, black: blacks.get(r.uid) || 0, me: r.uid === uid });
    }
    const countries = [...by.values()].sort((a, b) => (a.country === null) - (b.country === null) || b.total - a.total);   // «sin país» al final
    return { ok: true, countries };
  }
  async function player(req, sp) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cardsplayer:' + uid, 60_000) > 60) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const pl = await findPlayer(sp && sp.get('nick'));
    if (!pl) throw new HttpError(404, 'No existe ningún jugador con ese apodo');
    const [cards, black, country] = await Promise.all([
      all('SELECT card_id AS id FROM card_owned WHERE season = $1 AND user_id = $2 ORDER BY card_id', [SEASON, pl.uid]),
      all('SELECT month, bid FROM card_black WHERE user_id = $1 ORDER BY month DESC', [pl.uid]),
      countryOf(pl.uid)
    ]);
    return { ok: true, nick: pl.nickname, avatar: pl.avatar || null, country, me: pl.uid === uid, season: SEASON, cards: cards.map(r => r.id), black: black.map(b => ({ month: b.month, bid: b.bid })) };
  }

  async function trades(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req); const uid = String(user.id);
    const rows = await all(`SELECT id, from_user, from_nick, to_nick, offer_card, want_card, price, created_at FROM card_trades
                            WHERE season = $1 AND status = 'open' AND (from_user = $2 OR to_user = $2) ORDER BY id DESC LIMIT 50`, [SEASON, uid]);
    return { ok: true, trades: rows.map(r => ({ id: Number(r.id), dir: r.from_user === uid ? 'out' : 'in', from: r.from_nick, to: r.to_nick, offer: r.offer_card, want: r.want_card, price: r.price || 0, at: Number(r.created_at) })) };
  }

  // Ofrecer algo a otro jugador: cambiar una carta por otra (offer + want), regalar una (solo offer) o COMPRARLE una con créditos (want + price)
  async function trade(req, body) {
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cardtrade:' + uid, 60_000) > 8) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const pack = await ensureUserPack(user);
    const age = (await all('SELECT created_at FROM packs WHERE code = $1', [pack.code]))[0];
    if (TRADE_MIN_AGE_H > 0 && Date.now() - Number((age || {}).created_at || 0) < TRADE_MIN_AGE_H * 3_600_000)
      throw new HttpError(403, `Tu cuenta debe tener al menos ${TRADE_MIN_AGE_H} h para intercambiar cartas`);
    const price = body && body.price ? Math.floor(Number(body.price)) : 0;
    const want = body && body.want ? Math.floor(Number(body.want)) : null;
    let offer = body && body.offer ? Math.floor(Number(body.offer)) : null;
    if (price) {   // compra: se ofrecen créditos (sin carta) por una carta del otro jugador
      if (!Number.isInteger(price) || price < 1 || price > PRICE_MAX) throw new HttpError(400, `El precio debe ser de 1 a ${nf(PRICE_MAX)} créditos`);
      if (want === null || !core.valid(want)) throw new HttpError(400, 'Elige la carta que quieres comprar');
      offer = null;
    } else if (!core.valid(offer) || (want !== null && !core.valid(want))) throw new HttpError(400, 'Número de carta no válido (1 a ' + core.TOTAL + ')');
    const toNick = String((body && body.nick) || '').trim().slice(0, 30);
    if (!toNick) throw new HttpError(400, 'Escribe el apodo del jugador');
    const to = await findPlayer(toNick);
    if (!to) throw new HttpError(404, 'No existe ningún jugador con ese apodo');
    if (to.uid === uid) throw new HttpError(400, 'No puedes intercambiar contigo mismo 🙂');
    const myNick = await nickOf(uid);
    if (!myNick) throw new HttpError(403, 'Elige tu apodo antes de intercambiar');
    const own = async (id, u) => (await all('SELECT 1 FROM card_owned WHERE season = $1 AND card_id = $2 AND user_id = $3', [SEASON, id, u])).length > 0;
    if (offer !== null && !(await own(offer, uid))) throw new HttpError(403, 'Esa carta no es tuya');
    if (want !== null && !(await own(want, to.uid))) throw new HttpError(409, `${to.nickname} no tiene la carta ${want}`);
    if (price && Number(pack.credits) < price) throw new HttpError(402, `No tienes tantos créditos: ofreces ${nf(price)} y tienes ${nf(pack.credits)}`);
    const open = Number((await all("SELECT COUNT(*) AS n FROM card_trades WHERE from_user = $1 AND season = $2 AND status = 'open'", [uid, SEASON]))[0].n);
    if (open >= TRADE_OPEN_MAX) throw new HttpError(429, `Máximo ${TRADE_OPEN_MAX} ofertas abiertas a la vez`);
    await run('INSERT INTO card_trades (season, from_user, to_user, from_nick, to_nick, offer_card, want_card, price, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [SEASON, uid, to.uid, myNick, to.nickname, offer, want, price || null, Date.now()]);
    const text = price ? `${myNick} quiere comprarte ${cname(want)} por ${nf(price)} créditos`
      : want !== null ? `${myNick} te propone cambiar ${cname(offer)} por tu ${cname(want)}` : `${myNick} te quiere regalar ${cname(offer)}`;
    await notify(to.uid, 'offer', text, null, price ? '💰 Quieren comprarte una carta' : '🔁 Oferta de cartas').catch(() => {});
    return trades(req);
  }

  // Responder a una oferta: accept / reject (el que recibe) o cancel (el que la hizo). El cambio de dueño (y de créditos) es una sola transacción.
  async function answer(req, body) {
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cardtrade:' + uid, 60_000) > 20) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const id = Math.floor(Number(body && body.id)), action = String((body && body.action) || '');
    if (!id || !['accept', 'reject', 'cancel'].includes(action)) throw new HttpError(400, 'Petición no válida');
    await ensureUserPack(user);   // quien vende cobra en su cuenta: que exista
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
        if (action === 'reject') { await setStatus('rejected'); await notify(t.from_user, 'rejected', `${t.to_nick} ha rechazado tu oferta${t.want_card ? ' por ' + cname(t.want_card) : ''}`, (q, p) => client.query(q, p)); }
        else {
          const has = async (cid, u) => (await client.query('SELECT 1 FROM card_owned WHERE season = $1 AND card_id = $2 AND user_id = $3 FOR UPDATE', [SEASON, cid, u])).rows.length > 0;
          if ((t.offer_card !== null && !(await has(t.offer_card, t.from_user))) || (t.want_card !== null && !(await has(t.want_card, t.to_user))))
            throw new HttpError(409, 'Una de las cartas ya no está disponible. Rechaza o cancela la oferta');
          const move = (cid, to, from) => client.query("UPDATE card_owned SET user_id = $1, obtained_at = $2, source = 'intercambio' WHERE season = $3 AND card_id = $4 AND user_id = $5", [to, now, SEASON, cid, from]);
          if (t.price) {   // venta: los créditos pasan del comprador al vendedor, y la carta al revés
            const packs = (await client.query('SELECT code, user_id::text AS uid FROM packs WHERE user_id::text = ANY($1::text[]) ORDER BY code FOR UPDATE', [[t.from_user, t.to_user]])).rows;
            const buyer = packs.find(r => r.uid === t.from_user), seller = packs.find(r => r.uid === t.to_user);
            if (!buyer || !seller) throw new HttpError(409, 'Falta la cuenta del comprador o la tuya');
            const pay = await client.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [t.price, buyer.code]);
            if (!pay.rows.length) throw new HttpError(409, `${t.from_nick} ya no tiene ${nf(t.price)} créditos. Rechaza la oferta o espera a que los tenga`);
            await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2', [t.price, seller.code]);
          }
          if (t.offer_card !== null) await move(t.offer_card, t.to_user, t.from_user);
          if (t.want_card !== null) await move(t.want_card, t.from_user, t.to_user);
          await setStatus('accepted');
          await notify(t.from_user, 'accepted', t.price ? `✅ ${t.to_nick} te ha vendido ${cname(t.want_card)} por ${nf(t.price)} créditos`
            : `✅ ${t.to_nick} ha aceptado tu oferta${t.want_card !== null ? ': ya tienes ' + cname(t.want_card) : ' y se ha quedado tu regalo'}`, (q, p) => client.query(q, p));
        }
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    let rewards = [];
    if (action === 'accept') {
      rewards = await payMilestones(uid).catch(() => []); await payMilestones(t.from_user).catch(() => {});
      pushSocial(t.from_user, { title: t.price ? '✅ Te han vendido una carta' : '✅ Oferta aceptada', body: `${t.to_nick} ha aceptado tu oferta.`, tag: 'cards', url: '/' }).catch(() => {});
    }
    return { ...(await state(uid)), rewards };
  }

  // ---------- CARTA NEGRA 🖤: subasta mensual ----------
  // Una carta única al mes (cards-core.js → blackInfo). Se puja con créditos; la puja acaba el ÚLTIMO DÍA DEL MES a medianoche (zona DAILY_TZ) y se la queda
  // el que más ofrezca. Los créditos NO se retienen al pujar: se descuentan al cerrar. Si el mejor postor ya no los tiene, se pasa al siguiente.
  async function ensureAuction() {
    const month = core.monthKeyOf(Date.now(), TZ);
    await run("INSERT INTO card_auctions (month, ends_at) VALUES ($1,$2) ON CONFLICT DO NOTHING", [month, core.monthEndMs(month, TZ)]);
    return (await all('SELECT * FROM card_auctions WHERE month = $1', [month]))[0];
  }
  async function closeAuction(month) {
    const client = await pool.connect(); let res = null;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['cards:black']);
      const a = (await client.query('SELECT * FROM card_auctions WHERE month = $1 FOR UPDATE', [month])).rows[0];
      if (!a || a.status !== 'open' || Number(a.ends_at) > Date.now()) { await client.query('ROLLBACK'); return null; }
      const bids = (await client.query('SELECT user_id, nick, amount, created_at FROM card_bids WHERE month = $1', [month])).rows.map(b => ({ ...b, created_at: Number(b.created_at) }));
      const info = core.blackInfo(month), now = Date.now(), q = (t, p) => client.query(t, p);
      const { winner, skipped } = await core.pickWinner(bids, async b => (await client.query('UPDATE packs SET credits = credits - $1 WHERE user_id::text = $2 AND credits >= $1 RETURNING credits', [b.amount, b.user_id])).rows.length > 0);
      if (winner) {
        await client.query('INSERT INTO card_black (month, user_id, nick, bid, obtained_at) VALUES ($1,$2,$3,$4,$5)', [month, winner.user_id, winner.nick, winner.amount, now]);
        await client.query("UPDATE card_auctions SET status = 'closed', winner_id = $2, winner_nick = $3, winning_bid = $4, closed_at = $5 WHERE month = $1", [month, winner.user_id, winner.nick, winner.amount, now]);
        await notify(winner.user_id, 'won', `🎉 ¡Enhorabuena! Has ganado la puja de la Carta Negra «${info.name}» ${info.emoji} con ${nf(winner.amount)} créditos. ¡Felicidades, ya es tuya!`, q);
      } else await client.query("UPDATE card_auctions SET status = 'closed', closed_at = $2 WHERE month = $1", [month, now]);
      for (const b of skipped) await notify(b.user_id, 'nopay', `Tu puja de ${nf(b.amount)} créditos por la Carta Negra «${info.name}» no se pudo cobrar: ya no tenías créditos suficientes.`, q);
      const losers = new Set([...skipped.map(b => b.user_id), ...(winner ? [winner.user_id] : [])]);
      for (const uid of new Set(bids.map(b => b.user_id))) if (!losers.has(uid)) await notify(uid, 'lost', `La puja de la Carta Negra «${info.name}» ha terminado y la ha ganado ${winner ? winner.nick : 'nadie'}. ¡Mucha suerte el mes que viene!`, q);
      await client.query('COMMIT');
      res = winner;
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    if (res) pushToUser(res.user_id, { title: '🖤 ¡Has ganado la Carta Negra!', body: `Enhorabuena, «${core.blackInfo(month).name}» es tuya.`, tag: 'cards-black', url: '/' }).catch(() => {});
    return res;
  }
  async function closeDue() {   // cierra las pujas cuya hora ya ha pasado (también las de meses en que el servidor estuvo apagado)
    const due = await all("SELECT month FROM card_auctions WHERE status = 'open' AND ends_at <= $1 ORDER BY month", [Date.now()]);
    for (const r of due) await closeAuction(r.month);
  }
  async function auctionTick() {   // cierra lo que toque y abre la puja del mes en curso con su carta nueva
    if (!ON) return;
    try { await closeDue(); await ensureAuction(); purgeNotifs(); } catch (e) { console.error('Subasta de la Carta Negra:', e.message); }
  }

  async function auctionState(uid) {
    await closeDue(); const a = await ensureAuction();
    const [top, mine, who, hist, owned, cr] = await Promise.all([
      all('SELECT user_id, nick, amount FROM card_bids WHERE month = $1 ORDER BY amount DESC, created_at ASC LIMIT 1', [a.month]),
      all('SELECT MAX(amount) AS m FROM card_bids WHERE month = $1 AND user_id = $2', [a.month, uid]),
      all('SELECT COUNT(DISTINCT user_id)::int AS n FROM card_bids WHERE month = $1', [a.month]),
      all("SELECT month, winner_nick, winning_bid FROM card_auctions WHERE status = 'closed' ORDER BY month DESC LIMIT 12"),
      all('SELECT month, bid FROM card_black WHERE user_id = $1 ORDER BY month DESC', [uid]),
      all('SELECT credits FROM packs WHERE user_id::text = $1', [uid])
    ]);
    const t = top[0] || null;
    return { ok: true, on: true, month: a.month, card: core.blackInfo(a.month), endsAt: Number(a.ends_at), now: Date.now(), open: a.status === 'open',
      minBid: t ? t.amount + BLACK_STEP : BLACK_MIN, startBid: BLACK_MIN, step: BLACK_STEP, topNick: t ? t.nick : null, topAmount: t ? t.amount : 0, iLead: !!t && t.user_id === uid,
      myBid: mine[0] && mine[0].m ? Number(mine[0].m) : 0, bidders: who[0].n, credits: cr.length ? Number(cr[0].credits) : 0,
      history: hist.map(h => ({ month: h.month, nick: h.winner_nick, bid: h.winning_bid, name: core.blackInfo(h.month).name, emoji: core.blackInfo(h.month).emoji })),
      mine: owned.map(b => ({ month: b.month, bid: b.bid })) };
  }
  async function auction(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req);
    return auctionState(String(user.id));
  }
  async function bid(req, body) {
    if (!ON) throw new HttpError(404, 'Las cartas están desactivadas');
    const user = await needUser(req); const uid = String(user.id);
    if (rateHit('cardbid:' + uid, 60_000) > 12) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const amount = Math.floor(Number(body && body.amount));
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000) throw new HttpError(400, 'Escribe cuántos créditos quieres pujar');
    const nick = await nickOf(uid);
    if (!nick) throw new HttpError(403, 'Elige tu apodo antes de pujar');
    await closeDue(); const a = await ensureAuction();
    if (a.status !== 'open' || Number(a.ends_at) <= Date.now()) throw new HttpError(409, 'La puja de este mes ya ha terminado');
    const client = await pool.connect(); let prev = null;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['cards:black']);   // una puja a la vez: nunca dos «ganadoras»
      const cur = (await client.query('SELECT status, ends_at FROM card_auctions WHERE month = $1', [a.month])).rows[0];   // por si se cerró justo ahora
      if (!cur || cur.status !== 'open' || Number(cur.ends_at) <= Date.now()) throw new HttpError(409, 'La puja de este mes ya ha terminado');
      const top = (await client.query('SELECT user_id, nick, amount FROM card_bids WHERE month = $1 ORDER BY amount DESC, created_at ASC LIMIT 1', [a.month])).rows[0];
      const min = top ? top.amount + BLACK_STEP : BLACK_MIN;
      if (top && top.user_id === uid) throw new HttpError(409, `Ya vas ganando con ${nf(top.amount)} créditos`);
      if (amount < min) throw new HttpError(409, top ? `Tu puja debe superar la actual (${nf(top.amount)}): mínimo ${nf(min)} créditos` : `La puja sale en ${nf(BLACK_MIN)} créditos como mínimo`);
      const have = Number(((await client.query('SELECT credits FROM packs WHERE user_id::text = $1', [uid])).rows[0] || {}).credits || 0);
      if (have < amount) throw new HttpError(402, `No tienes tantos créditos: pujas ${nf(amount)} y tienes ${nf(have)}`);
      await client.query('INSERT INTO card_bids (month, user_id, nick, amount, created_at) VALUES ($1,$2,$3,$4,$5)', [a.month, uid, nick, amount, Date.now()]);
      await client.query('COMMIT');
      prev = top;
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    if (prev) notify(prev.user_id, 'outbid', `Te han superado en la puja de la Carta Negra «${core.blackInfo(a.month).name}»: ${nick} ofrece ${nf(amount)} créditos`, null, '🖤 Te han superado en la puja').catch(() => {});
    return auctionState(uid);
  }

  async function init2() { await auctionTick(); setInterval(auctionTick, 60_000).unref(); }   // cada minuto: cierra la puja a su hora y abre la del mes nuevo

  return { ON, SEASON, init, init2, grantPack, get, daily, buy, open, offer, pick, trades, trade, answer, ranking, player, notifs, notifsSeen, auction, bid, auctionTick };
};
module.exports.pickWinner = core.pickWinner;
