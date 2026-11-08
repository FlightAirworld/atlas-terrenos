'use strict';
// «Compartir imagen»: dibuja en un lienzo una tarjeta vertical (1080×1350, buena para WhatsApp e Instagram) con la casa del terreno,
// el nombre del dueño, el nivel, los «me gusta» y la dirección del juego, y la comparte o la descarga como PNG.
// Todo ocurre en el navegador del jugador: no usa el servidor. Globals de app.js: selected, houseFor, flagOf, isOtherWorld.
(function () {
  const $ = id => document.getElementById(id);
  const anchor = $('share-btn');
  if (!anchor || !anchor.parentNode) return;

  const btn = document.createElement('button');
  btn.id = 'share-img-btn'; btn.type = 'button'; btn.className = 'hidden'; btn.style.margin = '0 0 8px';
  btn.textContent = '🖼️ Crear imagen para compartir';
  anchor.insertAdjacentElement('afterend', btn);

  const modal = document.createElement('div');
  modal.id = 'share-img'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'share-img-title');
  modal.innerHTML =
    '<div class="modal-card" style="max-height:92vh;overflow-y:auto">' +
      '<button id="share-img-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="share-img-title">🖼️ Tu imagen</h2>' +
      '<img id="share-img-pic" alt="Imagen del terreno para compartir" style="width:100%;max-width:360px;display:block;margin:8px auto;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.25)">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button id="share-img-send" class="primary" type="button" style="flex:1 1 140px">📤 Compartir</button><button id="share-img-dl" type="button" style="flex:1 1 140px">⬇️ Descargar</button></div>' +
      '<p id="share-img-msg" class="msg" aria-live="polite"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const pic = $('share-img-pic'), msg = $('share-img-msg');
  const say = (t, k = '') => { msg.textContent = t; msg.className = 'msg ' + k; };
  let blob = null, blobUrl = null, fileName = 'mi-terreno.png', link = '';

  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo cargar la imagen de la casa')); i.src = src; });
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fit(c, text, maxW, size, weight) {   // reduce la letra hasta que el texto cabe
    let s = size; do { c.font = `${weight} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; s -= 2; } while (c.measureText(text).width > maxW && s > 24);
  }

  async function draw(p) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    // Fondo: cielo a prado, con unas nubes suaves
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fd3fe'); g.addColorStop(0.55, '#d8f3dc'); g.addColorStop(1, '#74c69d');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.55)';
    [[170, 150, 90], [260, 130, 70], [840, 210, 80], [930, 190, 60], [610, 120, 50]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
    // Título
    c.textAlign = 'center'; c.fillStyle = '#0b3d2e'; fit(c, 'Redecora El Mundo 🌎', 900, 74, 800); c.fillText('Redecora El Mundo 🌎', W / 2, 120);
    // Casa dentro de una tarjeta blanca
    const img = await loadImg(houseFor(p.id, p.house));
    const boxW = 880, boxH = 640, bx = (W - boxW) / 2, by = 170;
    c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 36; c.shadowOffsetY = 14; c.fillStyle = '#fff'; rr(c, bx - 18, by - 18, boxW + 36, boxH + 36, 44); c.fill(); c.restore();
    c.save(); rr(c, bx, by, boxW, boxH, 30); c.clip();
    const k = Math.max(boxW / img.width, boxH / img.height), iw = img.width * k, ih = img.height * k;
    c.drawImage(img, bx + (boxW - iw) / 2, by + (boxH - ih) / 2, iw, ih); c.restore();
    // Dueño
    const flag = (typeof flagOf === 'function' && p.country) ? flagOf(p.country) : '';
    const name = [p.avatar || '', flag, p.owner || ''].filter(Boolean).join(' ') + (p.gold ? ' 👑' : '');
    c.fillStyle = '#0b3d2e'; fit(c, name, 940, 84, 800); c.fillText(name, W / 2, 940);
    const lv = Math.max(1, Number(p.level) || 1);
    c.font = '700 64px system-ui, sans-serif'; c.fillText('⭐'.repeat(lv), W / 2, 1025);
    const bits = [];
    if (p.likes) bits.push(`❤️ ${p.likes} ${p.likes === 1 ? 'me gusta' : 'me gusta'}`);
    bits.push(isOtherWorld(p) && window.worldInfo ? `🪐 ${window.worldInfo(p.world).name}` : `📍 Terreno ${p.id}`);
    c.font = '600 44px system-ui, sans-serif'; c.fillStyle = '#1b4332'; c.fillText(bits.join('   ·   '), W / 2, 1100);
    // Pie
    c.fillStyle = '#0b3d2e'; rr(c, 90, 1170, W - 180, 130, 36); c.fill();
    c.fillStyle = '#fff'; c.font = '700 40px system-ui, sans-serif'; c.fillText('Consigue tu terreno en el mundo real', W / 2, 1226);
    c.fillStyle = '#ffd166'; c.font = '800 46px system-ui, sans-serif'; c.fillText('redecoraelmundo.com', W / 2, 1280);
    return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('No se pudo crear la imagen')), 'image/png'));
  }

  async function open() {
    const p = typeof selected !== 'undefined' ? selected : null;
    if (!p || !p.owner) return;
    say('Creando la imagen…'); modal.classList.remove('hidden'); pic.removeAttribute('src');
    try {
      blob = await draw(p);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(blob); pic.src = blobUrl;
      fileName = 'terreno-' + String(p.id).replace(/[^\w-]+/g, '-') + '.png';
      link = `${location.origin}${location.pathname}?t=${p.id}`;
      say('');
    } catch (e) { blob = null; say(e.message || 'No se pudo crear la imagen', 'err'); }
  }
  $('share-img-send').onclick = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Redecora El Mundo', text: 'Mira mi terreno en Redecora El Mundo 🌎 ' + link }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(link); say('Este dispositivo no puede compartir imágenes: se ha copiado el enlace. Usa «Descargar» para guardar la imagen.', 'ok'); }
    catch (e) { say('Usa «Descargar» para guardar la imagen.'); }
  };
  $('share-img-dl').onclick = () => {
    if (!blobUrl) return;
    const a = document.createElement('a'); a.href = blobUrl; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    say('⬇️ Imagen guardada', 'ok');
  };
  const close = () => modal.classList.add('hidden');
  $('share-img-close').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  btn.addEventListener('click', open);

  // El botón solo sale en terrenos con dueño: se engancha a showPanel de app.js
  try {
    const orig = showPanel;
    showPanel = function (p) { const r = orig.apply(this, arguments); try { btn.classList.toggle('hidden', !(p && p.owner)); } catch (e) {} return r; };
  } catch (e) { btn.classList.remove('hidden'); }
})();
