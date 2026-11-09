'use strict';
// Vida en todos los mundos. En la Luna viven ASTRONAUTAS (caminan a saltitos, con casas lunares: cúpulas, módulos con paneles solares, invernaderos…;
// de vez en cuando pasa un jeep lunar). En el resto de planetas:
//  - Marcianos que pasean, se paran a charlar entre ellos y piensan en voz alta («¿qué hace este terrícola en mi planeta?»).
//  - Vichos: babosas saltarinas, escarabajos de seis patas y medusas flotantes.
//  - Platillos volantes que aterrizan en plataformas (como helipuertos), sueltan visitantes y vuelven a despegar. Y alguno que pasa de largo.
//  - Edificios raros de marcianos (setas, conos, discos apilados, cristales, huevos, torres retorcidas) con luces intermitentes.
// Todo es un dibujo ligero (SVG) que se coloca sobre el mapa de cada planeta (mundos.js avisa con el evento «mundo:map»).
// Solo se ve de cerca (zoom 15 o más). Se apaga con el mismo botón de la gente (🚶), como los animales de la Tierra.
// Para probar en la consola: alienSay('marte') hace hablar a un marciano; alienSaucer('marte') llama a un platillo.
// Saludos con tu nombre: al llegar a CUALQUIER mundo (evento «mundo:llegada», lo lanza mundos.js) un habitante te da la bienvenida por tu apodo y otro
// te suelta una frase graciosa («Vete de aquí, terrícola», «Aquí está todo muy caro», «Voy a pedir una hipoteca»…). Después, de vez en cuando, siguen nombrándote.
// Cada tipo de frase tiene su sonido (arpegio de bienvenida, caja registradora, zumbido de enfado, radio del casco). Prueba: alienGreet('marte') / alienGreet('luna').
// Voces y sonidos: cada burbuja se dice en voz alta (voices.js): los marcianos hablan, los vichos hacen su ruido y los platillos zumban.
(function () {
  if (!window.maplibregl) return;
  const IDS = ['luna', 'mercurio', 'venus', 'marte', 'jupiter', 'saturno', 'urano', 'neptuno', 'pluton'];   // en la Luna: astronautas en vez de marcianos
  const FLOAT = { jupiter: 1, saturno: 1, urano: 1, neptuno: 1 };                                      // gigantes gaseosos: todo flota
  const MC = maplibregl.MercatorCoordinate;
  const SMALL = Math.min(innerWidth, innerHeight) < 600;
  const MIN_Z = 15, REF_Z = 16.2;
  const U = 1 / (512 * Math.pow(2, REF_Z));            // un píxel (a zoom 16,2) en unidades de Mercator
  const CS = 0.001;                                     // casilla de los edificios (2×2 parcelas)
  const CAP_B = SMALL ? 9 : 14, CAP_P = SMALL ? 2 : 3, N_WALK = SMALL ? 5 : 7, N_CRIT = SMALL ? 4 : 6;
  const peopleBtn = document.getElementById('people-btn');
  const isOn = () => !peopleBtn || peopleBtn.getAttribute('aria-pressed') !== 'false';

  // ---------- Utilidades ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const div = (cls, html) => { const d = document.createElement('div'); if (cls) d.className = cls; if (html) d.innerHTML = html; return d; };
  function shade(hex, f) {   // aclara (f>0) u oscurece (f<0) un color #rrggbb
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(clamp(f > 0 ? v + (255 - v) * f : v * (1 + f), 0, 255)));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function hash(a, b, c) {   // número «al azar» estable para una casilla: así los edificios siempre están en el mismo sitio
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const LIGHT = ['#ff4d4d', '#ffd23f', '#4dfcff', '#ff5cf0', '#7dff6b'];
  let uid = 0;
  const bl = (x, y, r, col, dl, dur) => `<circle class="bl" cx="${x}" cy="${y}" r="${r}" fill="${col || pick(LIGHT)}" style="animation-delay:${(dl == null ? Math.random() * 1.2 : dl).toFixed(2)}s;animation-duration:${(dur || 0.8 + Math.random() * 0.9).toFixed(2)}s"/>`;

  // Colores por planeta: pieles de los marcianos y paredes de los edificios (que destaquen sobre el fondo de cada mundo)
  const PAL = {
    luna:     { skin: ['#f4f6fa', '#ffe9cf', '#dcecff', '#ffe1e1'], wall: ['#e9ecf1', '#cfd6e2', '#efe0c4'] },   // trajes (blanco con detalles) y casas lunares claras
    mercurio: { skin: ['#7ee787', '#ff9f43', '#d980fa', '#48dbfb'], wall: ['#7d5ba6', '#2a9d8f', '#d1603d'] },
    venus:    { skin: ['#4dd2c8', '#b983ff', '#6ea8ff', '#9be564'], wall: ['#7a3e9d', '#2f6db5', '#1f9e89'] },
    marte:    { skin: ['#7ee787', '#a8e063', '#4dd2c8', '#6ea8ff'], wall: ['#4b8f6a', '#5a6fb3', '#8a5fb0'] },
    jupiter:  { skin: ['#9b6bff', '#2fc4b2', '#7ee787', '#ff7ab6'], wall: ['#5b4b9a', '#2a8f8a', '#b04a6a'] },
    saturno:  { skin: ['#8a6bff', '#38c9b4', '#ff8a5c', '#5aa0ff'], wall: ['#5d57a8', '#2f8f9a', '#b5573f'] },
    urano:    { skin: ['#ff7ab6', '#ffa94d', '#b983ff', '#7ee787'], wall: ['#9a4f9d', '#c46a3d', '#4f6fc4'] },
    neptuno:  { skin: ['#c6ff6b', '#ffe66d', '#ff7ab6', '#7ef0ff'], wall: ['#3d9a8a', '#8a5fd0', '#c2a43a'] },
    pluton:   { skin: ['#7ee787', '#4dd2c8', '#ff8fc7', '#ffd166'], wall: ['#4a7f9a', '#8a5a9d', '#5a9a5a'] }
  };

  // ---------- Dibujos ----------
  // Marciano (20×30; el suelo está en el borde de abajo). Cuatro modelos.
  function alienSVG(kind, skin) {
    const dk = shade(skin, -0.3), lt = shade(skin, 0.3), eye = '#101820';
    const legs = (y0, y1) => `<rect class="al-leg" x="6.4" y="${y0}" width="2.4" height="${y1 - y0}" rx="1.1" fill="${dk}"/><rect class="al-leg b" x="11.2" y="${y0}" width="2.4" height="${y1 - y0}" rx="1.1" fill="${dk}"/>`;
    const arms = `<path class="al-leg b" d="M5.8 12.4 Q2.6 14.8 3.4 18.4" stroke="${skin}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path class="al-leg" d="M14.2 12.4 Q17.4 14.8 16.6 18.4" stroke="${skin}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
    const body = `<ellipse cx="10" cy="15" rx="4.2" ry="4.6" fill="${skin}"/><ellipse cx="10" cy="15.6" rx="2.4" ry="2.8" fill="${lt}" opacity=".45"/>`;
    const sh = `<ellipse cx="10" cy="25" rx="6.5" ry="1.3" fill="rgba(0,0,0,.28)"/>`;
    let g;
    if (kind === 0) {          // clásico: cabezón con ojos rasgados y dos antenas
      g = `${legs(17.5, 24.6)}${arms}${body}
        <path d="M7 1.8 Q5.2 -1.6 3.4 -1.2 M13 1.8 Q14.8 -1.6 16.6 -1.2" stroke="${dk}" stroke-width="1" fill="none" stroke-linecap="round"/>
        <circle cx="3.4" cy="-1.4" r="1.3" fill="#ffd23f"/><circle cx="16.6" cy="-1.4" r="1.3" fill="#ffd23f"/>
        <ellipse cx="10" cy="7" rx="7" ry="6.2" fill="${skin}"/>
        <ellipse cx="6.8" cy="7.2" rx="2.3" ry="3.1" transform="rotate(-25 6.8 7.2)" fill="${eye}"/><ellipse cx="13.2" cy="7.2" rx="2.3" ry="3.1" transform="rotate(25 13.2 7.2)" fill="${eye}"/>
        <circle cx="6.1" cy="6" r=".7" fill="#fff"/><circle cx="12.5" cy="6" r=".7" fill="#fff"/><path d="M8.6 11.2 Q10 12.2 11.4 11.2" stroke="${dk}" stroke-width=".7" fill="none"/>`;
    } else if (kind === 1) {   // cíclope sonriente con una antena
      g = `${legs(18.5, 24.6)}${arms}${body}
        <path d="M10 1 Q10 -2 12.5 -2.6" stroke="${dk}" stroke-width="1" fill="none"/><circle cx="12.7" cy="-2.7" r="1.4" fill="#ff5cf0"/>
        <circle cx="10" cy="7.6" r="6.8" fill="${skin}"/>
        <ellipse cx="10" cy="6.6" rx="3.7" ry="3.3" fill="#fff"/><circle cx="10.4" cy="6.8" r="1.8" fill="${eye}"/><circle cx="9.8" cy="6.1" r=".6" fill="#fff"/>
        <path d="M6.6 11.2 Q10 14.2 13.4 11.2Z" fill="#3b1d2a"/><path d="M8.2 11.4 v1 M10 11.6 v1.3 M11.8 11.4 v1" stroke="#fff" stroke-width=".8"/>`;
    } else if (kind === 2) {   // alto, con los ojos en tallos
      g = `${legs(17.5, 24.6)}${arms}${body}
        <path d="M7.6 2 L5.4 -2 M12.4 2 L14.6 -2" stroke="${dk}" stroke-width="1" stroke-linecap="round"/>
        <circle cx="5.2" cy="-3" r="2.2" fill="#fff"/><circle cx="5.6" cy="-2.8" r="1.1" fill="${eye}"/><circle cx="14.8" cy="-3" r="2.2" fill="#fff"/><circle cx="14.4" cy="-2.8" r="1.1" fill="${eye}"/>
        <ellipse cx="10" cy="7" rx="5" ry="6.6" fill="${skin}"/><ellipse cx="10" cy="7" rx="2.2" ry="4" fill="${lt}" opacity=".4"/>
        <circle cx="9" cy="6" r=".5" fill="${dk}"/><circle cx="11" cy="6" r=".5" fill="${dk}"/><path d="M8.2 10 Q10 11.6 11.8 10" stroke="${dk}" stroke-width=".8" fill="none"/>`;
    } else {                    // tres ojos y cuernecitos
      g = `${legs(18.5, 24.6)}${arms}${body}
        <path d="M4.6 3.4 L3.4 -1 L7.6 1.6Z M15.4 3.4 L16.6 -1 L12.4 1.6Z" fill="${dk}"/>
        <ellipse cx="10" cy="8" rx="7.6" ry="5.6" fill="${skin}"/>
        <circle cx="5.6" cy="7.4" r="1.9" fill="#fff"/><circle cx="10" cy="6.4" r="2.2" fill="#fff"/><circle cx="14.4" cy="7.4" r="1.9" fill="#fff"/>
        <circle cx="5.8" cy="7.6" r=".9" fill="${eye}"/><circle cx="10" cy="6.6" r="1.1" fill="${eye}"/><circle cx="14.2" cy="7.6" r=".9" fill="${eye}"/>
        <path d="M7.4 11.4 Q10 13.6 12.6 11.4" stroke="${dk}" stroke-width=".8" fill="none"/>`;
    }
    return `<svg width="20" height="30" viewBox="0 -4 20 30" aria-hidden="true">${sh}${g}</svg>`;
  }
  // Vichos
  function blobSVG(c) {
    return `<svg width="16" height="13" viewBox="0 0 16 13" aria-hidden="true"><ellipse cx="8" cy="12" rx="6" ry="1.1" fill="rgba(0,0,0,.25)"/>
      <path d="M2 11.6 Q.8 3 8 2 Q15.2 3 14 11.6Z" fill="${c}"/><ellipse cx="6" cy="5" rx="2" ry="1" fill="#fff" opacity=".35"/>
      <circle cx="5.8" cy="7.4" r="1.8" fill="#fff"/><circle cx="6.1" cy="7.6" r=".9" fill="#111"/><circle cx="10.4" cy="6.8" r="1.4" fill="#fff"/><circle cx="10.6" cy="7" r=".7" fill="#111"/></svg>`;
  }
  function bugSVG(c) {
    const dk = shade(c, -0.35), L = (x, y, x2, y2, b) => `<line class="al-leg${b ? ' b' : ''}" x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${dk}" stroke-width="1" stroke-linecap="round"/>`;
    return `<svg width="20" height="13" viewBox="0 0 20 13" aria-hidden="true"><ellipse cx="10" cy="12" rx="7.5" ry="1.1" fill="rgba(0,0,0,.25)"/>
      ${L(5, 8, 3, 12, 0)}${L(9, 9, 8, 12.4, 1)}${L(13, 9, 14, 12.4, 0)}${L(16, 8, 18, 12, 1)}
      <path d="M3.2 8.6 Q3 2.8 9 2.8 Q15.4 2.8 15.2 8.6Z" fill="${c}"/><path d="M9.2 2.8 V8.6" stroke="${dk}" stroke-width=".6"/>
      <circle cx="6.2" cy="5.6" r="1" fill="${dk}"/><circle cx="12" cy="5.4" r="1" fill="${dk}"/>
      <circle cx="16.4" cy="6.2" r="2.7" fill="${dk}"/><circle cx="17.2" cy="5.4" r="1.1" fill="#fff"/><circle cx="17.4" cy="5.5" r=".5" fill="#111"/>
      <path d="M17.6 3.8 Q19 1.6 20 1.8" stroke="${dk}" stroke-width=".7" fill="none"/></svg>`;
  }
  function jellySVG(c) {
    const lt = shade(c, 0.35), T = (x, b) => `<path class="al-leg${b ? ' b' : ''}" d="M${x} 11 q-1.6 4 0 8" stroke="${lt}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    return `<svg width="16" height="26" viewBox="0 0 16 26" aria-hidden="true"><ellipse cx="8" cy="24.5" rx="5" ry="1.1" fill="rgba(0,0,0,.22)"/>
      ${T(4.6, 0)}${T(8, 1)}${T(11.4, 0)}
      <path d="M1.6 11 Q1.2 1.6 8 1.4 Q14.8 1.6 14.4 11Z" fill="${c}" opacity=".92"/><ellipse cx="5.4" cy="4.2" rx="2.2" ry="1" fill="#fff" opacity=".4"/>
      <circle cx="8" cy="7" r="2.6" fill="#fff"/><circle cx="8.3" cy="7.2" r="1.3" fill="#111"/></svg>`;
  }
  // Edificios raros (44×60, la base está en y=58). c = [pared, oscura, clara]
  function buildingSVG(kind, wall) {
    const c1 = wall, c2 = shade(wall, -0.32), c3 = shade(wall, 0.35), win = '#ffe66d';
    const sh = `<ellipse cx="22" cy="58" rx="${kind === 3 ? 17 : 15}" ry="2.4" fill="rgba(0,0,0,.3)"/>`;
    let g = '';
    if (kind === 0) {          // seta-torre
      g = `<path d="M17 58 L19 26 H25 L27 58Z" fill="${c2}"/>
        <path d="M3 30 Q3 6 22 6 Q41 6 41 30Z" fill="${c1}"/><path d="M3 30 H41 Q41 34 22 34 Q3 34 3 30Z" fill="${c2}"/>
        <circle cx="12" cy="15" r="2.6" fill="${c3}"/><circle cx="31" cy="12" r="2" fill="${c3}"/><circle cx="25" cy="21" r="2.8" fill="${c3}"/>
        <ellipse cx="22" cy="46" rx="2" ry="3" fill="${win}" opacity=".9"/>
        <path d="M22 6 V0" stroke="${c2}" stroke-width="1.2"/>${bl(22, -.5, 1.7, '#ff4d4d', 0, 1)}${bl(9, 24, 1.5, null)}${bl(35, 24, 1.5, null)}`;
    } else if (kind === 1) {   // cono en espiral con un satélite que gira
      g = `<path d="M7 58 L22 8 L37 58Z" fill="${c1}"/><path d="M22 8 L37 58 H27Z" fill="${c2}" opacity=".55"/>
        <path d="M11 46 Q22 52 33 46 M14.5 34 Q22 39 29.5 34 M18 22 Q22 25 26 22" stroke="${c3}" stroke-width="2" fill="none" stroke-linecap="round"/>
        <rect x="19.6" y="48" width="4.8" height="10" rx="2" fill="${win}" opacity=".85"/>
        <circle cx="22" cy="8" r="4" fill="${c3}"/>${bl(22, 8, 2.2, '#ff5cf0', 0, 1.1)}
        <circle r="2" fill="#4dfcff"><animateMotion dur="3.6s" repeatCount="indefinite" path="M22,3 m-13,0 a13,4 0 1,0 26,0 a13,4 0 1,0 -26,0"/></circle>`;
    } else if (kind === 2) {   // discos apilados sobre patas
      g = `<path d="M13 58 L19 36 M31 58 L25 36 M22 58 V36" stroke="${c2}" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="22" cy="34" rx="18" ry="5" fill="${c2}"/><ellipse cx="22" cy="32" rx="18" ry="4.6" fill="${c1}"/>
        <ellipse cx="22" cy="24" rx="13" ry="4" fill="${c2}"/><ellipse cx="22" cy="22.4" rx="13" ry="3.6" fill="${c3}"/>
        <path d="M14 16 Q14 6 22 6 Q30 6 30 16Z" fill="#7be0ff" opacity=".75"/><path d="M22 6 V-1" stroke="${c2}" stroke-width="1.2"/>
        ${bl(22, -1.5, 1.6, '#ff4d4d', 0, .9)}${bl(7, 33, 1.5)}${bl(15, 36, 1.5)}${bl(29, 36, 1.5)}${bl(37, 33, 1.5)}${bl(11, 24, 1.3)}${bl(33, 24, 1.3)}`;
    } else if (kind === 3) {   // racimo de cristales brillantes
      g = `<path d="M5 58 L9 30 L14 58Z" fill="${c2}"/><path d="M12 58 L19 14 L27 58Z" fill="${c1}"/><path d="M19 14 L27 58 H21Z" fill="${c2}" opacity=".6"/>
        <path d="M25 58 L33 24 L40 58Z" fill="${c3}" opacity=".9"/><path d="M33 24 L40 58 H35Z" fill="${c1}" opacity=".6"/><path d="M20 58 L27 38 L31 58Z" fill="${c2}"/>
        <path class="bl" d="M19 14 L21.5 36 L16 36Z" fill="#fff" style="animation-duration:2.4s"/>
        ${bl(19, 12, 1.8, '#4dfcff', 0, 1.3)}${bl(33, 22, 1.5, '#ff5cf0')}${bl(9, 28, 1.3, '#ffd23f')}`;
    } else if (kind === 4) {   // vainas / huevos conectados
      g = `<rect x="10" y="44" width="24" height="5" rx="2.5" fill="${c2}"/><rect x="2" y="55" width="40" height="3.4" rx="1.6" fill="${c2}"/>
        <ellipse cx="11" cy="42" rx="8" ry="14" fill="${c1}"/><ellipse cx="33" cy="44" rx="7" ry="11" fill="${c3}"/><ellipse cx="22" cy="30" rx="9.5" ry="17" fill="${c1}"/>
        <ellipse cx="22" cy="30" rx="9.5" ry="17" fill="none" stroke="${c2}" stroke-width="1.2" stroke-dasharray="3 2"/>
        <circle cx="22" cy="22" r="3" fill="${win}"/><circle cx="22" cy="31" r="2.4" fill="#7be0ff"/><circle cx="11" cy="38" r="2.4" fill="${win}"/><circle cx="33" cy="41" r="2.2" fill="#7be0ff"/>
        ${bl(22, 13.5, 1.6, '#ff4d4d', 0, 1)}${bl(11, 28.5, 1.4)}${bl(33, 33.5, 1.4)}`;
    } else {                    // torre retorcida con anillo y antena
      g = `<path d="M13 58 V46 H31 V58Z" fill="${c1}"/><path d="M16 46 L28 46 L32 34 L18 34Z" fill="${c2}"/><path d="M18 34 L32 34 L26 22 L14 22Z" fill="${c1}"/><path d="M14 22 L26 22 L29 12 L19 12Z" fill="${c3}"/>
        <ellipse cx="22" cy="34" rx="19" ry="4.4" fill="none" stroke="#ffd23f" stroke-width="1.6" opacity=".85"/>
        <path d="M24 12 V4" stroke="${c2}" stroke-width="1.2"/><ellipse cx="24" cy="3" rx="5" ry="2" transform="rotate(-20 24 3)" fill="${c3}"/>
        <rect x="20" y="49" width="4" height="9" rx="1.6" fill="${win}" opacity=".85"/>
        ${bl(24, 3, 1.5, '#ff4d4d', 0, .9)}${bl(3.5, 34, 1.5)}${bl(40.5, 34, 1.5)}${bl(22, 38.2, 1.5)}`;
    }
    return `<svg width="44" height="62" viewBox="0 -2 44 62" aria-hidden="true">${sh}${g}</svg>`;
  }
  // Plataforma de aterrizaje (como un helipuerto, pero cuadrada) y platillo volante
  function padSVG() {
    const pts = [[8, 8], [22, 7], [42, 7], [56, 8], [57, 23], [42, 25], [22, 25], [7, 23]];
    return `<svg width="64" height="36" viewBox="0 0 64 36" aria-hidden="true">
      <rect x="2" y="11" width="60" height="21" rx="9" fill="#303650"/><rect x="2" y="6" width="60" height="22" rx="9" fill="#5b6280"/>
      <rect x="6" y="9" width="52" height="16" rx="6.5" fill="#474e6b"/>
      <ellipse cx="32" cy="17" rx="21" ry="7" fill="none" stroke="#ffd23f" stroke-width="1.6" stroke-dasharray="6 3"/>
      <path d="M32 11.2 L36.6 20 L32 17.8 L27.4 20Z" fill="#ffd23f"/>
      ${pts.map((p, i) => bl(p[0], p[1], 1.7, i % 2 ? '#ff5cf0' : '#4dfcff', i * 0.15, 1.2)).join('')}</svg>`;
  }
  function saucerSVG() {
    const cols = ['#ff4d4d', '#ffd23f', '#4dfcff', '#ff5cf0', '#7dff6b'];
    return `<svg width="56" height="34" viewBox="0 0 56 34" aria-hidden="true">
      <path class="beam" d="M19 23 L7 33 H49 L37 23Z" fill="#c8ff7a" opacity="0"/>
      <path d="M15 28 L12 33 M41 28 L44 33 M28 28 V33" stroke="#6b7186" stroke-width="1.8" stroke-linecap="round"/>
      <ellipse cx="28" cy="20.5" rx="26" ry="7" fill="#8b95ab"/><ellipse cx="28" cy="18.5" rx="26" ry="6.2" fill="#c9d3e3"/>
      <path d="M14 16 Q14 3.5 28 3.5 Q42 3.5 42 16Z" fill="#7be0ff" opacity=".75"/><path d="M18 11 Q20 6 25 5" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7" stroke-linecap="round"/>
      <circle cx="28" cy="12.4" r="3.4" fill="#7ee787"/><ellipse cx="26.6" cy="12" rx=".9" ry="1.5" fill="#111"/><ellipse cx="29.4" cy="12" rx=".9" ry="1.5" fill="#111"/>
      ${[7, 17.5, 28, 38.5, 49].map((x, i) => bl(x, 21, 1.8, cols[i], i * 0.17, 0.85)).join('')}</svg>`;
  }

  // Astronauta (20×30, el suelo está en el borde de abajo). Cuatro modelos: detalles naranja, rojo, azul y verde; el 3.º lleva antena y el 4.º una bandera.
  function astroSVG(kind, suit) {
    const dk = shade(suit, -0.26), ln = '#434a5c', gold = '#f0c14b', acc = ['#ff7a1a', '#e5484d', '#2f7de1', '#2fb36b'][kind % 4];
    const leg = b => { const x = b ? 11 : 6.2; return `<g class="al-leg${b ? ' b' : ''}"><rect x="${x}" y="17.5" width="2.8" height="6" rx="1.2" fill="${suit}" stroke="${ln}" stroke-width=".45"/><rect x="${x - 0.5}" y="22.2" width="3.8" height="2.6" rx="1.1" fill="${dk}" stroke="${ln}" stroke-width=".45"/></g>`; };
    const arm = b => { const d = b ? 'M14.4 12.8 Q17.6 15.2 16.8 18.6' : 'M5.6 12.8 Q2.4 15.2 3.2 18.6', gx = b ? 16.8 : 3.2; return `<g class="al-leg${b ? ' b' : ''}"><path d="${d}" stroke="${ln}" stroke-width="3.3" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${suit}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="${gx}" cy="19" r="1.5" fill="${dk}" stroke="${ln}" stroke-width=".4"/></g>`; };
    let extra = '';
    if (kind === 2) extra = `<path d="M13.6 2.4 L15.6 -2.2" stroke="${ln}" stroke-width=".8" stroke-linecap="round"/>${bl(15.7, -2.6, 1.1, '#ff4d4d', 0, 1)}`;
    else if (kind === 3) extra = `<path d="M18 19.4 V-3.6" stroke="#d6d9e0" stroke-width=".9" stroke-linecap="round"/><path d="M18 -3.6 H25 L23.2 -1.2 L25 1.2 H18Z" fill="#ff7a1a" stroke="${ln}" stroke-width=".3"/><circle cx="20.2" cy="-1.2" r="1" fill="#fff"/>`;
    return `<svg width="20" height="30" viewBox="0 -4 20 30" aria-hidden="true"><ellipse cx="10" cy="25" rx="6.5" ry="1.3" fill="rgba(0,0,0,.32)"/>
      <rect x="3.6" y="10.4" width="12.8" height="9" rx="2.6" fill="${dk}" stroke="${ln}" stroke-width=".5"/>
      ${leg(0)}${leg(1)}${arm(1)}
      <rect x="5.2" y="11" width="9.6" height="8.6" rx="3" fill="${suit}" stroke="${ln}" stroke-width=".5"/>
      <rect x="5.4" y="16.5" width="9.2" height="1.5" fill="${acc}"/><rect x="8" y="12.7" width="4" height="2.8" rx=".7" fill="#56627a"/><circle cx="9" cy="14.1" r=".5" fill="#ff5252"/><circle cx="11" cy="14.1" r=".5" fill="#5cff8a"/>
      ${arm(0)}
      <rect x="6.4" y="11" width="7.2" height="1.5" rx=".7" fill="${acc}"/>
      <circle cx="10" cy="6.4" r="6.3" fill="${suit}" stroke="${ln}" stroke-width=".5"/>
      <ellipse cx="10" cy="6.8" rx="4.7" ry="4.1" fill="#a9760f"/><ellipse cx="10" cy="6.6" rx="4.2" ry="3.6" fill="${gold}"/><ellipse cx="8.3" cy="5.1" rx="1.6" ry=".9" fill="#fff" opacity=".7"/>${extra}</svg>`;
  }
  // Casas lunares (44×60, la base está en y=58): cúpula, módulo con paneles solares, casa doble, antena parabólica, invernadero y torre con bandera.
  function moonBaseSVG(kind, wall) {
    const c1 = wall, c2 = shade(wall, -0.3), c3 = shade(wall, 0.45), win = '#ffe66d', ln = '#454c5c', sw = ` stroke="${ln}" stroke-width=".8"`;
    const sh = `<ellipse cx="22" cy="58.4" rx="19" ry="2.2" fill="rgba(0,0,0,.3)"/>`;
    let g = '';
    if (kind === 0) {          // cúpula-iglú con esclusa
      g = `<path d="M4 58 A18 18 0 0 1 40 58Z" fill="${c1}"${sw}/><path d="M22 40 V58 M12 45 Q22 40 32 45 M8 52 Q22 47 36 52" stroke="${c2}" stroke-width=".8" fill="none" opacity=".7"/>
        <rect x="18.5" y="47" width="7" height="11" rx="3.5" fill="${c2}"${sw}/><rect x="20.2" y="49" width="3.6" height="4" rx="1.8" fill="${win}"/>
        <circle cx="12" cy="50" r="2" fill="#7be0ff"${sw}/><circle cx="32" cy="50" r="2" fill="#7be0ff"${sw}/>
        <path d="M22 40 V32" stroke="${ln}" stroke-width="1.1"/>${bl(22, 31.5, 1.6, '#ff4d4d', 0, 1)}`;
    } else if (kind === 1) {   // módulo cilíndrico con panel solar
      g = `<path d="M12 58 V55 M32 58 V55" stroke="${ln}" stroke-width="1.6"/><rect x="5" y="42" width="34" height="15" rx="7.5" fill="${c1}"${sw}/><path d="M5 50 H39" stroke="${c2}" stroke-width=".8" opacity=".6"/>
        <circle cx="13" cy="48.5" r="2.4" fill="#7be0ff"${sw}/><circle cx="22" cy="48.5" r="2.4" fill="#7be0ff"${sw}/><circle cx="31" cy="48.5" r="2.4" fill="${win}"${sw}/>
        <path d="M22 42 V31" stroke="${ln}" stroke-width="1.4"/><path d="M8 21 H36 L38 30 H6Z" fill="#2b4c9b"${sw}/><path d="M15 21 L14 30 M22 21 V30 M29 21 L30 30 M7 25.5 H37" stroke="#8fb0f5" stroke-width=".6"/>
        ${bl(5, 49, 1.4)}${bl(39, 49, 1.4)}`;
    } else if (kind === 2) {   // casa cuadrada + cúpula unidas por un tubo
      g = `<rect x="19" y="49" width="8" height="5.5" fill="${c2}"${sw}/><rect x="2.5" y="38" width="17.5" height="20" rx="2" fill="${c1}"${sw}/><rect x="2.5" y="36" width="17.5" height="4.2" rx="1.6" fill="${c3}"${sw}/>
        <rect x="5.5" y="43" width="5.5" height="5.5" rx="1" fill="${win}"${sw}/><rect x="13" y="48" width="5" height="10" rx="1" fill="${c2}"${sw}/>
        <path d="M24 58 A10 10 0 0 1 44 58Z" fill="${c3}"${sw}/><circle cx="34" cy="52.5" r="2.3" fill="#7be0ff"${sw}/>
        <path d="M16 36 V27" stroke="${ln}" stroke-width="1.1"/>${bl(16, 26.5, 1.5, '#ff4d4d', 0, 1)}`;
    } else if (kind === 3) {   // antena parabólica
      g = `<rect x="9" y="46" width="26" height="12" rx="2" fill="${c1}"${sw}/><rect x="12.5" y="49" width="6.5" height="4" rx="1" fill="${win}"${sw}/><rect x="26" y="50" width="5" height="8" fill="${c2}"${sw}/>
        <path d="M22 46 V32" stroke="${ln}" stroke-width="1.8"/>
        <g transform="rotate(-20 22 30)"><path d="M8 20 Q22 40 36 20Z" fill="${c3}"${sw}/><path d="M22 30 V10" stroke="${ln}" stroke-width="1"/></g>${bl(18.5, 11, 1.6, '#ff5cf0', 0, 1)}${bl(9, 52, 1.3)}`;
    } else if (kind === 4) {   // invernadero con plantas
      g = `<path d="M3 57 A19 19 0 0 1 41 57Z" fill="#bfe8ff" opacity=".55"${sw}/><path d="M22 38 V57 M12 43 Q22 37 32 43" stroke="${c2}" stroke-width=".8" fill="none" opacity=".8"/>
        <rect x="8" y="51" width="28" height="6" fill="#6b4a2f"/>
        <path d="M13 51 V47 M20 51 V44 M28 51 V46 M34 51 V48" stroke="#2f9b4d" stroke-width="1.1"/>
        <circle cx="13" cy="46" r="3.1" fill="#3fbf5f"/><circle cx="20" cy="43.5" r="3.7" fill="#57d46f"/><circle cx="28" cy="45.5" r="3.4" fill="#3fbf5f"/><circle cx="34" cy="47.5" r="2.6" fill="#57d46f"/>
        <circle cx="21.5" cy="44.5" r="1" fill="#ff5252"/><circle cx="27" cy="47" r=".9" fill="#ff5252"/><circle cx="12" cy="47.4" r=".9" fill="#ffb02e"/>
        <rect x="1.5" y="56" width="41" height="3" rx="1.5" fill="${c1}"${sw}/>${bl(22, 37, 1.4, '#7dff6b', 0, 1.4)}`;
    } else {                    // torre de módulos con bandera
      g = `<rect x="8" y="46" width="28" height="12" rx="2" fill="${c1}"${sw}/><rect x="13" y="32" width="18" height="14.5" rx="2" fill="${c3}"${sw}/><path d="M15 32 A7 7 0 0 1 29 32Z" fill="${c1}"${sw}/>
        <circle cx="13.5" cy="52" r="2" fill="#7be0ff"${sw}/><circle cx="22" cy="52" r="2" fill="${win}"${sw}/><circle cx="30.5" cy="52" r="2" fill="#7be0ff"${sw}/><rect x="19.5" y="37" width="5" height="6" rx="1" fill="${win}"${sw}/>
        <path d="M22 25.5 V8" stroke="#d6d9e0" stroke-width="1.1"/><path d="M22 8 H35 L32.5 11.5 L35 15 H22Z" fill="#ff7a1a"${sw.replace('.8', '.5')}/><circle cx="27" cy="11.6" r="1.6" fill="#fff"/>${bl(22, 7.5, 1.3, '#ff4d4d', 0, 1)}`;
    }
    return `<svg width="44" height="62" viewBox="0 -2 44 62" aria-hidden="true">${sh}${g}</svg>`;
  }
  // Plataforma de aterrizaje lunar con módulo (64×54, anclado abajo)
  function landerSVG() {
    const ln = '#434a5c';
    return `<svg width="64" height="54" viewBox="0 0 64 54" aria-hidden="true">
      <rect x="2" y="38" width="60" height="14" rx="7" fill="#303650"/><rect x="2" y="34" width="60" height="14" rx="7" fill="#5b6280"/><rect x="6" y="37" width="52" height="8" rx="4" fill="#474e6b"/>
      <path d="M23 24 L13 41 M41 24 L51 41 M27 25 L22 42 M37 25 L42 42" stroke="#b8bfcc" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="13" cy="41.5" rx="3.4" ry="1.2" fill="#d6dae3"/><ellipse cx="51" cy="41.5" rx="3.4" ry="1.2" fill="#d6dae3"/><ellipse cx="22" cy="42.5" rx="2.8" ry="1" fill="#d6dae3"/><ellipse cx="42" cy="42.5" rx="2.8" ry="1" fill="#d6dae3"/>
      <path d="M20 26 L24 14 H40 L44 26Z" fill="#d9a441" stroke="${ln}" stroke-width=".7"/><path d="M26 15 L27 25 M32 14 V26 M38 15 L37 25" stroke="#a97a22" stroke-width=".7"/>
      <path d="M25 14 Q32 2 39 14Z" fill="#e4e8ef" stroke="${ln}" stroke-width=".7"/><ellipse cx="32" cy="10" rx="3.2" ry="2.4" fill="#7be0ff" stroke="${ln}" stroke-width=".5"/>
      <path d="M32 3 V-3" stroke="${ln}" stroke-width=".9"/>${bl(32, -3.4, 1.5, '#ff4d4d', 0, 1)}${bl(8, 41, 1.6, '#4dfcff', 0, 1.2)}${bl(56, 41, 1.6, '#ff5cf0', 0.3, 1.2)}</svg>`;
  }
  // Jeep lunar (56×30, anclado abajo, mira a la derecha)
  function roverSVG() {
    const ln = '#434a5c', wheel = x => `<g transform="translate(${x},24)"><g class="rv-w"><circle r="5" fill="#2e3340" stroke="#aab2c2" stroke-width="1.2"/><path d="M-4 0 H4 M0 -4 V4 M-2.8 -2.8 L2.8 2.8 M2.8 -2.8 L-2.8 2.8" stroke="#aab2c2" stroke-width=".7"/></g></g>`;
    return `<svg width="56" height="30" viewBox="0 0 56 30" aria-hidden="true"><ellipse cx="28" cy="29" rx="25" ry="1.6" fill="rgba(0,0,0,.3)"/>
      <path d="M12 21 L16 24 H40 L44 21" stroke="${ln}" stroke-width="1.4" fill="none"/>
      <rect x="8" y="14" width="40" height="7" rx="2.5" fill="#e9ecf1" stroke="${ln}" stroke-width=".8"/><rect x="12" y="16.5" width="12" height="2.4" fill="#ff7a1a"/>
      <path d="M36 14 V6" stroke="${ln}" stroke-width="1"/><path d="M29 2 H46 L47 7 H28Z" fill="#2b4c9b" stroke="${ln}" stroke-width=".6"/><path d="M33.5 2 L33 7 M38 2 V7 M42.5 2 L43 7" stroke="#8fb0f5" stroke-width=".5"/>
      <path d="M50 14 L53 5" stroke="${ln}" stroke-width=".9"/>${bl(53, 4.4, 1.2, '#ff4d4d', 0, 1)}
      <circle cx="20" cy="7.6" r="4.2" fill="#f4f6fa" stroke="${ln}" stroke-width=".6"/><ellipse cx="21.4" cy="7.9" rx="2.6" ry="2.2" fill="#f0c14b"/><rect x="16.4" y="11" width="7.2" height="5" rx="2" fill="#f4f6fa" stroke="${ln}" stroke-width=".5"/>
      ${wheel(14)}${wheel(42)}</svg>`;
  }

  // ---------- Frases ----------
  const THINK = [
    '¿Qué hace este terrícola en mi planeta?', 'Otro terrícola… y yo sin haber ordenado la nave.', 'Pienso, luego orbito.',
    'Me pica la antena. Mala señal, literalmente.', 'Si me abduce a mí, grito.', 'Qué raro: solo tiene dos ojos. Pobrecillo.',
    'Cuando una escotilla se cierra, se abre otra.', 'Más vale un terrícola en mano que ciento volando.', 'Dime con qué meteorito andas y te diré quién eres.',
    'Dicen que en la Tierra hay lunes. Qué barbaridad.', '¿Será el inspector de la comunidad de vecinos galáctica?', 'No hay mal que mil años luz no curen.',
    'Solo sé que no sé nada… y dónde aparqué el platillo, menos.', '¿Parcela? Aquí ya estaba yo antes del Big Bang.', 'Mi madre me dijo que no hablara con terrícolas.',
    'Llevo 300 años a dieta y sigo igual de verde.', 'Lo que no mata, te hace más… abducible.', 'Tiene cara de comprar el cráter de la esquina.',
    'A quien madruga, dos soles le alumbran.', 'La vida es un viaje… preferiblemente en platillo.', 'Esto ya no es un planeta, es una inmobiliaria.',
    'Hay terrícolas que miran la pantalla… y la pantalla me mira a mí.'
  ];
  const THINK_W = {
    mercurio: ['¡Qué calor! Y eso que aún no es verano.', 'Mi año dura 88 días: ya soy más viejo que tú.', 'Un día aquí dura dos años. Los lunes, cuatro.'],
    venus: ['465 °C y el terrícola sin ventilador.', 'En Venus un día dura más que un año: nunca llego a tiempo.', 'Aquí las nubes son de ácido. Se agradece el paraguas.'],
    marte: ['Marte es el rojo, ¡y yo el verde! Qué combinación.', 'El polvo rojo se me mete hasta en las antenas.', 'Aquí tenemos el volcán más alto. ¿Y tú qué tienes, terrícola?'],
    jupiter: ['Aquí pesas el doble. Yo flotando, claro.', 'La Gran Mancha Roja lleva siglos de tormenta. Como mi suegra.', 'En Júpiter cabrían mil Tierras. Y ni así me cabe la nevera.'],
    saturno: ['¿Los anillos? Son mi pulsera de la suerte.', 'Con tanto anillo, nunca encuentro aparcamiento.', 'Soy menos denso que el agua: floto hasta en la ducha.'],
    urano: ['Vivo en Urano, sí. Ya he oído todos los chistes.', 'Mi planeta gira tumbado: la siesta es de nacimiento.', 'Hace −195 °C y yo sin bufanda.'],
    neptuno: ['Vientos de 2.000 km/h: me he despeinado hasta la antena.', 'Aquí un año dura 165 de los tuyos. Voy tarde a todo.', 'Mi planeta es azul porque está triste. Mentira, es el metano.'],
    pluton: ['¡Que sí, que soy un planeta! Enano, pero planeta.', 'Me degradaron en 2006 y aún no lo he superado.', 'Un año aquí dura 248 de los tuyos. Cumplo uno cada siglo.']
  };
  const CONVOS = [
    ['¿Has visto al terrícola?', 'Sí… ¿qué hace este en mi planeta?'],
    ['Dicen que va a comprar una parcela.', '¿Una parcela? ¡Si ya hay vistas al agujero negro!'],
    ['Hola, ¿qué tal?', 'Orbitando, como siempre.'],
    ['Qué raro, solo tiene un cerebro.', 'Y encima lo lleva en la cabeza.'],
    ['¿Lo abducimos?', 'Mejor no, luego hay que rellenar formularios.'],
    ['Mira, un terrícola.', 'Disimula… haz como que mides tres metros.'],
    ['Mi primo vive en Andrómeda.', '¡Qué lejos! ¿Y tiene ascensor?'],
    ['¿Te has fijado? Nos está mirando.', '¡Saluda, que nos están grabando!'],
    ['¿Un zumo de nebulosa?', 'Sí, pero sin hielo cósmico.'],
    ['Los terrícolas pagan con créditos.', 'Pues vendámosle el cráter, con vistas.'],
    ['Cuidado, ese terrícola parece influencer.', '¿Y eso qué es?', 'Alguien que nos abducirá… para una foto.'],
    ['¿Tú crees que hay vida en la Tierra?', 'Qué va. Solo hay terrícolas.'],
    ['Ayer vi un platillo mal aparcado.', 'Seguro que era del cuñado de Orión.'],
    ['¿Por qué lleva ese aparato en la mano?', 'Dicen que es su antena. Pobrecillo, solo tiene una… y plana.']
  ];
  // Frases con el nombre del jugador ({n}) y del mundo ({w}). Grupos: hi = bienvenida · bad = «vete de aquí» · cash = «qué caro / hipoteca» · wise = frases elocuentes
  const FX = { hi: 'bienvenida', bad: 'enfado', cash: 'cash', wise: null };
  const NAMED_A = {
    hi: ['¡Bienvenido a {w}, {n}!', '¡{n}! ¡Qué honor! Pasa, pasa, que no pisamos las parcelas… mucho.', 'Bienvenido, {n}. Aquí el aire es opcional, pero la hospitalidad no.',
      '¡Oh, {n}! Te esperábamos desde el Big Bang.', 'Salve, {n}, noble viajero de la Vía Láctea.', 'Bienvenido a {w}, {n}. Mi casa es tu casa… y mi hipoteca también.',
      '¡Hola, {n}! Nos han dicho que vienes a comprar. ¡Qué alegría!', 'Aplaudid con las antenas: ¡{n} nos visita!', '¡Es {n}! ¡Que alguien avise al alcalde, al otro alcalde y al tercero!'],
    bad: ['Vete de aquí, terrícola {n}.', '{n}, lárgate a tu planeta. Aquí ya no cabe nadie.', '¡Fuera, {n}! Este planeta está completo.', 'No me mires así, {n}, que me pongo verde. Más.',
      '{n}, esto es propiedad privada… de otro terrícola. Qué fastidio.', 'Ay, {n}… otra vez tú. Vete de aquí, terrícola.', '¡Largo, {n}! Y llévate a tu cohete.'],
    cash: ['Aquí está todo muy caro, {n}.', '¿Un cráter por tres créditos? ¡Ni en Andrómeda, {n}!', '{n}, los precios por aquí están por las nubes. Y eso que estamos en {w}.',
      'Voy a pedir una hipoteca, {n}. ¿Me avalas?', 'Dicen que {n} compra parcelas. Yo, para comprarme un cráter, voy a pedir una hipoteca.', '{n}, ¿me prestas unos créditos? Te los devuelvo en el próximo eclipse.',
      'El metro cuadrado se ha disparado, {n}. Y el de agujero negro, ni te cuento.', 'Si compras aquí, {n}, acabarás pidiendo una hipoteca, como yo.', 'Me han subido el alquiler del platillo, {n}. Voy a pedir una hipoteca.',
      '¿Cuánto cuesta una parcela? Mucho, {n}. Demasiado. Voy a pedir una hipoteca.'],
    wise: ['Dijo el sabio de Andrómeda: quien visita a {n}, nunca vuelve con las manos vacías.', 'El universo es infinito, {n}, pero la paciencia de los marcianos no.', '{n}, quien busca una estrella encuentra una parcela.',
      'Las órbitas son como las deudas, {n}: siempre vuelven.', 'Contempla, {n}: millones de estrellas… y ninguna con cobertura.', 'Somos polvo de estrellas, {n}. Tú, polvo con tarjeta.',
      'No hay mal que por bien no venga, {n}, ni platillo que no aterrice.', 'Recuerda, {n}: quien no arriesga, no se hipoteca.', 'Cada cráter es una historia, {n}. Y cada historia, un alquiler.',
      'En {w}, {n}, la sabiduría es gratis y el aparcamiento no.']
  };
  const NAMED_M = {
    hi: ['¡Bienvenido a la Luna, {n}! Aquí no hay aire, pero hay buena conexión con la Tierra.', 'Houston, tenemos visita: se llama {n}.', 'Un pequeño paso para {n}, un gran paso para el vecindario lunar.',
      'Hola {n}, aquí base Tranquilidad. ¿Me recibes?', '¡{n} ha aterrizado! Repito: {n} ha aterrizado.', 'Bienvenido, {n}. Cuidado con el polvo: se pega a todo, como los vendedores.', '¡Atención, base! {n} ha llegado. Que alguien ponga café.'],
    bad: ['Vete de aquí, terrícola {n}. Es broma… o no.', '{n}, vuelve a la Tierra. Aquí ya no queda ni un cráter libre.', '¡Fuera de mi cráter, {n}!', 'Esta zona es privada, {n}. Lo dice la bandera.'],
    cash: ['Aquí está todo carísimo, {n}: hasta el oxígeno va por suscripción.', 'Voy a pedir una hipoteca para comprarme un cráter, {n}.', 'Los precios en la Luna están por las nubes, {n}. Y eso que aquí no hay nubes.',
      '{n}, ¿me das un poco de oxígeno? Te lo pago a plazos.', 'Houston, aquí hace un frío que pela y el alquiler está por las nubes. Voy a pedir una hipoteca, {n}.', 'Un cráter con vistas a la Tierra… ¡a ese precio, {n}, ni loco!'],
    wise: ['Contempla la Tierra, {n}: tan azul, tan pequeña, tan llena de gente que no nos escribe.', 'La Luna no tiene viento, {n}, pero sí mucha gente que se da aires.', 'Aquí abajo todo pesa seis veces menos, {n}, menos las facturas.',
      'Mira, {n}: desde aquí no se ven fronteras… ni el banco.', 'He visto salir la Tierra, {n}. Es como la de las fotos, pero sin filtro.', 'Silencio absoluto, {n}. Así se oye uno pensar… y a la hipoteca llamar.']
  };
  const MOON_THINK = [
    'Houston, tenemos visita… ¿será el del banco?', 'Si me caigo, tardo seis veces más en llegar al suelo.', 'Qué silencio. Aquí nadie te oye… ni tu suegra.', 'Mi traje tiene más años que mi coche.',
    'Un paso, dos pasos… ¿por qué se me va la bota?', 'La Tierra se ve más bonita desde lejos.', 'Ya me gustaría tener ascensor en este cráter.', 'Casa lunar con vistas a la Tierra: ¡oportunidad única!',
    'Dejé la bandera aquí… ¿o era en el otro cráter?', 'Aquí el polvo no se barre, se negocia.', 'Cuando vuelva a la Tierra, lo primero: una ducha. Y una lluvia.', 'Pesar poco está genial. Hasta que llega la nómina.',
    'Aquí no hay atascos, pero tampoco hay bares.', 'Una luna llena desde la Luna… ¿eso es la Tierra llena?', 'Mi radio solo capta anuncios de la Tierra. Y hipotecas.', 'Si grito, ¿alguien me oye? ¿Hola? Qué silencio.',
    'Estas botas pesan menos, pero me aprietan igual.', 'Ni un bar en 400.000 kilómetros. Esto es el fin del mundo.', 'Dicen que aquí cerca vive un conejo. Nunca lo he visto.', 'He plantado una lechuga. Tiene más suerte que yo.'
  ];
  const MOON_CONVOS = [
    ['Houston, ¿me recibes?', 'Alto y claro. ¿Dónde has aparcado el jeep?', 'En el cráter de la derecha. O el de la izquierda.'],
    ['¿Has visto al visitante?', 'Sí. Parece que viene a comprar un cráter.', 'Pues dile que aquí todo está muy caro.'],
    ['Hoy toca limpiar el polvo.', '¿Otra vez? Si no hay quien lo ensucie.', 'El polvo. Siempre el polvo.'],
    ['¿Qué tal el invernadero?', 'Ha salido una lechuga. Una.', '¡Pues esta noche hay cena de gala!'],
    ['Me duele la espalda de tanto saltar.', 'Es la gravedad: te falta un poco.', 'Pues yo me siento más ligero que nunca.'],
    ['¿Pedimos una hipoteca para ampliar la base?', 'Con estos tipos de interés, ni en órbita.'],
    ['Mira, la Tierra está en cuarto creciente.', 'Preciosa. Qué pena que no tenga cobertura aquí.'],
    ['¿Has oído eso?', 'Es el silencio.', 'Ah, claro. Qué ruidoso.']
  ];
  const CONVOS_N = [
    ['¿No es ese {n}?', 'Sí, el terrícola que compra parcelas. ¡Escóndete!'], ['Dicen que {n} viene a pedir una hipoteca.', 'Pues que haga cola: yo soy el primero.'],
    ['¿Has visto a {n}?', 'Sí. Aquí está todo muy caro y viene a comprar. Qué valor.'], ['{n} nos está mirando.', 'Disimula. Haz como que pagas la hipoteca.']
  ];
  const MOON_CONVOS_N = [
    ['Ese es {n}, ¿verdad?', 'El mismo. El que compra parcelas en la Luna.', 'Pues que no pregunte el precio.'], ['{n} ha vuelto a la Luna.', 'Qué bien: otro que paga el alquiler del cráter.'],
    ['Dicen que {n} quiere casa lunar.', 'Con vistas a la Tierra y sin vecinos. Pide una hipoteca.']
  ];
  const FLYSAY = ['¡Ahí os quedáis, terrícolas!', '¡Que llego tarde a la abducción!', '¡Apartaos, que paso!', '¡Hola, abajo! ¡Adiós, abajo!', '¡Uiiii, qué velocidad!', '¡Salud, terrícolas!'];
  const ROVERSAY = ['¡Cuidado, que paso!', '¡Soy el rey del jeep lunar!', '¡Ni un semáforo en toda la Luna!', '¡Vaya baches!', '¡Yuhuuu!', 'Voy a la base a por oxígeno.'];
  // Nombre del jugador: su apodo (el que fija app.js). Sin sesión, se le llama «terrícola»
  function playerName() {
    let n = '';
    try { n = (typeof nickOf === 'function' ? nickOf() : '') || (document.getElementById('name') || {}).value || ''; } catch (e) {}
    return String(n).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  }
  window.atlasPlayerName = playerName;   // viaje.js: los planetas y marcianos del viaje en cohete también te llaman por tu nombre
  function worldName(W) { let n = W.id; try { if (window.worldInfo) n = window.worldInfo(W.id).name; } catch (e) {} return /^La /.test(n) ? 'la ' + n.slice(3) : n; }
  const fill = (t, W) => t.replace(/\{n\}/g, playerName() || 'terrícola').replace(/\{w\}/g, worldName(W)).replace(/terrícola,? terrícola/ig, 'terrícola');
  // Una frase con el nombre del jugador de uno de los grupos; nunca repite la anterior
  function namedLine(W, groups) {
    const g = pick(groups), pool = (W.moon ? NAMED_M : NAMED_A)[g];
    let t = pick(pool), k = 0;
    while (t === W.lastNamed && pool.length > 1 && ++k < 6) t = pick(pool);
    W.lastNamed = t;
    return { text: fill(t, W), fx: FX[g] };
  }
  const SOUNDS = ['¡blup!', 'bzzz', 'ñic ñic', '¿miau?', '¡piii!', 'glub', '¡hip!', 'splosh'];
  const ARRIVE = ['¡Hemos llegado! ¿Y este terrícola?', '¡Aterrizaje perfecto! Casi.', 'Buen viaje. ¿Quién deja a un terrícola suelto?', '¡Qué mal aparca el piloto!'];

  // ---------- Estilos ----------
  const st = document.createElement('style');
  st.textContent = `
    .al-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
    .al-layer.off { display: none; }
    .al-e { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; pointer-events: none; transition: opacity .4s; }
    .al-sp { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); transform-origin: 50% 100%; pointer-events: none; }
    .al-sp.mid { transform: translate(-50%, -50%); }
    .al-sp svg { display: block; overflow: visible; }
    .al-fl { display: block; }
    .al-leg { transform-box: fill-box; transform-origin: 50% 0; animation: alstep .36s ease-in-out infinite alternate; }
    .al-leg.b { animation-direction: alternate-reverse; }
    .still .al-leg { animation: none; }
    .al-sp.walk svg { animation: albob .36s ease-in-out infinite alternate; }
    .al-sp.hop svg { animation: alhop .75s ease-in-out infinite; transform-origin: 50% 100%; }
    .al-sp.still svg { animation: none; }
    .al-e.hov > .al-sp { animation: alhover 2.6s ease-in-out infinite alternate; }
    .al-hd { position: absolute; left: -9px; top: -3px; width: 18px; height: 6px; border-radius: 50%; background: radial-gradient(#7ef0ff, rgba(126,240,255,0)); opacity: .8; }
    .bl { animation: alblink 1.1s ease-in-out infinite; }
    .beam { transition: opacity .25s; }
    .al-b { position: absolute; left: 0; top: 0; max-width: 170px; padding: 6px 10px; border-radius: 14px; background: #fff; color: #1b1f3a; font: 700 12px/1.25 system-ui, sans-serif; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,.35); pointer-events: none; opacity: 0; transition: opacity .25s; z-index: 99999; }
    .al-b.on { opacity: 1; }
    .al-b.think { background: #f4f1ff; font-style: italic; border-radius: 16px; }
    .al-b.think::before, .al-b.think::after { content: ''; position: absolute; border-radius: 50%; background: #f4f1ff; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
    .al-b.think::before { width: 9px; height: 9px; left: 50%; bottom: -12px; margin-left: -8px; }
    .al-b.think::after { width: 5px; height: 5px; left: 50%; bottom: -19px; margin-left: -2px; }
    .al-b.say::after { content: ''; position: absolute; left: 50%; bottom: -6px; margin-left: -6px; border: 6px solid transparent; border-bottom: 0; border-top-color: #fff; }
    .al-b.tiny { font-size: 11px; padding: 3px 8px; border-radius: 99px; }
    .al-sp.mwalk svg { animation: almoon .84s ease-in-out infinite; }
    .al-sp.mwalk .al-leg { animation-duration: .42s; }
    .rv-w { transform-box: fill-box; transform-origin: 50% 50%; animation: alspin .45s linear infinite; }
    @keyframes almoon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3.5px); } }
    @keyframes alspin { to { transform: rotate(360deg); } }
    @keyframes alstep { from { transform: rotate(-26deg); } to { transform: rotate(26deg); } }
    @keyframes albob { from { transform: translateY(0); } to { transform: translateY(-1.3px); } }
    @keyframes alhop { 0%, 100% { transform: translateY(0) scale(1.12, .84); } 50% { transform: translateY(-7px) scale(.9, 1.12); } }
    @keyframes alhover { from { transform: translate(-50%, -100%) translateY(-3px); } to { transform: translate(-50%, -100%) translateY(-7px); } }
    @keyframes alblink { 0%, 100% { opacity: .12; } 50% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .bl, .al-leg, .al-sp svg, .al-e.hov > .al-sp, .rv-w { animation: none !important; } .bl { opacity: .85; } }`;
  document.head.appendChild(st);

  // ---------- Un mundo ----------
  const worlds = {};
  function init(id, map) {
    if (worlds[id] || IDS.indexOf(id) < 0) return;
    const box = document.getElementById('mundo-' + id); if (!box) return;
    const layer = div('al-layer');
    const cv = map.getCanvas(); cv.parentNode.insertBefore(layer, cv.nextSibling);   // justo encima del mapa y por debajo de los rótulos de los dueños
    const c = map.getContainer();
    const W = { id, moon: id === 'luna', map, box, layer, w: c.clientWidth, h: c.clientHeight, off: true, pal: PAL[id], hov: !!FLOAT[id], seed: IDS.indexOf(id) * 1000 + 17,
      walkers: [], critters: [], structs: new Map(), bubbles: [], view: null, sync: 0, viewT: 0, ready: false, flyT: rnd(6, 12), fly: null, sig: '', first: true, s: 1 };
    map.on('resize', () => { W.w = c.clientWidth; W.h = c.clientHeight; });
    worlds[id] = W;
  }
  window.addEventListener('mundo:map', e => init(e.detail.id, e.detail.map));
  if (window.mundoMaps) Object.keys(window.mundoMaps).forEach(k => init(k, window.mundoMaps[k]));

  const llOf = (mx, my) => new MC(mx, clamp(my, 0.0001, 0.9999), 0).toLngLat();
  function viewOf(W) {
    const b = W.map.getBounds(), a = MC.fromLngLat(b.getSouthWest()), d = MC.fromLngLat(b.getNorthEast());
    return { x0: Math.min(a.x, d.x), x1: Math.max(a.x, d.x), y0: Math.min(a.y, d.y), y1: Math.max(a.y, d.y) };
  }
  const inView = (v, x, y, m) => { const mx = (v.x1 - v.x0) * m, my = (v.y1 - v.y0) * m; return x > v.x0 - mx && x < v.x1 + mx && y > v.y0 - my && y < v.y1 + my; };
  const randIn = (v, m) => ({ x: rnd(v.x0 + (v.x1 - v.x0) * m, v.x1 - (v.x1 - v.x0) * m), y: rnd(v.y0 + (v.y1 - v.y0) * m, v.y1 - (v.y1 - v.y0) * m) });

  // ---------- Marcianos y vichos ----------
  function makeEnt(W, type, x, y) {
    let svg, h, v, cls = '';
    if (type === 'alien' && W.moon) { svg = astroSVG(Math.floor(Math.random() * 4), pick(W.pal.skin)); h = 30; v = rnd(6, 10); }   // en la Luna: astronautas
    else if (type === 'alien') { svg = alienSVG(Math.floor(Math.random() * 4), pick(W.pal.skin)); h = 30; v = rnd(9, 14); }
    else if (type === 'blob') { svg = blobSVG(pick(W.pal.skin)); h = 13; v = rnd(6, 9); cls = ' hop'; }
    else if (type === 'bug') { svg = bugSVG(pick(['#ff9f43', '#ff6b81', '#feca57', '#a29bfe', '#55efc4'])); h = 13; v = rnd(11, 16); }
    else { svg = jellySVG(pick(['#ff7ab6', '#b983ff', '#7ef0ff', '#ffd166'])); h = 26; v = rnd(4, 6); }
    const el = div('al-e'); el.style.opacity = '0';
    if (W.hov && type !== 'jelly') { el.appendChild(div('al-hd')); el.classList.add('hov'); }
    const sp = div('al-sp'), fl = div('al-fl', svg); sp.appendChild(fl); el.appendChild(sp); W.layer.appendChild(el);
    const e = { type, el, sp, fl, mx: x, my: y, tx: x, ty: y, v, h, dir: 1, state: 'idle', t: rnd(0.2, 2), tb: rnd(2.5, 9), cool: rnd(4, 14), cls, sx: 0, sy: 0, sc: 1, bub: null, partner: null, visitor: false, born: performance.now(), vp: type === 'alien' && window.atlasVoice ? window.atlasVoice.profile(W.moon ? 'astro' : 'alien') : null, moon: !!W.moon };
    sp.className = 'al-sp still' + cls; requestAnimationFrame(() => { el.style.opacity = '1'; });
    return e;
  }
  function removeEnt(W, e) {
    if (e.bub) dropBubble(W, e.bub, true);
    if (e.partner) { e.partner.partner = null; if (e.partner.state === 'talk') e.partner.state = 'idle'; }
    e.el.remove();
  }
  function relocate(W, e, p) {
    if (e.partner) { if (e.partner.state === 'talk') e.partner.state = 'idle'; e.partner.partner = null; e.partner = null; }
    e.mx = p.x; e.my = p.y; e.tx = p.x; e.ty = p.y; e.state = 'idle'; e.t = rnd(0.3, 2);
    if (e.bub) dropBubble(W, e.bub, true);
    e.el.style.transition = 'none'; e.el.style.opacity = '0'; void e.el.offsetWidth; e.el.style.transition = ''; e.el.style.opacity = '1';
  }
  function setLook(e) {   // animación según lo que hace: andar, saltar (babosa) o quieto
    const walking = e.state === 'walk';
    const c = 'al-sp' + (!walking ? ' still' : e.type === 'blob' ? ' hop' : e.type === 'bug' ? '' : e.moon ? ' mwalk' : ' walk');
    if (e.look !== c) { e.look = c; e.sp.className = c; }
  }
  function pickTarget(W, e) {
    const walkers = W.walkers;
    let tx, ty;
    const friend = e.type === 'alien' && e.cool <= 0 && Math.random() < 0.4 ? pick(walkers.filter(o => o !== e && o.state !== 'talk' && o.cool <= 0)) : null;
    if (friend) { tx = friend.mx + (Math.random() < .5 ? -1 : 1) * 20 * U; ty = friend.my + rnd(-4, 4) * U; }
    else { const a = Math.random() * 6.2832, d = rnd(50, 190) * U; tx = e.mx + Math.cos(a) * d; ty = e.my + Math.sin(a) * d * 0.8; }
    if (W.view) { const v = W.view, mx = (v.x1 - v.x0) * 0.06, my = (v.y1 - v.y0) * 0.06; tx = clamp(tx, v.x0 + mx, v.x1 - mx); ty = clamp(ty, v.y0 + my, v.y1 - my); }
    e.tx = tx; e.ty = ty; e.state = 'walk';
  }
  function startTalk(W, a, b) {
    const convo = pick(W.moon ? (playerName() ? MOON_CONVOS.concat(MOON_CONVOS_N) : MOON_CONVOS) : (playerName() ? CONVOS.concat(CONVOS_N) : CONVOS)).map(l => fill(l, W)), first = Math.random() < .5 ? a : b;
    a.state = b.state = 'talk'; a.partner = b; b.partner = a;
    a.dir = b.mx < a.mx ? -1 : 1; b.dir = -a.dir;
    a.cool = b.cool = rnd(25, 45);
    a.script = b.script = { lines: convo, i: 0, t: 0.4, first };
    a.lead = true; b.lead = false;
  }
  function stepTalk(W, a, dt) {   // lo lleva solo el que dirige la conversación
    const S = a.script; if (!S || !a.partner) { a.state = 'idle'; return; }
    S.t -= dt;
    if (S.t > 0) return;
    if (S.i >= S.lines.length) { const b = a.partner; a.partner = b.partner = null; a.state = b.state = 'idle'; a.t = b.t = rnd(0.5, 2); a.script = b.script = null; return; }
    const speaker = (S.i % 2 === 0) === (S.first === a) ? a : a.partner, text = S.lines[S.i];
    dropBubbleOf(W, a); dropBubbleOf(W, a.partner);
    if (speaker.sx > -20 && speaker.sx < W.w + 20) say(W, speaker, text, 'say', Math.max(2.4, text.length * 0.06 + 1.4), true);
    S.t = Math.max(2.6, text.length * 0.065 + 1.5); S.i++;
  }
  function stepEnt(W, e, dt, v) {
    e.cool -= dt;
    if (e.state === 'idle') {
      e.t -= dt;
      if (e.t <= 0) pickTarget(W, e);
    } else if (e.state === 'walk') {
      const dx = e.tx - e.mx, dy = e.ty - e.my, d = Math.hypot(dx, dy), step = e.v * U * dt * (e.type === 'jelly' ? 1 : 1);
      if (d <= step) {
        e.mx = e.tx; e.my = e.ty; e.state = 'idle'; e.t = e.type === 'alien' ? rnd(1, 3.5) : rnd(0.3, 2);
        if (e.type === 'alien' && e.cool <= 0) {   // ¿hay otro marciano libre aquí al lado? pues a charlar
          const o = W.walkers.find(q => q !== e && q.state !== 'talk' && q.cool <= 0 && Math.hypot(q.mx - e.mx, q.my - e.my) < 46 * U && inView(v, q.mx, q.my, 0));
          if (o && W.bubbles.length < 2 && !(W.hushUntil > performance.now())) startTalk(W, e, o);
        }
      } else { e.mx += dx / d * step; e.my += dy / d * step; if (Math.abs(dx) > 0.2 * U) e.dir = dx < 0 ? -1 : 1; }
    } else if (e.state === 'talk' && e.lead) stepTalk(W, e, dt);
    if (e.state !== 'talk') {   // pensamientos en voz alta
      e.tb -= dt;
      if (e.tb <= 0) {
        e.tb = rnd(7, 15);
        if (inView(v, e.mx, e.my, -0.02) && !e.bub && !(W.hushUntil > performance.now())) {   // mientras dura el saludo al jugador nadie más habla
          if (e.type === 'alien') {
            if (Math.random() < 0.4) { const nl = namedLine(W, ['cash', 'bad', 'wise', 'hi', 'cash']); say(W, e, nl.text, 'say', null, false, nl.fx); }   // se dirige al jugador por su nombre
            else say(W, e, W.moon ? pick(MOON_THINK) : W.first ? (W.first = false, THINK[0]) : pick(Math.random() < .35 ? THINK_W[W.id] : THINK), 'think');
          }
          else if (Math.random() < .5) say(W, e, pick(SOUNDS), 'say tiny', 1.8);
        }
      }
    }
    setLook(e);
  }

  // ---------- Bocadillos ----------
  function say(W, e, text, kind, dur, force, fx) {
    if (e.bub || (!force && W.bubbles.length >= 3)) return false;
    const el = div('al-b ' + kind); el.textContent = text; W.layer.appendChild(el);
    const b = { el, e, t: dur || Math.max(3, text.length * 0.07 + 1.8), w: el.offsetWidth, tail: kind.indexOf('think') >= 0 ? 24 : 10 };
    W.bubbles.push(b); e.bub = b; requestAnimationFrame(() => el.classList.add('on'));
    voiceSay(W, e, text, force, fx);
    return true;
  }
  // Voz y sonidos: más fuerte cuanto más cerca del centro de la pantalla; el paneo de los efectos sigue al platillo
  const near = (W, x, y) => clamp(1 - Math.hypot(x - W.w / 2, y - W.h / 2) / Math.max(W.w, W.h), 0.35, 1);
  function voiceSay(W, e, text, force, fx) {
    const v = window.atlasVoice; if (!v) return;
    const vol = near(W, e.sx, e.sy);
    if (fx && !v.muted) v.sfx(fx, { vol: vol * 0.9, pan: clamp((e.sx - W.w / 2) / (W.w / 2), -1, 1) * 0.6 });   // bienvenida, «qué caro», enfado…
    if (e.type === 'alien') v.speak(text, e.vp || (e.vp = v.profile(W.moon ? 'astro' : 'alien')), { force: !!force, vol });
    else v.critter(text, vol * 0.9);
  }
  function sfxAt(W, name, sx, sy, o) {
    const v = window.atlasVoice; if (!v) return;
    v.sfx(name, Object.assign({ vol: near(W, sx, sy), pan: clamp((sx - W.w / 2) / (W.w / 2), -1, 1) * 0.8 }, o));
  }
  function dropBubble(W, b, now) {
    const i = W.bubbles.indexOf(b); if (i >= 0) W.bubbles.splice(i, 1);
    if (b.e && b.e.bub === b) b.e.bub = null;
    if (now) b.el.remove(); else { b.el.classList.remove('on'); setTimeout(() => b.el.remove(), 300); }
  }
  const dropBubbleOf = (W, e) => { if (e && e.bub) dropBubble(W, e.bub, false); };

  // ---------- Edificios y plataformas ----------
  function syncStructures(W) {
    const map = W.map, b = map.getBounds(), taken = window.worldParcelTaken || (() => false);
    const ew = (b.getEast() - b.getWest()) * 0.1, eh = (b.getNorth() - b.getSouth()) * 0.1;
    const w = b.getWest() - ew, e = b.getEast() + ew, s = b.getSouth() - eh, n = b.getNorth() + eh, cen = map.getCenter();
    const cx0 = Math.floor((w + 180) / CS), cx1 = Math.floor((e + 180) / CS), cy0 = Math.floor((s + 90) / CS), cy1 = Math.floor((n + 90) / CS);
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 3000) return;
    const want = [], land = window.worldLand && window.worldLand(W.id);
    if (land) {   // un poblado marciano junto al punto de aterrizaje, para que se vea nada más llegar
      [['pad', 0.0011, 0.0007, 0], ['bld', -0.0012, 0.0009, 0], ['bld', 0.0004, -0.0012, 1], ['bld', -0.0014, -0.0006, 2], ['bld', 0.0019, -0.0004, 3]].forEach((h, i) => {
        const kind = h[0] === 'pad' ? 0 : Math.floor(hash(W.seed, i, 5) * 6);
        want.push({ key: 'home' + i, type: h[0], lng: land[0] + h[1], lat: land[1] + h[2], kind, home: true, d: -1 });
      });
    }
    for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
      const r = hash(cx, cy, W.seed);
      if (r > 0.245) continue;
      const lng = (cx + 0.2 + 0.6 * hash(cx, cy, W.seed + 1)) * CS - 180, lat = (cy + 0.2 + 0.6 * hash(cx, cy, W.seed + 2)) * CS - 90;
      want.push({ key: 'c' + cx + ',' + cy, type: r < 0.17 ? 'bld' : 'pad', lng, lat, kind: Math.floor(hash(cx, cy, W.seed + 3) * 6), d: Math.hypot(lng - cen.lng, lat - cen.lat) });
    }
    want.sort((a, d) => a.d - d.d);
    const keep = new Map(); let nb = 0, np = 0;
    want.forEach(c => {
      if (c.type === 'bld' ? nb >= CAP_B : np >= CAP_P) return;
      if (taken(W.id, c.lng, c.lat) || (c.type === 'bld' && taken(W.id, c.lng, c.lat + 0.0005))) return;
      if (c.type === 'bld') nb++; else np++;
      keep.set(c.key, c);
    });
    W.structs.forEach((o, k) => { if (!keep.has(k)) { o.el.remove(); if (o.sau) { o.sau.el.remove(); o.sau.shadow.remove(); } W.structs.delete(k); } });
    keep.forEach((c, k) => {
      if (W.structs.has(k)) return;
      const m = MC.fromLngLat({ lng: c.lng, lat: c.lat }), el = div('al-e');
      const sp = div('al-sp' + (c.type === 'pad' && !W.moon ? ' mid' : ''), c.type === 'pad' ? (W.moon ? landerSVG() : padSVG()) : (W.moon ? moonBaseSVG : buildingSVG)(c.kind, W.pal.wall[c.kind % W.pal.wall.length]));
      el.appendChild(sp); W.layer.appendChild(el);
      const o = { key: k, type: c.type, mx: m.x, my: m.y, el, sx: 0, sy: 0, sc: 1, sau: null };
      if (c.type === 'bld' && W.hov) el.classList.add('hov');
      W.structs.set(k, o);
    });
  }
  // Platillos: cada plataforma tiene el suyo. Espera, llega desde arriba, aterriza, suelta visitantes, despega y se marcha.
  function newSaucer(W, pad) {
    const el = div('al-e'), sp = div('al-sp', saucerSVG()), shadow = div('al-e', '<div class="al-sp mid"><svg width="50" height="13" viewBox="0 0 50 13"><ellipse cx="25" cy="6.5" rx="23" ry="5.5" fill="rgba(0,0,0,.4)"/></svg></div>');
    el.appendChild(sp); el.style.display = 'none'; shadow.style.display = 'none'; W.layer.append(shadow, el);
    pad.sau = { el, sp, shadow, beam: sp.querySelector('.beam'), state: 'wait', t: rnd(1.2, 4), u: 0, dur: 4, a: 1, dir: 1 };
  }
  function stepSaucer(W, pad, dt) {
    const S = pad.sau;
    if (S.state === 'wait') {
      S.t -= dt;
      if (S.t <= 0) { S.state = 'in'; S.u = 0; S.dur = rnd(4, 5.2); S.dir = Math.random() < .5 ? -1 : 1; S.el.style.display = ''; S.shadow.style.display = ''; if (W.view && inView(W.view, pad.mx, pad.my, 0.15)) sfxAt(W, 'ufoIn', pad.sx, pad.sy); }
    } else if (S.state === 'in') {
      S.u += dt / S.dur; S.a = Math.pow(1 - Math.min(1, S.u), 2.2);
      if (S.u >= 1) {
        S.state = 'land'; S.t = rnd(7, 11); S.a = 0; S.land0 = S.t; if (W.view && inView(W.view, pad.mx, pad.my, 0.15)) sfxAt(W, 'thud', pad.sx, pad.sy);
        const n = Math.random() < .5 ? 1 : 2, vis = W.walkers.filter(q => q.visitor);
        for (let i = 0; i < n; i++) {
          if (vis.length + i >= 4) break;
          const q = makeEnt(W, 'alien', pad.mx + (i ? 10 : -6) * U, pad.my + 6 * U); q.visitor = true; q.tb = i ? 99 : 0.8; W.walkers.push(q);
          if (!i && Math.random() < .6) { q.tb = 99; setTimeout(() => { if (W.walkers.indexOf(q) >= 0) say(W, q, pick(ARRIVE), 'think'); }, 600); }
        }
      }
    } else if (S.state === 'land') {
      S.t -= dt; S.a = 0;
      if (S.t <= 0) { S.state = 'out'; S.u = 0; S.dur = rnd(3.2, 4); if (W.view && inView(W.view, pad.mx, pad.my, 0.15)) sfxAt(W, 'ufoOut', pad.sx, pad.sy); }
    } else {
      S.u += dt / S.dur; S.a = Math.min(1, S.u) * Math.min(1, S.u);
      if (S.u >= 1) { S.state = 'wait'; S.t = rnd(9, 20); S.el.style.display = 'none'; S.shadow.style.display = 'none'; S.a = 1; }
    }
    const beam = (S.state === 'in' && S.a < 0.28) || (S.state === 'out' && S.a < 0.22) || (S.state === 'land' && S.land0 - S.t < 2.6);
    S.beam.style.opacity = beam ? '.38' : '0';
  }
  function drawSaucer(W, pad, ts) {
    const S = pad.sau; if (S.state === 'wait') return;
    const a = S.a, k = 1 + a * 0.9, dx = S.dir * a * 330, dy = -a * 290 + 3 + (a > 0 ? Math.sin(ts * 0.005) * 1.5 : 0);
    S.el.style.transform = 'translate3d(' + pad.sx + 'px,' + pad.sy + 'px,0) scale(' + pad.sc + ')';
    S.sp.style.transform = 'translate(-50%,-100%) translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + k.toFixed(3) + ')';
    S.el.style.opacity = a > 0.8 ? clamp((1 - a) / 0.2, 0, 1) : 1;
    S.el.style.zIndex = a > 0.05 ? 9000 : Math.round(pad.sy) + 40;
    S.shadow.style.transform = 'translate3d(' + pad.sx + 'px,' + pad.sy + 'px,0) scale(' + (pad.sc * (1 - 0.35 * a)).toFixed(3) + ')';
    S.shadow.style.opacity = (1 - Math.min(1, a * 1.2)) * (a > 0.8 ? 0 : 1); S.shadow.style.zIndex = Math.round(pad.sy) + 1;
  }
  // Platillo que cruza la pantalla sin aterrizar
  function stepFly(W, dt, ts) {
    let F = W.fly;
    if (!F) {
      W.flyT -= dt; if (W.flyT > 0) return;
      const el = div('al-e', ''), sp = div(W.moon ? 'al-sp' : 'al-sp mid', W.moon ? roverSVG() : saucerSVG()); el.appendChild(sp); W.layer.appendChild(el);
      F = W.fly = { el, sp, u: 0, dur: W.moon ? rnd(12, 17) : rnd(8, 12), dir: Math.random() < .5 ? -1 : 1, y: W.moon ? rnd(0.5, 0.88) * W.h : rnd(0.14, 0.5) * W.h, ph: rnd(0, 6), said: false,
        pilot: { type: 'alien', sx: 0, sy: 0, sc: 1, h: 22, bub: null, vp: window.atlasVoice ? window.atlasVoice.profile(W.moon ? 'astro' : 'alien') : null } };   // el piloto habla desde el platillo (o el jeep)
      el.style.zIndex = W.moon ? Math.round(F.y) + 10 : 9500;
      if (W.moon) sp.style.transform = F.dir < 0 ? 'translate(-50%,-100%) scaleX(-1)' : 'translate(-50%,-100%)';
      if (window.atlasVoice) window.atlasVoice.sfx(W.moon ? 'rover' : 'ufoFly', { dur: F.dur, vol: 0.9, panFrom: F.dir > 0 ? -0.85 : 0.85, panTo: F.dir > 0 ? 0.85 : -0.85 });
    }
    F.u += dt / F.dur;
    if (F.u >= 1) { F.el.remove(); dropBubbleOf(W, F.pilot); W.fly = null; W.flyT = rnd(22, 40); return; }
    const x = F.dir > 0 ? -50 + (W.w + 100) * F.u : W.w + 50 - (W.w + 100) * F.u, y = F.y + (W.moon ? Math.sin(F.u * 60 + F.ph) * 0.8 : Math.sin(F.u * 7 + F.ph) * 12);
    F.pilot.sx = x; F.pilot.sy = y;
    if (!F.said && F.u > 0.22 && F.u < 0.7) {
      F.said = true;
      if (W.moon) { if (Math.random() < 0.8) { const nl = Math.random() < 0.45 ? namedLine(W, ['hi', 'wise', 'cash']) : null; say(W, F.pilot, nl ? nl.text : pick(ROVERSAY), 'say', 4, false, nl && nl.fx); } }
      else if (Math.random() < 0.7) say(W, F.pilot, pick(FLYSAY), 'say', 3.6);
    }
    F.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + (W.moon ? 1 : .85) + ') rotate(' + (W.moon ? 0 : (Math.sin(F.u * 7 + F.ph) * 5).toFixed(1)) + 'deg)';
  }

  // ---------- Bucle ----------
  let last = 0;
  function tick(W, dt, ts) {
    const map = W.map, z = map.getZoom();
    if (z < MIN_Z || !isOn()) { if (!W.off) { W.layer.classList.add('off'); W.off = true; W.bubbles.slice().forEach(b => dropBubble(W, b, true)); if (window.atlasVoice) window.atlasVoice.stop(); } return; }
    if (W.off) { W.layer.classList.remove('off'); W.off = false; W.sync = 0; W.viewT = 0; }
    W.viewT -= dt; if (W.viewT <= 0 || !W.view) { W.view = viewOf(W); W.viewT = 0.25; }
    const v = W.view, s = clamp(Math.pow(2, z - REF_Z), 0.45, 6);
    W.sync -= dt; if (W.sync <= 0) { W.sync = 0.7; syncStructures(W); }
    // población: se rellena sola y se recoloca dentro de la pantalla si te alejas de ella
    if (!W.ready) {
      W.ready = true;
      for (let i = 0; i < N_WALK; i++) { const p = randIn(v, 0.08); W.walkers.push(makeEnt(W, 'alien', p.x, p.y)); }
      for (let i = 0; i < (W.moon ? 0 : N_CRIT); i++) { const p = randIn(v, 0.05); W.critters.push(makeEnt(W, ['blob', 'bug', 'jelly'][i % 3], p.x, p.y)); }
    }
    for (let i = W.walkers.length - 1; i >= 0; i--) {   // los visitantes de los platillos se marchan al rato
      const e = W.walkers[i];
      if (e.visitor && performance.now() - e.born > 70000 && e.state !== 'talk') { e.dead = true; removeEnt(W, e); W.walkers.splice(i, 1); }
    }
    const all = W.walkers.concat(W.critters);
    all.forEach(e => {
      if (!inView(v, e.mx, e.my, 0.4)) { if (e.visitor) { e.dead = true; removeEnt(W, e); W.walkers.splice(W.walkers.indexOf(e), 1); return; } relocate(W, e, randIn(v, 0.06)); }
      stepEnt(W, e, dt, v);
    });
    if (!W.moon) W.structs.forEach(o => { if (o.type === 'pad') { if (!o.sau) newSaucer(W, o); stepSaucer(W, o, dt); } });   // en la Luna no hay platillos: los módulos de alunizaje se quedan en su plataforma
    stepFly(W, dt, ts);
    // dibujo
    const place = (o, extraZ) => {
      const p = map.project(llOf(o.mx, o.my)); o.sx = p.x; o.sy = p.y; o.sc = s;
      o.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
      o.el.style.zIndex = Math.round(p.y) + (extraZ || 0) + 10;
    };
    W.structs.forEach(o => { place(o, o.type === 'pad' && !W.moon ? -9 : 0); if (o.sau) drawSaucer(W, o, ts); });
    all.forEach(e => {
      if (e.dead) return;
      place(e);
      if (e.fdir !== e.dir) { e.fdir = e.dir; e.fl.style.transform = 'scaleX(' + e.dir + ')'; }
    });
    W.bubbles.slice().forEach(b => {
      b.t -= dt;
      const e = b.e;
      if (b.t <= 0 || e.sx < -30 || e.sx > W.w + 30 || e.sy < 0 || e.sy > W.h + 40) { dropBubble(W, b, false); return; }
      const bw = b.w || 100, x = clamp(e.sx, bw / 2 + 6, W.w - bw / 2 - 6), y = Math.max(78 + b.tail, e.sy - e.h * e.sc - b.tail);
      b.el.style.transform = 'translate(' + (x - bw / 2).toFixed(1) + 'px,' + y.toFixed(1) + 'px) translateY(-100%)';
    });
  }
  function frame(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
    let any = false;
    IDS.forEach(id => { const W = worlds[id]; if (W && !W.box.classList.contains('hidden')) { any = true; try { tick(W, dt, ts); } catch (e) { console.error('[aliens] ' + id, e); } } });
    if (any) requestAnimationFrame(frame); else setTimeout(() => requestAnimationFrame(frame), 400);
  }
  requestAnimationFrame(frame);

  // ---------- Saludo al llegar a un mundo ----------
  // Un habitante da la bienvenida al jugador por su nombre y, al terminar, otro le suelta algo gracioso (enfado, precios, hipoteca o una frase elocuente)
  function greet(id) {
    const W = worlds[id]; if (!W) return;
    let tries = 0;
    const go = () => {
      if (W.box.classList.contains('hidden') || !isOn()) return;
      if (!W.ready || !W.view || W.off) { if (++tries < 10) setTimeout(go, 700); return; }
      if (W.greetT && performance.now() - W.greetT < 15000) return;
      W.greetT = performance.now();
      const dist = e => Math.hypot(e.sx - W.w / 2, e.sy - W.h / 2);
      const vis = W.walkers.filter(e => !e.dead && e.sx > 40 && e.sx < W.w - 40 && e.sy > 110 && e.sy < W.h - 40).sort((a, b) => dist(a) - dist(b));
      let first = vis[0];
      if (!first) { first = W.walkers.find(e => !e.dead); if (!first) return; relocate(W, first, randIn(W.view, 0.28)); }
      const l1 = namedLine(W, ['hi']), d1 = Math.max(3.4, l1.text.length * 0.07 + 1.6);
      if (first.partner) { first.partner.partner = null; if (first.partner.state === 'talk') first.partner.state = 'idle'; first.partner = null; }
      W.hushUntil = performance.now() + d1 * 1000 + 9000;   // el saludo ocupa unos segundos: el resto se calla
      dropBubbleOf(W, first); first.state = 'idle'; first.t = d1 + 2;
      say(W, first, l1.text, 'say', d1, true, l1.fx);
      setTimeout(() => {   // la segunda frase: otro habitante (o el mismo) con su gracia
        if (W.box.classList.contains('hidden') || !isOn()) return;
        let second = vis.find(e => e !== first && !e.dead && W.walkers.indexOf(e) >= 0) || first;
        if (W.walkers.indexOf(second) < 0) return;
        const r = Math.random(), l2 = namedLine(W, r < 0.36 ? ['bad'] : r < 0.74 ? ['cash'] : ['wise']), d2 = Math.max(3.4, l2.text.length * 0.07 + 1.6);
        dropBubbleOf(W, second); if (second.state !== 'talk') { second.state = 'idle'; second.t = d2 + 1.5; }
        say(W, second, l2.text, 'say', d2, true, l2.fx);
      }, d1 * 1000 + 500);
    };
    setTimeout(go, 1200);
  }
  window.addEventListener('mundo:llegada', e => { try { greet(e.detail.id); } catch (err) { console.error('[aliens] saludo', err); } });
  window.alienGreet = id => { const k = id || Object.keys(worlds).find(k => !W_hidden(k)); if (k && worlds[k]) { worlds[k].greetT = 0; greet(k); } };

  // Para probar desde la consola
  window.alienSay = id => { const W = worlds[id || Object.keys(worlds).find(k => !W_hidden(k))]; if (!W) return; const e = W.walkers[0]; if (e) { dropBubbleOf(W, e); say(W, e, pick(W.moon ? MOON_THINK : THINK), 'think', 4, true); } };
  window.alienSaucer = id => { const W = worlds[id]; if (!W) return; W.structs.forEach(o => { if (o.sau && o.sau.state === 'wait') o.sau.t = 0; }); };
  function W_hidden(k) { const W = worlds[k]; return !W || W.box.classList.contains('hidden'); }
})();
