'use strict';
// MONUMENTOS: monumentos famosos dibujados a color, FIJOS en su sitio real del mapa (mismas coordenadas para todos los jugadores).
//  - Cada monumento es un dibujo SVG (visto de frente) con la base clavada en su latitud/longitud: Sagrada Família en Barcelona,
//    Torre Eiffel en París, Coliseo en Roma…  No se mueven ni salen al azar.
//  - Se ven con zoom >= 12 (vista de ciudad). Con zoom lejos mantienen un tamaño mínimo legible y al acercarse crecen con el mapa.
//  - El nombre aparece debajo con zoom >= 14,5. No interceptan clics: se puede comprar el terreno que hay debajo.
//  - Botón 🏛️ del menú para ocultarlos / mostrarlos (se recuerda en el móvil).
//  - Para añadir uno nuevo: añade su dibujo a ART y una línea a LIST (id, nombre, lugar, lat, lng, ancho en metros, tamaño del dibujo).
(function () {
  if (typeof map === 'undefined' || !map || !map.gl || !window.L) return;
  const KEY = 'monumentsOn', MIN_Z = 12, LABEL_Z = 14.5, MIN_H = 38, MAX_W = 900;
  const btn = document.getElementById('mon-btn');
  let on = true;
  try { const s = localStorage.getItem(KEY); if (s !== null) on = s === '1'; } catch (e) {}

  // ---------- Ayudas para dibujar ----------
  const f = n => Math.round(n * 10) / 10;
  const rep = (n, fn) => { let s = ''; for (let i = 0; i < n; i++) s += fn(i); return s; };
  const R = (x, y, w, h, fill, x2 = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${x2}/>`;
  const P = (pts, fill, x2 = '') => `<polygon points="${pts}" fill="${fill}" ${x2}/>`;
  const C = (x, y, r, fill, x2 = '') => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" ${x2}/>`;
  const E = (x, y, rx, ry, fill, x2 = '') => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${x2}/>`;
  const D = (d, fill, x2 = '') => `<path d="${d}" fill="${fill}" ${x2}/>`;
  const Ln = (x1, y1, x2, y2, stroke, w = 1, x3 = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${w}" ${x3}/>`;
  // Arco de medio punto: esquina izquierda x, suelo yb, ancho w, alto total h
  const arch = (x, yb, w, h, fill) => D(`M${f(x)} ${f(yb)}V${f(yb - h + w / 2)}a${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(w)} 0V${f(yb)}Z`, fill);
  // Cúpula cebolla: centro x, base y, radio r
  const onionD = (x, y, r) => `M${f(x - r)} ${f(y)}Q${f(x - r * 1.15)} ${f(y - r * .9)} ${f(x)} ${f(y - r * 1.9)}Q${f(x + r * 1.15)} ${f(y - r * .9)} ${f(x + r)} ${f(y)}Z`;
  const onion = (x, y, r, fill, x2 = '') => D(onionD(x, y, r), fill, x2);

  // ---------- Dibujos (cada uno en su viewBox; el suelo está en la parte de abajo) ----------
  const ART = {
    sagrada() {
      const st = '#e8d3a6', sh = '#c9a974', dk = '#6f5a3c', tips = ['#e8533c', '#f2a33a', '#7bb661', '#3fa7d6'];
      const tower = (x, w, top, base, tip) =>
        D(`M${x - w / 2} ${base}L${x - w / 2 + 1} ${top + 14}Q${x - w / 2 + 1} ${top + 3} ${x} ${top + 2}Q${x + w / 2 - 1} ${top + 3} ${x + w / 2 - 1} ${top + 14}L${x + w / 2} ${base}Z`, st) +
        D(`M${x} ${top + 2}Q${x + w / 2 - 1} ${top + 3} ${x + w / 2 - 1} ${top + 14}L${x + w / 2} ${base}L${x} ${base}Z`, sh, 'opacity=".5"') +
        rep(Math.floor((base - top - 14) / 8), i => E(x, top + 18 + i * 8, w * .13, 2.4, dk)) +
        D(`M${x - w * .36} ${top + 7}Q${x} ${top - 9} ${x + w * .36} ${top + 7}Z`, tip) + C(x, top - 3, 1.5, '#ffe27a');
      let s = tower(50, 13, 16, 88, '#f2a33a');
      s += D('M50 0L51.6 4.6L56.5 4.8L52.6 8L54 12.8L50 10L46 12.8L47.4 8L43.5 4.8L48.4 4.6Z', '#ffd54a');
      [[21, 36], [36, 28], [64, 28], [79, 36]].forEach(([x, top], i) => { s += tower(x, 12, top, 92, tips[i]); });
      s += R(8, 84, 84, 32, st) + R(50, 84, 42, 32, sh, 'opacity=".28"') + R(8, 82, 84, 3, sh);
      s += arch(40, 116, 20, 30, dk) + arch(17, 116, 14, 20, dk) + arch(69, 116, 14, 20, dk);
      s += rep(9, i => C(14 + i * 9, 92, 1.7, tips[i % 4])) + rep(9, i => C(14 + i * 9, 100, 1.7, tips[(i + 2) % 4]));
      return s;
    },
    alhambra() {
      const w = '#d39a62', sh = '#b27a48', dk = '#6f4528', roof = '#a8452f';
      const cren = (x, y, n, step, cw) => rep(n, i => R(x + i * step, y, cw, 3.2, w));
      let s = R(0, 68, 100, 12, '#86b86a');
      s += R(0, 46, 100, 24, w) + R(0, 46, 100, 24, sh, 'opacity=".12"') + cren(1, 42.8, 12, 8.4, 5);
      s += R(5, 16, 20, 56, w) + R(15, 16, 10, 56, sh, 'opacity=".35"') + cren(5, 12.8, 4, 5.4, 3.4);
      s += arch(12, 36, 6, 12, dk) + R(9, 44, 2, 8, dk) + R(19, 44, 2, 8, dk) + R(14, 4, 1.1, 9, '#5b4a3a') + P('15,4 22,6.5 15,9', '#d33a2c');
      s += R(38, 26, 24, 46, w) + R(50, 26, 12, 46, sh, 'opacity=".35"') + cren(38, 22.8, 5, 5.1, 3.2) + R(38, 38, 24, 3, '#3aa6a0');
      s += arch(42, 36, 5, 10, dk) + arch(53, 36, 5, 10, dk) + arch(42, 58, 5, 10, dk) + arch(53, 58, 5, 10, dk);
      s += P('62,46 68,36 96,36 100,46', roof) + D('M74 36Q80 21 86 36Z', '#3aa6a0') + C(80, 22.5, 1.1, '#ffd54a');
      s += rep(4, i => arch(68 + i * 7.5, 70, 4.4, 10, dk));
      s += E(32, 58, 3.4, 12, '#2f6b3a') + E(30, 62, 2.6, 8, '#3d8048') + E(93, 60, 3.2, 10, '#2f6b3a') + E(50, 74, 48, 4, '#86b86a');
      return s;
    },
    giralda() {
      const o = '#dba96e', sh = '#b9854f', lt = '#efcb94', dk = '#5f4326', st = '#cfc5ab';
      let s = R(0, 90, 70, 20, st) + R(0, 90, 70, 3, '#b3a98e') + rep(6, i => arch(4 + i * 11, 110, 5, 11, '#7b715a'));
      s += D('M2 90V82h5V90ZM13 90V78h5V90ZM51 90V80h5V90ZM62 90V76h5V90Z', '#a89e84');
      s += R(20, 34, 22, 58, o) + R(31, 34, 11, 58, sh, 'opacity=".35"');
      s += rep(6, i => P(`26,${46 + i * 7.5} 29,${42.5 + i * 7.5} 32,${46 + i * 7.5} 29,${49.5 + i * 7.5}`, lt, 'opacity=".8"') +
        P(`34,${46 + i * 7.5} 37,${42.5 + i * 7.5} 40,${46 + i * 7.5} 37,${49.5 + i * 7.5}`, lt, 'opacity=".8"'));
      s += arch(28, 88, 6, 14, dk) + R(20, 32, 22, 3, sh);
      s += R(22, 20, 18, 14, '#ead7a6') + arch(24, 34, 5, 11, dk) + arch(33, 34, 5, 11, dk) + R(20, 18, 22, 3, sh);
      s += D('M22 20Q31 8 40 20Z', '#bd8f55') + R(28.5, 7, 5, 7, '#d9c08a') + D('M28 7Q31 1 34 7Z', '#a9794a');
      s += R(30.6, 0, .8, 3, '#c9a23a') + P('31.4,0.4 35,1.4 31.4,2.4', '#d9a93a');
      return s;
    },
    alcala() {
      const st = '#efe6cf', sh = '#cbbf9f', dk = '#5f5545';
      let s = R(4, 24, 92, 42, st) + R(50, 24, 46, 42, sh, 'opacity=".25"') + R(14, 12, 72, 12, '#f6eed8') + R(2, 22, 96, 4, sh) + R(12, 10, 76, 3, sh);
      s += R(40, 4, 20, 7, st) + rep(5, i => R(14 + i * 15, 3, 4, 8, '#e3d8b8')) + R(48, 0, 4, 4, sh);
      s += arch(41, 66, 18, 32, dk) + arch(23, 66, 11, 22, dk) + arch(66, 66, 11, 22, dk) + R(8, 46, 9, 20, dk) + R(83, 46, 9, 20, dk);
      s += rep(4, i => R([19, 37, 61, 79][i], 28, 2.6, 38, sh, 'opacity=".5"')) + rep(5, i => R(14 + i * 15, 15, 8, 5, '#d8cba7'));
      s += R(2, 64, 96, 5, sh);
      return s;
    },
    palacio() {
      const st = '#efe9d8', sh = '#c8bfa6', roof = '#7d8a96', win = '#6d7a87';
      let s = R(8, 12, 84, 8, roof) + R(4, 44, 92, 22, '#e6dfca') + R(4, 22, 92, 22, st) + R(2, 18, 96, 5, sh);
      s += rep(41, i => R(4 + i * 2.25, 14, .9, 4, sh));
      s += rep(9, i => arch(8 + i * 10, 40, 5, 14, win)) + rep(9, i => R(8 + i * 10, 52, 5, 10, win));
      s += R(34, 14, 32, 52, '#f6f1e2') + P('32,16 50,4 68,16', st) + P('38,15 50,8 62,15', sh, 'opacity=".6"') + C(50, 12, 2, '#d9a93a');
      s += rep(6, i => R(36 + i * 5.2, 22, 2.8, 30, sh, 'opacity=".7"')) + arch(44, 66, 12, 22, win) + R(2, 64, 96, 4, sh);
      return s;
    },
    acueducto() {
      const g = '#d9c59b', sh = '#b79e6c', dk = '#5c4a30';
      let s = R(0, 8, 100, 3, sh) + R(0, 11, 100, 15, g) + rep(19, i => arch(1.2 + i * 5.2, 26, 3.4, 12, dk));
      s += R(0, 25, 100, 3, sh) + R(0, 28, 100, 38, g) + rep(8, i => arch(3 + i * 12, 66, 8.5, 34, dk));
      s += R(0, 28, 100, 38, sh, 'opacity=".1"') + R(0, 66, 100, 4, '#8fb06b');
      return s;
    },
    mezquita() {
      const w = '#e2bb7c', sh = '#c4975a', red = '#c0392b', cr = '#f4e8cb', dk = '#4f3220';
      let s = R(26, 36, 74, 30, w) + rep(18, i => R(27 + i * 4.1, 32.5, 2.6, 4, w)) + R(26, 36, 74, 30, sh, 'opacity=".12"');
      s += rep(6, i => arch(30 + i * 11.5, 66, 9, 22, cr) + arch(31.6 + i * 11.5, 66, 5.8, 19, red) + arch(33.2 + i * 11.5, 66, 2.6, 15, dk));
      s += R(4, 12, 20, 54, '#ebc98f') + R(14, 12, 10, 54, sh, 'opacity=".3"') + R(4, 28, 20, 2.5, sh) + R(4, 50, 20, 2.5, sh);
      s += arch(8, 28, 5, 12, dk) + arch(15, 28, 5, 12, dk) + R(11.6, 36, 4, 8, dk) + R(11.6, 56, 4, 8, dk);
      s += P('3,12 14,1 25,12', '#a65c3a') + C(14, 1, 1.2, '#ffd54a');
      s += C(33, 64, 3.2, '#4c9a4a') + C(95, 64, 3.2, '#4c9a4a') + R(0, 66, 100, 4, '#d9c8a0');
      return s;
    },
    hercules() {
      const g = '#bdb5a2', sh = '#8f8773', dk = '#4d473a';
      let s = R(0, 100, 50, 10, '#4aa3d6') + P('2,100 12,92 38,92 48,100', '#7c8f58');
      s += R(10, 62, 30, 32, g) + R(25, 62, 15, 32, sh, 'opacity=".35"') + arch(21, 94, 8, 14, dk) + R(10, 60, 30, 3, sh);
      s += R(14, 40, 22, 22, '#c8c0ad') + R(25, 40, 11, 22, sh, 'opacity=".3"') + rep(2, i => R(18 + i * 8, 46, 3, 8, dk)) + R(13, 38, 24, 3, sh);
      s += R(17, 24, 16, 16, '#d3ccba') + R(25, 24, 8, 16, sh, 'opacity=".3"') + R(21.5, 28, 7, 8, dk) + R(16, 22, 18, 3, sh);
      s += R(19, 10, 12, 13, '#ddd6c4') + R(22, 13, 6, 7, '#ffd54a') + D('M17 10Q25 1 33 10Z', '#6b7c8c');
      s += rep(3, i => Ln(10, 68 + i * 8, 40, 74 + i * 8, sh, .7, 'opacity=".5"'));
      return s;
    },
    penon() {
      let s = R(0, 58, 100, 12, '#4aa3d6');
      s += P('0,58 6,40 16,24 30,10 42,5 52,10 64,22 80,34 96,46 100,58', '#d2c9b3');
      s += P('0,58 6,40 16,24 30,10 42,5 40,30 30,44 20,58', '#a89f89');
      s += E(70, 44, 20, 6, '#7fa86a') + E(56, 30, 11, 4, '#8fb276') + E(84, 52, 12, 4, '#6f9a5c');
      s += E(40, 6, 14, 4.2, '#fff', 'opacity=".9"') + E(54, 3, 12, 3.4, '#fff', 'opacity=".9"') + E(28, 8, 9, 3, '#fff', 'opacity=".85"');
      s += rep(6, i => R(70 + i * 5, 54, 4, 4, ['#f0c987', '#e9a88f', '#f4e3b0', '#b8d4e8', '#f0c987', '#e9a88f'][i]));
      return s;
    },
    santiago() {
      const st = '#dcd0b0', sh = '#b9a97d', dk = '#6a5a3a', gold = '#d9a93a';
      const tower = x => R(x, 22, 20, 78, st) + R(x + 10, 22, 10, 78, sh, 'opacity=".3"') + R(x + 1, 14, 18, 9, '#e6dcc0') + arch(x + 4, 22, 4, 10, dk) + arch(x + 12, 22, 4, 10, dk) +
        P(`${x + 2},14 ${x + 10},2 ${x + 18},14`, '#b8b08e') + R(x + 9.6, 0, .9, 4, gold) + C(x + 10, 6, 1.3, gold) + R(x, 20, 20, 3, sh);
      let s = tower(6) + tower(74) + R(26, 40, 48, 60, st) + R(50, 40, 24, 60, sh, 'opacity=".22"');
      s += P('28,40 50,20 72,40', '#e6dcc0') + P('36,39 50,26 64,39', sh, 'opacity=".5"') + C(50, 33, 2.4, gold) + R(49.4, 20, 1.2, 6, gold);
      s += arch(41, 64, 18, 26, dk) + arch(31, 98, 7, 16, dk) + arch(62, 98, 7, 16, dk) + R(36, 46, 28, 2, sh);
      s += R(12, 90, 76, 10, sh, 'opacity=".5"') + rep(7, i => R(14 + i * 10.5, 93, 8, 1.4, '#e6dcc0'));
      return s;
    },
    artes() {
      let s = R(0, 48, 100, 22, '#5bb6d9') + rep(5, i => Ln(8 + i * 18, 54 + (i % 2) * 6, 22 + i * 18, 54 + (i % 2) * 6, '#fff', .8, 'opacity=".5"'));
      s += D('M8 48Q50 -8 92 48Z', '#f4f6f8') + D('M50 4Q92 18 92 48L50 48Z', '#d5dde5', 'opacity=".6"');
      s += E(50, 34, 28, 14, '#c3d6e2') + C(50, 34, 11, '#33495e') + C(46, 30, 3.6, '#fff', 'opacity=".6"');
      s += D('M8 48Q50 100 92 48Z', '#f4f6f8', 'opacity=".28"') + R(6, 47, 88, 2.4, '#e7ecf0');
      return s;
    },
    guggenheim() {
      let s = R(0, 56, 100, 14, '#5bb0d6');
      s += D('M4 58Q10 32 34 28Q50 14 70 24Q94 26 96 58Z', '#c4cbd4') + D('M60 26Q70 2 86 24Z', '#d8dee5');
      s += D('M4 58Q10 38 28 34Q18 46 20 58Z', '#a8b1bc') + D('M50 20Q80 20 96 58L70 58Q72 34 50 20Z', '#aeb7c2');
      s += P('42,58 48,20 62,20 66,58', '#9fd0e6') + Ln(48, 20, 42, 58, '#fff', .8, 'opacity=".7"') + Ln(55, 20, 54, 58, '#fff', .6, 'opacity=".5"');
      s += D('M30 32Q50 22 68 28', 'none', 'stroke="#fff" stroke-width="1" opacity=".7"');
      s += E(18, 60, 11, 2.2, '#8a6a4a') + R(9, 46, 18, 14, '#46a84e') + C(26, 44, 6.5, '#46a84e') + E(21, 42, 3, 5, '#2f7d3a');
      s += rep(9, i => C(11 + (i % 3) * 6 + (i % 2) * 2, 49 + Math.floor(i / 3) * 4, 1.6, ['#ff5a7a', '#ffd23f', '#ff9f43', '#b05cf0', '#fff'][i % 5]));
      return s;
    },
    eiffel(id) {
      const br = '#8c6b46', dk = '#5a4330', gold = '#d6b06a';
      let s = `<clipPath id="${id}c"><path d="M4 106Q22 72 25 56Q27 34 29 20L30 4L31 20Q33 34 35 56Q38 72 56 106L44 106Q42 90 30 88Q18 90 16 106Z"/></clipPath>`;
      s += D('M4 106Q22 72 25 56Q27 34 29 20L30 4L31 20Q33 34 35 56Q38 72 56 106L44 106Q42 90 30 88Q18 90 16 106Z', br);
      s += `<g clip-path="url(#${id}c)">` + rep(18, i => Ln(0, i * 6, 60, i * 6 + 14, gold, .55, 'opacity=".6"') + Ln(60, i * 6, 0, i * 6 + 14, gold, .55, 'opacity=".6"')) +
        R(30, 0, 30, 110, dk, 'opacity=".22"') + '</g>';
      s += R(16, 76, 28, 3.6, dk) + R(23, 48, 14, 3, dk) + R(26, 28, 8, 2.6, dk) + R(20, 74.4, 20, 2, gold);
      s += Ln(30, 4, 30, 0, '#ffd54a', 1.2) + C(30, 1, 1.2, '#ffe27a');
      return s;
    },
    coliseo() {
      const t = '#dfbb88', sh = '#bf9460', dk = '#4f3822', br = '#c9794a';
      const bound = [60, 68, 80, 100];                      // hasta dónde llega cada piso antes de la rotura
      let s = P('36,24 98,24 98,64 36,64', br) + rep(8, i => R(40 + i * 7.4, 30, 3.6, 8, '#7a3f22', 'opacity=".6"'));
      s += P('2,20 62,20 70,28 76,26 84,44 98,46 98,64 2,64', t) + P('2,20 62,20 70,28 76,26 84,44 98,46 98,64 2,64', sh, 'opacity=".14"');
      [[20, 28, 0], [28, 40, 1], [40, 52, 2], [52, 64, 3]].forEach(([y0, y1, k]) => {
        if (k === 0) s += rep(10, i => { const x = 5 + i * 6; return x + 3 < bound[0] ? R(x, 22.5, 3, 4.5, dk) : ''; });
        else s += rep(14, i => { const x = 4 + i * 6.6; return x + 4.2 <= bound[k] ? arch(x, y1 - 0.8, 4.2, y1 - y0 - 3, dk) : ''; });
        if (k) s += R(2, y0 - 0.6, Math.min(bound[k], 98) - 2, 1.3, sh);
      });
      s += R(0, 64, 100, 6, '#9bbf73');
      return s;
    },
    bigben() {
      const st = '#d8c389', sh = '#b79f62', gold = '#d9a93a', dk = '#4d3d1f';
      let s = R(8, 52, 24, 58, st) + R(20, 52, 12, 58, sh, 'opacity=".35"') + rep(3, i => arch(11 + i * 7, 104, 3.6, 22, dk)) + R(6, 50, 28, 3, sh);
      s += rep(3, i => R(12.4 + i * 7, 70, 1.6, 10, sh, 'opacity=".7"'));
      s += R(7, 24, 26, 27, st) + R(20, 24, 13, 27, sh, 'opacity=".3"') + R(5, 22, 30, 3, sh);
      s += C(20, 37, 10.4, gold) + C(20, 37, 8.8, '#fff6dc') + Ln(20, 37, 20, 30.5, dk, 1) + Ln(20, 37, 25, 39.5, dk, .8) +
        rep(12, i => { const a = i * Math.PI / 6; return Ln(20 + Math.sin(a) * 7.2, 37 - Math.cos(a) * 7.2, 20 + Math.sin(a) * 8.4, 37 - Math.cos(a) * 8.4, dk, .6); });
      s += R(10, 12, 20, 11, '#e0cc94') + arch(12, 23, 4, 9, dk) + arch(18, 23, 4, 9, dk) + arch(24, 23, 4, 9, dk) + R(9, 10, 22, 3, sh);
      s += P('9,10 20,-1 31,10', '#52705f').replace('-1', '1') + R(19.5, 0, 1, 3, gold);
      return s;
    },
    libertad() {
      const cu = '#69b9a5', cd = '#4a9684', ped = '#c8c2b3';
      let s = P('6,110 11,76 39,76 44,110', ped) + P('25,76 39,76 44,110 25,110', '#a8a291', 'opacity=".4"') + R(9, 72, 32, 5, '#b8b2a2') + rep(3, i => R(14 + i * 9, 84, 2.6, 22, '#9d9786', 'opacity=".55"'));
      s += P('15,72 17,40 33,40 36,72', cu) + P('25,40 33,40 36,72 25,72', cd, 'opacity=".5"') + rep(4, i => Ln(19 + i * 4, 44, 18 + i * 4.4, 72, cd, .8, 'opacity=".7"'));
      s += P('30,43 36,36 40,16 43,16 41,38 34,48', cu) + P('39,16 44,16 43,10 40,10', '#d8b24a') + D('M41.5 10Q39 5 41.5 0Q44 5 41.5 10Z', '#ffcf3f');
      s += R(11, 46, 8, 13, cd) + R(11, 46, 8, 2, '#8fd3c0');
      s += C(25, 33, 5.5, cu) + rep(7, i => { const a = (-150 + i * 20) * Math.PI / 180; return P(`${f(25 + Math.cos(a) * 5)},${f(33 + Math.sin(a) * 5)} ${f(25 + Math.cos(a) * 11)},${f(33 + Math.sin(a) * 11)} ${f(25 + Math.cos(a + .25) * 5)},${f(33 + Math.sin(a + .25) * 5)}`, '#7fd0bb'); });
      return s;
    },
    taj() {
      const m = '#f7f3ea', sh = '#d5dbe4', dk = '#6f7a88', gold = '#e6bd4a';
      let s = R(0, 66, 100, 14, '#6fc1d6') + D('M36 68Q50 92 64 68Z', '#fff', 'opacity=".3"') + R(0, 64, 100, 3, '#8fc06a');
      s += R(6, 56, 88, 9, '#f1ece0') + R(6, 62, 88, 3, '#d9d3c3');
      [10, 83].forEach(x => { s += R(x, 22, 6, 34, m) + R(x + 3, 22, 3, 34, sh, 'opacity=".7"') + R(x - 1, 34, 8, 1.6, sh) + R(x - 1, 46, 8, 1.6, sh) + D(`M${x - .6} 22Q${x + 3} 14 ${x + 6.6} 22Z`, m) + C(x + 3, 15, .9, gold); });
      [25, 69].forEach(x => { s += R(x, 40, 6, 17, m) + R(x - 4, 43, 5, 14, '#ece7da') + R(x + 5, 43, 5, 14, '#ece7da'); });
      s += R(30, 36, 40, 21, m) + R(50, 36, 20, 21, sh, 'opacity=".45"');
      s += D('M36 38Q33 22 50 9Q67 22 64 38Z', m) + D('M50 9Q67 22 64 38L50 38Z', sh, 'opacity=".55"') + Ln(50, 9, 50, 3, gold, 1.2) + C(50, 3.4, 1.2, gold);
      s += D('M39 36V32a3 3 0 0 1 6 0V36ZM55 36V32a3 3 0 0 1 6 0V36Z', m) + C(42, 29.6, 1, gold) + C(58, 29.6, 1, gold);
      s += R(43, 38, 14, 19, '#fff') + D('M45 57V46Q50 38 55 46V57Z', dk) + D('M43 38H57', 'none', `stroke="${sh}" stroke-width="1.2"`);
      s += E(12, 62, 3.2, 8, '#2f6b3a', 'opacity=".0"') + E(92, 76, 5, 3, '#8fc06a');
      return s;
    },
    giza() {
      let s = R(0, 56, 100, 14, '#efd49a') + E(20, 66, 26, 4, '#e8c682') + E(80, 64, 24, 4, '#e8c682');
      s += P('34,58 62,8 90,58', '#e8bf6a') + P('62,8 90,58 62,58', '#c99a45') + rep(6, i => Ln(36 + i * 3, 52 - i * 8.5, 88 - i * 3.4, 52 - i * 8.5, '#b88530', .5, 'opacity=".5"'));
      s += P('2,58 24,28 46,58', '#efc877') + P('24,28 46,58 24,58', '#d2a24e') + P('56,58 70,40 84,58', '#f3d28a') + P('70,40 84,58 70,58', '#d8ab58');
      s += E(94, 62, 3, 1.4, '#4c9a4a') + Ln(94, 62, 94, 55, '#6b4a2a', 1) + E(94, 53, 5, 2, '#4c9a4a');
      return s;
    },
    cristo() {
      const w = '#f1f4f2', sh = '#cfd6d3';
      let s = P('0,100 8,86 22,78 38,78 52,86 60,100', '#5fa35a') + P('0,100 8,88 18,92 24,100', '#4a8a48') + P('36,100 46,90 60,100', '#4a8a48');
      s += R(21, 66, 18, 14, '#cfd3d0') + R(19, 78, 22, 4, '#b9bdb9') + R(21, 66, 18, 2, '#e6e9e6');
      s += P('24,66 25,28 35,28 36,66', w) + P('30,28 35,28 36,66 30,66', sh, 'opacity=".6"');
      s += P('3,28 57,28 57,33 3,33', w) + P('3,31 57,31 57,33 3,33', sh, 'opacity=".6"') + E(3, 30.5, 2.4, 3.4, w) + E(57, 30.5, 2.4, 3.4, w);
      s += C(30, 22, 4.4, w) + R(28.6, 25, 2.8, 4, w) + D('M26 21Q30 15 34 21', 'none', `stroke="${sh}" stroke-width=".8"`);
      return s;
    },
    pisa() {
      let s = R(0, 92, 50, 8, '#8fc06a') + P('30,95 52,95 48,98 28,98', '#6f9a5c', 'opacity=".5"');
      s += '<g transform="rotate(4 25 96)">';
      s += rep(7, i => { const y = 94 - (i + 1) * 10.6; return R(14, y, 22, 10.8, '#f6efdc') + R(26, y, 10, 10.8, '#e4dcc3', 'opacity=".6"') + rep(5, j => arch(15.4 + j * 4, y + 8.8, 2.4, 6, '#8c8a80')) + R(13, y, 24, 1.3, '#d9d0b8'); });
      s += R(16, 11, 18, 9, '#efe6cc') + rep(4, j => arch(17.4 + j * 4, 19, 2.6, 6, '#8c8a80')) + R(15, 8, 20, 4, '#d9d0b8') + R(17, 4, 16, 4.5, '#c9bfa5');
      s += R(13, 84, 24, 10, '#f6efdc') + R(26, 84, 11, 10, '#e4dcc3', 'opacity=".6"') + arch(22, 94, 6, 8, '#6d6a60');
      return s + '</g>';
    },
    brandeburgo() {
      const st = '#d9c8a0', sh = '#bda97a';
      let s = R(0, 62, 100, 6, sh) + R(6, 26, 88, 36, '#6e5e3e');
      s += rep(6, i => R(8 + i * 16.4, 26, 8, 36, st) + R(12 + i * 16.4, 26, 4, 36, sh, 'opacity=".55"') + R(7 + i * 16.4, 24.5, 10, 2.4, '#cdbb90'));
      s += R(4, 18, 92, 8, st) + R(4, 24, 92, 2, sh) + R(10, 10, 80, 8, '#e4d7b3') + rep(8, i => R(13 + i * 9.6, 12, 6, 4, sh, 'opacity=".7"'));
      const g = '#5aa18b';
      s += R(38, 6, 24, 4, g) + rep(4, i => D(`M${40 + i * 5} 6Q${40 + i * 5 + 1.6} 1.6 ${43.4 + i * 5} 3.4L${42.6 + i * 5} 6Z`, g));
      s += R(48.8, 0, 2.4, 6, g) + C(50, 1.2, 1.6, g) + Ln(55.5, 0.6, 55.5, 6, g, .8);
      return s;
    },
    sidney() {
      const w = '#fbfaf5', sh = '#e0dcd0';
      let s = R(0, 52, 100, 18, '#4fb0d8') + R(4, 46, 92, 8, '#d8c9a8') + R(4, 52, 92, 2, '#bfae88');
      const shell = (x0, x1, top, yb, dir) => {
        const d = `M${x0} ${yb}Q${x0 + (x1 - x0) * .1} ${top + 10} ${dir > 0 ? x1 : x0 + (x1 - x0) * .05} ${top}`;
        return D(`${d}Q${x0 + (x1 - x0) * .85} ${top + (yb - top) * .4} ${x1} ${yb}Z`, w) + D(`M${x0} ${yb}Q${x0 + (x1 - x0) * .1} ${top + 10} ${x1} ${top}Q${x0 + (x1 - x0) * .6} ${top + (yb - top) * .45} ${x0 + (x1 - x0) * .5} ${yb}Z`, sh, 'opacity=".55"');
      };
      s += shell(6, 36, 6, 48, 1) + shell(22, 46, 18, 48, 1) + shell(36, 54, 28, 48, 1);
      s += D('M94 48Q92 22 70 14Q76 32 72 48Z', w) + D('M80 48Q78 30 62 26Q66 38 64 48Z', w) + D('M94 48Q92 22 70 14Q80 34 84 48Z', sh, 'opacity=".5"');
      s += Ln(10, 46, 34, 8, '#d6d1c2', .5, 'opacity=".7"') + Ln(26, 46, 44, 20, '#d6d1c2', .5, 'opacity=".7"');
      return s;
    },
    sanbasilio(id) {
      const rd = '#c4472f', sh = '#9e3622', wh = '#f4ead2';
      const dome = (n, x, y, r, a, b, kind) => {
        const cid = `${id}d${n}`;
        let t = R(x - r * .55, y, r * 1.1, r * .8, rd) + onion(x, y, r, a) + `<clipPath id="${cid}"><path d="${onionD(x, y, r)}"/></clipPath><g clip-path="url(#${cid})">`;
        if (kind === 0) t += rep(6, i => Ln(x - r * 1.4 + i * r * .55, y, x - r * .4 + i * r * .55, y - r * 2, b, 1.3, 'opacity=".9"'));
        else if (kind === 1) t += rep(6, i => C(x - r * .7 + (i % 3) * r * .7, y - r * (.55 + Math.floor(i / 3) * .6), 1.1, b));
        else t += rep(4, i => D(`M${f(x - r)} ${f(y - 2 - i * r * .5)}Q${f(x)} ${f(y - 5 - i * r * .5)} ${f(x + r)} ${f(y - 2 - i * r * .5)}`, 'none', `stroke="${b}" stroke-width="1.3"`));
        return t + '</g>' + Ln(x, y - r * 1.9, x, y - r * 2.4, '#d9a93a', 1) + C(x, y - r * 2.5, .9, '#d9a93a');
      };
      let s = R(2, 66, 66, 34, rd) + R(36, 66, 32, 34, sh, 'opacity=".25"') + R(2, 64, 66, 3, wh) + rep(6, i => R(8 + i * 10, 76, 5, 12, '#6e2415') + R(8 + i * 10, 76, 5, 2, wh)) + R(2, 96, 66, 4, wh, 'opacity=".5"');
      s += R(26, 34, 18, 32, rd) + R(35, 34, 9, 32, sh, 'opacity=".25"') + P('24,36 35,8 46,36', '#d94f36') + P('35,8 46,36 35,36', sh, 'opacity=".3"') + rep(3, i => R(28 + i * 5.4, 44, 2.6, 8, wh)) + Ln(24, 36, 46, 36, wh, 1.6);
      s += onion(35, 9, 3.4, '#2e9e57') + Ln(35, 2.6, 35, 1, '#d9a93a', .8);
      s += dome(0, 12, 62, 8, '#2e9e57', '#f4d03f', 0) + dome(1, 58, 62, 8, '#f4ead2', '#d33a2c', 0) + dome(2, 20, 50, 6.6, '#3a74c8', '#ffd54a', 1) + dome(3, 50, 48, 6.6, '#f4d03f', '#2e9e57', 2);
      return s;
    },
    partenon() {
      const mb = '#efdfb5', sh = '#e0cc99';
      let s = P('0,70 4,56 18,52 82,52 96,56 100,70', '#a8855a') + R(10, 52, 80, 3, '#8fb06b', 'opacity=".7"');
      s += R(8, 24, 84, 26, '#7e6c4a') + R(8, 50, 84, 4, sh) + R(6, 53, 88, 3, '#d9c690');
      s += rep(8, i => R(11 + i * 10.4, 24, 6, 26, mb) + R(14 + i * 10.4, 24, 3, 26, sh, 'opacity=".8"') + R(10 + i * 10.4, 22.4, 8, 2.2, '#e6d4a8'));
      s += R(6, 16, 88, 6.6, sh) + P('6,16 50,2 94,16', '#e8d6a9') + P('16,15 50,5.6 84,15', '#cdb88a') + rep(5, i => R(10 + i * 18, 17.6, 4, 3, '#c9b27a'));
      return s;
    },
    goldengate() {
      const o = '#d9532c', dk = '#a93a1a';
      let s = R(0, 56, 100, 14, '#4fa8d6') + P('0,56 0,45 14,49 26,56', '#7bb264') + P('100,56 100,48 88,50 76,56', '#c7b27a');
      [30, 72].forEach(x => { s += R(x - 3, 10, 2.6, 46, o) + R(x + 1, 10, 2.6, 46, dk) + rep(5, i => R(x - 3, 17 + i * 8.6, 7.6, 2, o)) + R(x - 3.6, 8, 8.8, 3, dk); });
      s += R(0, 43, 100, 3, o) + R(0, 46, 100, 1.2, dk) + R(0, 40.4, 100, .8, o);
      const cab = (xa, xb, ya, yb, cy) => { let d = ''; for (let i = 0; i <= 14; i++) { const t = i / 14, x = (1 - t) * (1 - t) * xa + 2 * (1 - t) * t * ((xa + xb) / 2) + t * t * xb, y = (1 - t) * (1 - t) * ya + 2 * (1 - t) * t * cy + t * t * yb; if (i % 1 === 0 && i > 0 && i < 14) d += Ln(x, y, x, 43, o, .5, 'opacity=".75"'); } return d; };
      s += D('M30 12Q51 38 72 12', 'none', `stroke="${o}" stroke-width="1.6"`) + D('M0 38Q15 22 30 12', 'none', `stroke="${o}" stroke-width="1.4"`) + D('M72 12Q86 22 100 38', 'none', `stroke="${o}" stroke-width="1.4"`);
      s += cab(30, 72, 12, 12, 38);
      return s;
    },
    burj() {
      const b = '#b9d4ea', sh = '#8fb2d0', hi = '#e4f1fb';
      let s = R(2, 110, 36, 6, '#d9d3c3');
      const tier = (x, y, w, h) => R(x, y, w, h, b) + R(x + w / 2, y, w / 2, h, sh, 'opacity=".55"') + R(x + 1, y, 1.2, h, hi, 'opacity=".7"');
      s += tier(7, 88, 26, 24) + tier(10, 68, 20, 22) + tier(13, 50, 14, 20) + tier(15.4, 34, 9.2, 17) + tier(17.4, 22, 5.2, 13) + tier(18.4, 12, 3.2, 11);
      s += R(19.3, 0, 1.4, 14, '#d7e3ee') + rep(8, i => Ln(8, 94 + i * 2.6, 32, 94 + i * 2.6, '#fff', .35, 'opacity=".5"'));
      return s;
    }
  };

  // id, nombre, lugar, lat, lng, ancho en metros del dibujo, tamaño del dibujo (viewBox)
  const LIST = [
    ['sagrada', 'Sagrada Família', 'Barcelona, España', 41.4036, 2.1744, 90, [100, 120]],
    ['alhambra', 'La Alhambra', 'Granada, España', 37.1770, -3.5890, 220, [100, 80]],
    ['giralda', 'La Giralda', 'Sevilla, España', 37.3860, -5.9930, 90, [70, 110]],
    ['alcala', 'Puerta de Alcalá', 'Madrid, España', 40.4200, -3.6888, 60, [100, 70]],
    ['palacio', 'Palacio Real', 'Madrid, España', 40.4180, -3.7143, 140, [100, 70]],
    ['acueducto', 'Acueducto de Segovia', 'Segovia, España', 40.9481, -4.1177, 260, [100, 70]],
    ['mezquita', 'Mezquita de Córdoba', 'Córdoba, España', 37.8791, -4.7794, 180, [100, 70]],
    ['hercules', 'Torre de Hércules', 'A Coruña, España', 43.3860, -8.4066, 50, [50, 110]],
    ['penon', 'Peñón de Gibraltar', 'Gibraltar', 36.1350, -5.3440, 260, [100, 70]],
    ['santiago', 'Catedral de Santiago', 'Santiago de Compostela, España', 42.8806, -8.5447, 90, [100, 100]],
    ['artes', 'Ciudad de las Artes y las Ciencias', 'Valencia, España', 39.4547, -0.3510, 150, [100, 70]],
    ['guggenheim', 'Museo Guggenheim', 'Bilbao, España', 43.2687, -2.9340, 140, [100, 70]],
    ['eiffel', 'Torre Eiffel', 'París, Francia', 48.8584, 2.2945, 80, [60, 110]],
    ['coliseo', 'Coliseo', 'Roma, Italia', 41.8902, 12.4922, 170, [100, 70]],
    ['bigben', 'Big Ben', 'Londres, Reino Unido', 51.5007, -0.1246, 40, [40, 110]],
    ['libertad', 'Estatua de la Libertad', 'Nueva York, EE. UU.', 40.6892, -74.0445, 60, [50, 110]],
    ['taj', 'Taj Mahal', 'Agra, India', 27.1751, 78.0421, 200, [100, 80]],
    ['giza', 'Pirámides de Giza', 'Giza, Egipto', 29.9792, 31.1342, 260, [100, 70]],
    ['cristo', 'Cristo Redentor', 'Río de Janeiro, Brasil', -22.9519, -43.2105, 70, [60, 100]],
    ['pisa', 'Torre de Pisa', 'Pisa, Italia', 43.7230, 10.3966, 50, [50, 100]],
    ['brandeburgo', 'Puerta de Brandeburgo', 'Berlín, Alemania', 52.5163, 13.3777, 80, [100, 70]],
    ['sidney', 'Ópera de Sídney', 'Sídney, Australia', -33.8568, 151.2153, 180, [100, 70]],
    ['sanbasilio', 'Catedral de San Basilio', 'Moscú, Rusia', 55.7525, 37.6231, 70, [70, 100]],
    ['partenon', 'Partenón', 'Atenas, Grecia', 37.9715, 23.7257, 120, [100, 70]],
    ['goldengate', 'Golden Gate', 'San Francisco, EE. UU.', 37.8199, -122.4783, 260, [100, 70]],
    ['burj', 'Burj Khalifa', 'Dubái, Emiratos Árabes', 25.1972, 55.2744, 60, [40, 120]]
  ];

  // ---------- Dibujo en el mapa ----------
  const css = document.createElement('style');
  css.textContent = `.mn { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .mn-i { position: absolute; pointer-events: none; display: none; filter: drop-shadow(0 2px 2px rgba(0,0,0,.35)); }
    .mn-i svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .mn-l { display: none; position: absolute; left: 50%; top: 100%; transform: translate(-50%, 3px); white-space: nowrap; font: 700 11px/1.2 system-ui, sans-serif;
      color: #fff; background: rgba(30,40,60,.74); padding: 2px 7px; border-radius: 9px; text-shadow: none; }
    .mn-i.lb .mn-l { display: block; }`;
  document.head.appendChild(css);
  map.createPane('monumentos'); map.getPane('monumentos').style.zIndex = 553;      // por encima de las plazas, por debajo de señales y coches
  map.getPane('monumentos').style.pointerEvents = 'none';

  let uid = 0;
  const svg = (m, W, H) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">` +
    `<ellipse cx="${W / 2}" cy="${H - 2.5}" rx="${f(W * .46)}" ry="3.2" fill="#000" opacity=".16"/>${ART[m](('mn' + (uid++)))}</svg>`;
  const items = LIST.map(([id, name, place, lat, lng, w, vb]) => {
    const box = document.createElement('div'); box.className = 'mn-i';
    box.innerHTML = svg(id, vb[0], vb[1]) + '<div class="mn-l"></div>';
    box.lastChild.textContent = name;
    const ll = { lat, lng };
    const mk = L.marker(ll, { icon: L.divIcon({ className: 'mn', iconSize: [0, 0], iconAnchor: [0, 0], html: box }), pane: 'monumentos', interactive: false, keyboard: false }).addTo(map);
    return { id, name, place, lat, lng, w, vb, ll, box, mk };
  });

  let pending = 0;
  function update() {
    pending = 0;
    const z = map.getZoom(), show = on && z >= MIN_Z;
    if (!show) { items.forEach(M => { M.box.style.display = 'none'; }); return; }
    const size = map.getSize(), k = map.pxPerM(), lab = z >= LABEL_Z;
    items.forEach(M => {
      const wpx = Math.min(MAX_W, Math.max(M.w * k, MIN_H * M.vb[0] / M.vb[1])), hpx = wpx * M.vb[1] / M.vb[0];
      const c = map.latLngToContainerPoint(M.ll), s = M.box.style;
      if (c.x < -wpx - 120 || c.x > size.x + wpx + 120 || c.y < -40 || c.y > size.y + hpx + 120) { s.display = 'none'; return; }
      s.display = 'block'; s.width = f(wpx) + 'px'; s.height = f(hpx) + 'px'; s.left = f(-wpx / 2) + 'px'; s.top = f(-hpx) + 'px';
      M.box.classList.toggle('lb', lab);
    });
  }
  const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
  map.on('move', schedule); map.on('zoom', schedule); map.on('resize', schedule);
  if (map.gl.loaded && !map.gl.loaded()) map.gl.once('load', update);

  function apply() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.opacity = on ? '1' : '.55'; btn.title = on ? 'Monumentos: visibles' : 'Monumentos: ocultos'; btn.dataset.label = 'Monumentos: ' + (on ? 'sí' : 'no'); }
    update();
  }
  if (btn) btn.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    apply();
  });
  apply();

  // Consola: Monumentos.list() y Monumentos.goto('sagrada')
  window.Monumentos = {
    list: () => items.map(({ id, name, place, lat, lng }) => ({ id, name, place, lat, lng })),
    goto: id => { const M = items.find(m => m.id === id); if (!M) return 'No existe ese monumento'; map.flyTo([M.lat, M.lng], 17); return M.name; },
    _svg: (id, W, H) => svg(id, W, H)
  };
})();
