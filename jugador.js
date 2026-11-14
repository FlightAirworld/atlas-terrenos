'use strict';
// MUÑECO DEL JUGADOR: cada jugador tiene el suyo (piel, pelo, peinado o gorra, camiseta y pantalón salen de su apodo, siempre igual para la misma persona)
// y lleva pegada en el pecho la bandera de su país. Lo usan el cohete (la cabeza se ve por la ventanilla, el muñeco sube y baja por la rampa),
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

  const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

  // Nombre del jugador (su apodo); sin sesión, un código al azar que se guarda en el navegador para que su muñeco no cambie
  function seedText() {
    let n = '';
    try { n = (window.atlasPlayerName ? window.atlasPlayerName() : '') || (typeof nickOf === 'function' ? nickOf() : '') || (document.getElementById('name') || {}).value || ''; } catch (e) {}
    n = String(n).replace(/\s+/g, ' ').trim().toLowerCase();
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

  // Bandera del país del jugador (la que eligió o detectó el juego); sin país no se pone ninguna
  window.playerFlag = function () {
    let c = ''; try { c = localStorage.getItem('country') || ''; } catch (e) {}
    if (!/^[A-Za-z]{2}$/.test(c)) { const sel = document.getElementById('country'); c = (sel && sel.value) || ''; }
    if (!/^[A-Za-z]{2}$/.test(c)) { const m = /[-_]([A-Za-z]{2})$/.exec((navigator.languages && navigator.languages[0]) || navigator.language || ''); c = m ? m[1] : ''; }   // sin país elegido: el del idioma del navegador
    return /^[A-Za-z]{2}$/.test(c) ? String.fromCodePoint(...[...c.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '';
  };

  // Cabeza y pelo, centrados en (20,14) y de perfil mirando a la derecha. El pelo largo y el afro van detrás de la cara.
  function headParts(L) {
    const h = L.hair;
    const back = L.hs === 1 ? `<rect x="10.2" y="8" width="19.6" height="21" rx="8.5" fill="${h}"/>`
      : L.hs === 4 ? `<circle cx="13.5" cy="9" r="4.2" fill="${h}"/><circle cx="20" cy="6.6" r="4.6" fill="${h}"/><circle cx="26.5" cy="9" r="4.2" fill="${h}"/><circle cx="11.4" cy="14.5" r="3.4" fill="${h}"/><circle cx="28.6" cy="14.5" r="3.4" fill="${h}"/>` : '';
    const top = `<path d="M11.8 13.8 A8.2 8.2 0 0 1 28.2 13.8 C25 10.4 15 10.4 11.8 13.8Z" fill="${h}"/>`;
    const front = L.hs === 2 ? `<path d="M11.5 13 A8.5 8.5 0 0 1 28.5 13 Z" fill="${L.shirt}"/><rect x="20" y="10.6" width="11" height="3" rx="1.5" fill="${L.shirt}" stroke="rgba(0,0,0,.25)" stroke-width=".5"/>`
      : L.hs === 3 ? top + `<circle cx="12.6" cy="6.8" r="3.6" fill="${h}"/>`
      : L.hs === 4 ? '' : top;
    const face = `<circle cx="18.6" cy="15.3" r="1.1" fill="#222"/><circle cx="23.6" cy="15.3" r="1.1" fill="#222"/><path d="M18.6 19.2 Q21.2 21.4 24.2 19.2" stroke="#8a4b2a" fill="none" stroke-width="1" stroke-linecap="round"/>`;
    return `${back}<circle cx="20" cy="14" r="8" fill="${L.skin}"/>${front}${face}`;
  }
  window.playerHead = () => headParts(window.playerLook());

  // Cuerpo completo (40 × 68): piernas, torso, brazos, cabeza y, en el pecho, un parche con la bandera del jugador
  window.playerBody = function (o) {
    o = o || {};
    const L = window.playerLook(), flag = window.playerFlag(), suit = !!o.suit;
    const legs = (c, shoe) => `<g class="lg l1"><rect x="13" y="42" width="6" height="22" rx="3" fill="${c}"/><rect x="11.5" y="61" width="9" height="5" rx="2.5" fill="${shoe}"/></g><g class="lg l2"><rect x="21" y="42" width="6" height="22" rx="3" fill="${c}"/><rect x="19.5" y="61" width="9" height="5" rx="2.5" fill="${shoe}"/></g>`;
    const patch = `<g class="flagp"><rect x="13" y="25" width="14" height="10.4" rx="1.8" fill="#fff" stroke="rgba(0,0,0,.28)" stroke-width=".6"/>${flag ? `<text x="20" y="33.3" text-anchor="middle" font-size="9.6" font-family="${EMOJI}">${flag}</text>` : ''}</g>`;
    if (suit) {
      return `<rect x="5" y="22" width="9" height="20" rx="3" fill="#c9c9c9" stroke="#999" stroke-width=".8"/>${legs('#f4f4f4', '#7a7a7a')}`
        + `<rect x="11" y="22" width="18" height="22" rx="7" fill="#f4f4f4" stroke="#bdbdbd"/><rect x="6" y="24" width="5" height="16" rx="2.5" fill="#f4f4f4" stroke="#bdbdbd" stroke-width=".6"/><rect x="29" y="24" width="5" height="16" rx="2.5" fill="#f4f4f4" stroke="#bdbdbd" stroke-width=".6"/>`
        + `<rect x="11.5" y="40.6" width="17" height="3" rx="1.5" fill="${L.shirt}"/><circle cx="8.5" cy="41" r="2.8" fill="${L.shirt}"/><circle cx="31.5" cy="41" r="2.8" fill="${L.shirt}"/>${patch}`
        + headParts(L) + `<circle cx="20" cy="14" r="10.6" fill="rgba(210,235,255,.22)" stroke="#e6e6e6" stroke-width="1.6"/><path d="M13.6 8.6 A8.6 8.6 0 0 1 19 5.2" stroke="#fff" stroke-width="1.4" fill="none" opacity=".75" stroke-linecap="round"/>`;
    }
    return `${legs(L.pants, '#222')}<rect x="11" y="22" width="18" height="22" rx="7" fill="${L.shirt}"/><rect x="6" y="24" width="5" height="16" rx="2.5" fill="${L.shirt}"/><rect x="29" y="24" width="5" height="16" rx="2.5" fill="${L.shirt}"/>`
      + `<circle cx="8.5" cy="41" r="2.6" fill="${L.skin}"/><circle cx="31.5" cy="41" r="2.6" fill="${L.skin}"/>${patch}` + headParts(L);
  };
  window.playerSVG = o => `<svg viewBox="0 0 40 68" aria-hidden="true"><g class="face">${window.playerBody(o)}</g></svg>`;

  const st = document.createElement('style');
  st.textContent = `
    .left .flagp { transform-box: fill-box; transform-origin: 50% 50%; transform: scaleX(-1); }   /* la bandera no se ve al revés cuando el muñeco mira a la izquierda */
    .pw { position: absolute; left: 50%; top: 50%; width: 42px; height: 71px; margin: -71px 0 0 -21px; z-index: 3; pointer-events: none; transition: opacity .35s; animation: pwIn .4s ease-out both; }
    .pw svg { width: 100%; height: 100%; overflow: visible; display: block; filter: drop-shadow(0 3px 3px rgba(0,0,0,.4)); }
    .pw .pw-sh { position: absolute; left: 50%; bottom: -3px; width: 30px; height: 8px; margin-left: -15px; border-radius: 50%; background: rgba(0,0,0,.28); }
    .pw .face { transform-box: view-box; transform-origin: 20px 34px; }
    .pw.left .face { transform: scaleX(-1); }
    .pw .lg { transform-box: fill-box; transform-origin: 50% 0; }
    .pw.walking .l1 { animation: pwA .3s infinite alternate ease-in-out; }
    .pw.walking .l2 { animation: pwB .3s infinite alternate ease-in-out; }
    .pw.walking svg { animation: pwBob .3s infinite alternate; }
    @keyframes pwA { from { transform: rotate(-26deg); } to { transform: rotate(26deg); } }
    @keyframes pwB { from { transform: rotate(26deg); } to { transform: rotate(-26deg); } }
    @keyframes pwBob { from { transform: translateY(0); } to { transform: translateY(-2px); } }
    @keyframes pwIn { from { opacity: 0; transform: scale(.7); } to { opacity: 1; transform: none; } }`;
  document.head.appendChild(st);

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
    live = { el, off };
  }
  window.playerWalker = { show, hide };
})();
