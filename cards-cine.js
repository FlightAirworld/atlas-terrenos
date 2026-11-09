'use strict';
// CARTAS 🃏 · escenas especiales (las usa cards.js):
//  - CardsCine.zoom(elementoCarta, rectOrigen): la carta se agranda con efecto 3D (se inclina con el dedo/ratón y brilla).
//  - CardsCine.courier({ packId, kind, getOffer, pick, info, on }): el cartero borracho llega en moto por una carretera con curvas, saca tres cartas
//    de su cartera, el jugador elige una (ELIGE CARTA), se abre con fuegos artificiales, se la guarda y el cartero arranca, se va... y se la pega.
// Todo con sonido (Web Audio, sin archivos) y voces (atlasVoice / speechSynthesis). No toca la base de datos: eso lo hace cards.js por la API.
(function () {
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = { out: t => 1 - Math.pow(1 - t, 3), inOut: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), in: t => t * t * t };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  // ------------------------------------------------------------------ CSS
  const st = document.createElement('style');
  st.textContent = `
    /* ===== zoom de carta ===== */
    #cc .hide { display: none !important; }
    #cz { position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center; background: rgba(5,8,16,.0); backdrop-filter: blur(0px); transition: background .35s, backdrop-filter .35s; touch-action: none; }
    #cz.on { background: rgba(5,8,16,.78); backdrop-filter: blur(6px); }
    #cz .czbox { perspective: 900px; }
    #cz .czcard { transform-style: preserve-3d; will-change: transform; transition: transform .55s cubic-bezier(.2,1.25,.35,1); position: relative; }
    #cz .czcard.live { transition: transform .08s linear; }
    #cz .czcard .card { margin: 0; width: 210px; box-shadow: 0 30px 70px rgba(0,0,0,.65); }
    #cz .czshine { position: absolute; inset: 0; border-radius: 14px; pointer-events: none; mix-blend-mode: soft-light; opacity: .0; transition: opacity .3s;
      background: radial-gradient(circle at var(--mx,50%) var(--my,30%), rgba(255,255,255,.95), rgba(255,255,255,0) 55%); }
    #cz.on .czshine { opacity: .85; }
    #cz .czhint { position: absolute; bottom: 5vh; left: 0; right: 0; text-align: center; color: #fff; font-size: 13px; opacity: 0; transition: opacity .6s .5s; text-shadow: 0 1px 4px #000; }
    #cz.on .czhint { opacity: .8; }
    #cz .czx { position: absolute; top: 12px; right: 14px; border: 0; background: rgba(255,255,255,.14); color: #fff; font-size: 24px; line-height: 1; width: 40px; height: 40px; border-radius: 50%; padding: 0; }
    .czhalo { position: absolute; left: 50%; top: 50%; width: 520px; height: 520px; margin: -260px 0 0 -260px; border-radius: 50%; pointer-events: none; opacity: 0; transition: opacity .6s;
      background: radial-gradient(circle, var(--hc, #fff) 0%, rgba(255,255,255,0) 62%); filter: blur(10px); }
    #cz.on .czhalo { opacity: .55; animation: czpulse 2.4s ease-in-out infinite; }
    @keyframes czpulse { 50% { transform: scale(1.12); opacity: .75; } }

    /* ===== escena del cartero ===== */
    #cc { position: fixed; inset: 0; z-index: 3100; background: #000; overflow: hidden; user-select: none; -webkit-user-select: none; touch-action: manipulation; font-family: inherit; }
    #cc canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    #cc #cc-fx { pointer-events: none; z-index: 6; }
    #cc .ccsk { position: absolute; top: max(10px, env(safe-area-inset-top)); right: 12px; z-index: 9; background: rgba(0,0,0,.45); color: #fff; border: 1px solid rgba(255,255,255,.35); border-radius: 18px; padding: 6px 14px; font-weight: 700; font-size: 13px; }
    #cc .ccbub { position: absolute; left: 50%; bottom: max(14px, env(safe-area-inset-bottom)); transform: translateX(-50%) scale(.9); max-width: min(92vw, 520px); z-index: 8; background: #fffbe8; color: #1b1b1b; border: 3px solid #1b1b1b;
      border-radius: 18px; padding: 10px 16px; font-weight: 800; font-size: clamp(14px, 3.8vw, 19px); text-align: center; opacity: 0; transition: opacity .2s, transform .2s; box-shadow: 0 6px 18px rgba(0,0,0,.5); pointer-events: none; }
    #cc .ccbub.on { opacity: 1; transform: translateX(-50%) scale(1); }
    #cc .cctitle { position: absolute; left: 0; right: 0; top: 4.5%; text-align: center; z-index: 7; font-weight: 900; letter-spacing: 3px; font-size: clamp(30px, 9.5vw, 64px); color: #fff200; opacity: 0; pointer-events: none;
      text-shadow: 0 0 8px #ff7a00, 0 0 22px #ff2d00, 0 4px 0 #a31d00, 0 0 40px rgba(255,200,0,.8); transform: scale(.4); transition: opacity .3s, transform .5s cubic-bezier(.2,1.6,.4,1); }
    #cc .cctitle.on { opacity: 1; transform: scale(1); animation: ccneon 1.1s ease-in-out infinite alternate; }
    @keyframes ccneon { from { filter: brightness(1); } to { filter: brightness(1.35) drop-shadow(0 0 12px #ffb300); } }
    #cc .ccflash { position: absolute; inset: 0; z-index: 10; background: #fff; opacity: 0; pointer-events: none; }
    #cc .cccard { position: absolute; width: 210px; height: 290px; z-index: 5; perspective: 900px; cursor: pointer; transition: transform .75s cubic-bezier(.2,1.25,.35,1), opacity .5s; will-change: transform; -webkit-tap-highlight-color: transparent; }
    #cc .cccard .ci { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .9s cubic-bezier(.3,1.3,.4,1); }
    #cc .cccard.flipped .ci { transform: rotateY(180deg); }
    #cc .cccard .face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 14px; }
    #cc .cccard .face.front { transform: rotateY(180deg); }
    #cc .cccard .face.front .card { margin: 0; width: 210px; height: 290px; box-sizing: border-box; }
    #cc .cccard .back { background: repeating-linear-gradient(45deg, rgba(255,255,255,.10) 0 8px, rgba(255,255,255,0) 8px 16px), linear-gradient(145deg, #1b2a6b, #5b2a9a 60%, #1b2a6b);
      border: 4px solid var(--e2); box-shadow: 0 0 18px var(--e2), 0 10px 28px rgba(0,0,0,.6); box-shadow: 0 10px 28px rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; font-size: 84px; overflow: hidden; }
    #cc .cccard .back::before { content: ''; position: absolute; inset: 10px; border: 2px dashed rgba(255,255,255,.7); border-radius: 9px; }
    #cc .cccard .back::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%); background-size: 250% 100%; animation: cshine 2.2s linear infinite; }
    #cc .cccard.bob { animation: ccbob 1.7s ease-in-out infinite; }
    @keyframes ccbob { 50% { margin-top: -9px; } }
    #cc .cccard.pickable:hover .back, #cc .cccard.pickable:active .back { filter: brightness(1.25); }
    #cc .cccard.rumble1 .ci { animation: ccrum 0.12s linear infinite; }
    #cc .cccard.rumble2 .ci { animation: ccrum2 0.07s linear infinite; }
    @keyframes ccrum { 0%,100% { transform: translate(0,0) rotate(0); } 25% { transform: translate(-4px,2px) rotate(-2deg); } 75% { transform: translate(4px,-2px) rotate(2deg); } }
    @keyframes ccrum2 { 0%,100% { transform: translate(0,0) rotate(0); } 25% { transform: translate(-9px,4px) rotate(-5deg); } 75% { transform: translate(9px,-4px) rotate(5deg); } }
    #cc .ccrays { position: absolute; left: 50%; top: 50%; width: 150vmax; height: 150vmax; margin: -75vmax 0 0 -75vmax; z-index: 3; pointer-events: none; opacity: 0; transition: opacity .8s;
      background: repeating-conic-gradient(from 0deg, var(--rc, #ffd84a) 0deg 7deg, rgba(255,255,255,0) 7deg 20deg); -webkit-mask: radial-gradient(circle, #000 0, rgba(0,0,0,.0) 52%); mask: radial-gradient(circle, #000 0, rgba(0,0,0,.0) 52%); animation: ccspin 14s linear infinite; }
    #cc .ccrays.on { opacity: .85; }
    @keyframes ccspin { to { transform: rotate(360deg); } }
    #cc .ccring { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%; border: 6px solid var(--rc, #fff); z-index: 4; pointer-events: none; opacity: .9; animation: ccring 1.1s ease-out forwards; }
    @keyframes ccring { to { transform: scale(26); opacity: 0; border-width: 1px; } }
    #cc .ccbanner { position: absolute; left: 0; right: 0; top: 4.5%; z-index: 7; text-align: center; pointer-events: none; opacity: 0; transform: scale(.3) rotate(-6deg); transition: opacity .3s, transform .6s cubic-bezier(.2,1.7,.4,1); }
    #cc .ccbanner.on { opacity: 1; transform: none; }
    #cc .ccbanner b { display: block; font-size: clamp(30px, 10vw, 66px); font-weight: 900; color: var(--bc, #fff); text-shadow: 0 0 10px var(--bc, #fff), 0 4px 0 rgba(0,0,0,.6), 0 0 34px var(--bc, #fff); letter-spacing: 2px; }
    #cc .ccbanner span { color: #fff; font-weight: 800; font-size: clamp(14px, 4vw, 20px); text-shadow: 0 2px 6px #000; }
    #cc .ccsave { position: absolute; left: 50%; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 66px); transform: translateX(-50%); z-index: 9; font-size: 20px; font-weight: 900; padding: 12px 26px; border-radius: 30px;
      border: 3px solid #fff; background: linear-gradient(#37d67a, #0b8f4d); color: #fff; box-shadow: 0 6px 20px rgba(0,0,0,.55); animation: ccbtn 1s ease-in-out infinite alternate; }
    @keyframes ccbtn { to { transform: translateX(-50%) scale(1.07); } }
    #cc .ccsave.hide { display: none; }
    @media (prefers-reduced-motion: reduce) { #cc .ccrays, #cc .cctitle.on, #cc .ccsave, #cz.on .czhalo { animation: none; } }
  `;
  document.head.appendChild(st);

  // ------------------------------------------------------------------ AUDIO (Web Audio, todo sintetizado)
  const A = { ctx: null, out: null };
  function ac() {
    try {
      if (!A.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; A.ctx = new C(); A.out = A.ctx.createGain(); A.out.gain.value = .9; A.out.connect(A.ctx.destination); }
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return A.ctx;
    } catch (e) { return null; }
  }
  const soundOk = () => !window.fightMuted && (!window.soundOn || window.soundOn('efectos'));
  const voiceOk = () => !(window.atlasVoice && window.atlasVoice.muted);
  function noiseBuf(c, dur) { const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function tone(type, f0, f1, t0, dur, vol, o) {   // un tono con barrido de frecuencia y envolvente
    const c = ac(); if (!c || !soundOk()) return;
    o = o || {}; const t = c.currentTime + (t0 || 0);
    const os = c.createOscillator(), g = c.createGain(); os.type = type; os.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) os.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n = os; if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; os.connect(f); n = f; }
    n.connect(g); g.connect(A.out); os.start(t); os.stop(t + dur + .05);
  }
  function noise(t0, dur, vol, o) {   // ruido filtrado (frenazos, golpes, chasquidos)
    const c = ac(); if (!c || !soundOk()) return;
    o = o || {}; const t = c.currentTime + (t0 || 0);
    const s = c.createBufferSource(); s.buffer = noiseBuf(c, dur + .05);
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur); f.Q.value = o.q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.out); s.start(t); s.stop(t + dur + .05);
  }
  const SND = {
    horn() { tone('square', 392, 392, 0, .22, .13, { lp: 1800 }); tone('square', 494, 494, 0, .22, .1, { lp: 1800 }); tone('square', 392, 392, .3, .35, .13, { lp: 1800 }); tone('square', 494, 494, .3, .35, .1, { lp: 1800 }); },
    screech() { noise(0, .9, .32, { f0: 3800, f1: 900, q: 6 }); noise(.05, .8, .18, { f0: 2400, f1: 600, q: 3 }); },
    hic() { tone('sine', 260, 720, 0, .09, .22); tone('sine', 720, 300, .08, .1, .2); noise(0, .05, .1, { f0: 800, q: .7 }); },
    bag() { noise(0, .18, .22, { f0: 1800, q: .8, type: 'highpass' }); noise(.2, .22, .2, { f0: 1500, q: .8, type: 'highpass' }); noise(.45, .15, .16, { f0: 2400, q: .8, type: 'highpass' }); },
    whoosh() { noise(0, .35, .25, { f0: 400, f1: 3200, q: 1.2 }); },
    deal(i) { noise(i || 0, .12, .3, { f0: 2500, f1: 7000, q: .9 }); tone('triangle', 520, 880, i || 0, .1, .1); },
    pickup() { tone('sine', 660, 990, 0, .12, .2); tone('sine', 990, 1320, .08, .16, .18); },
    drum(dur) { const c = ac(); if (!c) return; for (let i = 0, n = Math.floor(dur / .06); i < n; i++) { const k = i / n; noise(i * .06, .05, .06 + .22 * k, { f0: 220 + 500 * k, q: .7 }); } },
    boom() { tone('sine', 150, 28, 0, .8, .9, { a: .004 }); noise(0, .6, .5, { f0: 700, f1: 80, q: .6, type: 'lowpass' }); },
    sparkle(n) { for (let i = 0; i < (n || 8); i++) tone('sine', 1200 + Math.random() * 2400, 0, i * .06, .35, .08); },
    fanfare(r) {   // r = 0..4 (común, rara, épica, legendaria, oro)
      const notes = [[523, 659, 784], [523, 659, 784, 1047], [440, 554, 659, 880, 1109], [523, 659, 784, 1047, 1319, 1568], [523, 659, 784, 1047, 1319, 1568, 2093, 2637]][clamp(r, 0, 4)];
      notes.forEach((f, i) => { tone('triangle', f, 0, i * .11, .7, .16); tone('square', f / 2, 0, i * .11, .5, .05, { lp: 900 }); });
      if (r >= 3) { SND.sparkle(14); [0, .25, .5].forEach(t => { tone('sawtooth', 130, 0, t + .75, .8, .1, { lp: 700 }); }); }
    },
    pocket() { tone('sine', 880, 1760, 0, .14, .2); tone('sine', 1320, 2640, .1, .2, .16); noise(0, .16, .16, { f0: 900, f1: 3000, q: .8 }); },
    rev() { tone('sawtooth', 70, 420, 0, .9, .22, { lp: 900, a: .05 }); tone('sawtooth', 72, 430, 0, .9, .16, { lp: 900, a: .05 }); },
    crash() { noise(0, .5, .6, { f0: 900, f1: 120, q: .5, type: 'lowpass' }); tone('square', 220, 40, 0, .5, .35, { lp: 900 }); tone('sawtooth', 1500, 300, .02, .35, .12);
      [.35, .5, .62, .72].forEach((t, i) => tone('triangle', 900 - i * 110, 400, t, .12, .13)); },
    coins(n) { for (let i = 0; i < (n || 10); i++) { tone('square', 1760, 0, i * .07, .09, .06); tone('square', 2349, 0, i * .07 + .04, .12, .06); } }
  };
  function makeEngine() {   // motor de moto: sierra con "puf-puf" (LFO), freq y volumen se ajustan en cada fotograma
    const c = ac(); if (!c || !soundOk()) return { set() {}, stop() {} };
    const o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 520; g.gain.value = 0;
    lfo.frequency.value = 12; depth.gain.value = 0; lfo.connect(depth); depth.connect(g.gain);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(A.out); o1.start(); o2.start(); lfo.start();
    let dead = false;
    return {
      set(f, v) { if (dead) return; const t = c.currentTime; o1.frequency.setTargetAtTime(f, t, .05); o2.frequency.setTargetAtTime(f * .5, t, .05); lfo.frequency.setTargetAtTime(6 + f * .12, t, .05);
        lp.frequency.setTargetAtTime(280 + f * 5, t, .05); g.gain.setTargetAtTime(v * .55, t, .05); depth.gain.setTargetAtTime(v * .4, t, .05); },
      stop() { if (dead) return; dead = true; const t = c.currentTime; g.gain.setTargetAtTime(0, t, .08); depth.gain.setTargetAtTime(0, t, .05); setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch (e) {} }, 400); }
    };
  }
  const PROFILE = { k: 'human', pitch: .7, rate: .84, vi: .25, chirp: 0 };   // voz del cartero: grave, lenta, de «copas de más»
  function say(text) {   // voz + subtítulo (el subtítulo sale aunque el sonido esté apagado)
    try {
      if (!voiceOk()) return;
      if (window.atlasVoice && window.atlasVoice.speak) window.atlasVoice.speak(text, PROFILE, { force: true });
      else if (window.speechSynthesis && window.SpeechSynthesisUtterance) { const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '')); u.lang = 'es-ES'; u.pitch = PROFILE.pitch; u.rate = PROFILE.rate; speechSynthesis.cancel(); speechSynthesis.speak(u); }
    } catch (e) {}
  }

  // ------------------------------------------------------------------ ZOOM de carta
  let zoomOpen = false;
  function zoom(cardEl, fromRect, opt) {
    if (zoomOpen || !cardEl) return; zoomOpen = true; opt = opt || {};
    const ov = document.createElement('div'); ov.id = 'cz'; ov.className = 'cardsroot'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Carta ampliada');
    const halo = document.createElement('div'); halo.className = 'czhalo'; halo.style.setProperty('--hc', opt.glow || '#ffe27a');
    const box = document.createElement('div'); box.className = 'czbox';
    const cc = document.createElement('div'); cc.className = 'czcard';
    const el = cardEl.cloneNode(true); el.classList.remove('flip'); el.removeAttribute('id');
    const shine = document.createElement('div'); shine.className = 'czshine';
    cc.append(el, shine); box.appendChild(cc);
    const hint = document.createElement('div'); hint.className = 'czhint'; hint.textContent = 'Mueve el dedo sobre la carta · toca fuera para cerrar';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'czx'; x.textContent = '×'; x.setAttribute('aria-label', 'Cerrar');
    ov.append(halo, box, hint, x); document.body.appendChild(ov);
    const vw = window.innerWidth, vh = window.innerHeight;
    const S = Math.min(2.1, vw * .84 / 210, vh * .78 / 290);   // cuánto se agranda
    const place = (sc, tx, ty, rx, ry, rz) => { cc.style.transform = `translate(${tx}px,${ty}px) scale(${sc}) rotateX(${rx || 0}deg) rotateY(${ry || 0}deg) rotateZ(${rz || 0}deg)`; };
    // sale desde donde estaba la carta pequeña (si se sabe) y llega al centro con un pequeño giro
    const cr = el.getBoundingClientRect ? { w: 210, h: 290 } : null;
    let sx = 0, sy = 0, s0 = .12;
    if (fromRect) { s0 = clamp(fromRect.width / 210, .08, .6); sx = fromRect.left + fromRect.width / 2 - vw / 2; sy = fromRect.top + fromRect.height / 2 - vh / 2; }
    cc.classList.remove('live'); cc.style.transition = 'none'; place(s0, sx, sy, 0, -90, -12); void cc.offsetWidth;
    requestAnimationFrame(() => { ov.classList.add('on'); cc.style.transition = ''; place(S, 0, 0, 0, 0, 0); try { SND.whoosh(); } catch (e) {} });
    const tilt = e => {
      const r = cc.getBoundingClientRect(); const px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
      cc.classList.add('live'); place(S * 1.03, 0, 0, (.5 - py) * 26, (px - .5) * 30, 0); cc.style.setProperty('--mx', (px * 100) + '%'); cc.style.setProperty('--my', (py * 100) + '%'); shine.style.setProperty('--mx', (px * 100) + '%'); shine.style.setProperty('--my', (py * 100) + '%');
    };
    ov.addEventListener('pointermove', tilt); ov.addEventListener('pointerdown', tilt);
    ov.addEventListener('pointerleave', () => { cc.classList.remove('live'); place(S, 0, 0, 0, 0, 0); });
    // sacudida suave al girar el móvil (si lo permite)
    let closing = false;
    const close = () => {
      if (closing) return; closing = true; document.removeEventListener('keydown', onKey);
      cc.classList.remove('live'); cc.style.transition = 'transform .35s cubic-bezier(.5,0,.8,.4)'; place(s0, sx, sy, 0, 70, 10); ov.classList.remove('on');
      setTimeout(() => { ov.remove(); zoomOpen = false; }, 380);
    };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (!cc.contains(e.target) || e.target === ov) close(); });
    x.onclick = close;
    if (opt.shareId && window.CardsShare) {   // 🔗 y 🖼️ dentro de la carta ampliada (cards-share.js)
      const row = document.createElement('div'); row.className = 'czshare';
      row.style.cssText = 'position:fixed;left:0;right:0;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:3;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:0 12px';
      const mk = t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'padding:10px 18px;border-radius:999px;border:0;font-weight:800;font-size:15px;background:#ffd166;color:#1b1b1b;box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer'; return b; };
      const id = opt.shareId, lk = mk('🔗 Enlace'), im = mk('🖼️ Imagen');
      lk.onclick = async e => { e.stopPropagation(); const m = await window.CardsShare.link(id); if (m) { lk.textContent = m.length > 22 ? '🔗 Copia el enlace' : m; setTimeout(() => { lk.textContent = '🔗 Enlace'; }, 2500); } };
      im.onclick = e => { e.stopPropagation(); close(); setTimeout(() => window.CardsShare.open(id), 150); };
      row.append(lk, im); ov.appendChild(row);
    }
  }

  // ------------------------------------------------------------------ CARTERO
  let running = false;
  function courier(cfg) {
    if (running) return Promise.resolve(null); running = true;
    return new Promise(resolve => {
      const root = document.createElement('div'); root.id = 'cc'; root.className = 'cardsroot'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'El cartero te trae una carta');
      root.innerHTML = '<canvas id="cc-scene"></canvas><div class="ccrays"></div><div class="cctitle">ELIGE CARTA</div><div class="ccbanner"><b></b><span></span></div><div class="ccbub"></div><canvas id="cc-fx"></canvas><div class="ccflash"></div>' +
        '<button type="button" class="ccsave hide">🎒 Guardármela</button><button type="button" class="ccsk">Saltar ⏭</button>';
      document.body.appendChild(root);
      const cv = root.querySelector('#cc-scene'), fx = root.querySelector('#cc-fx'), g = cv.getContext('2d'), fg = fx.getContext('2d');
      const titleEl = root.querySelector('.cctitle'), bub = root.querySelector('.ccbub'), banner = root.querySelector('.ccbanner'), rays = root.querySelector('.ccrays'), flash = root.querySelector('.ccflash');
      const saveBtn = root.querySelector('.ccsave'), skipBtn = root.querySelector('.ccsk');
      const kcol = ({ bronce: ['#b87333', '#e6a86a'], plata: ['#9aa5b1', '#e5e9ee'], oro: ['#d4a017', '#ffe27a'] })[cfg.kind] || ['#b87333', '#e6a86a'];
      let W = 0, H = 0, dpr = 1;
      function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight; [cv, fx].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }); g.setTransform(dpr, 0, 0, dpr, 0, 0); fg.setTransform(dpr, 0, 0, dpr, 0, 0); layout(); }
      window.addEventListener('resize', resize);

      // ---------- estado de la escena
      const S = { phase: 'approach', t0: performance.now(), t: 0, nb: 80, lat: 0, lean: 0, xs: 1, dip: 0, back: false, wheelie: 0, arm: 0, hold: 0, jerk: 0, nextHic: 1.2, said: {}, dead: false, shake: 0, dust: [],
        cam: 14, crash: null, offerP: null, offer: null, chosen: -1, result: null, fade: 0, handX: 0, handY: 0 };
      const P = []; // partículas del fx
      let engine = null, raf = 0, last = performance.now();
      const bubSay = (txt, ms) => { bub.textContent = txt; bub.classList.add('on'); clearTimeout(bubSay.t); bubSay.t = setTimeout(() => bub.classList.remove('on'), ms || 2600); };
      const talk = (key, txt, ms) => { if (S.said[key]) return; S.said[key] = 1; bubSay(txt, ms); say(txt); };
      const go = ph => { S.phase = ph; S.t0 = performance.now(); };
      const kill = out => { if (S.dead) return; S.dead = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); try { engine && engine.stop(); } catch (e) {} try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
        root.style.transition = 'opacity .45s'; root.style.opacity = '0'; setTimeout(() => { root.remove(); running = false; resolve(out || S.result); }, 460); };

      // ---------- carretera con curvas (pseudo-3D)
      const curveAt = w => clamp(Math.sin(w * .075) * 1.0 + Math.sin(w * .021 + 1.3) * .6 + Math.sin(w * .16 + .4) * .15, -1.6, 1.6);
      function segs() {   // devuelve por cada segmento n (0 = cerca … N = lejos): y, semiancho de la carretera, centro x
        const N = 130, hz = H * .4, out = []; let off = 0, dx = 0;
        for (let n = 0; n <= N; n++) { const s = 1 / (1 + n * .1); dx += curveAt(n + S.cam) * .13; off += dx; out.push({ n, s, y: hz + (H - hz) * s, hw: Math.max(W, H * .62) * .5 * s * 1.15, cx: W / 2 + off * s * 1.0 }); }
        return out;
      }
      const sceneState = { sg: null };
      const bikeSize = s => H * .40 * s;   // alto de moto+cartero (1 unidad = 1/100 de este alto)
      const nAt = nb => { const sg = sceneState.sg, i = clamp(nb, 0, sg.length - 2), a = sg[Math.floor(i)], b = sg[Math.floor(i) + 1], f = i - Math.floor(i); return { y: lerp(a.y, b.y, f), hw: lerp(a.hw, b.hw, f), cx: lerp(a.cx, b.cx, f), s: lerp(a.s, b.s, f) }; };
      function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); c.fill(); }
      function rr(c, x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill(); }
      function drawRoad() {
        const hz = H * .4; const sg = sceneState.sg = segs();
        const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#173a7a'); sky.addColorStop(.55, '#5aa6e8'); sky.addColorStop(1, '#ffd9a0'); g.fillStyle = sky; g.fillRect(0, 0, W, hz + 2);
        g.fillStyle = 'rgba(255,240,190,.95)'; g.beginPath(); g.arc(W * .72, hz - H * .09, H * .06, 0, 7); g.fill(); g.fillStyle = 'rgba(255,240,190,.25)'; g.beginPath(); g.arc(W * .72, hz - H * .09, H * .1, 0, 7); g.fill();
        const sh = sg[40].cx - W / 2;   // las montañas se mueven un poco con la curva
        g.fillStyle = '#4b5d86'; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, hz - (Math.sin((x - sh * .3) * .011) * .5 + Math.sin((x - sh * .3) * .027 + 2) * .3 + .8) * H * .06); g.lineTo(W, hz); g.fill();
        g.fillStyle = '#2f6b49'; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W + 20; x += 16) g.lineTo(x, hz - (Math.sin((x - sh * .6) * .02 + 1) * .4 + Math.sin((x - sh * .6) * .05) * .2 + .6) * H * .028); g.lineTo(W, hz); g.fill();
        g.fillStyle = '#378f46'; g.fillRect(0, hz, W, H - hz);
        const L = sg[sg.length - 1]; g.fillStyle = '#52575f'; g.beginPath(); g.moveTo(L.cx - L.hw, L.y); g.lineTo(L.cx + L.hw, L.y); g.lineTo(L.cx, hz); g.fill();
        for (let n = sg.length - 2; n >= 0; n--) {   // de lejos a cerca
          const a = sg[n], b = sg[n + 1], band = (Math.floor((n + S.cam * 1) / 4) % 2) === 0;
          g.fillStyle = band ? '#3f9b4f' : '#378f46'; g.fillRect(0, b.y, W, a.y - b.y + 1);
          const quad = (c, k, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(a.cx - a.hw * k, a.y + 1); g.lineTo(a.cx + a.hw * k, a.y + 1); g.lineTo(b.cx + b.hw * k, b.y); g.lineTo(b.cx - b.hw * k, b.y); g.fill(); };
          quad(0, 1.12, band ? '#e8e8e8' : '#d63a2f');   // piano
          quad(0, 1, band ? '#585d66' : '#52575f');
          if ((Math.floor((n + S.cam) / 3) % 2) === 0) { g.fillStyle = '#f5f0c8'; g.beginPath(); g.moveTo(a.cx - a.hw * .02, a.y + 1); g.lineTo(a.cx + a.hw * .02, a.y + 1); g.lineTo(b.cx + b.hw * .02, b.y); g.lineTo(b.cx - b.hw * .02, b.y); g.fill(); }
          if (n % 7 === 3) {   // árboles y postes a los lados (emoji)
            const side = ((n / 7) | 0) % 2 ? 1 : -1, sz = Math.max(8, H * .26 * a.s), ex = a.cx + side * a.hw * (1.55 + (n % 5) * .1);
            g.font = `${sz}px serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000'; g.fillText(n % 3 ? '🌲' : '🌳', ex, a.y + sz * .15);
          }
        }
        // cartel de curva
        const n0 = nAt(14); g.font = `${Math.max(10, H * .13 * n0.s)}px serif`; g.textAlign = 'center'; g.fillText('⚠️', n0.cx + n0.hw * 1.3, n0.y - H * .01);
      }

      // ---------- la moto con el cartero (vista de frente o de espaldas)
      function drawBike(x, y, h, o) {
        const c = g, u = h / 100, back = !!o.back; c.save(); c.translate(x, y);
        c.fillStyle = 'rgba(0,0,0,.38)'; ell(c, 0, 0, 24 * u, 5 * u);
        c.scale(o.xs == null ? 1 : Math.max(.04, Math.abs(o.xs)), 1); c.rotate(o.lean || 0); if (o.wheelie) { c.translate(0, 0); c.rotate(0); }
        const dip = (o.dip || 0) * u;
        // rueda
        c.fillStyle = '#17171b'; rr(c, -5.5 * u, -34 * u, 11 * u, 34 * u, 5 * u); c.fillStyle = '#6b6f78'; rr(c, -1.6 * u, -30 * u, 3.2 * u, 26 * u, 1.5 * u);
        c.translate(0, dip);
        // horquilla y guardabarros
        c.fillStyle = '#a7adb4'; rr(c, -8 * u, -56 * u, 3.4 * u, 26 * u, 1.7 * u); rr(c, 4.6 * u, -56 * u, 3.4 * u, 26 * u, 1.7 * u);
        c.fillStyle = back ? '#a82118' : '#d62d20'; rr(c, -8 * u, -41 * u, 16 * u, 9 * u, 4 * u);
        // depósito / carenado
        c.fillStyle = '#c4281c'; rr(c, -17 * u, -70 * u, 34 * u, 24 * u, 11 * u); c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, -11 * u, -67 * u, 12 * u, 5 * u, 2.5 * u);
        c.fillStyle = '#ffd400'; rr(c, -17 * u, -56 * u, 34 * u, 4 * u, 2 * u);
        if (!back) { const gl = c.createRadialGradient(0, -60 * u, 0, 0, -60 * u, 14 * u); gl.addColorStop(0, 'rgba(255,255,200,1)'); gl.addColorStop(.3, 'rgba(255,240,130,.7)'); gl.addColorStop(1, 'rgba(255,240,130,0)'); c.fillStyle = gl; ell(c, 0, -60 * u, 14 * u, 14 * u); c.fillStyle = '#fff9c4'; ell(c, 0, -60 * u, 4.6 * u, 4.6 * u); }
        else { c.fillStyle = '#ff2a2a'; rr(c, -5 * u, -62 * u, 10 * u, 5 * u, 2 * u); const gl = c.createRadialGradient(0, -60 * u, 0, 0, -60 * u, 12 * u); gl.addColorStop(0, 'rgba(255,60,60,.8)'); gl.addColorStop(1, 'rgba(255,60,60,0)'); c.fillStyle = gl; ell(c, 0, -60 * u, 12 * u, 12 * u); }
        // manillar
        c.strokeStyle = '#1b1b1f'; c.lineWidth = 3 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(-27 * u, -80 * u); c.lineTo(27 * u, -80 * u); c.stroke();
        c.strokeStyle = '#8b9199'; c.lineWidth = 1.4 * u; c.beginPath(); c.moveTo(-26 * u, -80 * u); c.lineTo(-33 * u, -90 * u); c.moveTo(26 * u, -80 * u); c.lineTo(33 * u, -90 * u); c.stroke();
        // piernas
        c.fillStyle = '#233a6b'; rr(c, -22 * u, -70 * u, 8 * u, 28 * u, 4 * u); rr(c, 14 * u, -70 * u, 8 * u, 28 * u, 4 * u); c.fillStyle = '#2a2018'; rr(c, -23 * u, -45 * u, 9 * u, 6 * u, 3 * u); rr(c, 14 * u, -45 * u, 9 * u, 6 * u, 3 * u);
        // cartera (a un lado)
        const bx = back ? 0 : -33 * u, by = back ? -112 * u : -62 * u, bw = back ? 34 * u : 22 * u, bh = back ? 30 * u : 20 * u;
        if (!back) { c.strokeStyle = '#4a2c12'; c.lineWidth = 2.2 * u; c.beginPath(); c.moveTo(-16 * u, -110 * u); c.lineTo(bx + 4 * u, by); c.stroke(); }
        // torso
        const jerk = (o.jerk || 0) * u;
        c.fillStyle = '#1f55b0'; rr(c, -16 * u, -118 * u + jerk * .3, 32 * u, 46 * u, 13 * u); c.fillStyle = '#ffd400'; rr(c, -16 * u, -96 * u + jerk * .3, 32 * u, 4 * u, 2 * u);
        if (!back) { c.fillStyle = '#ffd400'; ell(c, -7 * u, -108 * u, 3.4 * u, 3.4 * u); c.fillStyle = '#1f55b0'; ell(c, -7 * u, -108 * u, 1.6 * u, 1.6 * u); }
        // bolsa de cartero
        c.fillStyle = '#7a4a22'; rr(c, bx - bw / 2 + (back ? 0 : 0), by - bh / 2, bw, bh, 4 * u); c.fillStyle = '#5c3513'; rr(c, bx - bw / 2, by - bh / 2, bw, bh * .42, 4 * u);
        c.fillStyle = '#d9a441'; ell(c, bx, by - bh * .05, 2.2 * u, 2.2 * u);
        if (o.bagOpen) { c.fillStyle = '#2b1807'; rr(c, bx - bw * .42, by - bh * .46, bw * .84, bh * .24, 3 * u); }
        if (back) { c.font = `${13 * u}px serif`; c.textAlign = 'center'; c.fillText('✉️', bx - 8 * u, by - bh * .6); c.fillText('✉️', bx + 9 * u, by - bh * .55); }
        // brazos
        c.strokeStyle = '#1f55b0'; c.lineWidth = 8 * u; c.lineCap = 'round';
        const sh = [[-14 * u, -108 * u + jerk * .3], [14 * u, -108 * u + jerk * .3]], grip = [[-27 * u, -80 * u], [27 * u, -80 * u]];
        let lh = grip[0].slice(), rh = grip[1];
        if (!back && o.arm > 0) {   // brazo izquierdo (de la pantalla): rebusca en la cartera y luego saca las cartas
          const a = o.arm, jit = Math.sin(a * 40) * 2.2 * u;
          if (a < 1) { lh = [lerp(grip[0][0], bx + 2 * u, ease.inOut(a)) + jit, lerp(grip[0][1], by - bh * .2, ease.inOut(a)) + jit]; }
          else { const k = ease.out(clamp(a - 1, 0, 1)); lh = [lerp(bx + 2 * u, -34 * u, k), lerp(by - bh * .2, -122 * u, k)]; }
        }
        c.beginPath(); c.moveTo(sh[0][0], sh[0][1]); c.quadraticCurveTo(sh[0][0] - 12 * u, (sh[0][1] + lh[1]) / 2, lh[0], lh[1]); c.stroke();
        c.beginPath(); c.moveTo(sh[1][0], sh[1][1]); c.quadraticCurveTo(sh[1][0] + 12 * u, (sh[1][1] + rh[1]) / 2, rh[0], rh[1]); c.stroke();
        c.fillStyle = '#f2c196'; ell(c, lh[0], lh[1], 4.4 * u, 4.4 * u); ell(c, rh[0], rh[1], 4.4 * u, 4.4 * u);
        S.handX = x + lh[0] * (o.xs == null ? 1 : Math.abs(o.xs)); S.handY = y + lh[1] + dip;
        if (!back && o.arm >= 1.05) { for (let i = 0; i < 3; i++) { c.save(); c.translate(lh[0], lh[1] - 8 * u); c.rotate((i - 1) * .28); c.fillStyle = '#fff'; rr(c, -6 * u, -17 * u, 12 * u, 17 * u, 2 * u); c.fillStyle = kcol[0]; rr(c, -5 * u, -16 * u, 10 * u, 15 * u, 2 * u); c.restore(); } }
        // cabeza: 🥴 de frente / nuca de espaldas, con gorra de cartero
        c.save(); c.translate(0, -126 * u + jerk); c.rotate(Math.sin(S.t * 3.1) * .1 + (o.jerk ? .15 : 0));
        if (!back) { c.font = `${31 * u}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🥴', 0, 0); } else { c.fillStyle = '#f2c196'; ell(c, 0, 0, 12 * u, 13 * u); c.fillStyle = '#3b2412'; ell(c, 0, -3 * u, 12.5 * u, 10 * u); }
        c.fillStyle = '#ffd400'; c.beginPath(); c.moveTo(-14 * u, -6 * u); c.quadraticCurveTo(0, -26 * u, 14 * u, -6 * u); c.lineTo(15 * u, -3 * u); c.lineTo(-15 * u, -3 * u); c.closePath(); c.fill();
        c.fillStyle = '#1b3f8a'; rr(c, -14 * u, -6 * u, 28 * u, 4 * u, 2 * u); c.fillStyle = '#e02b20'; ell(c, 0, -14 * u, 3 * u, 3 * u);
        c.restore();
        c.restore();
      }

      // ---------- partículas (confeti, estrellas, monedas, chispas)
      function burst(x, y, n, cols, o) {
        o = o || {}; const coin = o.coin;
        for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(o.v0 || 2, o.v1 || 11) * (o.up ? 1 : 1); P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up ? 6 : 0), g: o.g == null ? .22 : o.g, life: rnd(60, 130), age: 0, r: rnd(3, 8), rot: rnd(0, 6), vr: rnd(-.3, .3), col: cols[(Math.random() * cols.length) | 0], kind: coin && Math.random() < .5 ? 'coin' : (Math.random() < .25 ? 'star' : 'rect') }); }
      }
      function rain(n, cols, coin) { for (let i = 0; i < n; i++) P.push({ x: rnd(0, W), y: rnd(-H * .3, -10), vx: rnd(-1.5, 1.5), vy: rnd(2, 6), g: .05, life: rnd(150, 260), age: 0, r: rnd(4, 9), rot: rnd(0, 6), vr: rnd(-.2, .2), col: cols[(Math.random() * cols.length) | 0], kind: coin && Math.random() < .55 ? 'coin' : 'rect' }); }
      function drawFx() {
        fg.clearRect(0, 0, W, H);
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i]; p.age++; if (p.age > p.life || p.y > H + 40) { P.splice(i, 1); continue; }
          p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vx *= .995;
          fg.globalAlpha = clamp(1 - (p.age - p.life * .7) / (p.life * .3), 0, 1); fg.save(); fg.translate(p.x, p.y); fg.rotate(p.rot);
          if (p.kind === 'coin') { fg.font = `${p.r * 3}px serif`; fg.textAlign = 'center'; fg.textBaseline = 'middle'; fg.fillText('🪙', 0, 0); }
          else if (p.kind === 'star') { fg.fillStyle = p.col; fg.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 1.2566 - 1.5708; fg.lineTo(Math.cos(a) * p.r * 1.6, Math.sin(a) * p.r * 1.6); fg.lineTo(Math.cos(a + .6283) * p.r * .7, Math.sin(a + .6283) * p.r * .7); } fg.closePath(); fg.fill(); }
          else { fg.fillStyle = p.col; fg.fillRect(-p.r, -p.r * .5, p.r * 2, p.r); }
          fg.restore();
        }
        fg.globalAlpha = 1;
      }

      // ---------- cartas en pantalla (DOM)
      const cardEls = [], rarityCols = ['#c8d0d8', '#6aa8ff', '#c08cff', '#ffc233', '#ffe27a'];
      let cs = .5, slots = [];
      function layout() {   // tamaño y sitio de las 3 cartas según la pantalla
        cs = Math.min(.82, (W * .94) / (3 * 210 + 2 * 24), (H * .30) / 290);
        const gap = Math.max(10, W * .02), cw = 210 * cs, total = 3 * cw + 2 * gap, y = H * .13 + 145 * cs;
        slots = [0, 1, 2].map(i => ({ x: W / 2 - total / 2 + cw / 2 + i * (cw + gap), y }));
        cardEls.forEach((el, i) => { if (el._state === 'row') place(el, slots[i].x, slots[i].y, 'translate(0,0) scale(' + cs + ')'); });
      }
      function place(el, cx, cy, tf) { el.style.left = (cx - 105) + 'px'; el.style.top = (cy - 145) + 'px'; el.style.transform = tf; }
      function buildCards() {
        S.offer.forEach((id, i) => {
          const el = document.createElement('div'); el.className = 'cccard'; el._state = 'row'; el._id = id; el._i = i;
          el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', 'Carta ' + (i + 1) + ' de ' + S.offer.length);
          el.style.setProperty('--e1', kcol[0]); el.style.setProperty('--e2', kcol[1]);
          el.innerHTML = '<div class="ci"><div class="face back">🃏</div><div class="face front"></div></div>';
          place(el, S.handX || W / 2, S.handY || H * .7, 'translate(0,0) scale(.06) rotate(' + rnd(-40, 40) + 'deg)'); el.style.opacity = '0'; el.style.transition = 'none';
          root.insertBefore(el, rays.nextSibling); cardEls.push(el);
        });
        layout();
        void root.offsetWidth;
        cardEls.forEach((el, i) => setTimeout(() => {
          el.style.transition = ''; el.style.opacity = '1'; place(el, slots[i].x, slots[i].y, 'translate(0,0) scale(' + cs + ') rotate(' + ((i - 1) * 4) + 'deg)'); SND.deal(); SND.whoosh();
          setTimeout(() => { el.classList.add('pickable'); el.style.transform = 'translate(0,0) scale(' + cs + ')'; el.style.animationDelay = (i * .25) + 's'; el.classList.add('bob'); }, 760);
        }, 160 + i * 230));
        setTimeout(() => { if (S.dead) return; titleEl.classList.add('on'); SND.horn(); talk('choose', 'Elige carta, ¡hic! Elige carta, anda.', 3000); go('offer'); }, 160 + S.offer.length * 230 + 700);
        cardEls.forEach(el => { const pick = () => choose(el); el.addEventListener('click', pick); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }); });
      }

      async function choose(el) {
        if (S.phase !== 'offer' || S.chosen >= 0) return; S.chosen = el._i; go('picked');
        titleEl.classList.remove('on'); skipBtn.classList.add('hide'); ac(); SND.pickup();
        say('¡Esa, esa! ¡Qué ojo tienes, hic!'); bubSay('¡Esa, esa! ¡Qué ojo tienes, hic!', 2200);
        cardEls.forEach(o => { if (o !== el) { o._state = 'gone'; o.classList.remove('bob', 'pickable'); o.style.transform = 'translate(' + rnd(-80, 80) + 'px,' + (H * .9) + 'px) scale(' + cs + ') rotate(' + rnd(-90, 90) + 'deg)'; o.style.opacity = '0'; } });
        el._state = 'big'; el.classList.remove('bob', 'pickable');
        const sc = Math.min(1.3, W * .78 / 210, H * .58 / 290), cx = W / 2, cy = H * .45;
        el.style.zIndex = 6; place(el, slots[el._i].x, slots[el._i].y, 'translate(' + (cx - slots[el._i].x) + 'px,' + (cy - slots[el._i].y) + 'px) scale(' + sc + ')');
        // el servidor reparte la carta mientras se mueve el sobre
        let res = null, err = null; const pickP = cfg.pick(el._id).then(r => { res = r; }, e => { err = e; });
        rays.style.setProperty('--rc', kcol[1]); rays.classList.add('on'); SND.drum(2.0); el.classList.add('rumble1');
        await sleep(1000); if (S.dead) return; el.classList.remove('rumble1'); el.classList.add('rumble2'); SND.whoosh();
        for (let i = 0; i < 6; i++) { setTimeout(() => { if (!S.dead) burst(cx, cy, 6, [kcol[1], '#fff', kcol[0]], { v0: 2, v1: 7, g: .05 }); }, i * 150); }
        await pickP; if (S.dead) return;
        await sleep(300); if (S.dead) return;
        if (err || !res) { el.classList.remove('rumble2'); bubSay(err ? err.message : 'Algo ha fallado con la carta', 3500); S.result = { error: err ? err.message : 'Error' }; await sleep(1800); kill(S.result); return; }
        S.result = res; const info = cfg.info(res.cardId, res.season), ri = info.rarityIdx;
        el.querySelector('.front').replaceChildren(cfg.cardEl(info));
        // ¡se abre!
        el.classList.remove('rumble2'); SND.boom(); setTimeout(() => SND.fanfare(ri), 120);
        flash.style.transition = 'none'; flash.style.opacity = ri >= 3 ? '1' : '.8'; void flash.offsetWidth; flash.style.transition = 'opacity .8s'; flash.style.opacity = '0';
        el.classList.add('flipped'); S.shake = ri >= 3 ? 26 : 14;
        const col = [info.c1, info.c2, '#fff'];
        rays.style.setProperty('--rc', info.c2);
        for (let k = 0; k < (ri >= 3 ? 3 : 1); k++) { const r = document.createElement('div'); r.className = 'ccring'; r.style.setProperty('--rc', info.c2); r.style.left = cx + 'px'; r.style.top = cy + 'px'; r.style.animationDelay = (k * .22) + 's'; root.appendChild(r); setTimeout(() => r.remove(), 1600 + k * 220); }
        burst(cx, cy, [70, 110, 160, 230, 320][ri], col, { v0: 3, v1: 15, g: .2, coin: ri >= 4 });
        if (ri >= 2) rain([0, 0, 60, 110, 170][ri], col, ri >= 3);
        if (ri >= 3) for (let k = 0; k < 7; k++) setTimeout(() => { if (!S.dead) { burst(rnd(W * .15, W * .85), rnd(H * .15, H * .5), 60, col, { v0: 2, v1: 9, g: .12 }); SND.sparkle(5); if (ri >= 4) SND.coins(5); } }, 300 + k * 330);
        banner.style.setProperty('--bc', info.c2); banner.querySelector('b').textContent = info.gold ? '👑 ¡DORADA! 👑' : '¡' + info.rarityName.toUpperCase() + '!'; banner.querySelector('span').textContent = info.name + ' · ⚡ ' + info.poder;
        banner.classList.add('on');
        const lines = ['Una cartita bien apañada.', '¡Ooooh! ¡Qué rara, hic!', '¡Épica! ¡Madre mía, hic!', '¡Legendaria! ¡Hic! ¡Me caigo de la moto!', '¡¡DORADA!! ¡Nunca había repartido una así, hic!'];
        setTimeout(() => { if (!S.dead) { bubSay(lines[ri], 3200); say(lines[ri]); } }, 650);
        go('revealed'); await sleep(1100); if (S.dead) return; saveBtn.classList.remove('hide');
      }

      async function keep() {   // "me la guardo": la carta vuela al bolsillo y el cartero se marcha
        if (S.phase !== 'revealed') return; go('keeping'); saveBtn.classList.add('hide'); banner.classList.remove('on'); rays.classList.remove('on');
        const el = cardEls[S.chosen]; SND.pocket(); say('¡Guardada!'); bubSay('¡Guardadita en el bolsillo! 🎒', 1800);
        el.style.transition = 'transform .8s cubic-bezier(.5,-0.3,.7,.6), opacity .8s'; place(el, el.offsetLeft + 105, el.offsetTop + 145, 'translate(' + (W * .42) + 'px,' + (H * .5) + 'px) scale(.05) rotate(540deg)'); el.style.opacity = '0';
        burst(W * .5, H * .45, 30, ['#fff', '#ffe27a'], { v0: 1, v1: 5, g: .02 });
        await sleep(950); if (S.dead) return; el.remove();
        skipBtn.classList.remove('hide'); skipBtn.textContent = 'Saltar ⏭';
        say('Bueno, me voy, que tengo más cartas. ¡Hasta luego, hic!'); bubSay('Bueno, me voy, que tengo más cartas. ¡Hasta luego, hic!', 3000);
        go('turn');
      }

      // ---------- bucle principal
      function tick(now) {
        if (S.dead) return; raf = requestAnimationFrame(tick);
        const dt = Math.min(.05, (now - last) / 1000); last = now; S.t = (now - S.t0) / 1000;
        const T = (now - S.t0) / 1000;
        const ph = S.phase; let bx = 0, by = 0, size = H * .5, o = { xs: 1 };
        // hipo del cartero (sonido + sacudida de cabeza)
        if (['approach', 'greet', 'bag', 'offer'].includes(ph) && T + (ph === 'approach' ? 0 : 99) > 0 && now / 1000 > S.nextHic) { S.nextHic = now / 1000 + rnd(1.5, 3); S.jerk = 6; SND.hic(); }
        S.jerk *= .86; if (S.jerk < .1) S.jerk = 0;
        let eng = [0, 0];
        if (ph === 'approach') {   // llega por la carretera, haciendo eses
          const u = clamp(T / 4.8, 0, 1); S.nb = 7 + 73 * Math.pow(1 - ease.out(u), 1.2) ; if (u > 0.999) go('brake');
          const amp = lerp(.35, .75, u); S.lat = Math.sin(T * 2.4) * amp + Math.sin(T * 5.3) * .18; const dl = Math.cos(T * 2.4) * amp * 2.4; S.lean = clamp(dl * .09, -.3, .3);
          if (T > .5) talk('cr', '¡Correo, correo! ¡Hic! ¡Apartaaa, que voy!', 3000);
          if (T > .4) { if (!S.said.horn) { S.said.horn = 1; SND.horn(); } }
          eng = [lerp(52, 105, u), lerp(.12, .5, u)];
        } else if (ph === 'brake') {
          const u = clamp(T / .8, 0, 1); S.nb = lerp(7, 5, ease.out(u)); S.lat = lerp(S.lat, 0, .08); S.lean = lerp(S.lean, 0, .1); S.dip = Math.sin(u * Math.PI) * 7; eng = [lerp(105, 48, u), .4];
          if (!S.said.scr) { S.said.scr = 1; SND.screech(); say('¡Uyuyuy! ¡Frena, frena!'); bubSay('¡Uyuyuy! ¡Frena, frena!', 1800); S.shake = 10; for (let i = 0; i < 14; i++) S.dust.push({ x: rnd(-1, 1), y: rnd(0, 1), vx: rnd(-1.4, 1.4), vy: rnd(-1.2, -.2), r: rnd(.6, 1.6), a: 1 }); }
          if (u >= 1) go('greet');
        } else if (ph === 'greet') {
          S.nb = 5; S.lat = Math.sin(T * 1.6) * .06; S.lean = Math.sin(T * 1.6) * .03; S.dip = 0; eng = [46, .16];
          if (T > .25) talk('hi', 'Buenas, ¡hic! Traigo un paquetito para usted.', 2800);
          if (T > 3.1) { go('bag'); }
        } else if (ph === 'bag') {
          S.nb = 5; S.lat = Math.sin(T * 1.6) * .05; S.lean = Math.sin(T * 1.6) * .03; eng = [46, .14];
          const a = clamp(T / 1.7, 0, 1) * 1; S.arm = T < 1.7 ? a : clamp(1 + (T - 1.7) / .7, 1, 2);
          if (T > .25) { talk('bag', 'A ver, a ver… ¿dónde lo he metido? ¡Aquí hay tres, hic!', 3300); if (!S.said.bagS) { S.said.bagS = 1; SND.bag(); } }
          if (T > 1.2 && !S.said.get) { S.said.get = 1; if (!S.offerP) S.offerP = cfg.getOffer(); S.offerP.then(r => { S.offer = r.offer; }, e => { S.offerErr = e; }); }
          if (T > 2.5 && !S.said.out) {
            if (S.offerErr) { S.said.out = 1; bubSay(S.offerErr.message || 'No se ha podido abrir el sobre', 3500); S.result = { error: S.offerErr.message }; setTimeout(() => kill(S.result), 2200); }
            else if (S.offer) { S.said.out = 1; SND.whoosh(); buildCards(); go('dealing'); }
          }
        } else if (ph === 'dealing' || ph === 'offer' || ph === 'picked' || ph === 'revealed' || ph === 'keeping') {
          S.nb = 5; S.lat = Math.sin(T * 1.3) * .03; S.lean = Math.sin(T * 1.3) * .02; S.arm = Math.max(S.arm - dt * .8, 1.05); eng = [44, .12];
          if (ph === 'picked' || ph === 'revealed' || ph === 'keeping') S.arm = lerp(S.arm, 0, .06);
        } else if (ph === 'turn') {   // da la vuelta con la moto
          const u = clamp(T / .9, 0, 1); S.nb = 5; S.arm = Math.max(0, S.arm - dt * 2); S.xs = Math.cos(u * Math.PI); S.back = u > .5; S.lean = Math.sin(u * Math.PI) * .2; eng = [lerp(46, 120, u), .3];
          if (!S.said.rev) { S.said.rev = 1; SND.rev(); }
          if (u >= 1) { S.xs = 1; S.back = true; go('leave'); }
        } else if (ph === 'leave') {   // arranca, hace eses y se la pega
          const u = clamp(T / 4.6, 0, 1), sp = Math.pow(u, 1.7); S.nb = 5 + sp * 52; S.wheelie = u < .25 ? Math.sin(u / .25 * Math.PI) * .22 : 0; S.dip = 0;
          const amp = lerp(.1, .85, u); S.lat = Math.sin(T * 3.1) * amp + Math.sin(T * 6.7) * .2 * u; S.lean = clamp(Math.cos(T * 3.1) * amp * .25, -.35, .35) - (u < .25 ? S.wheelie * .0 : 0);
          eng = [lerp(120, 200, u), lerp(.5, .12, u)];
          if (T > .1) talk('lv', '¡Yuhuuu! ¡Aquí no hay curvas… hic!', 2000);
          if (u > .6 && !S.said.ow) { S.said.ow = 1; const p = nAt(S.nb), s = p.s; S.crash = { x: p.cx + S.lat * p.hw, y: p.y, vx: -5, vy: -13, rot: 0, vr: -.3, s: Math.max(1.1, s * 5), t: 0 }; SND.crash(); S.shake = 24; burst(S.crash.x, S.crash.y, 50, ['#ffd400', '#fff', '#ff6a00', '#c4281c'], { v0: 2, v1: 12, g: .25 });
            say('¡Ayyy! ¡Mi moto, hic!'); bubSay('¡¡¡AAAYYYY!!! ¡Mi moto, hic!', 2600); go('crash'); }
          else if (u >= 1) { go('crash'); }
        } else if (ph === 'crash') {
          const c = S.crash; eng = [0, 0];
          if (c) { c.t += dt; c.vy += 32 * dt; c.x += c.vx * dt * 60 * .5; c.y += c.vy * dt * 60 * .5; c.rot += c.vr; if (c.y > H * .92 && c.vy > 0) { c.y = H * .92; c.vy *= -.45; c.vx *= .6; c.vr *= .6; if (Math.abs(c.vy) > 1.5 && !c._b) { SND.crash(); c._b = 1; } } }
          if (T > 2.6 && !S.said.end) { S.said.end = 1; kill(S.result); }
          if (!S.crash && T > .6 && !S.said.end) { S.said.end = 1; kill(S.result); }
        }
        // motor
        if (engine && ph !== 'crash') engine.set(eng[0] || 40, (eng[1] || 0) * (ph === 'approach' || ph === 'leave' ? clamp(1.1 - S.nb / 80, .1, 1) * 1.6 : 1)); else if (engine && ph === 'crash') engine.set(30, 0);
        if (!engine && ph === 'approach') engine = makeEngine();

        // ---- dibujo
        g.save(); if (S.shake > .3) { g.translate(rnd(-S.shake, S.shake) * .4, rnd(-S.shake, S.shake) * .4); S.shake *= .9; }
        drawRoad();
        if (ph !== 'crash' || (S.crash == null)) {
          if (!(ph === 'crash' && S.crash)) {
            const p = nAt(S.nb), s = p.s; size = bikeSize(s); bx = p.cx + S.lat * p.hw * .8; by = p.y;
            o = { xs: S.xs, lean: S.lean, dip: S.dip, back: S.back, arm: S.arm, bagOpen: S.arm > .1 && S.arm < 1.2, jerk: S.jerk };
            if (S.wheelie) { g.save(); g.translate(bx, by); g.rotate(-S.wheelie * (S.back ? 1 : 1)); g.translate(-bx, -by); drawBike(bx, by, size, o); g.restore(); } else drawBike(bx, by, size, o);
          }
        }
        if (S.crash) {   // se la pega: moto y cartero salen volando dando vueltas
          const c = S.crash, sz = H * .2 * c.s; g.save(); g.translate(c.x, c.y); g.rotate(c.rot); g.font = `${sz}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🏍️', 0, 0); g.restore();
          g.save(); g.translate(c.x + Math.sin(c.t * 5) * 30, c.y - sz * .5 - 10); g.rotate(-c.rot * .6); g.font = `${sz * .6}px serif`; g.textAlign = 'center'; g.fillText('🥴', 0, 0); g.restore();
          g.font = `${sz * .5}px serif`; g.textAlign = 'center'; for (let i = 0; i < 4; i++) { g.save(); g.translate(c.x + Math.cos(c.t * 4 + i * 1.6) * sz * .9, c.y - sz * .9 + Math.sin(c.t * 4 + i * 1.6) * sz * .25); g.fillText('⭐', 0, 0); g.restore(); }
          if (c.t < .8) { g.font = `${sz * 2.2 * (1 + c.t)}px serif`; g.globalAlpha = 1 - c.t / .8; g.fillText('💥', c.x, c.y); g.globalAlpha = 1; }
          for (let i = 0; i < 6; i++) { g.save(); g.translate(c.x + (i - 3) * c.t * 90, c.y - 80 + c.t * 40 * (i % 3) + Math.sin(c.t * 6 + i) * 30); g.rotate(c.t * 6 + i); g.font = `${sz * .45}px serif`; g.fillText('✉️', 0, 0); g.restore(); }
        }
        // polvo del frenazo
        S.dust.forEach(d => { d.x += d.vx * .01; d.y += d.vy * .01; d.a -= .012; d.r += .01; }); S.dust = S.dust.filter(d => d.a > 0);
        if (S.dust.length) { const p = nAt(5), sz = bikeSize(p.s); S.dust.forEach(d => { g.fillStyle = `rgba(220,205,170,${d.a * .55})`; g.beginPath(); g.arc(p.cx + d.x * sz * .5, p.y - d.y * sz * .15, d.r * sz * .12, 0, 7); g.fill(); }); }
        g.restore();
        // viñeta
        const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
        drawFx();
      }

      // ---------- botones
      skipBtn.onclick = () => {
        ac();
        if (['approach', 'brake', 'greet'].includes(S.phase)) { S.said.cr = S.said.hi = 1; try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} S.nb = 5; S.lat = 0; S.lean = 0; S.dip = 0; S.said.bag = 1; go('bag'); S.said.get = 0; }
        else if (S.phase === 'bag') { S.said.out = S.said.out || 0; S.arm = 2; }
        else if (['turn', 'leave', 'crash'].includes(S.phase)) { kill(S.result); }
        else if (S.phase === 'offer' || S.phase === 'dealing') { /* nada: hay que elegir */ }
      };
      saveBtn.onclick = keep;
      root.addEventListener('keydown', e => { if (e.key === 'Escape' && ['turn', 'leave', 'crash'].includes(S.phase)) kill(S.result); });
      root.tabIndex = -1;

      // ---------- arranque
      ac();   // el clic de comprar permite que suene
      cv.style.cursor = 'default';
      resize(); S.offerP = null;
      try { S.offerP = cfg.getOffer(); S.offerP.catch(() => {}); } catch (e) { S.offerErr = e; }   // pide ya las 3 cartas al servidor, mientras llega el cartero
      last = performance.now(); S.t0 = last; raf = requestAnimationFrame(tick);
      cfg.on && cfg.on('start');
    });
  }

  window.CardsCine = { zoom, courier, sfx: SND, ac };
})();
