'use strict';
// PREHISTORIA: el terreno del mundo (lagos, ríos, pantanos, selva, bosques de helechos, colinas, montañas y un volcán).
// Es una función matemática (ruido determinista), así que NO hay imágenes ni datos que descargar: el mismo mapa sale siempre,
// en cualquier zoom, y lo usan a la vez el navegador (prehistoria.js dibuja el mapa y los árboles) y el servidor (server.js
// no deja comprar parcelas que estén bajo el agua). Si cambias algo aquí, cambia el mundo entero: no toques SEED ni las constantes
// una vez que haya jugadores con terrenos.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PrehistoriaTerreno = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const SEED = 7741;
  const MAXOCT = 15;   // octavas de detalle (más allá no se nota)
  const LAND = [-80, 10];   // dónde aterriza el cohete: [longitud, latitud]. Aquí cerca hay lago, río, selva, montañas y el volcán.
  const SEA = 0.46;             // por debajo de esta altura hay agua (mar, lagos)

  // ---------- Ruido ----------
  function h2(ix, iy, s) {
    let h = Math.imul(ix | 0, 0x27d4eb2d) + Math.imul(iy | 0, 0x165667b1) + Math.imul((s | 0) + 1, 0x9e3779b1) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 16), 0x27d4eb2d);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const sm = t => t * t * (3 - 2 * t);
  function vn(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
    const a = h2(ix, iy, s), b = h2(ix + 1, iy, s), c = h2(ix, iy + 1, s), d = h2(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y, s, oct) {
    let v = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { v += a * vn(x * f + i * 17.3, y * f - i * 9.1, s + i * 31); n += a; a *= 0.5; f *= 2; }
    return v / n;
  }
  function vn3(x, y, z, s) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
    const z0 = Math.imul(iz, 7919), z1 = Math.imul(iz + 1, 7919);
    const a0 = h2(ix + z0, iy, s), b0 = h2(ix + 1 + z0, iy, s), c0 = h2(ix + z0, iy + 1, s), d0 = h2(ix + 1 + z0, iy + 1, s);
    const a1 = h2(ix + z1, iy, s), b1 = h2(ix + 1 + z1, iy, s), c1 = h2(ix + z1, iy + 1, s), d1 = h2(ix + 1 + z1, iy + 1, s);
    const l0 = a0 + (b0 - a0) * fx + (c0 - a0) * fy + (a0 - b0 - c0 + d0) * fx * fy, l1 = a1 + (b1 - a1) * fx + (c1 - a1) * fy + (a1 - b1 - c1 + d1) * fx * fy;
    return l0 + (l1 - l0) * fz;
  }
  // Ruido del planeta: las primeras octavas (continentes y mares) sobre una ESFERA, para que no se estiren en los polos; las finas (lagos, orillas, detalles) en plano
  const D2R = Math.PI / 180;
  function fbmS(lon, lat, s, oct, nCoarse) {
    const la = lat * D2R, lo = lon * D2R, cl = Math.cos(la), px = cl * Math.cos(lo), py = cl * Math.sin(lo), pz = Math.sin(la);
    let v = 0, a = 0.5, n = 0;
    for (let i = 0; i < oct; i++) {
      const f = 1.7 * Math.pow(2, i);
      const t = i < nCoarse ? vn3(px * f + i * 7.7, py * f - i * 3.1, pz * f + i * 5.3, s + i * 31) : vn(lon * f * D2R + i * 17.3, lat * f * D2R - i * 9.1, s + i * 31);
      v += a * (t - 0.5); n += a; a *= 0.5;
    }
    return 0.5 + v / n;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const gauss = (dx, dy, rx, ry) => Math.exp(-((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)));

  // ---------- Lugares con nombre (cerca del aterrizaje; dx, dy en grados desde LAND) ----------
  const VOLCANO = { dx: -0.0125, dy: 0.0215, r: 0.0042 };
  const SITES = [
    ['Lago Cretácico', 0.0068, 0.0026],
    ['Río de los Gigantes', 0.0016, 0.0085],
    ['Monte Humeante (volcán)', VOLCANO.dx, VOLCANO.dy],
    ['Valle de los Helechos', -0.0045, -0.0030],
    ['Pantano Jurásico', -0.0125, -0.0075],
    ['Cordillera del Trueno', 0.0100, 0.0150]
  ].map(s => [s[0], LAND[0] + s[1], LAND[1] + s[2]]);

  // Un río pintado a mano: baja de las montañas del norte y desemboca en el lago
  function scenicRiver(dx, dy) {
    const y0 = 0.0170, y1 = 0.0030;
    if (dy > y0 || dy < y1) return 0;
    const t = (y0 - dy) / (y0 - y1);
    const cx = 0.0016 + 0.0052 * t * t + 0.0013 * Math.sin(dy * 900);
    const w = 0.00026 + 0.00018 * t;
    const d = Math.abs(dx - cx);
    return d < w ? 1 : 0;
  }

  // Altura (0 a 1), humedad (0 a 1) y río (0 o 1) en un punto. oct = nivel de detalle (16 = todo; menos = más rápido y más suave)
  function sample(lon, lat, oct) {
    oct = Math.min(oct || MAXOCT, MAXOCT);
    let e = 0.5 + (fbmS(lon, lat, SEED, oct, 5) - 0.5) * 2.6;
    let m = 0.5 + (fbmS(lon, lat, SEED + 11, Math.min(oct, 12), 4) - 0.5) * 2.2;
    const dx = lon - LAND[0], dy = lat - LAND[1];
    if (Math.abs(dx) < 0.09 && Math.abs(dy) < 0.09) {   // el paisaje de la zona de aterrizaje
      const w = sm(clamp(1 - Math.hypot(dx, dy) / 0.09, 0, 1));   // 1 en el aterrizaje, 0 a unos 9 km
      e = e * (1 - w) + (0.60 + clamp(e - 0.5, -0.25, 0.5) * 0.3) * w;   // alrededor del aterrizaje siempre hay tierra firme (llanura suave) y no un mar
      m = m * (1 - w) + (0.64 + (m - 0.5) * 0.5) * w;    // y mucha humedad: selva
      // las formas se deforman con ruido para que no salgan elipses perfectas, y las montañas son crestas
      const o = Math.min(oct, 11), n1 = fbm(lon / 0.014 + 11, lat / 0.014 + 11, SEED + 41, Math.max(3, o - 8)), n2 = fbm(lon / 0.014 - 53, lat / 0.014 - 53, SEED + 43, Math.max(3, o - 8));
      const ux = dx + (n1 - 0.5) * 0.0075, uy = dy + (n2 - 0.5) * 0.0075;
      const rid = 1 - Math.abs(2 * fbm(lon / 0.009 + 5, lat / 0.009 + 5, SEED + 47, Math.max(3, o - 7)) - 1);
      const gm = 0.42 * gauss(ux - 0.0100, uy - 0.0150, 0.0100, 0.0036) + 0.38 * gauss(ux + 0.0030, uy - 0.0185, 0.0140, 0.0036) + 0.42 * gauss(ux - 0.0185, uy - 0.0040, 0.0046, 0.0105);
      e += gm * (0.35 + 1.05 * rid);                                                                                                  // cordillera al norte y montañas al este
      e -= 0.62 * gauss(ux - 0.0068, uy - 0.0026, 0.0027, 0.0019);                                                                    // el lago
      e -= 0.60 * gauss(ux + 0.0125, uy + 0.0075, 0.0048, 0.0031);                                                                    // el pantano (agua baja)
      m += 0.30 * gauss(ux - 0.0068, uy - 0.0026, 0.0080, 0.0060) + 0.40 * gauss(ux + 0.0125, uy + 0.0075, 0.0100, 0.0070);
      const vx = ux - VOLCANO.dx, vy = uy - VOLCANO.dy, vr = Math.hypot(vx, vy) / VOLCANO.r;   // el volcán: cono con cráter en el centro y canales de lava
      if (vr < 2.4) {
        const cone = 0.85 * Math.max(0, 1 - vr / 2.4) * (0.85 + 0.3 * rid);
        e += cone - (vr < 0.34 ? 0.20 : 0); m -= 0.25 * Math.max(0, 1 - vr / 2.4);
      }
      const ru = fbm(lon / 0.006 + 90, lat / 0.006 + 90, SEED + 51, Math.max(3, o - 6));   // relieve suave de la llanura: pequeñas lomas
      e += (ru - 0.5) * (0.07 + 0.35 * Math.max(0, e - 0.6));
    }
    let lv = 0;
    if (oct >= 9 && Math.abs(dx - VOLCANO.dx) < 0.012 && Math.abs(dy - VOLCANO.dy) < 0.012) {   // canales de lava que bajan del cráter
      const vr2 = Math.hypot(dx - VOLCANO.dx, dy - VOLCANO.dy) / VOLCANO.r;
      if (vr2 < 1.15 && vr2 > 0.3 && Math.abs(fbm(lon / 0.0035 + 400, lat / 0.0035 + 400, SEED + 61, 4) - 0.5) < 0.035) lv = 1;
    }
    let river = 0;
    if (oct >= 11) {   // los ríos solo se ven de cerca (de lejos serían rayitas)
      river = scenicRiver(dx, dy);
      if (!river) {
        const rv = Math.abs(fbm(lon / 0.07 + 300, lat / 0.07 + 300, SEED + 21, 6) - 0.5), mask = fbm(lon / 1.4 + 70, lat / 1.4 + 70, SEED + 23, 3);
        if (mask > 0.47 && e > SEA + 0.02 && e < 0.66 && rv < 0.0085 && Math.hypot(dx, dy) > 0.0035) river = 1;   // (ninguno justo donde aterrizas)
      }
    }
    return { e: clamp(e, 0, 1.4), m: clamp(m, 0, 1), r: river, lv };
  }

  // Clases de terreno
  const C = { DEEP: 0, WATER: 1, RIVER: 2, SAND: 3, SWAMP: 4, JUNGLE: 5, FOREST: 6, PLAIN: 7, HILL: 8, MOUNTAIN: 9, PEAK: 10, ASH: 11, LAVA: 12 };
  function classOf(s, lon, lat) {
    const e = s.e, m = s.m;
    if (e < SEA - 0.07) return C.DEEP;
    if (e < SEA) return C.WATER;
    if (s.r) return C.RIVER;
    const vd = Math.hypot(lon - LAND[0] - VOLCANO.dx, lat - LAND[1] - VOLCANO.dy) / VOLCANO.r;
    if (vd < 0.3 || s.lv) return C.LAVA;
    if (vd < 1.7 && e > 0.66) return C.ASH;
    if (e > 1.12) return C.PEAK;
    if (e > 0.86) return C.MOUNTAIN;
    if (e > 0.68) return C.HILL;
    if (e < SEA + 0.013) return C.SAND;
    if (e < SEA + 0.06 && m > 0.58) return C.SWAMP;
    if (m > 0.52) return C.JUNGLE;
    if (m > 0.40) return C.FOREST;
    return C.PLAIN;
  }
  const isWaterClass = c => c <= C.RIVER;
  function classAt(lon, lat, oct) { return classOf(sample(lon, lat, oct), lon, lat); }
  const isLand = (lon, lat) => !isWaterClass(classAt(lon, lat, MAXOCT));

  // Una parcela se puede comprar si casi toda ella es tierra: el centro y al menos 3 de 4 puntos interiores
  function parcelOk(x, y, size) {
    size = size || 0.00025;
    const lo = x * size - 180, la = y * size - 90;
    if (!isLand(lo + size / 2, la + size / 2)) return false;
    let n = 0;
    [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].forEach(p => { if (isLand(lo + size * p[0], la + size * p[1])) n++; });
    return n >= 3;
  }

  // ---------- Dibujo: rellena una imagen RGBA (N×N) con el mapa de una zona. Las filas siguen la proyección Mercator (como el mapa) ----------
  const mercY = lat => (1 - Math.log(Math.tan(lat * Math.PI / 360 + Math.PI / 4)) / Math.PI) / 2;
  const mercLat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
  const PAL = {
    [C.DEEP]: [20, 76, 104], [C.WATER]: [38, 128, 160], [C.RIVER]: [58, 150, 176], [C.SAND]: [221, 205, 146], [C.SWAMP]: [78, 104, 60],
    [C.JUNGLE]: [28, 98, 40], [C.FOREST]: [58, 128, 48], [C.PLAIN]: [128, 160, 62], [C.HILL]: [140, 124, 96], [C.MOUNTAIN]: [108, 98, 90], [C.PEAK]: [190, 184, 172],
    [C.ASH]: [62, 54, 52], [C.LAVA]: [240, 98, 26]
  };
  // Dibujo por trozos: job.step(ms) trabaja hasta ms milisegundos y devuelve true cuando ha terminado (así el móvil no se queda colgado)
  const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  function makeJob(data, N, west, south, east, north, oct) {
    const y0 = mercY(north), y1 = mercY(south), N1 = N + 2;
    const E = new Float32Array(N1 * N1), K = new Uint8Array(N * N), M = new Float32Array(N * N);
    const lons = new Float64Array(N1), lats = new Float64Array(N1);
    for (let i = 0; i < N1; i++) { lons[i] = west + (east - west) * ((i - 1 + 0.5) / N); lats[i] = mercLat(y0 + (y1 - y0) * ((i - 1 + 0.5) / N)); }
    let phase = 0, row = 0;
    const ox = (west * 1e4) | 0, oy = (south * 1e4) | 0;
    function height(j) {
      for (let i = 0; i < N1; i++) {
        const s = sample(lons[i], lats[j], oct);
        E[j * N1 + i] = s.e;
        if (i > 0 && j > 0 && i <= N && j <= N) { K[(j - 1) * N + i - 1] = classOf(s, lons[i], lats[j]); M[(j - 1) * N + i - 1] = s.m; }
      }
    }
    function shade(j) {
      for (let i = 0; i < N; i++) {
        const c = K[j * N + i], base = PAL[c], k = ((j + 1) * N1 + i + 1);
        const gx = E[k + 1] - E[k - 1], gy = E[k + N1] - E[k - N1];   // pendiente (el norte es hacia arriba)
        const water = c <= C.RIVER, e = E[k];
        let sh = water ? 1 : 1 + clamp((-gx - gy) * (c >= C.HILL ? 11 : 6), -0.5, 0.5);
        let r = base[0], g = base[1], b = base[2];
        if (c === C.WATER || c === C.DEEP) { const t = clamp((SEA - e) / 0.12, 0, 1); r = r * (1 - 0.2 * t) + 22 * (1 - t); g = g * (1 - 0.2 * t) + 34 * (1 - t); b = b * (1 - 0.2 * t) + 18 * (1 - t); }
        else if (c === C.JUNGLE || c === C.FOREST || c === C.PLAIN) { const mm = M[j * N + i]; r *= 0.88 + mm * 0.22; g *= 0.9 + (1 - mm) * 0.18; }
        else if (c === C.HILL || c === C.MOUNTAIN) { const t = clamp((e - 0.68) / 0.45, 0, 1); r += (206 - r) * t * 0.18; g += (200 - g) * t * 0.18; b += (190 - b) * t * 0.18; }
        else if (c === C.LAVA) { sh = 1; g = 120 + 80 * Math.sin(i * 0.9 + j * 0.7); b = 30; r = 255; }
        const o = (j * N + i) * 4, n = 0.96 + 0.08 * h2(i * 7 + ox, j * 13 + oy, 5);   // un poco de grano, como pintado
        data[o] = clamp(r * sh * n, 0, 255); data[o + 1] = clamp(g * sh * n, 0, 255); data[o + 2] = clamp(b * sh * n, 0, 255); data[o + 3] = 255;
      }
    }
    return {
      step(ms) {
        const t0 = nowMs();
        for (;;) {
          if (phase === 0) { height(row++); if (row >= N1) { phase = 1; row = 0; } }
          else { shade(row++); if (row >= N) return true; }
          if (nowMs() - t0 > ms) return false;
        }
      }
    };
  }
  function fillImage(data, N, west, south, east, north, oct) { makeJob(data, N, west, south, east, north, oct).step(Infinity); }
  // Nivel de detalle que hace falta para un tamaño de píxel (en grados)
  const octFor = pixelDeg => clamp(Math.ceil(Math.log(33.7 / (pixelDeg * 2)) / Math.LN2) + 1, 5, MAXOCT);

  // ---------- Árboles (siempre los mismos en el mismo sitio): una cuadrícula con sacudida; cada casilla puede tener un árbol ----------
  // tipos: 0 palmera, 1 cícada, 2 helecho arbóreo, 3 araucaria, 4 helecho gigante, 5 cola de caballo (gigante)
  function trees(west, south, east, north, step, cap) {
    const out = [], i0 = Math.floor((west + 180) / step), i1 = Math.ceil((east + 180) / step), j0 = Math.floor((south + 90) / step), j1 = Math.ceil((north + 90) / step);
    for (let j = j1; j >= j0; j--) for (let i = i0; i <= i1; i++) {   // de norte a sur: los del sur se dibujan encima
      const r = h2(i, j, 91), lon = (i + 0.15 + 0.7 * h2(i, j, 92)) * step - 180, lat = (j + 0.15 + 0.7 * h2(i, j, 93)) * step - 90;
      if (r > 0.62) continue;
      const s = sample(lon, lat, 13), c = classOf(s, lon, lat);
      let dens = c === C.JUNGLE ? 0.62 : c === C.FOREST ? 0.34 : c === C.SWAMP ? 0.28 : c === C.PLAIN ? 0.09 : c === C.SAND ? 0.04 : c === C.HILL ? 0.05 : 0;
      if (r > dens) continue;
      const pick = h2(i, j, 94); let k;
      if (c === C.JUNGLE) k = pick < 0.25 ? 0 : pick < 0.45 ? 2 : pick < 0.7 ? 4 : pick < 0.88 ? 3 : 1;
      else if (c === C.FOREST) k = pick < 0.3 ? 3 : pick < 0.55 ? 1 : pick < 0.8 ? 2 : 4;
      else if (c === C.SWAMP) k = pick < 0.6 ? 5 : 4;
      else k = pick < 0.5 ? 1 : 4;
      out.push({ lon, lat, k, s: 0.8 + 0.5 * h2(i, j, 95) });
      if (out.length >= (cap || 4000)) return out;
    }
    return out;
  }

  return { SEED, LAND, SEA, SITES, VOLCANO, C, MAXOCT, sample, classOf, classAt, isLand, isWaterClass, parcelOk, fillImage, makeJob, octFor, trees, mercY, mercLat };
});
