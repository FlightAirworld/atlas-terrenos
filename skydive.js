'use strict';
// Paracaidista: una avioneta cruza la pantalla, el muñeco del jugador (el suyo, con su bandera en el pecho) salta de ella, cae unos instantes, abre el paracaídas,
// baja despacio hasta el centro de un mapa, lo recoge y grita al tocar tierra. Al aterrizar el muñeco se queda en el mapa y camina según se mueve el mapa (jugador.js).
// window.skydive(ms, opts) → Promise que se resuelve al aterrizar. opts: { target: id del mapa (por defecto 'map'), suit: traje de astronauta,
// scream: sonido del grito ('grito' | 'grito2'), shout: texto del globo, startY: y (px) desde donde sale (si se da, p. ej. desde un cohete, no hay avioneta),
// plane: false para saltar sin avioneta }.
(function () {
  const H = 160;                                   // alto del dibujo en px
  const st = document.createElement('style');
  st.textContent = `
    #skydiver { position: fixed; left: 50%; width: 110px; height: ${H}px; margin-left: -55px; z-index: 1950; pointer-events: none; transform-origin: 50% 100%; will-change: transform; }
    #skydiver .sway { position: relative; width: 100%; height: 100%; transform-origin: 50% 30%; }
    #skydiver svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 6px 6px rgba(0,0,0,.35)); }
    #skydiver .canopy { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .9s ease-in, opacity .9s ease-in; }
    #skydiver.landed .canopy { transform: translateY(70px) scaleY(.15) scaleX(1.25); opacity: 0; }
    #skydiver .lines { transform-box: fill-box; transform-origin: 50% 100%; transition: opacity .4s; }
    #skyplane { position: fixed; left: 0; top: 0; z-index: 1949; pointer-events: none; will-change: transform; }
    #skyplane svg { width: 100%; height: auto; display: block; overflow: visible; filter: drop-shadow(0 6px 6px rgba(0,0,0,.35)); }
    #skyplane .prop { transform-box: fill-box; transform-origin: 50% 50%; animation: skyProp .08s linear infinite alternate; }
    @keyframes skyProp { from { transform: scaleY(1); } to { transform: scaleY(.3); } }
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
  // El paracaidista es el muñeco del jugador (40 × 68) colgado bajo el paracaídas; el astronauta lleva el traje con pecera
  const person = suit => `<g transform="translate(35 92)">${window.playerBody ? window.playerBody({ suit }) : ''}</g>`;
  // Avioneta de ala alta vista de lado, mirando a la derecha (la hélice gira)
  const PLANE = `<svg viewBox="0 0 170 70" aria-hidden="true">
    <path d="M22 33 L8 8 L30 26Z" fill="#e63946" stroke="#9d1f2a" stroke-width="1"/><path d="M16 38 L2 42 L26 40Z" fill="#c1121f"/>
    <path d="M12 36 C12 25 40 23 100 23 C130 23 148 29 150 37 C148 45 130 49 100 49 C40 49 12 46 12 36Z" fill="#f5f5f5" stroke="#b8bfca" stroke-width="1.5"/>
    <path d="M16 40 C40 42 112 42 146 40" stroke="#e63946" stroke-width="4" fill="none"/>
    <path d="M100 27 L120 27 Q130 29 134 36 L100 36Z" fill="#8fd0ff" stroke="#5a7ca0"/><rect x="58" y="28" width="13" height="9" rx="2" fill="#8fd0ff" stroke="#5a7ca0"/>
    <rect x="76" y="27" width="19" height="20" rx="2" fill="#dfe4ec" stroke="#9aa4b5"/><circle cx="91" cy="37" r="1.3" fill="#586074"/>
    <path d="M52 22 L140 22 L136 14 L58 14Z" fill="#e63946" stroke="#9d1f2a" stroke-width="1"/>
    <path d="M84 23 L74 43 M114 23 L122 44" stroke="#9aa4b5" stroke-width="2.2" fill="none"/>
    <path d="M110 48 L114 58" stroke="#555" stroke-width="2.4"/><circle cx="114" cy="60" r="5" fill="#333" stroke="#999" stroke-width="1.2"/>
    <circle cx="150" cy="37" r="4.6" fill="#e63946"/><ellipse class="prop" cx="153" cy="37" rx="2.4" ry="17" fill="rgba(60,60,60,.55)"/>
  </svg>`;

  let busy = false;
  window.skydive = function (ms, opts) {
    opts = opts || {};
    const noMusic = () => { if (window.stopMusic) window.stopMusic(); return Promise.resolve(); };   // sin animación no hay caída: la música no se queda sonando
    if (busy || !window.Element || !Element.prototype.animate) return noMusic();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return noMusic();
    const mapEl = document.getElementById(opts.target || 'map');
    if (!mapEl) return noMusic();
    busy = true;
    try { if (window.playerWalker) window.playerWalker.hide(); } catch (e) {}   // si ya había un muñeco en el mapa, se va al saltar de nuevo
    return new Promise(resolve => {
      const r = mapEl.getBoundingClientRect();
      const feetY = r.top + r.height / 2;            // el vuelo termina centrado en el punto de destino
      const finalTop = feetY - H;
      const L = window.playerLook ? window.playerLook() : null;
      const chute = opts.suit ? ['#ff7b00', '#a34d00'] : [L ? L.shirt : '#e63946', 'rgba(0,0,0,.38)'];   // el paracaídas lleva el color de la camiseta del jugador
      const planeOn = opts.startY == null && opts.plane !== false && !opts.suit;   // desde un cohete (startY) o con traje no hay avioneta
      const startTop = opts.startY != null ? opts.startY : -(H + 40);
      const el = document.createElement('div');
      el.id = 'skydiver'; if (opts.suit) el.classList.add('suit');
      el.style.top = finalTop + 'px';
      const svg = '<svg viewBox="0 0 110 160" aria-hidden="true">' + canopy(chute[0], chute[1]) + person(!!opts.suit) + '</svg>';
      el.innerHTML = '<div class="sway">' + svg + '<div class="shout"></div></div>';
      el.querySelector('.shout').textContent = opts.shout || (opts.suit ? '¡Yujuuu!' : '¡Aaaaah!');
      document.body.appendChild(el);

      let dur, fall, sway, canopyAnims = [], plane = null;
      if (!planeOn) {
        sway = el.querySelector('.sway').animate(
          [{ transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }],
          { duration: 1700, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
        dur = Math.max(6000, (ms || 7000) + 2000);   // baja despacio: aterriza un poco después de que el mapa llegue
        fall = el.animate(
          [{ transform: `translateY(${startTop - finalTop}px) scale(.55)` }, { transform: 'translateY(0) scale(1)' }],
          { duration: dur, easing: 'cubic-bezier(.3,.35,.55,1)', fill: 'forwards' });
      } else {
        // La avioneta cruza la pantalla; a los TJ ms el muñeco salta de ella, cae FREE ms con el paracaídas cerrado, lo abre y baja planeando hasta el centro del mapa
        const W = innerWidth, TJ = 1500, FREE = 1000, PLANE_MS = 4600;
        const dirx = Math.random() < 0.5 ? 1 : -1, pw = Math.round(Math.min(170, Math.max(120, W * 0.4)));
        const planeY = Math.max(r.top + 70, 78);
        const x0 = dirx > 0 ? -pw - 20 : W + 20, x1 = dirx > 0 ? W + 20 : -pw - 20;
        plane = document.createElement('div');
        plane.id = 'skyplane'; plane.style.width = pw + 'px'; plane.style.top = planeY + 'px';
        plane.innerHTML = PLANE; if (dirx < 0) plane.firstElementChild.style.transform = 'scaleX(-1)';
        document.body.appendChild(plane);
        plane.animate([{ transform: `translate(${x0}px, 0)` }, { transform: `translate(${(x0 + x1) / 2}px, -7px)`, offset: 0.5 }, { transform: `translate(${x1}px, 0)` }],
          { duration: PLANE_MS, easing: 'linear', fill: 'both' });
        setTimeout(() => { if (plane) plane.remove(); }, PLANE_MS + 300);
        const jx = x0 + (x1 - x0) * (TJ / PLANE_MS) + pw / 2 - W / 2;      // de la puerta de la avioneta, medido desde el centro de la pantalla
        const jy = planeY + pw * 0.42 - finalTop - H;                       // con los pies justo bajo la avioneta
        dur = Math.max(5200, (ms || 7000) + 2000 - TJ);
        const open = TJ + FREE;
        el.style.visibility = 'hidden'; setTimeout(() => { el.style.visibility = ''; }, TJ);   // dentro de la avioneta hasta que salta
        fall = el.animate([
          { transform: `translate(${jx}px, ${jy}px) scale(.6)`, easing: 'cubic-bezier(.45,0,.95,.6)' },
          { transform: `translate(${jx * 0.75}px, ${jy * 0.66}px) scale(.72)`, offset: FREE / dur, easing: 'cubic-bezier(.15,.55,.35,1)' },
          { transform: 'translate(0, 0) scale(1)' }
        ], { delay: TJ, duration: dur, fill: 'both' });
        canopyAnims = [...el.querySelectorAll('.canopy, .lines')].map(p => p.animate(      // el paracaídas se abre de golpe al terminar la caída libre
          [{ transform: 'scale(.08)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }],
          { delay: open, duration: 520, easing: 'ease-out', fill: 'both' }));
        sway = el.querySelector('.sway').animate([{ transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }],
          { delay: open, duration: 1700, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
        setTimeout(() => { if (window.sfx) window.sfx('retro'); }, open);   // «¡fuum!» al abrirse
      }
      fall.onfinish = function () {
        sway.cancel(); canopyAnims.forEach(a => a.cancel());
        el.classList.add('landed');
        if (window.stopMusic) window.stopMusic();   // la música dura lo que dura la caída
        try { if (window.rocketEngine) window.rocketEngine.stop(); } catch (e) {}   // y el motor del cohete también se apaga al tocar suelo
        if (window.sfx) window.sfx(opts.scream || 'grito');
        try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) {}
        setTimeout(function () {
          el.classList.add('bye');
          // ya en tierra, el muñeco del jugador se queda en el mapa: camina según el jugador mueve el mapa
          try { if (window.playerWalker) window.playerWalker.show(opts.target || 'map', { suit: !!opts.suit }); } catch (e) {}
        }, 2600);
        setTimeout(function () { el.remove(); if (plane) plane.remove(); busy = false; resolve(); }, 3500);
      };
    });
  };
})();
