'use strict';
// Parche de Cascada. Se ejecuta durante npm postinstall en Render.
// Cambia solo los módulos de Cascada y es idempotente.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;

function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error('Falta el archivo requerido: ' + rel);
  return { p, s: fs.readFileSync(p, 'utf8') };
}
function replaceFunction(src, start, end, replacement, label) {
  const a = src.indexOf(start);
  if (a < 0) throw new Error('No encuentro el inicio de ' + label);
  const b = src.indexOf(end, a + start.length);
  if (b < 0) throw new Error('No encuentro el final de ' + label);
  return src.slice(0, a) + replacement + '\n\n  ' + src.slice(b);
}
function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
  console.log('Cascada: actualizado ' + rel);
}

/* ---------------- motor: 3 horizontales + 6 diagonales, ambos sentidos ---------------- */
const ENGINE = String.raw`/* Cascada · motor de premios */
const CascadaEngine = (() => {
  const NAMES = ['Gota', 'Ola', 'Pez', 'Concha', 'Estrella', 'Delfín', 'Perla', 'Cofre'];
  const PAY = [
    [0,3,1,9420],[1,3,2,5000],[2,3,3,2420],[3,3,5,1760],[2,4,8,880],[4,3,10,440],
    [4,4,15,200],[3,4,20,120],[5,3,30,100],[2,5,50,50],[1,5,75,30],
    [5,5,100,100],[6,4,150,50],[7,4,250,26],[6,5,500,12],[7,5,1000,6]
  ];
  // Tres horizontales y diagonales de tres columnas (subiendo y bajando).
  // Cada línea se comprueba desde izquierda y desde derecha.
  const LINES = [
    { name:'horizontal-superior', cols:[0,1,2,3,4], rows:[0,0,0,0,0] },
    { name:'horizontal-central', cols:[0,1,2,3,4], rows:[1,1,1,1,1] },
    { name:'horizontal-inferior', cols:[0,1,2,3,4], rows:[2,2,2,2,2] },
    { name:'diagonal-descendente-1', cols:[0,1,2], rows:[0,1,2] },
    { name:'diagonal-ascendente-1', cols:[0,1,2], rows:[2,1,0] },
    { name:'diagonal-descendente-2', cols:[1,2,3], rows:[0,1,2] },
    { name:'diagonal-ascendente-2', cols:[1,2,3], rows:[2,1,0] },
    { name:'diagonal-descendente-3', cols:[2,3,4], rows:[0,1,2] },
    { name:'diagonal-ascendente-3', cols:[2,3,4], rows:[2,1,0] }
  ];
  const BONUS_W=200,TOTAL=100000,FILL=[22,20,18,14,10,7,5,4],FILL_SUM=FILL.reduce((a,b)=>a+b,0);
  const draw=()=>{let r=Math.random()*TOTAL,a=0;for(const [sym,count,prize,w] of PAY){a+=w;if(r<a)return{sym,count,prize};}a+=BONUS_W;if(r<a)return{sym:7,count:3,prize:0,bonus:true};return{sym:-1,count:0,prize:0};};
  const fillSym=()=>{let r=Math.random()*FILL_SUM,a=0;for(let i=0;i<FILL.length;i++){a+=FILL[i];if(r<a)return i;}return 0;};
  const tier=p=>p>=1000?3:p>=250?2:p>=100?1:0;
  const payoutFor=(sym,count)=>{let best=0;for(const p of PAY)if(p[0]===sym&&p[1]<=count&&p[2]>best)best=p[2];return best;};
  const scanLine=(grid,line,lineIndex)=>{
    const found=[];
    for(const dir of [1,-1]){
      const cols=dir===1?line.cols:[...line.cols].reverse();
      const firstCol=cols[0], firstPos=line.cols.indexOf(firstCol), row=line.rows[firstPos];
      const sym=grid[row][firstCol]; let count=1;
      for(let k=1;k<cols.length;k++){
        const c=cols[k],pos=line.cols.indexOf(c),rr=line.rows[pos];
        if(grid[rr][c]!==sym)break;
        count++;
      }
      const prize=count>=3?payoutFor(sym,count):0;
      if(prize){
        found.push({line:lineIndex+1,lineName:line.name,direction:dir===1?'izquierda-derecha':'derecha-izquierda',
          sym,count,prize,cells:cols.slice(0,count).map(c=>({row:line.rows[line.cols.indexOf(c)],col:c}))});
      }
    }
    return found.sort((a,b)=>b.prize-a.prize)[0]||null;
  };
  const evaluate=grid=>LINES.map((line,i)=>scanLine(grid,line,i)).filter(Boolean).sort((a,b)=>b.prize-a.prize);
  const buildGrid=o=>{
    if(o.bonus){const g=Array.from({length:3},()=>Array.from({length:5},fillSym));for(let c=0;c<3;c++)g[1][c]=7;return g;}
    let g,tries=0;do{g=Array.from({length:3},()=>Array.from({length:5},fillSym));tries++;}while(evaluate(g).length&&tries<1000);
    let candidates=LINES.filter(line=>line.cols.length>=o.count);
    if(o.count>=4)candidates=candidates.filter(line=>line.cols.length===5);
    const line=candidates[Math.floor(Math.random()*candidates.length)]||LINES[1];
    const dir=Math.random()<.5?1:-1,cols=dir===1?line.cols:[...line.cols].reverse();
    for(let k=0;k<o.count;k++){const c=cols[k],pos=line.cols.indexOf(c);g[line.rows[pos]][c]=o.sym;}
    return g;
  };
  const play=()=>{
    const o=draw();
    if(o.bonus){const grid=buildGrid(o);return{sym:7,count:3,prize:0,tier:0,bonus:true,grid,lines:[]};}
    const grid=buildGrid(o),lines=evaluate(grid),prize=lines.reduce((s,l)=>s+l.prize,0),primary=lines[0];
    return{sym:primary?primary.sym:o.sym,count:primary?primary.count:o.count,prize,tier:tier(primary?primary.prize:0),bonus:false,grid,lines};
  };
  return{NAMES,PAY,LINES,TOTAL,BONUS_W,play,tier,evaluate};
})();
if(typeof module!=='undefined')module.exports=CascadaEngine;`;

