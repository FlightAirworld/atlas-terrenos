'use strict';
// PREHISTORIA: dibujos (SVG, de perfil mirando a la derecha) y datos de cada animal: tamaño, velocidad, qué come, qué sonido hace y qué dice.
// Los usa prehistoria.js. Todo es vectorial y ligero: sin imágenes. Las patas llevan la clase «pr-leg» (se animan al andar) y las alas «pr-wing».
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PrehistoriaDibujos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const GY = 96;   // el suelo, en el dibujo
  const ell = (cx, cy, rx, ry, f, x) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${x ? ' ' + x : ''}/>`;
  const poly = (pts, f, x) => `<polygon points="${pts}" fill="${f}"${x ? ' ' + x : ''}/>`;
  const eye = (x, y, r) => ell(x, y, r, r, '#fff') + ell(x + r * 0.25, y, r * 0.55, r * 0.55, '#111');
  const leg = (x, hy, w, f, cls, claw) => `<g class="pr-leg ${cls || 'a'}"><rect x="${x - w / 2}" y="${hy}" width="${w}" height="${GY - hy}" rx="${w / 2}" fill="${f}"/>${ell(x + w * 0.45, GY - 1.5, w * 0.95, w * 0.38, f)}${claw ? poly(`${x + w * 1.2},${GY - 3} ${x + w * 1.9},${GY} ${x + w * 1.1},${GY}`, '#f4efe2') : ''}</g>`;
  const tail = (bx, by, rx, ry, len, up, th, f) => { const a = bx - rx * 0.7, tx = bx - rx - len, ty = by + up; return `<path d="M${a},${by - ry * 0.55} Q${bx - rx - len * 0.45},${by - th * 0.5 + up * 0.3} ${tx},${ty} Q${bx - rx - len * 0.4},${by + th * 0.55 + up * 0.2} ${a},${by + ry * 0.5}Z" fill="${f}"/>`; };
  const neck = (nx, ny, hx, hy, w, f, bend) => `<path d="M${nx},${ny} Q${nx + (hx - nx) * 0.15 + (bend || 0)},${ny + (hy - ny) * 0.85} ${hx},${hy}" stroke="${f}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const stripes = (bx, by, rx, ry, f, n) => { let s = ''; for (let i = 0; i < n; i++) { const x = bx - rx * 0.6 + i * (rx * 1.3 / n); s += `<path d="M${x},${by - ry * 0.95} q${3},${ry * 0.7} ${-2},${ry * 1.1}" stroke="${f}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>`; } return s; };

  // ---------- Cabezas ----------
  const HEAD = {
    rex: (x, y, c, c2) => ell(x + 5, y, 15, 10, c) + ell(x + 17, y + 1, 10, 7, c) + ell(x + 12, y + 8, 13, 4.5, c2) + poly(`${x + 6},${y + 4} ${x + 8},${y + 8} ${x + 10},${y + 4} ${x + 13},${y + 4} ${x + 15},${y + 8} ${x + 17},${y + 4} ${x + 21},${y + 4} ${x + 23},${y + 8} ${x + 25},${y + 3}`, '#fbfbf2') + eye(x + 6, y - 3, 2.6) + ell(x + 25, y - 2, 1.2, 1, '#222'),
    long: (x, y, c, c2) => ell(x + 3, y, 9, 6, c) + ell(x + 14, y + 1, 9, 4, c) + ell(x + 11, y + 5, 10, 2.6, c2) + poly(`${x + 8},${y + 3} ${x + 9},${y + 6} ${x + 11},${y + 3} ${x + 14},${y + 3} ${x + 15},${y + 6} ${x + 17},${y + 3} ${x + 21},${y + 3}`, '#fbfbf2') + eye(x + 4, y - 2, 2),
    spino: (x, y, c, c2) => ell(x + 3, y, 8, 5.5, c) + ell(x + 18, y + 2, 14, 3.6, c) + ell(x + 15, y + 5.6, 14, 2.3, c2) + poly(`${x + 9},${y + 4} ${x + 10},${y + 7} ${x + 12},${y + 4} ${x + 16},${y + 4} ${x + 17},${y + 7} ${x + 19},${y + 4} ${x + 25},${y + 4}`, '#fbfbf2') + eye(x + 3, y - 2, 2),
    beak: (x, y, c, c2) => ell(x + 3, y, 6.5, 5, c) + poly(`${x + 8},${y - 3} ${x + 17},${y + 1} ${x + 8},${y + 4}`, '#f2a43a') + eye(x + 3, y - 1.5, 1.8),
    duck: (x, y, c, c2) => `<path d="M${x},${y - 3} Q${x - 14},${y - 12} ${x - 26},${y - 6}" stroke="${c2}" stroke-width="5" fill="none" stroke-linecap="round"/>` + ell(x + 3, y, 9, 6, c) + ell(x + 14, y + 2, 9, 4.2, c) + ell(x + 20, y + 2.5, 3.5, 3.6, c) + eye(x + 4, y - 2, 2),
    tricer: (x, y, c, c2) => ell(x - 3, y - 4, 13, 15, c2) + ell(x - 3, y - 4, 9, 11, '#e8b87a', 'opacity=".55"') + ell(x + 9, y + 4, 12, 8, c) + ell(x + 19, y + 6, 6, 5, c) + poly(`${x + 6},${y - 3} ${x + 22},${y - 12} ${x + 10},${y + 2}`, '#f7f1dd') + poly(`${x + 12},${y - 3} ${x + 28},${y - 9} ${x + 15},${y + 2}`, '#f7f1dd') + poly(`${x + 19},${y + 3} ${x + 25},${y - 4} ${x + 23},${y + 4}`, '#f7f1dd') + eye(x + 9, y + 1, 2.3),
    sauro: (x, y, c) => ell(x + 4, y, 8, 5, c) + ell(x + 10, y + 1, 4, 3.5, c) + eye(x + 4, y - 1.5, 1.8),
    stego: (x, y, c) => ell(x + 4, y, 8, 5, c) + ell(x + 13, y + 3, 7, 3.4, c) + poly(`${x + 17},${y + 1} ${x + 21},${y + 4} ${x + 15},${y + 5}`, '#f2a43a') + eye(x + 4, y - 1.5, 1.8),
    anky: (x, y, c, c2) => ell(x + 5, y, 10, 6.5, c) + ell(x + 14, y + 2, 7, 4, c) + poly(`${x - 2},${y - 5} ${x - 8},${y - 12} ${x + 2},${y - 8}`, '#e9e0c8') + poly(`${x + 8},${y - 5} ${x + 13},${y - 11} ${x + 12},${y - 4}`, '#e9e0c8') + eye(x + 6, y - 1, 2),
    dilo: (x, y, c, c2) => ell(x + 3, y, 9, 6, c) + ell(x + 14, y + 1, 9, 4, c) + ell(x + 11, y + 5, 10, 2.6, c2) + `<path d="M${x - 1},${y - 5} Q${x + 2},${y - 17} ${x + 10},${y - 7} Q${x + 14},${y - 15} ${x + 17},${y - 4} Z" fill="#d94f4f"/>` + eye(x + 4, y - 2, 2)
  };

  // ---------- Dinosaurios de dos patas ----------
  function biped(o) {
    const { bx, by, rx, ry, c, c2, bel } = o, hy = by + ry * 0.5, nx = bx + rx * 0.6, ny = by - ry * 0.35;
    const hx = o.hx, hyy = o.hy;
    return tail(bx, by, rx, ry, o.tail, o.up || 0, o.th || 12, c) + leg(bx - 5, hy, o.lw, c2, 'b', o.claw) +
      ell(bx, by, rx, ry, c) + ell(bx + 2, by + ry * 0.45, rx * 0.8, ry * 0.5, bel) + (o.stripes ? stripes(bx, by, rx, ry, c2, o.stripes) : '') +
      (o.sail || '') + neck(nx, ny, hx, hyy, o.nw, c, o.bend) + HEAD[o.head](hx - 4, hyy, c, c2) +
      (o.arm ? `<path d="M${nx - 2},${by + 2} l7,5 l-2,3 l-7,-4z" fill="${c2}"/>` : '') +
      leg(bx + 7, hy, o.lw, c, 'a', o.claw) + ell(bx - 4, hy + 1, o.lw * 0.9, o.lw * 0.75, c);
  }
  // ---------- Dinosaurios de cuatro patas ----------
  function quad(o) {
    const { bx, by, rx, ry, c, c2, bel } = o, hy = by + ry * 0.45, nx = bx + rx * 0.7, ny = by - ry * 0.2;
    return tail(bx, by, rx, ry, o.tail, o.up || 0, o.th || 14, c) + (o.tailx || '') + leg(bx - rx * 0.45, hy, o.lw, c2, 'b') + leg(bx + rx * 0.55, hy, o.lw, c2, 'a') +
      (o.back || '') + ell(bx, by, rx, ry, c) + ell(bx, by + ry * 0.5, rx * 0.85, ry * 0.5, bel) + (o.stripes ? stripes(bx, by, rx, ry, c2, o.stripes) : '') + (o.over || '') +
      neck(nx, ny, o.hx, o.hy, o.nw, c, o.bend) + HEAD[o.head](o.hx - 4, o.hy, c, c2) +
      leg(bx - rx * 0.25, hy, o.lw, c, 'a') + leg(bx + rx * 0.75, hy, o.lw, c, 'b');
  }
  const plates = (bx, by, rx, ry, n, col) => { let s = ''; for (let i = 0; i < n; i++) { const t = i / (n - 1), x = bx - rx * 0.75 + t * rx * 1.45, y = by - ry * Math.sqrt(1 - Math.pow((x - bx) / rx, 2)) * 0.96, h = 10 + 12 * Math.sin(Math.PI * t); s += poly(`${x - 5},${y + 2} ${x},${y - h} ${x + 5},${y + 2}`, col); } return s; };
  const bumps = (bx, by, rx, ry, n, col) => { let s = ''; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = bx - rx * 0.8 + t * rx * 1.6, y = by - ry * Math.sqrt(1 - Math.pow((x - bx) / rx, 2)) * 0.9; s += ell(x, y + 1, 3.6, 3, col) + poly(`${x - 2},${y} ${x},${y - 6} ${x + 2},${y}`, '#e9e0c8'); } return s; };

  const DRAW = {
    trex: () => biped({ bx: 60, by: 46, rx: 29, ry: 19, c: '#5f8a3a', c2: '#3f5f25', bel: '#d3dd9c', hx: 99, hy: 27, nw: 17, bend: -4, head: 'rex', tail: 48, up: 6, th: 15, lw: 12, arm: 1, stripes: 4 }),
    allo: () => biped({ bx: 60, by: 48, rx: 25, ry: 15, c: '#b5683a', c2: '#7d3f1f', bel: '#f0d3a0', hx: 96, hy: 32, nw: 12, head: 'long', tail: 46, up: 4, th: 12, lw: 9, arm: 1, claw: 1, stripes: 4 }),
    raptor: () => biped({ bx: 62, by: 56, rx: 20, ry: 10, c: '#c9892a', c2: '#6b3f12', bel: '#f6e3b0', hx: 90, hy: 42, nw: 8, head: 'long', tail: 44, up: 2, th: 8, lw: 6, arm: 1, claw: 1, stripes: 5 }),
    dilo: () => biped({ bx: 62, by: 54, rx: 22, ry: 11, c: '#3f9d8d', c2: '#1d5e55', bel: '#d7f0e4', hx: 92, hy: 40, nw: 9, head: 'dilo', tail: 44, up: 2, th: 9, lw: 7, arm: 1, claw: 1, stripes: 4 }),
    compy: () => biped({ bx: 62, by: 66, rx: 14, ry: 7, c: '#d6c25a', c2: '#8a7a22', bel: '#fff6c8', hx: 84, hy: 56, nw: 5, head: 'beak', tail: 38, up: 0, th: 6, lw: 4, arm: 0, stripes: 3 }),
    galli: () => biped({ bx: 60, by: 52, rx: 18, ry: 11, c: '#cf7f6a', c2: '#8a4636', bel: '#f7dcc8', hx: 84, hy: 18, nw: 5, bend: -10, head: 'beak', tail: 22, up: -2, th: 8, lw: 5, arm: 0, stripes: 3 }),
    parasau: () => biped({ bx: 56, by: 50, rx: 24, ry: 15, c: '#7aa34a', c2: '#4a6b27', bel: '#e6efb8', hx: 84, hy: 28, nw: 11, bend: -3, head: 'duck', tail: 38, up: 5, th: 13, lw: 10, arm: 0, stripes: 4 }),
    spino: () => biped({ bx: 58, by: 48, rx: 27, ry: 17, c: '#4f7f94', c2: '#2c4f5f', bel: '#d3e6e8', hx: 94, hy: 30, nw: 14, head: 'spino', tail: 44, up: 6, th: 14, lw: 11, arm: 1, sail: `<path d="M34,36 Q44,0 60,4 Q76,2 84,34 Z" fill="#c8553d"/><path d="M42,32 L46,10 M52,30 L54,6 M62,30 L63,5 M72,30 L72,10" stroke="#8d3321" stroke-width="2"/>` }),
    tricer: () => quad({ bx: 56, by: 54, rx: 33, ry: 20, c: '#8a9a5b', c2: '#58673a', bel: '#dfe4b4', hx: 96, hy: 56, nw: 18, head: 'tricer', tail: 22, up: 6, th: 14, lw: 13, stripes: 4 }),
    brachio: () => quad({ bx: 50, by: 56, rx: 26, ry: 17, c: '#86a65a', c2: '#52703a', bel: '#e8f0bf', hx: 118, hy: 8, nw: 11, bend: 18, head: 'sauro', tail: 36, up: 8, th: 13, lw: 13, stripes: 5 })
  };
  // detalles que dependen del cuerpo (placas, armadura, púas, maza): se añaden después
  DRAW.stego = () => {
    const b = { bx: 60, by: 54, rx: 31, ry: 18 };
    return tail(b.bx, b.by, b.rx, b.ry, 30, 8, 12, '#7a8f4a') + poly('6,60 -4,48 12,56', '#f2e9c8') + poly('12,66 2,58 18,62', '#f2e9c8') +
      leg(b.bx - 14, 62, 12, '#4b5c2a', 'b') + leg(b.bx + 17, 62, 12, '#4b5c2a', 'a') + plates(b.bx, b.by, b.rx, b.ry, 7, '#c9743f') + ell(b.bx, b.by, b.rx, b.ry, '#7a8f4a') + ell(b.bx, b.by + 9, 27, 9, '#dfe8b0') + stripes(b.bx, b.by, b.rx, b.ry, '#4b5c2a', 4) +
      neck(b.bx + 22, b.by - 2, 98, 68, 12, '#7a8f4a') + HEAD.stego(94, 68, '#7a8f4a') + leg(b.bx - 4, 62, 12, '#7a8f4a', 'a') + leg(b.bx + 27, 62, 12, '#7a8f4a', 'b');
  };
  DRAW.anky = () => {
    const b = { bx: 60, by: 66, rx: 34, ry: 15 };
    return tail(b.bx, b.by, b.rx, b.ry, 26, 6, 11, '#8a7a5a') + ell(8, 74, 9, 7, '#56482f') + poly('2,70 -2,64 6,68', '#e9e0c8') + leg(b.bx - 18, 72, 12, '#56482f', 'b') + leg(b.bx + 18, 72, 12, '#56482f', 'a') + ell(b.bx, b.by, b.rx, b.ry, '#8a7a5a') +
      bumps(b.bx, b.by, b.rx, b.ry, 7, '#56482f') + ell(b.bx, b.by + 7, 28, 6, '#e2d8b8') + neck(b.bx + 26, b.by, 100, 72, 12, '#8a7a5a') + HEAD.anky(96, 72, '#8a7a5a', '#56482f') + leg(b.bx - 4, 72, 12, '#8a7a5a', 'a') + leg(b.bx + 26, 72, 12, '#8a7a5a', 'b');
  };

  // ---------- Reptavoladores (vista de perfil, en pleno vuelo) ----------
  function ptero(c, c2, crest, beak, tailLen) {
    const wing = (cls, col, dx) => `<g class="pr-wing ${cls}"><path d="M${72 + dx},48 L${22 + dx},6 Q${34 + dx},34 ${40 + dx},52 Z" fill="${col}"/><path d="M${72 + dx},48 L${118 + dx},4 Q${104 + dx},36 ${92 + dx},52 Z" fill="${col}"/><path d="M${72 + dx},48 L${40 + dx},20 M${72 + dx},48 L${96 + dx},18" stroke="${c2}" stroke-width="1.6" opacity=".6"/></g>`;
    return wing('far', c2, -4) + `<path d="M64,56 Q40,60 ${40 - tailLen},62 Q50,52 64,52Z" fill="${c}"/>` + ell(76, 56, 17, 8.5, c) + ell(78, 61, 13, 4.2, '#f4e7c0') +
      `<path d="M88,52 Q104,40 112,42" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>` + ell(114, 42, 7, 5, c) + poly(`118,40 ${118 + beak},44 118,46`, '#f2a43a') +
      poly(`108,38 ${108 - crest},30 112,44`, '#d94f4f') + eye(113, 40.5, 1.9) + wing('near', c, 0);
  }
  DRAW.ptero = () => ptero('#c08a5a', '#8a5a36', 14, 30, 4);
  DRAW.quetzal = () => ptero('#a9b6bf', '#6e7e8a', 6, 40, 0);
  DRAW.rhampho = () => ptero('#9e5d8a', '#693a5a', 2, 10, 34);

  // ---------- Reptil marino ----------
  DRAW.plesio = () => `<path d="M0,86 Q16,80 32,86 T64,86 T96,86 T128,86 T160,86" stroke="#bfe7ee" stroke-width="3" fill="none" opacity=".7"/>` +
    `<path d="M26,66 Q14,70 6,80 Q20,76 34,76Z" fill="#4f8a8e"/>` + ell(64, 72, 30, 12, '#5b9a9c') + ell(64, 78, 24, 6, '#c9e8dc') +
    `<g class="pr-neck"><path d="M84,64 Q104,60 106,36 Q108,22 116,20" stroke="#5b9a9c" stroke-width="10" fill="none" stroke-linecap="round"/>${ell(122, 19, 9, 5.5, '#5b9a9c')}${eye(121, 17, 1.8)}</g>` +
    `<g class="pr-leg a">${ell(80, 80, 13, 4, '#3f7075', 'transform="rotate(25 80 80)"')}</g><g class="pr-leg b">${ell(46, 80, 13, 4, '#3f7075', 'transform="rotate(-25 46 80)"')}</g>` +
    `<path d="M0,90 Q16,84 32,90 T64,90 T96,90 T128,90 T160,90 V100 H0Z" fill="#2a86a4" opacity=".75"/>`;

  // ---------- Bichos ----------
  DRAW.libelula = () => `<g class="pr-wing"><ellipse cx="46" cy="28" rx="22" ry="7" fill="#dff6ff" opacity=".65" transform="rotate(-18 46 28)"/><ellipse cx="46" cy="44" rx="22" ry="7" fill="#dff6ff" opacity=".65" transform="rotate(18 46 44)"/></g>` +
    ell(20, 36, 3.2, 2, '#2e6f4e') + ell(28, 36, 8, 2.4, '#2e6f4e') + `<path d="M34,36 L84,36" stroke="#3f9d6a" stroke-width="3.4" stroke-linecap="round"/><path d="M44,36 h4 M56,36 h4 M68,36 h4" stroke="#1c4a33" stroke-width="3.4"/>` + ell(12, 36, 5.5, 5, '#e0553a') + eye(10, 34, 2.2);
  DRAW.artropleura = () => { let s = ''; const n = 11; for (let i = 0; i < n; i++) { const x = 14 + i * 12; s += `<g class="pr-leg ${i % 2 ? 'a' : 'b'}"><path d="M${x},58 l-3,14 M${x + 4},58 l3,14" stroke="#6b4a2c" stroke-width="2.2" stroke-linecap="round"/></g>`; } for (let i = 0; i < n; i++) s += ell(18 + i * 12, 52, 8, 10, i % 2 ? '#8a6038' : '#a97646'); return s + ell(150, 52, 9, 8, '#5a3d22') + eye(153, 49, 1.6) + `<path d="M156,46 q8,-6 12,-2 M156,52 q9,0 12,5" stroke="#5a3d22" stroke-width="1.6" fill="none"/>`; };
  DRAW.escorpion = () => `<path d="M30,50 Q4,48 6,20 Q8,6 24,8" stroke="#8a3d2a" stroke-width="7" fill="none" stroke-linecap="round"/>` + poly('24,2 32,10 24,14', '#d9b13a') +
    `<g class="pr-leg a"><path d="M52,60 l-6,14 M64,62 l-4,14" stroke="#5a2a1c" stroke-width="2.4" stroke-linecap="round"/></g><g class="pr-leg b"><path d="M58,62 l-1,14 M72,60 l4,14" stroke="#5a2a1c" stroke-width="2.4" stroke-linecap="round"/></g>` +
    ell(56, 52, 24, 11, '#a34a33') + ell(70, 50, 14, 8, '#b95a3f') + `<path d="M78,48 Q94,40 98,52" stroke="#8a3d2a" stroke-width="5" fill="none" stroke-linecap="round"/>${poly('96,42 110,46 98,54', '#c25a40')}${poly('98,56 106,60 96,62', '#c25a40')}` + eye(80, 47, 1.8);

  // ---------- Datos ----------
  // w: ancho en píxeles (al zoom de referencia); v: paso; run: huida/carrera; diet: c = carnívoro, h = herbívoro, i = insectívoro/pescador;
  // eats: a qué cazan; snd: sonido; say: lo que dicen; fact: dato curioso
  const SP = {
    trex:     { name: 'T-Rex', vb: [140, 100], w: 118, v: 9, run: 24, diet: 'c', eats: ['allo', 'parasau', 'raptor', 'dilo', 'galli', 'compy', 'tricer'], snd: 'roar', f: 1, say: ['¡RRROOOAAAR!', '¡Hoy toca comer!', '¡Grrr!'], fact: 'Su mordisco era de los más potentes de la historia: más de 3 toneladas de fuerza.' },
    allo:     { name: 'Alosaurio', vb: [140, 100], w: 96, v: 10, run: 22, diet: 'c', eats: ['parasau', 'raptor', 'dilo', 'galli', 'compy'], snd: 'roar', f: 1.35, say: ['¡Grrroaar!', '¡Eso huele a cena!'], fact: 'El alosaurio vivió hace unos 150 millones de años, unos 80 millones antes que el T-Rex.' },
    raptor:   { name: 'Velociraptor', vb: [140, 100], w: 70, v: 14, run: 34, diet: 'c', eats: ['galli', 'compy', 'dilo'], snd: 'raptor', say: ['¡Kri kri kri!', '¡A por ellos!'], fact: 'Los velocirraptores eran del tamaño de un pavo y tenían plumas.' },
    dilo:     { name: 'Dilofosaurio', vb: [140, 100], w: 74, v: 12, run: 26, diet: 'c', eats: ['compy', 'galli'], snd: 'spit', say: ['¡Pssst!', '¡Kraaa!'], fact: 'Se dice que escupía veneno, pero eso es solo cosa de las pelis.' },
    compy:    { name: 'Compsognathus', vb: [140, 100], w: 40, v: 15, run: 36, diet: 'i', eats: [], snd: 'squeak', say: ['¡Pip pip!', '¡Ñic ñic!', '¡Piii!'], fact: 'El compsognathus era del tamaño de un pollo.' },
    galli:    { name: 'Gallimimus', vb: [140, 100], w: 74, v: 17, run: 44, diet: 'h', eats: [], snd: 'archaeo', say: ['¡Corre que te corre!', '¡Piii!'], fact: 'El gallimimus corría como un avestruz, a unos 60 km/h.' },
    parasau:  { name: 'Parasaurolophus', vb: [140, 100], w: 100, v: 9, run: 21, diet: 'h', eats: [], snd: 'honk', say: ['¡TUUU-TUUU!', '¡Buuuuh!'], fact: 'Su cresta hueca funcionaba como una trompeta.' },
    spino:    { name: 'Espinosaurio', vb: [140, 100], w: 120, v: 8, run: 20, diet: 'i', eats: [], snd: 'roar', f: 0.9, say: ['¡Grrrrr!', '¡Qué rico el pescado!'], fact: 'El espinosaurio medía unos 14 metros: es de los dinosaurios carnívoros más largos que se conocen, y cazaba peces.' },
    tricer:   { name: 'Triceratops', vb: [140, 100], w: 112, v: 6, run: 14, diet: 'h', eats: [], snd: 'moo', fight: true, say: ['¡MUUUU!', '¡Con mis cuernos no te metas!'], fact: 'Triceratops significa «cara de tres cuernos».' },
    stego:    { name: 'Estegosaurio', vb: [140, 100], w: 112, v: 5, run: 12, diet: 'h', eats: [], snd: 'grunt', fight: true, say: ['¡Gruuuh!', '¡Mis púas pinchan!'], fact: 'Su cerebro era del tamaño de una lima, pero sus placas, enormes.' },
    anky:     { name: 'Anquilosaurio', vb: [140, 100], w: 104, v: 4, run: 10, diet: 'h', eats: [], snd: 'grunt', fight: true, say: ['¡Gruuuh!', '¡Toc, toc! Soy una armadura.'], fact: 'Se defendía con la maza de su cola, capaz de romper huesos.' },
    brachio:  { name: 'Braquiosaurio', vb: [140, 100], w: 140, v: 4.5, run: 9, diet: 'h', eats: [], snd: 'trumpet', say: ['¡BUUUUUUUH!', '¡Qué ricas las hojas altas!'], fact: 'Comía hojas a 12 metros de altura: era como una jirafa gigante.' },
    ptero:    { name: 'Pteranodon', vb: [160, 100], w: 120, v: 22, diet: 'f', snd: 'screech', say: ['¡Kriiiii!', '¡Desde arriba lo veo todo!'], fact: 'El pteranodon no tenía dientes: era un reptil volador, no un dinosaurio.' },
    quetzal:  { name: 'Quetzalcoatlus', vb: [160, 100], w: 190, v: 20, diet: 'f', snd: 'screech', say: ['¡KRIIIII!', '¡Soy el rey del cielo!'], fact: 'El Quetzalcoatlus es uno de los mayores animales voladores que han existido: unos 10 metros de envergadura.' },
    rhampho:  { name: 'Ramforrinco', vb: [160, 100], w: 80, v: 26, diet: 'f', snd: 'squeak', say: ['¡Pii pii!', '¡Kii!'], fact: 'El ramforrinco tenía una cola larga con forma de rombo para dirigirse.' },
    plesio:   { name: 'Plesiosaurio', vb: [160, 100], w: 150, v: 5, diet: 'f', snd: 'plesio', say: ['¡Uuuuuuh!', '¡Glub glub!'], fact: 'El plesiosaurio no era un dinosaurio: era un reptil marino con aletas.' },
    libelula: { name: 'Meganeura', vb: [100, 70], w: 62, v: 20, diet: 'b', snd: 'wings', say: ['¡Bzzzzz!', '¡Bzz!'], fact: 'La meganeura era una libélula gigante de 70 cm de envergadura.' },
    artropleura: { name: 'Arthropleura', vb: [175, 90], w: 96, v: 5, diet: 'b', snd: 'cricket', say: ['¡Cric cric!', '¡Tic tic tic!'], fact: 'Era un ciempiés gigante de más de 2 metros de largo.' },
    escorpion: { name: 'Escorpión gigante', vb: [120, 90], w: 56, v: 6, diet: 'b', snd: 'cricket', say: ['¡Tsss!', '¡Clic clic!'], fact: 'El Pulmonoscorpius medía unos 70 centímetros y vivió hace unos 330 millones de años.' }
  };

  // ---------- Escala evolutiva y datos reales ----------
  // lvl: escala de la cadena (1 bichos, 2 pequeños, 3 medianos, 4 grandes, 5 grandes cazadores, 6 T-Rex): solo se come a quien está por debajo.
  // ma: hace cuántos millones de años vivió su especie. head: dónde está la boca en el dibujo (para la sangre). facts: datos verídicos (paleontología).
  const EXTRA = {
    trex: { lvl: 6, ma: 67, head: [0.86, 0.36], facts: ['Vivió hace unos 68 a 66 millones de años, justo antes de que un asteroide acabara con los dinosaurios.', 'Un T-Rex adulto medía unos 12 metros de largo y pesaba cerca de 8 toneladas.', 'Tenía brazos diminutos, de apenas un metro, pero muy fuertes.', 'De adolescente engordaba casi 2 kilos al día.'] },
    allo: { lvl: 5, ma: 150, head: [0.82, 0.38], facts: ['Medía unos 9 metros y fue el gran cazador del Jurásico.', 'Tenía unos 70 dientes con el borde en forma de sierra.', 'El T-Rex vivió más cerca de nuestra época que del alosaurio.'] },
    raptor: { lvl: 3, ma: 75, head: [0.77, 0.45], facts: ['Los velocirraptores vivieron hace unos 75 millones de años en lo que hoy es Mongolia.', 'Tenían una garra curva en cada pie, de unos 6 centímetros, para sujetar a sus presas.', 'Sus brazos tenían plumas: se han encontrado las marcas en sus huesos.'] },
    dilo: { lvl: 3, ma: 190, head: [0.78, 0.43], facts: ['El dilofosaurio vivió hace unos 190 millones de años, en el Jurásico temprano.', 'Medía unos 7 metros y era uno de los mayores cazadores de su tiempo.', 'Las dos crestas de su cabeza eran finas: seguramente servían para exhibirse, no para pelear.'] },
    compy: { lvl: 2, ma: 150, head: [0.68, 0.6], facts: ['El compsognathus vivió hace unos 150 millones de años, en lo que hoy es Europa.', 'Pesaba unos 3 kilos: como un pavo pequeño.', 'Se ha encontrado un fósil suyo con un lagarto dentro del estómago.'] },
    galli: { lvl: 2, ma: 70, facts: ['Gallimimus significa «imitador de gallina».', 'No tenía dientes y comía un poco de todo: plantas, insectos y pequeños animales.', 'Vivió hace unos 70 millones de años en Mongolia.'] },
    parasau: { lvl: 3, ma: 75, facts: ['Vivió hace unos 75 millones de años, en el Cretácico.', 'Su cresta medía hasta casi 2 metros y por dentro tenía tubos huecos.', 'Podía caminar a dos patas o a cuatro.'] },
    spino: { lvl: 5, ma: 95, head: [0.83, 0.4], facts: ['El espinosaurio vivió hace unos 95 millones de años, en el norte de África.', 'Tenía el hocico largo como un cocodrilo y una gran vela en el lomo.', 'Su cola era plana, como un remo, y le ayudaba a nadar.'] },
    tricer: { lvl: 4, ma: 67, facts: ['Vivió hace unos 68 millones de años, al final de la época de los dinosaurios.', 'Su cráneo medía hasta 2 metros: es de los más grandes de cualquier animal terrestre.', 'Tenía cientos de dientes para triturar plantas duras.'] },
    stego: { lvl: 4, ma: 150, facts: ['Vivió hace unos 150 millones de años: más lejos del T-Rex que el T-Rex de nosotros.', 'Las placas de su espalda quizá servían para regular la temperatura o para exhibirse.', 'Tenía 4 púas en la cola, que los científicos llaman «thagomizer».'] },
    anky: { lvl: 4, ma: 67, facts: ['Vivió hace unos 68 millones de años, al final del Cretácico.', 'Medía unos 6 metros y todo su lomo estaba cubierto de placas óseas.', 'Su cola terminaba en una maza de hueso.'] },
    brachio: { lvl: 4, ma: 150, facts: ['Vivió hace unos 150 millones de años, en el Jurásico.', 'Pesaba decenas de toneladas.', 'Tenía las patas delanteras más largas que las traseras, como una jirafa.'] },
    ptero: { lvl: 3, ma: 85, head: [0.75, 0.42], facts: ['Vivió hace unos 85 millones de años.', 'Con las alas abiertas medía unos 6 metros.', 'Su cresta quizá servía para exhibirse o para dirigir el vuelo.'] },
    quetzal: { lvl: 4, ma: 67, head: [0.75, 0.42], facts: ['Vivió hace unos 68 millones de años.', 'Caminando por el suelo era tan alto como una jirafa.', 'Pesaba unos 200 kilos y aun así volaba.'] },
    rhampho: { lvl: 2, ma: 150, facts: ['Vivió hace unos 150 millones de años, en el Jurásico.', 'Sus dientes largos y afilados le servían para atrapar peces.', 'Sus alas medían unos 1,8 metros.'] },
    plesio: { lvl: 4, ma: 200, facts: ['Los plesiosaurios vivieron desde hace 200 hasta hace 66 millones de años.', 'Respiraban aire: tenían que subir a la superficie.', 'Algunos, los elasmosaurios, tenían más de 70 vértebras en el cuello.'] },
    libelula: { lvl: 1, ma: 300, facts: ['La meganeura vivió hace unos 300 millones de años, antes que los dinosaurios.', 'Pudo ser tan grande porque el aire tenía más oxígeno que el de hoy.'] },
    artropleura: { lvl: 1, ma: 300, facts: ['Vivió hace unos 300 millones de años, antes que los dinosaurios.', 'Es el mayor invertebrado terrestre que ha existido.', 'Probablemente comía plantas y hojas caídas.'] },
    escorpion: { lvl: 1, ma: 330, facts: ['Los escorpiones existen desde hace más de 400 millones de años: son anteriores a los dinosaurios.', 'Los primeros escorpiones vivían en el mar.'] }
  };
  Object.keys(EXTRA).forEach(k => { if (SP[k]) Object.assign(SP[k], EXTRA[k]); });
  // Datos de la época que cuentan todos (verídicos)
  const ERA = [
    'Los dinosaurios aparecieron hace unos 230 millones de años y dominaron la Tierra durante más de 160 millones.',
    'Las aves de hoy son dinosaurios: descienden de los terópodos.',
    'Hace 66 millones de años un asteroide de unos 10 kilómetros cayó en lo que hoy es México.',
    'La era de los dinosaurios se llama Mesozoico y tiene tres periodos: Triásico, Jurásico y Cretácico.',
    'Al principio, todos los continentes estaban unidos en uno solo: Pangea.',
    'Los dinosaurios más grandes de todos eran herbívoros.',
    'Los pterosaurios y los plesiosaurios no eran dinosaurios.',
    'El T-Rex vivió más cerca de nuestra época que del Estegosaurio.',
    'Ya había mamíferos, pero eran pequeños y vivían a la sombra de los dinosaurios.',
    'Hace 300 millones de años, antes de los dinosaurios, había libélulas gigantes y ciempiés de dos metros.',
    'Los primeros dinosaurios eran pequeños y corrían sobre dos patas.'
  ];
  const FLY = ['ptero', 'quetzal', 'rhampho'], WATER = ['plesio'], BUGS = ['libelula', 'artropleura', 'escorpion'];
  // Colores alternativos (cada individuo es un poco distinto)
  const TINT = ['', 'hue-rotate(18deg) saturate(1.1)', 'hue-rotate(-20deg)', 'hue-rotate(40deg) brightness(1.05)', 'saturate(.85) brightness(1.08)'];

  function svg(kind) {
    const d = SP[kind], f = DRAW[kind]; if (!d || !f) return '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.vb[0]} ${d.vb[1]}" width="${d.w}" height="${Math.round(d.w * d.vb[1] / d.vb[0])}" aria-hidden="true">${f()}</svg>`;
  }
  return { SP, FLY, WATER, BUGS, TINT, ERA, svg, DRAW };
});
