'use strict';
// Tutorial guiado y AUTOMÁTICO para jugadores nuevos. Arranca solo al pulsar «▶ Jugar» en la portada (si hay vídeo de introducción,
// espera a que termine). Mientras dura, el mapa se ve SIN casas; cada paso se explica con letras que se escriben solas, avanza solo
// y lleva una animación. A mitad del tutorial el mapa «viaja» a una CIUDAD DE EJEMPLO simulada (#tut-sim, dibujada en SVG): se busca
// la ciudad, se hace zoom hasta una manzana, se ve un terreno libre a pie de calle SIN ninguna casa, se toca, se rellena el panel, aparece
// la casa y llegan los vecinos. Después las casas reales vuelven al mapa con un fundido. Botón «Saltar tutorial» siempre visible (o tecla Escape).
// SIN OTROS SONIDOS: suena solo el narrador; el resto de sonidos del juego se callan mientras dura (ver «Silencio total») y vuelven al terminar.
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
  // Para repetir el tutorial: abre la web con ?tutorial al final (p. ej. https://tu-web/?tutorial=es). Con =es, en, pt, fr, de o it también cambia el idioma.
  try {
    const q = new URLSearchParams(location.search).get('tutorial');
    if (q !== null) {
      localStorage.removeItem(KEY);
      if (['es', 'en', 'pt', 'fr', 'de', 'it'].includes(q) && window.i18n && typeof window.i18n.set === 'function') window.i18n.set(q);
    }
  } catch (e) {}
  if (returning() || logged()) return;

  const T = s => (window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(s) : s);   // traduce con las filas de i18n.js
  const IMG = n => 'images/' + n + '-s.webp';
  const HOUSES = ['casa-1', 'casa-2', 'jardin', 'pisos', 'bosque', 'casa-6', 'hospital', 'iglesia'];
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Escenas de animación (se dibujan en #tut-stage) ----------
  const STAGE = {
    move: () => `<div class="mv"><div class="mv-map"></div><span class="mv-hand">👆</span><span class="mv-arrows">⇄</span>
      <span class="mv-pinch a"></span><span class="mv-pinch b"></span><span class="mv-zoom">🔍</span></div>`,
    claim: () => `<div class="mp">
      <div class="mp-l">${T('Nombre que aparecerá en el terreno')}</div>
      <div class="mp-in"><span class="mp-type">Ana</span></div>
      <div class="mp-l">${T('Tu casa')}</div>
      <div class="mp-houses">${HOUSES.slice(0, 4).map((h, k) => `<img src="${IMG(h)}" alt="" class="${k === 1 ? 'pick' : ''}">`).join('')}</div>
      <div class="mp-btn"><span>${T('Reclamar este terreno')}</span></div>
      <span class="mp-f">👆</span></div>`,
  };

  // ---------- Guion ----------
  // ms: duración mínima de la escena; si no, se calcula según lo largo que sea el texto
  const STEPS = [
    { icon: '👋', title: '¡Bienvenido a Redecora El Mundo!', text: 'Este mapa es el mundo real. Cada cuadradito es un terreno virtual que puedes hacer tuyo, ponerle tu nombre y una casa. ¡Te lo enseño en 1 minuto!' },
    { icon: '🗺️', title: 'Muévete por el mapa', stage: 'move', text: 'Arrastra con el dedo para moverte y pellizca (o usa la rueda del ratón) para acercarte. Acércate hasta ver las parcelas y la vida de la ciudad.' },
    { icon: '☰', title: 'El Menú', target: '#menu-btn', text: 'Aquí está el Menú: 📍 tu ubicación, 🔍 buscar cualquier lugar, 🏆 ranking, 💬 chat de la zona, 🌎 Mundos (¡puedes viajar a la Luna!) y 🔊 Sonidos.' },
    { icon: '🔍', title: 'Viaja a una ciudad', sim: 'search', text: 'Para ir a cualquier sitio usa 🔍 buscar (en el Menú): escribes una ciudad y el mapa vuela hasta allí. Vamos a una ciudad de ejemplo.' },
    { icon: '🧭', title: 'Acércate a un terreno vacío', real: 'block', sim: 'zoom', ms: 7500, text: 'Vamos a volar a un terreno de verdad, sin casas. Haz zoom hasta verlo a pie de suelo para que te lo explique encima.' },
    { icon: '🟩', title: 'Terreno libre, sin casa', real: 'ground', sim: 'lot', ms: 9000, text: 'Así se ve un terreno libre a pie de calle: solo hierba y el borde de la parcela, sin ninguna casa. Mide unos 45 × 56 m y no tiene dueño todavía.' },
    { icon: '👆', title: 'Elige un terreno libre', sim: 'tap', text: 'Toca cualquier parcela libre del mapa. Se abrirá un panel con sus datos. Una vez comprada, nadie más puede quitártela.' },
    { icon: '🏠', title: 'Hazlo tuyo', sim: 'claim', ms: 10500, text: 'En el panel escribe el nombre que verá la gente, elige tu casa y pulsa «Reclamar este terreno». Cuesta créditos 🎟️.' },
    { icon: '🏡', title: '¡Tu casa aparece!', sim: 'built', ms: 8000, text: 'Al reclamarlo, tu casa aparece al instante en el mapa con tu nombre. Solo es tuya: nadie puede quitártela.' },
    { icon: '🏘️', title: 'Llegan los vecinos', sim: 'nb', ms: 9500, houses: true, text: 'Poco a poco llegan vecinos y el mapa se llena de casas. ¡Así se ve donde ya se juega!' },
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
@keyframes tg-in{from{opacity:0;transform:scale(.9)}}
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
@media (max-height:640px){#tut-stage{bottom:250px}#tut-sim{bottom:250px}}
/* Ciudad de ejemplo (mapa simulado): la cámara se mueve con transiciones según data-ph = start | search | zoom | lot | tap | claim | built | nb */
#tut-sim{position:fixed;z-index:4995;left:8px;right:8px;top:calc(124px + env(safe-area-inset-top,0px));bottom:270px;overflow:hidden;border-radius:18px;pointer-events:none;background:#cfe8a4;box-shadow:0 8px 28px #0007,0 0 0 3px #ffffffcc;font-family:system-ui,sans-serif;animation:sim-in .5s ease-out both}
@keyframes sim-in{from{opacity:0;transform:translateY(12px)}}
#tut-sim *{box-sizing:border-box}
#tut-sim svg{position:absolute;inset:0;width:100%;height:100%;display:block}
#tut-sim .world{transform-origin:0 0;transition:transform 2.6s cubic-bezier(.45,0,.2,1)}
#tut-sim[data-ph=start] .world{transform:translate(300px,300px) scale(.4) translate(-300px,-300px)}
#tut-sim[data-ph=search] .world{transform:translate(300px,300px) scale(1) translate(-300px,-300px);transition-delay:2.4s}
#tut-sim[data-ph=zoom] .world{transform:translate(300px,300px) scale(2.4) translate(-225px,-225px);transition-duration:3s;transition-delay:.4s}
#tut-sim[data-ph=lot] .world,#tut-sim[data-ph=tap] .world,#tut-sim[data-ph=built] .world,#tut-sim[data-ph=nb] .world{transform:translate(300px,300px) scale(4.2) translate(-225px,-225px);transition-duration:2.8s}
#tut-sim[data-ph=claim] .world{transform:translate(300px,150px) scale(2.2) translate(-225px,-225px);transition-duration:1.4s}
#tut-sim .lot{fill:#bfe08a;stroke:#fff;stroke-width:.9;stroke-dasharray:3 2}
#tut-sim[data-ph=tap] .lot.c{animation:sim-sel var(--d,8s) both}
@keyframes sim-sel{0%,40%{stroke:#fff;fill:#bfe08a;stroke-width:.9}46%,100%{stroke:#ffb703;fill:#ffe8a3;stroke-width:1.6}}
#tut-sim[data-ph=claim] .lot.c,#tut-sim[data-ph=built] .lot.c,#tut-sim[data-ph=nb] .lot.c{stroke:#ffb703;stroke-width:1.6;fill:#ffe8a3}
#tut-sim .pin{font-size:26px;text-anchor:middle;transition:opacity .8s;animation:sim-bob 1s ease-in-out infinite}
@keyframes sim-bob{50%{transform:translateY(-5px)}}
#tut-sim[data-ph=lot] .pin,#tut-sim[data-ph=tap] .pin,#tut-sim[data-ph=claim] .pin,#tut-sim[data-ph=built] .pin,#tut-sim[data-ph=nb] .pin{opacity:0}
#tut-sim .car{animation:sim-car 11s linear infinite}
#tut-sim .car.v{animation-name:sim-carv}
@keyframes sim-car{from{transform:translateX(-300px)}to{transform:translateX(1000px)}}
@keyframes sim-carv{from{transform:translateY(-300px)}to{transform:translateY(1000px)}}
#tut-sim .hs{opacity:0;transform-box:fill-box;transform-origin:50% 100%}
#tut-sim[data-ph=built] .hs.mine{opacity:1;animation:sim-drop 1.1s .5s cubic-bezier(.3,1.4,.5,1) both}
#tut-sim[data-ph=nb] .hs.mine{opacity:1}
#tut-sim[data-ph=nb] .hs.nb{animation:sim-pop .6s calc(.3s + var(--k) * .55s) cubic-bezier(.3,1.5,.5,1) both}
@keyframes sim-drop{0%{opacity:0;transform:translateY(-60px) scale(.5)}55%{opacity:1;transform:translateY(0) scale(1.12)}78%{transform:translateY(-4px) scale(.98)}100%{opacity:1;transform:none}}
@keyframes sim-pop{0%{opacity:0;transform:scale(0)}70%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
#tut-sim .own{opacity:0;transition:opacity .6s 1.6s}
#tut-sim[data-ph=built] .own,#tut-sim[data-ph=nb] .own{opacity:1}
#tut-sim .sx{position:absolute;left:10px;right:10px;top:10px;height:38px;border-radius:999px;background:#fff;box-shadow:0 3px 10px #0004;display:flex;align-items:center;gap:8px;padding:0 14px;font-size:16px;color:#222;z-index:3}
#tut-sim .sx-type{display:inline-block;overflow:hidden;white-space:nowrap;vertical-align:bottom;width:0;border-right:2px solid #222;animation:sx-type 1.6s .6s steps(14) forwards}
@keyframes sx-type{to{width:14.5ch;border-right-color:transparent}}
#tut-sim .sx small{margin-left:auto;font-size:11px;font-weight:800;color:#2a9d8f;white-space:nowrap}
#tut-sim .bub{position:absolute;left:50%;top:22%;padding:6px 12px;border-radius:12px;background:#0b3d2e;color:#fff;font-weight:800;font-size:14px;white-space:nowrap;opacity:0;box-shadow:0 4px 12px #0006;transform:translateX(-50%)}
#tut-sim .bub::after{content:'';position:absolute;left:50%;bottom:-6px;margin-left:-6px;border:6px solid transparent;border-top-color:#0b3d2e;border-bottom:0}
#tut-sim[data-ph=lot] .bub{animation:sim-bub .8s 3s both}
@keyframes sim-bub{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
#tut-sim .sf{position:absolute;left:50%;top:50%;font-size:40px;line-height:1;margin:-6px 0 0 -14px;opacity:0;filter:drop-shadow(0 2px 3px #0008)}
#tut-sim[data-ph=tap] .sf{animation:sim-f var(--d,8s) ease-in-out both}
@keyframes sim-f{0%{opacity:0;transform:translate(120px,150px)}18%{opacity:1;transform:translate(120px,150px)}34%{transform:translate(4px,8px)}40%{transform:translate(4px,8px) scale(.82)}46%{transform:translate(4px,8px) scale(1)}85%{opacity:1;transform:translate(4px,8px)}100%{opacity:0;transform:translate(4px,8px)}}
#tut-sim .sheet{position:absolute;left:50%;bottom:8px;width:min(92%,340px);padding:12px 14px;border-radius:16px;background:#fffffe;color:#222;box-shadow:0 -4px 20px #0005;display:none;transform:translateX(-50%)}
#tut-sim .sheet b{display:block;font-size:16px}
#tut-sim .sheet small{display:block;color:#666;margin:2px 0 8px;font-size:12px}
#tut-sim .sheet .chip{display:inline-block;padding:4px 10px;border-radius:999px;background:#d3f9d8;color:#1b6e2e;font-weight:800;font-size:13px}
#tut-sim[data-ph=tap] .sheet{display:block;animation:sim-sheet .6s calc(var(--d,8s) * .46) both}
@keyframes sim-sheet{from{opacity:0;transform:translate(-50%,50px)}to{opacity:1;transform:translate(-50%,0)}}
#tut-sim .claimp{position:absolute;left:50%;bottom:6px;display:none;transform:translateX(-50%) scale(.8);transform-origin:50% 100%}
#tut-sim[data-ph=claim] .claimp{display:block}
#tut-sim .ssp{position:absolute;left:50%;top:50%;font-size:24px;opacity:0}
#tut-sim[data-ph=built] .ssp{animation:sim-sp 1.4s 1.6s ease-out both}
#tut-sim .ssp.a{margin:-60px 0 0 -60px}#tut-sim .ssp.b{margin:-50px 0 0 40px;animation-delay:1.8s}#tut-sim .ssp.c{margin:-90px 0 0 -8px;animation-delay:2s}
@keyframes sim-sp{0%{opacity:0;transform:translateY(10px) scale(.4)}40%{opacity:1}100%{opacity:0;transform:translateY(-26px) scale(1.3)}}
#tut-lot{position:fixed;inset:0;z-index:4994;pointer-events:none;display:none}
#tut-lot.show{display:block}
#tut-lot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#tut-lot polygon{fill:rgba(255,232,163,.28);stroke:#ffb703;stroke-width:3;stroke-dasharray:7 5;stroke-linejoin:round;animation:lot-dash 1.2s linear infinite}
@keyframes lot-dash{to{stroke-dashoffset:-24}}
#tut-lot .lot-tag{position:absolute;transform:translate(-50%,-100%);padding:6px 12px;border-radius:12px;background:#0b3d2e;color:#fff;font:800 14px system-ui,sans-serif;white-space:nowrap;box-shadow:0 4px 12px #0006;opacity:0;transition:opacity .5s}
#tut-lot .lot-tag.on{opacity:1}
#tut-card .tut-voice{min-height:36px;min-width:36px;padding:0 8px;border-radius:999px;border:1px solid #fff8;background:transparent;color:#fff;font:700 16px system-ui,sans-serif;cursor:pointer}
#tut-card .tut-topr{display:flex;gap:6px;align-items:center}
@media (prefers-reduced-motion:reduce){#tut-lot polygon{animation:none !important}#tut-spot,#tut-spot.pulse,#tut-card,#tut-arrow,#tut-stage *,#tut-sim,#tut-sim *{animation:none !important;transition:none !important}.ssp{display:none}#tut-sim .sx-type{width:auto;border:0}#tut-sim .mp-type{width:auto;border:0}#tut-sim[data-ph=lot] .bub{opacity:1}#tut-sim[data-ph=built] .hs.mine,#tut-sim[data-ph=nb] .hs{opacity:1}}`;
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

  // ---------- Ciudad de ejemplo: mapa simulado en SVG (la «cámara» es la transformación de .world, ver CSS) ----------
  let sim = null;
  function seeded(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
  function cityHTML() {
    const R = seeded(7), P = [-300, -150, 0, 150, 300, 450, 600, 750, 900];
    const roofs = ['#d8d2c4', '#cbbfae', '#b9b3a6', '#e0c9b5', '#c9a89a', '#aab3bd'];
    let roads = '', blocks = '', main = '';
    for (const p of P) {
      roads += `<rect x="-600" y="${p - 11}" width="2400" height="22" fill="#f6f4ee"/><rect x="${p - 11}" y="-600" width="22" height="2400" fill="#f6f4ee"/>` +
        `<line x1="-600" y1="${p}" x2="1800" y2="${p}" stroke="#e0c76a" stroke-width="1" stroke-dasharray="8 8"/><line x1="${p}" y1="-600" x2="${p}" y2="1800" stroke="#e0c76a" stroke-width="1" stroke-dasharray="8 8"/>`;
    }
    for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < P.length - 1; j++) {
      if (P[i] === 150 && P[j] === 150) continue;                                   // la manzana protagonista se dibuja aparte
      const x0 = P[i] + 11, y0 = P[j] + 11;
      blocks += `<rect x="${x0}" y="${y0}" width="128" height="128" fill="#e9e5dc"/>`;
      if (R() < 0.2) {                                                              // parque
        blocks += `<rect x="${x0 + 4}" y="${y0 + 4}" width="120" height="120" rx="3" fill="#b9dc86"/>`;
        for (let k = 0; k < 6; k++) blocks += `<circle cx="${x0 + 14 + R() * 100}" cy="${y0 + 14 + R() * 100}" r="${5 + R() * 3}" fill="#4f9a4a"/>`;
      } else {                                                                      // edificios
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const w = 38 + R() * 16, h = 38 + R() * 16, x = x0 + 6 + a * 60 + R() * (56 - w), y = y0 + 6 + b * 60 + R() * (56 - h);
          blocks += `<rect x="${x + 2}" y="${y + 2}" width="${w}" height="${h}" fill="#0002"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${roofs[Math.floor(R() * roofs.length)]}"/>`;
        }
      }
    }
    // manzana protagonista: acera, hierba y 3×3 parcelas libres (ninguna con casa)
    main += `<rect x="161" y="161" width="128" height="128" fill="#e3dfd5"/><rect x="165" y="165" width="120" height="120" rx="2" fill="#c9e59a"/>`;
    const HS = ['casa-2', 'jardin', 'pisos', 'bosque', 'casa-6', 'hospital', 'iglesia', 'pisos-2'];
    let lots = '', houses = '', n = 0;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = 168 + c * 39, y = 168 + r * 39, mid = r === 1 && c === 1;
      lots += `<rect class="lot${mid ? ' c' : ''}" x="${x}" y="${y}" width="36" height="36" rx="2"/>`;
      for (let k = 0; k < 5; k++) lots += `<circle cx="${x + 4 + R() * 28}" cy="${y + 4 + R() * 28}" r=".7" fill="${R() < 0.5 ? '#fff' : '#f4d35e'}"/>`;
      for (const [dx, dy] of [[0, 0], [36, 0], [0, 36], [36, 36]]) lots += `<circle cx="${x + dx}" cy="${y + dy}" r="1.1" fill="#ffb703"/>`;   // mojones en las esquinas
      houses += mid ? `<image class="hs mine" href="${IMG('casa-1').replace('-s.', '-m.')}" x="${x}" y="${y}" width="36" height="36"/>`
        : `<image class="hs nb" style="--k:${n++}" href="${IMG(HS[n % HS.length]).replace('-s.', '-m.')}" x="${x}" y="${y}" width="36" height="36"/>`;
    }
    main += lots + houses;
    main += `<g class="own"><rect x="213" y="239" width="24" height="9" rx="4.5" fill="#0b3d2e"/><text x="225" y="245.6" font-size="6" font-weight="700" fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif">Ana ⭐</text></g>`;
    for (const [x, y] of [[158, 158], [292, 158], [158, 292], [292, 292], [225, 158], [225, 292], [158, 225], [292, 225]]) main += `<circle cx="${x}" cy="${y}" r="5" fill="#3f8a3f"/><circle cx="${x - 1}" cy="${y - 1}" r="3" fill="#5aae53"/>`;
    const cars = `<rect class="car" x="0" y="291" width="14" height="7" rx="2" fill="#e63946"/><rect class="car" style="animation-delay:-5s;animation-duration:14s" x="0" y="302" width="14" height="7" rx="2" fill="#1c7ed6"/>` +
      `<rect class="car v" style="animation-delay:-3s" x="291" y="0" width="7" height="14" rx="2" fill="#f2c230"/><rect class="car" style="animation-delay:-8s" x="0" y="441" width="14" height="7" rx="2" fill="#fff"/>`;
    return `<svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="-3000" y="-3000" width="6600" height="6600" fill="#cfe8a4"/>` +
      `<g class="world">${roads}${blocks}${main}${cars}<text class="pin" x="225" y="196">📍</text></g></svg>` +
      `<div class="sx"><span>🔍</span><span class="sx-box"><span class="sx-type">Ciudad Ejemplo</span></span><small>${T('Mapa de ejemplo')}</small></div>` +
      `<div class="bub">${T('Sin casa, sin dueño')}</div><span class="sf">👆</span><b class="ssp a">✨</b><b class="ssp b">✨</b><b class="ssp c">⭐</b>` +
      `<div class="sheet"><b>Terreno 349511:253638</b><small>Lat 36.819° · Lng -5.244° · ~45 × 56 m</small><span class="chip">🟩 ${T('Terreno libre')}</span></div>` +
      `<div class="claimp">${STAGE.claim()}</div>`;
  }
  function showSim(ph, d) {
    if (!sim) {
      sim = document.createElement('div'); sim.id = 'tut-sim'; sim.setAttribute('aria-hidden', 'true'); sim.setAttribute('data-notranslate', '');
      sim.dataset.ph = ph === 'search' || ph === 'zoom' ? 'start' : ph; sim.innerHTML = cityHTML(); document.body.appendChild(sim);
      void sim.offsetWidth;                                  // fija el punto de partida de la cámara para que la transición se vea
    }
    sim.style.setProperty('--d', d + 's');
    sim.dataset.ph = ph;
  }
  function hideSim() { if (sim) { sim.remove(); sim = null; } }

  // ---------- Mapa REAL: vuelo a un terreno libre de verdad y zoom a pie de suelo ----------
  // Se busca (con /api/parcel) una parcela sin dueño cerca de donde está el mapa. Si algo falla (sin red, sin config), se usa la ciudad simulada.
  let lot = null, lotP = null, lotEl = null, lotFrom = null, lotAway = false;
  async function findFreeLot() {
    try {
      if (typeof gl === 'undefined' || !gl || typeof cfg === 'undefined' || !cfg || !cfg.size || typeof api !== 'function') return null;
      const c = gl.getCenter(), sz = cfg.size, cx = Math.floor((c.lng + 180) / sz), cy = Math.floor((c.lat + 90) / sz);
      const offs = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [-2, 0], [0, -2], [2, 2], [-2, -2]];
      for (const [dx, dy] of offs) {
        const x = cx + dx, y = cy + dy, lng = (x + 0.5) * sz - 180, lat = (y + 0.5) * sz - 90;
        let p = null; try { p = await api('/api/parcel?lat=' + lat + '&lng=' + lng, { method: 'GET' }); } catch (e) { continue; }
        if (p && !p.owner) return { x, y, sz, lng, lat };
      }
    } catch (e) {}
    return null;
  }
  function prefetchLot() { if (!lotP) lotP = findFreeLot().then(r => { lot = r; return r; }); return lotP; }

  function lotCorners() {
    const w = lot.x * lot.sz - 180, e = w + lot.sz, s = lot.y * lot.sz - 90, n = s + lot.sz;
    return [[w, n], [e, n], [e, s], [w, s]];
  }
  function drawLot() {
    if (!lotEl || !lot || typeof gl === 'undefined' || !gl) return;
    try {
      const pts = lotCorners().map(c => gl.project(c)), r = gl.getContainer().getBoundingClientRect();
      lotEl.querySelector('polygon').setAttribute('points', pts.map(p => (p.x + r.left).toFixed(1) + ',' + (p.y + r.top).toFixed(1)).join(' '));
      const cx = (pts[0].x + pts[1].x) / 2 + r.left, top = Math.min(pts[0].y, pts[1].y) + r.top;
      const tag = lotEl.querySelector('.lot-tag'); tag.style.left = cx + 'px'; tag.style.top = (top - 8) + 'px';
    } catch (e) {}
  }
  function showLot(on, tag) {
    if (!on && !lotEl) return;
    if (!lotEl) {
      lotEl = document.createElement('div'); lotEl.id = 'tut-lot'; lotEl.setAttribute('aria-hidden', 'true'); lotEl.setAttribute('data-notranslate', '');
      lotEl.innerHTML = '<svg><polygon points=""/></svg><div class="lot-tag"></div>';
      document.body.appendChild(lotEl);
      try { gl.on('move', drawLot); gl.on('resize', drawLot); } catch (e) {}
    }
    lotEl.classList.toggle('show', !!on);
    const t = lotEl.querySelector('.lot-tag'); t.textContent = tag ? T('Sin casa, sin dueño') : ''; t.classList.toggle('on', !!tag);
    drawLot();
  }
  function flyReal(mode) {   // 'block' = vista de manzana; 'ground' = a pie de suelo (inclinado si el jugador tiene la vista 3D)
    try {
      if (!lotFrom) { const c = gl.getCenter(); lotFrom = { center: [c.lng, c.lat], zoom: gl.getZoom(), pitch: gl.getPitch(), bearing: gl.getBearing() }; }
      lotAway = true;
      const flat = typeof flatView !== 'undefined' && flatView;
      const pad = { top: 60, bottom: Math.min(300, Math.round(innerHeight * 0.4)), left: 0, right: 0 };   // deja libre la tarjeta de abajo
      const g = mode === 'ground';
      gl.flyTo({ center: [lot.lng, lot.lat], zoom: g ? 19.2 : 17.2, pitch: flat ? 0 : (g ? 60 : 30), bearing: g && !flat ? -15 : 0, padding: pad, duration: g ? 4200 : 3800, essential: true });
    } catch (e) {}
  }
  function flyBack(ms) {   // al acabar la parte real, el mapa vuelve a donde estaba el jugador
    if (!lotAway || !lotFrom) return;
    lotAway = false;
    try { gl.flyTo({ center: lotFrom.center, zoom: lotFrom.zoom, pitch: lotFrom.pitch, bearing: lotFrom.bearing, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: ms == null ? 2200 : ms, essential: true }); } catch (e) {}
  }

  // ---------- Silencio total mientras dura el tutorial ----------
  // El narrador SÍ suena (voz grabada y voz del navegador); se callan todos los demás sonidos (efectos, ambiente, coches, trenes, lluvia, voces de los vecinos, música).
  // Cada módulo crea su propio AudioContext, así que se suspenden todos (se detectan al conectar nodos) y se bloquea su resume() y el
  // speechSynthesis mientras dure el tutorial. Al terminar se reanuda lo que estaba sonando.
  let silent = false, ssSpeak = null, narrating = false;   // narrating: solo el narrador puede usar speechSynthesis
  const audioCtxs = new Set(), wasRunning = new Set();
  const ACls = window.AudioContext || window.webkitAudioContext;
  const nodeP = window.AudioNode && window.AudioNode.prototype;
  const origConnect = nodeP && nodeP.connect, origResume = ACls && ACls.prototype.resume;
  function suspendCtx(c) { try { if (c.state === 'running') { wasRunning.add(c); c.suspend(); } } catch (e) {} }
  function hushSpeech() { if (talking) return; try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch (e) {} }
  function hush() { audioCtxs.forEach(suspendCtx); hushSpeech(); try { if (!talking && window.atlasVoice) window.atlasVoice.stop(); } catch (e) {} }
  function silence(on) {
    if (on === silent) return;
    silent = on;
    if (on) {
      if (nodeP && origConnect) nodeP.connect = function () { try { if (this.context) { audioCtxs.add(this.context); if (silent) suspendCtx(this.context); } } catch (e) {} return origConnect.apply(this, arguments); };
      if (ACls && origResume) ACls.prototype.resume = function () { if (silent) { audioCtxs.add(this); return Promise.resolve(); } return origResume.apply(this, arguments); };
      try { if (window.speechSynthesis) { ssSpeak = speechSynthesis.speak; speechSynthesis.speak = function (u) { if (!silent || narrating) return ssSpeak.call(speechSynthesis, u); }; } } catch (e) {}
      document.querySelectorAll('audio,video').forEach(m => { try { m.pause(); } catch (e) {} });
      hush();
    } else {
      if (nodeP && origConnect) nodeP.connect = origConnect;
      if (ACls && origResume) ACls.prototype.resume = origResume;
      try { if (ssSpeak) { speechSynthesis.speak = ssSpeak; ssSpeak = null; } } catch (e) {}
      wasRunning.forEach(c => { try { c.resume(); } catch (e) {} });
      wasRunning.clear();
    }
  }


  // ---------- Narrador: voz masculina en el idioma / país del jugador ----------
  // El idioma sale de i18n (elegido en el menú, o el del navegador, o el país por zona horaria). La región (es-MX, en-GB, pt-PT…) sale de los idiomas del navegador.
  // Los navegadores no dicen si una voz es de hombre o mujer: se elige por nombre conocido y, si no hay pistas, se baja el tono.
  const LOCALE = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', fr: 'fr-FR', de: 'de-DE', it: 'it-IT' };
  const MALE = /\b(jorge|diego|juan|carlos|pablo|enrique|raul|raúl|miguel|andres|andrés|alvaro|álvaro|david|daniel|alex|mark|james|george|thomas|fred|aaron|arthur|guy|rishi|ryan|oliver|luca|cosimo|giorgio|antonio|felipe|luciano|ricardo|cristiano|markus|stefan|hans|jan|conrad|claude|henri|paul|thierry|nicolas|mathieu|male|masculin|hombre)\b/i;
  const FEMALE = /\b(monica|mónica|paulina|helena|lucia|lucía|sabina|laura|marisol|female|femenin|mujer|samantha|karen|moira|tessa|zira|susan|hazel|catherine|amelie|amélie|audrey|julie|marie|virginia|elsa|federica|alice|paola|anna|petra|vicki|maria|maría|luciana|francisca|joana)\b/i;
  let narrOn = true, talking = false, talkGen = 0;
  // Voz grabada: idiomas con archivos en audio/tutorial/<idioma>/<paso>.mp3 (paso 1..13). El resto usa la voz del navegador.
  const CLIP_LANGS = { es: true };
  let clip = null;
  function clipStop() { if (clip) { try { clip.onended = clip.onerror = clip.onplaying = null; clip.pause(); } catch (e) {} clip = null; } }
  try { narrOn = localStorage.getItem('tutVoice') !== '0' && !(window.atlasVoice && window.atlasVoice.muted); } catch (e) {}
  const hasTTS = !!window.speechSynthesis && !!window.SpeechSynthesisUtterance;
  const hasVoice = () => hasTTS || !!CLIP_LANGS[curLang()];
  const curLang = () => { const l = window.i18n && window.i18n.lang; return LOCALE[l] ? l : 'es'; };
  function regionLocale(l) {   // p. ej. es-MX si el navegador dice es-MX; si no, el de por defecto
    try { for (const x of (navigator.languages || [navigator.language || ''])) if (String(x).toLowerCase().startsWith(l + '-')) return String(x).replace('_', '-'); } catch (e) {}
    return LOCALE[l];
  }
  function pickNarrator() {
    const l = curLang(), want = regionLocale(l).toLowerCase();
    let vs = []; try { vs = (speechSynthesis.getVoices() || []).filter(v => String(v.lang).toLowerCase().replace('_', '-').startsWith(l)); } catch (e) {}
    if (!vs.length) return { voice: null, lang: regionLocale(l), male: false };
    const sc = v => {
      const lg = String(v.lang).toLowerCase().replace('_', '-');
      return (lg === want ? 4 : 0) + (MALE.test(v.name) ? 5 : 0) - (FEMALE.test(v.name) ? 8 : 0) + (v.localService ? 1 : 0);
    };
    vs.sort((a, b) => sc(b) - sc(a));
    return { voice: vs[0], lang: vs[0].lang, male: MALE.test(vs[0].name) && !FEMALE.test(vs[0].name) };
  }
  function cleanSpeech(t) {
    return String(t).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ').replace(/[«»]/g, '"').replace(/\s+/g, ' ').trim();
  }
  function narrate(text) {
    narrStop();
    if (!hasVoice() || !narrOn || document.hidden) return;
    const my = ++talkGen, t = cleanSpeech(text); if (!t) return;
    const step = idx + 1;
    if (CLIP_LANGS[curLang()] && step >= 1) {   // voz grabada
      try {
        if (window.atlasVoice) window.atlasVoice.stop();   // calla a los vecinos para que se oiga al narrador
        const a = new Audio('audio/tutorial/' + curLang() + '/' + step + '.mp3');
        clip = a; talking = true;
        a.onended = () => { if (my === talkGen) { talking = false; clip = null; } };
        a.onerror = () => { if (my === talkGen) { talking = false; clip = null; if (hasTTS) go(); } };
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => { if (my === talkGen) { talking = false; clip = null; if (hasTTS) go(); } });
        return;
      } catch (e) { talking = false; clip = null; }
    }
    if (!hasTTS) return;
    function go() {
      if (my !== talkGen || ended) return;
      try {
        const n = pickNarrator(), u = new SpeechSynthesisUtterance(t);
        u.lang = n.lang; if (n.voice) u.voice = n.voice;
        u.rate = 1; u.pitch = n.male ? 0.95 : 0.7; u.volume = 1;   // sin pista de género: tono grave para que suene a hombre
        u.onstart = () => { if (my === talkGen) talking = true; };
        u.onend = u.onerror = () => { if (my === talkGen) talking = false; };
        talking = true;
        narrating = true; try { speechSynthesis.speak(u); } finally { narrating = false; }
      } catch (e) { talking = false; }
    };
    try { if (window.atlasVoice) window.atlasVoice.stop(); } catch (e) {}   // calla a los vecinos para que se oiga al narrador
    setTimeout(go, 250);   // deja tiempo a que cancel() termine
    try { if (!speechSynthesis.getVoices().length) speechSynthesis.addEventListener('voiceschanged', () => { if (my === talkGen && !talking) go(); }, { once: true }); } catch (e) {}
  }
  function narrStop() { talkGen++; talking = false; clipStop(); try { if (hasTTS) speechSynthesis.cancel(); } catch (e) {} }
  function paintVoiceBtn() { const b = card && card.querySelector('.tut-voice'); if (b) { b.textContent = narrOn ? '🔊' : '🔇'; b.setAttribute('aria-label', narrOn ? T('Voz activada') : T('Voz desactivada')); } }

  function finish() {
    if (ended) return;
    ended = true;
    narrStop(); silence(false); flyBack(1800);
    if (lotEl) { try { gl.off('move', drawLot); gl.off('resize', drawLot); } catch (e) {} lotEl.remove(); lotEl = null; }
    clearInterval(timer); timer = null;

    removeEventListener('resize', place); document.removeEventListener('keydown', onKey);
    showHouses(); hideSim();
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
      <div class="tut-top"><span class="tut-step">${n + 1} / ${STEPS.length}</span><span class="tut-topr">${hasVoice() ? '<button type="button" class="tut-voice"></button>' : ''}<button type="button" class="tut-skip">${T('Saltar tutorial')}</button></span></div>
      <h3 data-notranslate></h3>
      <p data-notranslate><span class="sr"></span><span aria-hidden="true"><span class="on"></span><span class="off"></span></span></p>
      ${s.extra || s.last ? `<div class="tut-btns">${s.extra ? `<button type="button" class="tut-extra">${T(s.extra.label)}</button>` : ''}<button type="button" class="tut-next">${T('¡A jugar!')}</button></div>` : ''}
      <div class="tut-bar" aria-hidden="true"><i></i></div>
      <div class="tut-dots" aria-hidden="true">${STEPS.map((_, k) => `<i${k === n ? ' class="on"' : ''}></i>`).join('')}</div>`;
    card.querySelector('h3').textContent = s.icon + ' ' + T(s.title);
    card.querySelector('.sr').textContent = full;
    card.querySelector('.off').textContent = full;
    card.querySelector('.tut-skip').onclick = finish;
    const vb = card.querySelector('.tut-voice');
    if (vb) vb.onclick = () => { narrOn = !narrOn; try { localStorage.setItem('tutVoice', narrOn ? '1' : '0'); } catch (e) {} if (narrOn) narrate(T(STEPS[idx].text)); else narrStop(); paintVoiceBtn(); };
    paintVoiceBtn();
    const nx = card.querySelector('.tut-next'); if (nx) nx.onclick = finish;
    const x = card.querySelector('.tut-extra'); if (x) x.onclick = () => { try { s.extra.run(); } catch (e) {} };
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    // Escenario con animación (se vuelve a crear en cada escena para que la animación empiece de cero)
    stage.className = ''; stage.innerHTML = '';
    if (s.stage) { stage.style.setProperty('--d', (dur / 1000) + 's'); stage.innerHTML = STAGE[s.stage](); stage.className = 'show'; }
    if (n >= 2 && !lotP) prefetchLot();   // mientras se lee el menú, se busca un terreno libre de verdad
    const real = s.real && lot && typeof gl !== 'undefined' && gl;
    if (real) { hideSim(); showLot(true, s.real === 'ground'); flyReal(s.real); }
    else {
      showLot(false);
      if (!s.real && !s.sim) flyBack();   // pasos con el mapa real otra vez: vuelve a donde estaba el jugador
      if (s.sim) showSim(s.sim, dur / 1000); else hideSim();
    }
    narrate(full);
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
    if (el % 500 < TICK) hush();                                                 // red de seguridad: cualquier sonido que se cuele se corta
    const hide = modalOpen() || document.hidden;                                  // si hay una ventana abierta (p. ej. el inicio de sesión), se aparta y el guion espera
    card.style.display = hide ? 'none' : ''; spot.style.visibility = hide ? 'hidden' : '';
    stage.style.visibility = hide ? 'hidden' : ''; if (lotEl) lotEl.style.visibility = hide ? 'hidden' : ''; arrow.style.visibility = hide ? 'hidden' : ''; shield.style.display = hide ? 'none' : '';
    if (sim) sim.style.visibility = hide ? 'hidden' : '';
    if (hide) { if (talking) narrStop(); return; }
    if (el >= dur && talking && el < dur + 9000) { el += TICK; paint(); return; }   // el narrador no se corta: se espera a que termine la frase (máx. 9 s)
    el += TICK;
    paint();
    if (el >= dur) { if (idx >= STEPS.length - 1) finish(); else enter(idx + 1); }
    else if (el % 500 < TICK) place();
  }

  function begin() {
    if (started || logged() || document.getElementById('tut-card')) return;
    started = true;
    silence(true);     // sin sonidos durante todo el tutorial
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
