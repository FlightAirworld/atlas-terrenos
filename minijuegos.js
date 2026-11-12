'use strict';
// JUEGOS NUEVOS (dentro de la carpeta 🎮 Juegos): 📅 Racha diaria, 📍 Adivina el lugar, ⚖️ ¿Más o menos?, 🗝️ Cofres del mapa y ⚔️ Duelos.
// El servidor decide y paga todo (minijuegos-server.js, rutas /api/mj/…); aquí solo se dibuja.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), sfx(), map, L.
(function () {
  const items = document.getElementById('games-items');
  if (!items) return;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  const word = n => (n === 1 ? 'crédito' : 'créditos');

  // ---- Botones dentro de la carpeta Juegos ----
  const GAMES = [
    ['racha-btn', '📅', 'Racha diaria', 'Racha diaria: entra cada día y gana más'],
    ['adivina-btn', '📍', 'Adivina el lugar', 'Adivina el lugar: 5 preguntas al día'],
    ['mm-btn', '⚖️', '¿Más o menos?', 'Qué ciudad tiene más habitantes'],
    ['cofres-btn', '🗝️', 'Cofres del mapa', 'Cofres escondidos en el mapa'],
    ['duelos-btn', '⚔️', 'Duelos', 'Reta a otro jugador'],
    ['slots-btn', '🎰', 'Tragaperras', 'Tragaperras: 1 crédito por tirada'],
    ['plinko-btn', '🔮', 'Plinko', 'Plinko: deja caer la bola'],
    ['moneda-btn', '🪙', 'Cara o cruz', 'Cara o cruz: doble o nada'],
    ['ruleta-btn', '🔢', 'Ruleta de números', 'Ruleta de números: color, par o impar, o un número'],
    ['minas-btn', '💣', 'Minas', 'Minas: destapa casillas y cobra cuando quieras']
  ];
  const btns = {};
  GAMES.forEach(([id, ico, label, title]) => {
    const b = document.createElement('button');
    b.id = id; b.type = 'button'; b.setAttribute('data-label', label); b.title = title; b.setAttribute('aria-label', title); b.textContent = ico;
    items.appendChild(b); btns[id] = b;
  });

  // ---- Estilos y ventana común ----
  const st = document.createElement('style');
  st.textContent = `
    #mj .modal-card { max-height: min(92vh, 720px); overflow-y: auto; }
    #mj .mj-info { font-size: 14px; margin: 0 0 10px; line-height: 1.5; }
    #mj .mj-small { font-size: 12px; color: var(--muted); margin: 8px 0 0; line-height: 1.6; }
    #mj .mj-big { font-size: 18px; font-weight: 800; text-align: center; margin: 12px 0 4px; }
    #mj .mj-msg { font-size: 13px; min-height: 18px; margin: 8px 0 0; }
    #mj .mj-msg.err { color: #e03131; }
    #mj .mj-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: 10px 0; }
    #mj .mj-day { text-align: center; border: 2px solid var(--line); border-radius: 10px; padding: 6px 0; font-size: 12px; }
    #mj .mj-day b { display: block; font-size: 16px; }
    #mj .mj-day.done { background: rgba(47, 158, 68, .22); border-color: #2f9e44; }
    #mj .mj-day.now { border-color: #f08c00; }
    #mj .mj-opts { display: grid; gap: 8px; margin-top: 12px; }
    #mj .mj-opts button, #mj .mj-act button { padding: 11px; font-weight: 700; border-radius: 10px; }
    #mj .mj-opts button.ok { background: rgba(47, 158, 68, .35); }
    #mj .mj-opts button.bad { background: rgba(224, 49, 49, .3); }
    #mj .mj-act { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    #mj .mj-act button { flex: 1; }
    #mj .mj-vs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
    #mj .mj-city { border: 2px solid var(--line); border-radius: 12px; padding: 12px 6px; text-align: center; font-weight: 800; }
    #mj .mj-city small { display: block; font-weight: 600; color: var(--muted); margin-top: 4px; }
    #mj .mj-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; margin: 6px 0; font-size: 14px; }
    #mj input[type=text], #mj select { width: 100%; padding: 10px; box-sizing: border-box; margin-top: 6px; }
    #mj .mj-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin: 8px 0; text-align: center; font-size: 13px; }
    #mj .mj-cal b { font-size: 11px; color: var(--muted); }
    #mj .mj-cal span { border: 1px solid var(--line); border-radius: 8px; padding: 6px 0; }
    #mj .mj-cal span.on { background: rgba(47, 158, 68, .3); border-color: #2f9e44; }
    #mj .mj-cal span.today { border: 2px solid #f08c00; font-weight: 800; }
    #mj .mj-cal span.empty { border: 0; }
    #mj .mj-reels { display: flex; gap: 8px; justify-content: center; margin: 12px 0; }
    #mj .mj-reel { width: 76px; height: 86px; font-size: 46px; display: flex; align-items: center; justify-content: center; border: 3px solid var(--line); border-radius: 14px; background: var(--card); }
    #mj .mj-reel.spin { filter: blur(1.5px); }
    #mj .mj-board { position: relative; height: 270px; margin: 10px 0 0; border: 2px solid var(--line); border-radius: 14px; overflow: hidden; }
    #mj .mj-peg { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--muted); }
    #mj .mj-ball { position: absolute; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: #e63946; box-shadow: 0 2px 4px rgba(0, 0, 0, .4); transition: left .24s linear, top .24s ease-in; }
    #mj .mj-buckets { position: absolute; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(9, 1fr); }
    #mj .mj-buckets span { text-align: center; font-size: 11px; font-weight: 800; padding: 6px 0; border-left: 1px solid var(--line); background: rgba(128, 128, 128, .12); }
    #mj .mj-buckets span.hit { background: #f08c00; color: #fff; }
    #mj .mj-coin { font-size: 64px; text-align: center; margin: 10px 0; transition: transform .6s; }
    @media (prefers-reduced-motion: reduce) { #mj .mj-ball { transition: none; } #mj .mj-coin { transition: none; } }
    #mj .mj-num { width: 110px; height: 110px; margin: 10px auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 46px; font-weight: 800; color: #fff; background: #2f9e44; border: 4px solid var(--line); }
    #mj .mj-num.rojo { background: #e03131; } #mj .mj-num.negro { background: #212529; }
    #mj .mj-mines { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 10px 0; }
    #mj .mj-mines button { aspect-ratio: 1; font-size: 26px; border-radius: 10px; padding: 0; }
    #mj .mj-mines button.safe { background: rgba(47, 158, 68, .35); }
    #mj .mj-mines button.bomb { background: rgba(224, 49, 49, .4); }
    .mj-chest { font-size: 34px; line-height: 44px; text-align: center; cursor: pointer; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, .5)); animation: mjbob 1.4s ease-in-out infinite; }
    @keyframes mjbob { 50% { transform: translateY(-5px); } }
    @media (prefers-reduced-motion: reduce) { .mj-chest { animation: none; } }
  `;
  document.head.appendChild(st);

  const modal = document.createElement('div');
  modal.id = 'mj'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'mj-title');
  modal.innerHTML = '<div class="modal-card"><button id="mj-close" class="close" type="button" aria-label="Cerrar">×</button><h2 id="mj-title"></h2><div id="mj-body"></div><p id="mj-msg" class="mj-msg" role="status"></p></div>';
  document.body.appendChild(modal);
  const title = modal.querySelector('#mj-title'), body = modal.querySelector('#mj-body'), msg = modal.querySelector('#mj-msg');
  const close = () => modal.classList.add('hidden');
  modal.querySelector('#mj-close').addEventListener('click', close);
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

  const say = (t, err) => { msg.textContent = t || ''; msg.className = 'mj-msg' + (err ? ' err' : ''); };
  const show = (t, html) => { title.textContent = t; body.innerHTML = html; say(''); };
  const act = (sel, fn) => { const el = body.querySelector(sel); if (el) el.addEventListener('click', fn); };
  function setCredits(c) { if (c != null && typeof credits !== 'undefined') { credits = c; if (typeof updateCreditUi === 'function') updateCreditUi(); } }
  const ding = n => { try { if (window.sfx) sfx(n); } catch (e) { /* sin sonido */ } };
  function toast(text) {
    if (window.giftToast) return window.giftToast(text, 6000);
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 6000);
  }
  function open(t, loginText, fn) {
    if (!authToken) return openLogin(loginText);
    title.textContent = t; body.innerHTML = '<p class="mj-info">Cargando…</p>'; say(''); modal.classList.remove('hidden');
    fn();
  }
  const fail = e => say((e && e.message) || 'Algo ha fallado. Inténtalo de nuevo', true);
  const post = (path, b) => api(path, { method: 'POST', body: b || {} });

  // ================= 📅 Racha diaria =================
  async function racha() {
    let s; try { s = await api('/api/mj/racha'); } catch (e) { return fail(e); }
    const cur = s.streak, next = s.claimedToday ? cur : cur + 1;   // día de la racha que toca (o el de hoy ya cobrado)
    const step = ((next - 1) % 7 + 7) % 7;
    const [Y, M] = s.today.split('-').map(Number), first = (new Date(Y, M - 1, 1).getDay() + 6) % 7, dim = new Date(Y, M, 0).getDate();
    const mes = new Date(Y, M - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<b>${d}</b>`).join('') + '<span class="empty"></span>'.repeat(first);
    for (let d = 1; d <= dim; d++) { const iso = s.today.slice(0, 8) + String(d).padStart(2, '0'); cells += `<span class="${s.month.includes(iso) ? 'on' : ''} ${iso === s.today ? 'today' : ''}">${s.month.includes(iso) ? '✅' : d}</span>`; }
    const days = s.rewards.map((r, i) => `<div class="mj-day ${s.claimedToday ? (i <= step ? 'done' : '') : (i < step ? 'done' : i === step ? 'now' : '')}">Día ${i + 1}<b>${i === 6 ? '🎁' : '🎟️'} ${r}</b></div>`).join('');
    show('📅 Racha diaria',
      `<p class="mj-info">Entra cada día y cobra. Cuantos más días seguidos, más créditos. El día 7 también llevas un sobre de cartas. Si fallas un día, vuelves al día 1.</p>
       <p class="mj-big">${cur ? '🔥 ' + cur + (cur === 1 ? ' día' : ' días') + ' seguidos' : 'Empieza hoy tu racha'}</p>
       <div class="mj-days">${days}</div>
       <p class="mj-small" style="text-align:center;text-transform:capitalize;margin:4px 0 0">${mes} · mejor racha: ${s.best}</p>
       <div class="mj-cal">${cells}</div>
       <div class="mj-act">${s.claimedToday ? '<button type="button" disabled>✅ Ya cobrado hoy</button>' : '<button type="button" id="mj-claim">Cobrar hoy</button>'}</div>`);
    act('#mj-claim', async e => {
      e.target.disabled = true;
      try {
        const r = await post('/api/mj/racha/claim'); setCredits(r.credits); ding('claim');
        const t = `🎉 Día ${r.streak}: +${r.prize} ${word(r.prize)}${r.pack ? ' y un sobre de cartas 🃏' : ''}`;
        await racha(); say(t);
      } catch (er) { e.target.disabled = false; fail(er); }
    });
  }

  // ================= 📍 Adivina el lugar =================
  function adivinaScreen(s) {
    body.dataset.busy = '';
    if (s.done) {
      return show('📍 Adivina el lugar',
        `<p class="mj-big">${s.score >= 5 ? '🏆' : '✅'} ${s.score} de 5 aciertos</p>
         <p class="mj-info" style="text-align:center">${s.paid ? 'Has ganado <b>' + s.paid + ' ' + word(s.paid) + '</b>' + (s.score === 5 ? ' y un sobre de cartas 🃏' : '') + '.' : 'Hoy no ha habido premio.'} Vuelve mañana con preguntas nuevas.</p>`);
    }
    if (!s.q || !Array.isArray(s.q.opts)) return adivina();   // respuesta incompleta: se pide el estado real al servidor
    show('📍 Adivina el lugar',
      `<p class="mj-small" style="margin:0">Pregunta ${s.i + 1} de 5 · 3 créditos si aciertas todas</p>
       <p class="mj-big" style="margin-top:8px">${esc(s.q.clue)}</p>
       <div class="mj-opts">${s.q.opts.map((o, i) => `<button type="button" data-a="${i}">${esc(o)}</button>`).join('')}</div>`);
    const opts = () => body.querySelectorAll('[data-a]');
    // Si algo falla (red lenta, el servidor ya contó la respuesta, etc.) se vuelve a pedir el estado real: así nunca queda bloqueado
    const resync = async text => {
      try { adivinaScreen(await api('/api/mj/adivina')); if (text) say(text, true); }
      catch (e2) { body.dataset.busy = ''; opts().forEach(x => (x.disabled = false)); fail(e2); }
    };
    opts().forEach(b => b.addEventListener('click', async () => {
      if (body.dataset.busy === '1') return; body.dataset.busy = '1';
      opts().forEach(x => (x.disabled = true));
      let r;
      try { r = await post('/api/mj/adivina/answer', { a: Number(b.dataset.a) }); }
      catch (e) { return resync((e && e.message) || 'Algo ha fallado. Inténtalo de nuevo'); }
      try {
        b.classList.add(r.correct ? 'ok' : 'bad');
        const right = body.querySelector(`[data-a="${r.right}"]`); if (!r.correct && right) right.classList.add('ok');
        ding(r.correct ? 'claim' : 'click'); if (r.credits != null) setCredits(r.credits);
      } catch (e) { /* un fallo de sonido o de créditos no debe bloquear el juego */ }
      const nx = document.createElement('div'); nx.className = 'mj-act';
      nx.innerHTML = `<button type="button">${r.done ? 'Ver resultado' : 'Siguiente'}</button>`; body.appendChild(nx);
      nx.firstChild.addEventListener('click', () => { nx.firstChild.disabled = true; try { adivinaScreen(r); } catch (e) { resync(); } });
    }));
  }
  async function adivina() { try { adivinaScreen(await api('/api/mj/adivina')); } catch (e) { fail(e); } }

  // ================= ⚖️ ¿Más o menos? =================
  function mmScreen(s, last) {
    if (!s.started) {
      return show('⚖️ ¿Más o menos?',
        `<p class="mj-info">Te enseño dos ciudades. ¿La segunda tiene <b>más</b> o <b>menos</b> habitantes que la primera? Sigues mientras aciertes. Una partida al día: cada 3 aciertos ganas 1 crédito (hasta 3), y con 8 seguidos también un sobre de cartas.</p>
         <div class="mj-act"><button type="button" id="mj-start">Empezar</button></div>`);
    }
    if (s.over) {
      return show('⚖️ ¿Más o menos?',
        `<p class="mj-big">Racha final: ${s.streak}</p>
         ${last ? `<p class="mj-info" style="text-align:center">${esc(s.a.name)}: ${nf(s.a.pop)} M · ${esc(s.b.name)}: ${nf(s.b.pop)} M</p>` : ''}
         <p class="mj-info" style="text-align:center">${last && last.prize ? 'Has ganado <b>' + last.prize + ' ' + word(last.prize) + '</b>' + (last.pack ? ' y un sobre de cartas 🃏' : '') + '. ' : ''}Vuelve mañana para otra partida.</p>
         <p class="mj-small">Población aproximada del área urbana, en millones.</p>`);
    }
    show('⚖️ ¿Más o menos?',
      `<p class="mj-small" style="margin:0">Racha: 🔥 ${s.streak}</p>
       <div class="mj-vs"><div class="mj-city">${esc(s.a.name)}<small>${nf(s.a.pop)} M hab.</small></div><div class="mj-city">${esc(s.b.name)}<small>¿?</small></div></div>
       <p class="mj-info" style="text-align:center">¿${esc(s.b.name)} tiene…?</p>
       <div class="mj-act"><button type="button" data-m="1">⬆️ Más</button><button type="button" data-m="0">⬇️ Menos</button></div>`);
    body.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', async () => {
      body.querySelectorAll('[data-m]').forEach(x => (x.disabled = true));
      try {
        const r = await post('/api/mj/mm/guess', { more: b.dataset.m === '1' });
        if (r.credits != null) setCredits(r.credits);
        ding(r.correct ? 'claim' : 'click');
        if (r.correct) { say('✅ ¡Correcto! ' + r.revealed.b[0] + ': ' + nf(r.revealed.b[1]) + ' M'); const m = msg.textContent; mmScreen(r); say(m); }
        else mmScreen(r, r);
      } catch (e) { fail(e); body.querySelectorAll('[data-m]').forEach(x => (x.disabled = false)); }
    }));
  }
  async function mm() {
    let s; try { s = await api('/api/mj/mm'); } catch (e) { return fail(e); }
    mmScreen(s, null);
    act('#mj-start', async () => { try { mmScreen(await post('/api/mj/mm/guess', {})); } catch (e) { fail(e); } });
  }

  // ================= 🗝️ Cofres del mapa =================
  let chestMarks = [];
  function drawChests(list) {
    chestMarks.forEach(m => { try { m.remove(); } catch (e) { /* ya quitado */ } }); chestMarks = [];
    list.filter(c => !c.taken).forEach(c => {
      const mk = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: '<div class="mj-chest" title="Cofre escondido">🗝️</div>', iconSize: [44, 44] }) }).addTo(map);
      mk.getElement().addEventListener('click', async ev => {
        ev.stopPropagation();
        if (!authToken) return openLogin('Entra con tu cuenta para abrir cofres 🗝️');
        try {
          const r = await post('/api/mj/cofres/claim', { id: c.id });
          setCredits(r.credits); ding('claim'); mk.remove(); chestMarks = chestMarks.filter(x => x !== mk);
          toast(`🗝️ ¡Cofre abierto! +${r.prize} ${word(r.prize)}`);
        } catch (e) { toast('🗝️ ' + (e.message || 'No se pudo abrir')); refreshChests(); }
      });
      chestMarks.push(mk);
    });
  }
  async function refreshChests() { try { drawChests((await api('/api/mj/cofres')).chests); } catch (e) { /* sin red */ } }
  async function cofres() {
    let s; try { s = await api('/api/mj/cofres'); } catch (e) { return fail(e); }
    const free = s.chests.filter(c => !c.taken), mine = s.chests.filter(c => c.mine).length;
    drawChests(s.chests);
    show('🗝️ Cofres del mapa',
      `<p class="mj-info">Cada día se esconden <b>6 cofres</b> en ciudades de todo el mundo, los mismos para todos. El primero que toca un cofre en el mapa se queda con los créditos (de 1 a 5). Puedes abrir hasta ${s.max} al día.</p>
       <p class="mj-big">${free.length ? '🗝️ ' + free.length + ' sin abrir' : 'Hoy ya no queda ninguno'}</p>
       <p class="mj-small" style="text-align:center">Los has abierto tú: ${mine} de ${s.max}</p>
       <div class="mj-act">${free.length ? '<button type="button" id="mj-go">Buscar un cofre</button>' : ''}</div>`);
    act('#mj-go', () => { const c = free[Math.floor(Math.random() * free.length)]; close(); map.flyTo({ lat: c.lat, lng: c.lng }, 4); });
  }

  // ================= ⚔️ Duelos =================
  async function duelos() {
    let s; try { s = await api('/api/mj/duelos'); } catch (e) { return fail(e); }
    const inc = s.incoming.map(d => `<div class="mj-row"><span>⚔️ <b>${esc(d.from)}</b> apuesta ${d.stake} 🎟️</span><span><button type="button" data-ok="${d.id}">Aceptar</button> <button type="button" data-no="${d.id}">No</button></span></div>`).join('');
    const out = s.outgoing.map(d => `<div class="mj-row"><span>⏳ Esperando a <b>${esc(d.to)}</b> (${d.stake} 🎟️)</span><button type="button" data-no="${d.id}">Cancelar</button></div>`).join('');
    const rec = s.recent.map(d => { const me = d.mineIsFrom ? d.from_roll : d.to_roll, ot = d.mineIsFrom ? d.to_roll : d.from_roll, rival = d.mineIsFrom ? d.to : d.from; return `<div class="mj-row"><span>${me > ot ? '🏆 Ganaste' : '😕 Perdiste'} contra <b>${esc(rival)}</b></span><span>${me} – ${ot} · ${d.stake} 🎟️</span></div>`; }).join('');
    show('⚔️ Duelos',
      `<p class="mj-info">Reta a otro jugador por su apodo. Cada uno pone la apuesta y el servidor tira los dados (1–100) cuando el rival acepta: el que saque más se lleva todo. No hace falta estar conectados a la vez. Si no contesta en 2 días, recuperas tu apuesta.</p>
       ${inc ? '<h3>Te han retado</h3>' + inc : ''}${out ? '<h3>Tus retos</h3>' + out : ''}
       <h3>Nuevo duelo</h3>
       <input type="text" id="mj-nick" placeholder="Apodo del rival" maxlength="40" autocomplete="off">
       <select id="mj-stake"><option value="1">Apuesta 1 crédito</option><option value="2">Apuesta 2 créditos</option><option value="3">Apuesta 3 créditos</option></select>
       <div class="mj-act"><button type="button" id="mj-send">Retar</button></div>
       ${rec ? '<h3>Últimos duelos</h3>' + rec : ''}`);
    act('#mj-send', async e => {
      e.target.disabled = true;
      try { const r = await post('/api/mj/duelos/reto', { nick: body.querySelector('#mj-nick').value, stake: Number(body.querySelector('#mj-stake').value) }); setCredits(r.credits); await duelos(); say('⚔️ Reto enviado. Te avisaremos en cuanto responda.'); }
      catch (er) { e.target.disabled = false; fail(er); }
    });
    body.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await post('/api/mj/duelos/aceptar', { id: Number(b.dataset.ok) }); setCredits(r.credits); ding(r.won ? 'claim' : 'click');
        const t = `${r.won ? '🏆 ¡Ganaste!' : '😕 Perdiste.'} Tú ${r.my_roll} – ${r.their_roll} rival · ${r.stake} ${word(r.stake)}`;
        await duelos(); say(t);
      } catch (e) { b.disabled = false; fail(e); }
    }));
    body.querySelectorAll('[data-no]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { const r = await post('/api/mj/duelos/rechazar', { id: Number(b.dataset.no) }); setCredits(r.credits); await duelos(); }
      catch (e) { b.disabled = false; fail(e); }
    }));
  }

  // ================= 🎰🔮🪙 Casino de créditos (tragaperras, plinko, cara o cruz) =================
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const SYMS = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
  const left = n => `<p class="mj-small" style="text-align:center">Tiradas que te quedan hoy: <b id="mj-left">${n}</b></p>`;
  const setLeft = n => { const e = body.querySelector('#mj-left'); if (e) e.textContent = n; };
  const resultLine = r => (r.win > 0 ? `🎉 +${r.win} ${word(r.win)}` + (r.net > 0 ? ` (ganas ${r.net})` : ' (recuperas parte)') : '😕 Esta vez no hubo premio');

  async function slots() {
    let s; try { s = await api('/api/mj/casino'); } catch (e) { return fail(e); }
    show('🎰 Tragaperras',
      `<p class="mj-info">Cada tirada cuesta <b>1 🎟️</b>. Tres iguales pagan: 🍒 5 · 🍋 6 · 🔔 10 · ⭐ 20 · 💎 50 · 7️⃣ 150. Dos 🍒 pagan 2. Solo juegas con créditos del juego, no con dinero.</p>
       <div class="mj-reels"><div class="mj-reel">🍒</div><div class="mj-reel">🍋</div><div class="mj-reel">🔔</div></div>
       <div class="mj-act"><button type="button" id="mj-go">🎰 Tirar (1 🎟️)</button></div>${left(s.left.slots)}`);
    const reels = [...body.querySelectorAll('.mj-reel')];
    act('#mj-go', async e => {
      e.target.disabled = true; say('');
      let r; const spin = setInterval(() => reels.forEach(el => { if (el.classList.contains('spin')) el.textContent = SYMS[Math.floor(Math.random() * SYMS.length)]; }), 70);
      reels.forEach(el => el.classList.add('spin'));
      try { [r] = await Promise.all([post('/api/mj/slots'), sleep(700)]); } catch (er) { clearInterval(spin); reels.forEach(el => el.classList.remove('spin')); e.target.disabled = false; return fail(er); }
      for (let i = 0; i < 3; i++) { await sleep(i ? 350 : 0); reels[i].classList.remove('spin'); reels[i].textContent = r.reels[i]; ding('click'); }
      clearInterval(spin); setCredits(r.credits); setLeft(r.left); say(resultLine(r)); if (r.win > 0) ding('claim');
      e.target.disabled = r.left <= 0;
    });
  }

  async function plinko() {
    let s; try { s = await api('/api/mj/casino'); } catch (e) { return fail(e); }
    const P = s.plinko, step = 100 / (P.rows + 1);
    let pegs = '';
    for (let k = 0; k < P.rows; k++) for (let j = 0; j <= k; j++) pegs += `<i class="mj-peg" style="left:${50 + (j - k / 2) * step}%;top:${(k + 1) * 28}px"></i>`;
    show('🔮 Plinko',
      `<p class="mj-info">Cada bola cuesta <b>${P.stake} 🎟️</b> y cae rebotando hasta un premio: en los lados pagan hasta ×${Math.max(...P.mult)} y en el centro menos de lo apostado.</p>
       <div class="mj-board">${pegs}<div class="mj-ball" id="mj-ball" style="left:50%;top:6px"></div>
         <div class="mj-buckets">${P.mult.map(m => `<span>×${m}</span>`).join('')}</div></div>
       <div class="mj-act"><button type="button" id="mj-go">🔮 Soltar bola (${P.stake} 🎟️)</button></div>${left(s.left.plinko)}`);
    const ball = body.querySelector('#mj-ball'), bks = [...body.querySelectorAll('.mj-buckets span')];
    act('#mj-go', async e => {
      e.target.disabled = true; say(''); bks.forEach(b => b.classList.remove('hit'));
      ball.style.transition = 'none'; ball.style.left = '50%'; ball.style.top = '6px'; void ball.offsetWidth; ball.style.transition = '';
      let r; try { r = await post('/api/mj/plinko'); } catch (er) { e.target.disabled = false; return fail(er); }
      let sRight = 0;
      for (let k = 1; k <= P.rows; k++) { sRight += r.path[k - 1]; await sleep(260); ball.style.left = (50 + (sRight - k / 2) * step) + '%'; ball.style.top = (k * 28 + 6) + 'px'; ding('click'); }
      await sleep(300); ball.style.top = '230px'; bks[r.slot].classList.add('hit');
      setCredits(r.credits); setLeft(r.left); say(resultLine(r)); if (r.win > r.stake) ding('claim');
      e.target.disabled = r.left <= 0;
    });
  }

  async function moneda() {
    let s; try { s = await api('/api/mj/casino'); } catch (e) { return fail(e); }
    show('🪙 Cara o cruz',
      `<p class="mj-info">Elige apuesta y lado. Si aciertas, cobras el <b>doble</b>; si no, pierdes lo apostado. (Probabilidad de acierto: 48 %.)</p>
       <div class="mj-coin" id="mj-coin">🪙</div>
       <select id="mj-st"><option value="1">Apuesta 1 crédito</option><option value="2">Apuesta 2 créditos</option><option value="3">Apuesta 3 créditos</option></select>
       <div class="mj-act"><button type="button" data-side="cara">😀 Cara</button><button type="button" data-side="cruz">✖️ Cruz</button></div>${left(s.left.moneda)}`);
    const coin = body.querySelector('#mj-coin'); let turns = 0;
    body.querySelectorAll('[data-side]').forEach(b => b.addEventListener('click', async () => {
      const bs = body.querySelectorAll('[data-side]'); bs.forEach(x => (x.disabled = true)); say('');
      turns += 4; coin.style.transform = `rotateY(${turns * 180}deg)`;
      let r; try { [r] = await Promise.all([post('/api/mj/moneda', { stake: Number(body.querySelector('#mj-st').value), side: b.dataset.side }), sleep(650)]); } catch (er) { bs.forEach(x => (x.disabled = false)); return fail(er); }
      coin.textContent = r.side === 'cara' ? '😀' : '✖️'; setCredits(r.credits); setLeft(r.left);
      say(`Ha salido ${r.side}. ` + (r.win ? `🎉 +${r.win} ${word(r.win)}` : '😕 Pierdes ' + r.stake)); if (r.win) ding('claim');
      bs.forEach(x => (x.disabled = r.left <= 0));
    }));
  }

  // ================= 🔢 Ruleta de números =================
  async function ruleta() {
    let s; try { s = await api('/api/mj/casino'); } catch (e) { return fail(e); }
    show('🔢 Ruleta de números',
      `<p class="mj-info">Ruleta europea (0–36). 🔴 Rojo, ⚫ Negro, Par o Impar pagan el <b>doble</b>; acertar un número exacto paga <b>×36</b>. El 0 gana la casa.</p>
       <div class="mj-num" id="mj-n">?</div>
       <select id="mj-st"><option value="1">Apuesta 1 crédito</option><option value="2">Apuesta 2 créditos</option><option value="3">Apuesta 3 créditos</option></select>
       <div class="mj-act"><button type="button" data-t="rojo">🔴 Rojo</button><button type="button" data-t="negro">⚫ Negro</button><button type="button" data-t="par">Par</button><button type="button" data-t="impar">Impar</button></div>
       <div class="mj-act"><input type="text" id="mj-pick" inputmode="numeric" maxlength="2" placeholder="Número 0–36" style="flex:1"><button type="button" data-t="num">A este número ×36</button></div>${left(s.left.ruleta)}`);
    const disc = body.querySelector('#mj-n'), all = [...body.querySelectorAll('[data-t]')];
    all.forEach(b => b.addEventListener('click', async () => {
      const bet = { type: b.dataset.t }; if (bet.type === 'num') { bet.n = Number(body.querySelector('#mj-pick').value); if (!Number.isInteger(bet.n) || bet.n < 0 || bet.n > 36) return say('Escribe un número del 0 al 36', true); }
      all.forEach(x => (x.disabled = true)); say(''); disc.className = 'mj-num';
      const spin = setInterval(() => { disc.textContent = Math.floor(Math.random() * 37); }, 70);
      let r; try { [r] = await Promise.all([post('/api/mj/ruleta', { stake: Number(body.querySelector('#mj-st').value), bet }), sleep(1200)]); } catch (er) { clearInterval(spin); all.forEach(x => (x.disabled = false)); return fail(er); }
      clearInterval(spin); disc.textContent = r.n; disc.className = 'mj-num ' + (r.color === 'verde' ? '' : r.color);
      setCredits(r.credits); setLeft(r.left); say(`Ha salido ${r.n} (${r.color}). ` + (r.win ? `🎉 +${r.win} ${word(r.win)}` : '😕 Pierdes ' + r.stake)); if (r.win) ding('claim');
      all.forEach(x => (x.disabled = r.left <= 0));
    }));
  }

  // ================= 💣 Minas =================
  function minasDraw(s) {
    const rev = new Set(s.revealed), bombs = new Set(s.bombs || []);
    const cells = Array.from({ length: 25 }, (_, i) => `<button type="button" data-i="${i}" class="${bombs.has(i) ? 'bomb' : rev.has(i) ? 'safe' : ''}" ${s.ended || rev.has(i) ? 'disabled' : ''}>${bombs.has(i) ? '💣' : rev.has(i) ? '💎' : ''}</button>`).join('');
    const pot = Math.floor(s.stake * s.mult);
    show('💣 Minas',
      `<p class="mj-info">25 casillas, <b>3 bombas</b>. Cada 💎 que destapas sube el premio; cobra cuando quieras, pero si pisas una bomba lo pierdes todo. Cada partida cuesta lo que apuestes (1–3 🎟️).</p>
       <p class="mj-big">${s.ended ? (s.win ? '💰 Cobras ' + s.win + ' ' + word(s.win) : '💥 ¡Bomba!') : 'Premio ahora: ' + pot + ' 🎟️ (×' + nf(s.mult) + ')'}</p>
       <div class="mj-mines">${cells}</div>
       <div class="mj-act">${s.ended ? '<button type="button" id="mj-new">Nueva partida</button>' : '<button type="button" id="mj-cash"' + (s.revealed.length ? '' : ' disabled') + '>💰 Cobrar ' + pot + ' 🎟️</button>'}</div>${left(s.left)}`);
    body.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', async () => {
      body.querySelectorAll('button').forEach(x => (x.disabled = true));
      try {
        const r = await post('/api/mj/minas/reveal', { i: Number(b.dataset.i) }); if (r.credits != null) setCredits(r.credits);
        if (r.ended) ding(r.win ? 'claim' : 'click'); else ding('click');
        minasDraw({ ...r, stake: r.stake || s.stake });
      } catch (e) { fail(e); minasDraw(s); }
    }));
    act('#mj-cash', async () => { try { const r = await post('/api/mj/minas/cash'); setCredits(r.credits); ding('claim'); minasDraw(r); } catch (e) { fail(e); } });
    act('#mj-new', () => minas());
  }
  async function minas() {
    let s; try { s = await api('/api/mj/minas'); } catch (e) { return fail(e); }
    if (s.active) return minasDraw(s);
    show('💣 Minas',
      `<p class="mj-info">25 casillas con <b>3 bombas</b>. Cada 💎 que destapas sube el premio y puedes cobrar cuando quieras; si pisas una bomba pierdes la apuesta.</p>
       <select id="mj-st"><option value="1">Apuesta 1 crédito</option><option value="2">Apuesta 2 créditos</option><option value="3">Apuesta 3 créditos</option></select>
       <div class="mj-act"><button type="button" id="mj-go">💣 Empezar</button></div>${left(s.left)}`);
    act('#mj-go', async e => {
      e.target.disabled = true;
      try { const r = await post('/api/mj/minas/start', { stake: Number(body.querySelector('#mj-st').value) }); setCredits(r.credits); minasDraw(r); } catch (er) { e.target.disabled = false; fail(er); }
    });
  }

  // ---- Conexión de los botones ----
  btns['racha-btn'].addEventListener('click', () => open('📅 Racha diaria', 'Entra con tu cuenta para cobrar tu racha 📅', racha));
  btns['adivina-btn'].addEventListener('click', () => open('📍 Adivina el lugar', 'Entra con tu cuenta para jugar 📍', adivina));
  btns['mm-btn'].addEventListener('click', () => open('⚖️ ¿Más o menos?', 'Entra con tu cuenta para jugar ⚖️', mm));
  btns['cofres-btn'].addEventListener('click', () => open('🗝️ Cofres del mapa', 'Entra con tu cuenta para buscar cofres 🗝️', cofres));
  btns['slots-btn'].addEventListener('click', () => open('🎰 Tragaperras', 'Entra con tu cuenta para jugar 🎰', slots));
  btns['plinko-btn'].addEventListener('click', () => open('🔮 Plinko', 'Entra con tu cuenta para jugar 🔮', plinko));
  btns['moneda-btn'].addEventListener('click', () => open('🪙 Cara o cruz', 'Entra con tu cuenta para jugar 🪙', moneda));
  btns['ruleta-btn'].addEventListener('click', () => open('🔢 Ruleta de números', 'Entra con tu cuenta para jugar 🔢', ruleta));
  btns['minas-btn'].addEventListener('click', () => open('💣 Minas', 'Entra con tu cuenta para jugar 💣', minas));
  btns['duelos-btn'].addEventListener('click', () => open('⚔️ Duelos', 'Entra con tu cuenta para retar a otros jugadores ⚔️', duelos));
})();
