/* Cascada · motor de premios (sin dependencias, funciona en navegador y en Node) */
const CascadaEngine = (() => {
  // Símbolos: 0 Gota, 1 Ola, 2 Pez, 3 Concha, 4 Estrella de mar, 5 Delfín, 6 Perla, 7 Cofre
  const NAMES = ['Gota', 'Ola', 'Pez', 'Concha', 'Estrella', 'Delfín', 'Perla', 'Cofre'];

  // [símbolo, cuántos seguidos desde la izquierda, premio en créditos, peso sobre 100.000]
  const PAY = [
    // Premios pequeños (1–10): ~20 % de las partidas  → varios cada 20 partidas
    [0, 3, 1, 9420],    // (antes 11000: se rebajó para pagar la partida del tesoro y mantener el mismo retorno)
    [1, 3, 2, 5000],
    [2, 3, 3, 2420],
    [3, 3, 5, 1760],
    [2, 4, 8, 880],
    [4, 3, 10, 440],
    // Premios medios (15–75): ~0,5 %
    [4, 4, 15, 200],
    [3, 4, 20, 120],
    [5, 3, 30, 100],
    [2, 5, 50, 50],
    [1, 5, 75, 30],
    // Botes con figuras raras (100–1000): ~1 cada 500 partidas
    [5, 5, 100, 100],   // Bote Río
    [6, 4, 150, 50],    // Bote Río
    [7, 4, 250, 26],    // Bote Mar
    [6, 5, 500, 12],    // Bote Mar
    [7, 5, 1000, 6],    // Bote Cascada
  ];
  // TRES COFRES seguidos en la línea central = partida especial del tesoro (15 cartas, 3 bombas). 1 de cada 500 partidas.
  const BONUS_W = 200;
  const TOTAL = 100000;
  const FILL = [22, 20, 18, 14, 10, 7, 5, 4];
  const FILL_SUM = FILL.reduce((a, b) => a + b, 0);

  const draw = () => {
    let r = Math.random() * TOTAL, a = 0;
    for (const [sym, count, prize, w] of PAY) {
      a += w;
      if (r < a) return { sym, count, prize };
    }
    a += BONUS_W;
    if (r < a) return { sym: 7, count: 3, prize: 0, bonus: true };
    return { sym: -1, count: 0, prize: 0 };
  };

  const fillSym = () => {
    let r = Math.random() * FILL_SUM, a = 0;
    for (let i = 0; i < FILL.length; i++) { a += FILL[i]; if (r < a) return i; }
    return 0;
  };

  // evita que una fila "parezca" premiada sin serlo
  const noLine = (row) => {
    if (row[0] === row[1] && row[1] === row[2]) {
      do { row[2] = fillSym(); } while (row[2] === row[1]);
    }
  };

  const buildGrid = (o) => {
    const g = [[], [], []];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) g[r][c] = fillSym();
    noLine(g[0]); noLine(g[2]);
    const m = g[1];
    if (o.prize > 0 || o.bonus) {
      for (let c = 0; c < o.count; c++) m[c] = o.sym;
      if (o.count < 5) while (m[o.count] === o.sym) m[o.count] = fillSym();
    } else {
      noLine(m);
    }
    return g;
  };

  // 0 = sin bote, 1 = Río, 2 = Mar, 3 = Cascada
  const tier = (p) => (p >= 1000 ? 3 : p >= 250 ? 2 : p >= 100 ? 1 : 0);

  const play = () => {
    const o = draw();
    return { sym: o.sym, count: o.count, prize: o.prize, tier: tier(o.prize), bonus: !!o.bonus, grid: buildGrid(o) };
  };

  return { NAMES, PAY, TOTAL, BONUS_W, play, tier };
})();

if (typeof module !== 'undefined') module.exports = CascadaEngine;
