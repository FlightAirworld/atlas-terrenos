'use strict';
// 💎 GEMAS (dentro de la carpeta 🎮 Juegos): 3 en raya con gemas que caen, niveles infinitos y tiempo por nivel.
// Jugar cuesta 1 crédito. Cada gema rota suma unas milésimas (variables) hasta un máximo de 5 créditos por partida.
// El motor es match3-core.js (el mismo que usa el servidor para repetir la partida y pagar). Aquí solo se dibuja y se juega.
(function () {
  const items = document.getElementById('games-items');
  if (!items || !window.Match3) return;
  const M = window.Match3, W = M.W, H = M.H;
  const fmt = milli => (milli / 1000).toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Botón en la carpeta Juegos ----
  const btn = document.createElement('button');
  btn.id = 'gemas-btn'; btn.type = 'button'; btn.setAttribute('data-label', 'Gemas'); btn.title = 'Gemas: junta 3 y ganan créditos'; btn.setAttribute('aria-label', 'Gemas: junta 3 y ganan créditos'); btn.textContent = '💎';
  items.appendChild(btn);

  // ---- Dibujo de las gemas (formas y colores como en la imagen) ----
  const SHAPES = [
    '<path d="M50 6C70 30 90 52 90 68a40 40 0 0 1-80 0C10 52 30 30 50 6Z"/>',                 // azul: gota
    '<polygon points="30,8 70,8 94,30 94,70 70,92 30,92 6,70 6,30"/>',                        // verde: octógono
    '<polygon points="34,8 66,8 94,90 6,90"/>',                                                // amarillo: trapecio
    '<polygon points="50,6 94,40 78,92 22,92 6,40"/>',                                         // rojo: pentágono
    '<polygon points="50,4 92,50 50,96 8,50"/>',                                               // morado: rombo
    '<polygon points="26,10 74,10 97,50 74,90 26,90 3,50"/>'                                   // naranja: hexágono
  ];
  const COLORS = [['#3b8bff', '#0a3d9e'], ['#35c455', '#0c6a24'], ['#ffd52e', '#b98500'], ['#f23d3d', '#8a1010'], ['#c552ff', '#6b1a9c'], ['#ff9b30', '#a05000']];
  function gemSVG(type, special) {
    if (special === M.BOMB) return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="#fff" stroke="#888" stroke-width="5"/><circle cx="50" cy="50" r="42" fill="url(#gm-rainbow)"/><circle cx="38" cy="36" r="9" fill="#fff" opacity=".55"/></svg>';
    const [fill, stroke] = COLORS[type] || COLORS[0];
    const mark = special === M.LINE_H ? '<path d="M18 50h64M30 38 16 50l14 12M70 38l14 12-14 12" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      : special === M.LINE_V ? '<path d="M50 18v64M38 30 50 16l12 14M38 70l12 14 12-14" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '';
    return `<svg viewBox="0 0 100 100"><g fill="${fill}" stroke="${stroke}" stroke-width="5" stroke-linejoin="round">${SHAPES[type]}</g><g fill="#fff" opacity=".28" transform="translate(50 50) scale(.55) translate(-50 -50)">${SHAPES[type]}</g>${mark}</svg>`;
  }

  // ---- Estilos y ventana ----
  const st = document.createElement('style');
  st.textContent = `
    #gm .modal-card { max-height: min(94vh, 760px); overflow-y: auto; }
    #gm .gm-info { font-size: 14px; line-height: 1.5; margin: 0 0 10px; }
    #gm .gm-small { font-size: 12px; color: var(--muted); line-height: 1.6; margin: 6px 0 0; }
    #gm .gm-top { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 15px; gap: 8px; }
    #gm .gm-bar { height: 8px; border-radius: 6px; background: rgba(128, 128, 128, .25); overflow: hidden; margin: 5px 0; }
    #gm .gm-bar i { display: block; height: 100%; width: 0; background: #2f9e44; transition: width .25s; }
    #gm .gm-bar.time i { background: #f08c00; transition: width .2s linear; }
    #gm .gm-bar.time.low i { background: #e03131; }
    #gm .gm-board { position: relative; width: 100%; max-width: 380px; aspect-ratio: 1; margin: 8px auto; border-radius: 14px; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none;
      background: linear-gradient(#2aa8ff, #1b7fe0); border: 3px solid var(--line); }
    #gm .gm-g { position: absolute; width: 12.5%; height: 12.5%; padding: 1.2%; box-sizing: border-box; transition: left .28s cubic-bezier(.5, 0, .9, .6), top .28s cubic-bezier(.5, 0, .9, .6), transform .2s, opacity .2s; cursor: pointer; }
    #gm .gm-g svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .35)); }
    #gm .gm-g.sel { transform: scale(1.14); z-index: 2; }
    #gm .gm-g.pop { transform: scale(0); opacity: 0; }
    #gm .gm-g.hint svg { animation: gmpulse .7s ease-in-out infinite; }
    #gm .gm-g.sp svg { animation: gmglow 1.1s ease-in-out infinite; }
    @keyframes gmpulse { 50% { transform: scale(1.18); } }
    @keyframes gmglow { 50% { filter: drop-shadow(0 0 7px #fff) drop-shadow(0 2px 2px rgba(0, 0, 0, .35)); } }
    #gm .gm-banner { position: absolute; left: 0; right: 0; top: 40%; text-align: center; font-size: 28px; font-weight: 900; color: #fff; text-shadow: 0 3px 8px rgba(0, 0, 0, .6); pointer-events: none; opacity: 0; transition: opacity .25s; z-index: 5; }
    #gm .gm-banner.on { opacity: 1; }
    #gm .gm-act { display: flex; gap: 8px; margin-top: 8px; }
    #gm .gm-act button { flex: 1; padding: 11px; font-weight: 700; border-radius: 10px; }
    #gm .gm-big { font-size: 20px; font-weight: 800; text-align: center; margin: 10px 0 4px; }
    #gm .gm-msg { font-size: 13px; min-height: 18px; margin: 8px 0 0; }
    #gm .gm-msg.err { color: #e03131; }
    @media (prefers-reduced-motion: reduce) { #gm .gm-g, #gm .gm-bar i { transition: none; } #gm .gm-g.hint svg, #gm .gm-g.sp svg { animation: none; } }
  `;
  document.head.appendChild(st);
  const defs = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gm-rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset=".25" stop-color="#ffd52e"/><stop offset=".5" stop-color="#35c455"/><stop offset=".75" stop-color="#3b8bff"/><stop offset="1" stop-color="#c552ff"/></linearGradient></defs></svg>';

  const modal = document.createElement('div');
  modal.id = 'gm'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'gm-title');
  modal.innerHTML = defs + '<div class="modal-card"><button id="gm-close" class="close" type="button" aria-label="Cerrar">×</button><h2 id="gm-title">💎 Gemas</h2><div id="gm-body"></div><p id="gm-msg" class="gm-msg" role="status"></p></div>';
  document.body.appendChild(modal);
  const body = modal.querySelector('#gm-body'), msg = modal.querySelector('#gm-msg'), titleEl = modal.querySelector('#gm-title');
  const say = (t, err) => { msg.textContent = t || ''; msg.className = 'gm-msg' + (err ? ' err' : ''); };
  const word = n => (n === 1 ? 'crédito' : 'créditos');
  const ding = n => { try { if (window.sfx) sfx(n); } catch (e) { /* sin sonido */ } };
  function setCredits(c) { if (c != null && typeof credits !== 'undefined') { credits = c; if (typeof updateCreditUi === 'function') updateCreditUi(); } }

  // ---- Estado de la partida ----
  let G = null;   // { s (motor), moves, t0, busy, over, timer, hintTimer, els: Map(id → div), sel, shown (milli mostrados) }

  function close() { if (G && !G.over) finish(true); modal.classList.add('hidden'); }
  modal.querySelector('#gm-close').addEventListener('click', close);
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

  async function intro() {
    G = null; titleEl.textContent = '💎 Gemas'; say('');
    let info; try { info = await api('/api/mj/gemas'); } catch (e) { body.innerHTML = ''; return say((e && e.message) || 'No se pudo cargar el juego', true); }
    body.innerHTML = `
      <p class="gm-info">Intercambia dos gemas contiguas para juntar <b>3 o más</b> del mismo color. Rompe las gemas que pide cada nivel <b>antes de que se acabe el tiempo</b> y pasarás al siguiente, cada vez más difícil.</p>
      <p class="gm-info">💰 Cada gema rota suma unas milésimas de crédito (de media 0,004, con cadenas suma más), hasta un máximo de <b>5 créditos por partida</b>. Cuantas más gemas llevas en la partida, menos vale cada una.</p>
      <p class="gm-info">✨ 4 en línea crea un <b>rayo</b> (rompe su fila o columna). 5 o más crean el <b>arcoíris</b>: cámbialo por una gema y rompe todas las de ese color.</p>
      <div class="gm-act"><button type="button" id="gm-play" ${info.left <= 0 ? 'disabled' : ''}>Jugar (1 🎟️)</button></div>
      <p class="gm-small">Partidas que te quedan hoy: <b>${info.left}</b>. Las milésimas que no llegan a 1 crédito se guardan para la próxima partida${info.carry ? ' (ahora llevas ' + fmt(info.carry) + ')' : ''}. Si cierras o se acaba el tiempo, cobras lo que lleves.</p>`;
    body.querySelector('#gm-play').addEventListener('click', start);
  }

  async function start(e) {
    e.target.disabled = true; say('');
    let r; try { r = await api('/api/mj/gemas/start', { method: 'POST', body: {} }); } catch (er) { e.target.disabled = false; return say((er && er.message) || 'No se pudo empezar', true); }
    setCredits(r.credits); build(r.seed);
  }

  function build(seed) {
    const s = M.create(seed);
    G = { s, moves: [], t0: performance.now(), busy: false, over: false, els: new Map(), sel: null, shown: 0, lastMove: performance.now(), timer: null, hintTimer: null };
    titleEl.textContent = '💎 Gemas';
    body.innerHTML = `
      <div class="gm-top"><span id="gm-lv">Nivel 1</span><span id="gm-time">⏱ 1:15</span><span id="gm-cr">💰 0,000</span></div>
      <div class="gm-bar time" id="gm-tbar"><i></i></div>
      <div class="gm-bar" id="gm-gbar"><i></i></div>
      <p class="gm-small" id="gm-goal" style="margin:0;text-align:center"></p>
      <div class="gm-board" id="gm-board"><div class="gm-banner" id="gm-banner"></div></div>
      <div class="gm-act"><button type="button" id="gm-hint">💡 Pista</button><button type="button" id="gm-end">Terminar y cobrar</button></div>`;
    const board = body.querySelector('#gm-board');
    G.board = board;
    M.snapshot(s).forEach(g => place(g, true));
    updateHud();
    bindInput(board);
    body.querySelector('#gm-end').addEventListener('click', () => finish(false));
    body.querySelector('#gm-hint').addEventListener('click', showHint);
    G.timer = setInterval(tick, 200);
    G.hintTimer = setInterval(() => { if (!G.busy && !G.over && performance.now() - G.lastMove > 9000) showHint(); }, 1500);
  }

  // ---- Dibujo del tablero ----
  function place(g, fresh) {   // coloca (o crea) la gema con ese id en su casilla
    let el = G.els.get(g.id);
    if (!el) {
      el = document.createElement('div'); el.className = 'gm-g'; el.dataset.id = g.id; el.innerHTML = gemSVG(g.type, g.special);
      el.style.left = g.c * 12.5 + '%';
      el.style.top = fresh ? g.r * 12.5 + '%' : -12.5 * (1 + ((H - 1 - g.r) % 3)) + '%';   // las nuevas entran por arriba
      G.board.appendChild(el); G.els.set(g.id, el);
      if (!fresh) { void el.offsetWidth; }
    }
    el.dataset.type = g.type; el.dataset.sp = g.special; el.classList.toggle('sp', !!g.special);
    el.style.left = g.c * 12.5 + '%'; el.style.top = g.r * 12.5 + '%';
    return el;
  }
  function restyle(id, type, special) { const el = G.els.get(id); if (el) { el.innerHTML = gemSVG(type, special); el.dataset.sp = special; el.classList.toggle('sp', !!special); } }
  function updateHud() {
    const s = G.s, tgt = M.target(s.level), remain = Math.max(0, s.deadline - (performance.now() - G.t0)), total = M.limit(s.level) * 1000;
    body.querySelector('#gm-lv').textContent = 'Nivel ' + s.level;
    body.querySelector('#gm-cr').textContent = '💰 ' + fmt(G.shown);
    body.querySelector('#gm-gbar i').style.width = Math.min(100, (s.levelGems / tgt) * 100) + '%';
    body.querySelector('#gm-goal').textContent = `Objetivo: romper ${tgt} gemas (${Math.min(s.levelGems, tgt)}/${tgt}) · máx. 5 créditos por partida`;
    const sec = Math.ceil(remain / 1000), tb = body.querySelector('#gm-tbar');
    body.querySelector('#gm-time').textContent = '⏱ ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    tb.firstElementChild.style.width = Math.min(100, (remain / total) * 100) + '%'; tb.classList.toggle('low', remain < 8000);
  }
  function tick() {
    if (!G || G.over) return;
    updateHud();
    if (G.s.deadline - (performance.now() - G.t0) <= 0 && !G.busy) finish(false, true);
  }
  function banner(text, ms) {
    const b = body.querySelector('#gm-banner'); if (!b) return;
    b.textContent = text; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), ms || 900);
  }
  function clearHint() { G.els.forEach(el => el.classList.remove('hint', 'sel')); G.sel = null; }
  function showHint() {
    if (!G || G.busy || G.over) return; clearHint();
    const mv = M.findMove(G.s); if (!mv) return;
    mv.forEach(i => { const el = [...G.els.values()].find(e => G.s.ids[i] === Number(e.dataset.id)); if (el) el.classList.add('hint'); });
    G.lastMove = performance.now() - 3000;
  }

  // ---- Entrada: arrastrar una gema hacia otra, o tocar una y luego su vecina ----
  function bindInput(board) {
    let down = null;
    const cellOf = ev => { const r = board.getBoundingClientRect(), c = Math.floor(((ev.clientX - r.left) / r.width) * W), rr = Math.floor(((ev.clientY - r.top) / r.height) * H); return c < 0 || rr < 0 || c >= W || rr >= H ? -1 : rr * W + c; };
    board.addEventListener('pointerdown', ev => {
      if (G.busy || G.over) return;
      const i = cellOf(ev); if (i < 0) return;
      down = { i, x: ev.clientX, y: ev.clientY, done: false };
      try { board.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ }
    });
    board.addEventListener('pointermove', ev => {
      if (!down || down.done || G.busy || G.over) return;
      const dx = ev.clientX - down.x, dy = ev.clientY - down.y, th = board.getBoundingClientRect().width / W * 0.35;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < th) return;
      down.done = true;
      const j = Math.abs(dx) > Math.abs(dy) ? down.i + (dx > 0 ? 1 : -1) : down.i + (dy > 0 ? W : -W);
      const sameRow = Math.abs(dx) > Math.abs(dy) ? ((j / W) | 0) === ((down.i / W) | 0) : true;
      clearHint(); if (sameRow && j >= 0 && j < W * H) attempt(down.i, j);
    });
    board.addEventListener('pointerup', () => {
      if (down && !down.done && !G.busy && !G.over) {   // toque: seleccionar o intercambiar con la vecina
        const i = down.i;
        if (G.sel !== null && G.sel !== i && ((Math.abs(G.sel - i) === W) || (Math.abs(G.sel - i) === 1 && ((G.sel / W) | 0) === ((i / W) | 0)))) { const a = G.sel; clearHint(); attempt(a, i); }
        else { clearHint(); G.sel = i; const el = [...G.els.values()].find(e => G.s.ids[i] === Number(e.dataset.id)); if (el) el.classList.add('sel'); }
      }
      down = null;
    });
    board.addEventListener('pointercancel', () => { down = null; });
  }

  async function attempt(a, b) {
    if (G.busy || G.over) return;
    const now = performance.now(), t = Math.round(now - G.t0), prev = G.moves.length ? G.moves[G.moves.length - 1][2] : -M.MIN_GAP;
    if (t - prev < M.MIN_GAP + 20) return;   // el motor exige una pausa mínima entre movimientos válidos
    G.busy = true; G.lastMove = now;
    const s = G.s, idA = s.ids[a], idB = s.ids[b];
    const elA = G.els.get(idA), elB = G.els.get(idB), pa = [elA.style.left, elA.style.top], pb = [elB.style.left, elB.style.top];
    const r = M.play(s, a, b, t);
    if (!r.ok) {   // movimiento no válido: se intercambian y vuelven
      if (r.over) { G.busy = false; return finish(false, true); }
      [elA.style.left, elA.style.top, elB.style.left, elB.style.top] = [pb[0], pb[1], pa[0], pa[1]]; await sleep(reduced ? 0 : 200);
      [elA.style.left, elA.style.top, elB.style.left, elB.style.top] = [pa[0], pa[1], pb[0], pb[1]]; await sleep(reduced ? 0 : 220);
      G.busy = false; return;
    }
    G.moves.push([a, b, t]);
    [elA.style.left, elA.style.top, elB.style.left, elB.style.top] = [pb[0], pb[1], pa[0], pa[1]]; await sleep(reduced ? 0 : 200);
    for (const step of r.steps) {
      if (step.chain > 1) banner(step.chain >= 4 ? '¡Increíble! ×' + step.chain : '¡Cadena ×' + step.chain + '!', 700);
      step.removed.forEach(id => { const el = G.els.get(id); if (el) el.classList.add('pop'); });
      step.spawn.forEach(sp => { const g = step.after.find(x => x.id === sp.id); if (g) restyle(sp.id, g.type, sp.special); });
      ding('click'); G.shown += step.gained; updateHud();
      await sleep(reduced ? 0 : 230);
      step.removed.forEach(id => { const el = G.els.get(id); if (el) { el.remove(); G.els.delete(id); } });
      step.after.forEach(g => place(g, false));
      await sleep(reduced ? 0 : 320);
    }
    if (r.shuffled) { banner('Sin jugadas: mezclando', 900); r.final.forEach(g => place(g, false)); await sleep(reduced ? 0 : 350); }
    if (r.levelUp) { ding('claim'); banner('¡Nivel ' + r.level + '!', 1200); await sleep(reduced ? 0 : 500); }
    G.shown = G.s.milli; updateHud(); G.lastMove = performance.now();
    G.busy = false;
    if (G.s.deadline - (performance.now() - G.t0) <= 0) finish(false, true);
  }

  // ---- Final de la partida: se mandan los movimientos y el servidor los repite y paga ----
  async function finish(silent, timeUp) {
    if (!G || G.over) return; G.over = true; clearInterval(G.timer); clearInterval(G.hintTimer);
    const g = G, local = g.s;
    if (silent) { api('/api/mj/gemas/finish', { method: 'POST', body: { moves: g.moves } }).then(r => setCredits(r.credits)).catch(() => {}); return; }
    body.querySelectorAll('button').forEach(b => (b.disabled = true));
    let r; try { r = await api('/api/mj/gemas/finish', { method: 'POST', body: { moves: g.moves } }); } catch (e) { say((e && e.message) || 'No se pudo cobrar la partida', true); return; }
    setCredits(r.credits); ding('claim');
    body.innerHTML = `
      <p class="gm-big">${timeUp ? '⏰ ¡Se acabó el tiempo!' : '🏁 Partida terminada'}</p>
      <p class="gm-info" style="text-align:center">Nivel <b>${r.level}</b> · ${r.gems} gemas rotas · ${r.score} puntos</p>
      <p class="gm-big">💰 ${fmt(r.milli)} créditos ganados</p>
      <p class="gm-info" style="text-align:center">${r.paid ? 'Se te han abonado <b>' + r.paid + ' ' + word(r.paid) + '</b>. ' : 'Aún no llegan a 1 crédito. '}Te quedan ${fmt(r.carry)} guardados para la próxima partida.${r.honest ? '' : ' (Partida no válida: no se ha pagado.)'}</p>
      <div class="gm-act"><button type="button" id="gm-again">Jugar otra vez (1 🎟️)</button></div>`;
    body.querySelector('#gm-again').addEventListener('click', intro);
    say(local.milli >= M.MAX_MILLI ? '🏆 ¡Has llegado al máximo de 5 créditos!' : '');
  }

  btn.addEventListener('click', () => {
    if (!authToken) return openLogin('Entra con tu cuenta para jugar a las gemas 💎');
    modal.classList.remove('hidden'); body.innerHTML = '<p class="gm-info">Cargando…</p>'; intro();
  });
})();
