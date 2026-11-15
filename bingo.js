'use strict';
// BINGO (botón 🎱 en Juegos). Sala compartida: el servidor baraja las bolas, evalúa y paga (ver bingo-server.js: /api/bingo y /api/bingo/buy).
// Aquí solo se dibuja: el bombo girando, la bola que cae, los cartones (se marcan solos y suben en la lista según los números que les faltan),
// el tubo blanco de arriba a la izquierda con las bolas rojas que van corriendo según salen, y a la derecha Bingo y Línea (con su premio y quien lo canta) y los jugadores.
// Cápsula negra con la cuenta atrás parpadeando hasta la próxima partida. Con sonido y voz; mientras está abierto se silencia la Tierra para oír las bolas cantadas.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), flagOf(), country, avatar.
(function () {
  const btn = document.getElementById('bingo-btn');
  if (!btn) return;
  const nf = n => Number(n).toLocaleString('es-ES');
  const dots = n => String(Math.max(0, Math.floor(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const word = n => (n === 1 ? 'crédito' : 'créditos');
  const flag = c => { try { return (typeof flagOf === 'function' && flagOf(c)) || ''; } catch (e) { return ''; } };

  const st = document.createElement('style');
  st.textContent = `
    #bingo .modal-card { max-height: min(96vh, 820px); overflow-y: auto; padding-left: 10px; padding-right: 10px; }
    #bingo h2 { margin: 0 0 6px; font-size: 18px; }
    #bingo .bn-credit { font-size: 12px; margin: 0 0 6px; opacity: .85; }
    #bingo .bn-top { display: grid; grid-template-columns: 48px 1fr 108px; gap: 6px; align-items: start; }
    #bingo .bn-tube { position: relative; width: 46px; height: 188px; box-sizing: border-box; border-radius: 23px; border: 2px solid #d5d9e0; background: linear-gradient(90deg, #dfe3ea 0%, #fff 30%, #fff 62%, #cfd5de 100%); overflow: hidden; box-shadow: 0 3px 8px rgba(0,0,0,.3), inset 0 0 8px rgba(0,0,0,.18); }
    #bingo .bn-tube b { position: absolute; left: 4px; top: 4px; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 900; color: #fff; background: radial-gradient(circle at 35% 30%, #ff9b9b, #e03131 55%, #a61e1e); box-shadow: 0 2px 4px rgba(0,0,0,.4), inset -2px -2px 4px rgba(0,0,0,.25); transition: transform .8s cubic-bezier(.3,.8,.4,1), opacity .6s; will-change: transform; }
    #bingo .bn-right { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    #bingo .bn-prz { background: var(--card, rgba(127,127,127,.12)); border-radius: 10px; padding: 5px 4px; text-align: center; min-width: 0; }
    #bingo .bn-prz .t { font-size: 12px; font-weight: 800; }
    #bingo .bn-prz .p { font-size: 15px; font-weight: 900; line-height: 1.25; }
    #bingo .bn-prz.bingo .p { color: #e03131; }
    #bingo .bn-prz.line .p { color: #2f9e44; }
    #bingo .bn-prz .w { font-size: 11px; font-weight: 700; min-height: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; animation: bnpop .5s; }
    #bingo .bn-prz.jp { background: #1b1b1b; color: #fff; }
    #bingo .bn-prz.jp .p { color: #ffd43b; font-size: 19px; }
    #bingo .bn-prz.jp small { display: block; font-size: 10px; line-height: 1.15; opacity: .85; }
    #bingo .bn-ply { background: var(--card, rgba(127,127,127,.12)); border-radius: 10px; padding: 5px 4px; text-align: center; font-size: 12px; }
    #bingo .bn-ply b { font-size: 16px; }
    @keyframes bnpop { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
    #bingo .bn-timerrow { display: flex; justify-content: center; margin: 4px 0 8px; }
    #bingo .bn-timer { background: #000; color: #fff; border-radius: 999px; padding: 7px 18px; font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: .3px; }
    #bingo .bn-timer.blink { animation: bnblink 1s ease-in-out infinite; }
    @keyframes bnblink { 0%, 100% { opacity: 1; } 50% { opacity: .2; } }
    #bn-banner { display: none; position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 100000; max-width: 92vw; min-width: 230px; box-sizing: border-box; padding: 18px 24px; border-radius: 18px; text-align: center; background: #d6001c; color: #ffe600; box-shadow: 0 10px 40px rgba(0,0,0,.6); pointer-events: none; }
    #bn-banner .b1 { font-size: 46px; font-weight: 900; letter-spacing: 2px; line-height: 1.1; }
    #bn-banner .b2 { font-size: 22px; font-weight: 800; margin-top: 8px; word-break: break-word; }
    #bn-banner .b4 { display: inline-block; font-size: 19px; font-weight: 900; margin-top: 10px; padding: 5px 12px; border-radius: 10px; background: #000; color: #ffe600; }
    #bn-banner .b3 { font-size: 15px; font-weight: 700; margin-top: 6px; }
    #bn-banner.show { animation: bnpop .5s; }
    #bingo .bn-h3 { font-size: 14px; margin: 6px 0 6px; }
    #bingo .bn-stage { position: relative; height: 188px; display: flex; justify-content: center; }
    #bingo .bn-drum { position: absolute; top: 0; width: 132px; height: 132px; border-radius: 50%; border: 5px solid #c9a227; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), rgba(180,200,255,.22) 60%, rgba(120,140,200,.35)); overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,.35), inset 0 0 18px rgba(255,255,255,.35); }
    #bingo .bn-spin { position: absolute; inset: 0; animation: bnspin 9s linear infinite; }
    #bingo.rolling .bn-spin { animation-duration: 1.6s; }
    #bingo .bn-spin i { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; font-style: normal; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; color: #222; box-shadow: inset -2px -2px 4px rgba(0,0,0,.3); }
    @keyframes bnspin { to { transform: rotate(360deg); } }
    #bingo .bn-crank { position: absolute; top: 56px; right: calc(50% - 86px); width: 26px; height: 8px; border-radius: 4px; background: #c9a227; transform-origin: 0 50%; animation: bncrank 9s linear infinite; }
    #bingo.rolling .bn-crank { animation-duration: 1.6s; }
    @keyframes bncrank { to { transform: rotate(360deg); } }
    #bingo .bn-chute { position: absolute; top: 120px; width: 34px; height: 18px; background: #8a6d12; border-radius: 0 0 10px 10px; }
    #bingo .bn-ball { position: absolute; top: 118px; width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 25px; font-weight: 900; color: #fff; background: radial-gradient(circle at 35% 30%, #ff9b9b, #e03131 55%, #a61e1e); box-shadow: 0 6px 10px rgba(0,0,0,.4), inset -3px -3px 6px rgba(0,0,0,.25); }
    #bingo .bn-ball.drop { animation: bndrop 1.1s cubic-bezier(.3,.7,.4,1); }
    @keyframes bndrop { 0% { transform: translateY(-84px) scale(.35); opacity: 0; } 25% { opacity: 1; } 70% { transform: translateY(8px) scale(1); } 85% { transform: translateY(-9px); } 100% { transform: translateY(0); } }
    #bingo .bn-cap { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font-size: 12px; font-weight: 700; }
    #bingo .bn-buy { display: flex; gap: 6px; align-items: center; margin: 0 0 8px; flex-wrap: wrap; }
    #bingo .bn-buy button { padding: 8px 10px; font-weight: 800; }
    #bingo .bn-buy button.go { background: #d6001c; color: #fff; border: 0; border-radius: 10px; animation: bnblink2 1s ease-in-out infinite; }
    #bingo .bn-buy button.go:disabled { animation: none; opacity: .6; }
    @keyframes bnblink2 { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
    #bingo .bn-big { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 6px 2px 8px; }
    #bingo .bn-big span { min-width: 68px; height: 68px; padding: 0 8px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-radius: 16px; border: 3px solid #555; background: #000; color: #fff; font-size: 42px; font-weight: 900; }   /* quedan 3 o menos: negro con letras blancas */
    #bingo .bn-hint { flex-basis: 100%; font-size: 11px; opacity: .8; }
    #bingo .bn-buy button.go.ok { background: #2f9e44; animation: none; }
    #bingo .bn-buy .n { min-width: 26px; text-align: center; font-weight: 800; }
    #bingo .bn-cards { display: flex; flex-direction: column; gap: 8px; }
    #bingo .bn-card { border: 2px solid var(--line, #888); border-radius: 10px; padding: 4px; background: #fffdf0; color: #222; transition: border-color .3s; }
    #bingo .bn-card.near { border-color: #f08c00; }
    #bingo .bn-card.full { border-color: #e03131; background: #fff0f0; box-shadow: 0 0 14px 3px rgba(224,49,49,.7); }
    #bingo .bn-card .hd { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; padding: 0 2px 3px; color: #555; }
    #bingo .bn-g { display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; }
    #bingo .bn-g span { aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; border-radius: 5px; background: #fff5c2; min-height: 24px; }
    #bingo .bn-g span.e { background: #e9e4c9; opacity: .55; }
    #bingo .bn-g span.hit { background: #e03131; color: #fff; }
    #bingo .bn-g span.lin { box-shadow: 0 0 0 2px #2f9e44 inset; }
    #bingo .bn-msg { font-size: 13px; min-height: 18px; margin: 0 0 4px; }
    #bingo .bn-msg.err { color: #e03131; }
    #bingo .bn-mute { position: absolute; top: 10px; right: 46px; background: none; border: 0; font-size: 20px; cursor: pointer; }
  `;
  document.head.appendChild(st);

  const modal = document.createElement('div');
  modal.id = 'bingo'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'bingo-title');
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button id="bingo-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<button id="bingo-mute" class="bn-mute" type="button" aria-label="Sonido y voz">🔊</button>' +
      '<h2 id="bingo-title">🎱 Bingo</h2>' +
      '<div class="bn-credit">🎟️ Tus créditos: <b id="bn-credits">0</b></div>' +
      '<div class="bn-top">' +
        '<div class="bn-tube" id="bn-tube" aria-label="Bolas que han salido"></div>' +
        '<div class="bn-stage">' +
          '<div class="bn-drum"><div class="bn-spin" id="bn-spin"></div></div><div class="bn-crank"></div>' +
          '<div class="bn-chute"></div><div class="bn-ball" id="bn-ball" style="opacity:0">?</div>' +
          '<div class="bn-cap" id="bn-cap"></div>' +
        '</div>' +
        '<div class="bn-right">' +
          '<div class="bn-prz bingo"><div class="t">🏆 Bingo</div><div class="p" id="bn-p-bingo">—</div><div class="w" id="bn-w-bingo"></div></div>' +
          '<div class="bn-prz line"><div class="t">🎯 Línea</div><div class="p" id="bn-p-line">—</div><div class="w" id="bn-w-line"></div></div>' +
          '<div class="bn-prz jp"><div class="t">💰 Bote</div><div class="p" id="bn-p-jp">1.000</div><small id="bn-jp-s"></small></div>' +
          '<div class="bn-ply">👥 <b id="bn-players">0</b> <span id="bn-ply-l">jugadores</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="bn-timerrow"><span id="bn-timer" class="bn-timer"></span></div>' +
      '<div id="bn-buy" class="bn-buy"></div>' +
      '<p id="bingo-msg" class="bn-msg" role="status"></p>' +
      '<h3 class="bn-h3" id="bn-cards-h">🎴 Cartones</h3>' +
      '<div id="bn-cards" class="bn-cards"></div>' +
    '</div>';
  document.body.appendChild(modal);
  const $ = id => modal.querySelector('#' + id);
  const elCredits = $('bn-credits'), elBall = $('bn-ball'), elCap = $('bn-cap'), elTube = $('bn-tube'), elTimer = $('bn-timer'),
    elBuy = $('bn-buy'), elCards = $('bn-cards'), elCardsH = $('bn-cards-h'), msg = $('bingo-msg'), elSpin = $('bn-spin'),
    elPBingo = $('bn-p-bingo'), elPLine = $('bn-p-line'), elWBingo = $('bn-w-bingo'), elWLine = $('bn-w-line'), elPlayers = $('bn-players'), elPlyL = $('bn-ply-l'), elJP = $('bn-p-jp'), elJPs = $('bn-jp-s');
  const say = (t, err) => { msg.textContent = t || ''; msg.className = 'bn-msg' + (err ? ' err' : ''); };

  // ---- Bombo: bolas de colores girando dentro ----
  const COLORS = ['#ff8787', '#ffd43b', '#69db7c', '#74c0fc', '#da77f2', '#ffa94d', '#63e6be', '#f783ac'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r = i % 2 ? 34 : 18;
    const b = document.createElement('i');
    b.style.left = (66 + Math.cos(a) * r) + 'px'; b.style.top = (66 + Math.sin(a) * r) + 'px';
    b.style.background = COLORS[i % COLORS.length]; b.textContent = String(1 + ((i * 7) % 90));
    elSpin.appendChild(b);
  }

  // ---- Sonido y voz ----
  let muted = false, actx = null, voice = null;
  try { muted = localStorage.getItem('bingoMute') === '1'; } catch (e) { /* nada */ }
  const muteBtn = $('bingo-mute');
  const paintMute = () => { muteBtn.textContent = muted ? '🔇' : '🔊'; };
  paintMute();
  muteBtn.onclick = () => { muted = !muted; paintMute(); try { localStorage.setItem('bingoMute', muted ? '1' : '0'); } catch (e) { /* nada */ } if (muted) { try { speechSynthesis.cancel(); } catch (e) { /* nada */ } } };
  function tone(f, t0, dur, type, vol) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + t0;
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* sin audio */ }
  }
  const sndBall = () => { if (muted) return; tone(660, 0, 0.1, 'triangle', 0.18); tone(440, 0.09, 0.14, 'triangle', 0.14); };
  const sndTick = () => { if (muted) return; tone(900, 0, 0.04, 'square', 0.04); };
  // Fanfarria de trompetas de fiesta (sierra desafinada + filtro, como un metal). big = bingo (unos 5 s); si no, línea (unos 3 s)
  function brass(f, t, d, vol) {
    const o1 = actx.createOscillator(), o2 = actx.createOscillator(), fl = actx.createBiquadFilter(), g = actx.createGain();
    o1.type = o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f; o1.detune.value = -7; o2.detune.value = 7;
    fl.type = 'lowpass'; fl.Q.value = 2; fl.frequency.setValueAtTime(900, t); fl.frequency.linearRampToValueAtTime(3200, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + Math.max(0.05, d - 0.1)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(actx.destination);
    o1.start(t); o2.start(t); o1.stop(t + d + 0.05); o2.stop(t + d + 0.05);
  }
  const sndWin = big => {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime + 0.05;
      const G4 = 392, C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
      const seq = [[G4, 0, .16], [G4, .2, .16], [G4, .4, .16], [C5, .6, .8], [E5, 1.5, .16], [E5, 1.7, .16], [E5, 1.9, .16], [G5, 2.1, .8]];
      if (big) seq.push([G4, 3.1, .2], [C5, 3.35, .2], [E5, 3.6, .2], [G5, 3.85, .2], [C6, 4.1, .95]);
      seq.forEach(([f, t, d]) => { brass(f, t0 + t, d, 0.11); brass(f * 1.5, t0 + t, d, 0.05); });   // la melodía y una quinta por encima
    } catch (e) { /* sin audio */ }
  };
  function pickVoice() {
    try {
      const vs = speechSynthesis.getVoices();
      voice = vs.find(v => /^es(-|_)ES/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
    } catch (e) { voice = null; }
  }
  try { pickVoice(); speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { /* sin voz */ }
  function speak(text, rate) {
    if (muted) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = (voice && voice.lang) || 'es-ES'; if (voice) u.voice = voice; u.rate = rate || 1; u.pitch = 1;
      speechSynthesis.speak(u);
    } catch (e) { /* sin voz */ }
  }
  const sayBall = n => {   // como en el bingo de verdad: «Número 23», y los de dos cifras también por separado («el dos, el tres»)
    if (n < 10) return `El ${n}`;
    const d = String(n).split('').join(', ');
    return `El ${n}. ${d}`;
  };

  // ---- Rótulo en medio de la pantalla: LÍNEA / BINGO y debajo quién la cantó (fondo rojo, letras amarillas, 5 s) ----
  const banner = document.createElement('div'); banner.id = 'bn-banner'; document.body.appendChild(banner);
  const BANNER_MS = 7000;   // lo que dura el rótulo de LÍNEA / BINGO
  let bannerT = null;
  function hideBanner() { clearTimeout(bannerT); bannerT = null; banner.style.display = 'none'; banner.classList.remove('show'); }
  function showBanner(title, w, then, extra, ms) {
    const list = w.winners && w.winners.length ? w.winners : [w];
    const b1 = document.createElement('div'); b1.className = 'b1'; b1.textContent = title;
    const b2 = document.createElement('div'); b2.className = 'b2';
    list.forEach((x, i) => { if (i) b2.appendChild(document.createElement('br')); b2.appendChild(document.createTextNode((flag(x.country) || x.avatar || '🌍') + ' ' + x.nick)); });
    const b3 = document.createElement('div'); b3.className = 'b3';
    b3.textContent = list.length > 1 ? `Se reparten el premio: +${nf(w.prize)} ${word(w.prize)} cada uno` : `+${nf(w.prize)} ${word(w.prize)}`;
    banner.replaceChildren(b1, b2, b3);
    if (extra) { const b4 = document.createElement('div'); b4.className = 'b4'; b4.textContent = extra; banner.appendChild(b4); }
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show'); banner.style.display = 'block';
    clearTimeout(bannerT);
    bannerT = setTimeout(() => { hideBanner(); if (then) then(); }, ms || BANNER_MS);
  }
  // ---- Confeti: dos cañones desde abajo y lluvia desde arriba ----
  let confettiStop = null;
  function stopConfetti() { if (confettiStop) { confettiStop(); confettiStop = null; } }
  function confetti(ms) {
    stopConfetti();
    const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:99999';
    const W = cv.width = window.innerWidth, H = cv.height = window.innerHeight;
    document.body.appendChild(cv);
    const g = cv.getContext('2d'), cols = ['#ff3b3b', '#ffe600', '#3bd16f', '#3b9eff', '#d946ef', '#ff9f1c', '#ffffff'];
    const ps = [];
    const add = (x, y, vx, vy) => ps.push({ x, y, vx, vy, w: 6 + Math.random() * 7, h: 4 + Math.random() * 6, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)] });
    for (let i = 0; i < 90; i++) { add(0, H, 4 + Math.random() * 9, -(12 + Math.random() * 14)); add(W, H, -(4 + Math.random() * 9), -(12 + Math.random() * 14)); }
    const t0 = performance.now(); let raf = 0, dead = false;
    const end = () => { dead = true; cancelAnimationFrame(raf); cv.remove(); };
    confettiStop = end;
    (function frame(now) {
      if (dead) return;
      const el = now - t0;
      if (el < ms) for (let i = 0; i < 4; i++) add(Math.random() * W, -10, (Math.random() - .5) * 3, 2 + Math.random() * 3);
      g.clearRect(0, 0, W, H);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.vy += .35; p.vx *= .99; p.vy *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y > H + 20) { ps.splice(i, 1); continue; }
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      }
      if (el > ms + 4000 || (el > ms && !ps.length)) { end(); confettiStop = null; return; }
      raf = requestAnimationFrame(frame);
    })(t0);
  }
  let voiceT = null;
  // Celebración: trompetas + confeti + (un poco después, para no pisarse con la música) la voz que dice quién ha cantado
  function celebrate(big, text) {
    sndWin(big); confetti(big ? 6500 : 5000);
    clearTimeout(voiceT); voiceT = setTimeout(() => speak(text, 1), 1600);
  }
  const names = w => ((w.winners && w.winners.length ? w.winners : [w]).map(x => x.nick)).join(' y ');

  // ---- Estado ----
  let earthWasMuted = null;   // null = no hemos tocado el sonido; false = lo silenciamos nosotros (y lo devolvemos al cerrar); true = ya estaba silenciado
  let state = null, timer = null, offset = 0, seen = 0, seenRound = 0, announced = { line: 0, bingo: 0 }, busy = false, want = 1, lastTick = 0;

  const rowDone = (row, set) => row.every(n => set.has(n));
  function cardView(c, set) {
    const rows = c.grid.map(r => r.filter(n => n > 0));
    const hits = rows.reduce((s, r) => s + r.filter(n => set.has(n)).length, 0);
    const rowsDone = rows.map(r => rowDone(r, set));
    return { rows, hits, missing: 15 - hits, rowsDone };
  }
  function paintCards() {
    if (!state || !state.mine) return;
    const set = new Set(state.drawn || []);
    elCardsH.textContent = `🎴 Cartones (${state.mine.length})`; elCardsH.style.display = state.mine.length ? '' : 'none';
    const list = state.mine.map(c => ({ c, v: cardView(c, set) }));
    list.sort((a, b) => a.v.missing - b.v.missing || a.c.id - b.c.id);   // los que más cerca están suben arriba
    const frag = document.createDocumentFragment();
    list.forEach(({ c, v }) => {
      const box = document.createElement('div');
      box.className = 'bn-card' + (v.missing === 0 ? ' full' : v.missing <= 3 ? ' near' : '');
      const hd = document.createElement('div'); hd.className = 'hd';
      const left = document.createElement('span'); left.textContent = `Cartón ${c.id % 100000}`;
      const right = document.createElement('span'); right.textContent = v.missing === 0 ? '¡BINGO!' : `Faltan ${v.missing}`;
      hd.append(left, right); box.appendChild(hd);
      if (v.missing >= 1 && v.missing <= 3) {
        // Faltan 3 o menos: el cartón desaparece y solo se ven, en grande, los números que faltan
        const big = document.createElement('div'); big.className = 'bn-big';
        c.grid.flat().filter(n => n > 0 && !set.has(n)).sort((a, b) => a - b).forEach(n => { const sp = document.createElement('span'); sp.textContent = n; big.appendChild(sp); });
        box.appendChild(big);
      } else {   // el cartón completo (también cuando se canta el bingo: vuelve a salir entero)
        const g = document.createElement('div'); g.className = 'bn-g';
        c.grid.forEach((row, ri) => {
          const done = v.rowsDone[ri];
          row.forEach(n => {
            const sp = document.createElement('span');
            if (n === 0) sp.className = 'e';
            else { sp.textContent = n; if (set.has(n)) sp.className = 'hit' + (done ? ' lin' : ''); }
            g.appendChild(sp);
          });
        });
        box.appendChild(g);
      }
      frag.appendChild(box);
    });
    elCards.replaceChildren(frag);
  }
  // ---- Tubo blanco: las bolas rojas entran por arriba y van rodando hacia abajo según salen (se ven las últimas 5) ----
  const TUBE_N = 5, STEP = 36, tubeBalls = new Map();
  let tubeSeen = -1;
  const tubePos = (idx) => `translateY(${idx * STEP}px) rotate(${idx * 360}deg)`;
  function paintTube() {
    const drawn = (state && state.drawn) || [];
    if (drawn.length < tubeSeen) { tubeBalls.forEach(el => el.remove()); tubeBalls.clear(); tubeSeen = 0; }   // partida nueva
    const anim = tubeSeen >= 0 && drawn.length - tubeSeen <= 2;   // si te has perdido varias, se colocan sin animar
    tubeSeen = drawn.length;
    const last = drawn.slice(-TUBE_N).reverse();   // la más reciente arriba
    tubeBalls.forEach((el, n) => {
      if (last.includes(n)) return;
      el.style.transform = tubePos(TUBE_N); el.style.opacity = '0';   // la más antigua sale rodando por el final del tubo
      tubeBalls.delete(n); setTimeout(() => el.remove(), 800);
    });
    last.forEach((n, idx) => {
      let el = tubeBalls.get(n);
      if (!el) {
        el = document.createElement('b'); el.textContent = n; tubeBalls.set(n, el);
        el.style.transition = 'none'; el.style.transform = tubePos(anim ? -1 : idx);
        elTube.appendChild(el); void el.offsetWidth; el.style.transition = '';
      }
      el.style.transform = tubePos(idx);
    });
  }
  function paintWins() {
    const s = state || {};
    const idle = s.phase === 'idle' || !s.phase || (s.phase === 'buying' && !s.cardsTotal);   // sin cartones aún: se enseña el tope
    const prize = (p, solo) => idle ? 'hasta ' + nf(solo || 0) : nf(p || 0) + ' ' + word(p || 0);
    elPBingo.textContent = prize(s.bingoPrize, s.soloBingo); elPLine.textContent = prize(s.linePrize, s.soloLine);
    const who = w => w ? (flag(w.country) || w.avatar || '🌍') + ' ' + w.nick + (w.winners && w.winners.length > 1 ? ` +${w.winners.length - 1}` : '') : '';
    elWBingo.textContent = who(s.bingo); elWLine.textContent = who(s.line);
    elWBingo.title = s.bingo ? names(s.bingo) : ''; elWLine.title = s.line ? names(s.line) : '';
    const JB = s.jackpotBalls || 48, nb = (s.drawn || []).length, passed = s.phase === 'drawing' && nb > JB && !s.jackpotPrize;
    elJP.textContent = dots(s.jackpot);
    elJPs.textContent = passed ? `ya pasó de ${JB} bolas` : `bingo en ${JB} bolas o menos`;
    elJPs.style.opacity = passed ? '.45' : '';
    const pl = Math.max(s.connected || 0, s.players || 0);   // jugadores reales con la sala abierta
    elPlayers.textContent = pl; elPlyL.textContent = pl === 1 ? 'jugador' : 'jugadores';
  }
  function fmtLeft(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function paintBuy() {
    const s = state; if (!s) return;
    const owned = s.mine ? s.mine.length : 0;
    const nextOnly = s.phase === 'drawing' || s.phase === 'done';   // con la partida ya empezada solo se puede reservar para la próxima
    const canBuy = s.phase === 'idle' || s.phase === 'buying' || nextOnly;
    const left = s.maxCards - (s.phase === 'buying' ? owned : 0);
    if (want > left) want = Math.max(1, left);
    const frag = document.createDocumentFragment();
    if (canBuy && left > 0) {
      const mk = (t, f) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = f; return b; };
      const setWant = v => { want = v; if (reserved) reserved = want; paintBuy(); };
      const n = document.createElement('span'); n.className = 'n'; n.textContent = want;
      const cost = `${want} ${want === 1 ? 'cartón' : 'cartones'} · ${nf(want * s.price)} ${word(want * s.price)}`;
      let buy;
      if (nextOnly) {
        buy = mk(reserved ? `✅ ${reserved} ${reserved === 1 ? 'cartón reservado' : 'cartones reservados'} · toca para cancelar` : `COMPRAR PARA LA PRÓXIMA PARTIDA · ${cost}`, () => { reserved = reserved ? 0 : want; paintBuy(); });
        buy.className = 'go' + (reserved ? ' ok' : '');
      } else { buy = mk(`Comprar ${cost}`, () => buyCards()); buy.className = 'go'; buy.disabled = busy; }
      frag.append(mk('−', () => setWant(Math.max(1, want - 1))), n, mk('+', () => setWant(Math.min(left, want + 1))), mk('Máx', () => setWant(left)), buy);
      if (nextOnly) { const h = document.createElement('div'); h.className = 'bn-hint'; h.textContent = 'Se compran solos cuando se abra la próxima partida (deja el bingo abierto).'; frag.append(h); }
    }
    elBuy.replaceChildren(frag);
  }
  // Cápsula negra con letras blancas: cuenta atrás (parpadeando) hasta que empieza la partida
  function paintTimer() {
    const s = state; if (!s) return;
    let t = '', blink = false;
    if (s.phase === 'buying') {
      const left = s.buyUntil - (Date.now() + offset);
      t = '⏳ Próxima partida en ' + fmtLeft(left); blink = true;
      if (left <= 4500 && left > 800 && startSpoken !== s.round) { startSpoken = s.round; speak('Comenzamos para bingo, suerte a todos.', 1); }   // justo antes de empezar
    }
    else if (s.phase === 'drawing') t = s.mine && s.mine.length ? '🎱 Partida en juego' : '👀 En juego · compra para la próxima';
    else if (s.phase === 'done') t = '🏁 Partida terminada';
    else t = '⏳ Próxima partida en ' + fmtLeft(s.buyMs || 60000);
    elTimer.textContent = t; elTimer.classList.toggle('blink', blink);
  }
  function paintCaption() {
    const s = state; if (!s) return;
    elCap.textContent = s.phase === 'idle' ? 'Sala libre' : s.phase === 'buying' ? 'Comprando cartones…' : s.phase === 'done' ? '¡Fin de la partida!' : `Bola ${(s.drawn || []).length} de 90`;
    modal.classList.toggle('rolling', s.phase === 'drawing' || s.phase === 'buying');
  }

  function dropBall(n) {
    elBall.textContent = n; elBall.style.opacity = '1';
    elBall.classList.remove('drop'); void elBall.offsetWidth; elBall.classList.add('drop');
    sndBall(); speak(sayBall(n), 0.95);
  }

  function apply(s) {
    state = s;
    offset = s.now - Date.now();
    if (typeof s.credits === 'number') { elCredits.textContent = nf(s.credits); try { if (credits !== s.credits) { credits = s.credits; updateCreditUi(); } } catch (e) { /* nada */ } }
    const drawn = s.drawn || [];
    if (s.round !== seenRound) { seenRound = s.round || 0; say(''); seen = drawn.length; announced = { line: 0, bingo: 0 }; if (!drawn.length) { elBall.style.opacity = '0'; } else { elBall.textContent = drawn[drawn.length - 1]; elBall.style.opacity = '1'; } if (s.line) announced.line = 1; if (s.bingo) announced.bingo = 1; }
    else if (drawn.length > seen) {
      const fresh = drawn.slice(seen); seen = drawn.length;
      if (fresh.length <= 2) dropBall(fresh[fresh.length - 1]);   // si te has perdido varias bolas, no las cantamos todas de golpe
      else { elBall.textContent = fresh[fresh.length - 1]; elBall.style.opacity = '1'; }
    }
    // Solo se canta UNA línea y UN bingo por partida (si coinciden varios jugadores se reparten el premio); si llegan a la vez, solo se canta el bingo.
    // Tras la línea el servidor para el juego unos segundos: rótulo 5 s y una voz dice «Continuamos para bingo» al quitarse.
    const newLine = s.line && !announced.line, newBingo = s.bingo && !announced.bingo;
    if (newLine) {
      announced.line = 1;
      if (s.line.mine) say(`🎉 ¡Cantaste línea! Ganas ${s.line.prize} ${word(s.line.prize)}`);
      if (!newBingo) {
        celebrate(false, `¡Línea! ${names(s.line)}`);
        showBanner('LÍNEA', s.line, () => { if (state && state.phase === 'drawing' && !state.bingo) speak('Continuamos para bingo', 1); });
      }
    }
    if (newBingo) {
      announced.bingo = 1;
      const jp = s.jackpotPrize || 0, many = s.bingo.winners && s.bingo.winners.length > 1;
      celebrate(true, `¡Bingo! ${names(s.bingo)}${jp ? '. ¡Y se lleva el bote acumulado!' : ''}`);
      showBanner('BINGO', s.bingo, null, jp ? `💰 ¡BOTE ACUMULADO! +${dots(jp)} ${word(jp)}${many ? ' cada uno' : ''}` : '', jp ? 10000 : 0);
      if (jp) confetti(10000);
      if (s.bingo.mine) say(`🏆 ¡BINGO! Ganas ${s.bingo.prize} ${word(s.bingo.prize)}${jp ? ` y el BOTE: ${dots(jp)}` : ''}`);
      else say(`🏆 Bingo de ${names(s.bingo)}. ¡Suerte en la próxima!`);
    }
    paintWins(); paintTube(); paintCards(); paintBuy(); paintTimer(); paintCaption();
    if (reserved > 0 && s.phase === 'buying' && !busy && (!s.mine || !s.mine.length)) { want = Math.min(reserved, s.maxCards); reserved = 0; buyCards(); }   // la reserva se compra sola al abrirse la próxima partida
  }

  let loadErr = false, reserved = 0, startSpoken = 0;   // reserved: cartones que se compran solos al abrirse la próxima partida
  async function load() {
    try { apply(await api('/api/bingo')); if (loadErr) { loadErr = false; say(''); } }
    catch (e) { loadErr = true; const m = String((e && e.message) || ''); say(/failed to fetch|network/i.test(m) ? 'Sin conexión, reintentando…' : (m || 'No se pudo cargar el bingo'), true); }
  }
  async function buyCards() {
    if (busy) return;
    busy = true; paintBuy(); say('');
    try {
      const j = await api('/api/bingo/buy', { method: 'POST', body: { count: want, country: (typeof country !== 'undefined' ? country : '') || '', avatar: (typeof avatar !== 'undefined' ? avatar : '') || '' } });
      apply(j); sndTick(); say(`✅ Tienes ${j.mine.length} ${j.mine.length === 1 ? 'cartón' : 'cartones'}. ¡Suerte!`);
    } catch (e) { say(e.message || 'No se pudo comprar', true); }
    busy = false; paintBuy();
  }

  function tick() {
    if (modal.classList.contains('hidden')) return;
    const now = Date.now();
    if (state && state.phase === 'buying') paintTimer();
    if (now - lastTick >= 1000) { lastTick = now; load(); }
  }
  function open() {
    if (!authToken) return openLogin('Entra con tu cuenta para jugar al bingo 🎱');
    modal.classList.remove('hidden'); say(''); seenRound = -1; lastTick = 0; tubeSeen = -1;
    if (earthWasMuted === null) { earthWasMuted = !!window.fightMuted; if (!earthWasMuted && window.fightMute) window.fightMute(true); }   // se calla la Tierra (música, ciudad, lluvia...) para oír las bolas cantadas
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* nada */ }
    try { if (!muted) speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { /* desbloquea la voz en móviles */ }
    load(); clearInterval(timer); timer = setInterval(tick, 500);
  }
  function close() {
    reserved = 0; hideBanner(); stopConfetti(); clearTimeout(voiceT); modal.classList.add('hidden'); clearInterval(timer); timer = null; try { speechSynthesis.cancel(); } catch (e) { /* nada */ }
    if (earthWasMuted === false && window.fightMute) window.fightMute(false);   // vuelve el sonido de la Tierra
    earthWasMuted = null;
  }
  $('bingo-close').onclick = close;
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  btn.addEventListener('click', open);
})();
