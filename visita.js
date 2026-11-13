'use strict';
// VISITAR UNA CASA: en el panel de una casa que no es tuya sale el botón «🚪 ENTRA A LA CASA».
// Al pulsarlo se abre una escena totalmente automática (~1,5 min):
//   · Fuera no se oye nada (ciudad, música, lluvia, coches...): solo suena lo de dentro de la casa (puerta, sillas, vasos y la conversación).
//   · Llamas a la puerta, el anfitrión viene a abrir y te dice «¡PASA, BIENVENIDO!». Las personas tienen cuerpo (cabeza, tronco, brazos,
//     piernas y zapatos), caminan por la casa, se giran, gesticulan y mueven la boca al hablar.
//   · El anfitrión te ofrece un refresco, va a la nevera, te lo trae y brindáis. Luego os sentáis en el sofá y charláis.
//   · Todo al azar en cada visita: la decoración, la vista de la ventana, el aspecto de las personas, quién hay, los temas y las frases.
//   · TODO HABLADO con la voz del navegador (cada persona con su tono y su voz); si no hay voz (o está apagada en 🔊 «Gente y voces») se lee en pantalla.
//   · Al irte te dicen «HASTA LA PRÓXIMA» y te regalan 1 crédito (lo decide el servidor: /api/visit/start y /api/visit/finish en server.js).
//   · Se puede entrar como mucho 3 veces al día (VISIT_ENTRIES_MAX en server.js; sin cuenta se cuenta en el navegador).
// Usa globals de app.js: api(), authToken, refreshCredits(), flashToast(), sfx(). Y de sounds.js: houseMute().
(function () {
  const btn = document.getElementById('enter-house-btn');
  if (!btn) return;
  let running = null;           // la visita en curso
  const ENTRIES_MAX = 3;        // entradas al día (igual que VISIT_ENTRIES_MAX del servidor)
  const W = 560, H = 340;       // el escenario mide 560×340 y se escala entero al ancho de la pantalla

  // ---------- Estilos ----------
  const st = document.createElement('style');
  st.textContent = `
    #visita { position: fixed; inset: 0; z-index: 3000; background: #000b; display: grid; place-items: center; padding: 12px; }
    #visita .v-card { position: relative; width: min(600px, 100%); background: #2b1d14; border-radius: 16px; padding: 12px 12px 14px; color: #fff; box-shadow: 0 10px 40px #000a; }
    #visita .v-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 800; }
    #visita .v-x { background: #0006; color: #fff; border: 0; border-radius: 999px; width: 34px; height: 34px; font-size: 20px; cursor: pointer; flex: none; }
    #visita .v-wrap { position: relative; width: 100%; max-width: ${W}px; margin: 0 auto; overflow: hidden; border-radius: 12px; background: #000; }
    #visita .v-room { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; overflow: hidden; background: var(--wall, #f3d9a4); }
    #visita .v-room * { box-sizing: border-box; }
    #visita .v-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 140px; background: var(--floor, #b07a45); }
    #visita .v-floor::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, #0000 0 54px, #0002 54px 56px); }
    #visita .v-floor::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10px; background: linear-gradient(#0003, #0000); }
    #visita .v-base { position: absolute; left: 0; right: 0; bottom: 138px; height: 8px; background: #0003; }
    #visita .v-rug { position: absolute; left: 170px; width: 240px; bottom: 16px; height: 78px; border-radius: 50%; background: var(--rug, #a33); box-shadow: inset 0 0 0 6px #fff3, inset 0 0 0 12px #0002; z-index: 1; }
    #visita .v-win { position: absolute; left: 104px; bottom: 212px; width: 86px; height: 88px; border: 6px solid #7a4b24; border-radius: 6px; overflow: hidden; background: var(--sky, #9fd8ff); z-index: 2; display: grid; place-items: center; font-size: 30px; }
    #visita .v-win::before, #visita .v-win::after { content: ''; position: absolute; background: #7a4b24; }
    #visita .v-win::before { left: 50%; top: 0; bottom: 0; width: 4px; margin-left: -2px; }
    #visita .v-win::after { top: 50%; left: 0; right: 0; height: 4px; margin-top: -2px; }
    #visita .v-win span { position: relative; z-index: 1; }
    #visita .v-wall-i { position: absolute; z-index: 2; line-height: 1; text-align: center; }
    #visita .v-tv { position: absolute; left: 245px; bottom: 232px; width: 110px; height: 64px; background: #111; border: 4px solid #333; border-radius: 6px; display: grid; place-items: center; font-size: 30px; z-index: 2; box-shadow: 0 0 14px #6cf5; }
    #visita .v-frame { position: absolute; background: #fff; border: 5px solid #7a4b24; border-radius: 3px; display: grid; place-items: center; z-index: 2; }
    #visita .v-doorframe { position: absolute; left: 10px; bottom: 132px; width: 70px; height: 150px; background: #1c1209; border: 5px solid #7a4b24; border-bottom: 0; border-radius: 6px 6px 0 0; z-index: 2; }
    #visita .v-door { position: absolute; left: 10px; bottom: 132px; width: 70px; height: 150px; background: #5a3418; border-radius: 6px 6px 0 0; transform-origin: left center; transition: transform .9s ease; z-index: 3; box-shadow: inset 0 0 0 5px #7a4b24; }
    #visita .v-door::after { content: ''; position: absolute; right: 9px; top: 76px; width: 9px; height: 9px; border-radius: 50%; background: #f0c040; }
    #visita .v-door.open { transform: perspective(600px) rotateY(-72deg); }
    #visita .v-bell { position: absolute; left: 88px; bottom: 214px; width: 26px; height: 26px; border-radius: 50%; background: #f0c040; border: 3px solid #7a4b24; display: grid; place-items: center; font-size: 13px; line-height: 1; z-index: 6; box-shadow: 0 2px 0 #0004; }
    #visita .v-bell.ring { animation: v-ring .5s ease-in-out 2; background: #fff176; }
    #visita .v-bell-wave { position: absolute; left: 82px; bottom: 208px; width: 38px; height: 38px; border-radius: 50%; border: 3px solid #ffe680; opacity: 0; z-index: 5; pointer-events: none; }
    #visita .v-bell-wave.on { animation: v-wave 1s ease-out 2; }
    @keyframes v-ring { 0%, 100% { transform: rotate(0) scale(1); } 25% { transform: rotate(-14deg) scale(1.15); } 75% { transform: rotate(14deg) scale(1.15); } }
    @keyframes v-wave { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(2.2); opacity: 0; } }
    #visita .v-sofa-back { position: absolute; left: 204px; width: 172px; bottom: 118px; height: 78px; background: var(--sofa, #8e5a3c); border-radius: 22px 22px 0 0; z-index: 5; box-shadow: inset 0 -10px 0 #0002; }
    #visita .v-sofa-front { position: absolute; left: 200px; width: 180px; bottom: 82px; height: 40px; background: var(--sofa, #8e5a3c); border-radius: 10px 10px 4px 4px; z-index: 17; box-shadow: inset 0 6px 0 #fff2, inset 0 -8px 0 #0003; filter: brightness(1.08); }
    #visita .v-sofa-arm { position: absolute; width: 18px; bottom: 82px; height: 66px; background: var(--sofa, #8e5a3c); border-radius: 10px 10px 4px 4px; z-index: 17; box-shadow: inset -3px 0 0 #0003; }
    #visita .v-plant { position: absolute; left: 150px; bottom: 98px; font-size: 48px; line-height: 1; z-index: 4; }
    #visita .v-lamp { position: absolute; left: 404px; bottom: 100px; width: 30px; height: 128px; z-index: 4; }
    #visita .v-lamp::before { content: ''; position: absolute; left: 13px; bottom: 0; width: 4px; height: 100px; background: #4a3a2a; }
    #visita .v-lamp::after { content: ''; position: absolute; left: 0; bottom: 92px; width: 30px; height: 26px; background: var(--lamp, #f6d56a); clip-path: polygon(20% 0, 80% 0, 100% 100%, 0 100%); box-shadow: 0 0 22px 8px #ffe68055; }
    #visita .v-shelf { position: absolute; left: 395px; bottom: 246px; width: 52px; height: 6px; background: #7a4b24; z-index: 2; }
    #visita .v-shelf-i { position: absolute; left: 395px; bottom: 252px; width: 52px; display: flex; justify-content: space-around; font-size: 20px; line-height: 1; z-index: 2; }
    #visita .v-fridge { position: absolute; left: 456px; bottom: 132px; width: 72px; height: 130px; z-index: 2; }
    #visita .v-fridge .in { position: absolute; inset: 0; background: #e8f3f8; border: 3px solid #b8c6cc; border-radius: 6px; display: none; flex-direction: column; justify-content: space-around; align-items: center; font-size: 20px; padding: 6px 0; }
    #visita .v-fridge.open .in { display: flex; box-shadow: inset 0 0 18px #fff; }
    #visita .v-fridge .fd { position: absolute; inset: 0; background: linear-gradient(90deg, #dfe6ea, #f5f8fa 40%, #d9e1e5); border: 3px solid #b8c6cc; border-radius: 6px; transform-origin: left center; transition: transform .5s ease; }
    #visita .v-fridge .fd::before { content: ''; position: absolute; right: 7px; top: 20px; width: 5px; height: 36px; border-radius: 3px; background: #7d8a90; }
    #visita .v-fridge .fd::after { content: ''; position: absolute; left: 0; right: 0; top: 48%; height: 3px; background: #b8c6cc; }
    #visita .v-fridge.open .fd { transform: perspective(500px) rotateY(-68deg); }
    #visita .v-clock { position: absolute; left: 478px; bottom: 284px; font-size: 26px; line-height: 1; z-index: 2; }
    #visita .v-pet { position: absolute; font-size: 28px; line-height: 1; margin-left: -14px; transform-origin: 50% 100%; }
    #visita .v-pet span { display: block; }
    #visita .v-night { position: absolute; inset: 0; background: #0a1030; opacity: 0; pointer-events: none; z-index: 40; transition: opacity 1s; }
    #visita .v-bubble { position: absolute; z-index: 8; max-width: 78%; background: #fff; color: #1b1b1b; border-radius: 14px; padding: 6px 11px 7px; font-size: 15px; font-weight: 700; line-height: 1.25; box-shadow: 0 3px 10px #0005; opacity: 0; transform: translateY(6px) scale(.96); transition: opacity .2s, transform .2s; pointer-events: none; }
    #visita .v-bubble.on { opacity: 1; transform: none; }
    #visita .v-bubble b { display: block; font-size: 11px; font-weight: 800; color: #a05a1c; margin-bottom: 1px; }
    #visita .v-bubble::after { content: ''; position: absolute; left: var(--tail, 50%); bottom: -7px; margin-left: -7px; border: 7px solid transparent; border-bottom: 0; border-top-color: #fff; }
    #visita .v-bubble.big { font-size: 19px; font-weight: 900; }
    #visita .v-gift { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; background: #000a; text-align: center; font-size: 20px; font-weight: 900; padding: 16px; opacity: 0; pointer-events: none; transition: opacity .4s; }
    #visita .v-gift.on { opacity: 1; }
    #visita .v-gift b { display: block; font-size: 54px; animation: v-pop .8s ease-out; }
    #visita .v-sub { text-align: center; font-size: 12px; opacity: .8; margin-top: 8px; min-height: 16px; }

    /* ----- Personas: cabeza, cuello, tronco, brazos, piernas y zapatos ----- */
    #visita .v-fig { position: absolute; width: 52px; height: 124px; margin-left: -26px; transform-origin: 50% 100%; }
    #visita .v-flip { position: absolute; inset: 0; transition: transform .25s, opacity .3s; }
    #visita .v-body { position: absolute; inset: 0; transition: transform .6s ease; }
    #visita .v-body i, #visita .v-body b, #visita .v-body span { position: absolute; display: block; font-style: normal; font-weight: normal; }
    #visita .v-fig .leg { left: 12px; top: 74px; width: 13px; height: 44px; background: var(--pants); border-radius: 4px 4px 3px 3px; transform-origin: 50% 4px; box-shadow: inset -3px 0 0 #0002; }
    #visita .v-fig .leg.r { left: 27px; }
    #visita .v-fig .leg::after { content: ''; position: absolute; left: -1px; bottom: -5px; width: 18px; height: 8px; border-radius: 6px 8px 3px 3px; background: var(--shoe); }
    #visita .v-fig .torso { left: 10px; top: 32px; width: 32px; height: 45px; border-radius: 12px 12px 7px 7px; background: var(--top); box-shadow: inset -5px 0 0 #0002, inset 0 -6px 0 #0001; }
    #visita .v-fig .skirt { display: none; left: 7px; top: 62px; width: 38px; height: 38px; background: var(--btm); clip-path: polygon(16% 0, 84% 0, 100% 100%, 0 100%); border-radius: 0 0 6px 6px; }
    #visita .v-fig.dress .skirt { display: block; }
    #visita .v-fig.dress .leg { top: 90px; height: 28px; background: var(--skin); }
    #visita .v-fig .arm { left: 1px; top: 34px; width: 9px; height: 38px; border-radius: 5px; background: linear-gradient(var(--top) 0 var(--sleeve, 45%), var(--skin) var(--sleeve, 45%) 100%); transform-origin: 50% 5px; }
    #visita .v-fig .arm.r { left: 42px; }
    #visita .v-fig .hold { display: none; left: -5px; top: 28px; font-size: 19px; line-height: 1; }
    #visita .v-fig.holding .hold { display: block; }
    #visita .v-fig .neck { left: 22px; top: 26px; width: 8px; height: 9px; background: var(--skin); filter: brightness(.92); }
    #visita .v-fig .head { left: 12px; top: 0; width: 28px; height: 30px; border-radius: 50% 50% 46% 46%; background: var(--skin); }
    #visita .v-fig .head i, #visita .v-fig .head b { position: absolute; }
    #visita .v-fig .hf, #visita .v-fig .hb { background: var(--hair); }
    #visita .v-fig .hf { left: -1px; top: -3px; width: 30px; height: 13px; border-radius: 15px 15px 4px 4px; }
    #visita .v-fig .hb { display: none; z-index: -1; }
    #visita .v-fig.h-long .hb { display: block; left: -4px; top: 2px; width: 36px; height: 46px; border-radius: 14px 14px 9px 9px; }
    #visita .v-fig.h-pony .hb { display: block; left: 20px; top: 4px; width: 13px; height: 34px; border-radius: 7px; }
    #visita .v-fig.h-bun .hf::before { content: ''; position: absolute; left: 8px; top: -9px; width: 13px; height: 13px; border-radius: 50%; background: var(--hair); }
    #visita .v-fig.h-curly .hf { left: -5px; top: -7px; width: 38px; height: 22px; border-radius: 50%; }
    #visita .v-fig.h-curly .hb { display: block; left: -5px; top: 2px; width: 38px; height: 24px; border-radius: 50%; }
    #visita .v-fig.h-bald .hf { display: none; }
    #visita .v-fig .beard { display: none; left: 1px; top: 15px; width: 26px; height: 15px; border-radius: 2px 2px 14px 14px; background: var(--hair); filter: brightness(.9); }
    #visita .v-fig.has-beard .beard { display: block; }
    #visita .v-fig .nose { left: 12.5px; top: 15px; width: 3px; height: 5px; border-radius: 50%; background: var(--skin); filter: brightness(.86); }
    #visita .v-fig .mouth { left: 9.5px; top: 22px; width: 9px; height: 2.6px; border-radius: 0 0 8px 8px; background: #9a4545; }
    #visita .v-fig .eye { top: 12px; width: 3.6px; height: 4.4px; border-radius: 50%; background: #2a211c; animation: v-blink 5s infinite; }
    #visita .v-fig .eye.l { left: 7px; } #visita .v-fig .eye.r { left: 17.4px; animation-delay: .1s; }
    #visita .v-fig .brow { top: 8px; width: 7px; height: 1.8px; border-radius: 2px; background: var(--hair); filter: brightness(.8); }
    #visita .v-fig .brow.l { left: 5.5px; } #visita .v-fig .brow.r { left: 15.5px; }
    #visita .v-fig .glasses { display: none; left: 3px; top: 9.5px; width: 22px; height: 9px; }
    #visita .v-fig.has-glasses .glasses { display: block; }
    #visita .v-fig .glasses::before, #visita .v-fig .glasses::after { content: ''; position: absolute; top: 0; width: 9px; height: 9px; border: 1.6px solid #222; border-radius: 50%; background: #fff3; }
    #visita .v-fig .glasses::before { left: 0; } #visita .v-fig .glasses::after { right: 0; }
    #visita .v-me { position: absolute; left: 50%; top: -17px; transform: translateX(-50%); background: #ffd23f; color: #3b2410; font-size: calc(11px * var(--ik, 1) / var(--s, 1)); font-weight: 900; border-radius: 8px; padding: 0 5px; white-space: nowrap; line-height: 1.35; z-index: 3; }
    /* animaciones */
    #visita .v-fig.walking .leg.l, #visita .v-fig.walking .arm.r { animation: v-swingA .56s linear infinite; }
    #visita .v-fig.walking .leg.r, #visita .v-fig.walking .arm.l { animation: v-swingB .56s linear infinite; }
    #visita .v-fig.walking .v-body { animation: v-bob .28s ease-in-out infinite; }
    #visita .v-fig.holding:not(.walking) .arm.r, #visita .v-fig.holding.walking .arm.r { animation: none; transform: rotate(-30deg); }
    #visita .v-fig.talk .arm.l { animation: v-gest .8s ease-in-out infinite; }
    #visita .v-fig.talk .mouth { animation: v-mouth .3s ease-in-out infinite; }
    #visita .v-fig.sip .arm.r { animation: v-sip 1.8s ease-in-out; }
    #visita .v-fig.cheer .arm.r { animation: v-cheer .9s ease-in-out 2; }
    #visita .v-fig.sit .v-body { transform: translateY(26px); }
    @keyframes v-swingA { 0%, 100% { transform: rotate(-26deg); } 50% { transform: rotate(26deg); } }
    @keyframes v-swingB { 0%, 100% { transform: rotate(26deg); } 50% { transform: rotate(-26deg); } }
    @keyframes v-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    @keyframes v-gest { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-42deg); } }
    @keyframes v-mouth { 0%, 100% { height: 2.6px; border-radius: 0 0 8px 8px; } 50% { height: 6px; border-radius: 50%; } }
    @keyframes v-sip { 0%, 100% { transform: rotate(-30deg); } 35%, 65% { transform: rotate(-142deg); } }
    @keyframes v-cheer { 0%, 100% { transform: rotate(-30deg); } 50% { transform: rotate(-85deg); } }
    @keyframes v-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
    @keyframes v-pop { 0% { transform: scale(.2); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { #visita .v-fig.walking .leg, #visita .v-fig.walking .arm, #visita .v-fig.walking .v-body, #visita .v-fig.talk .arm { animation: none; } }
  `;
  document.head.appendChild(st);

  // ---------- Utilidades ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const sound = n => { try { if (window.sfx) sfx(n); } catch (e) {} };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function seeded(str) {   // número al azar repetible a partir de un texto: el anfitrión se ve igual cada vez que lo visitas
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- Contador de entradas al día (sin cuenta, o si el servidor no responde) ----------
  const dayStr = () => new Date().toLocaleDateString('en-CA');
  function localEntries() { try { const o = JSON.parse(localStorage.getItem('visitasEntradas') || '{}'); return o.d === dayStr() ? Number(o.n) || 0 : 0; } catch (e) { return 0; } }
  function setLocalEntries(n) { try { localStorage.setItem('visitasEntradas', JSON.stringify({ d: dayStr(), n })); } catch (e) {} }
  const toast = msg => { try { if (window.flashToast) { flashToast(msg); return; } } catch (e) {} try { alert(msg); } catch (e) {} };
  const limitMsg = () => `Hoy ya has entrado en ${ENTRIES_MAX} casas. ¡Vuelve mañana!`;

  // ---------- Voz (síntesis del navegador) ----------
  const ss = window.speechSynthesis, hasTTS = !!ss && !!window.SpeechSynthesisUtterance;
  let esVoices = [];
  const loadVoices = () => { try { esVoices = (ss.getVoices() || []).filter(v => /^es/i.test(v.lang)); } catch (e) { esVoices = []; } };
  if (hasTTS) { loadVoices(); try { ss.addEventListener('voiceschanged', loadVoices); } catch (e) { ss.onvoiceschanged = loadVoices; } }
  const FEM = /(female|mujer|helena|laura|m[oó]nica|paulina|luc[ií]a|elena|sabina|paloma|marisol|ang[eé]lica|esperanza|soledad|catalina|isabela|camila|dalia|elvira|ximena|salome|valentina|marina|carmen|maria|mar[ií]a|lupe|sof[ií]a)/i;
  const MAS = /(\bmale\b|jorge|diego|juan|carlos|pablo|ra[uú]l|enrique|francisco|miguel|[aá]lvaro|tom[aá]s|alonso|gonzalo|jaime|pedro|luis|antonio)/i;
  const voiceAllowed = () => hasTTS && !(window.atlasVoice && window.atlasVoice.muted) && (!window.soundOn || window.soundOn('gente'));
  // El móvil solo deja hablar tras un toque: se «desbloquea» dentro del clic del botón (antes de esperar al servidor)
  function unlockSpeech() { if (!hasTTS) return; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; ss.speak(u); } catch (e) {} }
  function pickVoice(ch) {
    if (!esVoices.length) return null;
    const local = esVoices.filter(v => v.localService), base = local.length ? local : esVoices;   // las voces «de red» ignoran el tono: se prefieren las locales
    const g = base.filter(v => (ch.female ? FEM : MAS).test(v.name));
    const pool = g.length ? g : base;
    return pool[Math.floor(ch.vi * pool.length) % pool.length];
  }
  function cleanTTS(t) {
    return String(t).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ').replace(/\.{3}/g, '…').replace(/\s+/g, ' ').trim();
  }

  // ---------- Gente ----------
  const GENTE = [
    ['Abuela Rosa', 'f', 'old'], ['Paco', 'm', 'adult'], ['Marta', 'f', 'adult'], ['Tío Juan', 'm', 'adult'], ['Lucía', 'f', 'adult'], ['Carmen', 'f', 'adult'],
    ['Pedro', 'm', 'adult'], ['Abuelo Luis', 'm', 'old'], ['Sofía', 'f', 'adult'], ['Nacho', 'm', 'adult'], ['Elena', 'f', 'adult'], ['Andrés', 'm', 'adult'],
    ['Pilar', 'f', 'old'], ['Javier', 'm', 'adult'], ['Inés', 'f', 'adult'], ['Tío Manolo', 'm', 'old']
  ];
  const SKINS = ['#f6d3b3', '#efc7a0', '#e0ac7e', '#c58a5a', '#9a6540', '#6d4527'];
  const HAIRS = ['#1d1510', '#33200f', '#5a3a1c', '#8a5a2a', '#b98a45', '#d9b86a', '#121212', '#a0522d'];
  const TOPS = ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#34495e', '#e84393', '#7f8c8d', '#f1c40f', '#1abc9c'];
  const PANTS = ['#2c3e50', '#4b4b4b', '#5d4037', '#1f3a5f', '#3b3b3b', '#6d4c41', '#37474f', '#7a6a53'];
  const SHOES = ['#2a1d14', '#1b1b1b', '#6b3a1e', '#e8e8e8', '#7b1f1f'];

  // Crea el aspecto de una persona (con r() = al azar, o repetible para el anfitrión)
  function look(name, female, age, r) {
    const rp = a => a[Math.floor(r() * a.length)];
    const old = age === 'old';
    const hair = old && r() < 0.8 ? rp(['#c9c9c9', '#dcdcdc', '#9a9a9a']) : rp(HAIRS);
    let style;
    if (female) style = old ? rp(['h-bun', 'h-curly', 'h-short']) : rp(['h-long', 'h-long', 'h-pony', 'h-bun', 'h-short', 'h-curly']);
    else style = old ? rp(['h-bald', 'h-short', 'h-short']) : rp(['h-short', 'h-short', 'h-curly', 'h-short']);
    return {
      name, female, old, style, hair, skin: rp(SKINS), top: rp(TOPS), pants: rp(PANTS), btm: rp(['#7b3f61', '#2f5d8a', '#3d6b4f', '#8a5a2a', '#444', '#a33']), shoe: rp(SHOES),
      dress: female && r() < 0.45, beard: !female && r() < (old ? 0.35 : 0.3), glasses: r() < (old ? 0.5 : 0.22),
      sleeve: rp(['40%', '48%', '100%']),
      pitch: female ? (old ? 0.98 + r() * 0.15 : 1.12 + r() * 0.2) : (old ? 0.66 + r() * 0.18 : 0.76 + r() * 0.2),
      rate: old ? 0.9 + r() * 0.06 : 1.0 + r() * 0.1, vi: r()
    };
  }
  function buildFig(a, isMe) {
    const el = document.createElement('div');
    el.className = 'v-fig ' + a.style + (a.dress ? ' dress' : '') + (a.beard ? ' has-beard' : '') + (a.glasses ? ' has-glasses' : '');
    el.style.cssText += `--skin:${a.skin};--hair:${a.hair};--top:${a.top};--pants:${a.pants};--btm:${a.btm};--shoe:${a.shoe};--sleeve:${a.sleeve}`;
    el.innerHTML = '<div class="v-flip"><div class="v-body">' +
      '<i class="leg l"></i><i class="leg r"></i><i class="skirt"></i><i class="arm l"></i><b class="torso"></b><i class="arm r"><span class="hold"></span></i><b class="neck"></b>' +
      '<b class="head"><i class="hb"></i><i class="beard"></i><i class="nose"></i><i class="mouth"></i><i class="eye l"></i><i class="eye r"></i><i class="brow l"></i><i class="brow r"></i><i class="glasses"></i><i class="hf"></i></b>' +
      '</div></div>';
    if (isMe) { const m = document.createElement('div'); m.className = 'v-me'; m.textContent = 'Tú'; el.appendChild(m); }
    return el;
  }

  // ---------- Qué se bebe, qué se dice ----------
  const DRINKS = [['una limonada', '🍹'], ['un zumo de naranja', '🧃'], ['una cola', '🥤'], ['un batido de fresa', '🥛'], ['un granizado de limón', '🍋'], ['un agua con gas', '🫖']];
  const PICS = ['🖼️', '🌄', '🏞️', '🎨', '🌅', '🗺️', '📷', '🌸', '🏔️', '⛵'];
  const TV = ['⚽', '🎬', '🌍', '🎵', '🍳', '🚗', '🐘', '📰', '🚀', '🎤'];
  const PLANTS = ['🪴', '🌿', '🌵', '🌻', '🎋'];
  const PETS = ['🐕', '🐈', '🐇', '🦜', '🐢'];
  const WALLS = ['#f3d9a4', '#cfe3d0', '#d8cde8', '#f0c9c0', '#cfe0ee', '#efe3c8', '#f6e0b5'];
  const FLOORS = ['#b07a45', '#9a6a3c', '#c9a36a', '#a0866a', '#8a6a4a'];
  const SOFAS = ['#8e5a3c', '#3e6e8e', '#7a4a6e', '#4f7a4f', '#a3473f', '#5a5a7a'];
  const RUGS = ['#a33', '#2d6a8a', '#6a4c93', '#3d7a4f', '#c08a2e'];
  const REACCIONES = ['¡Ja, ja, ja!', '¿En serio?', '¡Qué bueno!', 'Ay, qué cosas.', '¡Madre mía!', 'Pues tienes razón.', 'Mmm, qué rico.', 'No me digas.', 'Qué curioso.', 'Me encanta.'];
  // Charlas: cada línea es [quién, frase]. H = anfitrión, V = tú, A y B = los otros de la casa. {h} {a} {b} = sus nombres. Una frase puede ser una lista (sale una al azar).
  const CHARLAS = [
    [['H', 'Hoy hace un día estupendo, ¿verdad?'], ['V', 'Sí, da gusto salir a pasear.'], ['A', 'Yo he aprovechado para tender la ropa.']],
    [['H', '¿Has visto lo grande que está el barrio?'], ['V', '¡Cada día hay vecinos nuevos!'], ['A', 'Y casas cada vez más bonitas.']],
    [['H', '¿Y tú de dónde vienes?'], ['V', ['De un pueblo pequeño con vistas al mar.', 'De la ciudad, pero me encanta el campo.', 'De un paseo larguísimo por el mapa del mundo.']], ['H', '¡Qué suerte! Yo apenas he salido de aquí.']],
    [['A', 'Ayer fui hasta la Luna en cohete.'], ['H', '¿En serio? ¿Y qué tal por allí?'], ['A', 'Muy tranquilo, pero no hay ni un bar.'], ['V', 'Entonces mejor me quedo por aquí.']],
    [['H', 'Esta mañana han sonado las campanas.'], ['A', 'Se oyen desde toda la calle.'], ['V', 'A mí me encanta ese sonido.']],
    [['H', '¿Habéis probado los juegos del mapa?'], ['A', 'Yo gané un premio en el rasca y gana.'], ['V', '¡Qué envidia! Yo todavía no he tenido suerte.'], ['H', 'La suerte llega cuando menos lo esperas.']],
    [['A', 'Dicen que van a subir de nivel las casas de la calle.'], ['H', 'Entonces habrá que celebrarlo.'], ['V', '¡Y con otro refresco!']],
    [['H', 'Mi abuela decía: el que ríe, vive más.'], ['V', 'Pues tenía toda la razón.'], ['A', 'Por eso nos reímos tanto en esta casa.']],
    [['A', '¿Habéis visto el tren que pasó esta tarde?'], ['H', 'Sí, y también un helicóptero.'], ['V', 'Desde aquí se ve todo. ¡Qué buena ubicación!']],
    [['H', 'Este refresco está buenísimo.'], ['A', 'Es receta de la casa.'], ['V', 'Tienes que darme la receta.'], ['H', 'Eso es un secreto de familia.']],
    [['H', 'Hay que plantar más árboles por aquí.'], ['V', '¡Muy buena idea! Dan sombra y alegría.'], ['A', 'Yo me ofrezco a regarlos.']],
    [['H', 'Me encanta tener visitas en casa.'], ['V', 'Y a mí me encanta que me inviten.'], ['A', 'Aquí siempre hay sitio para uno más.']],
    [['H', '¿Os gusta la decoración?'], ['V', 'Es muy acogedora.'], ['A', 'Yo cambiaría el sofá de sitio, ja, ja.'], ['H', 'Ni lo sueñes, ahí se queda.']],
    [['A', '¿Os acordáis de cuando esto era solo un solar?'], ['H', 'Qué rápido cambia todo.'], ['V', 'Ahora parece otro mundo.']],
    [['V', '¿Siempre hay tanta tranquilidad por aquí?'], ['H', 'Casi siempre, salvo cuando pasa el tren.'], ['A', 'Y cuando ladra el perro del vecino.']],
    [['H', '¿Cuál es tu comida favorita?'], ['V', ['La paella, sin duda.', 'Las patatas fritas, con diferencia.', 'Cualquier cosa con chocolate.']], ['H', 'Buena elección. Algún día cocinaré para todos.']],
    [['A', 'Esta noche dicen que hay lluvia de estrellas.'], ['H', 'Entonces cenamos en la terraza.'], ['V', '¡Qué plan tan bonito!']],
    [['H', '¿Has viajado mucho por el mapa?'], ['V', ['Un montón, aunque me falta la mitad del mundo.', 'Algo, pero siempre vuelvo a mi casa.', 'Sí, ¡hasta he pisado otros planetas!']], ['A', '¡Cuéntanos más la próxima vez!']],
    [['A', 'Hoy he madrugado muchísimo.'], ['H', 'Pues se nota, tienes cara de sueño.'], ['A', 'Ja, ja, ja. Con un café me recupero.']],
    [['H', 'Mira qué vistas tenemos desde la ventana.'], ['V', 'Preciosas. Se ve media calle.'], ['A', 'Y al fondo, las montañas.']],
    [['H', '¿Os apetece una partida de cartas luego?'], ['A', '¡Yo me apunto!'], ['V', 'Pero te aviso: juego muy bien.'], ['H', 'Eso lo veremos.']],
    [['B', '¿Qué hora es? Se me pasa el tiempo volando.'], ['A', 'Es temprano todavía, tranquilo.'], ['H', 'Hay tiempo para otro refresco.']],
    [['H', 'Estoy pensando en pintar el salón.'], ['A', '¿De qué color?'], ['H', 'Todavía no lo sé. ¿Tú qué opinas?'], ['V', 'Yo lo dejaría tal cual, está precioso.']],
    [['V', 'Qué casa tan limpia y ordenada.'], ['H', 'Gracias, hoy me tocaba limpiar.'], ['A', 'Y yo ayudé a esconder el desorden.']],
    [['B', '¿Alguien ha visto el mando de la tele?'], ['A', 'Debajo del cojín, como siempre.'], ['B', '¡Aquí está! Gracias, {a}.']],
    [['A', 'Un vecino ha comprado una parcela cerca del mar.'], ['H', '¡Qué suerte! Siempre quise vivir junto al mar.'], ['V', 'Con brisa fresquita todo el verano.']],
    [['H', 'Mi mascota ha vuelto a esconder mi zapatilla.'], ['A', 'Ja, ja, ja. Es un pillo.'], ['V', 'Seguro que está jugando con nosotros.']],
    [['H', '¿Habéis oído la última noticia del barrio?'], ['A', 'No, cuenta, cuenta.'], ['H', 'Que van a poner una rotonda nueva.'], ['V', '¡Ya era hora!']],
    [['H', 'A veces me quedo mirando por la ventana sin hacer nada.'], ['V', 'Eso también es descansar.'], ['A', 'Y muy sano, por cierto.']],
    [['B', 'Qué bien huele aquí. ¿Qué cocinas, {h}?'], ['H', 'Es pan de ayer, tostado.'], ['V', 'Pues huele de maravilla.']],
    [['A', 'Yo ya cobré hoy mi regalo diario.'], ['H', 'Yo todavía no he abierto el mío.'], ['V', '¡Pues ábrelo ya!']]
  ];

  // ---------- La visita ----------
  async function startVisit(p) {
    if (running || !p || !p.owner) return;
    unlockSpeech();                                   // dentro del clic: así el móvil deja hablar después
    running = {};                                     // bloquea dobles clics mientras el servidor responde
    // 1) Límite de entradas al día. Con cuenta manda el servidor; sin cuenta (o si falla) cuenta el navegador.
    let info = null;
    if (typeof authToken !== 'undefined' && authToken) {
      try { info = await api('/api/visit/start', { method: 'POST', body: { id: p.id } }); } catch (e) { info = { error: e.message }; }
      if (info && info.entryLimit) { setLocalEntries(ENTRIES_MAX); running = null; toast(limitMsg()); return; }
      if (info && !info.error && !info.unlimited && info.entries != null) setLocalEntries(Number(info.entries) || 0);
    } else info = { error: 'sin cuenta' };
    if (info.error) {
      if (localEntries() >= ENTRIES_MAX) { running = null; toast(limitMsg()); return; }
      setLocalEntries(localEntries() + 1);
    }
    const entradaN = info.unlimited ? 0 : info.error ? localEntries() : (Number(info.entries) || localEntries());
    runScene(p, info, entradaN);
  }

  function runScene(p, info, entradaN) {
    const token = {}; let dead = false; running = token;
    const sleep = ms => new Promise((res, rej) => { setTimeout(() => (dead ? rej(token) : res()), ms); });

    // ----- Aspecto al azar de la casa -----
    const night = (() => { const h = new Date().getHours(); return h >= 21 || h < 7; })();
    const dusk = (() => { const h = new Date().getHours(); return (h >= 19 && h < 21) || (h >= 7 && h < 9); })();
    const sky = night ? 'linear-gradient(#0d1b3d, #26408b)' : dusk ? 'linear-gradient(#f7a35c, #fbd5a0)' : 'linear-gradient(#8fd0ff, #dff3ff)';
    const skyEmoji = night ? pick(['🌙', '🌙⭐', '⭐']) : dusk ? pick(['🌇', '🌅']) : pick(['☀️', '🌤️', '☀️⛅']);
    const decoOnWall = pick(['tv', 'pics', 'pics', 'big']);

    const root = document.createElement('div');
    root.id = 'visita'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Visita a la casa de ' + p.owner);
    root.innerHTML = `<div class="v-card">
      <div class="v-top"><span class="v-title"></span><button class="v-x" type="button" aria-label="Salir">×</button></div>
      <div class="v-wrap"><div class="v-room">
        <div class="v-floor"></div><div class="v-base"></div><div class="v-rug"></div>
        <div class="v-win"><span class="v-sky"></span></div>
        <div class="v-doorframe"></div><div class="v-door"></div><div class="v-bell-wave"></div><div class="v-bell">🔔</div>
        <div class="v-sofa-back"></div><div class="v-sofa-front"></div><div class="v-sofa-arm" style="left:198px"></div><div class="v-sofa-arm" style="left:364px"></div>
        <div class="v-plant"></div><div class="v-lamp"></div><div class="v-shelf"></div><div class="v-shelf-i"></div><div class="v-clock">🕰️</div>
        <div class="v-fridge"><div class="in"><span>🥤</span><span>🧃</span><span>🍹</span></div><div class="fd"></div></div>
        <div class="v-night"></div>
      </div>
      <div class="v-bubble" aria-live="polite"></div>
      <div class="v-gift"><div><b>🎁</b><span class="v-gt"></span></div></div></div>
      <div class="v-sub"></div></div>`;
    root.querySelector('.v-title').textContent = '🏠 Casa de ' + p.owner;
    document.body.appendChild(root);
    const wrap = root.querySelector('.v-wrap'), room = root.querySelector('.v-room'), door = root.querySelector('.v-door'), fridge = root.querySelector('.v-fridge');
    const bubble = root.querySelector('.v-bubble'), sub = root.querySelector('.v-sub'), gift = root.querySelector('.v-gift'), gt = root.querySelector('.v-gt');
    room.style.setProperty('--wall', pick(WALLS)); room.style.setProperty('--floor', pick(FLOORS)); room.style.setProperty('--sofa', pick(SOFAS)); room.style.setProperty('--rug', pick(RUGS));
    room.querySelector('.v-win').style.background = sky;
    room.querySelector('.v-sky').textContent = skyEmoji;
    room.querySelector('.v-plant').textContent = pick(PLANTS);
    const shelfI = room.querySelector('.v-shelf-i'); shelfI.textContent = ''; shuffle(['📚', '🏺', '🪴', '🧸', '🕯️', '📻']).slice(0, 3).forEach(e => { const s = document.createElement('span'); s.textContent = e; shelfI.appendChild(s); });
    if (night) { room.style.setProperty('--lamp', '#ffe28a'); room.querySelector('.v-night').style.opacity = '.28'; }
    let tvEl = null;
    if (decoOnWall === 'tv') { tvEl = document.createElement('div'); tvEl.className = 'v-tv'; tvEl.textContent = pick(TV); room.insertBefore(tvEl, room.querySelector('.v-sofa-back')); }
    else if (decoOnWall === 'big') { const f = document.createElement('div'); f.className = 'v-frame'; f.style.cssText = 'left:240px;bottom:226px;width:120px;height:74px;font-size:42px'; f.textContent = pick(PICS); room.insertBefore(f, room.querySelector('.v-sofa-back')); }
    else { [[222, 40], [292, 52], [352, 40]].forEach(([x, w], i) => { const f = document.createElement('div'); f.className = 'v-frame'; f.style.cssText = `left:${x}px;bottom:${232 + (i === 1 ? 6 : 0)}px;width:${w}px;height:${w + 6}px;font-size:${Math.round(w * 0.6)}px`; f.textContent = pick(PICS); room.insertBefore(f, room.querySelector('.v-sofa-back')); }); }

    // El escenario mide 560×340 y se escala al ancho disponible
    let K = 1;
    const fit = () => { K = Math.min(1, wrap.clientWidth / W); room.style.transform = `scale(${K})`; room.style.setProperty('--ik', String(1 / K)); wrap.style.height = Math.round(H * K) + 'px'; };
    fit(); window.addEventListener('resize', fit);

    // ----- Personas -----
    const hostLook = (() => { const r = seeded('casa:' + p.owner); const f = r() < 0.5; return look(p.owner, f, r() < 0.25 ? 'old' : 'adult', r); })();
    const nOthers = 1 + Math.floor(Math.random() * 2);   // 2 o 3 personas con el anfitrión (más tú)
    const othersSrc = shuffle(GENTE.filter(g => g[0] !== p.owner)).slice(0, nOthers);
    const meLook = look('Tú', Math.random() < 0.5, 'adult', Math.random); meLook.pitch = 1; meLook.rate = 1.05;
    const mkActor = (a, isMe) => { const ch = Object.assign({}, a, { x: 0, d: 0, dir: 1, seated: false, busy: false, hold: null, q: Promise.resolve(), wt: 0 }); ch.el = buildFig(a, isMe); ch.flip = ch.el.querySelector('.v-flip'); ch.head = ch.el.querySelector('.head'); ch.holdEl = ch.el.querySelector('.hold'); room.appendChild(ch.el); return ch; };
    const host = mkActor(hostLook), me = mkActor(meLook, true);
    const others = othersSrc.map(g => mkActor(look(g[0], g[1] === 'f', g[2], Math.random)));
    const all = [host, ...others, me];
    const roles = { H: host, V: me, A: others[0], B: others[1] };
    const nm = { h: host.name, a: others[0].name, b: others[1] ? others[1].name : '' };
    const fill = t => String(t).replace(/\{(h|a|b)\}/g, (m, k) => nm[k]);

    // Mascota que da vueltas
    const pet = document.createElement('div'); pet.className = 'v-pet'; const petI = document.createElement('span'); petI.textContent = pick(PETS); pet.appendChild(petI); room.appendChild(pet);
    const petPlace = (x, d, ms) => { const s = 1 - d * 0.28; pet.style.transition = ms ? `left ${ms}ms linear, bottom ${ms}ms linear, transform ${ms}ms linear` : 'none'; pet.style.left = x + 'px'; pet.style.bottom = (10 + d * 108) + 'px'; pet.style.zIndex = String(10 + Math.round((1 - d) * 30)); pet.dataset.x = x; pet.style.transform = `scale(${s})`; petI.style.transform = pet.dataset.f === '1' ? 'scaleX(-1)' : 'none'; };
    pet.dataset.f = '0'; petPlace(300, 0.2, 0);

    // ----- Posiciones: x en píxeles del escenario y d = profundidad (0 delante … 1 al fondo) -----
    const feetBottom = d => 10 + d * 108, depthScale = d => 1 - d * 0.28;
    const SEAT_D = 0.85, SEAT_Z = 14;
    const SEATS = [{ x: 238 }, { x: 290 }, { x: 342 }];
    const STAND = [{ x: 125, d: 0.42 }, { x: 175, d: 0.1 }, { x: 225, d: 0.05 }, { x: 300, d: 0.08 }, { x: 365, d: 0.06 }, { x: 420, d: 0.22 }, { x: 495, d: 0.4 }, { x: 440, d: 0.75 }, { x: 150, d: 0.6 }, { x: 95, d: 0.28 }];
    const DOOR = { x: 45, d: 1.0 }, NEAR_DOOR = { x: 118, d: 0.4 }, FRIDGE = { x: 440, d: 0.75 };

    function place(ch, x, d, ms) {
      const s = depthScale(d), el = ch.el;
      el.style.transition = ms ? `left ${ms}ms linear, bottom ${ms}ms linear, transform ${ms}ms linear` : 'none';
      el.style.left = x + 'px'; el.style.bottom = feetBottom(d) + 'px'; el.style.transform = `scale(${s})`; el.style.setProperty('--s', String(s));
      el.style.zIndex = String(ch.seated ? SEAT_Z : 10 + Math.round((1 - d) * 30));
      ch.x = x; ch.d = d;
    }
    function face(ch, dx) { if (Math.abs(dx) < 3) return; ch.dir = dx > 0 ? 1 : -1; ch.flip.style.transform = `scaleX(${ch.dir})`; }
    const faceTo = (a, b) => face(a, b.x - a.x);
    // Camina (una orden tras otra para la misma persona)
    function walkTo(ch, x, d, speed) {
      const run = async () => {
        const dist = Math.hypot(x - ch.x, (d - ch.d) * 108), ms = Math.max(350, dist / (speed || 100) * 1000), my = ++ch.wt;
        face(ch, x - ch.x); ch.el.classList.add('walking'); place(ch, x, d, ms);
        await sleep(ms);
        if (ch.wt === my) ch.el.classList.remove('walking');
      };
      const pr = ch.q.then(run, run); ch.q = pr.catch(() => {}); return pr;
    }
    const setHold = (ch, emoji) => { ch.hold = emoji; ch.holdEl.textContent = emoji || ''; ch.el.classList.toggle('holding', !!emoji); };
    const spot = () => { const free = STAND.filter(s => all.every(o => !o.el.style.left || Math.hypot(o.x - s.x, (o.d - s.d) * 108) > 62)); return pick(free.length ? free : STAND); };
    async function sitAt(ch, seat) {
      await walkTo(ch, seat.x, 0.5);
      ch.flip.style.transform = 'scaleX(1)'; ch.dir = 1;   // sentados miran de frente
      ch.seated = true; ch.el.classList.add('sit'); sound('silla');
      place(ch, seat.x, SEAT_D, 700); await sleep(720);
    }
    async function standUp(ch) {
      ch.seated = false; ch.el.classList.remove('sit'); sound('silla');
      place(ch, ch.x, 0.5, 600); await sleep(650);
    }

    // Colocación inicial: cada uno en un sitio al azar de la casa
    const startSpots = shuffle(STAND.filter(s => s.x > 200)).slice(0, 1 + others.length);
    [host, ...others].forEach((ch, i) => { const s = startSpots[i]; place(ch, s.x, s.d, 0); face(ch, Math.random() < 0.5 ? -10 : 10); if (Math.random() < 0.55) setHold(ch, pick(DRINKS)[1]); });
    place(me, DOOR.x, DOOR.d, 0); me.flip.style.opacity = '0';   // el visitante aparece cuando se abre la puerta
    setHold(host, null);   // el anfitrión aún no tiene nada en la mano

    // ----- Bucles de fondo: gente que pasea, mascota y tele -----
    const wanderLoop = async ch => {
      try {
        await sleep(rnd(1500, 4000));
        while (!dead) {
          if (!ch.busy && !ch.seated && ch !== me) { const s = spot(); await walkTo(ch, s.x, s.d, rnd(70, 95)); }
          await sleep(rnd(2200, 5200));
        }
      } catch (e) { if (e !== token) console.error(e); }
    };
    const petLoop = async () => {
      try {
        while (!dead) {
          await sleep(rnd(1200, 3500));
          const x = rnd(150, 520), d = rnd(0.04, 0.5), dx = x - Number(pet.dataset.x || 300);
          pet.dataset.f = dx > 0 ? '1' : '0';   // los emojis de animales miran a la izquierda
          const dist = Math.hypot(dx, d * 108), ms = Math.max(500, dist / 55 * 1000);
          petPlace(x, d, ms); await sleep(ms);
        }
      } catch (e) { if (e !== token) console.error(e); }
    };
    const tvLoop = async () => { try { while (!dead && tvEl) { await sleep(rnd(4500, 9000)); tvEl.textContent = pick(TV); } } catch (e) { if (e !== token) console.error(e); } };
    others.forEach(wanderLoop); petLoop(); tvLoop();

    // ----- Hablar: burbuja + voz -----
    let speaker = null, raf = 0;
    const updateBubble = () => {
      if (dead) return;
      raf = requestAnimationFrame(updateBubble);
      if (!speaker || !bubble.classList.contains('on')) return;
      const wr = wrap.getBoundingClientRect(), hr = speaker.head.getBoundingClientRect();
      const bw = bubble.offsetWidth, bh = bubble.offsetHeight, cx = hr.left + hr.width / 2 - wr.left;
      const x = Math.max(6, Math.min(wr.width - bw - 6, cx - bw / 2));
      let y = hr.top - wr.top - bh - 12; if (y < 4) y = 4;
      bubble.style.left = x + 'px'; bubble.style.top = y + 'px';
      bubble.style.setProperty('--tail', Math.max(14, Math.min(bw - 14, cx - x)) + 'px');
    };
    raf = requestAnimationFrame(updateBubble);
    // Dice el texto en voz alta y termina cuando acaba de hablar (o, sin voz, cuando se ha podido leer)
    async function speakAloud(text, ch) {
      const t = cleanTTS(text), est = Math.max(1500, 700 + t.length * 62);
      if (!t || !voiceAllowed()) { await sleep(est); return; }
      let finished;
      const ended = new Promise(res => { finished = res; });
      try {
        if (ss.speaking || ss.pending) { ss.cancel(); await sleep(90); }
        const u = new SpeechSynthesisUtterance(t), v = pickVoice(ch);
        u.lang = v ? v.lang : 'es-ES'; if (v) u.voice = v;
        u.pitch = Math.max(0.1, Math.min(2, ch.pitch)); u.rate = Math.max(0.6, Math.min(1.5, ch.rate)); u.volume = 1;
        u.onend = u.onerror = () => finished();
        if (ss.paused) ss.resume();
        ss.speak(u);
      } catch (e) { await sleep(est); return; }
      await Promise.race([ended, sleep(est * 2.2 + 2500)]);   // por si el navegador no avisa de que ha terminado
    }
    async function say(who, raw, o) {
      o = o || {};
      if (!who) return;
      const text = fill(Array.isArray(raw) ? pick(raw) : raw);
      speaker = who;
      bubble.replaceChildren(); const nb = document.createElement('b'); nb.textContent = who.name; bubble.append(nb, document.createTextNode(text));
      bubble.classList.toggle('big', !!o.big); bubble.classList.add('on');
      who.el.classList.add('talk');
      if (o.to) { faceTo(who, o.to); faceTo(o.to, who); }
      try { await speakAloud(text, who); }
      finally { who.el.classList.remove('talk'); }
      bubble.classList.remove('on');
      await sleep(o.gap == null ? 260 : o.gap);
    }
    const gesto = (ch, cls, ms) => { ch.el.classList.add(cls); setTimeout(() => ch.el.classList.remove(cls), ms); };

    const cleanup = () => {
      dead = true; cancelAnimationFrame(raf); root.remove(); if (running === token) running = null;
      document.removeEventListener('keydown', onKey); window.removeEventListener('resize', fit);
      try { if (hasTTS) ss.cancel(); } catch (e) {}
      try { if (window.houseMute) window.houseMute(false); } catch (e) {}   // vuelve el sonido de fuera
    };
    const onKey = e => { if (e.key === 'Escape') cleanup(); };
    document.addEventListener('keydown', onKey);
    root.querySelector('.v-x').onclick = cleanup;   // salir antes de tiempo: no hay regalo
    root.addEventListener('pointerdown', e => { if (e.target === root) cleanup(); });
    try { if (window.houseMute) window.houseMute(true); } catch (e) {}   // dentro de la casa no se oye nada de fuera

    // ----- Guion automático -----
    (async () => {
      try {
        const nEntrada = entradaN > 0 ? `Entrada ${Math.min(entradaN, ENTRIES_MAX)} de ${ENTRIES_MAX} de hoy · ` : '';
        sub.textContent = nEntrada + 'Llamando a la puerta…';
        await sleep(700);
        const bellEl = room.querySelector('.v-bell'), waveEl = room.querySelector('.v-bell-wave');
        sub.textContent = nEntrada + 'Tocas el timbre…';
        bellEl.classList.add('ring'); waveEl.classList.add('on'); sound('timbre'); await sleep(1500);   // ding-dong
        bellEl.classList.remove('ring'); waveEl.classList.remove('on');
        sub.textContent = nEntrada + 'Esperas a que abran…'; await sleep(500);
        // el anfitrión viene a abrir
        await say(host, pick(['¡Ya voy!', '¡Un momento, ya voy!', '¡Voy, voy!']), { gap: 80 });
        host.busy = true; others.forEach(o => { o.busy = true; });
        await walkTo(host, NEAR_DOOR.x, NEAR_DOOR.d, 115);
        face(host, -1);
        door.classList.add('open'); sound('puerta'); await sleep(1000);
        me.flip.style.opacity = '1';
        sub.textContent = nEntrada + 'Te dan la bienvenida';
        await say(host, ['¡PASA, BIENVENIDO!', '¡Adelante, estás en tu casa!', '¡Qué alegría verte! Pasa, pasa.'], { big: true, to: me });
        // el visitante entra caminando
        await walkTo(me, 172, 0.32, 85); faceTo(me, host); faceTo(host, me);
        door.classList.remove('open'); sound('puerta');
        await say(me, ['¡Buenas! Gracias por invitarme.', '¡Hola! Qué casa tan bonita.', 'Hola, muchas gracias por abrirme.'], { to: host });
        await say(host, [`Soy ${host.name}. Siéntete como en casa.`, `Yo soy ${host.name}. Pasa y ponte cómodo.`], { to: me });
        const o1 = others[0];
        walkTo(o1, 240, 0.12, 90).catch(() => {});
        await say(o1, [`¡Hola! Me llamo ${o1.name}, mucho gusto.`, `¡Bienvenido! Yo soy ${o1.name}.`], { to: me });

        // el refresco
        sub.textContent = nEntrada + 'Te ofrecen un refresco…';
        const [d1, d2] = shuffle(DRINKS).slice(0, 2);
        await say(host, [`¿Te ofrezco un refresco? Tengo ${d1[0]} y ${d2[0]}.`, `¿Quieres tomar algo fresquito? Hay ${d1[0]} y ${d2[0]}.`], { to: me });
        const elegido = pick([d1, d2]);
        await say(me, [`${cap(elegido[0])}, por favor.`, `Me apetece ${elegido[0]}, gracias.`], { to: host });
        await say(host, pick(['¡Marchando!', 'Ahora mismo te lo traigo.', 'Un momento, que voy a la nevera.']));
        await walkTo(host, FRIDGE.x, FRIDGE.d, 105); face(host, 1);
        fridge.classList.add('open'); sound('puerta'); await sleep(900);
        setHold(host, elegido[1]); sound('vasos'); await sleep(500);
        fridge.classList.remove('open'); await sleep(450);
        walkTo(me, 330, 0.18, 85).catch(() => {});   // el visitante sale a su encuentro
        await walkTo(host, 292, 0.18, 105); faceTo(host, me); faceTo(me, host);
        await say(host, ['Aquí tienes. ¡Que aproveche!', 'Aquí tienes, bien fresquito.'], { to: me, gap: 80 });
        setHold(host, null); setHold(me, elegido[1]); sound('vasos');
        await say(me, ['¡Muchas gracias!', '¡Qué rico, gracias!', 'Justo lo que necesitaba.'], { to: host });
        setHold(host, pick(DRINKS)[1]);   // el anfitrión también se sirve uno
        gesto(host, 'cheer', 1900); gesto(me, 'cheer', 1900); sound('vasos');
        await say(host, '¡Salud!', { big: true, to: me, gap: 150 });
        gesto(me, 'sip', 1900);
        await say(me, '¡Salud!', { to: host });

        // a sentarse
        sub.textContent = nEntrada + 'Os sentáis a charlar…';
        await say(host, ['Anda, siéntate con nosotros en el sofá.', 'Ven, siéntate, que se está muy bien aquí.'], { to: me });
        const seats = shuffle(SEATS);
        const sitMe = sitAt(me, seats[0]); await sleep(500);
        const sitHost = sitAt(host, seats[1]);
        await Promise.all([sitMe, sitHost]);
        host.busy = false;
        if (Math.random() < 0.7) { o1.busy = true; await sitAt(o1, seats[2]); }   // el otro invitado se sienta; el tercero se queda paseando por la casa
        others.forEach(o => { if (!o.seated) o.busy = false; });
        // los que se sientan miran al frente; los de pie se giran hacia quien habla (en say)

        // charla al azar (solo temas con las personas que hay)
        sub.textContent = nEntrada + 'Charlando…';
        const hay = new Set(['H', 'V', 'A']); if (others[1]) hay.add('B');
        const temas = shuffle(CHARLAS.filter(c => c.every(l => hay.has(l[0])))).slice(0, 2 + Math.floor(Math.random() * 2));
        const grupo = all.filter(c => c !== me);
        for (const tema of temas) {
          let prev = null;
          for (const [rol, frase] of tema) {
            const who = roles[rol]; if (!who) continue;
            const to = prev && prev !== who ? prev : pick(all.filter(c => c !== who));
            await say(who, frase, { to });
            prev = who;
            if (Math.random() < 0.18) { const bebe = all.filter(c => c.hold && c !== who); if (bebe.length) gesto(pick(bebe), 'sip', 1900); }
          }
          if (Math.random() < 0.75) {   // una reacción de otro
            const r = pick(all.filter(c => c !== prev)); sound(Math.random() < 0.5 ? 'risa' : 'pop');
            await say(r, pick(REACCIONES), { to: prev, gap: 180 });
          }
          if (tvEl && Math.random() < 0.4) tvEl.textContent = pick(TV);
        }

        // despedida
        sub.textContent = nEntrada + 'Te despides…';
        await say(me, [`Qué rato más agradable. Pero ya me tengo que ir.`, 'Se me ha pasado volando, pero me voy ya.', 'Muy a gusto, pero se me hace tarde.'], { to: host });
        await say(host, ['Vuelve cuando quieras.', '¡Esta es tu casa! Vuelve pronto.'], { to: me });
        await standUp(me); sound('silla');
        if (host.seated) await standUp(host);
        others.forEach(o => { o.busy = true; });
        await say(me, '¡Gracias por todo!', { to: host, gap: 100 });
        const despiden = [host, ...others];
        walkTo(host, NEAR_DOOR.x, NEAR_DOOR.d, 110).catch(() => {});
        walkTo(me, 135, 0.5, 100).catch(() => {});
        for (const w of despiden) { sound('adios'); gesto(w, 'cheer', 1900); await say(w, '¡HASTA LA PRÓXIMA!', { big: true, to: me, gap: 120 }); }
        await walkTo(me, NEAR_DOOR.x - 8, NEAR_DOOR.d, 100);
        face(host, -1);
        door.classList.add('open'); sound('puerta'); await sleep(900);
        setHold(me, null);
        await walkTo(me, DOOR.x, DOOR.d, 90); me.flip.style.opacity = '0'; await sleep(450);
        door.classList.remove('open'); sound('puerta'); await sleep(900);

        // regalo: el servidor solo paga si de verdad ha pasado el tiempo de la visita
        let msg = '', ok = false;
        if (!info || info.error) msg = 'Crea tu cuenta o inicia sesión para recibir 1 crédito en tus próximas visitas.';
        else {
          let r = null;
          try { r = await api('/api/visit/finish', { method: 'POST', body: { id: p.id } }); } catch (e) { r = null; }
          if (r && r.rewarded) { ok = true; msg = `¡Te regalan ${r.reward} ${r.reward === 1 ? 'crédito' : 'créditos'}!`; }
          else if (r && r.reason === 'already') msg = 'Hoy ya te regalaron un crédito en esta casa. ¡Vuelve mañana!';
          else if (r && r.reason === 'limit') msg = 'Hoy ya has recibido el máximo de créditos por visitas.';
          else msg = '¡Gracias por la visita!';
        }
        gt.textContent = msg; gift.classList.add('on');
        if (ok) { sound('coin'); sound('gift'); try { if (window.refreshCredits) refreshCredits(); } catch (e) {} }
        sub.textContent = 'Visita terminada';
        await sleep(3800);
        cleanup();
      } catch (e) { if (e !== token) { console.error(e); cleanup(); } }
    })();
  }

  let currentParcel = null;
  btn.onclick = () => startVisit(currentParcel);
  // lo llama showPanel() de app.js: solo se ve en casas con dueño con cuenta que no son tuyas
  window.visitaPanel = p => {
    currentParcel = p || null;
    btn.classList.toggle('hidden', !(p && p.owner && !p.mine && p.giftable));
  };
  window.visitaStart = startVisit;
})();
