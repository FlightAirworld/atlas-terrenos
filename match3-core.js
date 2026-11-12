'use strict';
// GEMAS (motor del juego). Es el MISMO código en el navegador (gemas.js) y en el servidor (minijuegos-server.js):
// el servidor reproduce la partida con la misma semilla y la lista de movimientos, así que los créditos los decide él y no se pueden falsear.
// Todo es determinista: las gemas nuevas y el "factor variable" de los créditos salen de un generador con semilla.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Match3 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const W = 8, H = 8, N = W * H;
  const MILLI_PER_GEM = 4;       // 0,004 créditos por gema (se multiplica por la cadena y por un factor variable de 0,5 a 1,5)
  const DECAY_GEMS = Number((typeof process !== 'undefined' && process.env && process.env.GEMAS_DECAY) || 120);   // a las 120 gemas cada una vale la mitad (0 = sin descenso)
  const MAX_MILLI = 5000;        // máximo por partida: 5 créditos
  const MIN_GAP = 700;           // ms mínimos entre dos movimientos (lo que tarda la animación; frena a los bots)
  const GRACE = 900;             // margen de red al acabar el tiempo
  const LINE_H = 1, LINE_V = 2, BOMB = 3;   // gemas especiales: rayo horizontal, rayo vertical, arcoíris
  const EMPTY = -2;

  const kinds = level => (level >= 8 ? 6 : 5);                 // desde el nivel 8 sale un sexto color
  const target = level => 16 + 8 * (level - 1);                // gemas a romper para pasar de nivel
  const limit = level => Math.max(35, 75 - 3 * (level - 1));   // segundos del nivel

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function runsOf(s) {   // todas las líneas de 3 o más iguales
    const out = [], g = s.grid;
    for (let r = 0; r < H; r++) for (let c = 0; c < W;) {
      const t = g[r * W + c]; let k = c + 1;
      if (t >= 0) { while (k < W && g[r * W + k] === t) k++; if (k - c >= 3) out.push({ dir: 'h', cells: Array.from({ length: k - c }, (_, j) => r * W + c + j) }); }
      c = k;
    }
    for (let c = 0; c < W; c++) for (let r = 0; r < H;) {
      const t = g[r * W + c]; let k = r + 1;
      if (t >= 0) { while (k < H && g[k * W + c] === t) k++; if (k - r >= 3) out.push({ dir: 'v', cells: Array.from({ length: k - r }, (_, j) => (r + j) * W + c) }); }
      r = k;
    }
    return out;
  }

  const adjacent = (a, b) => Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < N && b < N &&
    ((a % W === b % W && Math.abs(a - b) === W) || ((a / W | 0) === (b / W | 0) && Math.abs(a - b) === 1));

  function swap(s, a, b) {
    for (const k of ['grid', 'spec', 'ids']) { const t = s[k][a]; s[k][a] = s[k][b]; s[k][b] = t; }
  }

  function findMove(s) {   // una jugada válida (sirve para la pista y para comprobar que el tablero no está bloqueado)
    for (let i = 0; i < N; i++) for (const j of [i + 1, i + W]) {
      if (j >= N || !adjacent(i, j)) continue;
      if (s.spec[i] === BOMB || s.spec[j] === BOMB) return [i, j];
      swap(s, i, j); const ok = runsOf(s).length > 0; swap(s, i, j);
      if (ok) return [i, j];
    }
    return null;
  }

  function fillBoard(s) {   // tablero sin tríos y con al menos una jugada
    do {
      const K = kinds(s.level);
      for (let i = 0; i < N; i++) {
        const c = i % W, r = (i / W) | 0; let t;
        do { t = (s.rnd() * K) | 0; } while ((c >= 2 && s.grid[i - 1] === t && s.grid[i - 2] === t) || (r >= 2 && s.grid[i - W] === t && s.grid[i - 2 * W] === t));
        s.grid[i] = t; s.spec[i] = 0; s.ids[i] = s.nextId++;
      }
    } while (!findMove(s));
  }

  function create(seed) {
    const s = { rnd: mulberry(seed), level: 1, levelGems: 0, gems: 0, score: 0, milli: 0, start: 0, deadline: limit(1) * 1000, last: -MIN_GAP, over: false,
      nextId: 1, grid: new Array(N).fill(EMPTY), spec: new Array(N).fill(0), ids: new Array(N).fill(0) };
    fillBoard(s);
    return s;
  }

  const snapshot = s => s.grid.map((type, i) => ({ id: s.ids[i], type, special: s.spec[i], c: i % W, r: (i / W) | 0 }));

  function expand(s, clear, protectedCells) {   // los especiales que se rompen disparan su efecto (en cadena)
    const queue = [...clear];
    while (queue.length) {
      const i = queue.pop(), sp = s.spec[i]; if (!sp || protectedCells.has(i)) continue;
      const add = [], r = (i / W) | 0, c = i % W;
      if (sp === LINE_H) for (let x = 0; x < W; x++) add.push(r * W + x);
      else if (sp === LINE_V) for (let y = 0; y < H; y++) add.push(y * W + c);
      else for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < H && x >= 0 && x < W) add.push(y * W + x);
      for (const j of add) if (!clear.has(j)) { clear.add(j); queue.push(j); }
    }
  }

  function cascade(s, hint, forced, steps) {   // rompe, deja caer, rellena y repite mientras haya combinaciones
    let chain = 0, first = true;
    for (;;) {
      const runs = runsOf(s);
      if (!runs.length && !(first && forced && forced.size)) break;
      chain++;
      const clear = new Set(first && forced ? forced : []), spawn = [];
      for (const run of runs) {
        run.cells.forEach(i => clear.add(i));
        if (run.cells.length >= 4) {
          const at = run.cells.find(i => hint.includes(i));
          const pos = at === undefined ? run.cells[(run.cells.length / 2) | 0] : at;
          if (!s.spec[pos]) spawn.push({ i: pos, type: s.grid[pos], special: run.cells.length >= 5 ? BOMB : run.dir === 'h' ? LINE_H : LINE_V });
        }
      }
      spawn.forEach(sp => clear.delete(sp.i));
      expand(s, clear, new Set(spawn.map(sp => sp.i)));
      const spawned = spawn.filter(sp => !clear.has(sp.i));
      const removed = [...clear].map(i => s.ids[i]);
      const count = clear.size, mult = Math.min(2.5, 1 + 0.25 * (chain - 1)), f = 0.5 + s.rnd();   // f: factor variable 0,5–1.5
      const decay = DECAY_GEMS > 0 ? 1 / (1 + s.gems / DECAY_GEMS) : 1;   // rendimientos decrecientes: cuantas más gemas llevas en la partida, menos vale cada una
      const ev = Math.max(0, Math.min(MAX_MILLI - s.milli, Math.max(1, Math.round(count * MILLI_PER_GEM * mult * f * decay))));
      s.milli += ev; s.score += count * 10 * chain; s.gems += count; s.levelGems += count;
      for (const i of clear) { s.grid[i] = EMPTY; s.spec[i] = 0; }
      for (const sp of spawned) { s.spec[sp.i] = sp.special; if (sp.special === BOMB) s.grid[sp.i] = -1; }
      for (let c = 0; c < W; c++) {   // gravedad
        let w = H - 1;
        for (let r = H - 1; r >= 0; r--) {
          const i = r * W + c; if (s.grid[i] === EMPTY) continue;
          if (w !== r) { const j = w * W + c; s.grid[j] = s.grid[i]; s.spec[j] = s.spec[i]; s.ids[j] = s.ids[i]; s.grid[i] = EMPTY; s.spec[i] = 0; }
          w--;
        }
        for (let r = w; r >= 0; r--) { const i = r * W + c; s.grid[i] = (s.rnd() * kinds(s.level)) | 0; s.spec[i] = 0; s.ids[i] = s.nextId++; }
      }
      steps.push({ removed, spawn: spawned.map(sp => ({ id: s.ids[sp.i], special: sp.special })), gained: ev, chain, count, after: snapshot(s) });
      first = false; hint = [];
    }
  }

  function play(s, a, b, t) {   // un movimiento del jugador: intercambiar dos casillas contiguas
    if (s.over) return { ok: false, over: true };
    if (!Number.isInteger(t) || t < s.start || t < s.last + MIN_GAP) return { ok: false };
    if (t > s.deadline + GRACE) { s.over = true; return { ok: false, over: true }; }
    if (!adjacent(a, b)) return { ok: false };
    const sa = s.spec[a], sb = s.spec[b], steps = [];
    swap(s, a, b);
    let forced = null;
    if (sa === BOMB || sb === BOMB) {   // el arcoíris rompe todas las gemas del color con el que se cambia
      forced = new Set();
      if (sa === BOMB && sb === BOMB) for (let i = 0; i < N; i++) forced.add(i);
      else { const bombAt = sa === BOMB ? b : a, other = sa === BOMB ? a : b, col = s.grid[other]; forced.add(bombAt); for (let i = 0; i < N; i++) if (s.grid[i] === col) forced.add(i); expand(s, forced, new Set()); }
    } else if (!runsOf(s).length) { swap(s, a, b); return { ok: false, invalid: true }; }
    s.last = t;
    const before = s.level;
    cascade(s, [a, b], forced, steps);
    let levelUp = false;
    if (s.levelGems >= target(s.level)) { s.level++; s.levelGems = 0; s.start = t; s.deadline = t + limit(s.level) * 1000; levelUp = true; }
    let shuffled = false;
    for (let tries = 0; !findMove(s) || runsOf(s).length; tries++) {   // sin jugadas: se mezcla el tablero
      shuffled = true;
      if (tries > 40) { fillBoard(s); break; }
      for (let i = N - 1; i > 0; i--) { const j = (s.rnd() * (i + 1)) | 0; swap(s, i, j); }
    }
    return { ok: true, steps, levelUp, level: s.level, shuffled, final: snapshot(s), before };
  }

  function replay(seed, moves) {   // el servidor reproduce la partida; se queda con los movimientos válidos hasta el primero que no lo sea
    const s = create(seed); let used = 0, lastT = 0;
    for (const m of moves) {
      if (!Array.isArray(m) || m.length < 3) break;
      const r = play(s, m[0], m[1], m[2]);
      if (!r.ok) break;
      used++; lastT = m[2];
    }
    return { state: s, used, lastT };
  }

  return { W, H, N, MAX_MILLI, MIN_GAP, LINE_H, LINE_V, BOMB, kinds, target, limit, create, play, replay, findMove, snapshot };
});