/* ---------------- servidor: botes globales en una transacción ---------------- */
const SERVER_INIT = `async function init() {
    if (!ON) return;
    await run('CREATE TABLE IF NOT EXISTS cascada_stats (user_id TEXT PRIMARY KEY, spins BIGINT NOT NULL DEFAULT 0, won BIGINT NOT NULL DEFAULT 0, best INT NOT NULL DEFAULT 0, botes_rio INT NOT NULL DEFAULT 0, botes_mar INT NOT NULL DEFAULT 0, botes_cas INT NOT NULL DEFAULT 0, last TEXT, updated_at BIGINT NOT NULL)');
    await run('ALTER TABLE cascada_stats ADD COLUMN IF NOT EXISTS spent BIGINT NOT NULL DEFAULT 0');
    await run('ALTER TABLE cascada_stats ADD COLUMN IF NOT EXISTS lost BIGINT NOT NULL DEFAULT 0');
    await run("CREATE TABLE IF NOT EXISTS cascada_bonus (id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, mult INT NOT NULL, board TEXT NOT NULL, picked TEXT NOT NULL DEFAULT '[]', acc BIGINT NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'open', created_at BIGINT NOT NULL)");
    await run('CREATE INDEX IF NOT EXISTS cascada_bonus_user ON cascada_bonus (user_id, state)');
    await run('CREATE TABLE IF NOT EXISTS cascada_jackpots (id SMALLINT PRIMARY KEY CHECK (id = 1), rio BIGINT NOT NULL DEFAULT 0, mar BIGINT NOT NULL DEFAULT 0, cas BIGINT NOT NULL DEFAULT 0, updated_at BIGINT NOT NULL)');
    await run('INSERT INTO cascada_jackpots (id, rio, mar, cas, updated_at) VALUES (1,0,0,0,$1) ON CONFLICT (id) DO NOTHING', [Date.now()]);
    await run('ALTER TABLE cascada_jackpots ENABLE ROW LEVEL SECURITY');
  }`;

