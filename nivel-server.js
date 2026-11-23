'use strict';
// NIVEL DE LOS JUGADORES (0-100). Se calcula al vuelo con lo que ya hay en Supabase (no hace falta ninguna tabla nueva):
//   Terrenos (hasta 45 pts)  45·(1 − e^(−parcelas/50))
//   Mejoras  (hasta 15 pts)  15·(1 − e^(−subidas de nivel de sus parcelas/20))   (cada parcela cuenta como mucho hasta nivel 5)
//   Juegos   (hasta 25 pts)  25·(1 − e^(−actividad/80))   trivia, parejas, rasca, minijuegos, ruleta, bingo, peleas, racha diaria y tragaperras
//   Social   (hasta 15 pts)  15·(1 − e^(−puntos/40))      logros, cartas, amigos, clan y regalos enviados
// Curva suave: los primeros terrenos/juegos suben rápido y llegar a 100 exige tenerlo TODO al máximo. Sin cuenta (visitante) = nivel 0.
// Ruta: GET /api/niveles?n=apodo1&n=apodo2 … (hasta 40) → { ok: true, levels: { apodo1: 12, apodo2: 0 } }  (claves en minúsculas)
// El nivel es público (igual que el apodo y la bandera). Caché en memoria de 60 s por apodo para no cargar la base de datos.
const TTL = 60_000, MAX_NICKS = 40, MAX_NICK_LEN = 40, MAX_CACHE = 5000;
const cache = new Map();   // apodo en minúsculas → { lv, at }

const SQL = `
WITH n AS (SELECT DISTINCT unnest($1::text[]) AS nick),
u AS (
  SELECT DISTINCT ON (n.nick) n.nick, COALESCE(p.user_id, k.user_id)::text AS uid
  FROM n
  LEFT JOIN profiles p ON lower(p.nickname) = n.nick
  LEFT JOIN packs k ON lower(k.fixed_nick) = n.nick
  ORDER BY n.nick, (COALESCE(p.user_id, k.user_id) IS NULL)
),
par AS (
  SELECT u.nick, count(*) AS c, COALESCE(sum(LEAST(GREATEST(pa.level, 1), 5) - 1), 0) AS m
  FROM u JOIN parcels pa ON (u.uid IS NOT NULL AND pa.user_id::text = u.uid) OR lower(pa.owner) = u.nick
  GROUP BY u.nick
),
g AS (
  SELECT u.nick,
    (SELECT count(*) FROM trivia_games x WHERE x.user_id = u.uid AND x.finished) +
    (SELECT count(*) FROM pairs_games x WHERE x.user_id = u.uid AND x.finished) +
    (SELECT count(*) FROM scratch_cards x WHERE x.user_id = u.uid) +
    (SELECT count(*) FROM mj_play x WHERE x.user_id = u.uid) +
    (SELECT count(*) FROM roulette_spins x WHERE x.user_id = u.uid) +
    (SELECT count(DISTINCT round_id) FROM bingo_cards x WHERE x.user_id = u.uid) +
    (SELECT COALESCE(sum(wins + losses), 0) FROM fight_stats x WHERE x.user_id = u.uid) +
    (SELECT count(*) FROM mj_streak_days x WHERE x.user_id = u.uid) +
    (SELECT COALESCE(sum(spins), 0) / 20.0 FROM cascada_stats x WHERE x.user_id = u.uid) AS jp
  FROM u
),
s AS (
  SELECT u.nick,
    2 * (SELECT count(*) FROM achievements x WHERE x.user_id = u.uid) +
    2 * (SELECT count(*) FROM card_owned x WHERE x.user_id = u.uid) +
    2 * (SELECT count(*) FROM friends x WHERE x.user_id = u.uid) +
    4 * (SELECT count(*) FROM clan_members x WHERE x.user_id = u.uid) +
    (SELECT count(*) FROM gifts x WHERE x.from_user = u.uid) AS sp
  FROM u
)
SELECT u.nick,
  LEAST(100, floor(
    45 * (1 - exp(-COALESCE(par.c, 0) / 50.0)) +
    15 * (1 - exp(-COALESCE(par.m, 0) / 20.0)) +
    25 * (1 - exp(-g.jp / 80.0)) +
    15 * (1 - exp(-s.sp / 40.0))
  ))::int AS nivel
FROM u LEFT JOIN par ON par.nick = u.nick JOIN g ON g.nick = u.nick JOIN s ON s.nick = u.nick`;

const clamp = v => Math.max(0, Math.min(100, Math.floor(Number(v) || 0)));

module.exports = function (d) {
  const q = async (sql, params) => {
    if (d && typeof d.all === 'function') return d.all(sql, params);
    if (d && d.pool && d.pool.query) return (await d.pool.query(sql, params)).rows;
    throw new Error('sin base de datos');
  };

  async function get(req) {
    let raw = [];
    try { raw = new URL(req.url, 'http://x').searchParams.getAll('n'); } catch (e) { /* sin parámetros */ }
    const nicks = [...new Set(raw.map(s => String(s).trim().toLowerCase()).filter(s => s && s.length <= MAX_NICK_LEN))].slice(0, MAX_NICKS);
    const now = Date.now(), levels = {}, missing = [];
    for (const k of nicks) {
      const c = cache.get(k);
      if (c && now - c.at < TTL) levels[k] = c.lv; else missing.push(k);
    }
    if (missing.length) {
      try {
        const rows = await q(SQL, [missing]);
        const found = new Map(rows.map(r => [String(r.nick), clamp(r.nivel)]));
        if (cache.size > MAX_CACHE) cache.clear();
        for (const k of missing) { const lv = found.get(k) || 0; levels[k] = lv; cache.set(k, { lv, at: now }); }
      } catch (e) {
        console.error('nivel: no se pudo calcular:', e && e.message);
        for (const k of missing) { const c = cache.get(k); levels[k] = c ? c.lv : 0; }   // si falla la base de datos: el último valor conocido (o 0)
      }
    }
    return { ok: true, levels };
  }

  return { get };
};
