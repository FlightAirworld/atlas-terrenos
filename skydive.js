'use strict';
// Paracaidista: un muñeco baja despacio en paracaídas hasta el centro de un mapa, recoge el paracaídas y grita al tocar tierra.
// window.skydive(ms, opts) → Promise que se resuelve al aterrizar. opts: { target: id del mapa (por defecto 'map'), suit: traje de astronauta,
// scream: sonido del grito ('grito' | 'grito2'), shout: texto del globo, startY: y (px) desde donde sale (por defecto, arriba del todo) }.
(function () {
  const H = 160;                                   // alto del dibujo en px
  const st = document.createElement('style');
  st.textContent = `
    #skydiver { position: fixed; left: 50%; width: 110px; height: ${H}px; margin-left: -55px; z-index: 1950; pointer-events: none; transform-origin: 50% 100%; will-change: transform; }
    #skydiver .sway { position: relative; width: 100%; height: 100%; transform-origin: 50% 30%; }
    #skydiver svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 6px 6px rgba(0,0,0,.35)); }
    #skydiver .canopy { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .9s ease-in, opacity .9s ease-in; }
    #skydiver.landed .canopy { transform: translateY(70px) scaleY(.15) scaleX(1.25); opacity: 0; }
    #skydiver .lines { transition: opacity .4s; }
    #skydiver.landed .lines { opacity: 0; }
    #skydiver .shout { position: absolute; left: 50%; top: 52px; transform: translate(-50%, 0) scale(.3); opacity: 0; background: #fff; color: #d62839; font: 900 20px/1 system-ui, sans-serif; padding: 8px 12px; border-radius: 16px; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,.35); transition: transform .25s cubic-bezier(.3,1.6,.5,1), opacity .2s; }
    #skydiver.suit .shout { color: #1b3fa0; }
    #skydiver.landed .shout { transform: translate(-50%, 0) scale(1); opacity: 1; }
    #skydiver.bye { opacity: 0; transition: opacity .8s; }`;
  document.head.appendChild(st);

  function canopy(main, dark) {
    return `<g class="canopy">
      <path d="M4 52 C4 14 30 2 55 2 C80 2 106 14 106 52 Q92 42 80.5 52 Q68 42 55 52 Q42 42 29.5 52 Q16 42 4 52 Z" fill="${main}" stroke="${dark}" stroke-width="1.5"/>
      <path d="M55 2 C47 14 44 34 42 48 Q48 44 55 52 Q62 44 68 48 C66 34 63 14 55 2 Z" fill="#fff"/>
    </g>
    <g class="lines" stroke="#fff" stroke-opacity=".85" stroke-width="1"><path d="M4 52 L52 108 M29.5 52 L53 108 M55 52 L55 108 M80.5 52 L57 108 M106 52 L58 108" fill="none"/></g>`;
  }
  const PERSON = `
    <path d="M50 124 L45 107 M60 124 L65 107" stroke="#ffd9b3" stroke-width="4" stroke-linecap="round"/>
    <rect x="49" y="119" width="12" height="21" rx="5" fill="#ff9f1c"/>
    <path d="M52 138 L49 154 M58 138 L61 154" stroke="#2b3a67" stroke-width="5" stroke-linecap="round"/>
    <circle cx="48.5" cy="156" r="3.2" fill="#222"/><circle cx="61.5" cy="156" r="3.2" fill="#222"/>
    <circle cx="55" cy="112" r="7" fill="#ffd9b3"/>
    <path d="M47.5 111 A7.5 7.5 0 0 1 62.5 111 Z" fill="#2b6cff"/>`;
  const ASTRONAUT = `
    <rect x="42" y="119" width="7" height="20" rx="2" fill="#c9c9c9" stroke="#999" stroke-width=".8"/>
    <path d="M49 124 L44 107 M61 124 L66 107" stroke="#f4f4f4" stroke-width="6" stroke-linecap="round"/>
    <circle cx="44" cy="106" r="3.2" fill="#ff9f1c"/><circle cx="66" cy="106" r="3.2" fill="#ff9f1c"/>
    <rect x="48" y="118" width="14" height="23" rx="6" fill="#f4f4f4" stroke="#bdbdbd" stroke-width="1"/>
    <rect x="51.5" y="124" width="7" height="6" rx="1.5" fill="#e63946"/><circle cx="55" cy="134" r="1.6" fill="#2b6cff"/>
    <path d="M51.5 139 L49 153 M58.5 139 L61 153" stroke="#f4f4f4" stroke-width="6.5" stroke-linecap="round"/>
    <rect x="44" y="151" width="9" height="7" rx="3" fill="#7a7a7a"/><rect x="57" y="151" width="9" height="7" rx="3" fill="#7a7a7a"/>
    <circle cx="55" cy="111" r="9.5" fill="#f4f4f4" stroke="#bdbdbd" stroke-width="1"/>
    <ellipse cx="56" cy="111" rx="6.2" ry="5.2" fill="#1d2b53"/><ellipse cx="58" cy="109" rx="2.2" ry="1.4" fill="#fff" opacity=".7"/>
    <path d="M62 103 L66 96" stroke="#bdbdbd" stroke-width="1.2"/><circle cx="66.3" cy="95.5" r="1.3" fill="#e63946"/>`;

  let busy = false;
  window.skydive = function (ms, opts) {
    opts = opts || {};
    const noMusic = () => { if (window.stopMusic) window.stopMusic(); return Promise.resolve(); };   // sin animación no hay caída: la música no se queda sonando
    if (busy || !window.Element || !Element.prototype.animate) return noMusic();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return noMusic();
    const mapEl = document.getElementById(opts.target || 'map');
    if (!mapEl) return noMusic();
    busy = true;
    return new Promise(resolve => {
      const r = mapEl.getBoundingClientRect();
      const feetY = r.top + r.height / 2;            // el vuelo termina centrado en el punto de destino
      const finalTop = feetY - H;
      const startTop = opts.startY != null ? opts.startY : -(H + 40);
      const el = document.createElement('div');
      el.id = 'skydiver'; if (opts.suit) el.classList.add('suit');
      el.style.top = finalTop + 'px';
      const svg = '<svg viewBox="0 0 110 160" aria-hidden="true">' + (opts.suit ? canopy('#ff7b00', '#a34d00') + ASTRONAUT : canopy('#e63946', '#9d1f2a') + PERSON) + '</svg>';
      el.innerHTML = '<div class="sway">' + svg + '<div class="shout"></div></div>';
      el.querySelector('.shout').textContent = opts.shout || (opts.suit ? '¡Yujuuu!' : '¡Aaaaah!');
      document.body.appendChild(el);
      const sway = el.querySelector('.sway').animate(
        [{ transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }],
        { duration: 1700, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
      const dur = Math.max(6000, (ms || 7000) + 2000);   // baja despacio: aterriza un poco después de que el mapa llegue
      const fall = el.animate(
        [{ transform: `translateY(${startTop - finalTop}px) scale(.55)` }, { transform: 'translateY(0) scale(1)' }],
        { duration: dur, easing: 'cubic-bezier(.3,.35,.55,1)', fill: 'forwards' });
      fall.onfinish = function () {
        sway.cancel();
        el.classList.add('landed');
        if (window.stopMusic) window.stopMusic();   // la música dura lo que dura la caída
        if (window.sfx) window.sfx(opts.scream || 'grito');
        try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) {}
        setTimeout(function () { el.classList.add('bye'); }, 2600);
        setTimeout(function () { el.remove(); busy = false; resolve(); }, 3500);
      };
    });
  };
})();
