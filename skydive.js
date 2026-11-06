'use strict';
// Paracaidista: al pulsar "Jugar" un muñeco baja despacio en paracaídas hasta el centro del mapa (donde aterriza el vuelo, o sea la ubicación
// del jugador), recoge el paracaídas y pega un grito al tocar tierra. window.skydive(ms) lo lanza; lo llama introFlight() de app.js.
(function () {
  const H = 160;                                   // alto del dibujo en px
  const st = document.createElement('style');
  st.textContent = `
    #skydiver { position: fixed; left: 50%; width: 110px; height: ${H}px; margin-left: -55px; z-index: 1500; pointer-events: none; transform-origin: 50% 100%; will-change: transform; }
    #skydiver .sway { position: relative; width: 100%; height: 100%; transform-origin: 50% 30%; }
    #skydiver svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 6px 6px rgba(0,0,0,.35)); }
    #skydiver .canopy { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .9s ease-in, opacity .9s ease-in; }
    #skydiver.landed .canopy { transform: translateY(70px) scaleY(.15) scaleX(1.25); opacity: 0; }
    #skydiver .lines { transition: opacity .4s; }
    #skydiver.landed .lines { opacity: 0; }
    #skydiver .shout { position: absolute; left: 50%; top: 52px; transform: translate(-50%, 0) scale(.3); opacity: 0; background: #fff; color: #d62839; font: 900 20px/1 system-ui, sans-serif; padding: 8px 12px; border-radius: 16px; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,.35); transition: transform .25s cubic-bezier(.3,1.6,.5,1), opacity .2s; }
    #skydiver.landed .shout { transform: translate(-50%, 0) scale(1); opacity: 1; }
    #skydiver.bye { opacity: 0; transition: opacity .8s; }`;
  document.head.appendChild(st);

  const SVG = `
  <svg viewBox="0 0 110 160" aria-hidden="true">
    <g class="canopy">
      <path d="M4 52 C4 14 30 2 55 2 C80 2 106 14 106 52 Q92 42 80.5 52 Q68 42 55 52 Q42 42 29.5 52 Q16 42 4 52 Z" fill="#e63946" stroke="#9d1f2a" stroke-width="1.5"/>
      <path d="M55 2 C47 14 44 34 42 48 Q48 44 55 52 Q62 44 68 48 C66 34 63 14 55 2 Z" fill="#fff"/>
    </g>
    <g class="lines" stroke="#fff" stroke-opacity=".85" stroke-width="1">
      <path d="M4 52 L52 108 M29.5 52 L53 108 M55 52 L55 108 M80.5 52 L57 108 M106 52 L58 108" fill="none"/>
    </g>
    <path d="M50 124 L45 107 M60 124 L65 107" stroke="#ffd9b3" stroke-width="4" stroke-linecap="round"/>
    <rect x="49" y="119" width="12" height="21" rx="5" fill="#ff9f1c"/>
    <path d="M52 138 L49 154 M58 138 L61 154" stroke="#2b3a67" stroke-width="5" stroke-linecap="round"/>
    <circle cx="48.5" cy="156" r="3.2" fill="#222"/><circle cx="61.5" cy="156" r="3.2" fill="#222"/>
    <circle cx="55" cy="112" r="7" fill="#ffd9b3"/>
    <path d="M47.5 111 A7.5 7.5 0 0 1 62.5 111 Z" fill="#2b6cff"/>
  </svg>
  <div class="shout">¡Aaaaah!</div>`;

  let busy = false;
  window.skydive = function (ms) {
    const noMusic = () => { if (window.stopMusic) window.stopMusic(); };   // sin animación no hay caída: la música no se queda sonando
    if (busy || !window.Element || !Element.prototype.animate) return noMusic();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return noMusic();
    const mapEl = document.getElementById('map');
    if (!mapEl) return noMusic();
    busy = true;
    const r = mapEl.getBoundingClientRect();
    const feetY = r.top + r.height / 2;            // el vuelo termina centrado en la ubicación del jugador
    const el = document.createElement('div');
    el.id = 'skydiver';
    el.style.top = (feetY - H) + 'px';
    el.innerHTML = '<div class="sway">' + SVG + '</div>';
    document.body.appendChild(el);
    const sway = el.querySelector('.sway').animate(
      [{ transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }],
      { duration: 1700, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    const dur = Math.max(6000, (ms || 7000) + 2000);   // baja despacio: aterriza un poco después de que el mapa llegue
    const fall = el.animate(
      [{ transform: `translateY(${-(feetY + 40)}px) scale(.55)` }, { transform: 'translateY(0) scale(1)' }],
      { duration: dur, easing: 'cubic-bezier(.3,.35,.55,1)', fill: 'forwards' });
    fall.onfinish = function () {
      sway.cancel();
      el.classList.add('landed');
      if (window.stopMusic) window.stopMusic();   // la música dura lo que dura la caída
      if (window.sfx) window.sfx('grito');
      try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) {}
      setTimeout(function () { el.classList.add('bye'); }, 2600);
      setTimeout(function () { el.remove(); busy = false; }, 3500);
    };
  };
})();