const SERVER_GET = `async function get(req) {
    if (!ON) return { ok: true, on: false };
    const user = await needUser(req); const uid = String(user.id);
    const pack = await ensureUserPack(user);
    const cr = (await all('SELECT credits FROM packs WHERE code = $1', [pack.code]))[0];
    const st = (await all('SELECT * FROM cascada_stats WHERE user_id = $1', [uid]))[0];
    const pend = (await all('SELECT COUNT(*) AS n FROM cascada_bonus WHERE user_id = $1 AND state = $2', [uid, 'open']))[0];
    const jp = (await all('SELECT rio, mar, cas FROM cascada_jackpots WHERE id = 1'))[0] || { rio: 0, mar: 0, cas: 0 };
    return {
      ok: true, on: true, credits: Number((cr || {}).credits || 0), maxMult: MAX_M,
      stats: statsOf(st), bonusPending: Number((pend || {}).n || 0),
      jackpots: { rio: Number(jp.rio || 0), mar: Number(jp.mar || 0), cas: Number(jp.cas || 0) }
    };
  }`;

const SERVER_PLAY = `async function play(req, body) {
    if (!ON) throw new HttpError(404, 'Cascada está desactivada');
    const user = await needUser(req); const uid = String(user.id);
    const n = Math.floor(Number(body && body.n));
    if (!Number.isFinite(n) || n < 1 || n > MAX_N) throw new HttpError(400, \`Se pueden jugar de 1 a \${MAX_N} partidas cada vez\`);
    const m = body && body.m !== undefined && body.m !== null ? Math.floor(Number(body.m)) : 1;
    if (!Number.isFinite(m) || m < 1 || m > MAX_M) throw new HttpError(400, \`Los créditos por partida van de 1 a \${MAX_M}\`);
    if (rateHit('cascada:' + uid, 60_000) > MAX_PER_MIN) throw new HttpError(429, 'Vas muy rápido. Espera un momento');
    const pack = await ensureUserPack(user);
    const cost = n * m;

    // El motor calcula los símbolos y las líneas; el saldo y los tres botes se actualizan en una transacción.
    const results = Array.from({ length: n }, () => {
      const r = Engine.play();
      r.basePrize = Number(r.prize || 0);
      r.mult = m;
      return r;
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const debit = await client.query(
        'UPDATE packs SET credits = credits - $1 WHERE code = $2 AND credits >= $1 RETURNING credits',
        [cost, pack.code]
      );
      if (!debit.rows.length) throw new HttpError(402, 'No tienes créditos suficientes');

      // Una única fila global y bloqueada: todos los jugadores comparten los mismos tres acumulados.
      await client.query(
        'INSERT INTO cascada_jackpots (id, rio, mar, cas, updated_at) VALUES (1,0,0,0,$1) ON CONFLICT (id) DO NOTHING',
        [Date.now()]
      );
      const jpRes = await client.query('SELECT rio, mar, cas FROM cascada_jackpots WHERE id = 1 FOR UPDATE');
      const jackpots = {
        rio: Number(jpRes.rows[0].rio || 0),
        mar: Number(jpRes.rows[0].mar || 0),
        cas: Number(jpRes.rows[0].cas || 0)
      };

      let prize = 0, best = 0, lost = 0, last = null;
      const bt = [0, 0, 0, 0];
      for (const r of results) {
        // Cada partida añade 10 créditos a CADA bote, independientemente de quién juegue.
        jackpots.rio += 10; jackpots.mar += 10; jackpots.cas += 10;
        if (r.tier >= 1 && r.tier <= 3) {
          const key = ['', 'rio', 'mar', 'cas'][r.tier];
          r.prize = jackpots[key];
          jackpots[key] = 0;              // solo se reinicia el bote que acaba de salir
          r.jackpot = true;
        } else {
          r.prize = r.basePrize * m;
          r.jackpot = false;
        }
        prize += r.prize;
        lost += Math.max(0, m - r.prize);
        bt[r.tier || 0]++;
        if (r.prize > best) best = r.prize;
        if (r.prize) last = { prize: r.prize, tier: r.tier, sym: r.sym, count: r.count, jackpot: !!r.jackpot };
      }

      await client.query(
        'UPDATE cascada_jackpots SET rio=$1, mar=$2, cas=$3, updated_at=$4 WHERE id=1',
        [jackpots.rio, jackpots.mar, jackpots.cas, Date.now()]
      );

      // Las tres cajas aparecen ligadas a la cuenta que ganó el disparo; la partida queda pendiente en el servidor.
      for (const r of results) {
        if (!r.bonus) continue;
        const ins = await client.query(
          'INSERT INTO cascada_bonus (user_id, mult, board, created_at) VALUES ($1,$2,$3,$4) RETURNING id',
          [uid, m, JSON.stringify(newBoard(m)), Date.now()]
        );
        r.bonusId = Number(ins.rows[0].id);
      }

      const credit = await client.query(
        'UPDATE packs SET credits = credits + $1 WHERE code = $2 RETURNING credits',
        [prize, pack.code]
      );
      const st = await client.query(
        'INSERT INTO cascada_stats (user_id, spins, won, best, botes_rio, botes_mar, botes_cas, last, updated_at, spent, lost) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ' +
        'ON CONFLICT (user_id) DO UPDATE SET spins = cascada_stats.spins + EXCLUDED.spins, won = cascada_stats.won + EXCLUDED.won, best = GREATEST(cascada_stats.best, EXCLUDED.best), ' +
        'botes_rio = cascada_stats.botes_rio + EXCLUDED.botes_rio, botes_mar = cascada_stats.botes_mar + EXCLUDED.botes_mar, botes_cas = cascada_stats.botes_cas + EXCLUDED.botes_cas, ' +
        'last = COALESCE(EXCLUDED.last, cascada_stats.last), updated_at = EXCLUDED.updated_at, spent = cascada_stats.spent + EXCLUDED.spent, lost = cascada_stats.lost + EXCLUDED.lost RETURNING *',
        [uid, n, prize, best, bt[1], bt[2], bt[3], last ? JSON.stringify(last) : null, Date.now(), cost, lost]
      );
      await client.query('COMMIT');
      return {
        ok: true, credits: Number(credit.rows[0].credits), mult: m, results,
        stats: statsOf(st.rows[0]), jackpots
      };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { client.release(); }
  }`;

