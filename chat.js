'use strict';
// Chat de la zona: se ve lo que escribe la gente que juega a menos de X km (50 por defecto, ver CHAT_RADIUS_KM en el servidor)
// del punto donde está centrado el mapa. Leer es libre; para escribir hace falta cuenta con apodo.
// También: punto rojo en el botón cuando hay mensajes nuevos, reacciones con emojis y lista de amigos.
(function () {
  if (typeof map === 'undefined' || !map || !window.EventSource) return;
  const btn = document.getElementById('chat-btn'), menuBtn = document.getElementById('menu-btn');
  if (!btn) return;
  const MAX = 200, EMOJIS = ['❤️', '😂', '👍', '😮', '🔥'];
  const km = () => (typeof cfg !== 'undefined' && cfg && cfg.chatKm) || 50;
  const here = () => { const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; };
  const qs = p => 'lat=' + p.lat.toFixed(4) + '&lng=' + p.lng.toFixed(4);

  // Ventana del chat
  const modal = document.createElement('div');
  modal.id = 'chat'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'chat-title');
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button id="chat-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="chat-title">💬 Chat de la zona</h2>' +
      '<p id="chat-sub" class="muted"></p>' +
      '<button id="chat-friends-btn" type="button">👥 Amigos</button>' +
      '<div id="chat-list" aria-live="polite"></div>' +
      '<div id="chat-friends" class="hidden"></div>' +
      '<div id="chat-card" class="hidden"></div>' +
      '<form id="chat-form" autocomplete="off">' +
        '<input id="chat-input" type="text" maxlength="' + MAX + '" placeholder="Escribe un mensaje…" enterkeyhint="send">' +
        '<button id="chat-send" class="primary" type="submit">Enviar</button>' +
      '</form>' +
      '<p id="chat-msg" class="msg" aria-live="polite"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const $ = id => document.getElementById(id);
  const list = $('chat-list'), input = $('chat-input'), msgEl = $('chat-msg');
  const say = (t, kind = '') => { msgEl.textContent = t; msgEl.className = 'msg ' + kind; };

  let pos = null, es = null, lastId = 0, adminKey = null;
  const seen = new Set(), msgs = new Map();
  const isAdminView = () => { try { return localStorage.getItem('adminView') === '1'; } catch { return false; } };

  // ---- Punto rojo: mensajes nuevos cerca desde la última vez que abriste el chat ----
  let seenId = null;
  try { const s = localStorage.getItem('chatSeen'); if (s !== null) seenId = Number(s) || 0; } catch {}
  const dot = on => { btn.classList.toggle('has-dot', on); if (menuBtn) menuBtn.classList.toggle('has-dot', on); };
  function setSeen(id) {
    seenId = Math.max(seenId || 0, id || 0);
    try { localStorage.setItem('chatSeen', String(seenId)); } catch {}
  }
  async function poll() {
    if (document.hidden || !modal.classList.contains('hidden')) return;
    try {
      const j = await api('/api/chat/unread?' + qs(here()) + (seenId == null ? '' : '&seen=' + seenId));
      if (seenId == null) { setSeen(j.last); dot(false); } else dot(j.n > 0);   // primera vez: lo antiguo no cuenta como nuevo
    } catch { /* sin conexión: se reintenta */ }
  }
  (window.apiReady || Promise.resolve()).then(() => { poll(); setInterval(poll, 45000); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

  // ---- Mensajes ----
  function renderReacts(row, m) {
    const box = row.querySelector('.reacts');
    box.replaceChildren();
    for (const e of EMOJIS) {
      const n = (m.r && m.r[e]) || 0;
      if (!n) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = m.mine === e ? 'on' : '';
      b.textContent = e + ' ' + n; b.onclick = () => react(m, e);
      box.append(b);
    }
    const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'plus'; plus.textContent = '😊+'; plus.title = 'Reaccionar';
    const pick = document.createElement('span'); pick.className = 'pick hidden';
    EMOJIS.forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.onclick = () => { pick.classList.add('hidden'); react(m, e); }; pick.append(b); });
    plus.onclick = () => pick.classList.toggle('hidden');
    box.append(plus, pick);
  }
  async function react(m, emoji) {
    if (!authToken) { close(); return openLogin('Entra para reaccionar 😊'); }
    try {
      const j = await api('/api/chat/react', { method: 'POST', body: { id: m.id, emoji } });
      m.r = j.r; m.mine = j.mine;
      const row = list.querySelector('.chat-msg[data-id="' + m.id + '"]'); if (row) renderReacts(row, m);
    } catch (e) { say(e.message, 'err'); }
  }
  function add(m) {
    if (!m || seen.has(m.id)) return;
    seen.add(m.id); lastId = Math.max(lastId, m.id);
    m.r = m.r || {}; msgs.set(m.id, m);
    const near = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    const row = document.createElement('div');
    row.className = 'chat-msg' + (m.nick && m.nick === myNick ? ' mine' : '');
    row.dataset.id = m.id;
    const who = document.createElement('button'); who.type = 'button'; who.className = 'who';
    who.textContent = [flagOf(m.country), m.avatar, m.nick].filter(Boolean).join(' ');
    who.onclick = () => showCard(m);
    const when = document.createElement('span'); when.className = 'when';
    when.textContent = new Date(m.t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    row.append(who, when);
    if (isAdminView()) {
      const del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = '🗑'; del.title = 'Borrar mensaje';
      del.onclick = () => removeAsAdmin(m.id);
      row.append(del);
    }
    const text = document.createElement('div'); text.className = 'text'; text.textContent = m.text;   // textContent: nunca HTML
    const reacts = document.createElement('div'); reacts.className = 'reacts';
    row.append(text, reacts);
    renderReacts(row, m);
    list.append(row);
    if (near || m.nick === myNick) list.scrollTop = list.scrollHeight;
  }
  function remove(id) { const r = list.querySelector('.chat-msg[data-id="' + id + '"]'); if (r) r.remove(); msgs.delete(id); }
  function updateReacts(id, r) {
    const m = msgs.get(id); if (!m) return;
    m.r = r; if (m.mine && !r[m.mine]) m.mine = null;
    const row = list.querySelector('.chat-msg[data-id="' + id + '"]'); if (row) renderReacts(row, m);
  }
  async function removeAsAdmin(id) {
    if (!adminKey) adminKey = prompt('Clave de administrador') || null;
    if (!adminKey) return;
    try {
      const r = await fetch('/api/chat/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminKey }, body: JSON.stringify({ id }) });
      if (!r.ok) { if (r.status === 403) adminKey = null; throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo borrar'); }
      remove(id);
    } catch (e) { say(e.message, 'err'); }
  }
  function empty() {
    if (!list.querySelector('.chat-msg') && !list.querySelector('.chat-empty')) {
      const p = document.createElement('p'); p.className = 'chat-empty muted'; p.textContent = 'Aún no hay mensajes cerca. ¡Escribe el primero!';
      list.append(p);
    }
  }
  const unempty = () => { const e = list.querySelector('.chat-empty'); if (e) e.remove(); };

  // ---- Amigos: tocar un apodo abre una tarjeta para añadirlo (o quitarlo); "Amigos" muestra tu lista ----
  const card = $('chat-card'), fbox = $('chat-friends'), fbtn = $('chat-friends-btn'), form = $('chat-form');
  let friends = [], showingFriends = false;
  const isFriend = nick => friends.some(f => f.nick === nick);
  async function loadFriends() {
    if (!authToken) { friends = []; return; }
    try { friends = (await api('/api/friends')).friends || []; } catch { /* sin lista: se puede seguir chateando */ }
    fbtn.textContent = '👥 Amigos' + (friends.length ? ' (' + friends.length + ')' : '');
  }
  function showCard(m) {
    if (!m.nick || m.nick === myNick) return;
    card.replaceChildren();
    const t = document.createElement('div'); t.className = 'chat-card-name';
    t.textContent = [flagOf(m.country), m.avatar, m.nick].filter(Boolean).join(' ');
    const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'primary';
    const ok = isFriend(m.nick);
    addBtn.textContent = ok ? '✖ Quitar de amigos' : '➕ Añadir amigo';
    addBtn.onclick = async () => {
      if (!authToken) { close(); return openLogin('Entra para tener amigos 👥'); }
      addBtn.disabled = true;
      try {
        if (ok) await api('/api/friends/remove', { method: 'POST', body: { nick: m.nick } });
        else await api('/api/friends/add', { method: 'POST', body: { msgId: m.id } });
        await loadFriends();
        say(ok ? m.nick + ' ya no es tu amigo' : '¡' + m.nick + ' es ahora tu amigo! 👥', 'ok');
        card.classList.add('hidden');
      } catch (err) { say(err.message, 'err'); addBtn.disabled = false; }
    };
    const x = document.createElement('button'); x.type = 'button'; x.textContent = 'Cancelar'; x.onclick = () => card.classList.add('hidden');
    const row = document.createElement('div'); row.className = 'chat-card-btns'; row.append(addBtn, x);
    card.append(t, row); card.classList.remove('hidden'); say('');
  }
  function renderFriends() {
    fbox.replaceChildren();
    if (!friends.length) {
      const p = document.createElement('p'); p.className = 'muted'; p.textContent = authToken
        ? 'Aún no tienes amigos. En el chat, toca el apodo de alguien para añadirlo.'
        : 'Entra con tu cuenta para tener amigos.';
      fbox.append(p); return;
    }
    friends.forEach(f => {
      const row = document.createElement('div'); row.className = 'chat-friend';
      const name = document.createElement('span'); name.className = 'who';
      name.textContent = [flagOf(f.country), f.avatar, f.nick].filter(Boolean).join(' ');
      row.append(name);
      if (f.lat != null && f.lng != null) {
        const go = document.createElement('button'); go.type = 'button'; go.textContent = '📍'; go.title = 'Ir a su terreno';
        go.onclick = () => { close(); map.flyTo({ lat: f.lat, lng: f.lng }, 18); };
        row.append(go);
      }
      const del = document.createElement('button'); del.type = 'button'; del.textContent = '✖'; del.title = 'Quitar de amigos';
      del.onclick = async () => {
        try { await api('/api/friends/remove', { method: 'POST', body: { nick: f.nick } }); await loadFriends(); renderFriends(); }
        catch (err) { say(err.message, 'err'); }
      };
      row.append(del);
      fbox.append(row);
    });
  }
  function setFriendsView(on) {
    showingFriends = on;
    list.classList.toggle('hidden', on); fbox.classList.toggle('hidden', !on); form.classList.toggle('hidden', on);
    card.classList.add('hidden');
    fbtn.textContent = on ? '💬 Volver al chat' : '👥 Amigos' + (friends.length ? ' (' + friends.length + ')' : '');
    if (on) renderFriends();
  }
  fbtn.onclick = () => setFriendsView(!showingFriends);

  // ---- Carga y conexión en directo ----
  async function load(after) {
    try {
      const j = await api('/api/chat?' + qs(pos) + (after ? '&after=' + after : ''));
      unempty(); (j.messages || []).forEach(add); empty();
    } catch (e) { say(e.message, 'err'); }
  }
  function connect() {
    closeStream();
    es = new EventSource('/api/chat/stream?' + qs(pos));
    es.onopen = () => { if (lastId) load(lastId); };      // si se cortó la conexión, recupera lo que faltaba
    es.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (!m) return;
      if (m.del) { remove(m.del); empty(); }
      else if (m.react) updateReacts(m.react.id, m.react.r);
      else { unempty(); add(m); }
    };
  }
  function closeStream() { if (es) { es.close(); es = null; } }

  function open() {
    pos = here();
    $('chat-sub').textContent = 'Habla con la gente que juega cerca de aquí (hasta ' + km() + ' km a la redonda).';
    list.replaceChildren(); seen.clear(); msgs.clear(); lastId = 0; say('');
    setFriendsView(false);
    modal.classList.remove('hidden');
    loadFriends();
    load(0).then(() => { setSeen(lastId); dot(false); connect(); });
  }
  function close() { modal.classList.add('hidden'); closeStream(); setSeen(lastId); }
  btn.addEventListener('click', open);
  $('chat-close').onclick = close;
  modal.addEventListener('pointerdown', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) closeStream(); else if (!modal.classList.contains('hidden')) load(lastId).then(connect); });

  $('chat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    if (!authToken) { close(); return openLogin('Entra para chatear 💬'); }
    if (!myNick) { close(); return openLogin('Elige tu apodo para chatear 💬'); }
    $('chat-send').disabled = true;
    try {
      const j = await api('/api/chat/send', { method: 'POST', body: { lat: pos.lat, lng: pos.lng, text, avatar, country } });
      input.value = ''; say(''); unempty(); add(j.message);
    } catch (err) { say(err.message, 'err'); }
    finally { $('chat-send').disabled = false; input.focus(); }
  });
})();
