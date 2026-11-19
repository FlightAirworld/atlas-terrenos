'use strict';
// BINGO (servidor). Una sala compartida por todos los jugadores, con rondas seguidas.
//  · Cada cartón cuesta BINGO_PRICE créditos (1) y cada jugador puede comprar como mucho BINGO_MAX_CARDS (24) por ronda.
//  · La primera compra abre la ronda: hay BINGO_BUY_SECONDS (60, un minuto) para comprar y después cae una bola cada BINGO_BALL_SECONDS (4).
//  · Bingo de 90 bolas: cartón de 3 filas × 9 columnas con 15 números. Línea = una fila completa; bingo = el cartón entero.
//  · La partida empieza SOLA: la cuenta atrás de 1 minuto arranca en cuanto se acaba la anterior (no hace falta que nadie compre).
//    Si al acabar la cuenta atrás no hay cartones, salen unas pocas bolas de muestra (BINGO_EMPTY_BALLS) y vuelve a empezar la cuenta atrás.
//  · BOTE ACUMULADO: empieza en un valor al azar entre 500 y 3000 créditos y sube BINGO_JACKPOT_STEP (1) con cada partida que termina. Se lo lleva (a partes iguales si hay varios)
//    quien canta bingo en BINGO_JACKPOT_BALLS (48) bolas o menos, además del premio del bingo; entonces vuelve a empezar en 1000.
//  · Con varios jugadores: línea 20 % y bingo 80 % de los créditos gastados entre todos en esa partida (prizesFor).
//  · Solo hay UNA línea y UN bingo por ronda (el primero que se completa). Si dos o más jugadores lo completan con la misma bola, se reparten el premio a partes iguales (hacia abajo).
//  · Al cantarse la línea el juego se para LINE_PAUSE (8 s): el navegador enseña el rótulo 5 s, dice «Continuamos para bingo» y siguen las bolas.
//  · Premios (el bote son los cartones vendidos × precio):
//      – con otros jugadores en la sala: línea 20 % del bote y bingo 80 %;
//      – jugando solo: línea 5 y bingo 20 créditos (BINGO_SOLO_LINE / BINGO_SOLO_BINGO), pero nunca más que el porcentaje del bote.
//    Los créditos son enteros: los premios se redondean hacia abajo.
//  · JUGADORES FICTICIOS (bingo-bots.js): en cada ronda entran entre 120 y 240 jugadores inventados (con apodo y bandera) que compran entre 200 y 700 cartones en total (cada uno de 1 a 24),
//    repartidos a lo largo del minuto de compra. Sus cartones cuentan para el bote y el número de jugadores; sus premios no se pagan a nadie.
//    Al cerrarse la compra se decide que la línea y el bingo los cante un jugador real con probabilidad BINGO_HUMAN_WIN_PCT (55 %), y se reordena el bombo para que ocurra.
//    BINGO_BOTS=off los desactiva.
//  · JUGAR VARIAS PARTIDAS SEGUIDAS (1 a 100): POST /api/bingo/buy con { count, games } compra ahora (si la compra está abierta) y deja el resto programado en bingo_auto;
//    con { reserve: true } solo programa (desde la próxima partida). Cada vez que se abre una ronda el servidor compra solo los cartones de quien tenga partidas pendientes
//    (aunque haya cerrado el bingo) y, si no le quedan créditos, para sus partidas. Los premios que le tocan se guardan en bingo_wins para avisarle en el juego (GET /api/bingo → wins).
//    { cancelAuto: true } cancela; { ackUpTo: id } marca los avisos como vistos.
// El servidor decide TODO: baraja las 90 bolas, nunca las manda antes de que caigan, evalúa y paga. El navegador solo dibuja (bingo.js).
// La partida se calcula con el reloj (la bola n cae en draw_start + (n-1) × BALL_MS), así que sobrevive a un reinicio del servidor.
// Se monta desde server.js igual que la trivia: require('./bingo-server')({ pool, run, all, needUser, ensureUserPack, HttpError, rateHit, numEnv }).
// Rutas: GET /api/bingo → get, POST /api/bingo/buy → buy.
const crypto = require('node:crypto');
const botsLib = require('./bingo-bots');

