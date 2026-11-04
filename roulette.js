'use strict';
// Ruleta diaria gratis: premios en créditos, un giro al día, obligatorio iniciar sesión.
// El premio lo decide SIEMPRE el servidor (/api/roulette/spin); aquí solo se anima y suena.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), fmtNum().
(function () {
  const PRIZES = [0.10, 0.20, 0.50, 0.75, 1, 2, 5, 10];            // orden de los gajos (en sentido horario desde arriba)
  const COLORS = ['#e63946', '#f4a261', '#ffd43b', '#69db7c', '#2a9d8f', '#4dabf7', '#9b5de5', '#ff6fb5'];
  const TAU = Math.PI * 2, SEG = TAU / PRIZES.length;
  const $id = id => document.getElementById(id);
  const fmt = n => (typeof fmtNum === 'function' ? fmtNum(n) : String(n));
  const btn = $id('roulette-btn');
  if (!btn) return;

  // ---------- Ventana ----------
  const st = document.createElement('style');
  st.textContent = `
    #roulette .modal-card { text-align:center; }
    #rl-wrap { position:relative; width:min(78vw,300px); margin:10px auto 6px; }
    #rl-canvas { width:100%; aspect-ratio:1; display:block; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
    #rl-canvas.off { cursor:default; filter:grayscale(.55) brightness(.9); }
    #rl-pointer { position:absolute; left:50%; top:-6px; transform:translateX(-50%); width:0; height:0; z-index:2;
      border-left:13px solid transparent; border-right:13px solid transparent; border-top:26px solid #222; filter:drop-shadow(0 2px 2px rgba(0,0,0,.45)); }
    #rl-hint { font-weight:700; margin:4px 0; min-height:1.3em; }
    #rl-win { font-size:22px; font-weight:800; min-height:1.4em; margin:6px 0; }
    #rl-win.pop { animation:rlpop .5s ease-out; }
    @keyframes rlpop { 0% {transform:scale(.6);opacity:0} 60% {transform:scale(1.2)} 100% {transform:scale(1);opacity:1} }
    @media (prefers-reduced-motion: reduce) { #rl-win.pop { animation:none; } }`;
  document.head.appendChild(st);

  const box = document.createElement('div');
  box.id = 'roulette'; box.className = 'modal hidden';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'rl-title');
  box.innerHTML =
    '<div class="modal-card">' +
    '<button id="rl-close" class="close" type="button" aria-label="Cerrar">×</button>' +
    '<h2 id="rl-title">🎡 Ruleta diaria</h2>' +
    '<p class="muted" id="rl-info">Gratis una vez al día. ¡Toca la ruleta para girar!</p>' +
    '<div id="rl-wrap"><div id="rl-pointer"></div><canvas id="rl-canvas" width="600" height="600" role="button" tabindex="0" aria-label="Girar la ruleta"></canvas></div>' +
    '<p id="rl-hint"></p><p id="rl-win" aria-live="polite"></p>' +
    '<p class="muted" style="font-size:12px">Los premios de 1, 2, 5 y 10 créditos solo pueden salir una vez al mes.</p>' +
    '</div>';
  document.body.appendChild(box);
  const canvas = $id('rl-canvas'), ctx = canvas.getContext('2d');

  // ---------- Dibujo ----------
  let rot = 0, spinning = false, canSpin = false;
  function draw() {
    const W = canvas.width, c = W / 2, r = c - 8;
    ctx.clearRect(0, 0, W, W);
    ctx.save(); ctx.translate(c, c);
    ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.fillStyle = '#222'; ctx.fill();
    for (let i = 0; i < PRIZES.length; i++) {
      const a0 = rot + i * SEG - Math.PI / 2, a1 = a0 + SEG;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, a0, a1); ctx.closePath();
      ctx.fillStyle = COLORS[i]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
      ctx.save(); ctx.rotate(a0 + SEG / 2); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + (PRIZES[i] >= 1 ? 54 : 46) + 'px system-ui, sans-serif';
      ctx.fillStyle = (i === 2 || i === 3) ? '#222' : '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4;
      ctx.fillText(fmt(PRIZES[i]), r - 26, 0);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#222'; ctx.stroke();
    ctx.font = '800 34px system-ui, sans-serif'; ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(spinning ? '…' : 'GIRA', 0, 2);
    ctx.restore();
  }
  const idxAt = a => Math.floor((((-a) % TAU) + TAU) % TAU / SEG);   // gajo bajo la flecha

  // ---------- Sonido (Web Audio, sin archivos) ----------
  let ac = null;
  const soundOn = () => { const b = $id('sound-btn'); return !(b && /🔇|🔈/.test(b.textContent)); };   // respeta el botón 🔊 del menú
  function audio() {
    if (!soundOn()) return null;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { return null; }
    return ac;
  }
  function tone(f, t0, dur, type, vol) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.15, a.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.02);
  }
  const tick = () => tone(900 + Math.random() * 120, 0, 0.045, 'square', 0.07);
  function winSound(big) {
    const notes = big ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, i * 0.11, 0.28, 'triangle', 0.18));
    if (big) tone(2093, 0.7, 0.6, 'sine', 0.12);
  }

  // ---------- Estado ----------
  const info = $id('rl-info'), hint = $id('rl-hint'), win = $id('rl-win');
  function render(msg) {
    canvas.classList.toggle('off', !canSpin || spinning);
    hint.textContent = msg != null ? msg : (spinning ? '' : canSpin ? '👆 Toca la ruleta para girar' : '');
    draw();
  }
  async function load() {
    win.textContent = '';
    if (!authToken) { canSpin = false; info.textContent = 'Entra con tu cuenta para girar la ruleta gratis cada día.'; return render('👤 Toca la ruleta para entrar'); }
    info.textContent = 'Cargando…';
    try {
      const j = await api('/api/roulette', { method: 'GET' });
      canSpin = !!j.canSpin;
      info.textContent = canSpin ? 'Tienes un giro gratis hoy. ¡Toca la ruleta!' : 'Hoy ya has girado. ¡Vuelve mañana!';
      render(canSpin ? null : '⏳ Vuelve mañana');
    } catch (e) { canSpin = false; info.textContent = e.message; render(''); }
  }

  // ---------- Giro ----------
  function animateTo(k, done) {
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    const target = -((k + 0.5) * SEG + jitter);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delta = (reduce ? 1 : 6) * TAU + ((((target - rot) % TAU) + TAU) % TAU);
    const t0 = performance.now(), dur = reduce ? 900 : 5200, r0 = rot;
    let last = idxAt(rot);
    (function frame(now) {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);   // frena poco a poco
      rot = r0 + delta * e;
      const i = idxAt(rot); if (i !== last) { last = i; tick(); }
      draw();
      if (p < 1) requestAnimationFrame(frame); else done();
    })(t0);
  }
  async function spin() {
    if (spinning) return;
    if (!authToken) { box.classList.add('hidden'); openLogin('Entra para girar la ruleta diaria 🎡'); return; }
    if (!canSpin) return;
    audio();                                    // el toque desbloquea el audio del navegador
    spinning = true; win.textContent = ''; render('🎡 …');
    let j;
    try { j = await api('/api/roulette/spin', { method: 'POST', body: {} }); }
    catch (e) { spinning = false; render(e.message); load(); return; }
    const k = PRIZES.findIndex(p => Math.abs(p - j.prize) < 1e-9);
    animateTo(k < 0 ? 0 : k, () => {
      spinning = false; canSpin = false;
      credits = j.credits; updateCreditUi();
      const big = j.prize >= 1;
      winSound(big);
      win.textContent = `${big ? '🏆' : '🎉'} +${fmt(j.prize)} ${j.prize === 1 ? 'crédito' : 'créditos'}`;
      win.className = ''; void win.offsetWidth; win.className = 'pop';
      info.textContent = 'Hoy ya has girado. ¡Vuelve mañana!' + (j.carry > 0 ? ` Llevas ${fmt(j.carry)} de 1 para tu próximo crédito entero.` : '');
      render('⏳ Vuelve mañana');
    });
  }

  canvas.addEventListener('click', spin);
  canvas.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spin(); } });
  $id('rl-close').onclick = () => { if (!spinning) box.classList.add('hidden'); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !spinning && !box.classList.contains('hidden')) box.classList.add('hidden'); });
  btn.addEventListener('click', () => {
    if (!authToken) { openLogin('Entra para girar la ruleta diaria 🎡'); return; }
    box.classList.remove('hidden'); load();
  });
  draw();
})();
