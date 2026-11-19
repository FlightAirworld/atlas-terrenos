#!/usr/bin/env node
'use strict';
// Aplica los botes globales de CASCADA al código existente.
// Ejecutar desde la raíz del repositorio: node aplicar-botes-cascada.js
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const serverPath = path.join(root, 'cascada-server.js');
const gamePath = path.join(root, 'cascada', 'game.js');

function replaceOnce(src, before, after, label) {
  const n = src.split(before).length - 1;
  if (n !== 1) throw new Error(`${label}: se esperaba encontrar el bloque exactamente una vez; encontrado: ${n}`);
  return src.replace(before, after);
}
function read(p) {
  if (!fs.existsSync(p)) throw new Error(`No encuentro ${path.relative(root, p)}. Ejecuta este archivo desde la raíz del proyecto.`);
  return fs.readFileSync(p, 'utf8');
}

let server = read(serverPath);
server = replaceOnce(
  server,
  "    await run('ALTER TABLE cascada_stats ADD COLUMN IF NOT EXISTS lost BIGINT NOT NULL DEFAULT 0');     // pérdidas acumuladas por partida\n",
  "    await run('ALTER TABLE cascada_stats ADD COLUMN IF NOT EXISTS lost BIGINT NOT NULL DEFAULT 0');     // pérdidas acumuladas por partida\n" +
  "    await run('CREATE TABLE IF NOT EXISTS cascada_jackpots (id SMALLINT PRIMARY KEY CHECK (id = 1), rio BIGINT NOT NULL DEFAULT 0, mar BIGINT NOT NULL DEFAULT 0, cas BIGINT NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL)');\n" +
  "    await run('INSERT INTO cascada_jackpots (id, rio, mar, cas, updated_at) VALUES (1,0,0,0,$1) ON CONFLICT (id) DO NOTHING', [Date.now()]);\n",
  'Crear/sembrar tabla global de botes'
);
server = replaceOnce(
  server,
  "    const st = (await all('SELECT * FROM cascada_stats WHERE user_id = $1', [uid]))[0];\n",
  "    const st = (await all('SELECT * FROM cascada_stats WHERE user_id = $1', [uid]))[0];\n" +
  "    const jp = (await all('SELECT rio, mar, cas FROM cascada_jackpots WHERE id = 1'))[0] || { rio: 0, mar: 0, cas: 0 };\n",
  'Leer botes globales'
);
server = replaceOnce(
  server,
  "    return { ok: true, on: true, credits: Number((cr || {}).credits || 0), maxMult: MAX_M, stats: statsOf(st), bonusPending: Number((pend || {}).n || 0) };\n",
  "    return { ok: true, on: true, credits: Number((cr || {}).credits || 0), maxMult: MAX_M, stats: statsOf(st), jackpots: { rio: Number(jp.rio), mar: Number(jp.mar), cas: Number(jp.cas) }, bonusPending: Number((pend || {}).n || 0) };\n",
  'Enviar botes al navegador'
);
server = replaceOnce(
  server,
  "      // cobra el coste y paga los premios en UNA sola sentencia: no se puede gastar dos veces el mismo saldo ni jugar más de lo que se tiene\n" +
  "      const up = await client.query('UPDATE packs SET credits = credits - $1 + $2 WHERE code = $3 AND credits >= $1 RETURNING credits', [cost, prize, pack.code]);\n",
  "      // Bloqueo global: todas las cuentas comparten los mismos tres botes y ninguna partida puede pisar otra.\n" +
  "      const jpq = await client.query('SELECT rio, mar, cas FROM cascada_jackpots WHERE id = 1 FOR UPDATE');\n" +
  "      if (!jpq.rows.length) throw new Error('No existe la fila global de botes de Cascada');\n" +
  "      const pots = [0, Number(jpq.rows[0].rio), Number(jpq.rows[0].mar), Number(jpq.rows[0].cas)];\n" +
  "      let jackpotPaid = 0;\n" +
  "      for (const r of results) {\n" +
  "        pots[1] += 10; pots[2] += 10; pots[3] += 10;\n" +
  "        if (r.tier >= 1 && r.tier <= 3) { r.jackpot = pots[r.tier]; r.prize += r.jackpot; jackpotPaid += r.jackpot; pots[r.tier] = 0; }\n" +
  "      }\n" +
  "      prize += jackpotPaid;\n" +
  "      lost = results.reduce((s, r) => s + Math.max(0, m - r.prize), 0);\n" +
  "      best = results.reduce((v, r) => Math.max(v, r.prize), best);\n" +
  "      for (let i = results.length - 1; i >= 0; i--) { const r = results[i]; if (r.prize) { last = { prize: r.prize, tier: r.tier, sym: r.sym, count: r.count }; break; } }\n" +
  "      await client.query('UPDATE cascada_jackpots SET rio=$1, mar=$2, cas=$3, updated_at=$4 WHERE id=1', [pots[1], pots[2], pots[3], Date.now()]);\n" +
  "      // Cobra y paga dentro de la misma transacción que actualiza los botes.\n" +
  "      const up = await client.query('UPDATE packs SET credits = credits - $1 + $2 WHERE code = $3 AND credits >= $1 RETURNING credits', [cost, prize, pack.code]);\n",
  'Acumular, pagar y reiniciar botes en la transacción'
);
server = replaceOnce(
  server,
  "      return { ok: true, credits: Number(up.rows[0].credits), mult: m, results, stats: statsOf(st.rows[0]) };\n",
  "      return { ok: true, credits: Number(up.rows[0].credits), mult: m, results, stats: statsOf(st.rows[0]), jackpots: { rio: pots[1], mar: pots[2], cas: pots[3] } };\n",
  'Devolver botes actualizados'
);

