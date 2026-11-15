'use strict';
// BINGO (botón 🎱 en Juegos). Sala compartida: el servidor baraja las bolas, evalúa y paga (ver bingo-server.js: /api/bingo y /api/bingo/buy).
// Aquí solo se dibuja: el bombo girando, la bola que cae, los cartones (se marcan solos y suben en la lista según los números que les faltan),
// tus créditos a la izquierda y, a la derecha, la bandera y el apodo de quien canta línea o bingo. Con sonido y voz.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), flagOf(), country, avatar.
(function () {
  const btn = document.getElementById('bingo-btn');
  if (!btn) return;
  const nf = n => Number(n).toLocaleString('es-ES');
  const word = n => (n === 1 ? 'crédito' : 'créditos');
  const flag = c => { try { return (typeof flagOf === 'function' && flagOf(c)) || ''; } catch (e) { return ''; } };

  const st = document.createElement('style');
  st.textContent = `
    #bingo .modal-card { max-height: min(96vh, 820px); overflow-y: auto; padding-left: 10px; padding-right: 10px; }
    #bingo h2 { margin: 0 0 6px; font-size: 18px; }
    #bingo .bn-top { display: grid; grid-template-columns: 76px 1fr 92px; gap: 6px; align-items: start; }
    #bingo .bn-side { background: var(--card, rgba(127,127,127,.12)); border-radius: 12px; padding: 6px 4px; text-align: center; font-size: 11px; min-height: 64px; }
    #bingo .bn-side b { display: block; font-size: 17px; line-height: 1.2; word-break: break-word; }
    #bingo .bn-side small { display: block; opacity: .75; font-size: 10px; line-height: 1.2; }
    #bingo .bn-win { margin-top: 6px; padding: 4px 2px; border-radius: 8px; background: rgba(255,200,0,.18); animation: bnpop .5s; }
    #bingo .bn-win.bingo { background: rgba(255,90,90,.2); }
    #bingo .bn-win .fl { font-size: 24px; display: block; line-height: 1.1; }
    #bingo .bn-win .nk { font-size: 11px; font-weight: 800; word-break: break-word; display: block; }
    @keyframes bnpop { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
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
    #bingo .bn-ball { position: absolute; top: 118px; width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 25px; font-weight: 900; color: #222; background: radial-gradient(circle at 35% 30%, #fff, #ffd43b 55%, #f08c00); box-shadow: 0 6px 10px rgba(0,0,0,.4), inset -3px -3px 6px rgba(0,0,0,.25); }
    #bingo .bn-ball.drop { animation: bndrop 1.1s cubic-bezier(.3,.7,.4,1); }
    @keyframes bndrop { 0% { transform: translateY(-84px) scale(.35); opacity: 0; } 25% { opacity: 1; } 70% { transform: translateY(8px) scale(1); } 85% { transform: translateY(-9px); } 100% { transform: translateY(0); } }
    #bingo .bn-cap { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font-size: 12px; font-weight: 700; }
    #bingo .bn-last { display: flex; gap: 5px; justify-content: center; margin: 2px 0 6px; min-height: 26px; }
    #bingo .bn-last i { width: 26px; height: 26px; border-radius: 50%; font-style: normal; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; color: #222; background: #ffe066; opacity: .85; }
    #bingo .bn-last i:first-child { opacity: 1; outline: 2px solid #f08c00; }
    #bingo .bn-board { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; margin: 0 0 8px; }
    #bingo .bn-board i { font-style: normal; font-size: 9px; text-align: center; padding: 2px 0; border-radius: 4px; background: rgba(127,127,127,.15); opacity: .65; }
    #bingo .bn-board i.on { background: #f08c00; color: #fff; opacity: 1; font-weight: 800; }
    #bingo .bn-buy { display: flex; gap: 6px; align-items: center; margin: 0 0 8px; flex-wrap: wrap; }
    #bingo .bn-buy button { padding: 8px 10px; font-weight: 800; }
    #bingo .bn-buy .n { min-width: 26px; text-align: center; font-weight: 800; }
    #bingo .bn-info { font-size: 12px; margin: 0 0 6px; line-height: 1.45; }
    #bingo .bn-cards { display: flex; flex-direction: column; gap: 8px; }
    #bingo .bn-card { border: 2px solid var(--line, #888); border-radius: 10px; padding: 4px; background: #fffdf0; color: #222; transition: border-color .3s; }
    #bingo .bn-card.near { border-color: #f08c00; }
    #bingo .bn-card.full { border-color: #e03131; background: #fff0f0; }
    #bingo .bn-card .hd { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; padding: 0 2px 3px; color: #555; }
    #bingo .bn-g { display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; }
    #bingo .bn-g span { aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; border-radius: 5px; background: #fff5c2; min-height: 24px; }
    #bingo .bn-g span.e { background: #e9e4c9; opacity: .55; }
    #bingo .bn-g span.hit { background: #e03131; color: #fff; }
    #bingo .bn-g span.lin { box-shadow: 0 0 0 2px #2f9e44 inset; }
    #bingo .bn-msg { font-size: 13px; min-height: 18px; margin: 8px 0 0; }
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
      '<div class="bn-top">' +
        '<div class="bn-side" id="bn-left"><small>Tus créditos</small><b id="bn-credits">0</b><small>🎟️</small></div>' +
        '<div class="bn-stage">' +
          '<div class="bn-drum"><div class="bn-spin" id="bn-spin"></div></div><div class="bn-crank"></div>' +
          '<div class="bn-chute"></div><div class="bn-ball" id="bn-ball" style="opacity:0">?</div>' +
          '<div class="bn-cap" id="bn-cap"></div>' +
        '</div>' +
        '<div class="bn-side" id="bn-right"><small>Premios</small><div id="bn-wins"></div></div>' +
      '</div>' +
      '<div class="bn-last" id="bn-last"></div>' +
      '<div class="bn-board" id="bn-board"></div>' +
      '<div id="bn-buy" class="bn-buy"></div>' +
      '<p id="bn-info" class="bn-info"></p>' +
      '<div id="bn-cards" class="bn-cards"></div>' +
      '<p id="bingo-msg" class="bn-msg" role="status"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const $ = id => modal.querySelector('#' + id);
  const elCredits = $('bn-credits'), elWins = $('bn-wins'), elBall = $('bn-ball'), elCap = $('bn-cap'), elLast = $('bn-last'),
    elBoard = $('bn-board'), elBuy = $('bn-buy'), elInfo = $('bn-info'), elCards = $('bn-cards'), msg = $('bingo-msg'), elSpin = $('bn-spin');
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
  for (let n = 1; n <= 90; n++) { const i = document.createElement('i'); i.textContent = n; i.dataset.n = n; elBoard.appendChild(i); }
  const boardCells = [...elBoard.children];

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
  const sndWin = big => { if (muted) return; const seq = big ? [523, 659, 784, 1047, 784, 1047, 1319] : [523, 659, 784, 1047]; seq.forEach((f, i) => tone(f, i * 0.13, 0.22, 'triangle', 0.2)); };
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

  // ---- Estado ----
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
      const g = document.createElement('div'); g.className = 'bn-g';
      c.grid.forEach((row, ri) => {
        const done = v.rowsDone[ri];
        row.forEach(n => {
          const s = document.createElement('span');
          if (n === 0) s.className = 'e';
          else { s.textContent = n; if (set.has(n)) s.className = 'hit' + (done ? ' lin' : ''); }
          g.appendChild(s);
        });
      });
      box.appendChild(g); frag.appendChild(box);
    });
    elCards.replaceChildren(frag);
  }
  function paintBoard() {
    const set = new Set((state && state.drawn) || []);
    boardCells.forEach(i => i.classList.toggle('on', set.has(Number(i.dataset.n))));
    const last = ((state && state.drawn) || []).slice(-5).reverse();
    elLast.replaceChildren(...last.map(n => { const i = document.createElement('i'); i.textContent = n; return i; }));
  }
  function paintWins() {
    const parts = [];
    const add = (w, label, cls) => {
      if (!w) return;
      const d = document.createElement('div'); d.className = 'bn-win ' + cls;
      const f = document.createElement('span'); f.className = 'fl'; f.textContent = flag(w.country) || w.avatar || '🌍';
      const n = document.createElement('span'); n.className = 'nk'; n.textContent = (w.avatar && flag(w.country) ? w.avatar + ' ' : '') + w.nick;
      const l = document.createElement('small'); l.textContent = `${label} · +${w.prize}`;
      d.append(f, n, l); parts.push(d);
    };
    add(state && state.line, '🎯 Línea', 'line'); add(state && state.bingo, '🏆 Bingo', 'bingo');
    if (!parts.length) { const s = document.createElement('small'); s.textContent = 'Aún nadie'; parts.push(s); }
    elWins.replaceChildren(...parts);
  }
  function fmtLeft(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return s + ' s'; }
  function paintBuy() {
    const s = state; if (!s) return;
    const owned = s.mine ? s.mine.length : 0;
    const canBuy = s.phase === 'idle' || s.phase === 'done' || (s.phase === 'buying');
    const left = s.maxCards - (s.phase === 'idle' || s.phase === 'done' ? 0 : owned);
    if (want > left) want = Math.max(1, left);
    const frag = document.createDocumentFragment();
    if (canBuy && left > 0) {
      const mk = (t, f) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.onclick = f; return b; };
      const n = document.createElement('span'); n.className = 'n'; n.textContent = want;
      const buy = mk(`Comprar ${want} ${want === 1 ? 'cartón' : 'cartones'} · ${nf(want * s.price)} ${word(want * s.price)}`, buyCards);
      buy.disabled = busy;
      frag.append(mk('−', () => { want = Math.max(1, want - 1); paintBuy(); }), n, mk('+', () => { want = Math.min(left, want + 1); paintBuy(); }), mk('Máx', () => { want = left; paintBuy(); }), buy);
    }
    elBuy.replaceChildren(frag);
  }
  function paintInfo() {
    const s = state; if (!s) return;
    const prize = `🎯 Línea ${nf(s.linePrize)} · 🏆 Bingo ${nf(s.bingoPrize)}`;
    const players = s.players || 0, pot = s.cardsTotal || 0;
    let t;
    if (s.phase === 'idle') t = `Sala libre. Compra tus cartones (${nf(s.price)} ${word(s.price)} cada uno, hasta ${s.maxCards}) y empieza la partida. Jugando solo, la línea paga hasta ${s.soloLine} y el bingo hasta ${s.soloBingo}; con más jugadores, 20 % y 80 % del bote.`;
    else if (s.phase === 'buying') t = `⏳ Empieza en ${fmtLeft(s.buyUntil - (Date.now() + offset))} · ${players} ${players === 1 ? 'jugador' : 'jugadores'}, ${pot} ${pot === 1 ? 'cartón' : 'cartones'} · ${prize}`;
    else if (s.phase === 'drawing') t = `🎱 Bola ${(s.drawn || []).length} de 90 · ${players} ${players === 1 ? 'jugador' : 'jugadores'}, ${pot} cartones · ${prize} · Cuando acabe podrás comprar para la siguiente.`;
    else t = `🏁 Partida terminada · ${prize}`;
    elInfo.textContent = t;
  }
  function paintCaption() {
    const s = state; if (!s) return;
    elCap.textContent = s.phase === 'idle' ? 'Sala libre' : s.phase === 'buying' ? 'Comprando cartones…' : s.phase === 'done' ? '¡Fin de la partida!' : '';
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
    if (s.round !== seenRound) { seenRound = s.round || 0; seen = drawn.length; announced = { line: 0, bingo: 0 }; if (!drawn.length) { elBall.style.opacity = '0'; } else { elBall.textContent = drawn[drawn.length - 1]; elBall.style.opacity = '1'; } if (s.line) announced.line = 1; if (s.bingo) announced.bingo = 1; }
    else if (drawn.length > seen) {
      const fresh = drawn.slice(seen); seen = drawn.length;
      if (fresh.length <= 2) dropBall(fresh[fresh.length - 1]);   // si te has perdido varias bolas, no las cantamos todas de golpe
      else { elBall.textContent = fresh[fresh.length - 1]; elBall.style.opacity = '1'; }
    }
    if (s.line && !announced.line) {
      announced.line = 1; sndWin(false);
      speak(`¡Línea! ${s.line.nick}`, 1);
      if (s.line.mine) say(`🎉 ¡Cantaste línea! Ganas ${s.line.prize} ${word(s.line.prize)}`);
    }
    if (s.bingo && !announced.bingo) {
      announced.bingo = 1; sndWin(true);
      speak(`¡Bingo! ${s.bingo.nick}`, 1);
      if (s.bingo.mine) say(`🏆 ¡BINGO! Ganas ${s.bingo.prize} ${word(s.bingo.prize)}`);
      else say(`🏆 Bingo de ${s.bingo.nick}. ¡Suerte en la próxima!`);
    }
    paintWins(); paintBoard(); paintCards(); paintBuy(); paintInfo(); paintCaption();
  }

  async function load() {
    try { apply(await api('/api/bingo')); }
    catch (e) { say(e.message || 'No se pudo cargar el bingo', true); }
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
    if (state && state.phase === 'buying') paintInfo();
    if (now - lastTick >= 1000) { lastTick = now; load(); }
  }
  function open() {
    if (!authToken) return openLogin('Entra con tu cuenta para jugar al bingo 🎱');
    modal.classList.remove('hidden'); say(''); seenRound = -1; lastTick = 0;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* nada */ }
    try { if (!muted) speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { /* desbloquea la voz en móviles */ }
    load(); clearInterval(timer); timer = setInterval(tick, 500);
  }
  function close() { modal.classList.add('hidden'); clearInterval(timer); timer = null; try { speechSynthesis.cancel(); } catch (e) { /* nada */ } }
  $('bingo-close').onclick = close;
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  btn.addEventListener('click', open);
})();
