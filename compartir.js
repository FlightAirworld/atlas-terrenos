'use strict';
// «Compartir imagen»: dibuja en un lienzo una tarjeta vertical (1080×1350, buena para WhatsApp e Instagram) y la comparte o la descarga como PNG.
// Hay dos tarjetas: la del TERRENO (la casa, el nombre del dueño, el nivel y los «me gusta») y la del BARRIO (una vista de 5×5 parcelas
// alrededor del terreno, con las casas y los nombres de los vecinos). Las dos llevan el nombre del juego y su dirección.
// Todo ocurre en el navegador del jugador; lo único que puede pedir al servidor son las teselas del barrio que aún no estén cargadas.
// Globals de app.js: selected, houseFor, flagOf, isOtherWorld, colorFor, drawn, loadTile, tileCache, TILE, sizedUrl.
(function () {
  const $ = id => document.getElementById(id);
  const anchor = $('share-btn');
  if (!anchor || !anchor.parentNode) return;

  const btn = document.createElement('button');
  btn.id = 'share-img-btn'; btn.type = 'button'; btn.className = 'hidden'; btn.style.margin = '0 0 8px';
  btn.textContent = '🖼️ Crear imagen para compartir';
  anchor.insertAdjacentElement('afterend', btn);
  const btnB = document.createElement('button');   // la del barrio: solo en terrenos de la Tierra con dueño
  btnB.id = 'share-barrio-btn'; btnB.type = 'button'; btnB.className = 'hidden'; btnB.style.margin = '0 0 8px';
  btn.insertAdjacentElement('afterend', btnB);

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
  let blob = null, blobUrl = null, fileName = 'mi-terreno.png', link = '', shareText = '', job = 0;

  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo cargar la imagen de la casa')); i.src = src; });
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fit(c, text, maxW, size, weight) {   // reduce la letra hasta que el texto cabe
    let s = size; do { c.font = `${weight} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; s -= 2; } while (c.measureText(text).width > maxW && s > 24);
  }

  const W = 1080, H = 1350;
  function newCanvas() { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return [cv, cv.getContext('2d')]; }
  function background(c) {   // cielo a prado, con unas nubes suaves
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8fd3fe'); g.addColorStop(0.55, '#d8f3dc'); g.addColorStop(1, '#74c69d');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.55)';
    [[170, 150, 90], [260, 130, 70], [840, 210, 80], [930, 190, 60], [610, 120, 50]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); });
  }
  function footer(c, y) {    // pie con el nombre del juego y su dirección
    c.textAlign = 'center';
    c.fillStyle = '#0b3d2e'; rr(c, 90, y, W - 180, 130, 36); c.fill();
    c.fillStyle = '#fff'; c.font = '700 40px system-ui, sans-serif'; c.fillText('Consigue tu terreno en el mundo real', W / 2, y + 56);
    c.fillStyle = '#ffd166'; c.font = '800 46px system-ui, sans-serif'; c.fillText('redecoraelmundo.com', W / 2, y + 110);
  }
  const toBlob = cv => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('No se pudo crear la imagen')), 'image/png'));

  async function draw(p) {
    const [cv, c] = newCanvas();
    background(c);
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
    footer(c, 1170);
    return toBlob(cv);
  }

  // ---------- Tarjeta del BARRIO: 5×5 parcelas alrededor del terreno ----------
  const R = 2, N = 2 * R + 1;                       // radio y lado de la cuadrícula
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const imgCache = new Map();                        // url -> Promise<Image|null> (una casa que no carga no debe romper la tarjeta)
  const loadHouse = url => { if (!imgCache.has(url)) imgCache.set(url, loadImg(url).catch(() => null)); return imgCache.get(url); };

  // Se asegura de que las teselas del barrio estén cargadas (app.js las guarda en `drawn` al recibirlas) y devuelve la cuadrícula
  async function gatherBarrio(p) {
    const keys = new Set();
    for (const dx of [-R, R]) for (const dy of [-R, R]) keys.add(Math.floor((p.x + dx) / TILE) + ',' + Math.floor((p.y + dy) / TILE));
    try {
      await Promise.all([...keys].map(k => { const [a, b] = k.split(',').map(Number); return loadTile(a, b); }));
      for (let i = 0; i < 20 && [...keys].some(k => { const e = tileCache.get(k); return e && e.busy; }); i++) await sleep(150);   // alguna ya venía en camino
    } catch (e) { /* con lo que haya cargado basta */ }
    const rows = [];
    for (let dy = R; dy >= -R; dy--) {               // el norte arriba, como en el mapa
      const row = [];
      for (let dx = -R; dx <= R; dx++) {
        const d = (dx || dy) ? drawn.get(`${p.x + dx}:${p.y + dy}`) : null, q = !dx && !dy ? p : (d && d.p);
        row.push(q && q.owner ? q : null);
      }
      rows.push(row);
    }
    return rows;
  }

  function clipText(c, text, maxW) {                 // recorta con «…» si no cabe
    if (c.measureText(text).width <= maxW) return text;
    while (text.length > 1 && c.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }

  async function drawBarrio(p) {
    const rows = await gatherBarrio(p);
    const cells = rows.flat().filter(Boolean);
    const thumb = q => { const u = houseFor(q.id, q.house); return typeof sizedUrl === 'function' ? sizedUrl(u, 's') : u; };   // miniatura: pesa poco y sobra para 168 px
    const urls = [...new Set(cells.map(thumb))], imgs = new Map();
    await Promise.all(urls.map(async u => imgs.set(u, await loadHouse(u))));

    const [cv, c] = newCanvas();
    background(c);
    c.textAlign = 'center'; c.fillStyle = '#0b3d2e';
    fit(c, 'Redecora El Mundo 🌎', 900, 70, 800); c.fillText('Redecora El Mundo 🌎', W / 2, 100);
    const flag = (typeof flagOf === 'function' && p.country) ? flagOf(p.country) : '';
    const who = [p.avatar || '', flag, p.owner].filter(Boolean).join(' ');
    const sub = p.mine ? '🏘️ Mi barrio' : `🏘️ El barrio de ${who}`;
    c.fillStyle = '#1b4332'; fit(c, sub, 940, 56, 800); c.fillText(sub, W / 2, 180);

    // Panel blanco con la cuadrícula
    const cell = 168, gap = 0, gridW = cell * N, px = (W - gridW) / 2, py = 232, pad = 22;
    c.save(); c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 36; c.shadowOffsetY = 14; c.fillStyle = '#eef7e2';
    rr(c, px - pad, py - pad, gridW + 2 * pad, gridW + 2 * pad, 40); c.fill(); c.restore();

    const mine = typeof colorFor === 'function' ? colorFor(p.owner) : '#087f5b';
    rows.forEach((row, ry) => row.forEach((q, rx) => {
      const x = px + rx * (cell + gap) + 5, y = py + ry * (cell + gap) + 5, s = cell - 10;
      const center = rx === R && ry === R;
      if (!q) {                                      // parcela libre: un cuadro de prado con una plantita
        c.fillStyle = '#d4eab9'; rr(c, x, y, s, s, 18); c.fill();
        c.globalAlpha = 0.6; c.font = '48px system-ui, sans-serif'; c.fillStyle = '#2d6a4f'; c.fillText('🌱', x + s / 2, y + s / 2 + 17); c.globalAlpha = 1;
        return;
      }
      const same = q.owner === p.owner;
      c.save(); c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 10; c.shadowOffsetY = 4; c.fillStyle = '#fff'; rr(c, x, y, s, s, 18); c.fill(); c.restore();
      const img = imgs.get(thumb(q));
      c.save(); rr(c, x + 6, y + 6, s - 12, s - 12 - 30, 12); c.clip();
      if (img) {
        const k = Math.min((s - 12) / img.width, (s - 42) / img.height), iw = img.width * k, ih = img.height * k;
        c.drawImage(img, x + (s - iw) / 2, y + 6 + (s - 42 - ih) / 2, iw, ih);
      } else { c.font = '56px system-ui, sans-serif'; c.fillStyle = '#000'; c.fillText('🏠', x + s / 2, y + s / 2 - 4); }
      c.restore();
      // Nombre del dueño debajo de la casa
      c.font = '700 20px system-ui, sans-serif'; c.fillStyle = '#1b4332';
      c.fillText(clipText(c, [q.avatar || '', q.owner].filter(Boolean).join(' '), s - 14), x + s / 2, y + s - 11);
      // Borde: el color del dueño del barrio en sus parcelas, gris suave en las de los vecinos
      c.lineWidth = same ? 6 : 2; c.strokeStyle = same ? mine : '#cdd8c0'; rr(c, x, y, s, s, 18); c.stroke();
      const lv = Math.max(1, Number(q.level) || 1);
      if (lv > 1) { c.fillStyle = '#ffd166'; c.beginPath(); c.arc(x + 22, y + 22, 16, 0, 7); c.fill(); c.fillStyle = '#0b3d2e'; c.font = '800 20px system-ui, sans-serif'; c.fillText(String(lv), x + 22, y + 29); }
      if (q.gold) { c.font = '34px system-ui, sans-serif'; c.fillText('👑', x + s - 24, y + 36); }
      if (center) { c.lineWidth = 8; c.strokeStyle = '#ffb703'; rr(c, x - 3, y - 3, s + 6, s + 6, 21); c.stroke(); }
    }));

    // Resumen
    const owners = new Set(cells.map(q => q.owner)); owners.delete(p.owner);
    const nb = owners.size, occ = cells.length;
    const line = nb ? `👥 ${nb} ${nb === 1 ? 'vecino' : 'vecinos'}   ·   🏠 ${occ} de ${N * N} terrenos con dueño` : `🏠 ${occ} de ${N * N} terrenos con dueño   ·   ¡busca vecinos!`;
    c.textAlign = 'center'; c.fillStyle = '#0b3d2e'; fit(c, line, 960, 40, 700); c.fillText(line, W / 2, py + gridW + pad + 60);
    footer(c, 1205);
    return toBlob(cv);
  }

  const canBarrio = p => !!(p && p.owner && !isOtherWorld(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && typeof drawn !== 'undefined' && typeof loadTile === 'function');

  async function open(kind) {
    const p = typeof selected !== 'undefined' ? selected : null;
    if (!p || !p.owner) return;
    const barrio = kind === 'barrio' && canBarrio(p), me = ++job;
    $('share-img-title').textContent = barrio ? '🏘️ Tu barrio' : '🖼️ Tu imagen';
    say(barrio ? 'Creando la imagen de tu barrio…' : 'Creando la imagen…'); modal.classList.remove('hidden'); pic.removeAttribute('src'); blob = null;
    try {
      const b = await (barrio ? drawBarrio(p) : draw(p));
      if (me !== job) return;                       // se pidió otra mientras tanto
      blob = b;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(blob); pic.src = blobUrl;
      const slug = String(barrio ? p.owner : p.id).replace(/[^\w-]+/g, '-');
      fileName = (barrio ? 'barrio-' : 'terreno-') + slug + '.png';
      link = `${location.origin}${location.pathname}?t=${p.id}`;
      shareText = (barrio ? (p.mine ? 'Mira mi barrio en Redecora El Mundo 🌎 ' : 'Mira este barrio en Redecora El Mundo 🌎 ') : 'Mira mi terreno en Redecora El Mundo 🌎 ') + link;
      say('');
    } catch (e) { if (me !== job) return; blob = null; say(e.message || 'No se pudo crear la imagen', 'err'); }
  }
  $('share-img-send').onclick = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Redecora El Mundo', text: shareText }); return; }
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
  btn.addEventListener('click', () => open('terreno'));
  btnB.addEventListener('click', () => open('barrio'));

  // El botón solo sale en terrenos con dueño: se engancha a showPanel de app.js
  try {
    const orig = showPanel;
    showPanel = function (p) {
      const r = orig.apply(this, arguments);
      try {
        btn.classList.toggle('hidden', !(p && p.owner));
        const ok = canBarrio(p);
        btnB.classList.toggle('hidden', !ok);
        if (ok) btnB.textContent = p.mine ? '🏘️ Crear imagen de mi barrio' : '🏘️ Crear imagen de este barrio';
      } catch (e) {}
      return r;
    };
  } catch (e) { btn.classList.remove('hidden'); }
})();
