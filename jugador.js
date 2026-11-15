'use strict';
// MUÑECO DEL JUGADOR: cada jugador tiene el suyo (piel, pelo, peinado o gorra, camiseta y pantalón salen de su apodo, siempre igual para la misma persona)
// y lleva pegada en el pecho la bandera de su país. Siempre se dibuja DE FRENTE (nunca de perfil ni girado). Lo usan el cohete (la cabeza se ve por la ventanilla, el muñeco sube y baja por la rampa),
// el paracaidista (skydive.js) y, ya en tierra, el muñeco que se queda en el mapa y camina según el jugador lo mueve.
//   window.playerLook()            → { skin, hair, hs (peinado 0-4), shirt, pants }
//   window.playerFlag()            → emoji de la bandera del jugador ('' si no hay país)
//   window.playerBody({ suit })    → dibujo (sin <svg>) en un recuadro de 40 × 68; suit = traje de astronauta con pecera transparente
//   window.playerSVG({ suit })     → <svg> completo con ese dibujo (clases .face, .lg, .l1, .l2 para animar las piernas)
//   window.playerHead()            → solo cabeza y pelo (centro en 20,14), para la ventanilla del cohete
//   window.playerWalker.show(idDelMapa, { suit }) / .hide()  → muñeco fijo en el centro del mapa que camina cuando el mapa se mueve
(function () {
  const SKIN = ['#ffd9b3', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
  const HAIR = ['#2b1b10', '#4a2f1b', '#8b5a2b', '#d8b25a', '#b5392b', '#151515', '#9aa0a6'];
  const SHIRT = ['#ff9f1c', '#e63946', '#2a9d8f', '#4361ee', '#8338ec', '#06a77d', '#f72585', '#ffbe0b'];
  const PANTS = ['#2b3a67', '#1d3557', '#3d405b', '#5c4033', '#264653', '#444b55'];
  const EMOJI = "'Apple Color Emoji','Noto Color Emoji','Segoe UI Emoji',sans-serif";

  // Cuentas que cambiaron de apodo y conservan su aspecto de siempre (el aspecto sale del apodo): apodo nuevo → apodo con el que se generó
  const LOOK_ALIAS = {};   // (pendiente: cuando el administrador pase a llamarse Lodam → { lodam: 'redecora63' })
  const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

  // Nombre del jugador (su apodo); sin sesión, un código al azar que se guarda en el navegador para que su muñeco no cambie
  function seedText() {
    let n = '';
    try { n = (window.atlasPlayerName ? window.atlasPlayerName() : '') || (typeof nickOf === 'function' ? nickOf() : '') || (document.getElementById('name') || {}).value || ''; } catch (e) {}
    n = String(n).replace(/\s+/g, ' ').trim().toLowerCase();
    n = LOOK_ALIAS[n] || n;
    if (n) return 'n:' + n;
    let s = '';
    try { s = localStorage.getItem('playerSeed') || ''; if (!s) { s = Math.random().toString(36).slice(2, 10); localStorage.setItem('playerSeed', s); } } catch (e) { s = 'x'; }
    return 's:' + s;
  }
  let cacheKey = '', cache = null;
  window.playerLook = function () {
    const key = seedText();
    if (cache && key === cacheKey) return cache;
    const r = rng(fnv(key)), pick = a => a[Math.floor(r() * a.length)];
    cacheKey = key;
    cache = { skin: pick(SKIN), hair: pick(HAIR), hs: Math.floor(r() * 5), shirt: pick(SHIRT), pants: pick(PANTS) };
    return cache;
  };

  // Aspecto de otro jugador a partir de su apodo (o de un código): siempre el mismo para la misma persona
  window.playerLookFor = function (text) {
    const nn = String(text || '').trim().toLowerCase(), r = rng(fnv('n:' + (LOOK_ALIAS[nn] || nn))), pick = a => a[Math.floor(r() * a.length)];
    return { skin: pick(SKIN), hair: pick(HAIR), hs: Math.floor(r() * 5), shirt: pick(SHIRT), pants: pick(PANTS) };
  };
  window.flagOf = cc => /^[A-Za-z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '';

  // Bandera del país del jugador (la que eligió o detectó el juego); sin país no se pone ninguna
  window.playerFlag = function () {
    let c = ''; try { c = localStorage.getItem('country') || ''; } catch (e) {}
    if (!/^[A-Za-z]{2}$/.test(c)) { const sel = document.getElementById('country'); c = (sel && sel.value) || ''; }
    if (!/^[A-Za-z]{2}$/.test(c)) { const m = /[-_]([A-Za-z]{2})$/.exec((navigator.languages && navigator.languages[0]) || navigator.language || ''); c = m ? m[1] : ''; }   // sin país elegido: el del idioma del navegador
    return /^[A-Za-z]{2}$/.test(c) ? String.fromCodePoint(...[...c.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '';
  };

  // Cabeza y pelo VISTOS DE FRENTE (simétricos, centrados en (20,14)): orejas, cejas, ojos con iris y brillo, nariz, mejillas y sonrisa.
  // El pelo largo y el afro van detrás de la cara; la gorra, el moño y el flequillo, delante.
  function headParts(L, part) {   // part: 'back' = solo el pelo de detrás (se pinta antes del cuerpo), 'front' = lo demás; sin part, todo
    const h = L.hair, s = L.skin, hi = 'rgba(255,255,255,.2)';
    const back = L.hs === 1 ? `<path d="M10.2 13 Q10 4.4 20 4.4 Q30 4.4 29.8 13 L30.6 31 Q30.6 33.2 28.4 33.2 L11.6 33.2 Q9.4 33.2 9.4 31 Z" fill="${h}"/>`
      : L.hs === 4 ? `<circle cx="12.6" cy="9" r="4.9" fill="${h}"/><circle cx="20" cy="5.6" r="5.6" fill="${h}"/><circle cx="27.4" cy="9" r="4.9" fill="${h}"/><circle cx="10.3" cy="15" r="4" fill="${h}"/><circle cx="29.7" cy="15" r="4" fill="${h}"/>` : '';
    const ears = `<ellipse cx="12.1" cy="15.4" rx="1.7" ry="2.1" fill="${s}"/><ellipse cx="27.9" cy="15.4" rx="1.7" ry="2.1" fill="${s}"/><ellipse cx="12.3" cy="15.6" rx=".7" ry="1.1" fill="rgba(0,0,0,.14)"/><ellipse cx="27.7" cy="15.6" rx=".7" ry="1.1" fill="rgba(0,0,0,.14)"/>`;
    const face = `<ellipse cx="20" cy="14.3" rx="7.9" ry="8.3" fill="${s}"/><path d="M13 18.6 Q20 25.4 27 18.6 Q24 22.6 20 22.6 Q16 22.6 13 18.6Z" fill="rgba(0,0,0,.07)"/>`
      + `<circle cx="14.7" cy="18" r="1.6" fill="rgba(255,100,115,.22)"/><circle cx="25.3" cy="18" r="1.6" fill="rgba(255,100,115,.22)"/>`;
    const fringe = `<path d="M11.9 13.4 C11.2 6.6 15 4.6 20 4.6 C25 4.6 28.8 6.6 28.1 13.4 C26.8 10.4 24.2 9 20 9 C15.8 9 13.2 10.4 11.9 13.4Z" fill="${h}"/><path d="M14.5 6.6 Q18 4.8 21 5.2" stroke="${hi}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    const front = L.hs === 2 ? `<rect x="11.6" y="11.4" width="2.2" height="5" rx="1" fill="${h}"/><rect x="26.2" y="11.4" width="2.2" height="5" rx="1" fill="${h}"/>`
        + `<path d="M11 12 C11 5.2 15 3.4 20 3.4 C25 3.4 29 5.2 29 12 Z" fill="${L.shirt}"/><path d="M11 12 C11 5.2 15 3.4 20 3.4 C25 3.4 29 5.2 29 12 Z" fill="rgba(0,0,0,.12)"/>`
        + `<path d="M10 11.4 Q20 9 30 11.4 Q30 12.8 20 12.6 Q10 12.8 10 11.4Z" fill="${L.shirt}" stroke="rgba(0,0,0,.28)" stroke-width=".5"/><circle cx="20" cy="3.6" r="1.1" fill="${L.shirt}" stroke="rgba(0,0,0,.25)" stroke-width=".4"/>`
      : L.hs === 1 ? fringe + `<rect x="9.4" y="11" width="3.4" height="20" rx="1.7" fill="${h}"/><rect x="27.2" y="11" width="3.4" height="20" rx="1.7" fill="${h}"/>`
      : L.hs === 3 ? fringe + `<circle cx="20" cy="3.4" r="3.6" fill="${h}"/><rect x="18.4" y="5.6" width="3.2" height="1.4" rx=".7" fill="rgba(0,0,0,.3)"/>`
      : fringe;
    const brows = L.hs === 2 ? '' : `<path d="M13.8 11.7 Q16.4 10.3 18.8 11.4 M21.2 11.4 Q23.6 10.3 26.2 11.7" stroke="${h}" stroke-width="1.05" fill="none" stroke-linecap="round" opacity=".9"/>`;
    const eye = x => `<ellipse cx="${x}" cy="14.8" rx="1.9" ry="1.5" fill="#fff"/><circle cx="${x}" cy="14.9" r="1.05" fill="#3a2a1f"/><circle cx="${x}" cy="14.9" r=".5" fill="#111"/><circle cx="${x + .4}" cy="14.5" r=".32" fill="#fff"/>`;
    const feat = `${eye(16.7)}${eye(23.3)}<path d="M20 15.8 Q18.9 18.2 20.9 18.3" stroke="rgba(0,0,0,.3)" fill="none" stroke-width=".8" stroke-linecap="round"/><path d="M17.3 19.9 Q20 22.3 22.7 19.9" stroke="#8a3b3b" fill="none" stroke-width="1.15" stroke-linecap="round"/>`;
    if (part === 'back') return back;
    return (part === 'front' ? '' : back) + `${ears}${face}${front}${brows}${feat}`;
  }
  window.playerHead = () => headParts(window.playerLook());

  // Cuerpo completo (40 × 68) de FRENTE: piernas con zapatillas, torso con cuello en V y sombras, brazos que se balancean, cabeza y, en el pecho,
  // un parche con la bandera del jugador (más grande y a la altura del corazón).
  window.playerBody = function (o) {
    o = o || {};
    const L = o.look || window.playerLook(), flag = o.flag != null ? o.flag : window.playerFlag(), suit = !!o.suit;   // o.look / o.flag: dibujo de OTRO jugador (jugadores.js)
    const HI = 'rgba(255,255,255,.17)', SH = 'rgba(0,0,0,.15)';
    const leg = (cls, x, c, shoe) => `<g class="lg ${cls}"><rect x="${x}" y="42" width="6.4" height="21.6" rx="3.1" fill="${c}"/><rect x="${x}" y="42" width="2.2" height="21.6" rx="1.1" fill="${HI}"/><rect x="${x + 3.8}" y="44" width="2.6" height="19" rx="1.3" fill="${SH}"/>`
      + `<rect x="${x - 1.6}" y="60.4" width="9.6" height="5.8" rx="2.9" fill="${shoe}"/><rect x="${x - .6}" y="61" width="5.4" height="1.5" rx=".75" fill="rgba(255,255,255,.3)"/><rect x="${x - 1.6}" y="64.6" width="9.6" height="1.6" rx=".8" fill="rgba(0,0,0,.3)"/></g>`;
    const legs = (c, shoe) => leg('l1', 12.8, c, shoe) + leg('l2', 20.8, c, shoe);
    const patch = `<g class="flagp"><rect x="12.4" y="26.8" width="15.2" height="11" rx="2" fill="#fff" stroke="rgba(0,0,0,.32)" stroke-width=".6"/>${flag ? `<text x="20" y="35.7" text-anchor="middle" font-size="10.6" font-family="${EMOJI}">${flag}</text>` : ''}<rect x="12.4" y="26.8" width="15.2" height="3.6" rx="2" fill="rgba(255,255,255,.35)"/></g>`;
    const neck = `<rect x="17.2" y="19.4" width="5.6" height="5.4" rx="2" fill="${L.skin}"/><rect x="17.2" y="21.2" width="5.6" height="2.6" fill="rgba(0,0,0,.13)"/>`;
    if (suit) {
      return headParts(L, 'back') + `<rect x="5" y="22" width="9" height="20" rx="3" fill="#c9c9c9" stroke="#999" stroke-width=".8"/>${legs('#f4f4f4', '#7a7a7a')}`
        + `<rect x="11" y="22" width="18" height="22" rx="7" fill="#f4f4f4" stroke="#bdbdbd"/><rect x="6" y="24" width="5" height="16" rx="2.5" fill="#f4f4f4" stroke="#bdbdbd" stroke-width=".6"/><rect x="29" y="24" width="5" height="16" rx="2.5" fill="#f4f4f4" stroke="#bdbdbd" stroke-width=".6"/>`
        + `<rect x="11.5" y="40.6" width="17" height="3" rx="1.5" fill="${L.shirt}"/><circle cx="8.5" cy="41" r="2.8" fill="${L.shirt}"/><circle cx="31.5" cy="41" r="2.8" fill="${L.shirt}"/>${patch}`
        + headParts(L, 'front') + `<circle cx="20" cy="14" r="10.6" fill="rgba(210,235,255,.22)" stroke="#e6e6e6" stroke-width="1.6"/><path d="M13.6 8.6 A8.6 8.6 0 0 1 19 5.2" stroke="#fff" stroke-width="1.4" fill="none" opacity=".75" stroke-linecap="round"/>`;
    }
    const arm = (cls, x) => `<g class="lg ${cls}"><rect x="${x}" y="23.2" width="5.4" height="16.6" rx="2.7" fill="${L.shirt}"/><rect x="${x}" y="23.2" width="1.9" height="16.4" rx=".95" fill="${HI}"/><rect x="${x}" y="36.4" width="5.4" height="1.6" fill="rgba(0,0,0,.14)"/><circle cx="${x + 2.7}" cy="41.4" r="2.8" fill="${L.skin}"/></g>`;
    return headParts(L, 'back') + `${legs(L.pants, '#2a2a2e')}${neck}<rect x="11" y="22" width="18" height="22.4" rx="7" fill="${L.shirt}"/>`
      + `<rect x="12.2" y="24" width="3.2" height="17" rx="1.6" fill="${HI}"/><rect x="24.8" y="24" width="3.4" height="18" rx="1.7" fill="${SH}"/><rect x="11" y="41.2" width="18" height="3.2" rx="1.6" fill="rgba(0,0,0,.2)"/>`
      + `<path d="M16.2 22 Q20 28 23.8 22 Q20 23.6 16.2 22Z" fill="${L.skin}"/>`
      + `${arm('a1', 5.4)}${arm('a2', 29.2)}${patch}` + headParts(L, 'front');
  };
  // Aspecto del muñeco para las escenas de visita (casas y edificios, que dibujan a las personas con trozos de CSS):
  // mismos colores, mismo peinado y la misma bandera en el pecho que el muñeco del mapa.
  window.playerCssLook = function () {
    const L = window.playerLook();
    return { style: ['h-short', 'h-long', 'h-cap', 'h-bun', 'h-curly'][L.hs] || 'h-short', skin: L.skin, hair: L.hair, top: L.shirt, pants: L.pants, shoe: '#222', sleeve: '82%', dress: false, beard: false, glasses: false, flag: window.playerFlag() };
  };

  window.playerSVG = o => `<svg viewBox="0 0 40 68" aria-hidden="true"><g class="face">${window.playerBody(o)}</g></svg>`;

  const st = document.createElement('style');
  st.textContent = `
    .pw { position: absolute; left: 50%; top: 50%; width: 42px; height: 71px; margin: -71px 0 0 -21px; z-index: 3; pointer-events: none; transition: opacity .35s; animation: pwIn .4s ease-out both; }
    .pw svg { width: 100%; height: 100%; overflow: visible; display: block; filter: drop-shadow(0 3px 3px rgba(0,0,0,.4)); }
    .pw .pw-sh { position: absolute; left: 50%; bottom: -3px; width: 30px; height: 8px; margin-left: -15px; border-radius: 50%; background: rgba(0,0,0,.28); }
    .pw .face { transform-box: view-box; transform-origin: 20px 34px; }
    .pw .lg { transform-box: fill-box; transform-origin: 50% 0; }
    .pw.walking .l1 { animation: pwA .3s infinite alternate ease-in-out; }
    .pw.walking .l2 { animation: pwB .3s infinite alternate ease-in-out; }
    .pw.walking .a1 { animation: pwB .3s infinite alternate ease-in-out; }
    .pw.walking .a2 { animation: pwA .3s infinite alternate ease-in-out; }
    .pw.walking svg { animation: pwBob .3s infinite alternate; }
    @keyframes pwA { from { transform: rotate(-24deg); } to { transform: rotate(24deg); } }
    @keyframes pwB { from { transform: rotate(24deg); } to { transform: rotate(-24deg); } }
    @keyframes pwBob { from { transform: translateY(0); } to { transform: translateY(-2px); } }
    @keyframes pwIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }`;
  document.head.appendChild(st);
  const st2 = document.createElement('style');
  st2.textContent = `
    :is(#visita, #edif) .v-fig .flagp { left: 3px; top: 8px; width: 26px; height: 19px; border-radius: 4px; background: #fff; box-shadow: 0 0 0 1px #0004; display: grid; place-items: center; font-size: 15px; line-height: 1; font-family: ${EMOJI}; transform: scaleX(var(--fx, 1)); }
    :is(#visita, #edif) .v-fig.h-cap .hf { left: -2px; top: -3px; width: 32px; height: 14px; border-radius: 15px 15px 3px 3px; background: var(--top); }
    :is(#visita, #edif) .v-fig.h-cap .hf::after { content: ''; position: absolute; left: 18px; top: 10px; width: 18px; height: 5px; border-radius: 3px; background: var(--top); filter: brightness(.85); }`;
  document.head.appendChild(st2);

  // ---------- El muñeco que se queda en el mapa ----------
  // Está fijo en el centro del mapa (donde aterrizó) y camina mientras el mapa se mueve: mira hacia donde va el centro (si arrastras el mapa a la derecha, el suelo pasa
  // hacia la derecha y él camina hacia la izquierda). Se esconde cuando el mapa está muy alejado y con cada viaje en cohete (hide()).
  const MIN_ZOOM = { map: 11, mundo: 9, moon: 2.5 };
  let live = null;
  function mapFor(id) {
    try {
      if (id === 'map') return typeof gl !== 'undefined' ? gl : null;
      const m = /^mundo-map-(.+)$/.exec(id || ''); if (m) return (window.mundoMaps || {})[m[1]] || null;
      if (id === 'moon-map') return window.moonMap || null;
    } catch (e) {}
    return null;
  }
  function hide() {
    if (!live) return;
    try { live.off(); } catch (e) {}
    live.el.remove(); live = null;
  }
  function show(targetId, o) {
    hide();
    if (!window.Element || !Element.prototype.animate) return;
    const m = mapFor(targetId);
    const host = (m && m.getContainer && m.getContainer()) || document.getElementById(targetId || 'map');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'pw'; el.setAttribute('data-notranslate', '');
    el.innerHTML = '<i class="pw-sh"></i>' + window.playerSVG({ suit: !!(o && o.suit) });
    host.appendChild(el);
    let off = () => {};
    if (m && m.on && m.getCenter) {
      const minZ = MIN_ZOOM[targetId === 'map' ? 'map' : targetId === 'moon-map' ? 'moon' : 'mundo'];
      let last = m.getCenter(), t = 0, left = false;
      const zoomOk = () => { try { el.style.opacity = m.getZoom() >= minZ ? '' : '0'; } catch (e) {} };
      const onMove = () => {
        const c = m.getCenter();
        let dx = c.lng - last.lng; if (dx > 180) dx -= 360; else if (dx < -180) dx += 360;
        const dy = c.lat - last.lat; last = { lng: c.lng, lat: c.lat };
        if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return;
        if (Math.abs(dx) > 1e-10 && (left = dx < 0) !== el.classList.contains('left')) el.classList.toggle('left', left);
        el.classList.add('walking');
        clearTimeout(t); t = setTimeout(() => el.classList.remove('walking'), 240);
      };
      m.on('move', onMove); m.on('zoom', zoomOk); zoomOk();
      off = () => { clearTimeout(t); try { m.off('move', onMove); m.off('zoom', zoomOk); } catch (e) {} };
    }
    if (targetId === 'map' && m && m.easeTo) { const offAuto = autoWalk(m, el); const off0 = off; off = () => { offAuto(); off0(); }; }
    live = { el, off };
  }

  // ---------- Camina solo cuando estás quieto: SOLO POR LAS CARRETERAS ----------
  // Si el jugador no toca nada (ni mapa, ni teclas, ni botones) durante 5 s, su muñeco echa a andar solo SIGUIENDO LAS CALLES REALES (las mismas que usan coches y peatones:
  // window.roadRoute de vehicles.js), a velocidad constante y por el lado de la calzada; en los cruces sigue por la calle conectada. Nunca corta por parques, ríos
  // ni por encima de las casas: si no hay una calle a la vista cerca de él, se queda quieto. No se sale del círculo rojo de su barrio. Cualquier toque lo para al instante.
  // No anda mientras habla con un visitante, está en una escena (casa, edificio), hay un paseo o un viaje en marcha o el muñeco no se ve.
  // ENTRAR EN CASAS: al pasar junto a una casa (o bar / discoteca) de otro jugador puede entrar solo a visitarla (la escena de visita.js / edificios.js, con sus límites diarios):
  // como mucho una entrada cada 45 s, cada casa se decide una sola vez cada 10 min, y si la escena no se abre (límite diario) deja de probar 10 min.
  // Se desactiva con window.playerWalker.autoEnter(false) (se guarda en localStorage 'autoEnter').
  const IDLE_MS = 5000, SPEED = 32;   // píxeles de pantalla por segundo (parecido al de los visitantes)
  const REF_Z = 17;                   // zoom de referencia de roadRoute() (vehicles.js): sus puntos son píxeles de mundo a ese zoom (mercator de 256 px, como Leaflet)
  const WORLD = 256 * Math.pow(2, REF_Z);
  const MAX_JOIN = 150, MAX_REJOIN = 45, MIN_LEG = 160;   // px de pantalla: lo máximo que cruza para subirse a la calle (la 1ª vez / al seguir) y el trecho mínimo que merece la pena
  const ENTER_COOLDOWN = 45000, ENTER_GAP = 10 * 60 * 1000, ENTER_CHANCE = 0.5, ENTER_MARGIN = 36;
  const toW = (lng, lat) => {
    const la = Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180;
    return { x: (lng + 180) / 360 * WORLD, y: (0.5 - Math.log(Math.tan(Math.PI / 4 + la / 2)) / (2 * Math.PI)) * WORLD };
  };
  const fromW = (x, y) => ({ lng: x / WORLD * 360 - 180, lat: (2 * Math.atan(Math.exp((0.5 - y / WORLD) * 2 * Math.PI)) - Math.PI / 2) * 180 / Math.PI });
  const metros = (a, b, c, e) => {
    const R = 6371008.8, rad = Math.PI / 180, dLa = (c - a) * rad, dLo = (e - b) * rad;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  // Qué hay en una parcela (igual que paseo.js): casa / bar / discoteca; lo demás no se visita
  function placeType(p) {
    let h = ''; try { h = String(houseFor(p.id, p.house) || ''); } catch (e) { h = String(p.house || ''); }
    const k = h.split('/').pop().replace(/\.[a-z]+$/i, '').toLowerCase();
    if (/^(discoteca|sala-de-baile|sala-baile|salon-de-baile|salabaile)/.test(k)) return 'disco';
    if (/^(restaurante|cafe|cafeteria|bar|pizzeria)/.test(k)) return 'bar';
    if (/^(casa|pisos)/.test(k)) return 'casa';
    return null;
  }
  // Trayecto → { pts: [{x, y, cls}], cum, total } en píxeles de mundo
  function makeRoute(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, total: cum[cum.length - 1] };
  }

  function autoWalk(m, el) {
    let lastAct = Date.now(), walking = false, raf = 0, pending = 0, lastEnter = 0, noEnterUntil = 0;
    const seen = new Map();   // id de parcela → cuándo se decidió si entrar
    const sceneOpen = () => !!(document.getElementById('visita') || document.getElementById('edif'));
    const scaleNow = () => Math.pow(2, m.getZoom() + 1 - REF_Z);   // píxeles de pantalla por píxel de mundo (el zoom de MapLibre va 1 por debajo del de Leaflet)
    const myNick = () => { try { return String((window.atlasPlayerName && window.atlasPlayerName()) || '').trim().toLowerCase(); } catch (e) { return ''; } };
    const say = t => { try { if (typeof flashToast === 'function') flashToast(t); } catch (e) { /* nada */ } };
    const autoEnterOn = () => { try { return localStorage.getItem('autoEnter') !== '0'; } catch (e) { return true; } };
    const roads = on => { try { if (typeof map !== 'undefined' && map && map.setRoads) map.setRoads(on, 'w'); } catch (e) { /* sin calles */ } };   // enciende las calles mientras se pueda andar
    const roadHalf = cls => { try { return map.roadMetrics(cls).half; } catch (e) { return 8; } };   // mitad del ancho de la calzada en pantalla (px)
    const canWalk = () => {
      try {
        const b = document.body.classList;
        return !document.hidden && el.isConnected && el.style.opacity !== '0' && m.getZoom() >= 15   // las calles solo se cargan con el mapa cerca
          && !b.contains('en-mundo') && !b.contains('viajando')
          && !window.houseInside && !window.earthMuted && !window.fightMuted
          && !sceneOpen()
          && !(window.Visitantes && window.Visitantes.talking && window.Visitantes.talking())
          && !(window.paseo && window.paseo.running && window.paseo.running());
      } catch (e) { return false; }
    };
    function stopWalk() { walking = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    const act = () => { lastAct = Date.now(); if (walking) stopWalk(); };

    // Busca por dónde seguir: la calle más cercana al muñeco que tenga trecho por delante. Devuelve el trayecto (muñeco → calle → calle adelante) o null.
    function plan(maxJoin) {
      if (!window.roadRoute) return null;
      const c = m.getCenter(), cw = toW(c.lng, c.lat), sc = scaleNow();
      const br = window.barrio, r = br && br.radius && br.radius(), pos = br && br.pos && br.pos();
      const limit = !!(r && pos) && metros(c.lat, c.lng, pos.lat, pos.lng) <= r * 0.92;   // ya fuera del círculo rojo: no lo encierra, anda libre por las calles
      let best = null;
      for (let t = 0; t < 8; t++) {
        const rr = window.roadRoute({ inside: true, len: 900, minLen: 200 });
        if (!rr || !rr.path) continue;
        const P = rr.path;
        let bi = -1, bu = 0, bd = Infinity;
        for (let i = 0; i + 1 < P.pts.length; i++) {   // punto de la calle más cercano al muñeco
          const p0 = P.pts[i], p1 = P.pts[i + 1], dx = p1.x - p0.x, dy = p1.y - p0.y, l2 = dx * dx + dy * dy;
          const u = l2 ? Math.max(0, Math.min(1, ((cw.x - p0.x) * dx + (cw.y - p0.y) * dy) / l2)) : 0;
          const d = Math.hypot(p0.x + dx * u - cw.x, p0.y + dy * u - cw.y);
          if (d < bd) { bd = d; bi = i; bu = u; }
        }
        if (bi < 0 || bd * sc > maxJoin) continue;
        const p0 = P.pts[bi], p1 = P.pts[bi + 1], s0 = P.cum[bi] + (P.cum[bi + 1] - P.cum[bi]) * bu;
        const fwd = P.total - s0 >= s0;   // va hacia el lado de la calle donde queda más camino
        const pts = [{ x: cw.x, y: cw.y, cls: null }, { x: p0.x + (p1.x - p0.x) * bu, y: p0.y + (p1.y - p0.y) * bu, cls: P.cl && P.cl[bi + 1] }];
        if (fwd) for (let i = bi + 1; i < P.pts.length; i++) pts.push({ x: P.pts[i].x, y: P.pts[i].y, cls: P.cl && P.cl[i] });
        else for (let i = bi; i >= 0; i--) pts.push({ x: P.pts[i].x, y: P.pts[i].y, cls: P.cl && P.cl[i] });
        let keep = pts.length;
        if (limit) for (let i = 1; i < pts.length; i++) { const ll = fromW(pts[i].x, pts[i].y); if (metros(ll.lat, ll.lng, pos.lat, pos.lng) > r * 0.92) { keep = i; break; } }   // no se sale del barrio
        if (keep < 3) continue;
        const R = makeRoute(pts.slice(0, keep)), rem = (R.total - R.cum[1]) * sc;
        if (rem < MIN_LEG) continue;
        const score = rem - bd * sc * 3;   // mejor: mucho camino por delante y poco que cruzar para llegar a la calle
        if (!best || score > best.score) best = Object.assign(R, { score });
      }
      return best;
    }

    // Casa / bar / discoteca ajena junto a la que está pasando (el muñeco, en el centro de la pantalla, queda dentro de la parcela ampliada ENTER_MARGIN px)
    function houseNear() {
      if (typeof drawn === 'undefined' || typeof boundsOf !== 'function' || !window.visitaStart) return null;
      const me = myNick(), c = m.project(m.getCenter()), now = Date.now();
      let best = null;
      for (const ex of drawn.values()) {
        const p = ex && ex.p;
        if (!p || !p.owner || (p.world && p.world !== 'tierra') || String(p.owner).toLowerCase() === me) continue;
        if (now - (seen.get(p.id) || 0) < ENTER_GAP) continue;
        const t = placeType(p); if (!t) continue;
        const [[so, we], [no, ea]] = boundsOf(p.x, p.y), a = m.project([we, so]), b = m.project([ea, no]);
        const x0 = Math.min(a.x, b.x) - ENTER_MARGIN, x1 = Math.max(a.x, b.x) + ENTER_MARGIN, y0 = Math.min(a.y, b.y) - ENTER_MARGIN, y1 = Math.max(a.y, b.y) + ENTER_MARGIN;
        if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
        const d = Math.hypot(c.x - (a.x + b.x) / 2, c.y - (a.y + b.y) / 2);
        if (!best || d < best.d) best = { p, t, d };
      }
      return best;
    }
    function maybeEnter() {
      const now = Date.now();
      if (!autoEnterOn() || now < noEnterUntil || now - lastEnter < ENTER_COOLDOWN) return false;
      const h = houseNear(); if (!h) return false;
      seen.set(h.p.id, now);                       // esta casa ya está decidida (entre o no) durante 10 min
      if (Math.random() > ENTER_CHANCE) return false;
      lastEnter = now; pending = now; stopWalk();
      say(h.t === 'casa' ? '🏠 Voy a visitar la casa de ' + h.p.owner : h.t === 'bar' ? '🍹 Entro al bar de ' + h.p.owner : '💃 Entro a la discoteca de ' + h.p.owner);
      const p = { ...h.p, mine: false, giftable: true };
      if (h.t === 'casa') window.visitaStart(p); else if (window.edificioStart) window.edificioStart(p, h.t === 'bar' ? 'restaurante' : 'discoteca');
      return true;
    }

    // Va por el trayecto a velocidad constante moviendo el mapa bajo el muñeco (que está fijo en el centro), por el borde de la calzada
    function follow(R) {
      walking = true;
      let s = 0, seg = 0, off = 0, last = performance.now(), nextCheck = last + 800;
      const step = now => {
        if (!walking) return;
        const dt = Math.min((now - last) / 1000, 0.1); last = now;
        if (!canWalk()) { stopWalk(); lastAct = Date.now(); return; }
        const sc = scaleNow();
        s += SPEED / sc * dt;
        if (s >= R.total) {   // fin del trecho: sigue por la calle conectada (si no hay, espera otros 5 s)
          stopWalk();
          const N = plan(MAX_REJOIN);
          if (N) follow(N); else lastAct = Date.now();
          return;
        }
        while (seg < R.pts.length - 2 && R.cum[seg + 1] <= s) seg++;
        const a = R.pts[seg], b = R.pts[seg + 1], len = (R.cum[seg + 1] - R.cum[seg]) || 1, t = (s - R.cum[seg]) / len;
        const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, cls = b.cls || a.cls;
        const target = cls ? roadHalf(cls) * 0.55 : 0;                    // por la calzada, hacia el lado derecho de la marcha (px de pantalla)
        off += Math.max(-24 * dt, Math.min(24 * dt, target - off));       // cambia suave al pasar de una calle a otra
        const o = off / sc, ll = fromW(a.x + (b.x - a.x) * t - uy * o, a.y + (b.y - a.y) * t + ux * o);
        m.jumpTo({ center: [ll.lng, ll.lat] });
        if (now >= nextCheck) { nextCheck = now + 400; if (maybeEnter()) return; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    const timer = setInterval(() => {
      const now = Date.now(), ok = canWalk();
      roads(ok);
      if (pending && sceneOpen()) pending = 0;   // la escena sí se abrió
      if (walking) return;
      if (!ok || (m.isMoving && m.isMoving())) { lastAct = now; return; }   // si el mapa se mueve por otra causa (viaje, parcela tocada…), vuelve a contar los 5 s
      if (pending) {   // esperando a que se abra la escena de la casa: si no se abre (límite diario…), no insiste en 10 min
        if (now - pending > 9000) { pending = 0; noEnterUntil = now + 10 * 60 * 1000; } else { lastAct = now; return; }
      }
      if (now - lastAct >= IDLE_MS) { const R = plan(MAX_JOIN); if (R) follow(R); else lastAct = now; }
    }, 400);
    const ev = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    ev.forEach(n => document.addEventListener(n, act, { capture: true, passive: true }));
    return () => { clearInterval(timer); ev.forEach(n => document.removeEventListener(n, act, { capture: true })); stopWalk(); roads(false); };
  }
  window.playerWalker = { show, hide, el: () => (live ? live.el : null), autoEnter: on => { try { localStorage.setItem('autoEnter', on ? '1' : '0'); } catch (e) { /* nada */ } } };   // el(): el muñeco propio en el mapa (jugadores.js le pone los globos de charla)
})();