let game = read(gamePath);
game = replaceOnce(
  game,
  "    botes: [0, 0, 0, 0], tick: Date.now(),\n",
  "    botes: [0, 0, 0, 0], jackpots: [0, 0, 0, 0], tick: Date.now(),\n",
  'Estado local de botes'
);
game = replaceOnce(
  game,
  "  const takeStats = (st) => {\n",
  "  const takeJackpots = (jp) => { if (jp) S.jackpots = [0, Number(jp.rio || 0), Number(jp.mar || 0), Number(jp.cas || 0)]; };\n" +
  "  const takeStats = (st) => {\n",
  'Función para refrescar botes'
);
game = replaceOnce(
  game,
  "      S.credits = j.credits; takeStats(j.stats); ready = true; needLogin = false;\n",
  "      S.credits = j.credits; takeStats(j.stats); takeJackpots(j.jackpots); ready = true; needLogin = false;\n",
  'Actualizar botes al sincronizar'
);
game = replaceOnce(
  game,
  "    ['Rio', 'Mar', 'Cas'].forEach((k, i) => {\n      const n = S.botes[i + 1] - (h.tier === i + 1 ? 1 : 0);\n",
  "    ['Rio', 'Mar', 'Cas'].forEach((k, i) => {\n      const n = S.botes[i + 1] - (h.tier === i + 1 ? 1 : 0);\n      const value = $('#bote' + k + ' .v'); if (value) value.textContent = fmt(S.jackpots[i + 1] || 0);\n",
  'Mostrar importe acumulado en las tres tarjetas'
);
game = replaceOnce(
  game,
  "  heartbeat(); setInterval(heartbeat, 2000);\n",
  "  heartbeat(); setInterval(heartbeat, 2000);\n" +
  "  // Todos los jugadores refrescan los mismos botes compartidos aunque no estén jugando.\n" +
  "  setInterval(async () => { if (ready && !running && !busy && !document.hidden) { try { await sync(); render(); } catch (e) { /* siguiente actualización */ } } }, 5000);\n",
  'Refresco global periódico'
);

fs.writeFileSync(serverPath, server);
fs.writeFileSync(gamePath, game);
console.log('Listo: modificados cascada-server.js y cascada/game.js');
console.log('La tabla cascada_jackpots se crea automáticamente al iniciar el servidor.');
console.log('No se han modificado los créditos, las tareas, los demás juegos ni los archivos de Terrenos.');
