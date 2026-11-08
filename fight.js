'use strict';
// Campeonato de luchas (botón 🥊 en Extras): cada terreno es una carta con nivel, poder y elemento (🔥 > 🌿 > 💧 > 🔥).
// Eliges tu carta, el servidor elige rival y decide el combate (/api/fight/start); aquí solo se dibuja y se anima.
// Hasta 3 luchas al día; cada victoria da 1 crédito. Clasificación mensual en /api/fight/rank.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), fmtNum().
(function () {
  const $ = id => document.getElementById(id);
  const btn = $('fight-btn');
  if (!btn) return;
  const fmt = n => (typeof fmtNum === 'function' ? fmtNum(n) : String(n));
  const EL = { fuego: ['🔥', '#e8590c'], planta: ['🌿', '#2f9e44'], agua: ['💧', '#1c7ed6'] };
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const st = document.createElement('style');
  st.textContent = `
    #fight .modal-card { max-height: 90vh; overflow-y: auto; text-align: center; }
    #fg-tabs { display: flex; gap: 6px; margin: 8px 0; }
    #fg-tabs button { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid #8884; background: transparent; font-weight: 700; cursor: pointer; color: inherit; }
    #fg-tabs button.on { background: #222; color: #fff; }
    .fg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; margin: 10px 0; max-height: 34vh; overflow-y: auto; padding: 2px; }
    .fg-card { position: relative; border: 3px solid var(--el, #888); border-radius: 12px; padding: 6px 4px; background: #8881; cursor: pointer; color: inherit; font: inherit; }
    .fg-card.sel { box-shadow: 0 0 0 3px #ffd43b; transform: translateY(-2px); }
    .fg-card img { width: 100%; height: 56px; object-fit: contain; display: block; }
    .fg-card b { display: block; font-size: 13px; }
    .fg-card small { display: block; opacity: .8; font-size: 11px; }
    .fg-el { position: absolute; top: 2px; right: 4px; font-size: 16px; }
    #fg-go { width: 100%; padding: 12px; font-size: 17px; font-weight: 800; border-radius: 12px; border: 0; background: #e63946; color: #fff; cursor: pointer; }
    #fg-go:disabled { background: #888; cursor: default; }
    #fg-arena { display: none; align-items: center; justify-content: space-around; gap: 6px; margin: 10px 0; }
    #fg-arena.show { display: flex; }
    #fg-arena .fg-card { width: 118px; cursor: default; }
    #fg-vs { font-size: 26px; font-weight: 900; }
    #fg-arena .fg-card.hit { animation: fgshake .5s ease-in-out 2; }
    #fg-arena .fg-card.lose { filter: grayscale(.8); opacity: .65; }
    #fg-arena .fg-card.win { box-shadow: 0 0 0 4px #ffd43b; }
    @keyframes fgshake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-9px) rotate(-3deg) } 75% { transform: translateX(9px) rotate(3deg) } }
    #fg-out { font-size: 20px; font-weight: 800; min-height: 1.4em; margin: 6px 0; }
    #fg-rank { width: 100%; border-collapse: collapse; margin-top: 8px; }
    #fg-rank td, #fg-rank th { padding: 6px 4px; border-bottom: 1px solid #8883; text-align: left; font-size: 14px; }
    #fg-rank tr.me { background: #ffd43b44; font-weight: 800; }
    @media (prefers-reduced-motion: reduce) { #fg-arena .fg-card.hit { animation: none; } }`;
  document.head.appendChild(st);

  const box = document.createElement('div');
  box.id = 'fight'; box.className = 'modal hidden';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'fg-title');
  box.innerHTML =
    '<div class="modal-card">' +
    '<button id="fg-close" class="close" type="button" aria-label="Cerrar">×</button>' +
    '<h2 id="fg-title">🥊 Campeonato</h2>' +
    '<p class="muted" id="fg-info">Cargando…</p>' +
    '<div id="fg-tabs"><button type="button" id="fg-t1" class="on">Luchar</button><button type="button" id="fg-t2">Clasificación</button></div>' +
    '<div id="fg-v1"><div id="fg-arena" aria-live="polite"></div><p id="fg-out" aria-live="polite"></p>' +
    '<p class="muted" id="fg-pick">Elige tu carta (tu terreno):</p><div class="fg-grid" id="fg-grid"></div>' +
    '<button id="fg-go" type="button" disabled>🥊 ¡Luchar!</button></div>' +
    '<div id="fg-v2" class="hidden"><p class="muted" id="fg-season"></p><div id="fg-ranklist"></div></div>' +
    '<p class="muted" style="font-size:12px;margin-top:10px">🔥 gana a 🌿 · 🌿 gana a 💧 · 💧 gana a 🔥. El rival lo elige el sistema (otro jugador de nivel parecido) y no pierde nada.</p>' +
    '</div>';
  document.body.appendChild(box);

  let state = null, selected = null, busy = false;

  function card(c, extra) {                                    // dibuja una carta; todo texto de jugadores va con textContent
    const el = document.createElement(extra && extra.tag || 'button');
    if (el.tagName === 'BUTTON') el.type = 'button';
    el.className = 'fg-card'; el.style.setProperty('--el', (EL[c.element] || EL.fuego)[1]);
    const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy';
    img.src = /^images\/[\w.-]+$/.test(c.house || '') ? c.house : 'images/casa-1.webp';
    const e = document.createElement('span'); e.className = 'fg-el'; e.textContent = (EL[c.element] || EL.fuego)[0];
    const b = document.createElement('b'); b.textContent = (extra && extra.title) || ('Nivel ' + c.level);
    const s = document.createElement('small'); s.textContent = '⚔️ ' + c.power + (extra && extra.sub ? ' · ' + extra.sub : '');
    el.append(e, img, b, s);
    return el;
  }

  function renderGrid() {
    const grid = $('fg-grid'); grid.textContent = '';
    for (const p of state.parcels) {
      const c = card(p); if (selected === p.id) c.classList.add('sel');
      c.addEventListener('click', () => { if (busy) return; selected = p.id; renderGrid(); refreshGo(); });
      grid.appendChild(c);
    }
    $('fg-pick').textContent = state.parcels.length ? 'Elige tu carta (tu terreno):' : 'Necesitas al menos un terreno para luchar.';
  }
  function refreshGo() {
    const g = $('fg-go');
    g.disabled = busy || !selected || state.left <= 0;
    g.textContent = state.left > 0 ? '🥊 ¡Luchar!' : '⏳ Vuelve mañana';
  }
  function renderInfo() {
    $('fg-info').textContent = `Luchas de hoy: ${state.used}/${state.max} · Cada victoria: +${state.prize} ${state.prize === 1 ? 'crédito' : 'créditos'} · Este mes: ${state.wins} ✅ ${state.losses} ❌`;
  }

  async function load() {
    $('fg-out').textContent = ''; $('fg-arena').className = ''; $('fg-arena').textContent = '';
    if (!authToken) { $('fg-info').textContent = 'Entra con tu cuenta para luchar.'; $('fg-grid').textContent = ''; $('fg-go').disabled = true; return; }
    $('fg-info').textContent = 'Cargando…';
    try {
      state = await api('/api/fight', { method: 'GET' });
      if (!state.on) { $('fg-info').textContent = 'El campeonato no está disponible ahora.'; return; }
      if (!state.parcels.some(p => p.id === selected)) selected = state.parcels[0] ? state.parcels[0].id : null;
      renderInfo(); renderGrid(); refreshGo();
    } catch (e) { $('fg-info').textContent = e.message; $('fg-go').disabled = true; }
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function go() {
    if (busy || !selected || !state || state.left <= 0) return;
    busy = true; refreshGo(); $('fg-out').textContent = '';
    let j;
    try { j = await api('/api/fight/start', { method: 'POST', body: { parcelId: selected } }); }
    catch (e) { busy = false; $('fg-out').textContent = e.message; await load(); return; }
    const arena = $('fg-arena'); arena.textContent = '';
    const mine = card(j.mine, { tag: 'div', title: 'Tú', sub: 'Nv ' + j.mine.level });
    const vs = document.createElement('div'); vs.id = 'fg-vs'; vs.textContent = 'VS';
    const foe = card(j.foe, { tag: 'div', title: j.foe.owner || 'Rival', sub: 'Nv ' + j.foe.level });
    arena.append(mine, vs, foe); arena.className = 'show';
    $('fg-out').textContent = `Probabilidad de ganar: ${j.chance} %`;
    mine.classList.add('hit'); foe.classList.add('hit');
    await wait(matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 1100);
    mine.classList.remove('hit'); foe.classList.remove('hit');
    (j.won ? mine : foe).classList.add('win'); (j.won ? foe : mine).classList.add('lose');
    $('fg-out').textContent = j.won ? `🏆 ¡Has ganado! +${j.prize} ${j.prize === 1 ? 'crédito' : 'créditos'}` : '💥 Has perdido. ¡Otra vez será!';
    credits = j.credits; updateCreditUi();
    Object.assign(state, { used: j.used, left: j.left, wins: j.wins, losses: j.losses });
    busy = false; renderInfo(); refreshGo();
  }

  async function loadRank() {
    const list = $('fg-ranklist'); list.textContent = 'Cargando…';
    try {
      const j = await api('/api/fight/rank', { method: 'GET' });
      if (!j.on) { list.textContent = 'El campeonato no está disponible ahora.'; return; }
      const [y, m] = j.month.split('-');
      $('fg-season').textContent = `Temporada de ${MONTHS[Number(m) - 1]} de ${y}. Ordena: más victorias y, a igualdad, menos derrotas.`;
      list.textContent = '';
      if (!j.top.length) { list.textContent = 'Todavía no ha luchado nadie este mes. ¡Sé el primero!'; return; }
      const t = document.createElement('table'); t.id = 'fg-rank';
      const hd = t.createTHead().insertRow(); ['#', 'Jugador', '✅', '❌'].forEach(h => { const th = document.createElement('th'); th.textContent = h; hd.appendChild(th); });
      const tb = t.createTBody();
      for (const r of j.top) {
        const tr = tb.insertRow(); if (r.me) tr.className = 'me';
        [r.pos === 1 ? '🥇' : r.pos === 2 ? '🥈' : r.pos === 3 ? '🥉' : String(r.pos), r.nick, String(r.wins), String(r.losses)].forEach(v => { tr.insertCell().textContent = v; });
      }
      list.appendChild(t);
      if (j.mine && !j.top.some(r => r.me)) { const p = document.createElement('p'); p.textContent = `Tu puesto: #${j.mine.pos} (${j.mine.wins} ✅ ${j.mine.losses} ❌)`; list.appendChild(p); }
    } catch (e) { list.textContent = e.message; }
  }

  function tab(n) {
    $('fg-v1').classList.toggle('hidden', n !== 1); $('fg-v2').classList.toggle('hidden', n !== 2);
    $('fg-t1').classList.toggle('on', n === 1); $('fg-t2').classList.toggle('on', n === 2);
    if (n === 2) loadRank();
  }
  $('fg-t1').onclick = () => tab(1);
  $('fg-t2').onclick = () => tab(2);
  $('fg-go').onclick = go;
  const close = () => { if (!busy) box.classList.add('hidden'); };
  $('fg-close').onclick = close;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) close(); });
  btn.addEventListener('click', () => {
    if (!authToken) { openLogin('Entra para luchar en el campeonato 🥊'); return; }
    box.classList.remove('hidden'); tab(1); load();
  });
})();
