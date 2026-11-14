'use strict';
// Viajes en cohete entre todos los mundos, en línea: Mercurio – Venus – Tierra – Luna – Marte – Júpiter – Saturno – Urano – Neptuno – Plutón.
// window.rocketLaunch(origen, destino) con 'mercurio' … 'pluton' → Promise: cuenta atrás y despegue, luego el vuelo con el cartel
// "Viajando a …" y los planetas que se cruzan por el camino (el de salida se aleja, los del medio pasan de largo y el de destino se acerca).
// Se resuelve cuando el cohete ya ha llegado y la pantalla empieza a desvanecerse.
// window.rocketDrop({ target, suit, world }) → Promise: el cohete llega arriba, el muñeco salta en paracaídas (con traje de astronauta si suit)
// y la promesa se resuelve cuando aterriza y grita. window.planetSVG(mundo) devuelve el dibujo de un planeta (lo usa mundos.js).
// Durante el viaje solo hablan los muñecos: los marcianos de los platillos (al menos uno por viaje) se dirigen al jugador por su nombre (su apodo; «terrícola» si no ha
// iniciado sesión) con frases elocuentes, voz y sonidos (SAY_N). Los planetas no hablan.
(function () {
  const SURF = { mercurio: ['#b3a79b', '#6f665d'], venus: ['#e9b44c', '#a56a1e'], jupiter: ['#d9a066', '#8f5a30'], saturno: ['#e6cf94', '#a98748'], urano: ['#a8e6ea', '#5fb2bb'], neptuno: ['#5f86ff', '#2a3fb5'], pluton: ['#e6d3c0', '#a58f7e'] };
  const SKY = { venus: ['#c98a2b', '#e9b44c', '#f6d98a'], jupiter: ['#a8683a', '#d9a066', '#f0d2a8'], saturno: ['#b4915a', '#e6cf94', '#f3e8c4'], urano: ['#5fb2bb', '#a8e6ea', '#d9f8f8'], neptuno: ['#1c2c8f', '#4a6fe8', '#9cb8ff'] };
  const SURF_CSS = Object.keys(SURF).map(k => `#viaje.${k} .ground { background: linear-gradient(${SURF[k][0]}, ${SURF[k][1]}); } #viaje.${k} .puff { background: ${SURF[k][0]}; }`).join('\n    ')
    + Object.keys(SKY).map(k => `\n    #viaje.${k} .sky { background: linear-gradient(${SKY[k][0]} 0%, ${SKY[k][1]} 65%, ${SKY[k][2]} 100%); }`).join('');
  const st = document.createElement('style');
  st.textContent = `
    #viaje { position: fixed; inset: 0; z-index: 2300; overflow: hidden; background: #000; transition: opacity .8s; }
    #viaje.fade { opacity: 0; }
    #viaje .sky { position: absolute; inset: 0; background: linear-gradient(#4d9be6 0%, #8ccbff 65%, #d8f0ff 100%); transition: opacity 3.6s ease-in; }
    #viaje.go .sky { opacity: 0; }
    #viaje.luna .sky, #viaje.mercurio .sky, #viaje.pluton .sky { display: none; }
    #viaje.marte .sky { background: linear-gradient(#b9764a 0%, #dd9d6c 65%, #f0c9a0 100%); }
    #viaje .stars { position: absolute; inset: 0; opacity: 0; transition: opacity 3.6s ease-in; }
    #viaje.go .stars, #viaje.luna .stars, #viaje.mercurio .stars, #viaje.pluton .stars { opacity: 1; }
    #viaje .stars { inset: -25% 0 0 0; }
    #viaje .stars i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff; }
    #viaje .ground { position: absolute; left: 0; right: 0; bottom: 0; height: 24%; transition: transform 3.6s ease-in; }
    #viaje.go .ground { transform: translateY(120%); }
    #viaje.tierra .ground { background: linear-gradient(#58b85c, #2e7d32); }
    #viaje.marte .ground { background: radial-gradient(ellipse 50px 12px at 22% 38%, #6b2f17 60%, transparent 62%), radial-gradient(ellipse 80px 18px at 74% 60%, #6b2f17 60%, transparent 62%), linear-gradient(#c9703f, #8a3f1f); }
    #viaje.luna .ground { background: radial-gradient(ellipse 60px 14px at 18% 40%, #6d6d6d 60%, transparent 62%), radial-gradient(ellipse 90px 20px at 78% 62%, #6d6d6d 60%, transparent 62%), linear-gradient(#9a9a9a, #5d5d5d); }
    #viaje .pad { position: absolute; left: 50%; width: 120px; margin-left: -60px; bottom: 24%; height: 10px; background: #555; border-radius: 3px 3px 0 0; transition: transform 3.6s ease-in; }
    #viaje.go .pad { transform: translateY(300%); opacity: 0; transition: transform 3.6s ease-in, opacity 1.2s ease-in 1.2s; }
    #viaje .count { position: absolute; left: 0; right: 0; top: 18%; text-align: center; font: 900 96px/1 system-ui, sans-serif; color: #fff; text-shadow: 0 4px 18px rgba(0,0,0,.55); pointer-events: none; }
    #viaje .count.pop { animation: viajePop .6s ease-out; }
    #viaje .count.word { font-size: min(15vw, 64px); }   /* «¡Despegue!» cabe en pantallas estrechas */
    @keyframes viajePop { from { transform: scale(1.6); opacity: .2; } to { transform: scale(1); opacity: 1; } }
    .rocket { position: fixed; left: 50%; width: 96px; height: 230px; margin-left: -48px; pointer-events: none; will-change: transform; }
    .rocket svg { width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 6px 8px rgba(0,0,0,.35)); }
    .rocket .flame { transform-box: fill-box; transform-origin: 50% 0; opacity: 0; animation: viajeFlame .12s infinite alternate; }
    .rocket.on .flame { opacity: 1; }
    @keyframes viajeFlame { from { transform: scaleY(.8) scaleX(.9); } to { transform: scaleY(1.15) scaleX(1.05); } }
    .rocket .earth-only { display: none; } .rocket.tierra .earth-only { display: inline; }
    .rocket .moon-only { display: none; } .rocket:not(.tierra) .moon-only { display: inline; }
    .rocket .pax { opacity: 0; transition: opacity .2s; } .rocket.occ .pax { opacity: 1; }
    .rocket .legs { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(.15); opacity: 0; transition: transform .6s, opacity .3s; }
    .rocket.legs-out .legs { transform: none; opacity: 1; }
    .rocket .door-panel { transform-box: fill-box; transform-origin: 0 50%; transition: transform .4s; }
    .rocket.open .door-panel { transform: scaleX(.12); }
    .rocket .ramp { opacity: 0; transition: opacity .3s; } .rocket.open .ramp { opacity: 1; }
    .wk { position: fixed; left: 0; top: 0; width: 34px; height: 58px; pointer-events: none; will-change: transform; }
    .wk svg { width: 100%; height: 100%; overflow: visible; display: block; filter: drop-shadow(0 3px 3px rgba(0,0,0,.35)); }
    .wk .face { transform-box: view-box; transform-origin: 20px 34px; }
    .wk.left .face { transform: scaleX(-1); }
    .wk .lg { transform-box: fill-box; transform-origin: 50% 0; }
    .wk.walking .l1 { animation: wkA .32s infinite alternate ease-in-out; }
    .wk.walking .l2 { animation: wkB .32s infinite alternate ease-in-out; }
    .wk.walking svg { animation: wkBob .32s infinite alternate; }
    @keyframes wkA { from { transform: rotate(-24deg); } to { transform: rotate(24deg); } }
    @keyframes wkB { from { transform: rotate(24deg); } to { transform: rotate(-24deg); } }
    @keyframes wkBob { from { transform: translateY(0); } to { transform: translateY(-2px); } }
    .wk .shout { position: absolute; left: 50%; bottom: 100%; margin-bottom: 10px; transform: translateX(-50%) scale(.4); opacity: 0; background: #fff; color: #d62839; font: 900 15px/1.1 system-ui, sans-serif; padding: 7px 11px; border-radius: 14px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,.35); transition: transform .25s, opacity .25s; }
    .wk.suit .shout { color: #1b3fa0; }
    .wk.say .shout { opacity: 1; transform: translateX(-50%) scale(1); }
    .dust { position: fixed; width: 26px; height: 26px; border-radius: 50%; z-index: 1955; pointer-events: none; }
    #viaje .puff { position: absolute; bottom: 24%; left: 50%; width: 40px; height: 40px; margin-left: -20px; border-radius: 50%; background: rgba(240,240,240,.85); opacity: 0; }
    #viaje.luna .puff { background: rgba(180,180,180,.8); }
    #viaje.marte .puff { background: rgba(214,150,110,.85); }
    #viaje .space { position: absolute; inset: 0; z-index: 1; overflow: hidden; pointer-events: none; }
    #viaje .body { position: absolute; left: 0; top: 0; width: 100px; height: 100px; margin: -50px 0 0 -50px; will-change: transform, opacity; }
    #viaje .body svg { width: 100%; height: 100%; display: block; overflow: visible; }
    #viaje .plabel { position: absolute; left: 0; top: 0; white-space: nowrap; pointer-events: none; will-change: transform, opacity; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.3); color: #fff; border-radius: 99px; padding: 6px 14px; font: 800 17px/1 system-ui, sans-serif; text-shadow: 0 1px 4px #000; }
    #viaje .trip { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 18px); z-index: 4; transform: translate(-50%, -12px); opacity: 0; white-space: nowrap;
      background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.3); color: #fff; border-radius: 99px; padding: 11px 20px; font: 800 20px/1 system-ui, sans-serif; text-shadow: 0 1px 4px #000;
      transition: opacity .6s, transform .6s; }
    #viaje .trip.show { opacity: 1; transform: translate(-50%, 0); }
    .rocket { z-index: 3; }
    ${SURF_CSS}
    #viaje .tripsub { position: absolute; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 72px); z-index: 4; transform: translate(-50%, -8px); opacity: 0; white-space: nowrap; color: #fff; background: rgba(0,0,0,.4); border-radius: 99px; padding: 7px 14px; font: 700 16px/1 system-ui, sans-serif; text-shadow: 0 1px 4px #000; transition: opacity .6s, transform .6s; }
    #viaje .tripsub.show { opacity: 1; transform: translate(-50%, 0); }
    #viaje .ufo { position: absolute; left: 0; top: 0; z-index: 2; pointer-events: none; will-change: transform; }
    #viaje .ufo svg { width: 100%; height: auto; display: block; overflow: visible; filter: drop-shadow(0 4px 6px rgba(0,0,0,.4)); }
    #viaje .ufo .ufo-l { animation: ufoBlink .5s infinite alternate; }
    @keyframes ufoBlink { from { opacity: .3; } to { opacity: 1; } }
    #viaje .ufo .say { position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%); margin-bottom: 12px; opacity: 0; width: max-content; max-width: 210px; text-align: center; white-space: normal; background: #fff; color: #111; border-radius: 14px; padding: 8px 12px; font: 800 14px/1.2 system-ui, sans-serif; box-shadow: 0 3px 10px rgba(0,0,0,.45); }
    #viaje .ufo .say::after { content: ''; position: absolute; left: 50%; top: 100%; margin-left: -7px; border: 7px solid transparent; border-top-color: #fff; }
    #viaje .puff.on { animation: viajePuff 2.4s ease-out forwards; }
    @keyframes viajePuff { 0% { opacity: .9; transform: translate(0,0) scale(.5); } 100% { opacity: 0; transform: translate(var(--dx), -20px) scale(4); } }`;
  document.head.appendChild(st);

  // Bandera del país del jugador (la que eligió o detectó el juego); sin país no se pone ninguna
  const myFlag = () => {
    let c = ''; try { c = localStorage.getItem('country') || ''; } catch (e) {}
    if (!/^[A-Za-z]{2}$/.test(c)) { const sel = document.getElementById('country'); c = (sel && sel.value) || ''; }
    return /^[A-Za-z]{2}$/.test(c) ? String.fromCodePoint(...[...c.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0))) : '';
  };
  // Cohete con relieve: morro rojo, cuerpo plateado con paneles, ventanilla, bandera del jugador, puerta con rampa, patas de aterrizaje y tobera.
  // (la ventanilla enseña al pasajero: gorra azul en la Tierra, casco de astronauta en otros mundos; vacía hasta que sube)
  const rocketSVG = flag => `
  <svg viewBox="0 0 100 240" aria-hidden="true">
    <defs>
      <linearGradient id="rkB" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#aab2c0"/><stop offset=".28" stop-color="#ffffff"/><stop offset=".6" stop-color="#e4e8ee"/><stop offset="1" stop-color="#8d96a6"/></linearGradient>
      <linearGradient id="rkN" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#8f1d28"/><stop offset=".3" stop-color="#ff6773"/><stop offset=".65" stop-color="#d62f3e"/><stop offset="1" stop-color="#7a1420"/></linearGradient>
      <linearGradient id="rkF" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#b3222f"/><stop offset="1" stop-color="#e84855"/></linearGradient>
      <radialGradient id="rkG" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#8fd0ff"/><stop offset=".55" stop-color="#25407e"/><stop offset="1" stop-color="#0d1630"/></radialGradient>
      <linearGradient id="rkE" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#4a4a4a"/><stop offset=".5" stop-color="#9c9c9c"/><stop offset="1" stop-color="#3e3e3e"/></linearGradient>
    </defs>
    <g class="legs">
      <path d="M36 176 L19 226 M64 176 L81 226" stroke="#7d8696" stroke-width="3.5" stroke-linecap="round" fill="none"/>
      <path d="M36 190 L22 216 M64 190 L78 216" stroke="#a7afbd" stroke-width="2" stroke-linecap="round" fill="none"/>
      <ellipse cx="17" cy="227" rx="7" ry="2.4" fill="#555"/><ellipse cx="83" cy="227" rx="7" ry="2.4" fill="#555"/>
    </g>
    <path d="M32 138 Q14 160 12 206 L32 192 Z" fill="url(#rkF)" stroke="#8c1b26" stroke-width="1"/>
    <path d="M68 138 Q86 160 88 206 L68 192 Z" fill="url(#rkF)" stroke="#8c1b26" stroke-width="1"/>
    <path d="M39 196 L35 213 Q50 218 65 213 L61 196 Z" fill="url(#rkE)" stroke="#333" stroke-width="1"/>
    <rect x="32" y="72" width="36" height="126" rx="2" fill="url(#rkB)" stroke="#aeb5c2" stroke-width="1"/>
    <path d="M50 4 C58 20 68 44 68 76 L32 76 C32 44 42 20 50 4 Z" fill="url(#rkN)" stroke="#8c1b26" stroke-width="1"/>
    <rect x="32" y="74" width="36" height="5" fill="#2a3042"/>
    <rect x="32" y="146" width="36" height="7" fill="#e63946"/>
    <path d="M32 160 H68 M32 186 H68" stroke="#c3c9d4" stroke-width=".8" fill="none"/>
    <g fill="#aab2c0"><circle cx="35.5" cy="86" r=".9"/><circle cx="64.5" cy="86" r=".9"/><circle cx="35.5" cy="140" r=".9"/><circle cx="64.5" cy="140" r=".9"/></g>
    <circle cx="50" cy="104" r="13.5" fill="#8c96a8" stroke="#586074" stroke-width="1.5"/>
    <circle cx="50" cy="104" r="10.5" fill="url(#rkG)"/>
    <g class="pax">
      <circle cx="50" cy="106" r="6.5" fill="#ffd9b3"/>
      <path d="M43.5 105 A6.5 6.5 0 0 1 56.5 105 Z" fill="#2b6cff" class="earth-only"/>
      <circle cx="50" cy="106" r="8.6" fill="rgba(255,255,255,.22)" stroke="#f4f4f4" stroke-width="1.8" class="moon-only"/>
    </g>
    <path d="M43 99 A8 8 0 0 1 51 95" stroke="#fff" stroke-width="1.6" fill="none" opacity=".6" stroke-linecap="round"/>
    ${flag ? `<rect x="36" y="121" width="28" height="19" rx="3" fill="#fff" stroke="#b9bfca"/><text x="50" y="135.5" text-anchor="middle" font-size="14" font-family="'Apple Color Emoji','Noto Color Emoji','Segoe UI Emoji',sans-serif">${flag}</text>` : ''}
    <rect x="43" y="166" width="14" height="28" rx="2" fill="#141a28"/>
    <g class="door-panel"><rect x="43" y="166" width="14" height="28" rx="2" fill="#d5dae3" stroke="#8d95a6" stroke-width="1"/><circle cx="54.5" cy="181" r="1.2" fill="#586074"/></g>
    <g class="ramp"><path d="M45 195 L17 227" stroke="#7a8396" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M37.2 199.4 L41.6 203.4 M31.6 205.8 L36 209.8 M26 212.2 L30.4 216.2 M20.4 218.6 L24.8 222.6" stroke="#fff" stroke-width="1.5" fill="none"/></g>
    <g class="flame"><path d="M38 212 Q50 290 62 212 Z" fill="#ff9f1c"/><path d="M42 212 Q50 262 58 212 Z" fill="#ffe066"/><path d="M46 212 Q50 240 54 212 Z" fill="#fff"/></g>
  </svg>`;
  function rocketEl(world, z) {
    const el = document.createElement('div');
    el.className = 'rocket ' + world; el.style.zIndex = z; el.innerHTML = rocketSVG(myFlag());
    return el;
  }
  // Astronauta que sube al cohete o baja de él: persona con gorra en la Tierra, con traje espacial fuera de ella
  function makeWalker(suit, text) {
    const legs = c => `<g class="lg l1"><rect x="13" y="42" width="6" height="22" rx="3" fill="${c}"/><rect x="11.5" y="61" width="9" height="5" rx="2.5" fill="#222"/></g><g class="lg l2"><rect x="21" y="42" width="6" height="22" rx="3" fill="${c}"/><rect x="19.5" y="61" width="9" height="5" rx="2.5" fill="#222"/></g>`;
    const body = suit
      ? `<rect x="5" y="22" width="9" height="20" rx="3" fill="#c9c9c9" stroke="#999" stroke-width=".8"/>${legs('#f4f4f4')}<rect x="11" y="22" width="18" height="22" rx="7" fill="#f4f4f4" stroke="#bdbdbd"/><rect x="6" y="24" width="5" height="16" rx="2.5" fill="#f4f4f4" stroke="#bdbdbd" stroke-width=".6"/><rect x="29" y="24" width="5" height="16" rx="2.5" fill="#f4f4f4" stroke="#bdbdbd" stroke-width=".6"/><rect x="15" y="27" width="10" height="6" rx="1.5" fill="#e63946"/><circle cx="21" cy="14" r="10.5" fill="#f4f4f4" stroke="#bdbdbd"/><ellipse cx="24" cy="14" rx="7" ry="6" fill="#1d2b53"/><ellipse cx="26" cy="12" rx="2.4" ry="1.5" fill="#fff" opacity=".7"/>`
      : `${legs('#2b3a67')}<rect x="11" y="22" width="18" height="22" rx="7" fill="#ff9f1c"/><rect x="6" y="24" width="5" height="16" rx="2.5" fill="#ff9f1c"/><rect x="29" y="24" width="5" height="16" rx="2.5" fill="#ff9f1c"/><circle cx="8.5" cy="41" r="2.6" fill="#ffd9b3"/><circle cx="31.5" cy="41" r="2.6" fill="#ffd9b3"/><circle cx="20" cy="14" r="8" fill="#ffd9b3"/><path d="M11.5 13 A8.5 8.5 0 0 1 28.5 13 Z" fill="#2b6cff"/><rect x="20" y="11" width="11" height="3" rx="1.5" fill="#1d4fc4"/><circle cx="24" cy="16" r="1" fill="#222"/>`;
    const el = document.createElement('div');
    el.className = 'wk' + (suit ? ' suit' : ''); el.style.zIndex = 4;
    el.innerHTML = `<svg viewBox="0 0 40 68" aria-hidden="true"><g class="face">${body}</g></svg><div class="shout"></div>`;
    if (text) el.querySelector('.shout').textContent = text;
    return el;
  }
  const trf = p => `translate(${p.x - 17}px, ${p.y - 58}px)`;   // los pies del muñeco en el punto p
  const moveTo = (el, a, b, ms) => el.animate([{ transform: trf(a) }, { transform: trf(b) }], { duration: ms, easing: 'linear', fill: 'forwards' }).finished.catch(() => {});
  // El astronauta camina hasta el cohete, sube por la rampa y entra; la puerta se cierra. `drop` = lo que baja el suelo respecto a la base del cohete.
  async function boardRocket(ov, rocket, suit, drop) {
    if (!Element.prototype.animate) return;
    const rr = rocket.getBoundingClientRect(), k = rr.width / 100;
    const P = (u, v) => ({ x: rr.left + u * k, y: rr.top + v * k });
    const gnd = P(17, 228), door = P(46, 195), step = { x: gnd.x - 18, y: gnd.y + drop }, start = { x: Math.max(-30, gnd.x - 150), y: gnd.y + drop };
    const w = makeWalker(suit); ov.appendChild(w);
    w.style.transform = trf(start); w.classList.add('walking');
    rocket.classList.add('open'); sfx('beep');
    await moveTo(w, start, step, 1000);
    await moveTo(w, step, gnd, 250);
    await moveTo(w, gnd, door, 520);
    w.classList.remove('walking');
    await w.animate([{ opacity: 1, transform: trf(door) }, { opacity: 0, transform: trf(door) + ' scale(.5)' }], { duration: 300, fill: 'forwards' }).finished.catch(() => {});
    w.remove(); rocket.classList.add('occ');
    await wait(250); rocket.classList.remove('open'); sfx('beep');
    await wait(450);
  }
  const sfx = n => { try { if (window.sfx) window.sfx(n); } catch (e) {} };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SPR = {};   // mundo -> ruta de su dibujo real (images/planetas/<mundo>.webp), si existe
  // ---------- Planetas (dibujos para el vuelo y para los botones) ----------
  let pid = 0;
  window.planetSVG = function (w) {
    if (SPR[w]) return `<svg viewBox="0 0 100 100" aria-hidden="true" data-planet="${w}"><image href="${SPR[w]}" x="0" y="0" width="100" height="100"/></svg>`;
    const n = ++pid, id = k => `pl${k}${n}`;
    const C = { tierra: ['#7cc4ff', '#1f5fbf', '#0b2f6b'], luna: ['#e4e4e4', '#9a9a9a', '#5c5c5c'], marte: ['#f09a68', '#b4502a', '#6e2a12'], mercurio: ['#d5cdc3', '#8d8378', '#4d463f'], venus: ['#fff0b0', '#e6a93f', '#8a5217'], jupiter: ['#f0d2a8', '#c58a56', '#6e4426'], saturno: ['#f3e2b0', '#cfae6c', '#7a6234'], urano: ['#c9f4f4', '#7fd0d6', '#3a8a96'], neptuno: ['#7aa6ff', '#2f4fd0', '#14206b'], pluton: ['#f1e2d0', '#b89a82', '#5e4636'] }[w] || ['#ccc', '#888', '#444'];
    let detail = '';
    if (w === 'tierra') {
      detail = `<g fill="#4cae56" stroke="#2f7d3a" stroke-width=".8"><path d="M20 30 C28 20 40 22 44 31 C48 40 40 46 36 54 C32 63 23 58 19 48 C17 40 17 34 20 30Z"/><path d="M56 22 C67 18 80 27 82 38 C84 49 73 51 69 59 C65 67 58 61 56 50 C54 40 49 27 56 22Z"/><path d="M38 70 C50 65 63 70 67 79 C60 88 44 89 37 81Z"/></g>
        <g fill="#fff" opacity=".85"><ellipse cx="30" cy="40" rx="15" ry="3.4"/><ellipse cx="66" cy="32" rx="14" ry="3"/><ellipse cx="52" cy="62" rx="16" ry="3.2"/><ellipse cx="24" cy="70" rx="11" ry="2.6"/><ellipse cx="50" cy="14" rx="20" ry="3"/></g>`;
    } else if (w === 'luna') {
      detail = `<g fill="#7d7d7d" opacity=".5"><path d="M24 36 C32 26 44 30 46 40 C48 50 36 54 28 50 C22 46 20 40 24 36Z"/><path d="M58 52 C66 46 78 50 78 60 C78 70 66 72 60 66 C56 62 54 56 58 52Z"/></g>
        <g fill="#8a8a8a" stroke="#f2f2f2" stroke-width="1" stroke-opacity=".6"><circle cx="70" cy="28" r="7"/><circle cx="34" cy="68" r="9"/><circle cx="52" cy="82" r="5"/><circle cx="18" cy="52" r="4"/><circle cx="48" cy="24" r="3.5"/><circle cx="82" cy="48" r="3.5"/></g>`;
    } else if (w === 'marte') {
      detail = `<g fill="#6e2a12" opacity=".55"><path d="M16 46 C24 36 36 40 42 48 C46 56 38 64 28 62 C20 60 14 54 16 46Z"/><path d="M52 40 C62 34 74 40 76 50 C78 60 66 64 58 60 C50 56 46 46 52 40Z"/><path d="M38 70 C48 66 60 70 62 78 C58 86 44 86 38 80Z"/></g>
        <ellipse cx="50" cy="8" rx="20" ry="6" fill="#fff" opacity=".9"/><ellipse cx="50" cy="93" rx="13" ry="3.5" fill="#fff" opacity=".7"/>
        <g fill="#9c3d1c" stroke="#f3b184" stroke-width=".8" stroke-opacity=".6"><circle cx="30" cy="28" r="4"/><circle cx="72" cy="72" r="5"/><circle cx="22" cy="72" r="3"/></g>`;
    } else if (w === 'mercurio') {
      detail = `<g fill="#8d8378" stroke="#f0e9df" stroke-width=".8" stroke-opacity=".5"><circle cx="30" cy="34" r="10"/><circle cx="64" cy="26" r="6"/><circle cx="70" cy="62" r="12"/><circle cx="34" cy="72" r="6"/><circle cx="52" cy="48" r="4"/><circle cx="16" cy="58" r="4"/></g>`;
    } else if (w === 'venus') {
      detail = `<g opacity=".45" fill="none" stroke="#b9772a" stroke-width="6"><path d="M0 28 C30 18 60 40 100 26"/><path d="M0 50 C30 42 60 62 100 48"/><path d="M0 72 C30 64 60 84 100 70"/></g>`;
    } else if (w === 'jupiter') {
      detail = `<g opacity=".7"><rect x="0" y="20" width="100" height="9" fill="#a8683a"/><rect x="0" y="38" width="100" height="12" fill="#c98f5a"/><rect x="0" y="58" width="100" height="8" fill="#9a5a30"/><rect x="0" y="74" width="100" height="8" fill="#b87a4a"/></g><ellipse cx="62" cy="56" rx="9" ry="5" fill="#c0392b" opacity=".85"/>`;
    } else if (w === 'saturno') {
      detail = `<g opacity=".6"><rect x="0" y="24" width="100" height="10" fill="#b4915a"/><rect x="0" y="44" width="100" height="12" fill="#e6cf94"/><rect x="0" y="66" width="100" height="9" fill="#a98748"/></g>`;
    } else if (w === 'urano') {
      detail = `<g opacity=".35"><rect x="0" y="30" width="100" height="6" fill="#fff"/><rect x="0" y="52" width="100" height="10" fill="#4aa3ad"/></g>`;
    } else if (w === 'neptuno') {
      detail = `<g opacity=".5"><rect x="0" y="26" width="100" height="8" fill="#0f1a66"/><rect x="0" y="60" width="100" height="10" fill="#9cc0ff"/></g><ellipse cx="38" cy="44" rx="9" ry="5" fill="#0b1250" opacity=".7"/>`;
    } else if (w === 'pluton') {
      detail = `<g opacity=".55"><path d="M10 40 C25 30 40 44 52 40 C64 36 80 44 92 38 L92 62 C74 70 60 58 44 66 C30 72 18 66 10 60Z" fill="#7a5a46"/></g><path d="M52 64 C34 52 34 36 44 34 C50 33 53 38 53 38 C53 38 57 31 64 34 C74 38 70 52 52 64Z" fill="#fbf4ea" opacity=".92"/>`;
    }
    return `<svg viewBox="0 0 100 100" aria-hidden="true" data-planet="${w}"><defs>
      <radialGradient id="${id('b')}" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${C[0]}"/><stop offset=".6" stop-color="${C[1]}"/><stop offset="1" stop-color="${C[2]}"/></radialGradient>
      <radialGradient id="${id('s')}" cx=".3" cy=".28" r=".9"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
      <clipPath id="${id('c')}"><circle cx="50" cy="50" r="48"/></clipPath></defs>
      <circle cx="50" cy="50" r="48" fill="url(#${id('b')})"/><g clip-path="url(#${id('c')})">${detail}</g>
      <circle cx="50" cy="50" r="48" fill="url(#${id('s')})"/>${w === 'tierra' ? '<circle cx="50" cy="50" r="48" fill="none" stroke="#9fd8ff" stroke-width="2.5" opacity=".5"/>' : ''}${w === 'saturno' ? '<ellipse cx="50" cy="50" rx="74" ry="15" fill="none" stroke="#e3cd96" stroke-width="6" opacity=".9" transform="rotate(-16 50 50)"/><ellipse cx="50" cy="50" rx="60" ry="11" fill="none" stroke="#b79a5e" stroke-width="2" opacity=".8" transform="rotate(-16 50 50)"/>' : ''}</svg>`;
  };

  // ---------- Ruta: la Tierra, la Luna y Marte están en línea ----------
  const CHAIN = ['mercurio', 'venus', 'tierra', 'luna', 'marte', 'jupiter', 'saturno', 'urano', 'neptuno', 'pluton'], HOP = [3500, 3500, 4500, 6500, 4200, 4200, 4200, 4200, 4200];   // ms de vuelo entre cada par vecino
  const AU = { mercurio: 0.39, venus: 0.72, tierra: 1, luna: 1, marte: 1.52, jupiter: 5.2, saturno: 9.58, urano: 19.2, neptuno: 30.05, pluton: 39.5 };   // distancia al Sol (para el «qué lejos»)
  const NAME = { mercurio: 'Mercurio', venus: 'Venus', tierra: 'la Tierra', luna: 'la Luna', marte: 'Marte', jupiter: 'Júpiter', saturno: 'Saturno', urano: 'Urano', neptuno: 'Neptuno', pluton: 'Plutón' };
  const TRIP = {}; Object.keys(NAME).forEach(k => { TRIP[k] = 'Viajando a ' + NAME[k].replace(/^la /, 'La '); });
  // Dibujos reales opcionales: si existe images/planetas/<mundo>.webp (tierra, luna, marte, jupiter…) se usa en vez del dibujo vectorial
  let refreshT = 0;
  function refreshPlanets() {
    clearTimeout(refreshT);
    refreshT = setTimeout(() => document.querySelectorAll('svg[data-planet]').forEach(s => { const id = s.getAttribute('data-planet'); if (SPR[id] && !s.querySelector('image')) s.outerHTML = window.planetSVG(id); }), 50);
  }
  CHAIN.forEach(id => { const url = 'images/planetas/' + id + '.webp', im = new Image(); im.onload = () => { SPR[id] = url; refreshPlanets(); }; im.src = url; });

  // Cuanto más lejos, más se queja el astronauta
  function farMsg(d) {
    const km = Math.round(d * 149.6).toLocaleString('es-ES') + ' millones de km';
    if (d < 0.3) return '';
    if (d < 1) return 'Un saltito… · ' + km;
    if (d < 4) return 'Esto ya no es un paseo… · ' + km;
    if (d < 12) return 'Uf… qué lejos… · ' + km;
    if (d < 25) return 'Uuuf… ¡qué lejísimos! · ' + km;
    return '¡¡UUUF… QUÉ LEJÍSIMOS!! · ' + km;
  }
  function route(from, to) {
    const a = CHAIN.indexOf(from), b = CHAIN.indexOf(to), step = a < b ? 1 : -1, stops = [];
    let t = 0;
    for (let i = a; i !== b; i += step) { stops.push({ w: CHAIN[i], t }); t += HOP[Math.min(i, i + step)]; }
    stops.push({ w: CHAIN[b], t });
    return { stops, total: t };
  }

  // El vuelo: el cohete se queda arriba y los planetas se mueven por detrás
  function flyBy(ov, rocket, r, W, H) {
    const space = document.createElement('div'); space.className = 'space';
    ov.insertBefore(space, rocket);
    const out = [], n = r.stops.length;
    r.stops.forEach((st, i) => {
      const el = document.createElement('div'); el.className = 'body'; el.innerHTML = window.planetSVG(st.w);
      space.appendChild(el);
      const x = W * 0.5, tr = (px, py, sc, o) => ({ transform: `translate(${px}px, ${py}px) scale(${sc})`, opacity: o });
      let kf, dur, delay, easing;
      if (i === 0) {          // de donde salimos: grande abajo, se hace pequeño y se pierde
        kf = [tr(x, H * 1.12, W * 1.25 / 100, 0), Object.assign(tr(x, H * 1.14, W * 1.22 / 100, 1), { offset: 0.1 }), Object.assign(tr(x, H * 1.25, W * 1.05 / 100, 1), { offset: 0.5 }), tr(x, H * 1.9, W * 0.3 / 100, 1)];
        dur = 4600; delay = 0; easing = 'ease-in';
      } else if (i === n - 1) {   // el destino: se ve pequeño arriba y crece al acercarnos
        kf = [tr(x, -H * 0.3, W * 0.05 / 100, 0.9), tr(x, H * 0.3, W * 0.8 / 100, 1)];
        dur = 4200; delay = Math.max(0, r.total - dur); easing = 'cubic-bezier(.2,.6,.3,1)';
      } else {                // los de en medio: pasan de largo por un lado, cada vez más grandes
        const side = (i % 2 ? 0.2 : 0.8) * W;
        kf = [tr(side, -H * 0.25, W * 0.06 / 100, 0.9), tr(side, H * 1.3, W * 0.55 / 100, 1)];
        dur = 4400; delay = Math.max(0, st.t - dur / 2); easing = 'cubic-bezier(.5,0,.9,.6)';
      }
      out.push(el.animate(kf, { duration: dur, delay, easing, fill: 'both' }));
      if (i > 0) {   // el nombre del planeta acompaña a su dibujo (sin crecer con él) mientras se pasa por delante
        const lab = document.createElement('div'); lab.className = 'plabel'; lab.textContent = NAME[st.w].replace(/^la /, 'La ');
        space.appendChild(lab);
        const lk = kf.map(f => { const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(f.transform); const sc = Number(m[3]);
          return Object.assign({}, f, { transform: `translate(${m[1]}px, ${Number(m[2]) + 50 * sc + 14}px) translateX(-50%)` }); });
        out.push(lab.animate(lk, { duration: dur, delay, easing, fill: 'both' }));
      }
    });
    return out;
  }

  // Nombre del jugador: su apodo fijo (nickOf() de app.js), o el del campo de nombre; sin sesión se le llama «terrícola»
  function myName() {
    let n = '';
    try { n = (window.atlasPlayerName ? window.atlasPlayerName() : '') || (typeof nickOf === 'function' ? nickOf() : '') || (document.getElementById('name') || {}).value || (document.getElementById('login-nick') || {}).value || ''; } catch (e) {}
    return String(n).replace(/\s+/g, ' ').trim().slice(0, 24);
  }
  // Solo hablan los muñecos (los marcianos de los platillos), siempre dirigiéndose al jugador por su nombre. [sonido, frase]; {n} = nombre, {w} = planeta de destino.
  // Sonidos (voices.js): bienvenida (arpegio), cash («qué caro») y enfado.
  const fillN = (t, to) => t.replace(/\{n\}/g, myName() || 'terrícola').replace(/\{w\}/g, NAME[to] || '').replace(/terrícola,? terrícola/ig, 'terrícola').replace(/(^|[.!?¡]\s?)la ([A-ZÁÉÍÓÚ])/g, (m, a, b) => a + 'La ' + b);
  const SAY_N = [
    ['bienvenida', '¡Bienvenido al espacio, {n}! Cobramos peaje.'], ['bienvenida', 'Salve, {n}, noble viajero de la Vía Láctea.'], ['bienvenida', '¡Mirad, es {n}! Aplaudid con las antenas.'],
    ['bienvenida', '¡Buen viaje a {w}, {n}! Que las estrellas te guíen y el banco no te encuentre.'],
    ['enfado', 'Vete de aquí, terrícola {n}.'], ['enfado', '¡Largo, {n}! Este tramo del cielo es mío.'], ['enfado', 'No me mires así, {n}, que me pongo verde. Más.'],
    ['cash', '{n}, aquí está todo muy caro. Hasta el espacio.'], ['cash', 'Voy a pedir una hipoteca para un platillo como el tuyo, {n}.'], ['cash', '{n}, ¿me prestas unos créditos? Te los devuelvo en el próximo eclipse.'],
    ['cash', 'En {w} el metro cuadrado está por las nubes, {n}. Respira hondo antes de preguntar.'], ['cash', 'Dicen que {n} compra parcelas. Pues yo, para un cráter, voy a pedir una hipoteca.'],
    [null, 'Dijo un sabio: quien vuela lejos, {n}, vuelve con la cartera ligera.'], [null, 'El universo es infinito, {n}, pero mi paciencia no.'], [null, '{n}, quien busca una estrella encuentra una parcela.'],
    [null, 'Las órbitas son como las deudas, {n}: siempre vuelven.'], [null, 'Contempla, {n}: millones de estrellas y ninguna con cobertura.'], [null, 'Somos polvo de estrellas, {n}. Tú, polvo con cohete.'],
    [null, 'No hay prisa, {n}: en el espacio nadie te oye correr.'], [null, 'Quien a buen planeta se arrima, {n}, buena parcela le cobija.'], [null, 'Rumbo a {w}, {n}: quien no arriesga, no se hipoteca.'],
    [null, 'Todo gran viajero, {n}, empieza dejando atrás su planeta.'], [null, 'Los caminos del universo son inescrutables, {n}, pero este lleva derecho a {w}.'], [null, 'No hay mal que por bien no venga, {n}, ni platillo que no aterrice.']
  ];

  // Platillos volantes con marcianos: salen en los viajes muy largos (no si el destino es la Tierra o la Luna) y preguntan adónde vas
  const SAY = ['¿A dónde vas, terrícola?', '¡EH! ¿DÓNDE VAS?', '¿DÓNDE VAS TÚ?', '¡Aquí no se puede pasar!', '¿Y tú de dónde sales?', '¡Estás muy lejos de casa!'];
  const ALIEN = ['#7be07b', '#b48cff', '#ff9ccf', '#7fd8ff'], LIGHTS = ['#ff4d4d', '#ffd23f', '#5cff7a', '#4dc9ff', '#ff7bd5'];
  const ufoSVG = c => `<svg viewBox="0 0 120 80" aria-hidden="true">
    <path d="M38 40 C38 4 82 4 82 40Z" fill="rgba(170,235,255,.5)" stroke="#d6f6ff" stroke-width="2"/>
    <path d="M53 20 L49 8 M67 20 L71 8" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><circle cx="49" cy="8" r="3" fill="#ffd23f"/><circle cx="71" cy="8" r="3" fill="#ffd23f"/>
    <ellipse cx="60" cy="30" rx="12" ry="13" fill="${c}" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
    <ellipse cx="54" cy="29" rx="3.6" ry="6" fill="#111" transform="rotate(22 54 29)"/><ellipse cx="66" cy="29" rx="3.6" ry="6" fill="#111" transform="rotate(-22 66 29)"/>
    <path d="M56 37 Q60 40 64 37" stroke="rgba(0,0,0,.5)" fill="none" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="60" cy="46" rx="52" ry="14" fill="#aeb8c8" stroke="#6b768a" stroke-width="2"/><ellipse cx="60" cy="53" rx="32" ry="8" fill="#7d889c"/>
    ${[22, 41, 60, 79, 98].map((x, k) => `<circle class="ufo-l" style="animation-delay:${k * 0.12}s" cx="${x}" cy="${46 + (k % 2 ? 1 : 0)}" r="3.6" fill="${LIGHTS[k]}"/>`).join('')}</svg>`;
  // Voz de los marcianos (síntesis de voz del navegador, aguda y con un tono distinto en cada platillo)
  const PITCH = [1.9, 1.5, 2, 0.6, 1.7, 1.2];
  function speak(txt, pitch) {
    try {
      const ss = window.speechSynthesis; if (!ss || !window.SpeechSynthesisUtterance) return;
      const u = new SpeechSynthesisUtterance(txt.toLowerCase().replace(/\.{3}/g, '…'));
      u.lang = 'es-ES'; u.pitch = pitch; u.rate = 0.92; u.volume = 1;
      const voice = (ss.getVoices() || []).find(x => /^es/i.test(x.lang)); if (voice) u.voice = voice;
      ss.cancel(); setTimeout(() => ss.speak(u), 80);
    } catch (e) {}
  }
  function ufos(ov, rocket, total, dist, W, H, to) {
    // Sale al menos un marciano en cada viaje (también a la Tierra y a la Luna) y más cuanto más lejos se va; cada uno espera a que el anterior termine de hablar
    const GAP = 5200, first = total < 5200 ? 5600 + 150 : 5600 + 800, fit = Math.max(1, Math.floor((total - 800) / GAP) + 1);
    const n = Math.min(6, fit, Math.max(1, Math.round(dist / 3))), gap = Math.max(GAP, (total - 4200) / n);
    const used = [];
    for (let i = 0; i < n; i++) wait(first + i * gap).then(() => {
      if (!ov.isConnected) return;
      let k, tries = 0; do { k = Math.floor(Math.random() * SAY_N.length); } while (used.indexOf(k) >= 0 && ++tries < 12); used.push(k);
      const nl = i === 0 ? [null, '¿DÓNDE VAS, ' + (myName() || 'TERRÍCOLA').toUpperCase() + '...?'] : SAY_N[k];
      const say = i === 0 ? nl[1] : fillN(nl[1], to);
      const dur = Math.max(5200, say.length * 95 + 2600);
      const el = document.createElement('div'), w = 80 + Math.random() * 50, dir = i % 2 ? -1 : 1;
      const y = 150 + Math.random() * Math.max(50, H * 0.52 - 150), x0 = dir > 0 ? -w - 40 : W + 40, x1 = dir > 0 ? W + 40 : -w - 40;
      el.className = 'ufo'; el.style.width = w + 'px';
      el.innerHTML = ufoSVG(ALIEN[i % ALIEN.length]) + '<div class="say"></div>';
      el.querySelector('.say').textContent = say;
      ov.insertBefore(el, rocket);
      el.animate([{ transform: `translate(${x0}px, ${y}px)` }, { transform: `translate(${(x0 + x1) / 2}px, ${y - 22}px)`, offset: 0.5 }, { transform: `translate(${x1}px, ${y + 6}px)` }], { duration: dur, fill: 'both' });
      el.firstElementChild.animate([{ transform: 'rotate(-6deg)' }, { transform: 'rotate(6deg)' }], { duration: 700, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
      el.querySelector('.say').animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], { duration: dur, fill: 'both' });
      sfx('ufo');
      if (nl[0] && window.atlasVoice && !window.atlasVoice.muted) setTimeout(() => window.atlasVoice.sfx(nl[0], { vol: 0.7 }), 150);   // arpegio, caja registradora o zumbido de enfado
      setTimeout(() => speak(say, PITCH[i % PITCH.length]), nl[0] ? 450 : 250);   // el marciano habla en cuanto aparece
      setTimeout(() => el.remove(), dur + 300);
    });
  }

  let launching = false;
  window.rocketLaunch = function (from, to) {
    from = CHAIN.includes(from) ? from : 'tierra';
    to = CHAIN.includes(to) && to !== from ? to : (from === 'tierra' ? 'luna' : 'tierra');
    if (launching || !Element.prototype.animate || reduced()) return Promise.resolve();
    launching = true;
    const trip = route(from, to);
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.id = 'viaje'; ov.className = from;
      let stars = '';
      for (let i = 0; i < 90; i++) stars += `<i style="left:${Math.random() * 100}%;top:${Math.random() * 100}%;opacity:${(0.4 + Math.random() * 0.6).toFixed(2)}"></i>`;
      ov.innerHTML = `<div class="sky"></div><div class="stars">${stars}</div><div class="ground"></div><div class="pad"></div>
        <div class="count"></div><div class="trip"></div><div class="tripsub"></div>` + [-60, -25, 25, 60].map(dx => `<div class="puff" style="--dx:${dx * 2}px"></div>`).join('');
      const rocket = rocketEl(from, 3);
      rocket.style.bottom = 'calc(24% - 1px)'; rocket.classList.add('legs-out');   // apoyado en sus patas sobre la plataforma
      ov.appendChild(rocket);
      document.body.appendChild(ov);
      const W = innerWidth, H = innerHeight;
      const count = ov.querySelector('.count'), banner = ov.querySelector('.trip'), sub = ov.querySelector('.tripsub');
      const dist = Math.abs(AU[from] - AU[to]);
      banner.textContent = TRIP[to]; sub.textContent = farMsg(dist);
      const say = (txt, snd) => { count.textContent = txt; count.classList.toggle('word', txt.length > 2); count.classList.remove('pop'); void count.offsetWidth; count.classList.add('pop'); sfx(snd); };
      const go = () => {   // se sube al cohete y después empieza la cuenta atrás
      say('3', 'beep');
      wait(800).then(() => say('2', 'beep'));
      wait(1600).then(() => say('1', 'beep'));
      wait(2400).then(() => {
        say('¡Despegue!', 'beepgo');
        try { if (window.rocketEngine) window.rocketEngine.start(); else sfx('cohete'); } catch (e) {}   // el motor sigue sonando hasta que el astronauta aterriza (rocketDrop)
        rocket.classList.add('on'); ov.querySelectorAll('.puff').forEach(p => p.classList.add('on'));
        wait(500).then(() => rocket.classList.remove('legs-out'));   // las patas se pliegan al despegar
        rocket.firstElementChild.animate([{ transform: 'translateX(-1.5px)' }, { transform: 'translateX(1.5px)' }], { duration: 60, direction: 'alternate', iterations: Infinity });
      });
      const RISE = -H * 0.22;
      wait(3000).then(() => {
        ov.classList.add('go'); count.textContent = ''; banner.classList.add('show'); if (sub.textContent) sub.classList.add('show');   // al despegar sale el cartel "Viajando a …"
        rocket.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${RISE}px)` }],
          { duration: 3600, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
        ov.querySelector('.stars').animate([{ transform: 'translateY(0)' }, { transform: 'translateY(25%)' }], { duration: 2600 + trip.total + 600, fill: 'forwards' });
      });
      wait(5600).then(() => flyBy(ov, rocket, trip, W, H));
      ufos(ov, rocket, trip.total, dist, W, H, to);   // los marcianos de los platillos te hablan por tu nombre
      trip.stops.slice(1, -1).forEach(s => wait(5600 + s.t - 600).then(() => { banner.textContent = 'Pasando por ' + NAME[s.w]; }));
      wait(5600 + trip.total - 2200).then(() => { banner.textContent = TRIP[to]; if (dist >= 4) sub.textContent = '¡Ya casi llegamos!'; });
      if (dist >= 4) wait(5600 + trip.total * 0.5).then(() => { sub.textContent = '¿Falta mucho…?'; });
      if (dist >= 25) wait(5600 + trip.total * 0.78).then(() => { sub.textContent = '¿Seguimos sin llegar…?'; });    // al dejar atrás el suelo empiezan a verse los planetas
      wait(5600 + trip.total + 400).then(() => {               // llegada: el cohete se va hacia arriba y la pantalla se desvanece
        banner.classList.remove('show'); sub.classList.remove('show');
        rocket.animate([{ transform: `translateY(${RISE}px)` }, { transform: `translateY(${-(H + 320)}px)` }], { duration: 800, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
      });
      wait(5600 + trip.total + 1100).then(() => {
        ov.classList.add('fade'); resolve();
        setTimeout(() => { ov.remove(); launching = false; try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} }, 900);
      });
      };
      boardRocket(ov, rocket, from !== 'tierra', 14).catch(() => {}).then(go);
    });
  };

  // Llega el cohete arriba del mapa, el muñeco salta en paracaídas y el cohete se va
  const legacyDrop = async function (opts) {
    opts = opts || {};
    const tgt = document.getElementById(opts.target || 'map');
    const engine = (fn, v) => { try { if (window.rocketEngine) window.rocketEngine[fn](v); } catch (e) {} };
    if (!tgt || !Element.prototype.animate || reduced() || !window.skydive) { engine('stop'); if (window.stopMusic) window.stopMusic(); return; }
    const r = tgt.getBoundingClientRect();
    const world = opts.world || (opts.suit ? 'luna' : 'tierra');
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
    engine('level', 1.1);   // durante el salto el motor se oye más bajito (así se oye el grito)
    const landed = window.skydive(5000, {
      target: opts.target || 'map', suit: !!opts.suit, startY: top + 230 * scale - 70,
      scream: opts.suit ? 'grito2' : 'grito', shout: opts.suit ? '¡Yujuuu!' : '¡Aaaaah!'
    });
    await wait(900);
    sfx('retro');
    el.animate([{ transform: `translateY(0) scale(${scale})` }, { transform: `translateY(${-(top + 300)}px) scale(${scale})` }],
      { duration: 1800, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' }).onfinish = () => el.remove();
    try { await landed; } finally { engine('stop'); }   // el astronauta ya ha aterrizado: se apaga el motor
  };

  // Llegada: el cohete baja con los motores, despliega las patas y se posa en el suelo; se abre la puerta y el astronauta baja por la rampa.
  window.rocketDrop = async function (opts) {
    opts = opts || {};
    const tgt = document.getElementById(opts.target || 'map');
    const engine = (fn, v) => { try { if (window.rocketEngine) window.rocketEngine[fn](v); } catch (e) {} };
    if (!tgt || !Element.prototype.animate || reduced()) { engine('stop'); if (window.stopMusic) window.stopMusic(); return; }
    const r = tgt.getBoundingClientRect();
    if (r.width < 120 || r.height < 280) return window.skydive ? legacyDrop(opts) : (engine('stop'), undefined);   // mapa demasiado pequeño: salto en paracaídas como antes
    const world = opts.world || (opts.suit ? 'luna' : 'tierra');
    const el = rocketEl(world, 1960), K = 0.96;
    const groundY = Math.max(r.top + 260, Math.min(r.bottom - 40, r.top + r.height * 0.72)), cx = r.left + r.width / 2;
    const top = groundY - 228 * K;
    el.style.left = cx + 'px'; el.style.top = top + 'px';
    el.classList.add('on', 'occ');
    document.body.appendChild(el);
    const dustColor = SURF[world] ? SURF[world][0] : world === 'luna' ? '#b3b3b3' : world === 'marte' ? '#d6966e' : '#d8d2c4';
    const dust = () => { for (let i = 0; i < 8; i++) {
      const d = document.createElement('div'); d.className = 'dust'; d.style.cssText = `left:${cx}px;top:${groundY}px;background:${dustColor}`; document.body.appendChild(d);
      const dx = (i - 3.5) * 24 + (Math.random() * 10 - 5);
      d.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .85 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${6 + Math.random() * 14}px)) scale(${2 + Math.random()})`, opacity: 0 }],
        { duration: 1300, easing: 'ease-out', fill: 'forwards' }).onfinish = () => d.remove(); } };
    sfx('retro');
    const down = el.animate([{ transform: `translateY(${-(top + 280)}px)` }, { transform: 'translateY(0)' }], { duration: 2600, easing: 'cubic-bezier(.1,.6,.2,1)', fill: 'forwards' });
    wait(1700).then(() => el.classList.add('legs-out'));
    try {
      await down.finished.catch(() => {});
      dust(); sfx('retro');                                   // toca el suelo
      el.classList.remove('on'); engine('stop'); if (window.stopMusic) window.stopMusic();
      el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(3px)' }, { transform: 'translateY(0)' }], { duration: 350 });
      await wait(700);
      el.classList.add('open'); sfx('beepgo');
      await wait(450);
      el.classList.remove('occ');
      const rr = el.getBoundingClientRect(), k = rr.width / 100;
      const gnd = { x: rr.left + 17 * k, y: rr.top + 228 * k }, door = { x: rr.left + 46 * k, y: rr.top + 195 * k };
      const end = { x: Math.max(r.left + 36, gnd.x - 90), y: gnd.y + 4 };
      const w = makeWalker(!!opts.suit, opts.suit ? '¡Yujuuu!' : '¡Ya estoy en casa!'); w.style.zIndex = 1962; w.classList.add('walking', 'left');
      document.body.appendChild(w);
      w.style.transform = trf(door);
      w.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
      await moveTo(w, door, gnd, 650);
      await moveTo(w, gnd, end, 1300);
      w.classList.remove('walking'); w.classList.add('say');
      sfx(opts.suit ? 'grito2' : 'beep');
      el.classList.remove('open');                           // la puerta se cierra
      await wait(2300);
      w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
      el.classList.remove('legs-out'); el.classList.add('on'); sfx('retro');   // el cohete se va
      el.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-(top + 300)}px)` }], { duration: 1800, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' }).onfinish = () => el.remove();
      await wait(800);
      w.remove();
    } finally { engine('stop'); if (!document.body.contains(el)) return; setTimeout(() => el.remove(), 2500); }
  };
})();
