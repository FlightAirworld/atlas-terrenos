'use strict';
// RASCA Y GANA (botón 🍀 en Extras): una tarjeta gratis al día. Se rasca con el dedo o el ratón; con 3 símbolos iguales hay premio.
// El servidor decide y paga TODO al pulsar «Rascar» (ver rasca-server.js: /api/rasca y /api/rasca/play); rascar es solo el espectáculo.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), sfx().
(function () {
  const btn = document.getElementById('rasca-btn');
  if (!btn) return;
  const nf = n => Number(n).toLocaleString('es-ES');
  const word = n => (n === 1 ? 'crédito' : 'créditos');

  const st = document.createElement('style');
  st.textContent = `
    #rasca .modal-card { max-height: min(92vh, 720px); overflow-y: auto; }
    #rasca .rinfo { font-size: 14px; margin: 0 0 10px; }
    #rasca .rsmall { font-size: 12px; color: var(--muted); margin: 8px 0 0; line-height: 1.6; }
    #rasca .rcard { position: relative; width: min(100%, 300px); margin: 0 auto; border-radius: 14px; overflow: hidden; border: 2px solid var(--line); background: var(--card); touch-action: none; user-select: none; -webkit-user-select: none; }
    #rasca .rgrid { display: grid; grid-template-columns: repeat(3, 1fr); }
    #rasca .rcell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 42px; border: 1px solid var(--line); }
    #rasca .rcell.win { background: rgba(47, 158, 68, .25); animation: rpulse .8s ease-in-out 3; }
    @keyframes rpulse { 50% { transform: scale(1.12); } }
    #rasca canvas { position: absolute; inset: 0; width: 100%; height: 100%; transition: opacity .5s; cursor: crosshair; touch-action: none; }
    #rasca canvas.off { opacity: 0; pointer-events: none; }
    #rasca .rbig { font-size: 18px; font-weight: 800; text-align: center; margin: 12px 0 4px; }
    #rasca .ract { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    #rasca .ract button { flex: 1; padding: 10px; font-weight: 700; }
    #rasca .rmsg { font-size: 13px; min-height: 18px; margin: 8px 0 0; }
    #rasca .rmsg.err { color: #e03131; }
  `;
  document.head.appendChild(st);

  const modal = document.createElement('div');
  modal.id = 'rasca'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'rasca-title');
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button id="rasca-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="rasca-title">🍀 Rasca y gana</h2>' +
      '<div id="rasca-body"></div>' +
      '<p id="rasca-msg" class="rmsg" role="status"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const body = modal.querySelector('#rasca-body'), msg = modal.querySelector('#rasca-msg');

  let pending = null;       // saldo nuevo que se enseña al terminar de rascar (para no destripar el premio antes)
  let busy = false;
  const say = (t, err) => { msg.textContent = t || ''; msg.className = 'rmsg' + (err ? ' err' : ''); };
  function el(tag, props, kids) { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; }
  const button = (text, onclick, props) => el('button', Object.assign({ type: 'button', textContent: text, onclick }, props || {}));
  function applyCredits() { if (pending !== null) { credits = pending; pending = null; try { updateCreditUi(); } catch (e) {} } }

  const prizeLine = ps => ps.map(p => `${p.sym.repeat(3)} = ${nf(p.credits)}`).join(' · ');

  // ---- Tarjeta: rejilla de 6 casillas + capa plateada que se rasca ----
  function buildCard(grid, winSym) {
    const g = el('div', { className: 'rgrid' });
    for (let i = 0; i < 6; i++) g.append(el('div', { className: 'rcell', textContent: grid ? grid[i] : '❔' }));
    const card = el('div', { className: 'rcard' }, [g]);
    return { card, cells: [...g.children], setGrid(arr) { this.cells.forEach((c, i) => { c.textContent = arr[i]; }); }, markWin(sym) { this.cells.forEach(c => { if (c.textContent === sym) c.classList.add('win'); }); } };
  }

  function addCover(card, onDone) {   // capa plateada con canvas; devuelve controles
    const cv = el('canvas'); card.append(cv);
    const w = card.clientWidth || 300, h = card.clientHeight || 200, dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c9ced6'); gr.addColorStop(.5, '#9ea5b1'); gr.addColorStop(1, '#c9ced6');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '800 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('RASCA AQUÍ', w / 2, h / 2);
    let enabled = false, last = null, done = false, checkAt = 0;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (w / r.width), y: (e.clientY - r.top) * (h / r.height) }; };
    function scratchTo(p) {
      ctx.globalCompositeOperation = 'destination-out'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 46;
      ctx.beginPath(); ctx.moveTo((last || p).x, (last || p).y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
      const now = Date.now(); if (now - checkAt > 250) { checkAt = now; check(); }
    }
    function check() {   // ¿está rascado más de la mitad? (se mira una copia pequeña para que sea rápido)
      if (done) return;
      const s = document.createElement('canvas'); s.width = 40; s.height = 26;
      const sc = s.getContext('2d'); sc.drawImage(cv, 0, 0, 40, 26);
      const d = sc.getImageData(0, 0, 40, 26).data; let clear = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 128) clear++;
      if (clear / (40 * 26) > 0.5) finish();
    }
    function finish() { if (done) return; done = true; enabled = false; cv.classList.add('off'); onDone(); }
    cv.addEventListener('pointerdown', e => { if (!enabled || done) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} last = null; scratchTo(pos(e)); });
    cv.addEventListener('pointermove', e => { if (!enabled || done || e.buttons === 0 && e.pointerType === 'mouse') return; e.preventDefault(); scratchTo(pos(e)); });
    const up = () => { last = null; if (enabled) check(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    return { enable() { enabled = true; }, reveal: finish };
  }

  // ---- Pantallas ----
  async function intro() {
    say('Cargando…'); body.replaceChildren();
    let s;
    try { s = await api('/api/rasca'); } catch (e) { return say(e.message || 'No se pudo cargar', true); }
    say('');
    if (!s.on) return body.replaceChildren(el('p', { className: 'rinfo', textContent: 'El rasca y gana no está disponible ahora mismo.' }));
    const table = el('p', { className: 'rsmall', textContent: `Premios (3 iguales): ${prizeLine(s.prizes)}` });
    if (s.played) {   // ya la rascó hoy: se enseña revelada
      const c = buildCard(s.grid); if (s.prize > 0) c.markWin(s.grid.find(x => s.grid.filter(y => y === x).length === 3));
      return body.replaceChildren(
        el('p', { className: 'rinfo', textContent: 'Hoy ya has rascado tu tarjeta. ¡Vuelve mañana para otra!' }),
        c.card,
        el('p', { className: 'rbig', textContent: s.prize > 0 ? `Ganaste ${nf(s.prize)} ${word(s.prize)} 💰` : 'Hoy no hubo premio 🍀' }),
        table
      );
    }
    const c = buildCard(null);
    const play = button('🍀 Rascar mi tarjeta de hoy', () => startPlay(c, play, s), { className: 'primary', style: 'width:100%;margin-top:12px;padding:12px;font-weight:700' });
    body.replaceChildren(
      el('p', { className: 'rinfo', textContent: 'Tienes 1 tarjeta gratis al día. Si salen 3 símbolos iguales, ¡ganas créditos!' }),
      c.card, play, table
    );
  }

  async function startPlay(c, playBtn, s) {
    if (busy) return; busy = true; playBtn.disabled = true; say('Preparando tu tarjeta…');
    try {
      const j = await api('/api/rasca/play', { method: 'POST', body: {} });
      say(''); pending = j.credits;
      c.setGrid(j.grid); playBtn.remove();
      try { sfx('click'); } catch (x) {}
      const cover = addCover(c.card, () => reveal(c, j, s));
      cover.enable();
      body.insertBefore(el('p', { className: 'rinfo', textContent: '¡Rasca con el dedo!' }), c.card);
      body.insertBefore(button('Revelar todo', () => cover.reveal(), { className: 'link', style: 'display:block;margin:10px auto 0' }), body.lastChild);
    } catch (e) { say(e.message || 'No se pudo conseguir la tarjeta', true); playBtn.disabled = false; if (/Ya has rascado/.test(e.message || '')) setTimeout(intro, 1200); }
    finally { busy = false; }
  }

  function reveal(c, j, s) {
    applyCredits();
    const win = j.prize > 0;
    if (win) c.markWin(j.sym);
    [...body.querySelectorAll('button.link')].forEach(b => b.remove());
    const share = async () => {
      const t = `🍀 Hoy he ganado ${nf(j.prize)} ${word(j.prize)} en el rasca y gana de Redecora El Mundo 🌎 https://redecoraelmundo.com`;
      try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); say('Texto copiado 📋'); } } catch (e) { /* cancelado */ }
    };
    body.append(
      el('p', { className: 'rbig', textContent: win ? `¡Tres ${j.sym}! Has ganado ${nf(j.prize)} ${word(j.prize)} 💰` : 'Esta vez no ha habido suerte 🍀 Mañana tienes otra tarjeta.' }),
      el('div', { className: 'ract' }, win ? [button('Compartir 📣', share), button('Cerrar', close)] : [button('Cerrar', close)])
    );
    if (win) { try { sfx('gift'); } catch (e) {} }
  }

  function open() {
    if (!authToken) return openLogin('Entra con tu cuenta para rascar tu tarjeta 🍀');
    modal.classList.remove('hidden'); intro();
  }
  const close = () => { applyCredits(); modal.classList.add('hidden'); };   // si cierra antes de terminar, el saldo se actualiza igual
  btn.addEventListener('click', open);
  modal.querySelector('#rasca-close').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
})();
