'use strict';
// TRIVIA DE GEOGRAFÍA (botón 🧠 en Extras): 5 preguntas con 4 opciones y tiempo límite; los aciertos dan créditos.
// El servidor decide todo (ver trivia-server.js: /api/trivia, /api/trivia/start, /api/trivia/answer). Aquí solo se dibuja.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), sfx().
(function () {
  const btn = document.getElementById('trivia-btn');
  if (!btn) return;
  const nf = n => Number(n).toLocaleString('es-ES');
  const word = n => (n === 1 ? 'crédito' : 'créditos');

  const st = document.createElement('style');
  st.textContent = `
    #trivia .modal-card { max-height: min(92vh, 720px); overflow-y: auto; }
    #trivia .tinfo { font-size: 14px; margin: 0 0 10px; }
    #trivia .tsmall { font-size: 12px; color: var(--muted); margin: 0 0 10px; }
    #trivia .thead { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin: 0 0 6px; }
    #trivia .tbar { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; margin: 0 0 12px; }
    #trivia .tbar i { display: block; height: 100%; width: 100%; background: var(--accent); }
    #trivia .tq { font-size: 18px; font-weight: 700; margin: 0 0 12px; line-height: 1.3; }
    #trivia .topts { display: grid; gap: 8px; }
    #trivia .topts button { padding: 12px; font-size: 16px; font-weight: 600; text-align: left; }
    #trivia .topts button.ok { background: #2f9e44; border-color: #2f9e44; color: #fff; }
    #trivia .topts button.bad { background: #e03131; border-color: #e03131; color: #fff; }
    #trivia .tbig { font-size: 40px; font-weight: 800; text-align: center; margin: 6px 0; }
    #trivia .tact { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    #trivia .tact button { flex: 1; padding: 10px; font-weight: 700; }
    #trivia .tmsg { font-size: 13px; min-height: 18px; margin: 8px 0 0; }
    #trivia .tmsg.err { color: #e03131; }
  `;
  document.head.appendChild(st);

  const modal = document.createElement('div');
  modal.id = 'trivia'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'trivia-title');
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button id="trivia-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="trivia-title">🧠 Trivia del mundo</h2>' +
      '<div id="trivia-body"></div>' +
      '<p id="trivia-msg" class="tmsg" role="status"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const body = modal.querySelector('#trivia-body'), msg = modal.querySelector('#trivia-msg');

  let timer = null, busy = false, game = null;
  const say = (t, err) => { msg.textContent = t || ''; msg.className = 'tmsg' + (err ? ' err' : ''); };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function el(tag, props, kids) {
    const e = document.createElement(tag);
    Object.assign(e, props || {});
    (kids || []).forEach(k => e.append(k));
    return e;
  }
  const button = (text, onclick, props) => el('button', Object.assign({ type: 'button', textContent: text, onclick }, props || {}));
  const stopTimer = () => { clearTimeout(timer); timer = null; };

  // ---- Pantalla de inicio ----
  async function intro() {
    stopTimer(); game = null; say('Cargando…'); body.replaceChildren();
    let s;
    try { s = await api('/api/trivia'); } catch (e) { return say(e.message || 'No se pudo cargar la trivia', true); }
    say('');
    if (!s.on) return body.replaceChildren(el('p', { className: 'tinfo', textContent: 'La trivia no está disponible ahora mismo.' }));
    const canPlay = s.active || s.gamesLeft > 0;
    body.replaceChildren(
      el('p', { className: 'tinfo', textContent: `Responde ${s.n} preguntas de geografía. Con ${s.pass} aciertos ganas ${nf(s.rewardPass)} ${word(s.rewardPass)}, y con los ${s.n} aciertos, ${nf(s.rewardPerfect)} ${word(s.rewardPerfect)}.` }),
      el('p', { className: 'tsmall', textContent: `Partidas que te quedan hoy: ${s.gamesLeft}/${s.gamesMax} · Créditos ganados hoy: ${nf(s.earned)}/${nf(s.dailyMax)}` }),
      button(s.active ? '▶ Continuar partida' : '▶ Jugar', startGame, { disabled: !canPlay, className: 'primary' }),
      !canPlay ? el('p', { className: 'tsmall', textContent: 'Hoy ya has jugado todas tus partidas. ¡Vuelve mañana!' }) : ''
    );
  }

  async function startGame() {
    if (busy) return; busy = true; say('Preparando…');
    try { const j = await api('/api/trivia/start', { method: 'POST', body: {} }); say(''); question(j.game); }
    catch (e) { say(e.message || 'No se pudo empezar', true); }
    finally { busy = false; }
  }

  // ---- Una pregunta ----
  function question(g) {
    game = g; stopTimer(); say('');
    const bar = el('i');
    const opts = el('div', { className: 'topts' });
    g.options.forEach((text, i) => opts.append(button(text, () => choose(i, opts))));
    body.replaceChildren(
      el('div', { className: 'thead' }, [el('span', { textContent: `Pregunta ${g.pos + 1}/${g.n}` }), el('span', { textContent: `✔ ${g.correct}` })]),
      el('div', { className: 'tbar' }, [bar]),
      el('p', { className: 'tq', textContent: g.q }),
      opts
    );
    bar.style.transition = `width ${g.seconds}s linear`;
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '0%'; }));
    timer = setTimeout(() => choose(-1, opts), g.seconds * 1000);   // sin tiempo: cuenta como fallo
  }

  async function choose(i, opts) {
    if (busy || !game) return; busy = true; stopTimer();
    const buttons = [...opts.children]; buttons.forEach(b => { b.disabled = true; });
    const bar = body.querySelector('.tbar i'); if (bar) { bar.style.transition = 'none'; }
    try {
      const j = await api('/api/trivia/answer', { method: 'POST', body: { game: game.id, choice: i } });
      if (buttons[j.correctIndex]) buttons[j.correctIndex].classList.add('ok');
      if (!j.right && buttons[i]) buttons[i].classList.add('bad');
      say(j.right ? '¡Correcto! 🎉' : (i === -1 ? '¡Se acabó el tiempo! ⏰' : 'Fallaste 😅'));
      try { sfx(j.right ? 'gift' : 'click'); } catch (x) {}
      await wait(1300);
      say('');
      if (j.done) result(j); else question(j.next);
    } catch (e) {
      say(e.message || 'Error al responder', true);
      body.append(button('Volver', intro));
    } finally { busy = false; }
  }

  // ---- Resultado ----
  function result(j) {
    game = null;
    if (typeof j.credits === 'number') { credits = j.credits; try { updateCreditUi(); } catch (e) {} }
    const won = j.reward > 0;
    const text = won
      ? `¡Has ganado ${nf(j.reward)} ${word(j.reward)}! 💰`
      : j.capped ? 'Hoy ya has llegado al máximo de créditos de la trivia. ¡Mañana más!' : `Necesitas 4 o más aciertos para ganar créditos. ¡Inténtalo otra vez!`;
    const share = async () => {
      const t = `🧠 He sacado ${j.correct}/${j.n} en la trivia de Redecora El Mundo 🌎 ¿Me superas? https://redecoraelmundo.com`;
      try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); say('Texto copiado 📋'); } } catch (e) { /* cancelado */ }
    };
    body.replaceChildren(
      el('div', { className: 'tbig', textContent: `${j.correct}/${j.n}` }),
      el('p', { className: 'tinfo', style: 'text-align:center', textContent: text }),
      el('div', { className: 'tact' }, [button('Jugar otra vez', intro), button('Compartir 📣', share)])
    );
    if (won) { try { sfx('gift'); } catch (e) {} }
  }

  function open() {
    if (!authToken) return openLogin('Entra con tu cuenta para jugar a la trivia 🧠');
    modal.classList.remove('hidden'); intro();
  }
  const close = () => { stopTimer(); modal.classList.add('hidden'); };
  btn.addEventListener('click', open);
  modal.querySelector('#trivia-close').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
})();