module.exports = function (d) {
  const { pool, run, all, needUser, ensureUserPack, HttpError, rateHit, numEnv } = d;
  const ON = String(process.env.BINGO || 'on').toLowerCase() !== 'off';
  const BOTS_ON = String(process.env.BINGO_BOTS || 'on').toLowerCase() !== 'off';
  const HUMAN_WIN = Math.max(0, Math.min(1, numEnv('BINGO_HUMAN_WIN_PCT', 55) / 100));   // probabilidad de que línea / bingo los cante un jugador real
  const PRICE = Math.max(1, Math.floor(numEnv('BINGO_PRICE', 1)));
  const MAX_CARDS = Math.max(1, Math.floor(numEnv('BINGO_MAX_CARDS', 24)));
  const BUY_MS = Math.max(5, numEnv('BINGO_BUY_SECONDS', 60)) * 1000;
  const BALL_MS = Math.max(1, numEnv('BINGO_BALL_SECONDS', 4)) * 1000;
  const SOLO_LINE = Math.floor(numEnv('BINGO_SOLO_LINE', 5)), SOLO_BINGO = Math.floor(numEnv('BINGO_SOLO_BINGO', 20));
  const LINE_PCT = 0.2, BINGO_PCT = 0.8;
  // El bote acumulado arranca (y vuelve a arrancar tras llevárselo alguien) en un valor al azar entre 500 y 3000 y sube JACKPOT_STEP con cada partida jugada
  const JP_MIN = Math.max(0, Math.floor(numEnv('BINGO_JACKPOT_MIN', 500))), JP_MAX = Math.max(JP_MIN, Math.floor(numEnv('BINGO_JACKPOT_MAX', 3000)));
  const JACKPOT_BASE = JP_MIN, jpStart = () => JP_MIN + crypto.randomInt(JP_MAX - JP_MIN + 1), JACKPOT_STEP = Math.max(0, Math.floor(numEnv('BINGO_JACKPOT_STEP', 1)));
  const JACKPOT_BALLS = Math.max(1, Math.min(90, Math.floor(numEnv('BINGO_JACKPOT_BALLS', 48))));
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
    await run('CREATE TABLE IF NOT EXISTS bingo_jackpot (id INT PRIMARY KEY, amount BIGINT NOT NULL)');
    await run('INSERT INTO bingo_jackpot (id, amount) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [jpStart()]);
    await run('ALTER TABLE public.bingo_jackpot ENABLE ROW LEVEL SECURITY').catch(() => {});
    await run('ALTER TABLE bingo_rounds ADD COLUMN IF NOT EXISTS jackpot_prize INT').catch(() => {});
    await run('ALTER TABLE bingo_rounds ADD COLUMN IF NOT EXISTS line_all TEXT').catch(() => {});    // todos los ganadores (si se reparten)
    await run('ALTER TABLE bingo_rounds ADD COLUMN IF NOT EXISTS bingo_all TEXT').catch(() => {});
    await run('ALTER TABLE public.bingo_rounds ENABLE ROW LEVEL SECURITY').catch(() => {});   // solo el servidor accede
    await run('ALTER TABLE public.bingo_cards ENABLE ROW LEVEL SECURITY').catch(() => {});
    await run('CREATE TABLE IF NOT EXISTS bingo_auto (user_id TEXT PRIMARY KEY, pack_code TEXT NOT NULL, nick TEXT NOT NULL, country TEXT, avatar TEXT, n_cards INT NOT NULL, games_left INT NOT NULL, created_at BIGINT NOT NULL)');
    await run('CREATE TABLE IF NOT EXISTS bingo_wins (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, round_id BIGINT NOT NULL, kind TEXT NOT NULL, prize INT NOT NULL DEFAULT 0, seen INT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS bingo_wins_user ON bingo_wins (user_id, seen)');
    await run('ALTER TABLE public.bingo_auto ENABLE ROW LEVEL SECURITY').catch(() => {});
    await run('ALTER TABLE public.bingo_wins ENABLE ROW LEVEL SECURITY').catch(() => {});
    const old = Date.now() - 2 * 24 * 3600 * 1000;   // solo hacen falta las rondas recientes
    await run('DELETE FROM bingo_cards WHERE round_id IN (SELECT id FROM bingo_rounds WHERE created_at < $1)', [old]).catch(() => {});
    await run('DELETE FROM bingo_rounds WHERE created_at < $1', [old]).catch(() => {});
    const clean = () => {
      // con los jugadores ficticios cada ronda guarda miles de cartones: se limpian pronto (a las 3 horas)
      const old = Date.now() - 3 * 3600 * 1000;
      run("DELETE FROM bingo_cards WHERE user_id LIKE 'bot:%' AND created_at < $1", [old]).catch(() => {});
      const old2 = Date.now() - 2 * 24 * 3600 * 1000;
      run('DELETE FROM bingo_cards WHERE round_id IN (SELECT id FROM bingo_rounds WHERE created_at < $1)', [old2]).catch(() => {});
      run('DELETE FROM bingo_rounds WHERE created_at < $1', [old2]).catch(() => {});
      run('DELETE FROM bingo_wins WHERE created_at < $1', [Date.now() - 7 * 24 * 3600 * 1000]).catch(() => {});
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

  // ---------- Jugadores ficticios ----------
  // Los cartones de los ficticios se crean al abrirse la ronda, pero cada uno lleva una hora de "compra" repartida durante el minuto de compra:
  // el navegador solo cuenta los que ya han "comprado" (created_at <= ahora), así los jugadores y el bote van subiendo poco a poco.
  async function spawnBots(client, roundId, now, buyUntil) {
    if (!BOTS_ON) return;
    const plan = botsLib.botPlan(MAX_CARDS);   // cartones de cada ficticio (200-700 en total)
    const bots = botsLib.pickBots(plan.length);
    const from = now + 1500, span = Math.max(1000, buyUntil - 3000 - from);
    const rows = [];
    for (let bi = 0; bi < bots.length; bi++) {
      const b = bots[bi], n = plan[bi];
      const when = from + Math.floor(Math.random() * span);
      for (let i = 0; i < n; i++) rows.push([roundId, b.id, 'bot', b.nick, b.country, b.avatar, JSON.stringify(genCard()), when]);
    }
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400), vals = [], ph = [];
      chunk.forEach((r, k) => { ph.push(`($${k * 8 + 1},$${k * 8 + 2},$${k * 8 + 3},$${k * 8 + 4},$${k * 8 + 5},$${k * 8 + 6},$${k * 8 + 7},$${k * 8 + 8})`); vals.push(...r); });
      await client.query(`INSERT INTO bingo_cards (round_id, user_id, pack_code, nick, country, avatar, grid, created_at) VALUES ${ph.join(',')}`, vals);
    }
  }
  // Partidas seguidas: al abrirse una ronda se compran solos los cartones de quien las tenga programadas (cada uno con su SAVEPOINT: un fallo no tumba la ronda)
  async function runAuto(client, roundId, now) {
    const rows = (await client.query('SELECT * FROM bingo_auto ORDER BY created_at FOR UPDATE')).rows;
    for (const a of rows) {
      await client.query('SAVEPOINT bingo_auto_one');
      try {
        const cost = a.n_cards * PRICE;
        const pay = await client.query('UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits', [cost, a.pack_code]);
        if (!pay.rows[0]) {   // sin créditos: se paran sus partidas y se le avisa
          await client.query('DELETE FROM bingo_auto WHERE user_id = $1', [a.user_id]);
          await client.query("INSERT INTO bingo_wins (user_id, round_id, kind, prize, created_at) VALUES ($1,$2,'stop',0,$3)", [a.user_id, roundId, now]);
        } else {
          for (let i = 0; i < a.n_cards; i++) {
            await client.query('INSERT INTO bingo_cards (round_id, user_id, pack_code, nick, country, avatar, grid, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
              [roundId, a.user_id, a.pack_code, a.nick, a.country, a.avatar, JSON.stringify(genCard()), now]);
          }
          if (a.games_left <= 1) {
            await client.query('DELETE FROM bingo_auto WHERE user_id = $1', [a.user_id]);
            await client.query("INSERT INTO bingo_wins (user_id, round_id, kind, prize, created_at) VALUES ($1,$2,'end',0,$3)", [a.user_id, roundId, now]);
          } else await client.query('UPDATE bingo_auto SET games_left = games_left - 1 WHERE user_id = $1', [a.user_id]);
        }
        await client.query('RELEASE SAVEPOINT bingo_auto_one');
      } catch (e) { await client.query('ROLLBACK TO SAVEPOINT bingo_auto_one'); }
    }
  }
  // Los cartones de una ronda no cambian cuando empiezan las bolas: se guardan ya leídos para no releerlos cada 4 segundos
  let cardCache = null;
  async function loadCards(client, roundId, fresh) {
    if (!fresh && cardCache && cardCache.id === roundId) return cardCache.cards;
    const cards = (await client.query('SELECT id, user_id, pack_code, nick, country, avatar, grid FROM bingo_cards WHERE round_id = $1', [roundId])).rows
      .map(c => ({ ...c, rows: rowsOf(JSON.parse(c.grid)), bot: botsLib.isBot(c.user_id) }));
    cardCache = { id: roundId, cards };
    return cards;
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
            const ins = await client.query("INSERT INTO bingo_rounds (status, ord, created_at, buy_until) VALUES ('buying', $1, $2, $3) RETURNING id",
              [JSON.stringify(shuffle(Array.from({ length: 90 }, (_, i) => i + 1))), nowA, nowA + BUY_MS]);
            await spawnBots(client, ins.rows[0].id, nowA, nowA + BUY_MS);
            await runAuto(client, ins.rows[0].id, nowA);
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
      let order = JSON.parse(r.ord);
      const total = Math.min(90, Math.max(0, Math.floor((now - drawStart) / BALL_MS) + 1));
      let evaluated = r.evaluated;
      if (total <= evaluated && r.status === status) { await client.query('ROLLBACK'); return; }
      const justClosed = r.status === 'buying';   // se acaba de cerrar la compra: los cartones ya no cambian
      const cards = await loadCards(client, r.id, justClosed);
      const upd = { status, draw_start: drawStart };
      // Con la compra cerrada y antes de la primera bola: se decide si la línea y el bingo los canta un jugador real (55 %) o uno ficticio, y se reordena el bombo
      if (justClosed && cards.length && cards.some(c => c.bot) && cards.some(c => !c.bot)) {
        order = botsLib.planOrder(cards, Math.random() < HUMAN_WIN, Math.random() < HUMAN_WIN, order);
        upd.ord = JSON.stringify(order);
      }
      let jackpotWon = false;
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
          if (share > 0) for (const x of ws) if (!x.bot) {   // los ficticios no cobran
            await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2', [share, x.pack_code]);
            await client.query('INSERT INTO bingo_wins (user_id, round_id, kind, prize, created_at) VALUES ($1,$2,$3,$4,$5)', [x.user_id, r.id, p, share, now]);   // para avisarle en el juego
          }
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
            const ws = uniq(full);
            await pay(ws, prizes.bingo, 'bingo');
            Object.assign(upd, { bingo_ball: k, status: 'done', finished_at: now });
            if (k <= JACKPOT_BALLS) {   // bingo en 48 bolas o menos: se llevan el bote acumulado y vuelve a empezar
              const jp = Number(((await client.query('SELECT amount FROM bingo_jackpot WHERE id = 1 FOR UPDATE')).rows[0] || { amount: JACKPOT_BASE }).amount);
              const share = Math.floor(jp / ws.length);
              if (share > 0) for (const x of ws) if (!x.bot) {
                await client.query('UPDATE packs SET credits = credits + $1 WHERE code = $2', [share, x.pack_code]);
                await client.query("INSERT INTO bingo_wins (user_id, round_id, kind, prize, created_at) VALUES ($1,$2,'jackpot',$3,$4)", [x.user_id, r.id, share, now]);
              }
              upd.jackpot_prize = share; jackpotWon = true;
              await client.query('UPDATE bingo_jackpot SET amount = $1 WHERE id = 1', [jpStart()]);
            }
            break;
          }
          if (lineNow && LINE_PAUSE_MS > 0) { drawStart += LINE_PAUSE_MS; upd.draw_start = drawStart; break; }   // el juego se para para cantar la línea
        }
      }
      if (upd.status === 'done' && !jackpotWon) await client.query('UPDATE bingo_jackpot SET amount = amount + $1 WHERE id = 1', [JACKPOT_STEP]);   // cada partida que termina suma al bote
      upd.evaluated = evaluated;
      const keys = Object.keys(upd);
      await client.query(`UPDATE bingo_rounds SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [r.id, ...keys.map(k => upd[k])]);
      await client.query('COMMIT');
    } catch (e) { cardCache = null; try { await client.query('ROLLBACK'); } catch (e2) { /* nada */ } throw e; }
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
    const jpRow = (await all('SELECT amount FROM bingo_jackpot WHERE id = 1'))[0];
    const autoRow = (await all('SELECT n_cards, games_left FROM bingo_auto WHERE user_id = $1', [uid]))[0];
    const winRows = await all('SELECT id, round_id, kind, prize FROM bingo_wins WHERE user_id = $1 AND seen = 0 ORDER BY id LIMIT 30', [uid]);
    const base = { auto: autoRow ? { cards: Number(autoRow.n_cards), gamesLeft: Number(autoRow.games_left) } : null,
      wins: winRows.map(w => ({ id: Number(w.id), round: Number(w.round_id), kind: w.kind, prize: Number(w.prize) })), jackpot: jpRow ? Number(jpRow.amount) : JACKPOT_BASE, jackpotBalls: JACKPOT_BALLS, ok: true, on: true, now, connected: connected(), price: PRICE, maxCards: MAX_CARDS, ballMs: BALL_MS, credits: Number(pack.credits), soloLine: SOLO_LINE, soloBingo: SOLO_BINGO };
    const r = (await all('SELECT * FROM bingo_rounds ORDER BY id DESC LIMIT 1'))[0];
    let phase = 'idle';
    if (r) {
      if (r.status === 'buying') phase = 'buying';
      else if (r.status === 'drawing') phase = 'drawing';
      else if (now - Number(r.finished_at) < RESULT_MS) phase = 'done';
    }
    if (phase === 'idle') return { ...base, phase, buyMs: BUY_MS, mine: [], cardsTotal: 0, players: 0, roster: [], ...(() => { const p = prizesFor(0, 0); return { pot: p.pot, linePrize: p.line, bingoPrize: p.bingo }; })() };
    // Solo se cuentan los cartones ya "comprados" (los ficticios se reparten durante el minuto de compra)
    const tot = (await all('SELECT COUNT(*)::int AS cards, COUNT(DISTINCT user_id)::int AS players FROM bingo_cards WHERE round_id = $1 AND created_at <= $2', [r.id, now]))[0] || { cards: 0, players: 0 };
    const mine = await all('SELECT id, grid FROM bingo_cards WHERE round_id = $1 AND user_id = $2 ORDER BY id', [r.id, uid]);
    const roster = (await all('SELECT nick, country, avatar, COUNT(*)::int AS n FROM bingo_cards WHERE round_id = $1 AND created_at <= $2 GROUP BY user_id, nick, country, avatar ORDER BY MAX(created_at) DESC, user_id LIMIT 14', [r.id, now]))
      .map(x => ({ nick: x.nick, country: x.country, avatar: x.avatar, cards: x.n }));
    const p = prizesFor(tot.players, tot.cards);
    const drawn = phase === 'buying' ? [] : JSON.parse(r.ord).slice(0, r.evaluated);
    const line = winner(r, 'line', uid), bingo = winner(r, 'bingo', uid);
    return {
      ...base, phase, round: Number(r.id), buyUntil: Number(r.buy_until), drawStart: r.draw_start === null ? null : Number(r.draw_start),
      finishedAt: r.finished_at === null ? null : Number(r.finished_at), drawn, line, bingo,
      jackpotPrize: Number(r.jackpot_prize) || 0,
      players: tot.players, cardsTotal: tot.cards, roster, pot: p.pot, linePrize: p.line, bingoPrize: p.bingo,
      mine: mine.map(c => ({ id: Number(c.id), grid: JSON.parse(c.grid) }))
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
    if (body && body.ackUpTo !== undefined) {   // avisos vistos
      await run('UPDATE bingo_wins SET seen = 1 WHERE user_id = $1 AND id <= $2', [uid, Math.floor(Number(body.ackUpTo)) || 0]);
      return view(user);
    }
    if (body && body.cancelAuto) { await run('DELETE FROM bingo_auto WHERE user_id = $1', [uid]); return view(user); }
    const count = Math.floor(Number(body && body.count));
    if (!Number.isFinite(count) || count < 1 || count > MAX_CARDS) throw new HttpError(400, `Elige entre 1 y ${MAX_CARDS} cartones`);
    const games = Math.max(1, Math.min(100, Math.floor(Number(body && body.games)) || 1));   // partidas seguidas (1 a 100)
    const reserveOnly = !!(body && body.reserve);
    const country = cleanCountry(body && body.country), avatar = cleanAvatar(body && body.avatar);
    const prof = (await all('SELECT nickname FROM profiles WHERE user_id::text = $1', [uid]))[0];
    if (!prof || !prof.nickname) throw new HttpError(409, 'Elige tu apodo para jugar al bingo');
    const pack = await ensureUserPack(user);
    const saveAuto = (c, left) => c.query('INSERT INTO bingo_auto (user_id, pack_code, nick, country, avatar, n_cards, games_left, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id) DO UPDATE SET pack_code = $2, nick = $3, country = $4, avatar = $5, n_cards = $6, games_left = $7',
      [uid, pack.code, prof.nickname, country, avatar, count, left, Date.now()]);
    if (reserveOnly) {   // reservar: se compra solo desde que se abra la próxima partida
      await run('DELETE FROM bingo_auto WHERE user_id = $1', [uid]);
      await saveAuto({ query: (s, p) => run(s, p) }, games);
      return view(user);
    }
    await advance();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);
      const now = Date.now();
      await client.query('DELETE FROM bingo_auto WHERE user_id = $1', [uid]);   // lo nuevo sustituye a lo programado antes
      let r = (await client.query("SELECT * FROM bingo_rounds WHERE status <> 'done' ORDER BY id DESC LIMIT 1 FOR UPDATE")).rows[0];
      if (!r) {
        r = (await client.query("INSERT INTO bingo_rounds (status, ord, created_at, buy_until) VALUES ('buying', $1, $2, $3) RETURNING *",
          [JSON.stringify(shuffle(Array.from({ length: 90 }, (_, i) => i + 1))), now, now + BUY_MS])).rows[0];
        await spawnBots(client, r.id, now, now + BUY_MS);
        await runAuto(client, r.id, now);
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
      if (games > 1) await saveAuto(client, games - 1);   // el resto de partidas, programadas
      await client.query('COMMIT');
    } catch (e) { try { await client.query('ROLLBACK'); } catch (e2) { /* nada */ } throw e; }
    finally { client.release(); }
    return view(user);
  }

  return { ON, init, get, buy };
};
