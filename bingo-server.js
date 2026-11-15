'use strict';
// BINGO (servidor). Una sala compartida por todos los jugadores, con rondas seguidas.
//  · Cada cartón cuesta BINGO_PRICE créditos (1) y cada jugador puede comprar como mucho BINGO_MAX_CARDS (24) por ronda.
//  · La primera compra abre la ronda: hay BINGO_BUY_SECONDS (60, un minuto) para comprar y después cae una bola cada BINGO_BALL_SECONDS (4).
//  · Bingo de 90 bolas: cartón de 3 filas × 9 columnas con 15 números. Línea = una fila completa; bingo = el cartón entero.
//  · La partida empieza SOLA: la cuenta atrás de 1 minuto arranca en cuanto se acaba la anterior (no hace falta que nadie compre).
//    Si al acabar la cuenta atrás no hay cartones, salen unas pocas bolas de muestra (BINGO_EMPTY_BALLS) y vuelve a empezar la cuenta atrás.
//  · Solo hay UNA línea y UN bingo por ronda (el primero que se completa). Si dos o más jugadores lo completan con la misma bola, se reparten el premio a partes iguales (hacia abajo).
//  · Al cantarse la línea el juego se para LINE_PAUSE (8 s): el navegador enseña el rótulo 5 s, dice «Continuamos para bingo» y siguen las bolas.
//  · Premios (el bote son los cartones vendidos × precio):
//      – con otros jugadores en la sala: línea 20 % del bote y bingo 80 %;
//      – jugando solo: línea 5 y bingo 20 créditos (BINGO_SOLO_LINE / BINGO_SOLO_BINGO), pero nunca más que el porcentaje del bote.
//    Los créditos son enteros: los premios se redondean hacia abajo.
// El servidor decide TODO: baraja las 90 bolas, nunca las manda antes de que caigan, evalúa y paga. El navegador solo dibuja (bingo.js).
// La partida se calcula con el reloj (la bola n cae en draw_start + (n-1) × BALL_MS), así que sobrevive a un reinicio del servidor.
// Se monta desde server.js igual que la trivia: require('./bingo-server')({ pool, run, all, needUser, ensureUserPack, HttpError, rateHit, numEnv }).
// Rutas: GET /api/bingo → get, POST /api/bingo/buy → buy.
const crypto = require('node:crypto');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, HttpError, rateHit, numEnv } = d;
  const ON = String(process.env.BINGO || 'on').toLowerCase() !== 'off';
  const PRICE = Math.max(1, Math.floor(numEnv('BINGO_PRICE', 1)));
  const MAX_CARDS = Math.max(1, Math.floor(numEnv('BINGO_MAX_CARDS', 24)));
  const BUY_MS = Math.max(5, numEnv('BINGO_BUY_SECONDS', 60)) * 1000;
  const BALL_MS = Math.max(1, numEnv('BINGO_BALL_SECONDS', 4)) * 1000;
  const SOLO_LINE = Math.floor(numEnv('BINGO_SOLO_LINE', 5)), SOLO_BINGO = Math.floor(numEnv('BINGO_SOLO_BINGO', 20));
  const LINE_PCT = 0.2, BINGO_PCT = 0.8;
  const AUTO = String(process.env.BINGO_AUTO || 'on').toLowerCase() !== 'off';   // las partidas empiezan solas
  const EMPTY_BALLS = Math.max(1, Math.floor(numEnv('BINGO_EMPTY_BALLS', 12)));   // bolas de muestra si nadie compró
  const LINE_PAUSE_MS = Math.max(0, numEnv('BINGO_LINE_PAUSE_SECONDS', 8)) * 1000;   // pausa tras cantar la línea
  const RESULT_MS = 15_000;       // tras el bingo se enseña el resultado este tiempo; luego la sala queda libre para otra ronda
  const LOCK_ID = 7_771_001;      // cerrojo de Postgres para que dos compras a la vez no abran dos rondas

  // Jugadores conectados: los que tienen la sala abierta (el navegador pregunta cada segundo)
  const seen = new Map();
  const touch = uid => { const now = Date.now(); seen.set(uid, now); if (seen.size > 2000) for (const [k, v] of seen) if (now - v > 60_000) seen.delete(k); };
  const connected = () => { const now = Date.now(); let n = 0; for (const v of seen.values()) if (now - v <= 6000) n++; return n; };

  const cleanCountry = c => (typeof c === 'string' && /^[A-Za-z]{2}$/.test(c)) ? c.toUpperCase() : null;
  const cleanAvatar = a => (typeof a === 'string' && a.length > 0 && a.length <= 8) ? a : null;

  async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS bingo_rounds (id BIGSERIAL PRIMARY KEY, status TEXT NOT NULL, ord TEXT NOT NULL, created_at BIGINT NOT NULL, buy_until BIGINT NOT NULL, draw_start BIGINT, evaluated INT NOT NULL DEFAULT 0, finished_at BIGINT, line_user TEXT, line_nick TEXT, line_country TEXT, line_avatar TEXT, line_ball INT, line_prize INT, bingo_user TEXT, bingo_nick TEXT, bingo_country TEXT, bingo_avatar TEXT, bingo_ball INT, bingo_prize INT)');
    await run('CREATE TABLE IF NOT EXISTS bingo_cards (id BIGSERIAL PRIMARY KEY, round_id BIGINT NOT NULL, user_id TEXT NOT NULL, pack_code TEXT NOT NULL, nick TEXT NOT NULL, country TEXT, avatar TEXT, grid TEXT NOT NULL, created_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS bingo_cards_round ON bingo_cards (round_id, user_id)');
    await run('ALTER TABLE bingo_rounds ADD COLUMN IF NOT EXISTS line_all TEXT').catch(() => {});    // todos los ganadores (si se reparten)
    await run('ALTER TABLE bingo_rounds ADD COLUMN IF NOT EXISTS bingo_all TEXT').catch(() => {});
    await run('ALTER TABLE public.bingo_rounds ENABLE ROW LEVEL SECURITY').catch(() => {});   // solo el servidor accede
    await run('ALTER TABLE public.bingo_cards ENABLE ROW LEVEL SECURITY').catch(() => {});
    const old = Date.now() - 2 * 24 * 3600 * 1000;   // solo hacen falta las rondas recientes
    await run('DELETE FROM bingo_cards WHERE round_id IN (SELECT id FROM bingo_rounds WHERE created_at < $1)', [old]).catch(() => {});
    await run('DELETE FROM bingo_rounds WHERE created_at < $1', [old]).catch(() => {});
    const clean = () => {
      const old = Date.now() - 2 * 24 * 3600 * 1000;
      run('DELETE FROM bingo_cards WHERE round_id IN (SELECT id FROM bingo_rounds WHERE created_at < $1)', [old]).catch(() => {});
      run('DELETE FROM bingo_rounds WHERE created_at < $1', [old]).catch(() => {});
    };
    setInterval(clean, 3600_000).unref();   // con partidas automáticas salen muchas rondas: se limpian cada hora
    setInterval(() => { advance().catch(() => {}); }, 1000).unref();   // paga línea y bingo aunque nadie tenga la pantalla abierta
  }

  // ---------- Cartones y bombo ----------
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Cartón español de 90 bolas: 3 filas × 9 columnas, 5 números por fila, 15 en total, al menos 1 por columna,
  // columna c con números de su decena (1-9, 10-19 … 80-90) en orden creciente. 0 = casilla vacía.
  function genCard() {
    for (;;) {
      const rows = [0, 1, 2].map(() => new Set(shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 5)));
      const cnt = Array(9).fill(0);
      rows.forEach(r => r.forEach(c => cnt[c]++));
      if (cnt.some(n => n < 1)) continue;
      const grid = [Array(9).fill(0), Array(9).fill(0), Array(9).fill(0)];
      for (let c = 0; c < 9; c++) {
        const lo = c === 0 ? 1 : c * 10, hi = c === 8 ? 90 : c * 10 + 9;
        const pool9 = []; for (let n = lo; n <= hi; n++) pool9.push(n);
        const nums = shuffle(pool9).slice(0, cnt[c]).sort((a, b) => a - b);
        [0, 1, 2].filter(r => rows[r].has(c)).forEach((r, i) => { grid[r][c] = nums[i]; });
      }
      return grid;
    }
  }
  const rowsOf = grid => grid.map(r => r.filter(n => n > 0));

  // Premios con los cartones vendidos: jugando solo, el tope fijo; con más jugadores, el porcentaje del bote
  function prizesFor(humans, cards) {
    const pot = cards * PRICE;
    let line = Math.floor(pot * LINE_PCT), bingo = Math.floor(pot * BINGO_PCT);
    if (humans <= 1) { line = Math.min(SOLO_LINE, line); bingo = Math.min(SOLO_BINGO, bingo); }
    return { pot, line, bingo };
  }

  // ---------- Avance de la partida (se llama cada segundo y en cada consulta) ----------
  async function advance() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = (await client.query("SELECT * FROM bingo_rounds WHERE status <> 'done' ORDER BY id DESC LIMIT 1 FOR UPDATE")).rows[0];
      if (!r) {   // sala libre: la siguiente partida arranca sola con su cuenta atrás de 1 minuto, cuando se ha enseñado el resultado
        const nowA = Date.now();
        if (AUTO) {
          await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
          const active = (await client.query("SELECT id FROM bingo_rounds WHERE status <> 'done' LIMIT 1")).rows[0];
          const last = (await client.query('SELECT finished_at FROM bingo_rounds ORDER BY id DESC LIMIT 1')).rows[0];
          if (!active && (!last || last.finished_at === null || nowA - Number(last.finished_at) >= RESULT_MS)) {
            await client.query("INSERT INTO bingo_rounds (status, ord, created_at, buy_until) VALUES ('buying', $1, $2, $3)",
              [JSON.stringify(shuffle(Array.from({ length: 90 }, (_, i) => i + 1))), nowA, nowA + BUY_MS]);
            await client.query('COMMIT'); return;
          }
        }
        await client.query('ROLLBACK'); return;
      }
      const now = Date.now();
      let status = r.status, drawStart = r.draw_start === null ? null : Number(r.draw_start);
      if (status === 'buying') {
        if (now < Number(r.buy_until)) { await client.query('ROLLBACK'); return; }
        status = 'drawing'; drawStart = Number(r.buy_until);
      }
      const order = JSON.parse(r.ord);
      const total = Math.min(90, Math.max(0, Math.floor((now - drawStart) / BALL_MS) + 1));
      let evaluated = r.evaluated;
      if (total <= evaluated && r.status === status) { await client.query('ROLLBACK'); return; }
      const cards = (await client.query('SELECT id, user_id, pack_code, nick, country, avatar, grid FROM bingo_cards WHERE round_id = $1', [r.id])).rows
        .map(c => ({ ...c, rows: rowsOf(JSON.parse(c.grid)) }));
      const upd = { status, draw_start: drawStart };
      if (!cards.length) {   // nadie compró: salen unas bolas de muestra y se acaba, para que empiece la cuenta atrás de la siguiente
        evaluated = Math.min(total, EMPTY_BALLS);
        if (total >= EMPTY_BALLS) { upd.status = 'done'; upd.finished_at = now; }
      } else {
        const prizes = prizesFor(new Set(cards.map(c => c.user_id)).size, cards.length);
        const drawn = new Set(order.slice(0, evaluated));
        let lineDone = r.line_user !== null;
        // Jugadores distintos con cartón ganador (un jugador con dos cartones cuenta una vez), en orden aleatorio
        const uniq = list => { const m = new Map(); shuffle(list.slice()).forEach(c => { if (!m.has(c.user_id)) m.set(c.user_id, c); }); return [...m.values()]; };
        const pay = async (ws, prize, p) => {
          const share = Math.floor(prize / ws.length);
          const w = ws[0];
          Object.assign(upd, { [p + '_user']: w.user_id, [p + '_nick']: w.nick, [p + '_country']: w.country, [p + '_avatar']: w.avatar, [p + '_prize']: share,
            [p + '_all']: JSON.stringify(ws.map(x => ({ user: x.user_id, nick: x.nick, country: x.country, avatar: x.avatar }))) });
          if (share > 0) for (const x of ws) await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2', [share, x.pack_code]);
        };
        for (let k = evaluated + 1; k <= total; k++) {
          drawn.add(order[k - 1]);
          evaluated = k;
          let lineNow = false;
          if (!lineDone) {
            const cands = cards.filter(c => c.rows.some(row => row.every(n => drawn.has(n))));
            if (cands.length) {
              lineDone = true; lineNow = true;
              await pay(uniq(cands), prizes.line, 'line');
              upd.line_ball = k;
            }
          }
          const full = cards.filter(c => c.rows.every(row => row.every(n => drawn.has(n))));
          if (full.length) {
            await pay(uniq(full), prizes.bingo, 'bingo');
            Object.assign(upd, { bingo_ball: k, status: 'done', finished_at: now });
            break;
          }
          if (lineNow && LINE_PAUSE_MS > 0) { drawStart += LINE_PAUSE_MS; upd.draw_start = drawStart; break; }   // el juego se para para cantar la línea
        }
      }
      upd.evaluated = evaluated;
      const keys = Object.keys(upd);
      await client.query(`UPDATE bingo_rounds SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [r.id, ...keys.map(k => upd[k])]);
      await client.query('COMMIT');
    } catch (e) { try { await client.query('ROLLBACK'); } catch (e2) { /* nada */ } throw e; }
    finally { client.release(); }
  }

  // ---------- Estado que ve el jugador ----------
  const winner = (r, p, uid) => {
    if (r[p + '_user'] === null || r[p + '_user'] === undefined) return null;
    let all = []; try { all = JSON.parse(r[p + '_all'] || '[]'); } catch (e) { all = []; }
    if (!all.length) all = [{ user: r[p + '_user'], nick: r[p + '_nick'], country: r[p + '_country'], avatar: r[p + '_avatar'] }];
    return { nick: r[p + '_nick'], country: r[p + '_country'], avatar: r[p + '_avatar'], ball: Number(r[p + '_ball']), prize: Number(r[p + '_prize']),
      mine: all.some(x => x.user === uid), winners: all.map(x => ({ nick: x.nick, country: x.country, avatar: x.avatar, mine: x.user === uid })) };
  };

  async function view(user) {
    await advance();
    const uid = String(user.id);
    const pack = await ensureUserPack(user);
    const now = Date.now();
    const base = { ok: true, on: true, now, connected: connected(), price: PRICE, maxCards: MAX_CARDS, ballMs: BALL_MS, credits: Number(pack.credits), soloLine: SOLO_LINE, soloBingo: SOLO_BINGO };
    const r = (await all('SELECT * FROM bingo_rounds ORDER BY id DESC LIMIT 1'))[0];
    let phase = 'idle';
    if (r) {
      if (r.status === 'buying') phase = 'buying';
      else if (r.status === 'drawing') phase = 'drawing';
      else if (now - Number(r.finished_at) < RESULT_MS) phase = 'done';
    }
    if (phase === 'idle') return { ...base, phase, buyMs: BUY_MS, mine: [], cardsTotal: 0, players: 0, ...(() => { const p = prizesFor(0, 0); return { pot: p.pot, linePrize: p.line, bingoPrize: p.bingo }; })() };
    const cards = await all('SELECT id, user_id, grid FROM bingo_cards WHERE round_id = $1 ORDER BY id', [r.id]);
    const players = new Set(cards.map(c => c.user_id)).size;
    const p = prizesFor(players, cards.length);
    const drawn = phase === 'buying' ? [] : JSON.parse(r.ord).slice(0, r.evaluated);
    const line = winner(r, 'line', uid), bingo = winner(r, 'bingo', uid);
    return {
      ...base, phase, round: Number(r.id), buyUntil: Number(r.buy_until), drawStart: r.draw_start === null ? null : Number(r.draw_start),
      finishedAt: r.finished_at === null ? null : Number(r.finished_at), drawn, line, bingo,
      players, cardsTotal: cards.length, pot: p.pot, linePrize: p.line, bingoPrize: p.bingo,
      mine: cards.filter(c => c.user_id === uid).map(c => ({ id: Number(c.id), grid: JSON.parse(c.grid) }))
    };
  }

  async function get(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req);
    if (rateHit('bingo:' + user.id, 60_000) > 240) throw new HttpError(429, 'Vas muy rápido. Espera un momento');
    touch(String(user.id));
    return view(user);
  }

  // Compra cartones (abre la ronda si la sala está libre)
  async function buy(req, body) {
    if (!ON) throw new HttpError(404, 'El bingo está desactivado');
    const user = await needUser(req); const uid = String(user.id);
    touch(uid);
    if (rateHit('bingo-buy:' + uid, 60_000) > 30) throw new HttpError(429, 'Vas muy rápido. Espera un minuto');
    const count = Math.floor(Number(body && body.count));
    if (!Number.isFinite(count) || count < 1 || count > MAX_CARDS) throw new HttpError(400, `Elige entre 1 y ${MAX_CARDS} cartones`);
    const country = cleanCountry(body && body.country), avatar = cleanAvatar(body && body.avatar);
    const prof = (await all('SELECT nickname FROM profiles WHERE user_id::text = $1', [uid]))[0];
    if (!prof || !prof.nickname) throw new HttpError(409, 'Elige tu apodo para jugar al bingo');
    const pack = await ensureUserPack(user);
    await advance();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
      const now = Date.now();
      let r = (await client.query("SELECT * FROM bingo_rounds WHERE status <> 'done' ORDER BY id DESC LIMIT 1 FOR UPDATE")).rows[0];
      if (!r) {
        r = (await client.query("INSERT INTO bingo_rounds (status, ord, created_at, buy_until) VALUES ('buying', $1, $2, $3) RETURNING *",
          [JSON.stringify(shuffle(Array.from({ length: 90 }, (_, i) => i + 1))), now, now + BUY_MS])).rows[0];
      } else if (r.status !== 'buying' || now >= Number(r.buy_until)) {
        throw new HttpError(409, 'La partida ya ha empezado. Espera a la siguiente 🎱');
      }
      const owned = Number((await client.query('SELECT COUNT(*) AS n FROM bingo_cards WHERE round_id = $1 AND user_id = $2', [r.id, uid])).rows[0].n);
      if (owned + count > MAX_CARDS) throw new HttpError(409, owned ? `Máximo ${MAX_CARDS} cartones por partida (ya tienes ${owned})` : `Máximo ${MAX_CARDS} cartones por partida`);
      const pay = await client.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [count * PRICE, pack.code]);
      if (!pay.rows[0]) throw new HttpError(402, `Necesitas ${count * PRICE} ${count * PRICE === 1 ? 'crédito' : 'créditos'} para ${count === 1 ? 'este cartón' : 'estos cartones'}`);
      for (let i = 0; i < count; i++) {
        await client.query('INSERT INTO bingo_cards (round_id, user_id, pack_code, nick, country, avatar, grid, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [r.id, uid, pack.code, prof.nickname, country, avatar, JSON.stringify(genCard()), now]);
      }
      await client.query('COMMIT');
    } catch (e) { try { await client.query('ROLLBACK'); } catch (e2) { /* nada */ } throw e; }
    finally { client.release(); }
    return view(user);
  }

  return { ON, init, get, buy };
};