/* ---------------- parche de servidor ---------------- */
function patchServer() {
  const f = read('cascada-server.js');
  let s = f.s;
  if (!s.includes('CASCADA_JACKPOTS_V2')) {
    s = replaceFunction(s, 'async function init() {', '  const statsOf =', SERVER_INIT + '\n\n  // CASCADA_JACKPOTS_V2', 'init');
    // El reemplazo anterior deja una declaración statsOf duplicada si no se elimina la original.
    // Se conserva la función statsOf original: quitar solo el marcador duplicado.
    s = s.replace('  // CASCADA_JACKPOTS_V2\n  const statsOf =\n  const statsOf =', '  // CASCADA_JACKPOTS_V2\n  const statsOf =');
    s = replaceFunction(s, 'async function get(req) {', '  async function play(req, body) {', SERVER_GET, 'get');
    s = replaceFunction(s, 'async function play(req, body) {', '  /* ---------------- partida especial del tesoro', SERVER_PLAY, 'play');
    s = s.replace('CASCADA (servidor).', 'CASCADA (servidor).');
    write('cascada-server.js', s);
  } else {
    console.log('Cascada: cascada-server.js ya tiene el parche progresivo');
  }
}

/* ---------------- parche de interfaz y tesoro ---------------- */
function replaceOnce(src, from, to, label) {
  if (src.includes(to)) return src;
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error('No puedo aplicar "' + label + '": esperaba una coincidencia y encontré ' + n);
  return src.replace(from, to);
}
function patchGame() {
  const f = read('cascada/game.js');
  let s = f.s;
  s = replaceOnce(s,
    'botes: [0, 0, 0, 0], tick: Date.now(),',
    'botes: [0, 0, 0, 0], jackpots: { rio: 0, mar: 0, cas: 0 }, tick: Date.now(),',
    'estado de botes');
  s = replaceOnce(s,
    'S.credits = j.credits; takeStats(j.stats); ready = true;',
    'S.credits = j.credits; S.jackpots = j.jackpots || S.jackpots; takeStats(j.stats); ready = true;',
    'sincronización de botes');
  s = replaceOnce(s,
    'r = j.results[0];\n      S.credits = j.credits - r.prize;',
    'r = j.results[0];\n      S.jackpots = j.jackpots || S.jackpots;\n      S.credits = j.credits - r.prize;',
    'actualización de botes tras partida');
  s = replaceOnce(s,
    'S.credits = j.credits - sumPrize(j.results);',
    'S.credits = j.credits - sumPrize(j.results);\n        S.jackpots = j.jackpots || S.jackpots;',
    'actualización de botes en automático');
  s = replaceOnce(s,
    "  const highlight = (r) => {\n    const rs = reelEls();\n    for (let c = 0; c < r.count; c++) rs[c].firstElementChild.children[1].classList.add('win');\n    $('#line').classList.add('on');\n  };",
    "  const highlight = (r) => {\n    const rs = reelEls();\n    const cells = r.lines && r.lines[0] && r.lines[0].cells;\n    if (Array.isArray(cells) && cells.length) {\n      cells.forEach(({ row, col }) => { const reel = rs[col]; const node = reel && reel.firstElementChild.children[row]; if (node) node.classList.add('win'); });\n    } else { for (let c = 0; c < Math.min(r.count, rs.length); c++) rs[c].firstElementChild.children[1].classList.add('win'); }\n    $('#line').classList.add('on');\n  };",
    'resaltado de líneas');
  s = replaceOnce(s, 'if (r.bonusId) {   // tres cofres: ¡partida especial!', 'if (r.bonusId || r.bonus) {   // tres cofres: ¡partida especial!', 'aviso del tesoro');
  s = replaceOnce(s, 'if (r.bonusId) { sum.bonus++; needBonus = true; }', 'if (r.bonusId || r.bonus) { sum.bonus++; needBonus = true; }', 'resumen del tesoro');
  s = replaceOnce(s,
    'if (r.bonusId) { await sleep(2200); await runBonus(r.bonusId); }',
    'if (r.bonusId || r.bonus) { await sleep(900); if (r.bonusId) await runBonus(r.bonusId); else await pendingBonus(); }',
    'apertura del tesoro');
  s = replaceOnce(s,
    "    ['Rio', 'Mar', 'Cas'].forEach((k, i) => {\n      const n = S.botes[i + 1] - (h.tier === i + 1 ? 1 : 0);\n      $('#n' + k).textContent = n === 1 ? '1 vez' : n + ' veces';\n    });",
    "    ['Rio', 'Mar', 'Cas'].forEach((k, i) => {\n      const n = S.botes[i + 1] - (h.tier === i + 1 ? 1 : 0);\n      $('#n' + k).textContent = n === 1 ? '1 vez' : n + ' veces';\n    });\n    const jp = S.jackpots || { rio: 0, mar: 0, cas: 0 };\n    $('#boteRio .v').textContent = fmt(jp.rio) + ' créditos';\n    $('#boteMar .v').textContent = fmt(jp.mar) + ' créditos';\n    $('#boteCas .v').textContent = fmt(jp.cas) + ' créditos';",
    'importes de botes');
  s = s.replaceAll('COMPRAR ', 'JUGAR ');
  s = s.replaceAll('Compra completada', 'Sesión completada');
  s = s.replaceAll('Compra terminada', 'Sesión terminada');
  s = s.replaceAll('Compra de ', 'Sesión de ');
  s = s.replaceAll('compra en curso', 'sesión en curso');
  s = s.replaceAll('Apuesta por partida', 'Créditos por partida');
  s = s.replaceAll('línea central', 'línea premiada');
  write('cascada/game.js', s);
}
function patchBackground() {
  const f = read('cascada/bg.js');
  let s = f.s;
  s = replaceOnce(s, 'if (r.bonusId) AW.bonus++;', 'if (r.bonusId || r.bonus) AW.bonus++;', 'cofres en segundo plano');
  write('cascada/bg.js', s);
}
function patchHtml() {
  const f = read('cascada/index.html');
  let s = f.s;
  s = s.replace('100–150</div>', '0 créditos</div>')
       .replace('250–500</div>', '0 créditos</div>')
       .replace('1000</div>', '0 créditos</div>')
       .replace('Comprar partidas', 'Jugar varias partidas')
       .replace('COMPRAR 10 · 10 créditos', 'JUGAR 10 · 10 créditos');
  s = s.replace('<script src="engine.js"></script>', '<script src="engine.js?v=cascada-20261119"></script>')
       .replace('<script src="game.js"></script>', '<script src="game.js?v=cascada-20261119"></script>');
  write('cascada/index.html', s);
}

try {
  patchServer();
  const ef = read('cascada/engine.js');
  if (!ef.s.includes('diagonal-descendente-3')) write('cascada/engine.js', ENGINE);
  else console.log('Cascada: engine.js ya tiene las líneas ampliadas');
  patchGame();
  patchBackground();
  patchHtml();
  console.log('Cascada: parche aplicado correctamente.');
} catch (e) {
  console.error('Cascada: NO se completó el parche:', e.message);
  process.exitCode = 1;
}
