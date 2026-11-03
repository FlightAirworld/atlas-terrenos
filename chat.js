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
      '<div id="chat-list" aria-live="polite"></div>' +
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
    const who = document.createElement('span'); who.className = 'who';
    who.textContent = [flagOf(m.country), m.avatar, m.nick].filter(Boolean).join(' ');
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
    modal.classList.remove('hidden');
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
