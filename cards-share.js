'use strict';
// COMPARTIR CARTAS 📤: botón «Compartir» en cada carta (colección, ranking y Carta Negra).
//  · Dibuja en un lienzo una imagen vertical (1080×1350, buena para WhatsApp e Instagram) con la carta y quién la tiene, y la comparte o la descarga.
//  · El enlace es /carta/ID (con vista previa en WhatsApp, Telegram…) o ?carta=ID en el sitio estático. Al abrirlo se ve la carta SIN iniciar sesión.
// Todo el dibujo ocurre en el navegador. El servidor solo dice de qué temporada es la carta y quién la tiene (GET /api/cards/share?id=…).
// Usa: CardsCore (cards-core.js), CardsUI (cards.js), y los globals de app.js api() y flagOf().
(function () {
  if (!window.CardsCore || !window.CardsUI) return;
  const C = window.CardsCore, UI = window.CardsUI, $ = id => document.getElementById(id);
  const ID_RE = /^(?:\d{1,5}|N\d{4}-(?:0[1-9]|1[0-2]))$/i;
  const flag = c => { try { return (c && typeof flagOf === 'function' && flagOf(c)) || ''; } catch (e) { return ''; } };
  const linkFor = sid => (window.API_BASE ? `${location.origin}${location.pathname}?carta=${sid}` : `${location.origin}/carta/${sid}`);
  const infoOf = d => d.black ? C.blackInfo(d.month) : C.cardInfo(Number(d.id), d.season);
  const ownerText = o => o ? [o.avatar || '', flag(o.country), o.nick].filter(Boolean).join(' ') : '';

  // ---------- Ventana «Tu carta» ----------
  const modal = document.createElement('div');
  modal.id = 'card-share'; modal.className = 'modal cardsroot hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'card-share-title');
  modal.innerHTML =
    '<div class="modal-card" style="max-height:92vh;overflow-y:auto">' +
      '<button id="card-share-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="card-share-title">📤 Compartir carta</h2>' +
      '<img id="card-share-pic" alt="Imagen de la carta para compartir" style="width:100%;max-width:340px;display:block;margin:8px auto;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.25)">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="card-share-send" class="primary" type="button" style="flex:1 1 140px">📤 Compartir</button>' +
      '<button id="card-share-link" type="button" style="flex:1 1 140px">🔗 Copiar enlace</button>' +
      '<button id="card-share-dl" type="button" style="flex:1 1 140px">⬇️ Descargar</button></div>' +
      '<p id="card-share-msg" class="msg" aria-live="polite"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const pic = $('card-share-pic'), msg = $('card-share-msg');
  const say = (t, k = '') => { msg.textContent = t || ''; msg.className = 'msg ' + k; };
  let blob = null, blobUrl = null, fileName = 'carta.png', link = '', text = '';

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fit(c, t, maxW, size, weight) {   // reduce la letra hasta que el texto cabe
    let s = size; do { c.font = `${weight} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; s -= 2; } while (c.measureText(t).width > maxW && s > 24);
  }

  function draw(info, owner) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), ink = info.special ? '#e8c35a' : '#1b1b1b';
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0f172a'); bg.addColorStop(1, '#1e293b');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(W / 2, 560, 80, W / 2, 560, 640); glow.addColorStop(0, info.c2 + '66'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    // La carta
    const x = 130, y = 90, w = 820, h = 1010;
    c.save(); c.shadowColor = info.gold ? 'rgba(255,214,70,.8)' : 'rgba(0,0,0,.55)'; c.shadowBlur = info.gold ? 60 : 40; c.shadowOffsetY = 16;
    const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, info.c1); g.addColorStop(0.55, info.c2); g.addColorStop(1, info.c1);
    c.fillStyle = g; rr(c, x, y, w, h, 52); c.fill(); c.restore();
    c.lineWidth = 14; c.strokeStyle = info.gold && !info.special ? '#fff3b0' : info.c1; rr(c, x + 7, y + 7, w - 14, h - 14, 46); c.stroke();
    c.textAlign = 'left'; c.fillStyle = ink; c.font = '800 46px system-ui, sans-serif'; c.fillText(info.element + ' ' + info.elementName, x + 50, y + 96);
    c.textAlign = 'right'; c.fillText('⚡ ' + info.poder, x + w - 50, y + 96);
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(W / 2, y + 340, 210, 0, 7); c.fill();
    c.font = '300px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; c.fillStyle = ink; c.fillText(info.emoji, W / 2, y + 420);
    c.fillStyle = ink; fit(c, info.name, w - 100, 74, 800); c.fillText(info.name, W / 2, y + 620);
    c.font = '700 44px system-ui, sans-serif'; c.fillText((info.special ? '🖤 ' : info.gold ? '👑 ' : '') + info.rarityName, W / 2, y + 686);
    const stats = [['💪 Fuerza', info.fuerza], ['🛡️ Defensa', info.defensa], ['💨 Velocidad', info.velocidad], ['🍀 Suerte', info.suerte]]
      .concat(info.special ? [['😎 Carisma', info.carisma], ['⚡ Poder', info.poder]] : []);
    c.font = '700 42px system-ui, sans-serif';
    stats.forEach(([k, v], i) => { c.textAlign = 'left'; c.fillText(k + ' ' + v, i % 2 ? W / 2 + 20 : x + 60, y + 780 + Math.floor(i / 2) * 64); });
    c.textAlign = 'left'; c.font = '700 36px system-ui, sans-serif'; c.fillText(info.special ? 'ÚNICA' : 'Nº ' + info.serial, x + 50, y + h - 40);
    c.textAlign = 'right'; c.fillText(info.special ? info.month : 'Grupo ' + info.group, x + w - 50, y + h - 40);
    // Pie: quién la tiene y la dirección del juego
    c.textAlign = 'center'; c.fillStyle = '#ffffff';
    const who = owner ? 'Carta de ' + ownerText(owner) : 'Colecciona cartas únicas';
    fit(c, who, 940, 52, 800); c.fillText(who, W / 2, 1180);
    c.fillStyle = '#ffd166'; c.font = '800 46px system-ui, sans-serif'; c.fillText('Redecora El Mundo · redecoraelmundo.com', W / 2, 1265);
    return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('No se pudo crear la imagen')), 'image/png'));
  }

  async function open(id) {
    const sid = String(id || '').trim().toUpperCase();
    if (!ID_RE.test(sid)) return;
    say('Creando la imagen…'); modal.classList.remove('hidden'); pic.removeAttribute('src'); blob = null;
    try {
      const d = await api('/api/cards/share?id=' + encodeURIComponent(sid)), info = infoOf(d);
      if (!info) throw new Error('Esa carta no existe');
      blob = await draw(info, d.owner);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(blob); pic.src = blobUrl;
      fileName = 'carta-' + d.id.toLowerCase() + '.png'; link = linkFor(d.id);
      text = `Mira esta carta: ${info.emoji} ${info.name} (${info.rarityName}) en Redecora El Mundo 🌎 ${link}`;
      say('');
    } catch (e) { blob = null; say(e.message || 'No se pudo crear la imagen', 'err'); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); say('🔗 Enlace copiado', 'ok'); } catch (e) { say(link); }
  }
  $('card-share-send').onclick = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Redecora El Mundo', text }); return; }
      if (navigator.share) { await navigator.share({ title: 'Redecora El Mundo', text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(link); say('Este dispositivo no puede compartir imágenes: se ha copiado el enlace. Usa «Descargar» para guardar la imagen.', 'ok'); }
    catch (e) { say('Usa «Descargar» para guardar la imagen.'); }
  };
  $('card-share-link').onclick = copyLink;
  $('card-share-dl').onclick = () => {
    if (!blobUrl) return;
    const a = document.createElement('a'); a.href = blobUrl; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    say('⬇️ Imagen guardada', 'ok');
  };
  const close = () => modal.classList.add('hidden');
  $('card-share-close').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

  // ---------- Enlace recibido: /?carta=ID (o /carta/ID, que redirige aquí). Se ve sin iniciar sesión ----------
  const viewer = document.createElement('div');
  viewer.id = 'card-shared'; viewer.className = 'modal cardsroot hidden';
  viewer.setAttribute('role', 'dialog'); viewer.setAttribute('aria-modal', 'true'); viewer.setAttribute('aria-labelledby', 'card-shared-title');
  viewer.innerHTML =
    '<div class="modal-card" style="max-height:92vh;overflow-y:auto">' +
      '<button id="card-shared-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="card-shared-title">🃏 Carta compartida</h2><div id="card-shared-card"></div><p id="card-shared-owner" class="cmeta"></p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="card-shared-send" type="button" style="flex:1 1 140px">📤 Compartir</button>' +
      '<button id="card-shared-play" class="primary" type="button" style="flex:1 1 140px">🃏 Ir a mis cartas</button></div>' +
    '</div>';
  document.body.appendChild(viewer);
  const closeViewer = () => viewer.classList.add('hidden');
  $('card-shared-close').onclick = closeViewer;
  viewer.addEventListener('click', e => { if (e.target === viewer) closeViewer(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !viewer.classList.contains('hidden')) closeViewer(); });

  async function openShared(sid) {
    try {
      const d = await api('/api/cards/share?id=' + encodeURIComponent(sid)), info = infoOf(d);
      if (!info) return;
      const ce = UI.cardEl(info, true); ce.onclick = () => UI.zoomEl(UI.cardEl(info, false), ce, info.c2);
      $('card-shared-card').replaceChildren(ce);
      $('card-shared-owner').textContent = d.owner ? 'Esta carta es de ' + ownerText(d.owner) + '.' : d.owned ? 'Esta carta ya tiene dueño.' : d.black ? 'Nadie ha ganado todavía esta Carta Negra.' : 'Nadie la tiene todavía: ¡puede ser tuya!';
      $('card-shared-send').onclick = () => { closeViewer(); open(d.id); };
      $('card-shared-play').onclick = () => { closeViewer(); const b = $('cards-btn'); if (b) b.click(); };
      viewer.classList.remove('hidden');
    } catch (e) { /* carta que no existe o servidor dormido: no se molesta al jugador */ }
  }
  try {
    const sp = new URLSearchParams(location.search), cid = (sp.get('carta') || '').trim();
    if (cid && ID_RE.test(cid)) {
      sp.delete('carta'); history.replaceState(null, '', location.pathname + (sp.toString() ? '?' + sp : '') + location.hash);
      if (document.readyState === 'complete') openShared(cid.toUpperCase()); else window.addEventListener('load', () => openShared(cid.toUpperCase()), { once: true });
    }
  } catch (e) { /* sin enlace de carta */ }

  window.CardsShare = { open };
})();
