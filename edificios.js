'use strict';
// ENTRAR EN UN EDIFICIO: en el panel de un terreno con una farmacia, supermercado, gasolinera, policía, colegio o restaurante sale el botón «🚪 ENTRAR EN …».
// Es una escena automática distinta para cada tipo de edificio (la de «ENTRAR EN CASA», en visita.js, no se toca):
//   · Fuera no se oye nada (ciudad, música, lluvia, coches...): dentro solo suena lo del edificio (puerta, campanilla, vasos, caja, teclas...) y la charla.
//   · Personas con cuerpo entero que caminan, se sientan, cogen cosas y hablan (voz del navegador + burbuja de texto). Todo se adapta al sitio:
//     farmacia (compras medicinas), súper (cesta, pasillos y caja), gasolinera (pagar surtidor y café), policía (poner una denuncia),
//     colegio (matricular y visita al aula), restaurante (mesa, carta, comida y cuenta).
//   · Se reparte al azar: quién atiende, qué te pasa, qué compras, qué dicen. Mismas reglas de regalo que las casas ajenas (1 crédito por edificio y día, 3 entradas al día).
//   · En un edificio tuyo (o sin cuenta de dueño) se entra gratis y sin regalo.
// Para añadir otro tipo (banco, hospital, cine...) basta con añadir una escena más en SCN (más abajo) y una línea en kindOfBuilding().
// Usa globals de app.js: api(), authToken, refreshCredits(), flashToast(), houseFor(), sfx(); y de sounds.js: houseMute(). Se carga después de visita.js.
(function () {
  let running = null;
  const ENTRIES_MAX = 3, W = 560, H = 340;   // entradas al día (igual que visita.js) y tamaño del escenario

  // ---------- Estilos (los mismos que las casas: escenario, personas, burbujas y regalo) ----------
  const st = document.createElement('style');
  st.textContent = `
    #edif { position: fixed; inset: 0; z-index: 3000; background: #000b; display: grid; place-items: center; padding: 12px; }
    #edif .v-card { position: relative; width: min(600px, 100%); background: #2b1d14; border-radius: 16px; padding: 12px 12px 14px; color: #fff; box-shadow: 0 10px 40px #000a; }
    #edif .v-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 800; }
    #edif .v-x { background: #0006; color: #fff; border: 0; border-radius: 999px; width: 34px; height: 34px; font-size: 20px; cursor: pointer; flex: none; }
    #edif .v-wrap { position: relative; width: 100%; max-width: ${W}px; margin: 0 auto; overflow: hidden; border-radius: 12px; background: #000; }
    #edif .v-room { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; overflow: hidden; background: var(--wall, #f3d9a4); }
    #edif .v-room * { box-sizing: border-box; }
    #edif .v-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 140px; background: var(--floor, #b07a45); }
    #edif .v-floor::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, #0000 0 54px, #0002 54px 56px); }
    #edif .v-floor::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 10px; background: linear-gradient(#0003, #0000); }
    #edif .v-base { position: absolute; left: 0; right: 0; bottom: 138px; height: 8px; background: #0003; }
    #edif .v-bubble { position: absolute; z-index: 8; max-width: 78%; background: #fff; color: #1b1b1b; border-radius: 14px; padding: 6px 11px 7px; font-size: 15px; font-weight: 700; line-height: 1.25; box-shadow: 0 3px 10px #0005; opacity: 0; transform: translateY(6px) scale(.96); transition: opacity .2s, transform .2s; pointer-events: none; }
    #edif .v-bubble.on { opacity: 1; transform: none; }
    #edif .v-bubble b { display: block; font-size: 11px; font-weight: 800; color: #a05a1c; margin-bottom: 1px; }
    #edif .v-bubble::after { content: ''; position: absolute; left: var(--tail, 50%); bottom: -7px; margin-left: -7px; border: 7px solid transparent; border-bottom: 0; border-top-color: #fff; }
    #edif .v-bubble.big { font-size: 19px; font-weight: 900; }
    #edif .v-gift { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; background: #000a; text-align: center; font-size: 20px; font-weight: 900; padding: 16px; opacity: 0; pointer-events: none; transition: opacity .4s; }
    #edif .v-gift.on { opacity: 1; }
    #edif .v-gift b { display: block; font-size: 54px; animation: v-pop .8s ease-out; }
    #edif .v-sub { text-align: center; font-size: 12px; opacity: .8; margin-top: 8px; min-height: 16px; }

    /* ----- Personas: cabeza, cuello, tronco, brazos, piernas y zapatos ----- */
    #edif .v-fig { position: absolute; width: 52px; height: 124px; margin-left: -26px; transform-origin: 50% 100%; }
    #edif .v-flip { position: absolute; inset: 0; transition: transform .25s, opacity .3s; }
    #edif .v-body { position: absolute; inset: 0; transition: transform .6s ease; }
    #edif .v-body i, #edif .v-body b, #edif .v-body span { position: absolute; display: block; font-style: normal; font-weight: normal; }
    #edif .v-fig .leg { left: 12px; top: 74px; width: 13px; height: 44px; background: var(--pants); border-radius: 4px 4px 3px 3px; transform-origin: 50% 4px; box-shadow: inset -3px 0 0 #0002; }
    #edif .v-fig .leg.r { left: 27px; }
    #edif .v-fig .leg::after { content: ''; position: absolute; left: -1px; bottom: -5px; width: 18px; height: 8px; border-radius: 6px 8px 3px 3px; background: var(--shoe); }
    #edif .v-fig .torso { left: 10px; top: 32px; width: 32px; height: 45px; border-radius: 12px 12px 7px 7px; background: var(--top); box-shadow: inset -5px 0 0 #0002, inset 0 -6px 0 #0001; }
    #edif .v-fig .skirt { display: none; left: 7px; top: 62px; width: 38px; height: 38px; background: var(--btm); clip-path: polygon(16% 0, 84% 0, 100% 100%, 0 100%); border-radius: 0 0 6px 6px; }
    #edif .v-fig.dress .skirt { display: block; }
    #edif .v-fig.dress .leg { top: 90px; height: 28px; background: var(--skin); }
    #edif .v-fig .arm { left: 1px; top: 34px; width: 9px; height: 38px; border-radius: 5px; background: linear-gradient(var(--top) 0 var(--sleeve, 45%), var(--skin) var(--sleeve, 45%) 100%); transform-origin: 50% 5px; }
    #edif .v-fig .arm.r { left: 42px; }
    #edif .v-fig .hold { display: none; left: -5px; top: 28px; font-size: 19px; line-height: 1; }
    #edif .v-fig.holding .hold { display: block; }
    #edif .v-fig .neck { left: 22px; top: 26px; width: 8px; height: 9px; background: var(--skin); filter: brightness(.92); }
    #edif .v-fig .head { left: 12px; top: 0; width: 28px; height: 30px; border-radius: 50% 50% 46% 46%; background: var(--skin); }
    #edif .v-fig .head i, #edif .v-fig .head b { position: absolute; }
    #edif .v-fig .hf, #edif .v-fig .hb { background: var(--hair); }
    #edif .v-fig .hf { left: -1px; top: -3px; width: 30px; height: 13px; border-radius: 15px 15px 4px 4px; }
    #edif .v-fig .hb { display: none; z-index: -1; }
    #edif .v-fig.h-long .hb { display: block; left: -4px; top: 2px; width: 36px; height: 46px; border-radius: 14px 14px 9px 9px; }
    #edif .v-fig.h-pony .hb { display: block; left: 20px; top: 4px; width: 13px; height: 34px; border-radius: 7px; }
    #edif .v-fig.h-bun .hf::before { content: ''; position: absolute; left: 8px; top: -9px; width: 13px; height: 13px; border-radius: 50%; background: var(--hair); }
    #edif .v-fig.h-curly .hf { left: -5px; top: -7px; width: 38px; height: 22px; border-radius: 50%; }
    #edif .v-fig.h-curly .hb { display: block; left: -5px; top: 2px; width: 38px; height: 24px; border-radius: 50%; }
    #edif .v-fig.h-bald .hf { display: none; }
    #edif .v-fig .beard { display: none; left: 1px; top: 15px; width: 26px; height: 15px; border-radius: 2px 2px 14px 14px; background: var(--hair); filter: brightness(.9); }
    #edif .v-fig.has-beard .beard { display: block; }
    #edif .v-fig .nose { left: 12.5px; top: 15px; width: 3px; height: 5px; border-radius: 50%; background: var(--skin); filter: brightness(.86); }
    #edif .v-fig .mouth { left: 9.5px; top: 22px; width: 9px; height: 2.6px; border-radius: 0 0 8px 8px; background: #9a4545; }
    #edif .v-fig .eye { top: 12px; width: 3.6px; height: 4.4px; border-radius: 50%; background: #2a211c; animation: v-blink 5s infinite; }
    #edif .v-fig .eye.l { left: 7px; } #edif .v-fig .eye.r { left: 17.4px; animation-delay: .1s; }
    #edif .v-fig .brow { top: 8px; width: 7px; height: 1.8px; border-radius: 2px; background: var(--hair); filter: brightness(.8); }
    #edif .v-fig .brow.l { left: 5.5px; } #edif .v-fig .brow.r { left: 15.5px; }
    #edif .v-fig .glasses { display: none; left: 3px; top: 9.5px; width: 22px; height: 9px; }
    #edif .v-fig.has-glasses .glasses { display: block; }
    #edif .v-fig .glasses::before, #edif .v-fig .glasses::after { content: ''; position: absolute; top: 0; width: 9px; height: 9px; border: 1.6px solid #222; border-radius: 50%; background: #fff3; }
    #edif .v-fig .glasses::before { left: 0; } #edif .v-fig .glasses::after { right: 0; }
    #edif .v-me { position: absolute; left: 50%; top: -17px; transform: translateX(-50%); background: #ffd23f; color: #3b2410; font-size: calc(11px * var(--ik, 1) / var(--s, 1)); font-weight: 900; border-radius: 8px; padding: 0 5px; white-space: nowrap; line-height: 1.35; z-index: 3; }
    /* animaciones */
    #edif .v-fig.walking .leg.l, #edif .v-fig.walking .arm.r { animation: v-swingA .56s linear infinite; }
    #edif .v-fig.walking .leg.r, #edif .v-fig.walking .arm.l { animation: v-swingB .56s linear infinite; }
    #edif .v-fig.walking .v-body { animation: v-bob .28s ease-in-out infinite; }
    #edif .v-fig.holding:not(.walking) .arm.r, #edif .v-fig.holding.walking .arm.r { animation: none; transform: rotate(-30deg); }
    #edif .v-fig.talk .arm.l { animation: v-gest .8s ease-in-out infinite; }
    #edif .v-fig.talk .mouth { animation: v-mouth .3s ease-in-out infinite; }
    #edif .v-fig.sip .arm.r { animation: v-sip 1.8s ease-in-out; }
    #edif .v-fig.cheer .arm.r { animation: v-cheer .9s ease-in-out 2; }
    #edif .v-fig.sit .v-body { transform: translateY(26px); }
    @keyframes v-swingA { 0%, 100% { transform: rotate(-26deg); } 50% { transform: rotate(26deg); } }
    @keyframes v-swingB { 0%, 100% { transform: rotate(26deg); } 50% { transform: rotate(-26deg); } }
    @keyframes v-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    @keyframes v-gest { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-42deg); } }
    @keyframes v-mouth { 0%, 100% { height: 2.6px; border-radius: 0 0 8px 8px; } 50% { height: 6px; border-radius: 50%; } }
    @keyframes v-sip { 0%, 100% { transform: rotate(-30deg); } 35%, 65% { transform: rotate(-142deg); } }
    @keyframes v-cheer { 0%, 100% { transform: rotate(-30deg); } 50% { transform: rotate(-85deg); } }
    @keyframes v-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
    @keyframes v-pop { 0% { transform: scale(.2); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { #edif .v-fig.walking .leg, #edif .v-fig.walking .arm, #edif .v-fig.walking .v-body, #edif .v-fig.talk .arm { animation: none; } }
  `;
  document.head.appendChild(st);

  // ---------- Utilidades ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const sound = n => { try { if (window.sfx) sfx(n); } catch (e) {} };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const dayStr = () => new Date().toLocaleDateString('en-CA');
  function localEntries() { try { const o = JSON.parse(localStorage.getItem('visitasEntradas') || '{}'); return o.d === dayStr() ? Number(o.n) || 0 : 0; } catch (e) { return 0; } }
  function setLocalEntries(n) { try { localStorage.setItem('visitasEntradas', JSON.stringify({ d: dayStr(), n })); } catch (e) {} }
  const toast = msg => { try { if (window.flashToast) { flashToast(msg); return; } } catch (e) {} try { alert(msg); } catch (e) {} };
  const NAMES = [['Rosa', 'f'], ['Marta', 'f'], ['Pedro', 'm'], ['Luis', 'm'], ['Elena', 'f'], ['Javier', 'm'], ['Inés', 'f'], ['Pablo', 'm'], ['Carmen', 'f'], ['Andrés', 'm'], ['Sofía', 'f'], ['Nacho', 'm']];

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


  // ---------- Estilos propios de los edificios ----------
  const st2 = document.createElement('style');
  st2.textContent = `
    #edif .e-sign { position: absolute; top: 14px; padding: 4px 16px; border-radius: 8px; background: var(--sc, #2e7d32); color: #fff; font-weight: 900; font-size: 18px; letter-spacing: 1px; z-index: 3; white-space: nowrap; box-shadow: 0 3px 0 #0004; }
    #edif .e-it { position: absolute; line-height: 1; text-align: center; margin-left: -.5em; }
    #edif .e-shelf { position: absolute; z-index: 2; height: 48px; border-bottom: 6px solid #7a4b24; display: flex; justify-content: space-around; align-items: flex-end; font-size: 24px; line-height: 1; background: linear-gradient(90deg, #0000, #0000), #0000; }
    #edif .e-counter { position: absolute; z-index: 20; height: 46px; bottom: 80px; background: var(--cnt, #eee); border-radius: 6px 6px 0 0; box-shadow: inset 0 8px 0 #fff5, inset 0 -10px 0 #0003; }
    #edif .e-table { position: absolute; z-index: 18; height: 40px; bottom: 58px; background: var(--cnt, #fff); border-radius: 8px 8px 4px 4px; box-shadow: inset 0 7px 0 #fff, inset 0 -8px 0 #0002; }
    #edif .e-door { position: absolute; left: 8px; bottom: 132px; width: 74px; height: 150px; border: 5px solid #455a64; border-bottom: 0; border-radius: 6px 6px 0 0; background: linear-gradient(135deg, #bfe6ffcc, #e8f6ffcc); z-index: 3; transform-origin: left center; transition: transform .9s ease; display: grid; place-items: center; font-size: 28px; }
    #edif .e-door.open { transform: perspective(600px) rotateY(-72deg); }
    #edif .e-gone { opacity: 0 !important; }
    #edif .e-doorbell { width: 34px; height: 34px; border-radius: 50%; background: #f0c040; border: 3px solid #455a64; display: grid; place-items: center; text-align: center; line-height: 1; box-shadow: 0 2px 0 #0004; }
    #edif .e-doorbell.ring { animation: e-ring .5s ease-in-out 2; background: #fff176; }
    #edif .e-wave { position: absolute; width: 44px; height: 44px; border-radius: 50%; border: 3px solid #ffe680; z-index: 29; pointer-events: none; animation: e-wave 1s ease-out 2; }
    @keyframes e-ring { 0%, 100% { transform: rotate(0) scale(1); } 25% { transform: rotate(-14deg) scale(1.2); } 75% { transform: rotate(14deg) scale(1.2); } }
    @keyframes e-wave { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(2.2); opacity: 0; } }
  `;
  document.head.appendChild(st2);

  // ---------- Escenas ----------
  // Decoración: ['sh',x,bottom,ancho,[emojis]] estante · ['cn',x,ancho] mostrador · ['tb',x,ancho] mesa · ['it',emoji,x,bottom,tamaño,z] objeto
  // Sitios: nombre: [x, profundidad 0 delante … 1 al fondo]. Pasos del guion: ['E','frase'] habla · go/bg/put/hold/sfx/sub/wait/sit/stand/eat/cheer.
  // E = empleado, D = segundo empleado, C = otro cliente, V = tú. {algo} se rellena con lo que sale al azar en cada visita.
  const P = pick;
  const SCN = {
    farmacia: {
      t: 'Farmacia', ic: '💊', sign: 'FARMACIA ✚', sx: 150, sc: '#2e9e5b', wall: '#e8f5ee', floor: '#cfd8dc', cnt: '#f7f7f7', uni: '#f4f4f4', bell: 1,
      roles: { E: 'farmacéutica', C: 'cliente' },
      dec: [['sh', 100, 215, 150, ['💊', '🧴', '💊', '🩹', '🧴']], ['it', '🩺', 175, 272, 34, 2], ['sh', 345, 215, 195, ['💊', '🧴', '💊', '🧪', '🧴', '💊']], ['sh', 345, 266, 195, ['🧴', '💊', '🩹', '💊', '🧪']], ['cn', 320, 220], ['it', '🧾', 350, 128, 22, 21], ['it', '💳', 380, 128, 22, 21], ['it', '🪴', 285, 100, 44, 4], ['it', '⚖️', 110, 100, 36, 4]],
      sp: { in: [135, .35], front: [350, .3], behind: [450, .92], shelf: [400, .92], C0: [350, .3], door: [45, 1] },
      v: () => P([
        { s: 'un dolor de cabeza fuerte', m: 'paracetamol', e: '💊', d: 'Una pastilla cada ocho horas, mejor con algo en el estómago', p: '3,40' },
        { s: 'mucha tos por las noches', m: 'un jarabe para la tos', e: '🧴', d: 'Una cucharada cada ocho horas', p: '6,25' },
        { s: 'alergia, me lloran los ojos', m: 'un antihistamínico', e: '💊', d: 'Una al día, por la mañana', p: '7,90' },
        { s: 'una quemadura del sol en la espalda', m: 'una crema para quemaduras', e: '🧴', d: 'Una capa fina dos veces al día', p: '9,50' },
        { s: 'la garganta muy irritada', m: 'unas pastillas para la garganta', e: '🍬', d: 'Una cada tres horas, sin pasarse', p: '4,80' }]),
      body: v => [['put', 'E', 'behind'], ['put', 'C', 'C0'], ['hold', 'C', '🛍️'], ['sub', 'En la farmacia hay una clienta delante…'],
        ['E', 'Aquí tiene. Una cápsula al día con el desayuno.'], ['C', 'Muchas gracias. ¡Hasta luego!'], ['sfx', 'pop'], ['bg', 'C', 'door', 85], ['wait', 900],
        ['E', '¡Buenos días! Enseguida le atiendo.', { to: 'V' }], ['go', 'V', 'front', 85], ['sub', 'Pides en el mostrador'],
        ['E', 'Dígame, ¿en qué puedo ayudarle?'], ['V', 'Buenos días. Tengo {s}.'],
        ['E', 'Vaya, lo siento. ¿Es alérgico a algún medicamento?'], ['V', 'No, que yo sepa.'],
        ['E', 'Entonces le recomiendo {m}. Voy a buscarlo.'], ['go', 'E', 'shelf', 100], ['hold', 'E', '{e}'], ['sfx', 'vasos'], ['go', 'E', 'behind', 100],
        ['E', '{d}. Y si en tres días sigue igual, vaya al médico.'], ['V', 'De acuerdo, lo haré. ¿Cuánto es?'],
        ['sfx', 'pop'], ['E', 'Son {p} euros.'], ['V', 'Pago con tarjeta.'], ['sfx', 'click'], ['sfx', 'coin'], ['hold', 'E', null], ['hold', 'V', '🛍️'],
        ['E', 'Aquí tiene la bolsa y el ticket. ¡Que se mejore!'], ['V', 'Muchas gracias, ¡adiós!']]
    },
    supermercado: {
      t: 'Supermercado', ic: '🛒', sign: 'SUPERMERCADO', sx: 150, sc: '#e67e22', wall: '#fdf3e0', floor: '#d9d3c7', cnt: '#cfd8dc', uni: '#2e9e5b', bell: 0,
      roles: { E: 'cajera', D: 'reponedor', C: 'cliente' },
      dec: [['sh', 100, 215, 215, ['🥖', '🥛', '🧀', '🥚', '🍪', '🥫']], ['sh', 100, 266, 215, ['🍎', '🍌', '🍅', '🥕', '🍋']], ['sh', 100, 100, 215, ['🧃', '🍝', '🍚', '🥫', '🥤']], ['cn', 400, 150], ['it', '🧾', 430, 128, 22, 21], ['it', '🍫', 470, 128, 20, 21], ['it', '🛒', 340, 90, 40, 19]],
      sp: { queue: [315, .12], in: [135, .3], a1: [150, .8], a2: [230, .8], a3: [290, .15], front: [380, .3], behind: [480, .92], stock: [250, .85], C0: [380, .3], door: [45, 1] },
      v: () => { const f = shuffle([['el pan', '🥖'], ['leche', '🥛'], ['manzanas', '🍎'], ['huevos', '🥚'], ['queso', '🧀'], ['pasta', '🍝'], ['tomates', '🍅'], ['galletas', '🍪'], ['plátanos', '🍌']]); return { n1: f[0][0], e1: f[0][1], n2: f[1][0], e2: f[1][1], n3: f[2][0], e3: f[2][1], t: P(['11,35', '18,90', '23,40', '14,75']) }; },
      body: v => [['put', 'E', 'behind'], ['put', 'D', 'stock'], ['put', 'C', 'C0'], ['hold', 'C', '🧺'], ['hold', 'V', '🧺'], ['sub', 'Coges una cesta y buscas por los pasillos'],
        ['go', 'V', 'a1', 80], ['D', 'Buenas, ¿le ayudo a encontrar algo?', { to: 'V' }], ['V', 'Sí, busco {n1}. ¿Dónde está?'], ['D', 'Segundo pasillo, justo al fondo.'], ['V', 'Muchas gracias.'],
        ['go', 'V', 'a2', 80], ['hold', 'V', '{e1}'], ['sfx', 'pop'], ['wait', 600], ['hold', 'V', '🧺'], ['V', 'Ya tengo {n1}. Ahora {n2}.'],
        ['go', 'V', 'a3', 80], ['hold', 'V', '{e2}'], ['sfx', 'pop'], ['wait', 600], ['hold', 'V', '🧺'], ['V', 'Y para acabar, {n3}.'], ['hold', 'V', '{e3}'], ['sfx', 'pop'], ['wait', 600], ['hold', 'V', '🧺'],
        ['sub', 'Pasas por caja'], ['go', 'V', 'queue', 80],
        ['E', 'Son seis con cuarenta. ¿Paga con tarjeta?', { to: 'C' }], ['C', 'Sí, con tarjeta.'], ['sfx', 'click'], ['sfx', 'coin'], ['E', 'Gracias, que tenga buen día.'], ['C', 'Igualmente, hasta luego.'], ['hold', 'C', null], ['bg', 'C', 'door', 85],
        ['E', 'Buenas, ¿qué tal? Gracias por esperar.', { to: 'V' }], ['go', 'V', 'front', 80], ['V', 'Hola, buenas.'], ['sfx', 'pop'], ['wait', 300], ['sfx', 'pop'], ['wait', 300], ['sfx', 'pop'],
        ['E', 'Son {t} euros. ¿Tiene la tarjeta de puntos?'], ['V', 'No, todavía no. Y una bolsa, por favor.'], ['E', 'Claro, aquí tiene. ¿Paga con tarjeta o en efectivo?'],
        ['V', 'Con tarjeta.'], ['sfx', 'click'], ['sfx', 'coin'], ['hold', 'V', '🛍️'], ['E', '¡Muchas gracias! Que tenga un buen día.'], ['V', 'Igualmente, ¡hasta luego!']]
    },
    gasolinera: {
      t: 'Gasolinera', ic: '⛽', sign: 'GASOLINERA', sx: 150, sc: '#d32f2f', wall: '#eef3f7', floor: '#b0bec5', cnt: '#fff176', uni: '#d32f2f', bell: 1,
      roles: { E: 'dependiente', C: 'camionero' },
      dec: [['it', '⛽🚗', 150, 205, 34, 2], ['sh', 345, 215, 195, ['🥤', '🍫', '🥪', '🍪', '🧃', '🥤']], ['sh', 345, 266, 195, ['🛢️', '🧴', '🍿', '🍬', '🥜']], ['cn', 320, 220], ['it', '☕', 540, 128, 34, 21], ['it', '🧾', 360, 128, 22, 21], ['it', '🍩', 400, 128, 22, 21], ['it', '🥤', 210, 100, 34, 4]],
      sp: { in: [135, .35], front: [370, .3], behind: [450, .92], cafe: [250, .2], C0: [250, .2], door: [45, 1] },
      v: () => { const eu0 = P(['42,10', '55,80', '38,60', '61,25']); return { tot: (parseFloat(eu0.replace(',', '.')) + 3.5).toFixed(2).replace('.', ','), n: P(['2', '3', '4', '5']), eu: eu0, c: P([['un café con leche', '☕'], ['un café solo', '☕'], ['un refresco', '🥤']]), s: P([['un bocadillo de jamón', '🥪'], ['unas galletas', '🍪'], ['una bolsa de patatas', '🍿']]) }; },
      body: v => [['put', 'E', 'behind'], ['put', 'C', 'C0'], ['hold', 'C', '☕'], ['sub', 'Acabas de repostar y entras a pagar'],
        ['C', 'Oye, ¿tienes cambio de veinte euros?', { to: 'E' }], ['E', 'Claro. Toma, cuéntalo. Y buen viaje.'], ['C', 'Gracias, compañero. ¡A rodar!'], ['bg', 'C', 'door', 85],
        ['go', 'V', 'front', 85], ['V', 'Buenas. He echado gasolina en el surtidor {n}.'], ['E', 'A ver… surtidor {n}. Son {eu} euros. ¿Algo más?'],
        ['V', 'Sí, {c[0]} y {s[0]}.'], ['E', 'El café lo tiene en la máquina, ahí a la izquierda. El bocadillo se lo preparo ahora.'],
        ['go', 'V', 'cafe', 85], ['hold', 'V', '{c[1]}'], ['sfx', 'vasos'], ['wait', 900], ['go', 'V', 'front', 85],
        ['E', 'Aquí tiene su bocadillo, recién hecho.'], ['sfx', 'pop'], ['E', 'Pues todo junto son {tot} euros.'], ['V', 'Perfecto. Pago con tarjeta.'],
        ['sfx', 'click'], ['sfx', 'coin'], ['E', '¿Quiere factura?'], ['V', 'No hace falta, gracias.'], ['E', 'Pues ya está. ¡Buen viaje, y con cuidado!'], ['V', 'Gracias, ¡hasta pronto!']]
    },
    policia: {
      t: 'Comisaría', ic: '👮', sign: 'POLICÍA', sx: 150, sc: '#1f3a8a', wall: '#e3e8f0', floor: '#9aa5b1', cnt: '#8d6e63', uni: '#1f3a5f', bell: 0,
      roles: { E: 'agente', D: 'agente' },
      dec: [['it', '🏳️', 110, 215, 40, 2], ['it', '📋', 440, 250, 34, 2], ['it', '🗄️', 170, 140, 56, 4], ['cn', 360, 180], ['it', '💻', 420, 128, 30, 21], ['it', '🖨️', 480, 128, 28, 21], ['it', '🪑', 290, 96, 44, 12]],
      sp: { in: [135, .35], chair: [290, .5], behind: [450, .92], D0: [200, .8], door: [45, 1], pasillo: [120, .9] },
      v: () => { const c = P([
        { c: 'me han robado la bicicleta de la puerta del trabajo', w: 'ayer por la tarde, en la calle del mercado', x: 'era azul, con una cesta delante' },
        { c: 'he perdido la cartera con todos mis documentos', w: 'esta mañana, creo que en el autobús', x: 'es negra, de cuero, con una foto familiar dentro' },
        { c: 'alguien ha rayado mi coche en el aparcamiento', w: 'esta noche, en el parking del barrio', x: 'tiene una raya larga en la puerta del conductor' },
        { c: 'me han robado el móvil en la plaza', w: 'hace una hora, en la plaza mayor', x: 'es negro, con una funda roja' }]); c.num = 'D-' + (1000 + Math.floor(Math.random() * 9000)); return c; },
      body: v => [['put', 'E', 'behind'], ['put', 'D', 'D0'], ['hold', 'D', '☕'], ['sub', 'Entras en la comisaría'],
        ['D', 'Compañero, te dejo el café encima de la mesa.', { to: 'E' }], ['E', 'Gracias, ahora mismo lo cojo.'], ['bg', 'D', 'pasillo', 80],
        ['V', 'Buenas tardes. Vengo a poner una denuncia.'], ['E', 'Pase y siéntese, por favor. Le atiendo ahora mismo.'], ['sit', 'V', 'chair', 1], ['sub', 'Pones la denuncia'],
        ['E', 'Cuénteme con calma qué ha ocurrido.'], ['V', '{c}.'], ['E', 'Lamento oírlo. ¿Cuándo y dónde fue exactamente?'], ['V', 'Fue {w}.'],
        ['E', '¿Recuerda algo que ayude a identificarlo?'], ['V', 'Sí: {x}.'], ['E', 'Lo apunto todo.'], ['sfx', 'click'], ['wait', 300], ['sfx', 'click'], ['wait', 300], ['sfx', 'click'],
        ['E', 'Necesito su documento de identidad, por favor.'], ['V', 'Aquí lo tiene.'], ['hold', 'V', '🪪'], ['wait', 700], ['hold', 'V', null],
        ['sfx', 'pop'], ['E', 'Ya está impreso. Fírmeme aquí, por favor.'], ['V', 'Hecho.'],
        ['E', 'Esta es su copia, con el número de denuncia {num}. Le avisaremos si hay novedades.'], ['hold', 'V', '📄'], ['V', 'Muchas gracias por su ayuda, agente.'], ['E', 'Para eso estamos. Que tenga buena tarde.'], ['stand', 'V']]
    },
    colegio: {
      t: 'Colegio', ic: '🏫', sign: 'COLEGIO', sx: 150, sc: '#8e24aa', wall: '#f4ecd8', floor: '#c9b79c', cnt: '#a1887f', uni: '#8e24aa', bell: 0,
      roles: { E: 'secretaria', D: 'director' },
      dec: [['it', '🎨', 120, 215, 40, 2], ['it', '🔔', 270, 262, 30, 2], ['sh', 100, 100, 100, ['📚', '🎒', '📚']], ['cn', 350, 190], ['it', '📄', 400, 128, 24, 21], ['it', '🖊️', 450, 128, 22, 21], ['it', '🌳', 530, 100, 48, 4]],
      sp: { in: [135, .35], front: [380, .3], behind: [450, .92], D0: [220, .8], pizarra: [260, .75], door: [45, 1] },
      v: () => P([{ e: 'seis años', c: 'primero de primaria' }, { e: 'tres años', c: 'infantil de tres años' }, { e: 'diez años', c: 'quinto de primaria' }]),
      body: v => [['put', 'E', 'behind'], ['put', 'D', 'D0'], ['sub', 'Llegas a la secretaría del colegio'], ['go', 'V', 'front', 85],
        ['E', 'Buenos días, bienvenido. ¿En qué puedo ayudarle?'], ['V', 'Buenos días. Vengo a matricular a mi hijo para el próximo curso.'],
        ['E', 'Perfecto, qué alegría. ¿Qué edad tiene?'], ['V', 'Tiene {e}.'], ['E', 'Entonces entra en {c}. Rellene este impreso, por favor.'], ['hold', 'E', '📄'], ['wait', 500], ['hold', 'E', null], ['hold', 'V', '📄'],
        ['sfx', 'click'], ['wait', 600], ['V', 'Ya lo tengo rellenado.'], ['hold', 'V', null],
        ['E', 'Muy bien. Mañana traiga el libro de familia y una foto, ¿de acuerdo?'], ['V', 'Sí, los traigo mañana a primera hora.'],
        ['sfx', 'adios'], ['sub', 'Suena el timbre del colegio'], ['E', 'Ese es el timbre del recreo. Si quiere, el director le enseña las instalaciones.'],
        ['bg', 'D', 'in', 85], ['D', '¡Bienvenido! Soy {D}, el director del colegio. Sígame, le enseño un aula.'], ['go', 'D', 'pizarra', 85], ['go', 'V', 'in', 85],
        ['D', 'Aquí aprenden a leer, a pintar y a jugar en equipo.'], ['V', 'Qué bonito, y qué ambiente tan agradable.'], ['D', 'Gracias. Les esperamos con ilusión el próximo curso.'], ['V', 'Muchas gracias por todo, ¡hasta mañana!']]
    },
    restaurante: {
      t: 'Restaurante', ic: '🍽️', sign: 'RESTAURANTE', sx: 150, sc: '#b71c1c', wall: '#f6e6d2', floor: '#8d6e63', cnt: '#fffde7', uni: '#ffffff', bell: 0,
      roles: { E: 'camarero', C: 'cliente' },
      dec: [['sh', 400, 215, 140, ['🍷', '🍾', '🥂', '🍷']], ['it', '🖼️', 130, 220, 44, 2], ['tb', 230, 150], ['it', '🍽️', 300, 100, 22, 19], ['it', '🪑', 250, 100, 44, 12], ['cn', 440, 100], ['it', '☕', 460, 128, 26, 21], ['it', '🪴', 130, 100, 44, 4]],
      sp: { in: [135, .35], mesa: [265, .62], serve: [335, .15], kitchen: [500, .8], barra: [440, .9], bar2: [490, .3], door: [45, 1] },
      v: () => { const b = P([['una limonada', '🍹'], ['un agua con gas', '🥤'], ['un zumo de naranja', '🧃']]), pl = P([['la paella', '🥘'], ['una ensalada mixta', '🥗'], ['pasta con tomate', '🍝'], ['pescado a la plancha', '🐟'], ['una hamburguesa', '🍔']]), po = P([['un flan', '🍮'], ['un helado', '🍨'], ['una tarta de queso', '🍰']]); return { b, pl, po, t: P(['24,50', '31,80', '27,00']) }; },
      body: v => [['put', 'E', 'barra'], ['put', 'C', 'bar2'], ['hold', 'C', '☕'], ['sub', 'Entras en el restaurante'], ['C', 'Un cortado más, por favor.', { to: 'E' }], ['E', 'Marchando.'],
        ['E', '¡Buenas tardes, bienvenido! ¿Mesa para uno?', { to: 'V' }], ['bg', 'E', 'in', 90], ['V', 'Sí, por favor.'], ['E', 'Sígame, esta mesa está muy bien.'],
        ['go', 'E', 'serve', 90], ['sit', 'V', 'mesa', 1], ['E', 'Aquí tiene la carta. ¿Qué le apetece beber?'], ['hold', 'E', '📋'], ['wait', 600], ['hold', 'E', null], ['sfx', 'vasos'],
        ['V', 'Gracias. Me trae {b[0]}, por favor.'], ['bg', 'E', 'kitchen', 90], ['wait', 1400], ['go', 'E', 'serve', 90], ['hold', 'E', '{b[1]}'], ['wait', 400], ['hold', 'E', null], ['hold', 'V', '{b[1]}'], ['sfx', 'vasos'],
        ['E', 'Aquí tiene. ¿Ya sabe qué va a pedir?'], ['V', 'Sí, quiero {pl[0]}.'], ['E', 'Excelente elección. Marchando.'], ['sub', 'Esperas la comida'], ['eat', 'V'], ['go', 'E', 'kitchen', 90], ['wait', 1500], ['go', 'E', 'serve', 90],
        ['hold', 'E', '{pl[1]}'], ['sfx', 'vasos'], ['hold', 'E', null], ['hold', 'V', '{pl[1]}'], ['E', 'Que aproveche.'], ['eat', 'V'], ['V', '¡Qué buena pinta! Mmm, está riquísimo.'],
        ['E', '¿Todo bien por aquí? ¿Va a querer postre?'], ['V', 'Sí, {po[0]}, por favor.'], ['go', 'E', 'kitchen', 90], ['wait', 1000], ['go', 'E', 'serve', 90], ['hold', 'V', '{po[1]}'], ['sfx', 'vasos'], ['eat', 'V'],
        ['V', 'La cuenta, por favor.'], ['sfx', 'pop'], ['E', 'Son {t} euros.'], ['V', 'Pago con tarjeta. Y quédese con el cambio.'], ['sfx', 'click'], ['sfx', 'coin'], ['hold', 'V', null],
        ['E', '¡Muchas gracias! Vuelva pronto.'], ['V', 'Seguro que sí. ¡Estaba todo buenísimo!'], ['stand', 'V']]
    }
    ,
    futbol: {
      t: 'Campo de fútbol', ic: '⚽', sign: 'ESTADIO ⚽', sx: 150, sc: '#2e7d32', wall: 'linear-gradient(#7ec8f5 0 46%, #cfe9ff 46% 100%)', floor: 'repeating-linear-gradient(90deg, #3f9b3a 0 60px, #48a843 60px 120px)', cnt: '#ffffff', uni: '#1565c0', uniD: '#212121', bell: 1,
      roles: { E: 'entrenador', D: 'árbitro', C: 'jugador' },
      dec: [['sh', 205, 212, 330, ['👏', '🎉', '🙌', '📣', '👏', '🎉', '🙌', '📣']], ['sh', 205, 252, 330, ['🙌', '👏', '🎉', '📣', '🙌', '👏', '🎉', '🙌']], ['it', '🥅', 500, 104, 76, 4], ['it', '🚩', 190, 100, 26, 4], ['it', '🪑🪑', 215, 100, 28, 4], ['it', '🏆', 330, 262, 30, 3]],
      sp: { in: [135, .35], center: [245, .35], ball: [335, .2], goal: [470, .55], bench: [215, .85], coach: [270, .85], ref: [400, .85], shoot: [345, .25], door: [45, 1] },
      v: () => ({ pos: P(['delantero', 'centrocampista', 'defensa', 'extremo']), n: P(['7', '9', '10', '11']), eq: P(['Los Leones', 'Real Barrio', 'Deportivo Mundial', 'Atlético Vecinal']) }),
      body: v => [['put', 'E', 'coach'], ['put', 'D', 'ref'], ['put', 'C', 'ball'], ['hold', 'C', '⚽'], ['hold', 'D', '📯'], ['sub', 'Entras al campo de fútbol'],
        ['E', '¡Bienvenido al campo! Soy el entrenador de {eq}. ¿Vienes a la prueba?', { to: 'V' }], ['V', 'Sí, quiero jugar de {pos}.'],
        ['E', 'Estupendo. Toma la camiseta del equipo: el dorsal {n} está libre.'], ['hold', 'E', '👕'], ['wait', 500], ['hold', 'E', null], ['hold', 'V', '👕'], ['sfx', 'pop'],
        ['V', '¡Gracias, entrenador! Me la pongo ahora mismo.'], ['wait', 600], ['hold', 'V', null],
        ['sub', 'Calentamiento sobre el césped'], ['go', 'V', 'center', 85], ['E', 'Primero, calentamiento. ¡Dos vueltas al campo!'],
        ['go', 'V', 'goal', 125], ['go', 'V', 'bench', 125], ['go', 'V', 'goal', 125], ['go', 'V', 'center', 125], ['cheer', 'V'], ['E', '¡Muy bien! Ahora un pase con tu compañero.'],
        ['sub', 'Pase con un compañero'], ['C', '¡Aquí, aquí! ¡Pásamela!', { to: 'V' }], ['hold', 'C', null], ['hold', 'V', '⚽'], ['sfx', 'balon'], ['wait', 450], ['hold', 'V', null], ['hold', 'C', '⚽'], ['V', '¡Toma!'],
        ['sfx', 'balon'], ['wait', 450], ['hold', 'C', null], ['hold', 'V', '⚽'], ['C', '¡Buen control! Tienes un pie de oro.'],
        ['sub', 'Lanzas un penalti'], ['go', 'V', 'shoot', 85], ['D', 'Atención: penalti a favor. ¡Portero, a su sitio!'], ['sfx', 'silbato'], ['E', 'Tranquilo. Respira y chuta con confianza.'],
        ['sfx', 'balon'], ['hold', 'V', null], ['wait', 650], ['sfx', 'gol'], ['cheer', 'V'], ['cheer', 'C'], ['cheer', 'E'], ['D', '¡GOOOL! ¡Qué disparo tan potente!', { big: true }],
        ['V', '¡Gooool! ¡No me lo puedo creer!'], ['E', 'Prueba superada: ya eres uno más del equipo. Mañana, entrenamiento a las cinco.'], ['V', '¡Allí estaré! ¡Gracias a todos, hasta mañana!']]
    },
    hotel: {
      t: 'Hotel', ic: '🏨', sign: 'HOTEL ★★★★', sx: 150, sc: '#6a1b9a', wall: '#f3e9dc', floor: '#8e3b46', cnt: '#6d4c41', uni: '#263238', uniD: '#b71c1c', bell: 1,
      roles: { E: 'recepcionista', D: 'botones', C: 'huésped' },
      dec: [['it', '🖼️', 130, 225, 42, 2], ['it', '🕰️', 365, 262, 30, 2], ['it', '🗝️', 430, 262, 26, 2], ['cn', 330, 170], ['it', '🛎️', 360, 128, 26, 21], ['it', '💻', 440, 128, 26, 21], ['it', '🔑', 405, 128, 22, 21], ['it', '🪴', 120, 100, 46, 4], ['it', '🛋️', 205, 96, 54, 12], ['it', '🛗', 520, 146, 66, 4]],
      sp: { in: [135, .35], front: [345, .28], behind: [440, .92], sofa: [215, .45], lift: [510, .6], lift2: [462, .58], bag: [180, .5], door: [45, 1], C0: [345, .28] },
      v: () => ({ room: P(['204', '312', '108', '415']), noches: P(['dos', 'tres', 'cuatro']), piso: P(['segunda', 'tercera', 'primera', 'cuarta']) }),
      body: v => [['put', 'E', 'behind'], ['put', 'D', 'bag'], ['put', 'C', 'C0'], ['hold', 'C', '🗝️'], ['sub', 'Entras en el hotel'],
        ['C', 'Gracias por todo. La estancia ha sido maravillosa.', { to: 'E' }], ['E', 'Gracias a usted. ¡Que tenga buen viaje!'], ['sfx', 'pop'], ['hold', 'C', null], ['bg', 'C', 'door', 85], ['wait', 900],
        ['E', '¡Buenas tardes y bienvenido al hotel!', { to: 'V' }], ['go', 'V', 'front', 85], ['sfx', 'campanilla'], ['sub', 'Haces el registro en recepción'],
        ['V', 'Buenas tardes. Tengo una reserva para esta noche.'], ['E', 'Enseguida lo busco… sí, aquí está. Son {noches} noches, ¿verdad?'], ['V', 'Exacto, {noches} noches.'],
        ['E', 'Necesito su documento de identidad, por favor.'], ['hold', 'V', '🪪'], ['wait', 700], ['hold', 'V', null], ['sfx', 'click'], ['wait', 300], ['sfx', 'click'],
        ['E', 'Todo en orden. Su habitación es la {room}, en la {piso} planta. El desayuno se sirve de siete a diez.'], ['hold', 'E', '🔑'], ['wait', 500], ['hold', 'E', null], ['hold', 'V', '🔑'], ['sfx', 'pop'],
        ['V', '¡Perfecto! Muchas gracias.'], ['E', 'Le acompaña nuestro botones con el equipaje.'],
        ['bg', 'D', 'front', 90], ['wait', 1200], ['D', '¡Bienvenido! Yo me encargo de las maletas.', { to: 'V' }], ['hold', 'D', '🧳'], ['sfx', 'pop'],
        ['sub', 'Subes en el ascensor'], ['go', 'D', 'lift', 90], ['go', 'V', 'lift2', 90], ['sfx', 'ascensor'], ['wait', 1200], ['sfx', 'ascensor'],
        ['D', 'Aquí está su habitación, la {room}. Que descanse mucho.'], ['hold', 'D', null], ['hold', 'V', '💶'], ['V', 'Muchas gracias por su ayuda. Esto es para usted.'], ['sfx', 'coin'], ['hold', 'V', null],
        ['D', '¡Muy amable! Si necesita algo, llame a recepción.'], ['V', '¡Qué ganas de descansar! Luego bajo a dar un paseo.']]
    },
    hospital: {
      t: 'Hospital', ic: '🏥', sign: 'HOSPITAL ✚', sx: 150, sc: '#c62828', wall: '#eef7fb', floor: '#cfd8dc', cnt: '#ffffff', uni: '#e0f2f1', uniD: '#00897b', bell: 0,
      roles: { E: 'enfermera', D: 'doctora' },
      dec: [['it', '✚', 125, 222, 56, 2], ['it', '🩺', 250, 264, 30, 2], ['it', '🛏️', 500, 100, 62, 6], ['cn', 330, 170], ['it', '🌡️', 370, 128, 24, 21], ['it', '💻', 430, 128, 26, 21], ['it', '🪑', 250, 96, 44, 12], ['it', '🪴', 128, 100, 44, 4]],
      sp: { in: [135, .35], front: [345, .28], behind: [440, .92], chair: [250, .5], doc: [330, .75], door: [45, 1], pasillo: [150, .85] },
      v: () => P([{ s: 'mucha fiebre desde anoche', t: '38,6', d: 'Reposo, mucho líquido y un antitérmico cada ocho horas', e: '💊' }, { s: 'un dolor fuerte en el tobillo', t: '36,7', d: 'Reposo, hielo y una venda de compresión', e: '🩹' }, { s: 'dolor de garganta y mucha tos', t: '37,4', d: 'Beber líquidos calientes y tomar este jarabe', e: '🧴' }]),
      body: v => [['put', 'E', 'behind'], ['put', 'D', 'pasillo'], ['sub', 'Entras en urgencias'],
        ['E', 'Buenas tardes. ¿Qué le ocurre?', { to: 'V' }], ['go', 'V', 'front', 85], ['V', 'Buenas tardes. Tengo {s}.'], ['E', 'Siento oírlo. Voy a tomarle la temperatura.'], ['hold', 'E', '🌡️'], ['wait', 900], ['sfx', 'beep'], ['hold', 'E', null],
        ['E', 'Tiene {t} grados. Siéntese y enseguida le atiende la doctora.'], ['sit', 'V', 'chair', 1], ['sub', 'Esperas a la doctora'], ['wait', 800],
        ['bg', 'D', 'doc', 85], ['wait', 1200], ['D', 'Buenas tardes, soy la doctora. Cuénteme qué le pasa.', { to: 'V' }], ['V', 'Tengo {s}.'],
        ['hold', 'D', '🩺'], ['sfx', 'click'], ['wait', 900], ['D', 'Respire hondo… otra vez… Muy bien.'], ['hold', 'D', null],
        ['D', 'No es nada grave. {d}.'], ['hold', 'D', '📄'], ['wait', 600], ['hold', 'D', null], ['hold', 'V', '{e}'], ['sfx', 'pop'],
        ['V', 'Muchas gracias, doctora. Me quedo mucho más tranquilo.'], ['D', 'Si empeora, vuelva sin dudarlo. ¡Que se mejore!'], ['stand', 'V']]
    },
    cine: {
      t: 'Cine', ic: '🎬', sign: 'CINE 🎬', sx: 150, sc: '#4a148c', wall: '#2b1b3d', floor: '#5d1a1a', cnt: '#8d6e63', uni: '#b71c1c', uniD: '#212121', bell: 0,
      roles: { E: 'taquillera', D: 'acomodador', C: 'cliente' },
      dec: [['it', '🎞️', 130, 224, 44, 2], ['it', '🍿', 255, 262, 34, 2], ['cn', 330, 170], ['it', '🎟️', 360, 128, 24, 21], ['it', '🍿', 410, 128, 28, 21], ['it', '🥤', 450, 128, 26, 21], ['it', '🪑🪑🪑', 215, 98, 30, 12]],
      sp: { in: [135, .35], front: [345, .28], behind: [440, .92], seat: [230, .6], door: [45, 1], C0: [345, .28], sala: [260, .85] },
      v: () => { const p = P([['una comedia', '😂'], ['una de aventuras', '🏔️'], ['una de ciencia ficción', '🚀'], ['una de misterio', '🕵️']]); return { p, h: P(['seis', 'siete y media', 'ocho']), pr: P(['9,50', '11,00', '8,50']) }; },
      body: v => [['put', 'E', 'behind'], ['put', 'D', 'sala'], ['put', 'C', 'C0'], ['hold', 'C', '🎟️'], ['sub', 'Llegas a la taquilla del cine'],
        ['C', 'Gracias, ya tengo la entrada. ¡Que disfrute de la sesión!', { to: 'E' }], ['E', 'Igualmente. ¡Hasta luego!'], ['bg', 'C', 'door', 85], ['wait', 800],
        ['E', '¡Bienvenido al cine! ¿Qué película quiere ver?', { to: 'V' }], ['go', 'V', 'front', 85], ['V', 'Me apetece {p[0]}. ¿Hay sesión a las {h}?'], ['E', 'Sí, quedan buenos asientos. Son {pr} euros.'],
        ['V', 'Pago con tarjeta.'], ['sfx', 'click'], ['sfx', 'coin'], ['hold', 'E', '🎟️'], ['wait', 500], ['hold', 'E', null], ['hold', 'V', '🎟️'], ['sfx', 'pop'],
        ['E', 'Aquí tiene su entrada. ¿Quiere palomitas?'], ['V', 'Claro, unas palomitas y un refresco.'], ['hold', 'V', '🍿'], ['sfx', 'vasos'], ['E', 'Que disfrute de la película.'],
        ['sub', 'Entras en la sala'], ['go', 'V', 'sala', 85], ['D', 'Buenas, ¿me enseña su entrada?', { to: 'V' }], ['V', 'Aquí la tiene.'], ['D', 'Fila cinco, butaca doce. Sígame con cuidado.'],
        ['sit', 'V', 'seat', 1], ['sub', 'Empieza la película'], ['eat', 'V'], ['wait', 1500], ['V', '¡Qué buena pinta tiene la película! Me va a encantar.'], ['eat', 'V'], ['wait', 1200], ['sfx', 'risa'], ['stand', 'V']]
    },
    pasteleria: {
      t: 'Pastelería', ic: '🍰', sign: 'PASTELERÍA 🧁', sx: 150, sc: '#ec407a', wall: '#fff0f5', floor: '#f8bbd0', cnt: '#ffffff', uni: '#ffffff', uniD: '#f48fb1', bell: 1,
      roles: { E: 'pastelera', C: 'cliente' },
      dec: [['sh', 100, 215, 170, ['🥐', '🍞', '🥖', '🥐']], ['sh', 345, 215, 195, ['🍰', '🧁', '🍩', '🍪', '🎂', '🍰']], ['sh', 345, 266, 195, ['🧁', '🍩', '🥧', '🍪', '🧁']], ['cn', 310, 240], ['it', '🧾', 360, 128, 22, 21], ['it', '🎂', 420, 128, 28, 21], ['it', '🪴', 120, 100, 44, 4]],
      sp: { in: [135, .35], front: [350, .3], behind: [450, .92], shelf: [420, .92], C0: [350, .3], door: [45, 1] },
      v: () => { const t = P([['una tarta de chocolate', '🎂'], ['una tarta de queso', '🍰'], ['seis cupcakes', '🧁'], ['una docena de donuts', '🍩']]); return { t, pr: P(['18,50', '22,00', '15,90', '12,60']) }; },
      body: v => [['put', 'E', 'behind'], ['put', 'C', 'C0'], ['hold', 'C', '🥐'], ['sub', 'Entras en la pastelería'],
        ['C', 'Mmm, ¡qué bien huele! Me llevo las magdalenas de siempre.', { to: 'E' }], ['E', 'Marchando. Aquí tiene, calentitas.'], ['sfx', 'pop'], ['bg', 'C', 'door', 85], ['wait', 800],
        ['E', '¡Buenos días! ¿Qué le pongo?', { to: 'V' }], ['go', 'V', 'front', 85], ['V', 'Buenos días. Quiero {t[0]}, por favor.'],
        ['E', 'Excelente elección. Ahora mismo se la preparo.'], ['go', 'E', 'shelf', 100], ['hold', 'E', '{t[1]}'], ['sfx', 'vasos'], ['go', 'E', 'behind', 100],
        ['E', 'Se la envuelvo para regalo. ¿Quiere una tarjeta con dedicatoria?'], ['V', 'Sí, que ponga: felicidades, ¡a disfrutar!'], ['sfx', 'click'], ['wait', 600],
        ['E', 'Son {pr} euros.'], ['V', 'Pago con tarjeta.'], ['sfx', 'click'], ['sfx', 'coin'], ['hold', 'E', null], ['hold', 'V', '{t[1]}'],
        ['E', 'Aquí tiene. ¡Que aproveche y vuelva pronto!'], ['V', 'Seguro que sí. ¡Está todo buenísimo! Gracias.']]
    }
  };
  // Qué edificio es cada casa (por el nombre del archivo de la imagen)
  function kindOfBuilding(p) {
    let h = ''; try { h = typeof houseFor === 'function' ? houseFor(p.id, p.house) : (p.house || ''); } catch (e) { h = p.house || ''; }
    const k = String(h).split('/').pop().replace(/\.[a-z]+$/i, '').toLowerCase();
    if (/^farmacia/.test(k)) return 'farmacia';
    if (/^(supermercado|super|tienda|mercado)/.test(k)) return 'supermercado';
    if (/^gasolinera/.test(k)) return 'gasolinera';
    if (/^(policia|comisaria)/.test(k)) return 'policia';
    if (/^(colegio|escuela|instituto)/.test(k)) return 'colegio';
    if (/^(restaurante|cafe|cafeteria|bar|pizzeria)/.test(k)) return 'restaurante';
    if (/^(estadio|parque-futbol|campo|futbol)/.test(k)) return 'futbol';
    if (/^hotel/.test(k)) return 'hotel';
    if (/^(hospital|clinica)/.test(k)) return 'hospital';
    if (/^cine/.test(k)) return 'cine';
    if (/^(pasteleria|panaderia)/.test(k)) return 'pasteleria';
    return null;
  }

  // ---------- Entrar ----------
  async function startVisit(p, kind) {
    if (running || !p || !p.owner || !SCN[kind]) return;
    unlockSpeech(); running = {};
    let info = { free: true }, entradaN = 0;
    if (!p.mine && p.giftable) {   // con regalo: mismas reglas que las casas (límite de entradas al día y 1 crédito por edificio y día)
      if (typeof authToken !== 'undefined' && authToken) {
        try { info = await api('/api/visit/start', { method: 'POST', body: { id: p.id } }); } catch (e) { info = { error: e.message }; }
        if (info && info.entryLimit) { setLocalEntries(ENTRIES_MAX); running = null; toast(`Hoy ya has entrado ${ENTRIES_MAX} veces. ¡Vuelve mañana!`); return; }
        if (info && !info.error && !info.unlimited && info.entries != null) setLocalEntries(Number(info.entries) || 0);
      } else info = { error: 'sin cuenta' };
      if (info.error) {
        if (localEntries() >= ENTRIES_MAX) { running = null; toast(`Hoy ya has entrado ${ENTRIES_MAX} veces. ¡Vuelve mañana!`); return; }
        setLocalEntries(localEntries() + 1);
      }
      entradaN = info.unlimited ? 0 : info.error ? localEntries() : (Number(info.entries) || localEntries());
    }
    runScene(p, SCN[kind], info, entradaN);
  }

  function runScene(p, T, info, entradaN) {
    const token = {}; let dead = false; running = token;
    const sleep = ms => new Promise((res, rej) => { setTimeout(() => (dead ? rej(token) : res()), ms); });
    const root = document.createElement('div');
    root.id = 'edif'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', T.t + ' de ' + p.owner);
    root.innerHTML = `<div class="v-card">
      <div class="v-top"><span class="v-title"></span><button class="v-x" type="button" aria-label="Salir">×</button></div>
      <div class="v-wrap"><div class="v-room"><div class="v-floor"></div><div class="v-base"></div>
        <div class="e-door"></div><div class="e-sign"></div></div>
      <div class="v-bubble" aria-live="polite"></div>
      <div class="v-gift"><div><b>🎁</b><span class="v-gt"></span></div></div></div>
      <div class="v-sub"></div></div>`;
    root.querySelector('.v-title').textContent = T.ic + ' ' + T.t + ' de ' + p.owner;
    document.body.appendChild(root);
    const wrap = root.querySelector('.v-wrap'), room = root.querySelector('.v-room'), door = root.querySelector('.e-door');
    const bubble = root.querySelector('.v-bubble'), sub = root.querySelector('.v-sub'), gift = root.querySelector('.v-gift'), gt = root.querySelector('.v-gt');
    room.style.setProperty('--wall', T.wall); room.style.setProperty('--floor', T.floor); room.style.setProperty('--cnt', T.cnt); room.style.setProperty('--sc', T.sc);
    const sg = room.querySelector('.e-sign'); sg.textContent = T.sign; sg.style.left = T.sx + 'px';
    const add = (cls, css, txt) => { const d = document.createElement('div'); d.className = cls; d.style.cssText = css; if (txt != null) d.textContent = txt; room.appendChild(d); return d; };
    T.dec.forEach(d => {
      if (d[0] === 'sh') { const s = add('e-shelf', `left:${d[1]}px;bottom:${d[2]}px;width:${d[3]}px`); d[4].forEach(e => { const i = document.createElement('span'); i.textContent = e; s.appendChild(i); }); }
      else if (d[0] === 'cn') add('e-counter', `left:${d[1]}px;width:${d[2]}px`);
      else if (d[0] === 'tb') add('e-table', `left:${d[1]}px;width:${d[2]}px`);
      else add('e-it', `left:${d[2]}px;bottom:${d[3]}px;font-size:${d[4]}px;z-index:${d[5] || 3}`, d[1]);
    });
    let K = 1;
    const fit = () => { K = Math.min(1, wrap.clientWidth / W); room.style.transform = `scale(${K})`; room.style.setProperty('--ik', String(1 / K)); wrap.style.height = Math.round(H * K) + 'px'; };
    fit(); window.addEventListener('resize', fit);

    // ----- Personas -----
    const nm = shuffle(NAMES).slice(0, 3), v = T.v ? T.v() : {};
    const mk = (a, isMe) => { const ch = Object.assign({}, a, { x: 0, d: 0, dir: 1, seated: false, hold: null, q: Promise.resolve(), wt: 0 }); ch.el = buildFig(a, isMe); ch.flip = ch.el.querySelector('.v-flip'); ch.head = ch.el.querySelector('.head'); ch.holdEl = ch.el.querySelector('.hold'); room.appendChild(ch.el); return ch; };
    const staff = (n, uni) => { const a = look(n[0], n[1] === 'f', 'adult', Math.random); if (uni) { a.top = uni; a.dress = false; a.sleeve = '100%'; } return a; };
    const me = mk(Object.assign(look('Tú', Math.random() < 0.5, 'adult', Math.random), { pitch: 1, rate: 1.05 }), true);
    const A = { E: mk(Object.assign(staff(nm[0], T.uni), { name: nm[0][0] + ' · ' + (T.roles.E || '') })), D: mk(Object.assign(staff(nm[1], T.uniD || T.uni), { name: nm[1][0] + ' · ' + (T.roles.D || '') })), C: mk(Object.assign(look(nm[2][0], nm[2][1] === 'f', 'adult', Math.random), { name: nm[2][0] })), V: me };
    v.D = nm[1][0];
    Object.values(A).forEach(c => { c.el.style.opacity = '0'; });
    const SP = n => { const s = T.sp[n]; return { x: s[0], d: s[1] }; };
    const fill = t => String(t).replace(/\{(\w+)(?:\[(\d)\])?\}/g, (m, k, i) => { const x = v[k]; return x == null ? m : (i != null ? x[i] : x); });
    const feetBottom = d => 10 + d * 108, depthScale = d => 1 - d * 0.28;
    function place(ch, x, d, ms) {
      const s = depthScale(d), el = ch.el;
      el.style.transition = ms ? `left ${ms}ms linear, bottom ${ms}ms linear, transform ${ms}ms linear` : 'none';
      el.style.left = x + 'px'; el.style.bottom = feetBottom(d) + 'px'; el.style.transform = `scale(${s})`; el.style.setProperty('--s', String(s));
      el.style.zIndex = String(ch.seated ? 14 : 10 + Math.round((1 - d) * 30)); ch.x = x; ch.d = d;
    }
    function face(ch, dx) { if (Math.abs(dx) < 3) return; ch.dir = dx > 0 ? 1 : -1; ch.flip.style.transform = `scaleX(${ch.dir})`; }
    function walkTo(ch, sp, speed) {
      const run = async () => {
        const dist = Math.hypot(sp.x - ch.x, (sp.d - ch.d) * 108), ms = Math.max(350, dist / (speed || 90) * 1000), my = ++ch.wt;
        face(ch, sp.x - ch.x); ch.el.classList.add('walking'); place(ch, sp.x, sp.d, ms);
        await sleep(ms); if (ch.wt === my) ch.el.classList.remove('walking');
      };
      const pr = ch.q.then(run, run); ch.q = pr.catch(() => {}); return pr;
    }
    const setHold = (ch, e) => { ch.hold = e; ch.holdEl.textContent = e || ''; ch.el.classList.toggle('holding', !!e); };
    const gesto = (ch, cls, ms) => { ch.el.classList.add(cls); setTimeout(() => ch.el.classList.remove(cls), ms); };
    place(me, SP('door').x, 1, 0);

    // ----- Hablar: burbuja + voz -----
    let speaker = null, raf = 0, last = null;
    const updateBubble = () => {
      if (dead) return; raf = requestAnimationFrame(updateBubble);
      if (!speaker || !bubble.classList.contains('on')) return;
      const wr = wrap.getBoundingClientRect(), hr = speaker.head.getBoundingClientRect();
      const bw = bubble.offsetWidth, bh = bubble.offsetHeight, cx = hr.left + hr.width / 2 - wr.left;
      const x = Math.max(6, Math.min(wr.width - bw - 6, cx - bw / 2)); let y = hr.top - wr.top - bh - 12; if (y < 4) y = 4;
      bubble.style.left = x + 'px'; bubble.style.top = y + 'px'; bubble.style.setProperty('--tail', Math.max(14, Math.min(bw - 14, cx - x)) + 'px');
    };
    raf = requestAnimationFrame(updateBubble);
    async function speakAloud(text, ch) {
      const t = cleanTTS(text), est = Math.max(1500, 700 + t.length * 62);
      if (!t || !voiceAllowed()) { await sleep(est); return; }
      let finished; const ended = new Promise(res => { finished = res; });
      try {
        if (ss.speaking || ss.pending) { ss.cancel(); await sleep(90); }
        const u = new SpeechSynthesisUtterance(t), vo = pickVoice(ch);
        u.lang = vo ? vo.lang : 'es-ES'; if (vo) u.voice = vo;
        u.pitch = Math.max(0.1, Math.min(2, ch.pitch)); u.rate = Math.max(0.6, Math.min(1.5, ch.rate)); u.volume = 1;
        u.onend = u.onerror = () => finished(); if (ss.paused) ss.resume(); ss.speak(u);
      } catch (e) { await sleep(est); return; }
      await Promise.race([ended, sleep(est * 2.2 + 2500)]);
    }
    async function say(who, raw, o) {
      o = o || {}; const text = fill(Array.isArray(raw) ? pick(raw) : raw);
      speaker = who; bubble.replaceChildren(); const nb = document.createElement('b'); nb.textContent = who.name; bubble.append(nb, document.createTextNode(text));
      bubble.classList.toggle('big', !!o.big); bubble.classList.add('on'); who.el.classList.add('talk');
      const to = o.to ? A[o.to] : (last && last !== who ? last : null);
      if (to) { face(who, to.x - who.x); face(to, who.x - to.x); }
      last = who;
      try { await speakAloud(text, who); } finally { who.el.classList.remove('talk'); }
      bubble.classList.remove('on'); await sleep(o.gap == null ? 260 : o.gap);
    }

    const cleanup = () => {
      dead = true; cancelAnimationFrame(raf); root.remove(); if (running === token) running = null;
      document.removeEventListener('keydown', onKey); window.removeEventListener('resize', fit);
      try { if (hasTTS) ss.cancel(); } catch (e) {}
      try { if (window.houseMute) window.houseMute(false); } catch (e) {}   // vuelve el sonido de fuera
    };
    const onKey = e => { if (e.key === 'Escape') cleanup(); };
    document.addEventListener('keydown', onKey);
    root.querySelector('.v-x').onclick = cleanup;
    root.addEventListener('pointerdown', e => { if (e.target === root) cleanup(); });
    try { if (window.houseMute) window.houseMute(true); } catch (e) {}   // dentro del edificio no se oye nada de fuera

    // Un paso del guion
    const seatOf = {};
    async function step(s) {
      const k = s[0];
      if (A[k]) { await say(A[k], s[1], s[2]); return; }
      const ch = A[s[1]];
      if (k === 'go') await walkTo(ch, SP(s[2]), s[3]);
      else if (k === 'bg') { walkTo(ch, SP(s[2]), s[3]).then(() => { if (s[2] === 'door') ch.el.classList.add('e-gone'); }).catch(() => {}); }
      else if (k === 'put') { ch.el.style.opacity = '1'; const q = SP(s[2]); place(ch, q.x, q.d, 0); face(ch, -1); }
      else if (k === 'hold') setHold(ch, s[2] == null ? null : fill(s[2]));
      else if (k === 'sit') { const q = SP(s[2]); await walkTo(ch, q, 85); ch.seated = true; ch.el.classList.add('sit'); sound('silla'); face(ch, s[3] || 1); place(ch, q.x, q.d, 0); await sleep(650); }
      else if (k === 'stand') { ch.seated = false; ch.el.classList.remove('sit'); sound('silla'); place(ch, ch.x, ch.d, 500); await sleep(550); }
      else if (k === 'eat') gesto(ch, 'sip', 1900);
      else if (k === 'cheer') gesto(ch, 'cheer', 1900);
    }
    const run = async list => { for (const s of list) { const k = s[0]; if (k === 'sfx') sound(s[1]); else if (k === 'sub') sub.textContent = s[1]; else if (k === 'wait') await sleep(s[1]); else await step(s); } };

    // ----- Guion automático -----
    (async () => {
      try {
        const dlist = T.body(v); let n0 = 0;   // al principio se colocan las personas, antes de abrir la puerta
        while (n0 < dlist.length && (dlist[n0][0] === 'put' || dlist[n0][0] === 'hold')) await step(dlist[n0++]);
        const nEntrada = entradaN > 0 ? `Entrada ${Math.min(entradaN, ENTRIES_MAX)} de ${ENTRIES_MAX} de hoy · ` : '';
        sub.textContent = nEntrada + 'Llegas a la puerta…'; await sleep(650);
        // Primero se toca el timbre y se espera respuesta; después se abre la puerta.
        const bell = document.createElement('div'); bell.className = 'e-doorbell'; bell.textContent = '🔔';
        bell.style.cssText = 'position:absolute;left:92px;bottom:226px;font-size:18px;z-index:30;animation:v-pop .35s ease-out'; room.appendChild(bell);
        const wave = document.createElement('div'); wave.className = 'e-wave'; wave.style.cssText = 'left:87px;bottom:221px;'; wave.hidden = true; room.appendChild(wave);
        sub.textContent = nEntrada + 'Tocas el timbre…'; await sleep(450);
        bell.classList.add('ring'); wave.hidden = false; sound('timbre'); await sleep(1500);   // ding-dong
        bell.classList.remove('ring'); wave.remove();
        sub.textContent = nEntrada + 'Esperas a que te abran…'; await sleep(700);
        sub.textContent = nEntrada + 'Te abren la puerta…'; await sleep(350);
        door.classList.add('open'); sound('puerta'); await sleep(800); bell.remove();
        me.el.style.opacity = '1';
        await walkTo(me, SP('in'), 85); door.classList.remove('open'); sound('puerta');
        await run(dlist.slice(n0).map(x => (x[0] === 'sub' ? ['sub', nEntrada + x[1]] : x)));
        // salida
        sub.textContent = nEntrada + 'Te despides…'; setHold(me, null);
        await walkTo(me, { x: 118, d: 0.45 }, 95); door.classList.add('open'); sound('puerta'); if (T.bell) sound('adios'); await sleep(850);
        await walkTo(me, SP('door'), 90); me.el.style.opacity = '0'; await sleep(450); door.classList.remove('open'); sound('puerta'); await sleep(800);
        let msg = '', ok = false;
        if (info.free) msg = '¡Gracias por la visita!';
        else if (info.error) msg = 'Crea tu cuenta o inicia sesión para recibir 1 crédito en tus próximas visitas.';
        else {
          let r = null; try { r = await api('/api/visit/finish', { method: 'POST', body: { id: p.id } }); } catch (e) { r = null; }
          if (r && r.rewarded) { ok = true; msg = `¡Te regalan ${r.reward} ${r.reward === 1 ? 'crédito' : 'créditos'}!`; }
          else if (r && r.reason === 'already') msg = 'Hoy ya te regalaron un crédito en este edificio. ¡Vuelve mañana!';
          else if (r && r.reason === 'limit') msg = 'Hoy ya has recibido el máximo de créditos por visitas.';
          else msg = '¡Gracias por la visita!';
        }
        gt.textContent = msg; gift.classList.add('on');
        if (ok) { sound('coin'); sound('gift'); try { if (window.refreshCredits) refreshCredits(); } catch (e) {} }
        sub.textContent = 'Visita terminada'; await sleep(3600); cleanup();
      } catch (e) { if (e !== token) { console.error(e); cleanup(); } }
    })();
  }

  // ---------- Botón «ENTRAR» en el panel de un edificio ----------
  const houseBtn = document.getElementById('enter-house-btn');
  if (houseBtn) {
    const eb = document.createElement('button');
    eb.id = 'enter-building-btn'; eb.type = 'button'; eb.className = 'primary hidden'; eb.style.cssText = 'width:100%;padding:10px;margin:0 0 8px;font-weight:800';
    houseBtn.parentNode.insertBefore(eb, houseBtn.nextSibling);
    let cur = null, curKind = null;
    eb.onclick = () => startVisit(cur, curKind);
    const prev = window.visitaPanel;
    window.visitaPanel = p => {
      if (prev) prev(p);   // la de entrar en casa sigue igual (visita.js)
      cur = p || null; curKind = p && p.owner ? kindOfBuilding(p) : null;
      if (curKind) { houseBtn.classList.add('hidden'); eb.textContent = `🚪 ENTRAR EN ${SCN[curKind].t.toUpperCase()}`; }   // un edificio no es una casa: se cambia el botón
      eb.classList.toggle('hidden', !curKind);
    };
    window.edificioStart = startVisit;
  }
})();
