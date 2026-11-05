'use strict';
// REGALAR CRÉDITOS (botón 💝 en Extras): un jugador manda créditos a otro escribiendo su apodo.
// También se abre desde el chat (tocar un apodo → "Regalar créditos") y desde la lista de amigos: window.openGift('Apodo').
// El servidor decide todo (ver giftSend / giftsGet en server.js). Aquí solo se dibuja, se envía y se avisa al que recibe.
// Usa globals de app.js: authToken, credits, updateCreditUi(), refreshCredits(), openLogin(), api(), myNick, sfx().
(function () {
  const btn = document.getElementById('gift-btn');
  if (!btn) return;
  const $ = id => document.getElementById(id);
  const nf = n => Number(n).toLocaleString('es-ES');
  const word = n => (n === 1 ? 'crédito' : 'créditos');

  // ---- Aviso emergente (el mismo #toast del resto de la app) ----
  function toast(text, ms) {
    let t = $('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms || 6000);
    try { sfx('gift'); } catch (e) {}
  }
  window.giftToast = toast;   // lo usa app.js para avisar de la paga mensual del dueño

  const st = document.createElement('style');
  st.textContent = `
    #gift .modal-card { max-height: min(90vh, 720px); overflow-y: auto; }
    #gift .gsum { margin: 0 0 6px; font-size: 14px; }
    #gift .gnote { font-size: 12px; margin: 0 0 8px; }
    #gift .gquick { display: flex; gap: 6px; flex-wrap: wrap; margin: -2px 0 10px; }
    #gift .gquick button { padding: 4px 10px; font-weight: 700; }
    #gift .gtabs { display: flex; gap: 6px; margin: 14px 0 6px; }
    #gift .gtabs button { flex: 1; padding: 6px; font-weight: 700; }
    #gift .gtabs button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
    #gift .glist { border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; max-height: 190px; overflow-y: auto; }
    #gift .grow { padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
    #gift .grow:last-child { border-bottom: 0; }
    #gift .grow b { font-variant-numeric: tabular-nums; }
    #gift .grow small { display: block; color: var(--muted); }
    #gift .grow.in b { color: var(--accent); }
  `;
  document.head.appendChild(st);

  // ---- Ventana ----
  const modal = document.createElement('div');
  modal.id = 'gift'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'gift-title');
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button id="gift-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="gift-title">💝 Regalar créditos</h2>' +
      '<p id="gift-sum" class="gsum"></p>' +
      '<p id="gift-limits" class="gnote muted"></p>' +
      '<form id="gift-form" autocomplete="off">' +
        '<label for="gift-nick">Apodo del jugador</label>' +
        '<input id="gift-nick" type="text" maxlength="30" list="gift-friends" placeholder="Su apodo exacto" autocapitalize="off" spellcheck="false">' +
        '<datalist id="gift-friends"></datalist>' +
        '<label for="gift-amount">Cuántos créditos</label>' +
        '<input id="gift-amount" type="number" min="1" step="1" inputmode="numeric" placeholder="Ej.: 10">' +
        '<div class="gquick" id="gift-quick"></div>' +
        '<label for="gift-note">Mensaje (opcional)</label>' +
        '<input id="gift-note" type="text" maxlength="80" placeholder="¡Para que mejores tu terreno!">' +
        '<button id="gift-send" class="primary" type="submit">💝 Enviar regalo</button>' +
      '</form>' +
      '<p id="gift-msg" class="msg" aria-live="polite"></p>' +
      '<div class="gtabs"><button id="gift-tab-in" type="button" class="on">📥 Recibidos</button><button id="gift-tab-out" type="button">📤 Enviados</button></div>' +
      '<div id="gift-list" class="glist"></div>' +
    '</div>';
  document.body.appendChild(modal);

  const sum = $('gift-sum'), lim = $('gift-limits'), msgEl = $('gift-msg'), nick = $('gift-nick'), amount = $('gift-amount'), note = $('gift-note');
  const send = $('gift-send'), listEl = $('gift-list'), tabIn = $('gift-tab-in'), tabOut = $('gift-tab-out');
  const say = (t, kind = '') => { msgEl.textContent = t; msgEl.className = 'msg ' + kind; };

  let data = null, tab = 'in', busy = false;

  const when = ms => { try { return new Date(Number(ms)).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  function row(cls, title, g) {
    const r = document.createElement('div'); r.className = 'grow ' + cls;
    const b = document.createElement('b'); b.textContent = title;
    const s = document.createElement('small'); s.textContent = when(g.created_at) + (g.note ? ' · «' + g.note + '»' : '');   // textContent: el apodo y el mensaje nunca se interpretan como HTML
    r.append(b, s); return r;
  }
  function renderList() {
    tabIn.classList.toggle('on', tab === 'in'); tabOut.classList.toggle('on', tab === 'out');
    listEl.replaceChildren();
    const items = data ? (tab === 'in' ? data.received : data.sent) : [];
    if (!items.length) {
      const p = document.createElement('p'); p.className = 'muted'; p.style.margin = '6px 0';
      p.textContent = tab === 'in' ? 'Aún no has recibido regalos.' : 'Aún no has enviado ningún regalo.';
      listEl.append(p); return;
    }
    items.forEach(g => listEl.append(tab === 'in'
      ? row('in', `+${nf(g.credits)} ${word(g.credits)} de ${g.from_nick}`, g)
      : row('out', `−${nf(g.credits)} ${word(g.credits)} para ${g.to_nick}`, g)));
  }
  function renderTop() {
    const c = data ? data.credits : credits;
    sum.textContent = `🎟️ Tienes ${nf(c)} ${word(c)}.`;
    const l = data && data.limits;
    if (!l) { lim.textContent = ''; return; }
    if (!l.on) lim.textContent = 'Los regalos están desactivados ahora mismo.';
    else if (data.owner) lim.textContent = '👑 Sin límites para ti.';
    else lim.textContent = `Máximo ${nf(l.max)} por regalo y ${nf(l.daily)} cada 24 h (hoy llevas ${nf(l.sentToday)}).` + (l.minAgeHours ? ` La cuenta debe tener al menos ${l.minAgeHours} h.` : '');
    send.disabled = !l.on;
  }
  async function load() {
    try {
      data = await api('/api/gifts');
      renderTop(); renderList();
      if (data.unseen) { api('/api/gifts/seen', { method: 'POST', body: {} }).catch(() => {}); }
    } catch (e) { say(e.message, 'err'); }
    try {   // sugerencias: tus amigos
      const f = (await api('/api/friends')).friends || [];
      $('gift-friends').replaceChildren(...f.map(x => { const o = document.createElement('option'); o.value = x.nick; return o; }));
    } catch (e) {}
  }
  function quick() {
    const q = $('gift-quick'); q.replaceChildren();
    const max = data && data.limits && data.limits.max;
    [1, 5, 10, 50, 100].filter(n => !max || n <= max).forEach(n => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = nf(n);
      b.onclick = () => { amount.value = n; };
      q.append(b);
    });
  }

  function open(toNick) {
    if (!authToken) return openLogin('Entra con tu cuenta para regalar créditos 💝');
    if (!myNick) return openLogin('Elige tu apodo para poder regalar créditos 👤');
    say(''); modal.classList.remove('hidden');
    if (typeof toNick === 'string' && toNick) { nick.value = toNick; setTimeout(() => amount.focus(), 50); }
    else setTimeout(() => nick.focus(), 50);
    quick(); load().then(quick);
  }
  window.openGift = open;
  const close = () => modal.classList.add('hidden');
  btn.addEventListener('click', () => open());
  $('gift-close').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  tabIn.onclick = () => { tab = 'in'; renderList(); };
  tabOut.onclick = () => { tab = 'out'; renderList(); };

  $('gift-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const to = nick.value.trim(), n = Math.floor(Number(amount.value));
    if (!to) return say('Escribe el apodo del jugador', 'err');
    if (!Number.isFinite(n) || n < 1) return say('Indica cuántos créditos quieres regalar', 'err');
    if (!confirm(`¿Regalar ${nf(n)} ${word(n)} a ${to}? No se pueden recuperar.`)) return;
    busy = true; send.disabled = true; say('Enviando…');
    try {
      const j = await api('/api/gifts/send', { method: 'POST', body: { nick: to, credits: n, note: note.value.trim() } });
      credits = j.credits; updateCreditUi();
      say(`💝 ¡Enviado! ${j.to} ha recibido ${nf(j.amount)} ${word(j.amount)}. Te quedan ${nf(j.credits)}.`, 'ok');
      try { sfx('gift'); } catch (x) {}
      amount.value = ''; note.value = ''; tab = 'out';
      await load();
    } catch (err) { say(err.message, 'err'); }
    finally { busy = false; send.disabled = !!(data && data.limits && !data.limits.on); }
  });

  // ---- Avisar al que recibe: cada minuto (y al entrar) mira si hay regalos sin ver ----
  async function poll() {
    if (!authToken || document.hidden || !modal.classList.contains('hidden')) return;
    try {
      const j = await api('/api/gifts?brief=1');
      if (!j.unseen) return;
      const first = j.fresh[0];
      const text = j.unseen === 1
        ? `💝 ${first.from_nick} te ha regalado ${nf(first.credits)} ${word(first.credits)}` + (first.note ? ` — «${first.note}»` : '')
        : `💝 Has recibido ${j.unseen} regalos (último de ${first.from_nick}: ${nf(first.credits)} ${word(first.credits)})`;
      toast(text, 8000);
      api('/api/gifts/seen', { method: 'POST', body: {} }).then(() => { try { refreshCredits(); } catch (e) {} }).catch(() => {});
    } catch (e) { /* sin conexión: se reintenta */ }
  }
  (window.apiReady || Promise.resolve()).then(() => { setTimeout(poll, 4000); setInterval(poll, 60000); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(poll, 500); });
})();
