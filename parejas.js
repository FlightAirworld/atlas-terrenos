'use strict';
// PAREJAS CON TUS CARTAS (botón 🃏 en Extras): memory de 12 casillas con cartas coleccionables. Menos intentos = más créditos.
// El servidor guarda el tablero y solo enseña la carta que giras (ver parejas-server.js: /api/parejas, /start, /flip); aquí solo se dibuja.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), sfx().
(function () {
  const btn = document.getElementById('parejas-btn');
  if (!btn) return;
  const nf = n => Number(n).toLocaleString('es-ES');
  const word = n => (n === 1 ? 'crédito' : 'créditos');

  const st = document.createElement('style');
  st.textContent = `
    #parejas .modal-card { max-height: min(94vh, 760px); overflow-y: auto; }
    #parejas .pinfo { font-size: 14px; margin: 0 0 10px; }
    #parejas .psmall { font-size: 12px; color: var(--muted); margin: 8px 0 0; line-height: 1.5; }
    #parejas .phead { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin: 0 0 8px; }
    #parejas .pgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: min(100%, 330px); margin: 0 auto; }
    #parejas .ptile { aspect-ratio: 3 / 4; border-radius: 12px; border: 2px solid var(--line); padding: 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; background: linear-gradient(135deg, #3b5bdb, #7048e8); color: #fff; font-size: 30px; transition: transform .25s; line-height: 1.1; overflow: hidden; }
    #parejas .ptile.up { cursor: default; font-size: 34px; }
    #parejas .ptile.up small { font-size: 10px; font-weight: 700; text-align: center; line-height: 1.1; padding: 0 3px; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
    #parejas .ptile.up .pr { font-size: 8px; opacity: .85; font-weight: 600; }
    #parejas .ptile.ok { box-shadow: 0 0 0 3px #2f9e44 inset; }
    #parejas .ptile.bad { animation: pshake .35s; }
    @keyframes pshake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
    #parejas .pbig { font-size: 40px; font-weight: 800; text-align: center; margin: 6px 0; }
    #parejas .pact { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    #parejas .pact button { flex: 1; padding: 10px; font-weight: 700; }
    #parejas .pmsg { font-size: 13px; min-height: 18px; margin: 8px 0 0; }
    #parejas .pmsg.err { color: #e03131; }
  `;
  document.head.appendChild(st);

  const modal = document.createElement('div');
  modal.id = 'parejas'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'parejas-title');
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button id="parejas-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="parejas-title">🃏 Parejas con tus cartas</h2>' +
      '<div id="parejas-body"></div>' +
      '<p id="parejas-msg" class="pmsg" role="status"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const body = modal.querySelector('#parejas-body'), msg = modal.querySelector('#parejas-msg');

  let busy = false, game = null, tiles = [], attemptsEl = null, foundEl = null, firstPos = -1, found = 0;
  const say = (t, err) => { msg.textContent = t || ''; msg.className = 'pmsg' + (err ? ' err' : ''); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function el(tag, props, kids) { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach(k => e.append(k)); return e; }
  const button = (text, onclick, props) => el('button', Object.assign({ type: 'button', textContent: text, onclick }, props || {}));

  // ---- Casillas ----
  function faceUp(t, c, ok) {
    t.className = 'ptile up' + (ok ? ' ok' : '');
    t.style.background = `linear-gradient(135deg, ${c.c1 || '#555'}, ${c.c2 || '#222'})`;
    t.replaceChildren(el('span', { textContent: c.emoji }), el('small', { textContent: c.name }), el('small', { className: 'pr', textContent: c.rarity }));
    t.setAttribute('aria-label', `${c.name}, ${c.rarity}`);
  }
  function faceDown(t) {
    t.className = 'ptile'; t.style.background = ''; t.replaceChildren(document.createTextNode('❓')); t.setAttribute('aria-label', 'Casilla tapada');
  }

  // ---- Inicio ----
  async function intro() {
    say('Cargando…'); body.replaceChildren(); game = null;
    let s;
    try { s = await api('/api/parejas'); } catch (e) { return say(e.message || 'No se pudo cargar', true); }
    say('');
    if (!s.on) return body.replaceChildren(el('p', { className: 'pinfo', textContent: 'Las parejas no están disponibles ahora mismo.' }));
    const canPlay = s.active || s.gamesLeft > 0;
    const prizes = s.rewards.map(r => `≤${r.max} intentos = ${nf(r.credits)} ${word(r.credits)}`).join(' · ');
    body.replaceChildren(
      el('p', { className: 'pinfo', textContent: `Encuentra las ${s.pairs} parejas de cartas. Cada vez que giras 2 casillas cuenta 1 intento: cuantos menos, más créditos. Se usan tus cartas coleccionables (y se completa con otras si tienes pocas).` }),
      el('p', { className: 'psmall', textContent: `Premios: ${prizes}` }),
      el('p', { className: 'psmall', textContent: `Partidas que te quedan hoy: ${s.gamesLeft}/${s.gamesMax} · Créditos ganados hoy: ${nf(s.earned)}/${nf(s.dailyMax)}` }),
      button(s.active ? '▶ Continuar partida' : '▶ Jugar', start, { disabled: !canPlay, className: 'primary', style: 'width:100%;margin-top:12px;padding:12px;font-weight:700' }),
      !canPlay ? el('p', { className: 'psmall', textContent: 'Hoy ya has jugado todas tus partidas. ¡Vuelve mañana!' }) : ''
    );
  }

  async function start() {
    if (busy) return; busy = true; say('Barajando…');
    try { const j = await api('/api/parejas/start', { method: 'POST', body: {} }); say(''); board(j.game); }
    catch (e) { say(e.message || 'No se pudo empezar', true); }
    finally { busy = false; }
  }

  // ---- Tablero ----
  function board(g) {
    game = g; firstPos = -1; found = g.matched.length / 2;
    attemptsEl = el('span', { textContent: `Intentos: ${g.attempts}` });
    foundEl = el('span', { textContent: `Parejas: ${found}/${g.pairs}` });
    const grid = el('div', { className: 'pgrid' });
    tiles = [];
    for (let i = 0; i < g.cells; i++) { const t = el('button', { type: 'button' }); faceDown(t); t.onclick = () => flip(i); tiles.push(t); grid.append(t); }
    g.matched.forEach(m => faceUp(tiles[m.pos], m.card, true));
    if (g.first) { faceUp(tiles[g.first.pos], g.first.card, false); firstPos = g.first.pos; }
    body.replaceChildren(
      el('div', { className: 'phead' }, [attemptsEl, foundEl]),
      grid,
      el('p', { className: 'psmall', style: 'text-align:center', textContent: g.mine >= g.pairs ? 'Todas las cartas del tablero son tuyas 💪' : g.mine > 0 ? `${g.mine} de las ${g.pairs} cartas son tuyas; el resto son de regalo.` : 'Aún no tienes cartas: hoy juegas con cartas de regalo. ¡Consigue sobres para jugar con las tuyas!' })
    );
  }

  async function flip(pos) {
    if (busy || !game) return;
    const t = tiles[pos]; if (!t || t.classList.contains('up')) return;
    busy = true;
    try {
      const j = await api('/api/parejas/flip', { method: 'POST', body: { game: game.id, pos } });
      faceUp(t, j.card, false);
      try { sfx('click'); } catch (x) {}
      if (j.match === null) { firstPos = pos; return; }   // primera casilla: espera a la segunda
      attemptsEl.textContent = `Intentos: ${j.attempts}`;
      const f = tiles[j.first];
      if (j.match) {
        f.classList.add('ok'); t.classList.add('ok'); found = j.found; foundEl.textContent = `Parejas: ${found}/${game.pairs}`;
        try { sfx('gift'); } catch (x) {}
        firstPos = -1;
        if (j.done) { await wait(900); result(j); }
      } else {
        f.classList.add('bad'); t.classList.add('bad');
        await wait(1000);
        faceDown(f); faceDown(t); firstPos = -1;
      }
    } catch (e) {
      say(e.message || 'Error al girar la casilla', true);
      if (/ya (está|terminó)/i.test(e.message || '')) setTimeout(intro, 1200);
    } finally { busy = false; }
  }

  // ---- Resultado ----
  function result(j) {
    game = null;
    if (typeof j.credits === 'number') { credits = j.credits; try { updateCreditUi(); } catch (e) {} }
    const won = j.reward > 0;
    const text = won ? `¡Has ganado ${nf(j.reward)} ${word(j.reward)}! 💰`
      : j.capped ? 'Hoy ya has llegado al máximo de créditos de este juego. ¡Mañana más!' : 'Esta vez no ha habido premio. ¡Con menos intentos ganarás créditos!';
    const share = async () => {
      const t = `🃏 He encontrado las 6 parejas de cartas en ${j.attempts} intentos en Redecora El Mundo 🌎 ¿Me superas? https://redecoraelmundo.com`;
      try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); say('Texto copiado 📋'); } } catch (e) { /* cancelado */ }
    };
    body.replaceChildren(
      el('div', { className: 'pbig', textContent: `${j.attempts} intentos` }),
      el('p', { className: 'pinfo', style: 'text-align:center', textContent: text }),
      el('div', { className: 'pact' }, [button('Jugar otra vez', intro), button('Compartir 📣', share)])
    );
    if (won) { try { sfx('gift'); } catch (e) {} }
  }

  function open() {
    if (!authToken) return openLogin('Entra con tu cuenta para jugar a las parejas 🃏');
    modal.classList.remove('hidden'); intro();
  }
  const close = () => modal.classList.add('hidden');
  btn.addEventListener('click', open);
  modal.querySelector('#parejas-close').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
})();
