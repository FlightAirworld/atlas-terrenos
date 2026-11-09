'use strict';
// CARTAS 🃏 (botón en Extras): sobres, "Ver Carta" y colección de la temporada (100 grupos de 100 cartas).
// El servidor decide qué carta sale (ver cards-server.js); aquí solo se dibuja y se anima. Las cartas se calculan con cards-core.js.
// Pantallas: inicio (sobres, intercambios, colección), 🏆 ranking de jugadores por país (ver sus cartas y ofrecer comprarlas) y 🖤 puja mensual de la Carta Negra.
// Usa globals de app.js: authToken, openLogin(), api(), updateCreditUi(), refreshCredits(), flagOf(), countryName(), sfx().
(function () {
  const btn = document.getElementById('cards-btn');
  if (!btn || !window.CardsCore) return;
  const C = window.CardsCore, $ = id => document.getElementById(id);
  const nf = n => Number(n).toLocaleString('es-ES');
  let S = null, group = 1, busy = false, T = [], pendingOffer = 0, view = 'home', prefill = null, tradeMsg = null, aucTimer = null;
  const flag = c => { try { return flagOf(c) || ''; } catch (e) { return ''; } };
  const ctryName = c => { try { return countryName(c); } catch (e) { return c; } };

  const st = document.createElement('style');
  st.textContent = `
    :is(#cards, .cardsroot) .modal-card { max-height: min(92vh, 780px); overflow-y: auto; text-align: center; }
    #cards h3 { margin: 14px 0 6px; font-size: 15px; }
    :is(#cards, .cardsroot) .cmeta { font-size: 13px; margin: 0 0 6px; }
    :is(#cards, .cardsroot) .crow { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin: 6px 0; }
    :is(#cards, .cardsroot) .crow button { padding: 6px 10px; font-weight: 700; }
    :is(#cards, .cardsroot) .env { width: 150px; height: 104px; margin: 12px auto; border-radius: 10px; position: relative; cursor: pointer; border: 2px solid rgba(0,0,0,.25);
      background: linear-gradient(135deg, var(--e1), var(--e2)); box-shadow: 0 6px 16px rgba(0,0,0,.3); display: flex; align-items: center; justify-content: center; font-size: 40px; }
    :is(#cards, .cardsroot) .env::before { content: ''; position: absolute; inset: 0; border-radius: 8px; clip-path: polygon(0 0, 100% 0, 50% 58%); background: rgba(255,255,255,.28); }
    :is(#cards, .cardsroot) .env.shake { animation: cshake .6s ease-in-out; }
    @keyframes cshake { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-7deg) } 40% { transform: rotate(7deg) } 60% { transform: rotate(-5deg) } 80% { transform: rotate(5deg) } }
    :is(#cards, .cardsroot) .seebtn { font-size: 18px; padding: 10px 22px; font-weight: 800; }
    :is(#cards, .cardsroot) .card { width: 210px; margin: 8px auto; border-radius: 14px; padding: 8px; position: relative; overflow: hidden; color: #1b1b1b; text-align: left;
      background: linear-gradient(145deg, var(--c1), var(--c2) 55%, var(--c1)); box-shadow: 0 8px 22px rgba(0,0,0,.35); border: 3px solid var(--c1); }
    :is(#cards, .cardsroot) .card.oro { border-color: #fff3b0; box-shadow: 0 0 22px 4px rgba(255,214,70,.75), 0 8px 22px rgba(0,0,0,.4); }
    :is(#cards, .cardsroot) .card.oro::after, #cards .card.legendaria::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.7) 50%, transparent 65%);
      background-size: 250% 100%; animation: cshine 2.6s linear infinite; pointer-events: none; }
    @keyframes cshine { from { background-position: 150% 0 } to { background-position: -100% 0 } }
    :is(#cards, .cardsroot) .card.flip { animation: cflip .8s ease-out; }
    @keyframes cflip { from { transform: rotateY(90deg) scale(.8); opacity: 0 } to { transform: none; opacity: 1 } }
    :is(#cards, .cardsroot) .ctop { display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 13px; }
    :is(#cards, .cardsroot) .cart { background: rgba(255,255,255,.55); border-radius: 10px; height: 104px; display: flex; align-items: center; justify-content: center; font-size: 62px; margin: 6px 0; }
    :is(#cards, .cardsroot) .cname { font-weight: 800; font-size: 15px; text-align: center; }
    :is(#cards, .cardsroot) .crar { font-size: 11px; text-align: center; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 4px; }
    :is(#cards, .cardsroot) .cstats { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 8px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,.55); border-radius: 8px; padding: 5px 8px; }
    :is(#cards, .cardsroot) .cfoot { display: flex; justify-content: space-between; font-size: 11px; margin-top: 5px; font-weight: 700; }
    :is(#cards, .cardsroot) .grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; margin: 8px 0; }
    :is(#cards, .cardsroot) .slot { aspect-ratio: 1; border-radius: 5px; font-size: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--line); color: var(--muted); font-size: 9px; }
    :is(#cards, .cardsroot) .slot.have { cursor: pointer; font-size: 17px; border: 2px solid var(--c1); background: var(--c2); color: #1b1b1b; }
    :is(#cards, .cardsroot) .slot.taken { background: rgba(0,0,0,.15); }
    #cards select { padding: 6px; max-width: 100%; }
    :is(#cards, .cardsroot) .msg { min-height: 1.2em; }
    :is(#cards, .cardsroot) .ms { font-size: 12px; margin: 4px 0; }
    :is(#cards, .cardsroot) .tform { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; align-items: center; margin: 6px 0; }
    :is(#cards, .cardsroot) .tform input { width: 128px; padding: 6px; }
    :is(#cards, .cardsroot) .trow { border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px; margin: 6px 0; font-size: 13px; }
    :is(#cards, .cardsroot) .trow .crow { margin: 4px 0 0; }
    @media (max-width: 480px) { #cards .grid { grid-template-columns: repeat(5, 1fr); } #cards .slot { font-size: 19px; } }
    /* Cabecera fija: el botón Volver atrás y los avisos (errores / «Oferta enviada») se ven siempre, aunque estés abajo del todo */
    #cards-head { position: sticky; top: -20px; z-index: 6; background: var(--bg); margin: -20px -24px 8px; padding: 12px 24px 4px; border-radius: 14px 14px 0 0; }
    :is(#cards, .cardsroot) .chbar { display: flex; align-items: center; padding-right: 34px; }
    :is(#cards, .cardsroot) .cback { font-weight: 800; padding: 6px 12px; }
    #cards #cards-msg { margin: 6px 0 0; font-weight: 600; }
    #cards #cards-msg:not(:empty) { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 88%, var(--accent)); }
    :is(#cards, .cardsroot) .cnav { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
    :is(#cards, .cardsroot) .cnav button { flex: 1 1 150px; font-weight: 800; padding: 10px 8px; }
    :is(#cards, .cardsroot) .cnav button.blk, #cards button.blk { background: #0a0a0a; color: #ffd54a; border-color: #d4a017; }
    :is(#cards, .cardsroot) .news { text-align: left; border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; margin: 8px 0; font-size: 13px; }
    :is(#cards, .cardsroot) .news div { padding: 3px 0; } #cards .news div.new { font-weight: 700; } #cards .news div.new::before { content: '🔴 '; }
    :is(#cards, .cardsroot) .tmsg { font-size: 13px; margin: 4px 0; }
    /* Carta Negra: fondo negro y letras doradas */
    :is(#cards, .cardsroot) .card.negra { background: radial-gradient(circle at 30% 18%, #2b2410, #000 62%); color: #ffd54a; border-color: #d4a017;
      box-shadow: 0 0 22px 4px rgba(212,160,23,.6), 0 8px 22px rgba(0,0,0,.6); }
    :is(#cards, .cardsroot) .card.negra .ctop, #cards .card.negra .cname, #cards .card.negra .crar, #cards .card.negra .cfoot { color: #ffd54a; text-shadow: 0 0 6px rgba(255,200,40,.45); }
    :is(#cards, .cardsroot) .card.negra .cart { background: rgba(255,213,74,.08); border: 1px solid rgba(255,213,74,.4); }
    :is(#cards, .cardsroot) .card.negra .cstats { background: rgba(255,213,74,.08); border: 1px solid rgba(255,213,74,.35); color: #ffd54a; }
    :is(#cards, .cardsroot) .card.negra::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 38%, rgba(255,213,74,.35) 50%, transparent 62%);
      background-size: 250% 100%; animation: cshine 3.2s linear infinite; pointer-events: none; }
    /* Ranking */
    :is(#cards, .cardsroot) .rc { display: flex; justify-content: space-between; align-items: baseline; font-weight: 800; margin: 16px 0 4px; text-align: left; font-size: 15px; }
    :is(#cards, .cardsroot) .rc small { font-weight: 600; color: var(--muted); }
    :is(#cards, .cardsroot) .rp { display: flex; width: 100%; justify-content: space-between; gap: 8px; text-align: left; padding: 8px 10px; margin: 3px 0; font-weight: 700; }
    :is(#cards, .cardsroot) .rp.me { border-color: var(--accent); }
    :is(#cards, .cardsroot) .rp .n { font-variant-numeric: tabular-nums; white-space: nowrap; }
    :is(#cards, .cardsroot) .rpanel { border: 1px solid var(--line); border-radius: 10px; padding: 8px; margin: 2px 0 8px; }
    :is(#cards, .cardsroot) .mini { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin: 6px 0; }
    :is(#cards, .cardsroot) .mini button { width: 42px; height: 50px; padding: 0; border-radius: 6px; border: 2px solid var(--c1); background: var(--c2); color: #1b1b1b; font-size: 21px; line-height: 1.05; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    :is(#cards, .cardsroot) .mini button small { font-size: 9px; font-weight: 700; }
    :is(#cards, .cardsroot) .mini button.sel { outline: 3px solid var(--accent); }
    :is(#cards, .cardsroot) .mini button.blk { background: #0a0a0a; color: #ffd54a; border-color: #d4a017; }
    :is(#cards, .cardsroot) .rpanel h4 { margin: 10px 0 2px; font-size: 13px; }
    /* Subasta */
    :is(#cards, .cardsroot) .count { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; margin: 4px 0; }
    :is(#cards, .cardsroot) .hist { text-align: left; font-size: 13px; border: 1px solid var(--line); border-radius: 10px; padding: 4px 10px; }
    :is(#cards, .cardsroot) .hist div { padding: 4px 0; border-bottom: 1px solid var(--line); } #cards .hist div:last-child { border-bottom: 0; }
    #cards-dot { position: absolute; top: 1px; right: 1px; width: 13px; height: 13px; border-radius: 50%; background: #e63946; border: 2px solid #fff; animation: dailypulse 1.4s infinite; }
    #cards-dot.hidden { display: none; }
    .mp-ic #cards-dot { top: -3px !important; right: -3px !important; }
    @media (prefers-reduced-motion: reduce) { #cards-dot, #cards .card.negra::after { animation: none; } }
  
    #cards button.cgo { background: #16a34a; color: #fff; border: 2px solid #0b7a35; font-weight: 800; animation: cblinkg 1s ease-in-out infinite; }
    #cards button.cgo:disabled { animation: none; background: var(--bg); color: var(--muted); border: 1px solid var(--line); font-weight: 400; }
    #cards button.cblue { background: #1d6fe8; color: #fff; border: 2px solid #0d4fb0; font-weight: 800; animation: cblinkb 1s ease-in-out infinite; }
    #cards h3.cbuy { color: #1d6fe8; animation: cblinktxt 1s ease-in-out infinite; }
    @keyframes cblinkg { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); filter: brightness(1); } 50% { box-shadow: 0 0 16px 5px rgba(22,163,74,.85); filter: brightness(1.3); } }
    @keyframes cblinkb { 0%,100% { box-shadow: 0 0 0 0 rgba(29,111,232,0); filter: brightness(1); } 50% { box-shadow: 0 0 16px 5px rgba(29,111,232,.85); filter: brightness(1.3); } }
    @keyframes cblinktxt { 50% { opacity: .35; } }
    @media (prefers-reduced-motion: reduce) { #cards button.cgo, #cards button.cblue, #cards h3.cbuy { animation: none; } }
    #cards .slot.newc { animation: cnew 1.1s ease-in-out 6; position: relative; z-index: 2; }
    @keyframes cnew { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,214,70,0); } 50% { transform: scale(1.45); box-shadow: 0 0 16px 6px rgba(255,214,70,.95); } }
    #cards #cards-view .card, #cards #cards-black .card { cursor: zoom-in; }
`;
  document.head.appendChild(st);

  const modal = document.createElement('div');
  modal.id = 'cards'; modal.className = 'modal hidden cardsroot';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'cards-title');
  modal.innerHTML = '<div class="modal-card"><div id="cards-head"><div class="chbar"><button id="cards-back" class="cback" type="button">← Volver atrás</button></div>' +
    '<button id="cards-close" class="close" type="button" aria-label="Cerrar">×</button><p id="cards-msg" class="msg" role="status" aria-live="polite"></p></div>' +
    '<h2 id="cards-title">🃏 Cartas</h2><p id="cards-meta" class="cmeta muted"></p>' +
    '<div id="cards-home"><div class="cnav"><button id="cards-go-rank" type="button">🏆 Ranking de jugadores</button><button id="cards-go-auc" class="blk" type="button">🖤 Carta Negra · puja</button></div><div id="cards-news"></div>' +
    '<div id="cards-stage"></div><div id="cards-shop"></div><div id="cards-trades"></div><h3>📚 Mi colección</h3><div id="cards-sel" class="crow"></div><div id="cards-grid" class="grid"></div><div id="cards-view"></div>' +
    '<div id="cards-black"></div></div><div id="cards-rank" class="hidden"></div><div id="cards-auc" class="hidden"></div></div>';
  document.body.appendChild(modal);
  const say = (t, kind = '') => { const m = $('cards-msg'); m.textContent = t || ''; m.className = 'msg ' + kind; };

  function cardEl(info, flip) {   // dibuja una carta (todo con textContent: nada se interpreta como HTML)
    const d = document.createElement('div');
    d.className = 'card ' + info.rarity + (flip ? ' flip' : '');   // la Carta Negra usa la clase «negra»
    d.style.setProperty('--c1', info.c1); d.style.setProperty('--c2', info.c2);
    const add = (cls, text, parent) => { const e = document.createElement('div'); e.className = cls; e.textContent = text; (parent || d).appendChild(e); return e; };
    const top = add('ctop', '', d); const a = document.createElement('span'); a.textContent = info.element + ' ' + info.elementName; const b = document.createElement('span'); b.textContent = '⚡ ' + info.poder; top.append(a, b);
    add('cart', info.emoji); add('cname', info.name); add('crar', (info.special ? '🖤 ' : info.gold ? '👑 ' : '') + info.rarityName);
    const stats = add('cstats', '');
    [['💪 Fuerza', info.fuerza], ['🛡️ Defensa', info.defensa], ['💨 Velocidad', info.velocidad], ['🍀 Suerte', info.suerte]]
      .concat(info.special ? [['😎 Carisma', info.carisma], ['⚡ Poder', info.poder]] : []).forEach(([k, v]) => { const s = document.createElement('span'); s.textContent = k + ' ' + v; stats.appendChild(s); });
    const foot = add('cfoot', '', d); const f1 = document.createElement('span'); f1.textContent = info.special ? 'ÚNICA' : 'Nº ' + info.serial; const f2 = document.createElement('span'); f2.textContent = info.special ? info.month : 'Grupo ' + info.group; foot.append(f1, f2);
    return d;
  }

  const shareBtn = id => { const b = document.createElement('button'); b.type = 'button'; b.textContent = '📤 Compartir'; b.onclick = () => { if (window.CardsShare) window.CardsShare.open(id); }; return b; };   // cards-share.js
  function zoomEl(el, from, glow) { if (window.CardsCine) window.CardsCine.zoom(el, from && from.getBoundingClientRect ? from.getBoundingClientRect() : null, { glow }); }
  function zoomCard(id, from) { const info = C.cardInfo(id, S ? S.season : 'T1'); zoomEl(cardEl(info, false), from, info.c2); }

  function showCard(id, into, flip) {
    const el = into || $('cards-view'); const ce = cardEl(C.cardInfo(id, S ? S.season : 'T1'), flip); ce.onclick = () => zoomCard(id, ce); el.replaceChildren(ce);
    if (S && !into) { const b = document.createElement('button'); b.type = 'button'; b.textContent = '🔁 Ofrecer esta carta'; b.onclick = () => { pendingOffer = id; tradesUi(); $('cards-trades').scrollIntoView({ behavior: 'smooth' }); }; el.appendChild(b); }
    if (!into) el.appendChild(shareBtn(id));
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
    const doOpen = () => (window.CardsCine ? openCine(p) : openPack(p, env, go));
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

  // Abre un sobre con la escena del cartero: el servidor ofrece 3 cartas, el jugador elige una y esa es la que se queda
  async function openCine(p) {
    if (busy) return; busy = true; say('');
    let res = null;
    try {
      res = await window.CardsCine.courier({
        kind: p.kind, packId: p.id,
        getOffer: () => api('/api/cards/offer', { method: 'POST', body: { packId: p.id } }),
        pick: id => api('/api/cards/pick', { method: 'POST', body: { packId: p.id, cardId: id } }),
        info: (id, season) => C.cardInfo(id, season), cardEl: info => cardEl(info, false)
      });
    } catch (e) { res = { error: e.message }; } finally { busy = false; }
    if (res && res.cardId) group = C.groupOf(res.cardId);
    await load();   // vuelves a la pantalla de cartas…
    if (res && res.error) { say(res.error, 'err'); return; }
    if (!res || !res.cardId) return;
    const slot = document.querySelector('#cards-grid .slot[data-id="' + res.cardId + '"]');   // …y la carta aparece donde le toca, brillando
    if (slot) { slot.classList.add('newc'); try { slot.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} setTimeout(() => slot.classList.remove('newc'), 7000); }
    const extra = (res.rewards || []).map(w => '🎉 ¡Premio de grupo! ' + w.n + ' cartas del grupo ' + w.group + ': sobre de ' + w.kind + (w.credits ? ' + ' + nf(w.credits) + ' 🎟️' : '')).join(' · ');
    const info = C.cardInfo(res.cardId, res.season); say('¡' + info.name + ' (Nº ' + res.cardId + ') ya está en tu colección!' + (extra ? ' ' + extra : ''), 'ok');
  }

  function shop() {
    const el = $('cards-shop'); el.replaceChildren();
    const h = document.createElement('h3'); h.textContent = '🛒 Conseguir sobres'; el.appendChild(h);
    const row = document.createElement('div'); row.className = 'crow'; el.appendChild(row);
    const d = document.createElement('button'); d.type = 'button'; d.textContent = S.dailyReady ? '🎁 Sobre gratis de hoy' : '🎁 Ya recogido hoy'; d.disabled = !S.dailyReady;
    d.onclick = () => act('/api/cards/daily'); if (S.dailyReady) d.className = 'cgo'; row.appendChild(d);   // verde y parpadeando mientras haya sobre gratis
    const bh = document.createElement('h3'); bh.className = 'cbuy'; bh.textContent = '💳 Comprar con créditos'; el.appendChild(bh);   // azul y parpadeando, debajo del sobre gratis
    const row2 = document.createElement('div'); row2.className = 'crow'; el.appendChild(row2);
    Object.entries(S.shop).forEach(([k, v]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'cblue'; b.textContent = v.name + ' · ' + nf(v.cost) + ' 🎟️'; b.onclick = () => act('/api/cards/buy', { kind: k }); row2.appendChild(b); });
    const tip = document.createElement('p'); tip.className = 'cmeta muted'; tip.textContent = 'Ganas sobres con el regalo diario y con el campeonato 🥊 (uno cada 3 victorias del mes). Cuanto mejor el sobre, más probable es una carta legendaria.'; el.appendChild(tip);
  }
  async function act(url, body) {
    if (busy) return; busy = true; say(''); let bought = null;
    try {
      const before = new Set((S.packs || []).map(x => x.id));
      const r = await api(url, { method: 'POST', body }); S = r; setDaily(S.dailyReady); if (r.credits !== undefined) { try { refreshCredits(); } catch (e) {} } render();
      if (url === '/api/cards/buy' && window.CardsCine) bought = (r.packs || []).filter(x => !before.has(x.id)).pop() || null;   // el sobre recién comprado
    }
    catch (e) { say(e.message, 'err'); } finally { busy = false; }
    if (bought) openCine(bought);   // ¡llega el cartero!
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
      if (own.has(id)) { const info = C.cardInfo(id, S.season); e.classList.add('have'); e.style.setProperty('--c1', info.c1); e.style.setProperty('--c2', info.c2); e.textContent = info.emoji; e.title = info.name; e.dataset.id = id; e.onclick = () => { showCard(id, null, false); zoomCard(id, e); }; }
      else { e.textContent = id; e.dataset.id = id; }
      grid.appendChild(e);
    }
  }

  // Mensaje junto al formulario de ofertas (se conserva aunque la lista se vuelva a dibujar)
  const tsay = (text, kind = '') => { tradeMsg = text ? { text, kind } : null; const m = document.querySelector('#cards-trades .tmsg'); if (m) { m.textContent = text || ''; m.className = 'tmsg msg ' + kind; } say(text, kind); };
  const toastMsg = t => { try { if (window.giftToast) window.giftToast(t, 8000); } catch (e) {} };
  const money = n => nf(n) + ' 🎟️';
  function describe(x) {   // texto de una oferta abierta (intercambio, regalo o compra con créditos)
    const oi = x.offer ? C.cardInfo(x.offer, S.season) : null, wi = x.want ? C.cardInfo(x.want, S.season) : null;
    const c = (i, n) => i.emoji + ' ' + i.name + ' (Nº ' + n + ')';
    if (x.price) return x.dir === 'in' ? x.from + ' quiere comprarte ' + (wi ? c(wi, x.want) : 'una carta') + ' por ' + money(x.price) : 'Ofreces ' + money(x.price) + ' a ' + x.to + ' por ' + (wi ? c(wi, x.want) : 'una carta');
    return (x.dir === 'in' ? x.from + ' te ofrece ' : 'Ofreces a ' + x.to + ': ') + (oi ? c(oi, x.offer) + ', ' + oi.rarityName : '?') + (wi ? ' a cambio de ' + c(wi, x.want) : ' como regalo');
  }

  function tradesUi() {
    const el = $('cards-trades'); el.replaceChildren();
    const h = document.createElement('h3'); h.textContent = '🔁 Intercambios' + (S.tradesIn ? ' · ' + S.tradesIn + ' para ti' : ''); el.appendChild(h);
    const f = document.createElement('div'); f.className = 'tform';
    const nick = document.createElement('input'); nick.placeholder = 'Apodo'; nick.maxLength = 30; nick.autocapitalize = 'off'; nick.setAttribute('aria-label', 'Apodo del jugador');
    const off = document.createElement('select'); off.setAttribute('aria-label', 'Tu carta');
    S.owned.forEach(o => { const i = C.cardInfo(o.id, S.season), op = document.createElement('option'); op.value = o.id; op.textContent = 'Doy: ' + i.emoji + ' ' + i.name + ' Nº ' + o.id; if (o.id === pendingOffer) op.selected = true; off.appendChild(op); });
    const want = document.createElement('input'); want.type = 'number'; want.min = 1; want.max = S.total; want.placeholder = 'Nº que quiero'; want.inputMode = 'numeric'; want.setAttribute('aria-label', 'Número de carta que quieres');
    if (prefill) { nick.value = prefill.nick; want.value = prefill.want; prefill = null; }
    const go = document.createElement('button'); go.type = 'button'; go.className = 'primary'; go.textContent = 'Enviar oferta';
    go.onclick = async () => {
      if (busy) return;
      if (!nick.value.trim()) { tsay('Escribe el apodo del jugador', 'err'); nick.focus(); return; }
      busy = true; tsay('Enviando…');
      try {
        await api('/api/cards/trade', { method: 'POST', body: { nick: nick.value, offer: Number(off.value), want: want.value ? Number(want.value) : 0 } });
        tsay(want.value ? 'Oferta enviada a ' + nick.value.trim() + ' 👍 Te avisaremos cuando conteste.' : 'Regalo enviado a ' + nick.value.trim() + ' 👍 (si lo aceptan, la carta será suya)', 'ok'); pendingOffer = 0; await loadTrades();
      } catch (e) { tsay(e.message, 'err'); } finally { busy = false; }
    };
    if (!S.owned.length) { const p = document.createElement('p'); p.className = 'cmeta muted'; p.textContent = 'Cuando tengas cartas podrás cambiarlas por las de otros jugadores. Deja «Nº que quiero» vacío para regalarla.'; el.appendChild(p); }
    else { f.append(nick, off, want, go); el.appendChild(f); const t = document.createElement('p'); t.className = 'cmeta muted'; t.textContent = 'Deja «Nº que quiero» vacío para regalar la carta. Necesitas una cuenta con 24 h.'; el.appendChild(t); }
    const how = document.createElement('p'); how.className = 'cmeta';
    const hb = document.createElement('button'); hb.type = 'button'; hb.textContent = '🏆 ¿Qué cartas tienen los demás? Ver ranking'; hb.onclick = () => go2('rank'); how.appendChild(hb); el.appendChild(how);
    const tm = document.createElement('p'); tm.className = 'tmsg msg' + (tradeMsg && tradeMsg.kind ? ' ' + tradeMsg.kind : ''); tm.setAttribute('role', 'status'); tm.textContent = tradeMsg ? tradeMsg.text : ''; el.appendChild(tm);
    T.forEach(x => {
      const r = document.createElement('div'); r.className = 'trow';
      const txt = document.createElement('div'); txt.textContent = describe(x);
      const row = document.createElement('div'); row.className = 'crow';
      const mk = (label, action) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = () => answerTrade(x, action); row.appendChild(b); };
      if (x.dir === 'in') { mk(x.price ? '✅ Vender' : '✅ Aceptar', 'accept'); mk('❌ Rechazar', 'reject'); } else mk('Cancelar oferta', 'cancel');
      r.append(txt, row); el.appendChild(r);
    });
  }
  async function loadTrades() { try { T = (await api('/api/cards/trades')).trades || []; } catch (e) { T = []; } tradesUi(); }
  async function answerTrade(x, action) {
    if (busy) return;
    if (action === 'accept' && x.price && !confirm('¿Vender ' + (x.want ? C.cardInfo(x.want, S.season).name + ' (Nº ' + x.want + ')' : 'la carta') + ' a ' + x.from + ' por ' + nf(x.price) + ' créditos?')) return;
    busy = true; say('');
    try {
      const r = await api('/api/cards/trade/answer', { method: 'POST', body: { id: x.id, action } }); S = r;
      say(action === 'accept' ? (x.price ? '¡Vendida! Has ganado ' + money(x.price) + ' 🎉' : '¡Intercambio hecho! 🎉') + ((r.rewards || []).length ? ' Premio de grupo conseguido 🎁' : '') : action === 'reject' ? 'Oferta rechazada' : 'Oferta cancelada', action === 'accept' ? 'ok' : '');
      try { refreshCredits(); } catch (e) {}
      render(); await loadTrades();
    } catch (e) { say(e.message, 'err'); } finally { busy = false; }
  }

  // ---------- 🔴 Novedades (alguien quiere comprarte / cambiarte una carta, te han vendido una, subasta…) ----------
  async function loadNews() {
    const el = $('cards-news'); if (!el) return;
    try {
      const j = await api('/api/cards/notifs'); el.replaceChildren();
      if (!j.items || !j.items.length) { setDot(false); return; }
      const box = document.createElement('div'); box.className = 'news';
      const h = document.createElement('b'); h.textContent = '🔔 Novedades'; box.appendChild(h);
      j.items.slice(0, 8).forEach(n => { const d = document.createElement('div'); d.className = n.seen ? '' : 'new'; d.textContent = n.text; box.appendChild(d); });
      el.appendChild(box);
      if (j.unseen) { api('/api/cards/notifs/seen', { method: 'POST', body: {} }).catch(() => {}); setDot(false); }   // ya las has visto: se apaga el punto rojo
    } catch (e) { /* sin conexión: no pasa nada */ }
  }

  // ---------- 🏆 Ranking de jugadores por país ----------
  function go2(v) {   // cambia de pantalla dentro de Cartas
    view = v; clearInterval(aucTimer); say('');
    ['home', 'rank', 'auc'].forEach(k => $('cards-' + k).classList.toggle('hidden', k !== v));
    $('cards-title').textContent = v === 'rank' ? '🏆 Ranking de jugadores' : v === 'auc' ? '🖤 Carta Negra' : '🃏 Cartas';
    $('cards-meta').classList.toggle('hidden', v !== 'home');
    modal.querySelector('.modal-card').scrollTop = 0;
    if (v === 'rank') rankUi(); else if (v === 'auc') aucUi();
  }
  const mkp = (cls, text) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; return p; };
  function tile(info, label, onclick) {   // casilla pequeña de una carta
    const b = document.createElement('button'); b.type = 'button'; b.title = info.name; b.setAttribute('aria-label', info.name + (label ? ' ' + label : ''));
    if (info.special) b.className = 'blk'; else { b.style.setProperty('--c1', info.c1); b.style.setProperty('--c2', info.c2); }
    b.append(info.emoji); const sm = document.createElement('small'); sm.textContent = label; b.appendChild(sm); b.onclick = onclick; return b;
  }
  async function rankUi() {
    const el = $('cards-rank'); el.replaceChildren(mkp('cmeta muted', 'Toca el nombre de un jugador para ver todas sus cartas y ofrecerle comprar la que quieras.'), mkp('cmeta', 'Cargando…'));
    let R;
    try { R = await api('/api/cards/ranking'); } catch (e) { say(e.message, 'err'); el.replaceChildren(mkp('cmeta muted', 'No se pudo cargar el ranking.')); return; }
    el.replaceChildren(mkp('cmeta muted', 'Toca el nombre de un jugador para ver todas sus cartas y ofrecerle comprar la que quieras.'));
    if (!R.countries.length) { el.appendChild(mkp('cmeta', 'Todavía nadie tiene cartas.')); return; }
    R.countries.forEach(g => {
      const hd = document.createElement('div'); hd.className = 'rc';
      const a = document.createElement('span'); a.textContent = g.country ? flag(g.country) + ' ' + ctryName(g.country) : '🌍 Sin país';
      const b = document.createElement('small'); b.textContent = nf(g.total) + (g.total === 1 ? ' carta' : ' cartas'); hd.append(a, b); el.appendChild(hd);
      g.players.forEach((pl, i) => {
        const row = document.createElement('button'); row.type = 'button'; row.className = 'rp' + (pl.me ? ' me' : ''); row.setAttribute('aria-expanded', 'false');
        const l = document.createElement('span'); l.textContent = (i + 1) + '. ' + (pl.avatar ? pl.avatar + ' ' : '') + pl.nick + (pl.me ? ' (tú)' : '');
        const r = document.createElement('span'); r.className = 'n'; r.textContent = (pl.black ? '🖤' + pl.black + ' · ' : '') + nf(pl.count) + ' 🃏'; row.append(l, r);
        const panel = document.createElement('div'); panel.className = 'rpanel hidden'; let loaded = false;
        row.onclick = () => {
          const open = panel.classList.toggle('hidden') === false; row.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open && !loaded) { loaded = true; fillPlayer(panel, pl.nick).catch(() => { loaded = false; }); }
        };
        el.append(row, panel);
      });
    });
  }
  async function fillPlayer(panel, nick) {
    panel.replaceChildren(mkp('cmeta', 'Cargando cartas…'));
    let P;
    try { P = await api('/api/cards/player?nick=' + encodeURIComponent(nick)); } catch (e) { panel.replaceChildren(mkp('cmeta', e.message)); say(e.message, 'err'); throw e; }
    panel.replaceChildren(mkp('cmeta', P.nick + ' tiene ' + nf(P.cards.length) + (P.cards.length === 1 ? ' carta' : ' cartas') + (P.me ? ' (son las tuyas)' : '. Toca una para verla y ofrecerle comprarla.')));
    const detail = document.createElement('div'), mini = document.createElement('div'); mini.className = 'mini';
    const pick = (btn, node) => { panel.querySelectorAll('.mini button.sel').forEach(x => x.classList.remove('sel')); btn.classList.add('sel'); detail.replaceChildren(node); };
    P.cards.forEach(id => { const info = C.cardInfo(id, P.season), t = tile(info, String(id), () => pick(t, cardWithBuy(P, id, info))); mini.appendChild(t); });
    panel.append(mini);
    const bh = document.createElement('h4'); bh.textContent = '🖤 Cartas Negras de ' + (P.me ? 'tu colección' : P.nick); panel.appendChild(bh);   // este tipo de carta tiene su propio apartado
    if (!P.black.length) panel.appendChild(mkp('cmeta muted', 'Ninguna todavía.'));
    else { const bm = document.createElement('div'); bm.className = 'mini'; P.black.forEach(b => { const info = C.blackInfo(b.month), t = tile(info, b.month.slice(2), () => pick(t, blackWrap(info, b))); bm.appendChild(t); }); panel.appendChild(bm); }
    panel.appendChild(detail);
  }
  function blackWrap(info, b) { const w = document.createElement('div'); const ce = cardEl(info, true); ce.onclick = () => zoomEl(cardEl(info, false), ce, '#d4a017'); w.appendChild(ce); w.appendChild(mkp('cmeta', '🖤 Única · ganada con una puja de ' + money(b.bid) + '. No se puede comprar ni cambiar.')); w.appendChild(shareBtn(info.id)); return w; }
  function cardWithBuy(P, id, info) {   // la carta abierta + formulario para ofrecer créditos por ella
    const w = document.createElement('div'); w.appendChild(cardEl(info, true)); w.appendChild(shareBtn(id));
    if (P.me) { w.appendChild(mkp('cmeta', 'Esta carta es tuya.')); return w; }
    const f = document.createElement('div'); f.className = 'tform';
    const price = document.createElement('input'); price.type = 'number'; price.min = 1; price.step = 1; price.inputMode = 'numeric'; price.placeholder = '🎟️ Créditos'; price.setAttribute('aria-label', 'Créditos que ofreces');
    const buy = document.createElement('button'); buy.type = 'button'; buy.className = 'primary'; buy.textContent = '💰 Ofrecer comprar';
    const swap = document.createElement('button'); swap.type = 'button'; swap.textContent = '🔁 Proponer cambio';
    const m = mkp('tmsg msg', '');
    buy.onclick = async () => {
      if (busy) return; const n = Math.floor(Number(price.value));
      if (!Number.isFinite(n) || n < 1) { m.textContent = 'Escribe cuántos créditos ofreces'; m.className = 'tmsg msg err'; say(m.textContent, 'err'); price.focus(); return; }
      busy = true; m.textContent = 'Enviando…'; m.className = 'tmsg msg'; say('');
      try {
        await api('/api/cards/trade', { method: 'POST', body: { nick: P.nick, want: id, price: n } });
        m.textContent = '💰 Oferta enviada: ' + money(n) + ' por ' + info.name + ' (Nº ' + id + '). ' + P.nick + ' recibirá un aviso.'; m.className = 'tmsg msg ok'; say('Oferta de compra enviada a ' + P.nick + ' 👍', 'ok');
        price.value = ''; loadTrades();
      } catch (e) { m.textContent = e.message; m.className = 'tmsg msg err'; say(e.message, 'err'); } finally { busy = false; }
    };
    swap.onclick = () => { prefill = { nick: P.nick, want: id }; go2('home'); tradesUi(); $('cards-trades').scrollIntoView({ behavior: 'smooth' }); };
    f.append(price, buy); w.append(mkp('cmeta', 'Tienes ' + money(S ? S.credits : 0) + '. Si acepta, los créditos pasan a su cuenta y la carta a la tuya.'), f, swap, m);
    return w;
  }

  // ---------- 🖤 Puja mensual de la Carta Negra ----------
  const monthName = m => { try { return new Date(m + '-15T12:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); } catch (e) { return m; } };
  async function aucUi() {
    const el = $('cards-auc'); clearInterval(aucTimer); el.replaceChildren(mkp('cmeta', 'Cargando…'));
    let A;
    try { A = await api('/api/cards/auction'); } catch (e) { say(e.message, 'err'); el.replaceChildren(mkp('cmeta muted', 'No se pudo cargar la puja.')); return; }
    paintAuction(el, A);
  }
  function paintAuction(el, A) {
    clearInterval(aucTimer); el.replaceChildren();
    el.appendChild(mkp('cmeta muted', 'Una carta única, negra y con letras de oro, al máximo de poder, fuerza y carisma. Solo existe una: se la queda quien más puje. La puja se cierra el último día de cada mes y al mes siguiente sale otra carta negra distinta.'));
    const h = document.createElement('h3'); h.textContent = '🖤 Carta de ' + monthName(A.month); el.appendChild(h);
    el.appendChild(cardEl(A.card, true));
    const cd = document.createElement('div'); cd.className = 'count'; cd.setAttribute('aria-live', 'off'); el.appendChild(cd);
    const off = A.now - Date.now();
    const tick = () => {
      const ms = A.endsAt - (Date.now() + off);
      if (ms <= 0) { clearInterval(aucTimer); cd.textContent = '⏳ Cerrando la puja…'; setTimeout(() => { if (view === 'auc' && !modal.classList.contains('hidden')) aucUi(); }, 3000); return; }
      const d = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24, mm = Math.floor(ms / 6e4) % 60, ss = Math.floor(ms / 1e3) % 60, z = n => String(n).padStart(2, '0');
      cd.textContent = '⏳ ' + (d ? d + ' d ' : '') + z(hh) + ':' + z(mm) + ':' + z(ss);
    };
    tick(); aucTimer = setInterval(tick, 1000);
    el.appendChild(mkp('cmeta', A.topNick ? '🏆 Mejor puja: ' + A.topNick + ' · ' + money(A.topAmount) + (A.iLead ? ' (¡vas ganando tú!)' : '') + ' · ' + A.bidders + (A.bidders === 1 ? ' jugador puja' : ' jugadores pujan') : 'Aún nadie ha pujado. Sale a ' + money(A.startBid) + '.'));
    if (A.myBid) el.appendChild(mkp('cmeta', 'Tu puja: ' + money(A.myBid)));
    el.appendChild(mkp('cmeta', 'Tienes ' + money(A.credits)));
    const f = document.createElement('div'); f.className = 'tform';
    const amt = document.createElement('input'); amt.type = 'number'; amt.min = A.minBid; amt.step = 1; amt.inputMode = 'numeric'; amt.placeholder = 'Mínimo ' + nf(A.minBid); amt.setAttribute('aria-label', 'Créditos que pujas');
    const go = document.createElement('button'); go.type = 'button'; go.className = 'primary blk'; go.textContent = '🖤 Pujar';
    const q = document.createElement('div'); q.className = 'crow';
    [0, 10, 50, 100].forEach(x => { const b = document.createElement('button'); b.type = 'button'; b.textContent = x ? '+' + x : 'Mínimo'; b.onclick = () => { amt.value = A.minBid + x; }; q.appendChild(b); });
    const m = mkp('tmsg msg', '');
    go.onclick = async () => {
      if (busy) return; const n = Math.floor(Number(amt.value));
      if (!Number.isFinite(n) || n < A.minBid) { m.textContent = 'Tu puja debe ser de al menos ' + nf(A.minBid) + ' créditos'; m.className = 'tmsg msg err'; say(m.textContent, 'err'); amt.focus(); return; }
      if (!confirm('¿Pujar ' + nf(n) + ' créditos por la Carta Negra? Solo se te cobrarán si ganas, cuando acabe la puja.')) return;
      busy = true; m.textContent = 'Pujando…'; m.className = 'tmsg msg';
      try { const r = await api('/api/cards/auction/bid', { method: 'POST', body: { amount: n } }); say('🖤 ¡Puja de ' + nf(n) + ' créditos hecha! Vas ganando.', 'ok'); try { sfx('coin'); } catch (e) {} paintAuction(el, r); }
      catch (e) { m.textContent = e.message; m.className = 'tmsg msg err'; say(e.message, 'err'); } finally { busy = false; }
    };
    f.append(amt, go); el.append(f, q, m);
    el.appendChild(mkp('cmeta muted', 'Los créditos no se gastan al pujar: se descuentan solo si ganas, cuando se cierra la puja. Ten los créditos disponibles hasta entonces; si te quedas sin ellos, la carta pasa al siguiente que más haya pujado. Si ganas, te avisamos con un punto rojo.'));
    const hh = document.createElement('h3'); hh.textContent = '🏛️ Ganadores anteriores'; el.appendChild(hh);
    const hist = document.createElement('div'); hist.className = 'hist';
    if (!A.history.length) hist.textContent = 'Todavía no ha terminado ninguna puja.';
    A.history.forEach(x => { const d = document.createElement('div'); d.textContent = x.emoji + ' ' + x.name + ' · ' + monthName(x.month) + ' — ' + (x.nick ? '🏆 ' + x.nick + ' (' + money(x.bid) + ')' : 'sin pujas'); hist.appendChild(d); });
    el.appendChild(hist);
  }

  // Mis Cartas Negras (apartado propio dentro de la colección)
  function blackSection() {
    const el = $('cards-black'); el.replaceChildren();
    const h = document.createElement('h3'); h.textContent = '⭐ Especiales'; el.appendChild(h); el.appendChild(mkp('cmeta muted', 'Aquí se guardan tus cartas especiales de las pujas: las 🖤 Cartas Negras.'));
    if (!S.black || !S.black.length) { el.appendChild(mkp('cmeta muted', 'Aún no tienes ninguna. Se ganan en la puja mensual de la Carta Negra 🖤.')); return; }
    const mini = document.createElement('div'); mini.className = 'mini';
    S.black.forEach(b => { const info = C.blackInfo(b.month), t = tile(info, b.month.slice(2), () => { const v = $('cards-view'); v.replaceChildren(blackWrap(info, b)); v.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); zoomEl(cardEl(info, false), t, '#d4a017'); }); mini.appendChild(t); });
    el.appendChild(mini);
  }

  function render() {
    $('cards-meta').textContent = S.seasonName + ' · Tienes ' + S.owned.length + ' · Ya repartidas en el juego: ' + nf(S.minted) + ' de ' + nf(S.total);
    stage(); shop(); collection(); blackSection(); tradesUi();
  }
  async function load() {
    try { S = await api('/api/cards'); if (!S.on) { say('Las cartas están desactivadas', 'err'); return; } setDaily(S.dailyReady); say(''); $('cards-view').replaceChildren(); render(); loadTrades(); loadNews(); }
    catch (e) { say(e.message, 'err'); }
  }

  // ---------- Punto rojo en el botón 🃏 (y en «Extras») ----------
  const dot = document.createElement('span'); dot.id = 'cards-dot'; dot.className = 'hidden'; dot.setAttribute('aria-hidden', 'true'); btn.appendChild(dot);
  const prevSync = window.syncExtrasDot;   // el puntito de «Extras» también se enciende con los avisos de cartas
  window.syncExtrasDot = () => { if (prevSync) prevSync(); const e = $('extras-dot'); if (e && !dot.classList.contains('hidden')) e.classList.remove('hidden'); };
  let newsOn = false, dailyOn = false;   // dos motivos para el punto: novedades sin ver y sobre gratis sin recoger
  function paintDot() { dot.classList.toggle('hidden', !(newsOn || dailyOn)); if (window.syncExtrasDot) window.syncExtrasDot(); }
  function setDot(on) { newsOn = !!on; paintDot(); }
  function setDaily(on) { dailyOn = !!on; paintDot(); }
  let lastToast = 0, tokenSeen = null;
  async function pollNotifs() {
    if (typeof authToken === 'undefined' || !authToken) { setDot(false); setDaily(false); return; }
    if (document.hidden || !modal.classList.contains('hidden')) return;   // con la ventana abierta, las novedades salen ahí dentro
    try {
      const j = await api('/api/cards/notifs?brief=1'); if (j.on === false) return;
      setDot(j.unseen > 0); if (j.dailyReady !== undefined) setDaily(j.dailyReady);
      const f = (j.fresh || [])[0];
      if (f && f.id !== lastToast) { lastToast = f.id; toastMsg('🃏 ' + f.text); }
    } catch (e) { /* sin conexión: se reintenta */ }
  }
  (window.apiReady || Promise.resolve()).then(() => { setTimeout(pollNotifs, 4000); setInterval(pollNotifs, 60000); });
  setInterval(() => { if (typeof authToken !== 'undefined' && authToken !== tokenSeen) { tokenSeen = authToken; pollNotifs(); } }, 2000);   // entrar / salir de la cuenta
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(pollNotifs, 500); });

  // ---------- Abrir / cerrar / volver ----------
  const close = () => { clearInterval(aucTimer); modal.classList.add('hidden'); setTimeout(pollNotifs, 300); };
  const back = () => { if (view !== 'home') go2('home'); else close(); };   // dentro de ranking o puja vuelve a Cartas; en Cartas, vuelve al mapa
  btn.addEventListener('click', () => {
    if (typeof authToken !== 'undefined' && !authToken) { openLogin(); return; }
    modal.classList.remove('hidden'); go2('home'); load();
  });
  window.CardsUI = { cardEl, zoomEl };   // lo usa cards-share.js para enseñar una carta recibida por enlace
  $('cards-close').onclick = close;
  $('cards-back').onclick = back;
  $('cards-go-rank').onclick = () => go2('rank');
  $('cards-go-auc').onclick = () => go2('auc');
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) back(); });
})();
