'use strict';
// Viajes en cohete. window.rocketLaunch('tierra' | 'luna') → Promise: pantalla de despegue con cuenta atrás y sonido; se resuelve cuando el cohete
// ya se ha ido y la pantalla empieza a desvanecerse. window.rocketDrop({ target, suit }) → Promise: el cohete llega arriba, el muñeco salta en
// paracaídas (con traje de astronauta si suit) y la promesa se resuelve cuando aterriza y grita.
(function () {
  const st = document.createElement('style');
  st.textContent = `
    #viaje { position: fixed; inset: 0; z-index: 2300; overflow: hidden; background: #000; transition: opacity .8s; }
    #viaje.fade { opacity: 0; }
    #viaje .sky { position: absolute; inset: 0; background: linear-gradient(#4d9be6 0%, #8ccbff 65%, #d8f0ff 100%); transition: opacity 3.6s ease-in; }
    #viaje.go .sky { opacity: 0; }
    #viaje.luna .sky { display: none; }
    #viaje .stars { position: absolute; inset: 0; opacity: 0; transition: opacity 3.6s ease-in; }
    #viaje.go .stars, #viaje.luna .stars { opacity: 1; }
    #viaje .stars i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff; }
    #viaje .ground { position: absolute; left: 0; right: 0; bottom: 0; height: 24%; transition: transform 3.6s ease-in; }
    #viaje.go .ground { transform: translateY(120%); }
    #viaje.tierra .ground { background: linear-gradient(#58b85c, #2e7d32); }
    #viaje.luna .ground { background: radial-gradient(ellipse 60px 14px at 18% 40%, #6d6d6d 60%, transparent 62%), radial-gradient(ellipse 90px 20px at 78% 62%, #6d6d6d 60%, transparent 62%), linear-gradient(#9a9a9a, #5d5d5d); }
    #viaje .pad { position: absolute; left: 50%; width: 120px; margin-left: -60px; bottom: 24%; height: 10px; background: #555; border-radius: 3px 3px 0 0; transition: transform 3.6s ease-in; }
    #viaje.go .pad { transform: translateY(300%); }
    #viaje .count { position: absolute; left: 0; right: 0; top: 18%; text-align: center; font: 900 96px/1 system-ui, sans-serif; color: #fff; text-shadow: 0 4px 18px rgba(0,0,0,.55); pointer-events: none; }
    #viaje .count.pop { animation: viajePop .6s ease-out; }
    @keyframes viajePop { from { transform: scale(1.6); opacity: .2; } to { transform: scale(1); opacity: 1; } }
    .rocket { position: fixed; left: 50%; width: 90px; height: 200px; margin-left: -45px; pointer-events: none; will-change: transform; }
    .rocket svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 6px 8px rgba(0,0,0,.35)); }
    .rocket .flame { transform-box: fill-box; transform-origin: 50% 0; opacity: 0; animation: viajeFlame .12s infinite alternate; }
    .rocket.on .flame { opacity: 1; }
    @keyframes viajeFlame { from { transform: scaleY(.8) scaleX(.9); } to { transform: scaleY(1.15) scaleX(1.05); } }
    .rocket .earth-only { display: none; } .rocket.tierra .earth-only { display: inline; }
    .rocket .moon-only { display: none; } .rocket.luna .moon-only { display: inline; }
    #viaje .puff { position: absolute; bottom: 24%; left: 50%; width: 40px; height: 40px; margin-left: -20px; border-radius: 50%; background: rgba(240,240,240,.85); opacity: 0; }
    #viaje.luna .puff { background: rgba(180,180,180,.8); }
    #viaje .puff.on { animation: viajePuff 2.4s ease-out forwards; }
    @keyframes viajePuff { 0% { opacity: .9; transform: translate(0,0) scale(.5); } 100% { opacity: 0; transform: translate(var(--dx), -20px) scale(4); } }`;
  document.head.appendChild(st);

  // Cohete (la ventanilla enseña al muñeco: gorra azul en la Tierra, casco de astronauta en la Luna)
  const ROCKET = `
  <svg viewBox="0 0 90 200" aria-hidden="true">
    <path d="M28 120 L8 168 L28 152 Z M62 120 L82 168 L62 152 Z" fill="#e63946" stroke="#9d1f2a" stroke-width="1.2"/>
    <path d="M45 4 C62 30 62 52 62 72 L28 72 C28 52 28 30 45 4 Z" fill="#e63946" stroke="#9d1f2a" stroke-width="1.2"/>
    <rect x="28" y="70" width="34" height="84" rx="3" fill="#f1f1f1" stroke="#bdbdbd" stroke-width="1.2"/>
    <rect x="28" y="130" width="34" height="8" fill="#e63946"/>
    <circle cx="45" cy="98" r="13" fill="#1d2b53" stroke="#9aa5b8" stroke-width="2.5"/>
    <circle cx="45" cy="100" r="7" fill="#ffd9b3"/>
    <path d="M37.5 99 A7.5 7.5 0 0 1 52.5 99 Z" fill="#2b6cff" class="earth-only"/>
    <circle cx="45" cy="100" r="9.5" fill="rgba(255,255,255,.25)" stroke="#f4f4f4" stroke-width="2" class="moon-only"/>
    <rect x="35" y="152" width="20" height="8" rx="2" fill="#666"/>
    <g class="flame"><path d="M36 160 Q45 232 54 160 Z" fill="#ff9f1c"/><path d="M40 160 Q45 208 50 160 Z" fill="#ffe066"/></g>
  </svg>`;
  function rocketEl(world, z) {
    const el = document.createElement('div');
    el.className = 'rocket ' + world; el.style.zIndex = z; el.innerHTML = ROCKET;
    return el;
  }
  const sfx = n => { try { if (window.sfx) window.sfx(n); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let launching = false;
  window.rocketLaunch = function (world) {
    world = world === 'luna' ? 'luna' : 'tierra';
    if (launching || !Element.prototype.animate || reduced()) return Promise.resolve();
    launching = true;
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.id = 'viaje'; ov.className = world;
      let stars = '';
      for (let i = 0; i < 70; i++) stars += `<i style="left:${Math.random() * 100}%;top:${Math.random() * 100}%;opacity:${(0.4 + Math.random() * 0.6).toFixed(2)}"></i>`;
      ov.innerHTML = `<div class="sky"></div><div class="stars">${stars}</div><div class="ground"></div><div class="pad"></div>
        <div class="count"></div>` + [-60, -25, 25, 60].map(dx => `<div class="puff" style="--dx:${dx * 2}px"></div>`).join('');
      const rocket = rocketEl(world, 2);
      rocket.style.bottom = 'calc(24% + 8px)';
      ov.appendChild(rocket);
      document.body.appendChild(ov);
      const count = ov.querySelector('.count');
      const say = (txt, snd) => { count.textContent = txt; count.classList.remove('pop'); void count.offsetWidth; count.classList.add('pop'); sfx(snd); };
      say('3', 'beep');
      wait(800).then(() => say('2', 'beep'));
      wait(1600).then(() => say('1', 'beep'));
      wait(2400).then(() => {
        say('¡Despegue!', 'beepgo');
        sfx('cohete');
        rocket.classList.add('on'); ov.querySelectorAll('.puff').forEach(p => p.classList.add('on'));
        rocket.firstElementChild.animate([{ transform: 'translateX(-1.5px)' }, { transform: 'translateX(1.5px)' }], { duration: 60, direction: 'alternate', iterations: Infinity });
      });
      wait(3000).then(() => {
        ov.classList.add('go'); count.textContent = '';
        rocket.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-(innerHeight + 320)}px)` }],
          { duration: 4200, easing: 'cubic-bezier(.55,0,.85,.55)', fill: 'forwards' });
      });
      wait(6900).then(() => {            // el cohete ya se ha ido: se desvanece la pantalla y empieza lo siguiente
        ov.classList.add('fade'); resolve();
        setTimeout(() => { ov.remove(); launching = false; }, 900);
      });
    });
  };

  // Llega el cohete arriba del mapa, el muñeco salta en paracaídas y el cohete se va
  window.rocketDrop = async function (opts) {
    opts = opts || {};
    const tgt = document.getElementById(opts.target || 'map');
    if (!tgt || !Element.prototype.animate || reduced() || !window.skydive) { if (window.stopMusic) window.stopMusic(); return; }
    const r = tgt.getBoundingClientRect();
    const world = opts.suit ? 'luna' : 'tierra';
    const el = rocketEl(world, 1960);
    const scale = 0.75, top = r.top + 56;
    el.style.top = top + 'px'; el.style.transformOrigin = '50% 0';
    document.body.appendChild(el);
    el.classList.add('on');
    sfx('retro');
    await el.animate([{ transform: `translateY(${-(top + 260)}px) scale(${scale})` }, { transform: `translateY(0) scale(${scale})` }],
      { duration: 1900, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.catch(() => {});
    el.animate([{ transform: `translateY(0) scale(${scale})` }, { transform: `translateY(6px) scale(${scale})` }], { duration: 700, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    await wait(700);
    // el muñeco sale por la parte baja del cohete
    const landed = window.skydive(5000, {
      target: opts.target || 'map', suit: !!opts.suit, startY: top + 200 * scale - 70,
      scream: opts.suit ? 'grito2' : 'grito', shout: opts.suit ? '¡Yujuuu!' : '¡Aaaaah!'
    });
    await wait(900);
    sfx('retro');
    el.animate([{ transform: `translateY(0) scale(${scale})` }, { transform: `translateY(${-(top + 300)}px) scale(${scale})` }],
      { duration: 1800, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' }).onfinish = () => el.remove();
    await landed;
  };
})();
