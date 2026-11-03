'use strict';
// Chat por zona. El mapa se divide en zonas de 0,02° (unos 2 km, el mismo tamaño que usa el servidor); al abrir el chat
// se entra en la zona donde está centrado el mapa. Leer es libre; para escribir hace falta cuenta con apodo.
(function () {
  if (typeof map === 'undefined' || !map || !window.EventSource) return;
  const btn = document.getElementById('chat-btn');
  if (!btn) return;
  const ZONE = 0.02, MAX = 200;
  const zoneOf = c => Math.floor((c.lng + 180) / ZONE) + ':' + Math.floor((c.lat + 90) / ZONE);

  // Ventana del chat
  const modal = document.createElement('div');
  modal.id = 'chat'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'chat-title');
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button id="chat-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="chat-title">💬 Chat de la zona</h2>' +
      '<p class="muted">Habla con la gente que juega cerca de aquí (unos 2 km a la redonda).</p>' +
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

  let zone = null, es = null, lastId = 0, adminKey = null;
  const seen = new Set();
  const isAdminView = () => { try { return localStorage.getItem('adminView') === '1'; } catch { return false; } };

  function add(m) {
    if (!m || seen.has(m.id)) return;
    seen.add(m.id); lastId = Math.max(lastId, m.id);
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
    row.append(text);
    list.append(row);
    if (near || m.nick === myNick) list.scrollTop = list.scrollHeight;
  }
  function remove(id) { const r = list.querySelector('.chat-msg[data-id="' + id + '"]'); if (r) r.remove(); }
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
      const p = document.createElement('p'); p.className = 'chat-empty muted'; p.textContent = 'Aún no hay mensajes en esta zona. ¡Escribe el primero!';
      list.append(p);
    }
  }
  const unempty = () => { const e = list.querySelector('.chat-empty'); if (e) e.remove(); };

  // Amigos: tocar un apodo abre una tarjeta para añadirlo (o quitarlo); "Amigos" muestra tu lista
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
    const add = document.createElement('button'); add.type = 'button'; add.className = 'primary';
    const ok = isFriend(m.nick);
    add.textContent = ok ? '✖ Quitar de amigos' : '➕ Añadir amigo';
    add.onclick = async () => {
      add.disabled = true;
      if (!authToken) { close(); return openLogin('Entra para tener amigos 👥'); }
      try {
        if (ok) await api('/api/friends/remove', { method: 'POST', body: { nick: m.nick } });
        else await api('/api/friends/add', { method: 'POST', body: { msgId: m.id } });
        await loadFriends();
        say(ok ? m.nick + ' ya no es tu amigo' : '¡' + m.nick + ' es ahora tu amigo! 👥', 'ok');
        card.classList.add('hidden');
      } catch (err) { say(err.message, 'err'); add.disabled = false; }
    };
    const x = document.createElement('button'); x.type = 'button'; x.textContent = 'Cancelar'; x.onclick = () => card.classList.add('hidden');
    const row = document.createElement('div'); row.className = 'chat-card-btns'; row.append(add, x);
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

  async function load(after) {
    try {
      const j = await api('/api/chat?zone=' + encodeURIComponent(zone) + (after ? '&after=' + after : ''));
      unempty(); (j.messages || []).forEach(add); empty();
    } catch (e) { say(e.message, 'err'); }
  }
  function connect() {
    closeStream();
    es = new EventSource('/api/chat/stream?zone=' + encodeURIComponent(zone));
    es.onopen = () => { if (lastId) load(lastId); };      // si se cortó la conexión, recupera lo que faltaba
    es.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m && m.del) { remove(m.del); empty(); } else { unempty(); add(m); }
    };
  }
  function closeStream() { if (es) { es.close(); es = null; } }

  function open() {
    zone = zoneOf(map.getCenter());
    list.replaceChildren(); seen.clear(); lastId = 0; say('');
    setFriendsView(false);
    modal.classList.remove('hidden');
    loadFriends();
    load(0).then(connect);
  }
  function close() { modal.classList.add('hidden'); closeStream(); }
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
      const j = await api('/api/chat/send', { method: 'POST', body: { zone, text, avatar, country } });
      input.value = ''; say(''); unempty(); add(j.message);
    } catch (err) { say(err.message, 'err'); }
    finally { $('chat-send').disabled = false; input.focus(); }
  });
})();
