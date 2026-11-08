'use strict';
// RETOS (botón 🎯 en Extras): misiones diarias y semanales, logros y los terrenos con más «me gusta».
// También pone el botón ❤️ «Me gusta» en la ficha de los terrenos de otros jugadores.
// El servidor decide todo (ver retosGet / retosClaim / likePost en server.js); aquí solo se dibuja, se reclama y se avisa.
// Usa globals de app.js: authToken, api(), openLogin(), flagOf(), boundsOf(), map, selected, loadProduction(), sfx().
(function () {
  const $ = id => document.getElementById(id);
  const extras = $('extras-items');
  if (!extras) return;
  const nf = n => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 3 });
  const credit = n => nf(n) + ' 🎟️';

  // ---- Aviso emergente (el mismo #toast del resto de la app) ----
  function toast(text, ms) {
    if (window.giftToast) return window.giftToast(text, ms);
    let t = $('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms || 6000);
  }

  // ---- Botón en Extras (con puntito rojo si hay algo que reclamar) ----
  const btn = document.createElement('button');
  btn.id = 'retos-btn'; btn.type = 'button'; btn.setAttribute('data-label', 'Retos'); btn.title = 'Misiones, logros y «me gusta»'; btn.setAttribute('aria-label', 'Retos: misiones, logros y me gusta');
  btn.textContent = '🎯';
  const dot = document.createElement('span'); dot.id = 'retos-dot'; dot.className = 'hidden'; btn.appendChild(dot);
  const before = $('gift-btn');
  extras.insertBefore(btn, before || extras.firstChild);

  const st = document.createElement('style');
  st.textContent = `
    #retos-dot { position:absolute; top:2px; right:2px; width:14px; height:14px; border-radius:50%; background:#e63946; border:2px solid #fff; animation:dailypulse 1.4s infinite; }
    .mp-ic #retos-dot { top:-3px !important; right:-3px !important; }
    #retos .modal-card { max-height: min(90vh, 760px); overflow-y: auto; }
    #retos .rtabs { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin:6px 0 10px; }
    #retos .rtabs button { flex:1; width:auto !important; margin:0 !important; padding:7px 4px; font-weight:700; font-size:13px; }
    #retos .rtabs button.on { background:var(--accent); color:#fff; border-color:var(--accent); }
    #retos h3 { margin:14px 0 6px; font-size:15px; }
    #retos .rnote { font-size:12px; margin:0 0 6px; }
    #retos .rrow { border:1px solid var(--line); border-radius:12px; padding:9px 10px; margin:6px 0; }
    #retos .rrow.done { opacity:.75; }
    #retos .rtop { display:flex; align-items:center; gap:8px; font-size:14px; }
    #retos .rtop .ri { font-size:22px; flex:none; }
    #retos .rtop .rt { flex:1; min-width:0; }
    #retos .rtop button { flex:none; width:auto !important; min-width:0; margin:0 !important; padding:6px 12px; font-weight:700; font-size:13px; white-space:nowrap; }
    #retos .rtop button:disabled { opacity:.4; cursor:default; }
    #retos .rbar { height:7px; border-radius:99px; background:var(--line); margin-top:7px; overflow:hidden; }
    #retos .rbar i { display:block; height:100%; background:var(--accent); border-radius:99px; transition:width .4s; }
    #retos .rrow.ok .rbar i { background:#2a9d4f; }
    #retos small { color:var(--muted); }
    #retos .ach { display:flex; align-items:center; gap:10px; }
    #retos .ach.locked .ri { filter:grayscale(1); opacity:.45; }
    #retos .ach .rt b { display:block; }
    #retos .rbtn { display:block; width:100%; text-align:left; margin:6px 0; padding:10px; }
    #retos .thumbs { display:flex; flex-wrap:wrap; gap:5px; margin:6px 0 2px; }
    #retos .thumbs span { position:relative; width:46px; height:46px; border-radius:9px; overflow:hidden; border:1px solid var(--line); }
    #retos .thumbs img { width:100%; height:100%; object-fit:cover; display:block; }
    #retos .thumbs span.no img { filter:grayscale(1); opacity:.3; }
    #retos .thumbs span.yes::after { content:'✓'; position:absolute; right:1px; bottom:0; font-size:11px; font-weight:800; color:#fff; background:#2a9d4f; border-radius:6px 0 0 0; padding:0 4px; }
    #retos .chips { display:flex; gap:6px; margin:6px 0; flex-wrap:wrap; }
    #retos .chips button { padding:5px 10px; font-size:12px; font-weight:700; border-radius:99px; width:auto !important; margin:0 !important; }
    #retos .chips button.on { background:var(--accent); color:#fff; border-color:var(--accent); }
    #retos input.rin { width:100%; box-sizing:border-box; padding:9px 10px; margin:6px 0; font-size:15px; }
    #retos .emo { display:flex; gap:5px; flex-wrap:wrap; margin:4px 0 8px; }
    #retos .emo button { width:38px !important; height:38px; padding:0 !important; margin:0 !important; font-size:20px; }
    #retos .emo button.on { outline:3px solid #ffb703; }
    #retos .me { border-color:var(--accent); }
    #like-btn { width:100%; padding:9px; margin:2px 0 6px; font-weight:700; }
    #like-btn.liked { background:#ffe3e6; border-color:#e63946; color:#c1121f; }
  `;
  document.head.appendChild(st);

  // ---- Ventana ----
  const modal = document.createElement('div');
  modal.id = 'retos'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'retos-title');
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button id="retos-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="retos-title">🎯 Retos</h2>' +
      '<p id="retos-sum" class="rnote muted"></p>' +
      '<div class="rtabs"><button id="rt-m" type="button" class="on">🎯 Misiones</button><button id="rt-a" type="button">🏆 Logros</button><button id="rt-b" type="button">📚 Álbum</button><button id="rt-c" type="button">👥 Clan</button><button id="rt-e" type="button">🎉 Eventos</button><button id="rt-l" type="button">❤️ Populares</button></div>' +
      '<div id="retos-body"></div>' +
      '<p id="retos-msg" class="msg" aria-live="polite"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const body = $('retos-body'), sum = $('retos-sum'), msgEl = $('retos-msg');
  const say = (t, kind = '') => { msgEl.textContent = t; msgEl.className = 'msg ' + kind; };
  let data = null, top = null, tab = 'm', busy = false;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };   // textContent: nada del servidor se interpreta como HTML

  function missionRow(m) {
    const done = m.n >= m.target, r = el('div', 'rrow' + (m.claimed ? ' done' : '') + (done ? ' ok' : ''));
    const line = el('div', 'rtop');
    const t = el('div', 'rt'); t.append(el('div', '', m.text), el('small', '', m.claimed ? '✅ Reclamada' : `${m.n}/${m.target} · premio ${credit(m.reward)}`));
    const b = el('button', 'primary', m.claimed ? '✅' : 'Reclamar');
    b.type = 'button'; b.disabled = !done || m.claimed || busy;
    b.onclick = () => claim(m.key);
    line.append(el('span', 'ri', m.icon), t, b);
    const bar = el('div', 'rbar'), fill = el('i'); fill.style.width = Math.round(Math.min(1, m.n / m.target) * 100) + '%'; bar.append(fill);
    r.append(line, bar); return r;
  }
  function renderMissions() {
    body.replaceChildren();
    if (!data) return;
    body.append(el('h3', '', '📅 Misiones de hoy'), el('p', 'rnote muted', 'Son nuevas cada día. Completa las 3 y reclama el bonus.'));
    data.daily.forEach(m => body.append(missionRow(m)));
    const b = data.bonus, r = el('div', 'rrow' + (b.claimed ? ' done' : '') + (b.ready && !b.claimed ? ' ok' : ''));
    const row = el('div', 'rtop'), t = el('div', 'rt');
    t.append(el('div', '', 'Bonus: las 3 misiones de hoy'), el('small', '', b.claimed ? '✅ Reclamado' : `${data.daily.filter(d => d.claimed).length}/3 reclamadas · premio ${credit(b.reward)}`));
    const bb = el('button', 'primary', b.claimed ? '✅' : 'Reclamar'); bb.type = 'button'; bb.disabled = !b.ready || b.claimed || busy; bb.onclick = () => claim('d_bonus');
    row.append(el('span', 'ri', '🎉'), t, bb); r.append(row); body.append(r);
    body.append(el('h3', '', '🗓️ Misiones de la semana'), el('p', 'rnote muted', 'Se renuevan cada lunes.'));
    data.weekly.forEach(m => body.append(missionRow(m)));
  }
  function renderAch() {
    body.replaceChildren();
    if (!data) return;
    const got = data.achievements.filter(a => a.unlocked).length;
    body.append(el('p', 'rnote muted', `Has conseguido ${got} de ${data.achievements.length} logros. Cada uno da créditos al desbloquearse.`));
    data.achievements.forEach(a => {
      const r = el('div', 'rrow ach' + (a.unlocked ? ' ok' : ' locked'));
      const t = el('div', 'rt'); t.append(el('b', '', a.name), el('small', '', a.text));
      const right = el('div', ''); right.style.cssText = 'text-align:right;flex:none;font-size:12px';
      right.append(el('div', '', a.unlocked ? '✅' : `${a.cur}/${a.target}`), el('small', '', '+' + credit(a.reward)));
      r.append(el('span', 'ri', a.icon), t, right); body.append(r);
    });
  }
  async function renderLikes() {
    body.replaceChildren();
    if (data) body.append(el('p', 'rnote muted', `❤️ Has recibido ${data.likesIn} «me gusta» y has dado ${data.likesOut}. Toca un terreno de otro jugador y pulsa «Me gusta».`));
    body.append(el('h3', '', '🏆 Más queridos esta semana'));
    if (!top) { try { top = (await api('/api/likes/top')).top || []; } catch (e) { top = []; } if (tab !== 'l') return; }
    if (!top.length) { body.append(el('p', 'muted', 'Todavía nadie ha dado «me gusta» esta semana. ¡Sé el primero!')); return; }
    top.forEach((p, i) => {
      const b = el('button', 'rbtn', `${i + 1}. ${window.flagOf ? flagOf(p.country) : ''} ${p.avatar || ''} ${p.owner} · ❤️ ${p.likes}`.replace(/\s+/g, ' ').trim());
      b.type = 'button';
      b.onclick = () => {
        close();
        const wi = typeof isOtherWorld === 'function' && isOtherWorld(p) && window.worldInfo ? window.worldInfo(p.world) : null;
        if (wi) { if (window.goToWorldParcel) window.goToWorldParcel(p); return; }   // en otro planeta: se viaja hasta él
        const bb = boundsOf(p.x, p.y);
        map.flyTo(L.latLng((bb[0][0] + bb[1][0]) / 2, (bb[0][1] + bb[1][1]) / 2), 18);
      };
      body.append(b);
    });
  }
  // ---- 📚 Álbum: una casilla por casa; el sello se gana con la primera casa de cada categoría ----
  const thumbs = list => { const w = el('div', 'thumbs'); list.forEach(h => { const sp = el('span', h.owned ? 'yes' : 'no'); const i = document.createElement('img'); i.src = sizedUrl(h.img, 't'); i.alt = ''; i.title = String(h.img).replace(/^images\//, '').replace(/\.webp$/i, '').replace(/[-_]/g, ' '); sp.append(i); w.append(sp); }); return w; };
  function renderAlbum() {
    body.replaceChildren();
    if (!data || !data.album) return;
    const a = data.album;
    body.append(el('p', 'rnote muted', `📚 Tienes ${a.have} casas distintas de ${a.total}. Sello por categoría: +${nf(a.stamp)} 🎟️ · categoría completa: +${nf(a.full)} 🎟️ · álbum completo: +${nf(a.allReward)} 🎟️ ${a.all ? '(¡conseguido!)' : ''}`));
    a.cats.forEach(c => {
      const got = c.houses.filter(h => h.owned).length, r = el('div', 'rrow' + (c.full ? ' ok' : ''));
      const head = el('div', 'rtop'), t = el('div', 'rt');
      t.append(el('b', '', `${c.icon} ${c.name}`), el('small', '', ` · ${got}/${c.houses.length}`));
      head.append(t, el('span', '', c.full ? '⭐ Completa' : c.stamp ? '✅ Sello' : '🔒'));
      r.append(head, thumbs(c.houses)); body.append(r);
    });
    const lim = (data.events || []).filter(e => e.houses && e.houses.length);
    if (lim.length) {
      body.append(el('h3', '', '🎉 Ediciones limitadas'));
      lim.forEach(e => { const r = el('div', 'rrow'); r.append(el('div', 'rtop', `${e.icon} ${e.name}`), thumbs(e.houses)); body.append(r); });
    }
  }

  // ---- 🎉 Eventos de temporada ----
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fmtMD = md => `${Number(md.slice(3))} ${MES[Number(md.slice(0, 2)) - 1]}`;
  const days = n => n === 0 ? 'hoy' : n === 1 ? '1 día' : n + ' días';
  function renderEvents() {
    body.replaceChildren();
    if (!data) return;
    const evs = (data.events || []).slice().sort((x, y) => (y.active - x.active) || ((x.daysTo || 0) - (y.daysTo || 0)));
    if (!evs.length) { body.append(el('p', 'muted', 'Pronto habrá eventos de temporada con casas de edición limitada. 🎃🎄💘☀️')); return; }
    body.append(el('p', 'rnote muted', 'Las casas de evento solo se pueden elegir mientras dura el evento. Búscalas en el selector de casas, categoría 🎉 Eventos. Si ya tienes una, es tuya para siempre.'));
    evs.forEach(e => {
      const r = el('div', 'rrow' + (e.active ? ' ok' : ''));
      const head = el('div', 'rtop'), t = el('div', 'rt');
      t.append(el('b', '', `${e.icon} ${e.name}`), el('small', '', e.active ? ` · ¡ACTIVO! ${e.daysLeft === 0 ? 'Último día' : 'Quedan ' + days(e.daysLeft)}` : ` · del ${fmtMD(e.from)} al ${fmtMD(e.to)} · empieza en ${days(e.daysTo)}`));
      head.append(t); r.append(head, thumbs(e.houses));
      if (e.active && e.mission) r.append(missionRow({ key: 'e_' + e.key, icon: '🎁', text: e.mission.text, target: 1, n: e.mission.n, claimed: e.mission.claimed, reward: e.mission.reward }));
      body.append(r);
    });
  }

  // ---- 👥 Clanes ----
  let clanData = null, clanSort = 'week', clanScope = 'world', clanEmoji = null;
  const chip = (label, on, fn) => { const b = el('button', on ? 'on' : '', label); b.type = 'button'; b.onclick = fn; return b; };
  async function clanAct(path, bodyObj, okMsg) {
    if (busy) return; busy = true; say('');
    try { await api(path, { method: 'POST', body: bodyObj || {} }); if (okMsg) say(okMsg, 'ok'); try { sfx('claim'); } catch (e) {} }
    catch (e) { say(e.message, 'err'); }
    busy = false; await renderClan(); refresh();
  }
  async function renderClan() {
    if (!clanData) { body.replaceChildren(el('p', 'rnote muted', 'Cargando clanes…')); }
    try { clanData = await api('/api/clans', { method: 'GET' }); } catch (e) { clanData = null; }
    if (tab !== 'c') return;
    body.replaceChildren();
    if (!clanData) { body.append(el('p', 'muted', 'No se pudieron cargar los clanes. Inténtalo de nuevo.')); return; }
    const d = clanData, me = d.me;
    if (me) {
      const r = el('div', 'rrow me'), head = el('div', 'rtop'), t = el('div', 'rt');
      t.append(el('b', '', `${me.emoji} ${me.name}`), el('small', '', `👥 ${me.members.length}/${d.max} · 📆 ${nf(me.weekly)} pts esta semana (puesto ${me.rankWeek}/${me.clans}) · 🏆 ${nf(me.total)} pts en total (puesto ${me.rankTotal}/${me.clans})`));
      head.append(t); r.append(head); body.append(r);
      body.append(el('h3', '', 'Miembros'));
      me.members.forEach(m => {
        const row = el('div', 'rrow'), line = el('div', 'rtop'), tt = el('div', 'rt');
        tt.append(el('div', '', `${m.leader ? '👑 ' : ''}${m.nick}${m.you ? ' (tú)' : ''}`), el('small', '', `🏡 ${m.parcels} ${m.parcels === 1 ? 'terreno' : 'terrenos'} · ⭐ ${m.pts} pts`));
        line.append(tt);
        if (me.isLeader && !m.you) { const k = el('button', '', 'Expulsar'); k.type = 'button'; k.onclick = () => { if (confirm(`¿Expulsar a ${m.nick} del clan?`)) clanAct('/api/clans/kick', { nick: m.nick }, `${m.nick} ya no está en el clan`); }; line.append(k); }
        row.append(line); body.append(row);
      });
      const lv = el('button', 'rbtn', me.isLeader && me.members.length > 1 ? '🚪 Salir del clan (el mando pasa al miembro más antiguo)' : '🚪 Salir del clan');
      lv.type = 'button'; lv.onclick = () => { if (confirm('¿Seguro que quieres salir del clan?')) clanAct('/api/clans/leave', {}, 'Has salido del clan'); };
      body.append(lv);
    } else {
      body.append(el('h3', '', '🛡️ Crea tu clan'), el('p', 'rnote muted', 'Un clan reúne hasta ' + d.max + ' jugadores. Suman puntos juntos: terrenos nuevos, niveles, «me gusta» y misiones.'));
      const inp = document.createElement('input'); inp.className = 'rin'; inp.maxLength = 20; inp.placeholder = 'Nombre del clan (3 a 20 letras)'; inp.setAttribute('aria-label', 'Nombre del clan'); inp.autocomplete = 'off';
      const emo = el('div', 'emo'); clanEmoji = clanEmoji || d.emojis[0];
      d.emojis.forEach(e => { const b = el('button', e === clanEmoji ? 'on' : '', e); b.type = 'button'; b.onclick = () => { clanEmoji = e; [...emo.children].forEach(x => x.classList.toggle('on', x.textContent === e)); }; emo.append(b); });
      const go = el('button', 'primary rbtn', '✨ Crear clan'); go.type = 'button'; go.style.textAlign = 'center';
      go.onclick = () => clanAct('/api/clans/create', { name: inp.value, emoji: clanEmoji }, '🎉 ¡Clan creado!');
      body.append(inp, emo, go);
    }
    // Ranking
    body.append(el('h3', '', '🏆 Ranking de clanes'));
    const chips = el('div', 'chips');
    chips.append(chip('📆 Semana', clanSort === 'week', () => { clanSort = 'week'; renderClan(); }), chip('🏆 Total', clanSort === 'total', () => { clanSort = 'total'; renderClan(); }), chip('🌍 Mundo', clanScope === 'world', () => { clanScope = 'world'; renderClan(); }));
    if (d.myCountry) chips.append(chip(`${window.flagOf ? flagOf(d.myCountry) : '🏳️'} Mi país`, clanScope === 'country', () => { clanScope = 'country'; renderClan(); }));
    body.append(chips);
    const key = clanSort === 'week' ? 'weekly' : 'total', other = key === 'weekly' ? 'total' : 'weekly';
    let list = d.ranking.slice();
    if (clanScope === 'country' && d.myCountry) list = list.filter(c => c.country === d.myCountry);
    list.sort((x, y) => (y[key] - x[key]) || (y[other] - x[other]) || (x.id - y.id));
    if (!list.length) body.append(el('p', 'muted', 'Todavía no hay clanes aquí. ¡Crea el primero!'));
    list.slice(0, 15).forEach((c, i) => {
      const row = el('div', 'rrow' + (me && me.id === c.id ? ' me' : '')), line = el('div', 'rtop'), tt = el('div', 'rt');
      tt.append(el('div', '', `${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${c.emoji} ${c.name}`), el('small', '', `${window.flagOf && c.country ? flagOf(c.country) + ' ' : ''}👥 ${c.members}/${d.max} · ${clanSort === 'week' ? '📆' : '🏆'} ${nf(c[key])} pts`));
      line.append(tt);
      if (!me && c.members < d.max) { const j = el('button', 'primary', 'Unirme'); j.type = 'button'; j.onclick = () => clanAct('/api/clans/join', { id: c.id }, `👥 ¡Te has unido a ${c.name}!`); line.append(j); }
      row.append(line); body.append(row);
    });
    body.append(el('p', 'rnote muted', 'Puntos de la semana: 3 por terreno nuevo, 1 por «me gusta» recibido y 1 por misión reclamada. Se reinician cada lunes.'));
  }

  function render() {
    ['m', 'a', 'b', 'c', 'e', 'l'].forEach(k => $('rt-' + k).classList.toggle('on', tab === k));
    sum.textContent = data ? `🎟️ Los premios se suman a tu producción: se recogen con el resto de créditos.` : '';
    if (tab === 'm') renderMissions(); else if (tab === 'a') renderAch(); else if (tab === 'b') renderAlbum(); else if (tab === 'c') renderClan(); else if (tab === 'e') renderEvents(); else renderLikes();
  }

  // ---- Datos ----
  function readyCount() {
    if (!data) return 0;
    const m = [...data.daily, ...data.weekly].filter(x => x.n >= x.target && !x.claimed).length;
    const ev = (data.events || []).filter(e => e.active && e.mission && e.mission.n >= 1 && !e.mission.claimed).length;
    return m + ev + (data.bonus.ready && !data.bonus.claimed ? 1 : 0);
  }
  function setDot() {
    dot.classList.toggle('hidden', !(authToken && readyCount() > 0));
    if (window.syncExtrasDot) window.syncExtrasDot();
  }
  const prevSync = window.syncExtrasDot;   // el puntito de «Extras» también se enciende con las misiones por reclamar
  window.syncExtrasDot = () => {
    if (prevSync) prevSync();
    const e = $('extras-dot'); if (e && !dot.classList.contains('hidden')) e.classList.remove('hidden');
  };
  let lastFetch = 0, tokenSeen = null;
  async function refresh(announce) {
    if (!authToken) { data = null; setDot(); return; }
    try {
      data = await api('/api/retos', { method: 'GET' }); lastFetch = Date.now();
      setDot();
      if (!modal.classList.contains('hidden')) render();
      (data.newAlbum || []).forEach((a, i) => setTimeout(() => { toast(`${a.text} · +${nf(a.reward)} 🎟️`, 6000); try { sfx('claim'); } catch (e) {} }, i * 6500));
      (data.newAch || []).forEach((a, i) => setTimeout(() => { toast(`🏆 ¡Logro desbloqueado! ${a.icon} ${a.name} · +${nf(a.reward)} 🎟️`, 7000); try { sfx('claim'); } catch (e) {} }, ((data.newAlbum || []).length + i) * 6500 + 3000));
      if (announce && data.likesUnseen > 0 && !(data.newAch || []).length) {
        toast(`❤️ ${data.likesUnseen === 1 ? 'A 1 persona le gustó' : 'A ' + data.likesUnseen + ' personas les gustaron'} tus terrenos`, 7000);
        api('/api/retos/seen', { method: 'POST', body: {} }).catch(() => {});
      }
    } catch (e) { /* sin conexión: se reintenta */ }
  }
  async function claim(key) {
    if (busy) return; busy = true; say('');
    try {
      const j = await api('/api/retos/claim', { method: 'POST', body: { key } });
      say(`🎉 ¡Reclamado! +${nf(j.reward)} 🎟️ (se suma a tu producción)`, 'ok');
      try { sfx('claim'); } catch (e) {}
      if (typeof loadProduction === 'function') loadProduction();
    } catch (e) { say(e.message, 'err'); }
    busy = false; await refresh();
  }

  function open() {
    if (!authToken) return openLogin('Entra con tu cuenta para ver tus misiones y logros 🎯');
    say(''); modal.classList.remove('hidden'); top = null; render(); refresh();
  }
  const close = () => modal.classList.add('hidden');
  btn.addEventListener('click', open);
  $('retos-close').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  $('rt-m').onclick = () => { tab = 'm'; say(''); render(); };
  $('rt-a').onclick = () => { tab = 'a'; say(''); render(); };
  $('rt-b').onclick = () => { tab = 'b'; say(''); render(); };
  $('rt-c').onclick = () => { tab = 'c'; say(''); render(); };
  $('rt-e').onclick = () => { tab = 'e'; say(''); render(); };
  $('rt-l').onclick = () => { tab = 'l'; say(''); render(); };

  // Entrar / salir de la cuenta, volver a la pestaña y cada pocos minutos
  setInterval(() => {
    if (typeof authToken === 'undefined') return;
    if (authToken !== tokenSeen) { tokenSeen = authToken; refresh(true); }
    else if (authToken && !document.hidden && Date.now() - lastFetch > 180000) refresh();
  }, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && authToken) setTimeout(() => refresh(), 500); });

  // Cuando el jugador hace algo que cuenta para una misión o un logro, se vuelve a mirar (sin tocar el código de cada acción)
  const WATCH = ['/api/production/collect', '/api/parcel/upgrade', '/api/claim', '/api/chat/send', '/api/gifts/send', '/api/roulette/spin', '/api/daily/claim', '/api/like', '/api/parcel/house', '/api/clans'];
  const f0 = window.fetch;
  if (typeof f0 === 'function') {
    window.fetch = function (input, init) {
      const p = f0.apply(this, arguments);
      try {
        const u = String(typeof input === 'string' ? input : (input && input.url) || ''), m = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (m === 'POST' && WATCH.some(w => u.indexOf(w) >= 0)) p.then(r => { if (r && r.ok) { clearTimeout(refresh.t); refresh.t = setTimeout(() => refresh(), 1200); } }).catch(() => {});
      } catch (e) { /* nunca estorba a la petición */ }
      return p;
    };
  }

  // ---- ❤️ «Me gusta» en la ficha del terreno ----
  const like = document.createElement('button');
  like.id = 'like-btn'; like.type = 'button'; like.className = 'hidden';
  const anchor = $('gift-owner-btn');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(like, anchor);
  function paintLike(p) {
    const n = p && p.likes != null ? ` (${p.likes})` : '';
    if (!p || !p.owner || !p.giftable) { like.classList.add('hidden'); return; }   // sin dueño con cuenta no hay a quién gustar
    like.classList.remove('hidden');
    if (p.mine) { like.disabled = true; like.className = ''; like.textContent = `❤️ ${p.likes || 0} me gusta en tu terreno`; return; }
    like.disabled = !!p.liked; like.className = p.liked ? 'liked' : '';
    like.textContent = p.liked ? `❤️ Te gusta${n}` : `🤍 Me gusta${n}`;
  }
  window.retosPanel = paintLike;   // lo llama showPanel() de app.js cada vez que se abre un terreno
  like.addEventListener('click', async () => {
    const p = window.selected !== undefined ? window.selected : (typeof selected !== 'undefined' ? selected : null);
    if (!p || !p.id) return;
    if (!authToken) return openLogin('Entra con tu cuenta para dar «me gusta» ❤️');
    like.disabled = true;
    try {
      const j = await api('/api/like', { method: 'POST', body: { id: p.id } });
      p.liked = true; p.likes = j.likes; paintLike(p);
      if (j.added) { try { sfx('claim'); } catch (e) {} toast('❤️ ¡Le has dado «me gusta» a este terreno!', 2500); }
    } catch (e) { like.disabled = false; toast(e.message, 4000); }
  });
})();
