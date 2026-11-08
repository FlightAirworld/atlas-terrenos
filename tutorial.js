'use strict';
// Tutorial guiado para jugadores nuevos. Sale al pulsar "▶ Jugar" en la portada y explica, paso a paso y con indicaciones
// sobre la pantalla, qué hay que hacer. Tiene botón "Saltar tutorial".
// No sale si el jugador ya tiene sesión o cuenta guardada, ni si ya lo vio antes (se recuerda en el navegador).
// Se quita solo en cuanto el jugador inicia sesión. Para volver a verlo: localStorage.removeItem('tutorialDone') y recargar.
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

  const STEPS = [
    { icon: '👋', title: '¡Bienvenido a Redecora El Mundo!', text: 'Este mapa es el mundo real. Cada cuadradito es un terreno virtual que puedes hacer tuyo, ponerle tu nombre y una casa. ¡Te lo enseño en 1 minuto!' },
    { icon: '🗺️', title: 'Muévete por el mapa', text: 'Arrastra con el dedo para moverte y pellizca (o usa la rueda del ratón) para acercarte. Acércate hasta ver las parcelas y la vida de la ciudad.' },
    { icon: '☰', title: 'El Menú', target: '#menu-btn', text: 'Aquí está el Menú: 📍 tu ubicación, 🔍 buscar cualquier lugar, 🏆 ranking, 💬 chat de la zona, 🌎 Mundos (¡puedes viajar a la Luna!) y 🔊 Sonidos.' },
    { icon: '👆', title: 'Elige un terreno libre', text: 'Toca cualquier parcela libre del mapa. Se abrirá un panel con sus datos. Una vez comprada, nadie más puede quitártela.' },
    { icon: '🏠', title: 'Hazlo tuyo', text: 'En el panel escribe el nombre que verá la gente, elige tu casa y pulsa «Reclamar este terreno». Cuesta créditos 🎟️.' },
    { icon: '🎟️', title: 'Tus créditos', target: '#credit-pill', text: 'Aquí ves cuántos créditos tienes. Tócalo para ver tus terrenos y recoger lo que producen cada hora.' },
    { icon: '⭐', title: 'Más créditos gratis', target: '#extras-btn', text: 'En Extras tienes 🎁 el regalo diario, 🎡 la ruleta, 👫 Invita y gana y 📖 Cómo jugar. ¡Entra cada día!' },
    { icon: '👤', title: 'Entra para guardar todo', text: 'Inicia sesión (Google o email) para guardar tus terrenos y tu racha, y recibir tu regalo de bienvenida.', extra: { label: 'Entrar ahora', run() { if (typeof openLogin === 'function') openLogin(); } } }
  ];

  const css = document.createElement('style');
  css.id = 'tutorial-css';
  css.textContent = `
body.tut-on #welcome{display:none !important}
#tut-spot{position:fixed;z-index:4990;border-radius:14px;pointer-events:none;box-shadow:0 0 0 9999px rgba(4,26,20,.62);outline:3px solid #ffb703;outline-offset:2px;transition:left .25s ease,top .25s ease,width .25s ease,height .25s ease}
#tut-spot.pulse{animation:tut-pulse 1.4s ease-in-out infinite}
@keyframes tut-pulse{50%{outline-color:#fff;outline-offset:5px}}
#tut-card{position:fixed;z-index:5000;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(94vw,400px);box-sizing:border-box;padding:14px 16px 14px;border-radius:18px;background:rgba(11,61,46,.97);color:#fff;box-shadow:0 6px 26px rgba(0,0,0,.5);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;animation:tut-in .25s ease-out}
@keyframes tut-in{from{opacity:0;transform:translate(-50%,10px)}}
#tut-card .tut-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
#tut-card .tut-step{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#ffb703}
#tut-card .tut-skip{min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #fff8;background:transparent;color:#fff;font:700 13px system-ui,sans-serif;cursor:pointer}
#tut-card h3{margin:0 0 4px;font-size:18px;line-height:1.25}
#tut-card p{margin:0 0 12px;font-size:15px;line-height:1.4;font-weight:500}
#tut-card .tut-dots{display:flex;gap:5px;justify-content:center;margin:0 0 12px}
#tut-card .tut-dots i{width:7px;height:7px;border-radius:50%;background:#fff4}
#tut-card .tut-dots i.on{background:#ffb703}
#tut-card .tut-btns{display:flex;gap:8px}
#tut-card .tut-btns button{min-height:44px;border-radius:999px;font:800 15px system-ui,sans-serif;cursor:pointer;padding:0 14px}
#tut-card .tut-back{background:transparent;color:#fff;border:1px solid #fff8}
#tut-card .tut-extra{background:#fff;color:#0b3d2e;border:0}
#tut-card .tut-next{flex:1;background:#ffb703;color:#222;border:0}
@media (prefers-reduced-motion:reduce){#tut-spot,#tut-spot.pulse,#tut-card{animation:none;transition:none}}`;
  document.head.appendChild(css);

  let i = 0, card = null, spot = null, timer = null, started = false;
  const $q = s => document.querySelector(s);

  function finish() {
    clearInterval(timer); timer = null;
    document.body.classList.remove('tut-on');
    if (card) card.remove(); if (spot) spot.remove(); card = spot = null;
    lsSet(KEY, '1');
  }

  function place() {   // pone el foco sobre el elemento del paso, si lo hay y se ve
    if (!card) return;
    const s = STEPS[i], el = s.target ? $q(s.target) : null;
    const r = el ? el.getBoundingClientRect() : null;
    if (r && r.width > 0 && r.height > 0) {
      spot.style.display = 'block';
      spot.style.left = (r.left - 4) + 'px'; spot.style.top = (r.top - 4) + 'px';
      spot.style.width = (r.width + 8) + 'px'; spot.style.height = (r.height + 8) + 'px';
    } else spot.style.display = 'none';
  }

  function render() {
    const s = STEPS[i], last = i === STEPS.length - 1;
    card.innerHTML = `
      <div class="tut-top"><span class="tut-step">Paso ${i + 1} de ${STEPS.length}</span><button type="button" class="tut-skip">Saltar tutorial</button></div>
      <h3>${s.icon} ${s.title}</h3>
      <p>${s.text}</p>
      <div class="tut-dots" aria-hidden="true">${STEPS.map((_, k) => `<i${k === i ? ' class="on"' : ''}></i>`).join('')}</div>
      <div class="tut-btns">${i > 0 ? '<button type="button" class="tut-back">Atrás</button>' : ''}${s.extra ? `<button type="button" class="tut-extra">${s.extra.label}</button>` : ''}<button type="button" class="tut-next">${last ? '¡A jugar!' : 'Siguiente'}</button></div>`;
    card.querySelector('.tut-skip').onclick = finish;
    card.querySelector('.tut-next').onclick = () => { if (last) finish(); else { i++; render(); } };
    const b = card.querySelector('.tut-back'); if (b) b.onclick = () => { i--; render(); };
    const x = card.querySelector('.tut-extra'); if (x) x.onclick = () => { try { s.extra.run(); } catch (e) {} };
    spot.classList.toggle('pulse', !!s.target);
    place();
  }

  function begin() {
    if (started || logged() || document.getElementById('tut-card')) return;
    started = true;
    lsSet(KEY, '1');   // a partir de aquí cuenta como visto: no vuelve a salir en este navegador
    document.body.classList.add('tut-on');
    spot = document.createElement('div'); spot.id = 'tut-spot'; spot.setAttribute('aria-hidden', 'true'); document.body.appendChild(spot);
    card = document.createElement('div'); card.id = 'tut-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite'); card.setAttribute('aria-label', 'Tutorial'); document.body.appendChild(card);
    render();
    timer = setInterval(() => {
      if (logged()) { finish(); return; }                                       // al iniciar sesión, el tutorial se quita
      const modal = document.querySelector('.modal:not(.hidden), #login:not(.hidden)');   // si hay una ventana abierta (p. ej. el inicio de sesión), se aparta
      const hide = !!modal;
      card.style.display = hide ? 'none' : ''; spot.style.visibility = hide ? 'hidden' : '';
      place();
    }, 300);
    addEventListener('resize', place);
  }

  // Arranca al pulsar «▶ Jugar» (si la portada no se muestra, por ejemplo al recargar, arranca solo un poco después de cargar)
  const play = document.getElementById('cover-play');
  if (window.coverOpen && play) play.addEventListener('click', () => setTimeout(begin, 900));
  else setTimeout(begin, 1800);
})();
