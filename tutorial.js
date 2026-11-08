'use strict';
// Tutorial guiado y AUTOMÁTICO para jugadores nuevos. Arranca solo al pulsar «▶ Jugar» en la portada (si hay vídeo de introducción,
// espera a que termine). Mientras dura, el mapa se ve SIN casas; cada paso se explica con letras que se escriben solas, avanza solo
// y lleva una animación (mover el mapa, tocar un terreno libre, rellenar el panel, aparecer la casa y los vecinos). Después las casas
// reales vuelven al mapa con un fundido. Botón «Saltar tutorial» siempre visible (o tecla Escape).
// No sale si el jugador ya tiene sesión o cuenta guardada, ni si ya lo vio (se recuerda en el navegador). Se quita solo al iniciar sesión.
// Para volver a verlo: localStorage.removeItem('tutorialDone') y recargar.
(function () {
  const KEY = 'tutorialDone';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const logged = () => { try { return typeof authToken !== 'undefined' && !!authToken; } catch (e) { return false; } };
  function returning() {   // ya vio el tutorial, o tiene cuenta / sesión / pack guardados en este navegador
    if (lsGet(KEY) === '1' || lsGet('packCode')) return true;
    try { for (let i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i) || '')) return true; } catch (e) {}
    return false;
  }
  if (returning() || logged()) return;

  const T = s => (window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(s) : s);   // traduce con las filas de i18n.js
  const IMG = n => 'images/' + n + '-s.webp';
  const HOUSES = ['casa-1', 'casa-2', 'jardin', 'pisos', 'bosque', 'casa-6', 'hospital', 'iglesia'];
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Escenas de animación (se dibujan en #tut-stage) ----------
  const grid = (inner) => `<div class="tg">${inner}</div>`;
  const cells = (fn) => Array.from({ length: 9 }, (_, k) => `<i class="${k === 4 ? 'c' : ''}">${fn ? fn(k) : ''}</i>`).join('');
  const STAGE = {
    move: () => `<div class="mv"><div class="mv-map"></div><span class="mv-hand">👆</span><span class="mv-arrows">⇄</span>
      <span class="mv-pinch a"></span><span class="mv-pinch b"></span><span class="mv-zoom">🔍</span></div>`,
    libres: () => grid(cells(() => '') ),
    tap: () => `<div class="tgw tapw">${grid(cells())}<span class="tf">👆</span></div>`,
    claim: () => `<div class="mp">
      <div class="mp-l">${T('Nombre que aparecerá en el terreno')}</div>
      <div class="mp-in"><span class="mp-type">Ana</span></div>
      <div class="mp-l">${T('Tu casa')}</div>
      <div class="mp-houses">${HOUSES.slice(0, 4).map((h, k) => `<img src="${IMG(h)}" alt="" class="${k === 1 ? 'pick' : ''}">`).join('')}</div>
      <div class="mp-btn"><span>${T('Reclamar este terreno')}</span></div>
      <span class="mp-f">👆</span></div>`,
    casa: () => `<div class="tgw">${grid(cells(k => k === 4 ? `<img class="th mine" src="${IMG('casa-1')}" alt=""><b class="sp s1">✨</b><b class="sp s2">✨</b><b class="sp s3">⭐</b>` : ''))}</div>`,
    vecinos: () => `<div class="tgw">${grid(cells(k => `<img class="th ${k === 4 ? 'mine' : 'nb'}" style="--k:${k}" src="${IMG(k === 4 ? 'casa-1' : HOUSES[(k > 4 ? k - 1 : k) % HOUSES.length])}" alt="">${k === 4 ? '<em class="you">⭐</em>' : ''}`))}</div>`
  };

  // ---------- Guion ----------
  // ms: duración mínima de la escena; si no, se calcula según lo largo que sea el texto
  const STEPS = [
    { icon: '👋', title: '¡Bienvenido a Redecora El Mundo!', text: 'Este mapa es el mundo real. Cada cuadradito es un terreno virtual que puedes hacer tuyo, ponerle tu nombre y una casa. ¡Te lo enseño en 1 minuto!' },
    { icon: '🗺️', title: 'Muévete por el mapa', stage: 'move', text: 'Arrastra con el dedo para moverte y pellizca (o usa la rueda del ratón) para acercarte. Acércate hasta ver las parcelas y la vida de la ciudad.' },
    { icon: '☰', title: 'El Menú', target: '#menu-btn', text: 'Aquí está el Menú: 📍 tu ubicación, 🔍 buscar cualquier lugar, 🏆 ranking, 💬 chat de la zona, 🌎 Mundos (¡puedes viajar a la Luna!) y 🔊 Sonidos.' },
    { icon: '🟩', title: 'Terrenos libres', stage: 'libres', text: 'Mira: aquí todavía no vive nadie. Cada cuadrado es una parcela libre, ¡y puede ser tuya!' },
    { icon: '👆', title: 'Elige un terreno libre', stage: 'tap', text: 'Toca cualquier parcela libre del mapa. Se abrirá un panel con sus datos. Una vez comprada, nadie más puede quitártela.' },
    { icon: '🏠', title: 'Hazlo tuyo', stage: 'claim', ms: 10500, text: 'En el panel escribe el nombre que verá la gente, elige tu casa y pulsa «Reclamar este terreno». Cuesta créditos 🎟️.' },
    { icon: '🏡', title: '¡Tu casa aparece!', stage: 'casa', ms: 8000, text: 'Al reclamarlo, tu casa aparece al instante en el mapa con tu nombre. Solo es tuya: nadie puede quitártela.' },
    { icon: '🏘️', title: 'Llegan los vecinos', stage: 'vecinos', ms: 9500, houses: true, text: 'Poco a poco llegan vecinos y el mapa se llena de casas. ¡Así se ve donde ya se juega!' },
    { icon: '🎟️', title: 'Tus créditos', target: '#credit-pill', houses: true, text: 'Aquí ves cuántos créditos tienes. Tócalo para ver tus terrenos y recoger lo que producen cada hora.' },
    { icon: '⭐', title: 'Más créditos gratis', target: '#extras-btn', houses: true, text: 'En Extras tienes 🎁 el regalo diario, 🎡 la ruleta, 👫 Invita y gana y 📖 Cómo jugar. ¡Entra cada día!' },
    { icon: '👤', title: 'Entra para guardar todo', houses: true, ms: 15000, last: true, text: 'Inicia sesión (Google o email) para guardar tus terrenos y tu racha, y recibir tu regalo de bienvenida.', extra: { label: 'Entrar ahora', run() { if (typeof openLogin === 'function') openLogin(); } } }
  ];

  const css = document.createElement('style');
  css.id = 'tutorial-css';
  css.textContent = `
body.tut-on #welcome{display:none !important}
body.tut-nohouses .owner-label{opacity:0}
.owner-label{transition:opacity 1.4s ease}
#tut-shield{position:fixed;inset:0;z-index:4980;background:transparent;touch-action:none}
#tut-spot{position:fixed;z-index:4990;border-radius:14px;pointer-events:none;box-shadow:0 0 0 9999px rgba(4,26,20,.62);outline:3px solid #ffb703;outline-offset:2px;transition:left .25s ease,top .25s ease,width .25s ease,height .25s ease}
#tut-spot.pulse{animation:tut-pulse 1.4s ease-in-out infinite}
@keyframes tut-pulse{50%{outline-color:#fff;outline-offset:5px}}
#tut-arrow{position:fixed;z-index:4992;pointer-events:none;font-size:34px;line-height:1;transform:translateX(-50%);animation:tut-bob .9s ease-in-out infinite;filter:drop-shadow(0 2px 3px #0008)}
@keyframes tut-bob{50%{margin-top:-10px}}
#tut-card{position:fixed;z-index:5000;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(94vw,400px);box-sizing:border-box;padding:14px 16px 12px;border-radius:18px;background:rgba(11,61,46,.96);color:#fff;box-shadow:0 8px 30px #0007;font-family:system-ui,sans-serif;animation:tut-in .35s ease-out}
@keyframes tut-in{from{opacity:0;transform:translate(-50%,10px)}}
#tut-card .tut-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
#tut-card .tut-step{font-size:12px;font-weight:800;letter-spacing:.04em;color:#ffb703}
#tut-card .tut-skip{min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #fff8;background:transparent;color:#fff;font:700 13px system-ui,sans-serif;cursor:pointer}
#tut-card h3{margin:0 0 4px;font-size:18px;line-height:1.25}
#tut-card p{margin:0 0 10px;font-size:15px;line-height:1.4;font-weight:500;min-height:4.2em}
#tut-card .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#tut-card .off{opacity:0}
#tut-card .tut-bar{height:5px;border-radius:99px;background:#fff3;overflow:hidden;margin:0 0 8px}
#tut-card .tut-bar i{display:block;height:100%;width:0;background:#ffb703;border-radius:99px}
#tut-card .tut-dots{display:flex;gap:5px;justify-content:center;margin:0}
#tut-card .tut-dots i{width:7px;height:7px;border-radius:50%;background:#fff4}
#tut-card .tut-dots i.on{background:#ffb703}
#tut-card .tut-btns{display:flex;gap:8px;margin:0 0 10px}
#tut-card .tut-btns button{min-height:44px;border-radius:999px;font:800 15px system-ui,sans-serif;cursor:pointer;padding:0 14px}
#tut-card .tut-extra{background:#fff;color:#0b3d2e;border:0}
#tut-card .tut-next{flex:1;background:#ffb703;color:#222;border:0}
/* Escenario de animaciones, encima del mapa y por encima de la tarjeta */
#tut-stage{position:fixed;z-index:4995;left:0;right:0;top:calc(64px + env(safe-area-inset-top,0px));bottom:270px;display:none;align-items:center;justify-content:center;pointer-events:none;font-family:system-ui,sans-serif}
#tut-stage.show{display:flex}
#tut-stage *{box-sizing:border-box}
.tgw{position:relative}
.tg{--q:min(24vw,86px);display:grid;grid-template-columns:repeat(3,var(--q));gap:6px;padding:10px;border-radius:16px;background:rgba(4,26,20,.55);animation:tg-in .4s ease-out both}
@keyframes tg-in{from{opacity:0;transform:scale(.9)}}
.tg i{position:relative;display:block;width:var(--q);height:var(--q);border:2px dashed #ffffffcc;border-radius:10px;background:rgba(255,255,255,.14);animation:tg-free 1.8s ease-in-out infinite}
@keyframes tg-free{50%{background:rgba(61,220,151,.35)}}
.th{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 4px #0006)}
.tf{position:absolute;left:50%;top:50%;font-size:40px;line-height:1;margin:-6px 0 0 -14px;transform-origin:30% 20%;animation:tf-go var(--d,8s) ease-in-out both;filter:drop-shadow(0 2px 3px #0008)}
@keyframes tf-go{0%{opacity:0;transform:translate(120px,150px)}18%{opacity:1;transform:translate(120px,150px)}34%{transform:translate(4px,8px)}40%{transform:translate(4px,8px) scale(.82)}46%{transform:translate(4px,8px) scale(1)}85%{opacity:1;transform:translate(4px,8px)}100%{opacity:0;transform:translate(4px,8px)}}
.tapw .tg i.c{animation:tg-free 1.8s ease-in-out infinite,tg-sel var(--d,8s) both}
.tgw:not(.tapw) .tg i.c{border:3px solid #ffb703;background:rgba(255,183,3,.3);animation:none}
@keyframes tg-sel{0%,40%{border-color:#ffffffcc;box-shadow:none}46%,100%{border:3px solid #ffb703;background:rgba(255,183,3,.45);box-shadow:0 0 0 6px rgba(255,183,3,.35),0 0 18px #ffb703}}
.th.mine{animation:th-drop 1.1s .5s cubic-bezier(.3,1.4,.5,1) both}
@keyframes th-drop{0%{opacity:0;transform:translateY(-170px) scale(.5)}55%{opacity:1;transform:translateY(0) scale(1.12)}78%{transform:translateY(-12px) scale(.98)}100%{opacity:1;transform:none}}
.sp{position:absolute;font-size:22px;opacity:0;animation:sp-up 1.4s 1.5s ease-out both}
.sp.s1{left:-6px;top:4px}.sp.s2{right:-6px;top:10px;animation-delay:1.7s}.sp.s3{left:40%;top:-14px;animation-delay:1.9s}
@keyframes sp-up{0%{opacity:0;transform:translateY(10px) scale(.4)}40%{opacity:1}100%{opacity:0;transform:translateY(-26px) scale(1.3)}}
.th.nb{animation:th-pop .6s calc(.3s + var(--k) * .55s) cubic-bezier(.3,1.5,.5,1) both}
.tg:has(.nb) .th.mine{animation:th-pop .6s .1s cubic-bezier(.3,1.5,.5,1) both}
@keyframes th-pop{0%{opacity:0;transform:scale(0)}70%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
.you{position:absolute;right:-5px;top:-9px;font-style:normal;font-size:20px;animation:bob2 1s ease-in-out infinite}
@keyframes bob2{50%{transform:translateY(-4px)}}
.mp{position:relative;width:min(84vw,320px);padding:12px 14px 14px;border-radius:16px;background:#fff;color:#222;box-shadow:0 10px 30px #0006;animation:mp-in .5s ease-out both}
@keyframes mp-in{from{opacity:0;transform:translateY(40px)}}
.mp-l{font-size:12px;font-weight:700;margin:6px 0 4px;color:#444}
.mp-in{height:36px;border:1px solid #bbb;border-radius:8px;padding:7px 10px;font-size:16px;background:#fff}
.mp-type{display:inline-block;overflow:hidden;white-space:nowrap;vertical-align:top;width:0;border-right:2px solid #222;animation:mp-typing 1.1s .9s steps(3) forwards}
@keyframes mp-typing{to{width:2.1ch;border-right-color:transparent}}
.mp-houses{display:flex;gap:8px}
.mp-houses img{width:56px;height:56px;object-fit:contain;border-radius:10px;border:2px solid transparent;background:#f2f2f2}
.mp-houses img.pick{animation:mp-pick .5s calc(var(--d,10s) * .36) both}
@keyframes mp-pick{to{border-color:#ffb703;box-shadow:0 0 0 3px rgba(255,183,3,.5);transform:scale(1.1)}}
.mp-btn{margin-top:12px;padding:11px;border-radius:999px;background:#2a9d8f;color:#fff;font-weight:800;text-align:center;font-size:15px;animation:mp-press .6s calc(var(--d,10s) * .72) both}
@keyframes mp-press{40%{transform:scale(.93);background:#e6a100}100%{background:#2a9d8f;transform:none;box-shadow:0 0 0 6px rgba(61,220,151,.45)}}
.mp-btn span::after{content:' ✓';opacity:0;animation:mp-ok .01s calc(var(--d,10s) * .78) forwards}
@keyframes mp-ok{to{opacity:1}}
.mp-f{position:absolute;left:0;top:0;font-size:38px;line-height:1;filter:drop-shadow(0 2px 3px #0008);animation:mp-fing var(--d,10s) ease-in-out both}
@keyframes mp-fing{0%{opacity:0;transform:translate(250px,230px)}8%{opacity:1;transform:translate(250px,230px)}20%{transform:translate(70px,76px)}33%{transform:translate(70px,76px)}38%{transform:translate(120px,140px) scale(.85)}43%{transform:translate(120px,140px)}66%{transform:translate(120px,140px)}72%{transform:translate(130px,208px)}76%{transform:translate(130px,208px) scale(.82)}80%{transform:translate(130px,208px)}92%{opacity:1}100%{opacity:0;transform:translate(130px,208px)}}
.mv{position:relative;width:min(84vw,300px);height:150px;border-radius:16px;background:rgba(4,26,20,.55);overflow:hidden;animation:tg-in .4s ease-out both}
.mv-map{position:absolute;inset:0;background:linear-gradient(90deg,#fff2 2px,transparent 2px) 0 0/34px 34px,linear-gradient(#fff2 2px,transparent 2px) 0 0/34px 34px;animation:mv-pan var(--d,8s) ease-in-out both}
@keyframes mv-pan{0%{background-position:0 0}45%{background-position:-68px 20px}50%,100%{background-position:-68px 20px}}
.mv-hand{position:absolute;left:50%;top:50%;font-size:42px;margin:-8px 0 0 -16px;filter:drop-shadow(0 2px 3px #0008);animation:mv-h var(--d,8s) ease-in-out both}
@keyframes mv-h{0%{opacity:0;transform:translate(50px,10px)}8%{opacity:1;transform:translate(50px,10px)}22%{transform:translate(-50px,-6px)}34%{transform:translate(40px,14px)}46%{transform:translate(-30px,0);opacity:1}52%,100%{opacity:0}}
.mv-arrows{position:absolute;left:50%;top:10px;transform:translateX(-50%);font-size:26px;color:#ffb703;font-weight:900;animation:mv-ar var(--d,8s) both}
@keyframes mv-ar{0%,50%{opacity:1}56%,100%{opacity:0}}
.mv-pinch{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(255,255,255,.85);border:3px solid #ffb703;opacity:0;animation:mv-p var(--d,8s) ease-in-out both}
.mv-pinch.b{animation-name:mv-p2}
@keyframes mv-p{0%,52%{opacity:0;transform:translate(-8px,6px)}58%{opacity:1;transform:translate(-8px,6px)}85%{opacity:1;transform:translate(-62px,-34px)}100%{opacity:0;transform:translate(-62px,-34px)}}
@keyframes mv-p2{0%,52%{opacity:0;transform:translate(8px,-6px)}58%{opacity:1;transform:translate(8px,-6px)}85%{opacity:1;transform:translate(62px,34px)}100%{opacity:0;transform:translate(62px,34px)}}
.mv-zoom{position:absolute;right:12px;bottom:8px;font-size:30px;opacity:0;animation:mv-z var(--d,8s) both}
@keyframes mv-z{0%,58%{opacity:0;transform:scale(.6)}70%,92%{opacity:1;transform:scale(1.2)}100%{opacity:0}}
@media (max-height:640px){#tut-stage{bottom:250px}.tg{--q:min(20vw,70px)}}
@media (prefers-reduced-motion:reduce){#tut-spot,#tut-spot.pulse,#tut-card,#tut-arrow,#tut-stage *{animation:none !important;transition:none !important}.sp{display:none}}`;
  document.head.appendChild(css);

  let idx = -1, el = 0, dur = 0, full = '', timer = null, started = false, ended = false;
  let card = null, spot = null, arrow = null, stage = null, shield = null;
  let housesHidden = false, hideHook = null;
  const $q = s => document.querySelector(s);
  const TICK = 50, TYPE_MS = 24;

  // ---------- Casas del mapa: se esconden mientras dura la primera parte y luego vuelven con un fundido ----------
  function hideNow() {
    try {
      if (typeof gl === 'undefined' || !gl) return;
      if (typeof drawn !== 'undefined') for (const ex of drawn.values()) {
        if (ex && ex.hasDetail && gl.getLayer(ex.srcId) && gl.getPaintProperty(ex.srcId, 'raster-opacity') !== 0) gl.setPaintProperty(ex.srcId, 'raster-opacity', 0);
      }
      if (gl.getLayer('owned-3d') && gl.getPaintProperty('owned-3d', 'fill-extrusion-opacity') !== 0) gl.setPaintProperty('owned-3d', 'fill-extrusion-opacity', 0);
    } catch (e) {}
  }
  function hideHouses() {
    if (housesHidden) return;
    housesHidden = true;
    document.body.classList.add('tut-nohouses');
    hideNow();
    try { if (typeof gl !== 'undefined' && gl) { hideHook = () => { if (housesHidden) hideNow(); }; gl.on('styledata', hideHook); } } catch (e) {}
  }
  function showHouses() {
    if (!housesHidden) return;
    housesHidden = false;
    try {
      if (typeof gl !== 'undefined' && gl) {
        if (hideHook) { gl.off('styledata', hideHook); hideHook = null; }
        if (typeof drawn !== 'undefined') for (const ex of drawn.values()) {
          if (ex && ex.hasDetail && gl.getLayer(ex.srcId)) { gl.setPaintProperty(ex.srcId, 'raster-opacity-transition', { duration: 1600, delay: 0 }); gl.setPaintProperty(ex.srcId, 'raster-opacity', 1); }
        }
        if (gl.getLayer('owned-3d')) { gl.setPaintProperty('owned-3d', 'fill-extrusion-opacity-transition', { duration: 1600, delay: 0 }); gl.setPaintProperty('owned-3d', 'fill-extrusion-opacity', 0.35); }
      }
    } catch (e) {}
    document.body.classList.remove('tut-nohouses');
  }

  function finish() {
    if (ended) return;
    ended = true;
    clearInterval(timer); timer = null;
    removeEventListener('resize', place); document.removeEventListener('keydown', onKey);
    showHouses();
    document.body.classList.remove('tut-on');
    [card, spot, arrow, stage, shield].forEach(n => { if (n) n.remove(); });
    card = spot = arrow = stage = shield = null;
    lsSet(KEY, '1');
  }
  const onKey = e => { if (e.key === 'Escape' && !modalOpen()) finish(); };

  const modalOpen = () => !!document.querySelector('.modal:not(.hidden), #login:not(.hidden)');

  function place() {   // pone el foco (y la flecha) sobre el elemento del paso, si lo hay y se ve
    if (!card) return;
    const s = STEPS[idx], t = s && s.target ? $q(s.target) : null;
    const r = t ? t.getBoundingClientRect() : null;
    if (r && r.width > 0 && r.height > 0) {
      spot.style.display = 'block';
      spot.style.left = (r.left - 4) + 'px'; spot.style.top = (r.top - 4) + 'px';
      spot.style.width = (r.width + 8) + 'px'; spot.style.height = (r.height + 8) + 'px';
      arrow.style.display = 'block'; arrow.textContent = '👆';
      arrow.style.left = (r.left + r.width / 2) + 'px'; arrow.style.top = (r.bottom + 8) + 'px';
    } else { spot.style.display = 'none'; arrow.style.display = 'none'; }
  }

  function enter(n) {
    idx = n; el = 0;
    const s = STEPS[n];
    full = T(s.text);
    dur = Math.max(s.ms || 0, 3000 + full.length * 55);
    if (!s.houses) hideHouses(); else showHouses();
    card.innerHTML = `
      <div class="tut-top"><span class="tut-step">${n + 1} / ${STEPS.length}</span><button type="button" class="tut-skip">Saltar tutorial</button></div>
      <h3 data-notranslate></h3>
      <p data-notranslate><span class="sr"></span><span aria-hidden="true"><span class="on"></span><span class="off"></span></span></p>
      ${s.extra || s.last ? `<div class="tut-btns">${s.extra ? `<button type="button" class="tut-extra">${s.extra.label}</button>` : ''}<button type="button" class="tut-next">¡A jugar!</button></div>` : ''}
      <div class="tut-bar" aria-hidden="true"><i></i></div>
      <div class="tut-dots" aria-hidden="true">${STEPS.map((_, k) => `<i${k === n ? ' class="on"' : ''}></i>`).join('')}</div>`;
    card.querySelector('h3').textContent = s.icon + ' ' + T(s.title);
    card.querySelector('.sr').textContent = full;
    card.querySelector('.off').textContent = full;
    card.querySelector('.tut-skip').onclick = finish;
    const nx = card.querySelector('.tut-next'); if (nx) nx.onclick = finish;
    const x = card.querySelector('.tut-extra'); if (x) x.onclick = () => { try { s.extra.run(); } catch (e) {} };
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    // Escenario con animación (se vuelve a crear en cada escena para que la animación empiece de cero)
    stage.className = ''; stage.innerHTML = '';
    if (s.stage) { stage.style.setProperty('--d', (dur / 1000) + 's'); stage.innerHTML = STAGE[s.stage](); stage.className = 'show'; }
    spot.classList.toggle('pulse', !!s.target);
    place();
    paint();
  }

  function paint() {   // letras que se escriben solas + barra de progreso
    if (!card) return;
    const on = card.querySelector('.on'), off = card.querySelector('.off');
    if (on && off) {
      const n = reduce() ? full.length : Math.min(full.length, Math.floor(el / TYPE_MS));
      on.textContent = full.slice(0, n); off.textContent = full.slice(n);
    }
    const bar = card.querySelector('.tut-bar i'); if (bar) bar.style.width = Math.min(100, el / dur * 100) + '%';
  }

  function tick() {
    if (ended) return;
    if (logged()) { finish(); return; }                                          // al iniciar sesión, el tutorial se quita
    const hide = modalOpen() || document.hidden;                                  // si hay una ventana abierta (p. ej. el inicio de sesión), se aparta y el guion espera
    card.style.display = hide ? 'none' : ''; spot.style.visibility = hide ? 'hidden' : '';
    stage.style.visibility = hide ? 'hidden' : ''; arrow.style.visibility = hide ? 'hidden' : ''; shield.style.display = hide ? 'none' : '';
    if (hide) return;
    el += TICK;
    paint();
    if (el >= dur) { if (idx >= STEPS.length - 1) finish(); else enter(idx + 1); }
    else if (el % 500 < TICK) place();
  }

  function begin() {
    if (started || logged() || document.getElementById('tut-card')) return;
    started = true;
    lsSet(KEY, '1');   // a partir de aquí cuenta como visto: no vuelve a salir en este navegador
    document.body.classList.add('tut-on');
    shield = document.createElement('div'); shield.id = 'tut-shield'; shield.setAttribute('aria-hidden', 'true'); document.body.appendChild(shield);
    spot = document.createElement('div'); spot.id = 'tut-spot'; spot.setAttribute('aria-hidden', 'true'); document.body.appendChild(spot);
    arrow = document.createElement('div'); arrow.id = 'tut-arrow'; arrow.setAttribute('aria-hidden', 'true'); arrow.style.display = 'none'; document.body.appendChild(arrow);
    stage = document.createElement('div'); stage.id = 'tut-stage'; stage.setAttribute('aria-hidden', 'true'); stage.setAttribute('data-notranslate', ''); document.body.appendChild(stage);
    card = document.createElement('div'); card.id = 'tut-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Tutorial'); document.body.appendChild(card);
    addEventListener('resize', place); document.addEventListener('keydown', onKey);
    enter(0);
    timer = setInterval(tick, TICK);
  }

  // Arranca solo: al pulsar «▶ Jugar» (o al cargar, si la portada no sale). Si hay vídeo de introducción, espera a que acabe.
  let waited = 0;
  const wait = setInterval(() => {
    waited += 400;
    if (logged() || waited > 300000) { clearInterval(wait); return; }
    const intro = document.getElementById('intro');
    if (window.coverOpen || (intro && !intro.classList.contains('hidden'))) return;
    clearInterval(wait);
    setTimeout(begin, 800);
  }, 400);
})();
