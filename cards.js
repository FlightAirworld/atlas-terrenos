'use strict';
// CARTAS 🃏 (botón en Extras): sobres, "Ver Carta" y colección de la temporada (100 grupos de 100 cartas).
// El servidor decide qué carta sale (ver cards-server.js); aquí solo se dibuja y se anima. Las cartas se calculan con cards-core.js.
// Usa globals de app.js: authToken, openLogin(), api(), updateCreditUi(), sfx().
(function () {
  const btn = document.getElementById('cards-btn');
  if (!btn || !window.CardsCore) return;
  const C = window.CardsCore, $ = id => document.getElementById(id);
  const nf = n => Number(n).toLocaleString('es-ES');
  let S = null, group = 1, busy = false, T = [], pendingOffer = 0;

  const st = document.createElement('style');
  st.textContent = `
    #cards .modal-card { max-height: min(92vh, 780px); overflow-y: auto; text-align: center; }
    #cards h3 { margin: 14px 0 6px; font-size: 15px; }
    #cards .cmeta { font-size: 13px; margin: 0 0 6px; }
    #cards .crow { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin: 6px 0; }
    #cards .crow button { padding: 6px 10px; font-weight: 700; }
    #cards .env { width: 150px; height: 104px; margin: 12px auto; border-radius: 10px; position: relative; cursor: pointer; border: 2px solid rgba(0,0,0,.25);
      background: linear-gradient(135deg, var(--e1), var(--e2)); box-shadow: 0 6px 16px rgba(0,0,0,.3); display: flex; align-items: center; justify-content: center; font-size: 40px; }
    #cards .env::before { content: ''; position: absolute; inset: 0; border-radius: 8px; clip-path: polygon(0 0, 100% 0, 50% 58%); background: rgba(255,255,255,.28); }
    #cards .env.shake { animation: cshake .6s ease-in-out; }
    @keyframes cshake { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-7deg) } 40% { transform: rotate(7deg) } 60% { transform: rotate(-5deg) } 80% { transform: rotate(5deg) } }
    #cards .seebtn { font-size: 18px; padding: 10px 22px; font-weight: 800; }
    #cards .card { width: 210px; margin: 8px auto; border-radius: 14px; padding: 8px; position: relative; overflow: hidden; color: #1b1b1b; text-align: left;
      background: linear-gradient(145deg, var(--c1), var(--c2) 55%, var(--c1)); box-shadow: 0 8px 22px rgba(0,0,0,.35); border: 3px solid var(--c1); }
    #cards .card.oro { border-color: #fff3b0; box-shadow: 0 0 22px 4px rgba(255,214,70,.75), 0 8px 22px rgba(0,0,0,.4); }
    #cards .card.oro::after, #cards .card.legendaria::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.7) 50%, transparent 65%);
      background-size: 250% 100%; animation: cshine 2.6s linear infinite; pointer-events: none; }
    @keyframes cshine { from { background-position: 150% 0 } to { background-position: -100% 0 } }
    #cards .card.flip { animation: cflip .8s ease-out; }
    @keyframes cflip { from { transform: rotateY(90deg) scale(.8); opacity: 0 } to { transform: none; opacity: 1 } }
    #cards .ctop { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 13px; }
    #cards .cart { background: rgba(255,255,255,.55); border-radius: 10px; height: 104px; display: flex; align-items: center; justify-content: center; font-size: 62px; margin: 6px 0; }
    #cards .cname { font-weight: 800; font-size: 15px; text-align: center; }
    #cards .crar { font-size: 11px; text-align: center; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 4px; }
    #cards .cstats { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 8px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,.55); border-radius: 8px; padding: 5px 8px; }
    #cards .cfoot { display: flex; justify-content: space-between; font-size: 11px; margin-top: 5px; font-weight: 700; }
    #cards .grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; margin: 8px 0; }
    #cards .slot { aspect-ratio: 1; border-radius: 5px; font-size: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--line); color: var(--muted); font-size: 9px; }
    #cards .slot.have { cursor: pointer; font-size: 17px; border: 2px solid var(--c1); background: var(--c2); color: #1b1b1b; }
    #cards .slot.taken { background: rgba(0,0,0,.15); }
    #cards select { padding: 6px; max-width: 100%; }
    #cards .msg { min-height: 1.2em; }
    #cards .ms { font-size: 12px; margin: 4px 0; }
    #cards .tform { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; align-items: center; margin: 6px 0; }
    #cards .tform input { width: 110px; padding: 6px; }
    #cards .trow { border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px; margin: 6px 0; font-size: 13px; }
    #cards .trow .crow { margin: 4px 0 0; }
    @media (max-width: 480px) { #cards .grid { grid-template-columns: repeat(5, 1fr); } #cards .slot { font-size: 19px; } }
  `;
  document.head.appendChild(st);

  const modal = document.createElement('div');
  modal.id = 'cards'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'cards-title');
  modal.innerHTML = '<div class="modal-card"><button id="cards-close" class="close" type="button" aria-label="Cerrar">×</button>' +
    '<h2 id="cards-title">🃏 Cartas</h2><p id="cards-meta" class="cmeta muted"></p><p id="cards-msg" class="msg" aria-live="polite"></p>' +
    '<div id="cards-stage"></div><div id="cards-shop"></div><div id="cards-trades"></div><h3>📚 Mi colección</h3><div id="cards-sel" class="crow"></div><div id="cards-grid" class="grid"></div><div id="cards-view"></div></div>';
  document.body.appendChild(modal);
  const say = (t, kind = '') => { const m = $('cards-msg'); m.textContent = t || ''; m.className = 'msg ' + kind; };

  function cardEl(info, flip) {   // dibuja una carta (todo con textContent: nada se interpreta como HTML)
    const d = document.createElement('div');
    d.className = 'card ' + info.rarity + (flip ? ' flip' : '');
    d.style.setProperty('--c1', info.c1); d.style.setProperty('--c2', info.c2);
    const add = (cls, text, parent) => { const e = document.createElement('div'); e.className = cls; e.textContent = text; (parent || d).appendChild(e); return e; };
    const top = add('ctop', '', d); const a = document.createElement('span'); a.textContent = info.element + ' ' + info.elementName; const b = document.createElement('span'); b.textContent = '⚡ ' + info.poder; top.append(a, b);
    add('cart', info.emoji); add('cname', info.name); add('crar', (info.gold ? '👑 ' : '') + info.rarityName);
    const stats = add('cstats', '');
    [['💪 Fuerza', info.fuerza], ['🛡️ Defensa', info.defensa], ['💨 Velocidad', info.velocidad], ['🍀 Suerte', info.suerte]].forEach(([k, v]) => { const s = document.createElement('span'); s.textContent = k + ' ' + v; stats.appendChild(s); });
    const foot = add('cfoot', '', d); const f1 = document.createElement('span'); f1.textContent = 'Nº ' + info.serial; const f2 = document.createElement('span'); f2.textContent = 'Grupo ' + info.group; foot.append(f1, f2);
    return d;
  }

  function showCard(id, into, flip) {
    const el = into || $('cards-view'); el.replaceChildren(cardEl(C.cardInfo(id, S ? S.season : 'T1'), flip));
    if (S && !into) { const b = document.createElement('button'); b.type = 'button'; b.textContent = '🔁 Ofrecer esta carta'; b.onclick = () => { pendingOffer = id; tradesUi(); $('cards-trades').scrollIntoView({ behavior: 'smooth' }); }; el.appendChild(b); }
  }

  const ENV = { bronce: ['#b87333', '#e6a86a'], plata: ['#9aa5b1', '#e5e9ee'], oro: ['#d4a017', '#ffe27a'] };
  function stage() {   // sobres pendientes
    const el = $('cards-stage'); el.replaceChildren();
    if (!S.packs.length) return;
    const p = S.packs[0];
    const h = document.createElement('h3'); h.textContent = '✉️ Tienes ' + S.packs.length + (S.packs.length === 1 ? ' sobre' : ' sobres') + ' sin abrir'; el.appendChild(h);
    const env = document.createElement('div'); env.className = 'env'; env.id = 'cards-env'; env.textContent = '🃏'; env.tabIndex = 0; env.setAttribute('role', 'button');
    env.setAttribute('aria-label', 'Abrir sobre de ' + p.kind);
    const col = ENV[p.kind] || ENV.bronce; env.style.setProperty('--e1', col[0]); env.style.setProperty('--e2', col[1]);
    const lab = document.createElement('div'); lab.className = 'cmeta'; lab.textContent = (S.shop[p.kind] || {}).name || 'Sobre';
    const go = document.createElement('button'); go.className = 'primary'; go.type = 'button'; go.textContent = '✉️ Abrir sobre';
    el.append(lab, env, go);
    const doOpen = () => openPack(p, env, go);
    env.onclick = doOpen; env.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doOpen(); } }; go.onclick = doOpen;
  }

  async function openPack(p, env, go) {
    if (busy) return; busy = true; say('');
    try {
      env.classList.add('shake'); try { sfx('gift'); } catch (e) {}
      const r = await api('/api/cards/open', { method: 'POST', body: { packId: p.id } });
      await new Promise(res => setTimeout(res, 650));
      // El sobre se queda abierto con el botón "Ver Carta"; la carta no se enseña hasta que lo pulsa
      const stg = $('cards-stage'); stg.replaceChildren();
      const e2 = document.createElement('div'); e2.className = 'env'; e2.textContent = '✨'; const col = ENV[p.kind] || ENV.bronce; e2.style.setProperty('--e1', col[0]); e2.style.setProperty('--e2', col[1]);
      const see = document.createElement('button'); see.className = 'primary seebtn'; see.type = 'button'; see.textContent = '👁️ Ver Carta';
      stg.append(e2, see);
      see.onclick = () => {
        const info = C.cardInfo(r.cardId, r.season);
        const wrap = document.createElement('div'); wrap.appendChild(cardEl(info, true));
        const t = document.createElement('p'); t.className = 'cmeta'; t.textContent = info.gold ? '👑 ¡LEGENDARIA DE ORO! Solo existe una igual en todo el juego.' : '¡Nueva carta para tu colección! Es única: nadie más la tiene.';
        const more = document.createElement('button'); more.type = 'button'; more.className = 'primary'; more.textContent = r.packsLeft ? '✉️ Siguiente sobre (' + r.packsLeft + ')' : 'Seguir';
        more.onclick = () => load();
        const extra = (r.rewards || []).map(w => { const p = document.createElement('p'); p.className = 'cmeta'; p.textContent = '🎉 ¡Premio de grupo! ' + w.n + ' cartas del grupo ' + w.group + ': sobre de ' + w.kind + (w.credits ? ' + ' + nf(w.credits) + ' 🎟️' : ''); return p; });
        stg.replaceChildren(wrap, t, ...extra, more);
        try { sfx(info.gold ? 'coin' : 'gift'); } catch (e) {}
      };
      group = C.groupOf(r.cardId);
    } catch (e) { say(e.message, 'err'); env.classList.remove('shake'); } finally { busy = false; }
  }

  function shop() {
    const el = $('cards-shop'); el.replaceChildren();
    const h = document.createElement('h3'); h.textContent = '🛒 Conseguir sobres'; el.appendChild(h);
    const row = document.createElement('div'); row.className = 'crow'; el.appendChild(row);
    const d = document.createElement('button'); d.type = 'button'; d.textContent = S.dailyReady ? '🎁 Sobre gratis de hoy' : '🎁 Ya recogido hoy'; d.disabled = !S.dailyReady;
    d.onclick = () => act('/api/cards/daily'); row.appendChild(d);
    Object.entries(S.shop).forEach(([k, v]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = v.name + ' · ' + nf(v.cost) + ' 🎟️'; b.onclick = () => act('/api/cards/buy', { kind: k }); row.appendChild(b); });
    const tip = document.createElement('p'); tip.className = 'cmeta muted'; tip.textContent = 'Ganas sobres con el regalo diario y con el campeonato 🥊 (uno cada 3 victorias del mes). Cuanto mejor el sobre, más probable es una carta legendaria.'; el.appendChild(tip);
  }
  async function act(url, body) {
    if (busy) return; busy = true; say('');
    try { const r = await api(url, { method: 'POST', body }); S = r; if (r.credits !== undefined) { try { refreshCredits(); } catch (e) {} } render(); }
    catch (e) { say(e.message, 'err'); } finally { busy = false; }
  }

  function collection() {
    const sel = $('cards-sel'); sel.replaceChildren();
    const own = new Map(S.owned.map(o => [o.id, o]));
    const per = new Array(C.GROUPS + 1).fill(0); S.owned.forEach(o => per[C.groupOf(o.id)]++);
    const s = document.createElement('select'); s.setAttribute('aria-label', 'Grupo de cartas');
    for (let g = 1; g <= C.GROUPS; g++) { const o = document.createElement('option'); o.value = g; o.textContent = 'Grupo ' + g + ' · ' + per[g] + '/100'; if (g === group) o.selected = true; s.appendChild(o); }
    s.onchange = () => { group = Number(s.value); collection(); };
    sel.appendChild(s);
    const ms = document.createElement('div'); ms.className = 'ms muted';
    ms.textContent = 'Premios del grupo: ' + (S.milestones || []).map(m => (S.claims.includes('g' + group + ':' + m.n) ? '✅' : (per[group] >= m.n ? '🎁' : '🔒')) + ' ' + m.n + ' cartas → sobre de ' + m.kind + (m.credits ? ' + ' + nf(m.credits) + ' 🎟️' : '')).join(' · ');
    sel.appendChild(ms);
    const grid = $('cards-grid'); grid.replaceChildren();
    const base = (group - 1) * C.GROUP;
    for (let i = 1; i <= C.GROUP; i++) {
      const id = base + i, e = document.createElement('div'); e.className = 'slot';
      if (own.has(id)) { const info = C.cardInfo(id, S.season); e.classList.add('have'); e.style.setProperty('--c1', info.c1); e.style.setProperty('--c2', info.c2); e.textContent = info.emoji; e.title = info.name; e.onclick = () => showCard(id, null, true); }
      else e.textContent = id;
      grid.appendChild(e);
    }
  }

  function tradesUi() {
    const el = $('cards-trades'); el.replaceChildren();
    const h = document.createElement('h3'); h.textContent = '🔁 Intercambios' + (S.tradesIn ? ' · ' + S.tradesIn + ' para ti' : ''); el.appendChild(h);
    const f = document.createElement('div'); f.className = 'tform';
    const nick = document.createElement('input'); nick.placeholder = 'Apodo'; nick.maxLength = 30; nick.autocapitalize = 'off';
    const off = document.createElement('select'); off.setAttribute('aria-label', 'Tu carta');
    S.owned.forEach(o => { const i = C.cardInfo(o.id, S.season), op = document.createElement('option'); op.value = o.id; op.textContent = 'Doy: ' + i.emoji + ' ' + i.name + ' Nº ' + o.id; if (o.id === pendingOffer) op.selected = true; off.appendChild(op); });
    const want = document.createElement('input'); want.type = 'number'; want.min = 1; want.max = S.total; want.placeholder = 'Nº que quiero'; want.inputMode = 'numeric';
    const go = document.createElement('button'); go.type = 'button'; go.className = 'primary'; go.textContent = 'Enviar oferta';
    go.onclick = async () => {
      if (busy) return; busy = true; say('');
      try { await api('/api/cards/trade', { method: 'POST', body: { nick: nick.value, offer: Number(off.value), want: want.value ? Number(want.value) : 0 } }); say(want.value ? 'Oferta enviada 👍' : 'Regalo enviado 👍 (si lo aceptan, la carta será suya)'); pendingOffer = 0; await loadTrades(); }
      catch (e) { say(e.message, 'err'); } finally { busy = false; }
    };
    if (!S.owned.length) { const p = document.createElement('p'); p.className = 'cmeta muted'; p.textContent = 'Cuando tengas cartas podrás cambiarlas por las de otros jugadores. Deja «Nº que quiero» vacío para regalarla.'; el.appendChild(p); }
    else { f.append(nick, off, want, go); el.appendChild(f); const t = document.createElement('p'); t.className = 'cmeta muted'; t.textContent = 'Deja «Nº que quiero» vacío para regalar la carta. Necesitas una cuenta con 24 h.'; el.appendChild(t); }
    T.forEach(x => {
      const r = document.createElement('div'); r.className = 'trow';
      const oi = C.cardInfo(x.offer, S.season), wi = x.want ? C.cardInfo(x.want, S.season) : null;
      const txt = document.createElement('div');
      txt.textContent = (x.dir === 'in' ? x.from + ' te ofrece ' : 'Ofreces a ' + x.to + ': ') + oi.emoji + ' ' + oi.name + ' (Nº ' + x.offer + ', ' + oi.rarityName + ')' + (wi ? ' a cambio de ' + wi.emoji + ' ' + wi.name + ' (Nº ' + x.want + ')' : ' como regalo');
      const row = document.createElement('div'); row.className = 'crow';
      const mk = (label, action) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => answerTrade(x.id, action); row.appendChild(b); };
      if (x.dir === 'in') { mk('✅ Aceptar', 'accept'); mk('❌ Rechazar', 'reject'); } else mk('Cancelar oferta', 'cancel');
      r.append(txt, row); el.appendChild(r);
    });
  }
  async function loadTrades() { try { T = (await api('/api/cards/trades')).trades || []; } catch (e) { T = []; } tradesUi(); }
  async function answerTrade(id, action) {
    if (busy) return; busy = true; say('');
    try {
      const r = await api('/api/cards/trade/answer', { method: 'POST', body: { id, action } }); S = r;
      say(action === 'accept' ? '¡Intercambio hecho! 🎉' + ((r.rewards || []).length ? ' Premio de grupo conseguido 🎁' : '') : action === 'reject' ? 'Oferta rechazada' : 'Oferta cancelada');
      render(); await loadTrades();
    } catch (e) { say(e.message, 'err'); } finally { busy = false; }
  }

  function render() {
    $('cards-meta').textContent = S.seasonName + ' · Tienes ' + S.owned.length + ' · Ya repartidas en el juego: ' + nf(S.minted) + ' de ' + nf(S.total);
    stage(); shop(); collection(); tradesUi();
  }
  async function load() {
    try { S = await api('/api/cards'); if (!S.on) { say('Las cartas están desactivadas', 'err'); return; } say(''); $('cards-view').replaceChildren(); render(); loadTrades(); }
    catch (e) { say(e.message, 'err'); }
  }
  btn.addEventListener('click', () => {
    if (typeof authToken !== 'undefined' && !authToken) { openLogin(); return; }
    modal.classList.remove('hidden'); load();
  });
  $('cards-close').onclick = () => modal.classList.add('hidden');
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
})();
