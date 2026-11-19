/* Cascada · motor de premios (sin dependencias, funciona en navegador y en Node) */
const CascadaEngine = (() => {
  // Aleatoriedad: en el servidor (Node) se usa crypto, que no se puede predecir; en el navegador solo sirve para dibujar los rodillos de relleno
  const rnd = (typeof module !== 'undefined' && typeof require === 'function')
    ? (() => { const c = require('node:crypto'); return () => c.randomInt(0, 2 ** 47) / 2 ** 47; })()
    : Math.random;

  // Símbolos: 0 Gota, 1 Ola, 2 Pez, 3 Concha, 4 Estrella de mar, 5 Delfín, 6 Perla, 7 Cofre
  const NAMES = ['Gota', 'Ola', 'Pez', 'Concha', 'Estrella', 'Delfín', 'Perla', 'Cofre'];

  // Devolución total ≈ 70 % de lo jugado (cada 100 créditos jugados se devuelven 70 de media)
  // [símbolo, cuántos seguidos desde la izquierda, premio en créditos, peso sobre 100.000]
  const PAY = [
    // Premios pequeños (1–10): ~15 % de las partidas  → unos 3 cada 20 partidas
    [0, 3, 1, 7794],
    [1, 3, 2, 3584],
    [2, 3, 3, 1735],
    [3, 3, 5, 1262],
    [2, 4, 8, 631],
    [4, 3, 10, 315],
    // Premios medios (15–75): ~0,3 %
    [4, 4, 15, 143],
    [3, 4, 20, 86],
    [5, 3, 30, 72],
    [2, 5, 50, 36],
    [1, 5, 75, 22],
    // Botes con figuras raras (100–1000): ~1 cada 700 partidas
    [5, 5, 100, 72],   // Bote Río
    [6, 4, 150, 36],    // Bote Río
    [7, 4, 250, 19],    // Bote Mar
    [6, 5, 500, 9],    // Bote Mar
    [7, 5, 1000, 4],    // Bote Cascada
  ];
  const TOTAL = 100000;
  const FILL = [22, 20, 18, 14, 10, 7, 5, 4];
  const FILL_SUM = FILL.reduce((a, b) => a + b, 0);

  const draw = () => {
    let r = rnd() * TOTAL, a = 0;
    for (const [sym, count, prize, w] of PAY) {
      a += w;
      if (r < a) return { sym, count, prize };
    }
    return { sym: -1, count: 0, prize: 0 };
  };

  const fillSym = () => {
    let r = rnd() * FILL_SUM, a = 0;
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
    if (o.prize > 0) {
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
    return { sym: o.sym, count: o.count, prize: o.prize, tier: tier(o.prize), grid: buildGrid(o) };
  };

  return { NAMES, PAY, TOTAL, play, tier };
})();

if (typeof module !== 'undefined') module.exports = CascadaEngine;
