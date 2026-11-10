'use strict';
// Vecinos de al lado: en el panel de un terreno con dueño se listan los dueños de las (hasta) 8 parcelas que lo rodean.
// Tocar a un vecino lleva a su terreno. Si tú no tienes vecinos, se te anima a invitar a un amigo (botón «Invita y gana» de invite.js).
// Solo usa lo que el mapa ya tiene cargado (drawn), no hace peticiones nuevas al servidor. app.js llama a window.vecinosPanel(p) desde showPanel().
(function () {
  const host = document.getElementById('p-owned');
  if (!host) return;

  const st = document.createElement('style');
  st.textContent = `
    #p-neighbors { margin: 10px 0 6px; }
    #p-neighbors .nb-title { margin: 0 0 6px; font-weight: 700; }
    #p-neighbors .nb-list { display: flex; flex-wrap: wrap; gap: 6px; }
    #p-neighbors .nb-chip { padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font-size: 14px; cursor: pointer; }
    #p-neighbors .nb-chip:active { transform: scale(.96); }
    #p-neighbors .nb-invite { width: 100%; padding: 9px; margin-top: 6px; }`;
  document.head.appendChild(st);

  const box = document.createElement('div');
  box.id = 'p-neighbors'; box.className = 'hidden';
  host.appendChild(box);

  const tr = s => (window.i18n && i18n.lang !== 'es' && i18n.t) ? i18n.t(s) : s;

  function neighborsOf(p) {
    const found = new Map();                                    // dueño -> parcela (un chip por vecino, aunque tenga varias al lado)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const d = drawn.get(`${p.x + dx}:${p.y + dy}`), q = d && d.p;
      if (q && q.owner && q.owner !== p.owner && !found.has(q.owner)) found.set(q.owner, q);
    }
    return [...found.values()];
  }

  function goTo(q) {
    const s = cfg.size, ll = { lat: (q.y + 0.5) * s - 90, lng: (q.x + 0.5) * s - 180 };
    try { map.flyTo(ll, Math.max(map.getZoom(), 17)); } catch (e) {}
    if (typeof selectAt === 'function') selectAt(ll);
  }

  window.vecinosPanel = function (p) {
    box.replaceChildren();
    // Solo Tierra (los otros mundos se dibujan aparte) y solo terrenos con dueño
    if (!p || !p.owner || p.world && p.world !== 'tierra' || typeof drawn === 'undefined' || !cfg || !Number.isFinite(p.x)) { box.classList.add('hidden'); return; }
    const list = neighborsOf(p);
    if (!list.length && !p.mine) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');

    const title = document.createElement('p');
    title.className = 'nb-title';
    title.textContent = list.length ? `👥 ${tr('Vecinos de al lado')} (${list.length})` : `🏜️ ${tr('Aún no tienes vecinos')}`;
    box.appendChild(title);

    if (list.length) {
      const row = document.createElement('div');
      row.className = 'nb-list';
      list.forEach(q => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'nb-chip';
        b.textContent = [q.avatar || '👤', typeof flagOf === 'function' ? flagOf(q.country) : '', q.owner].filter(Boolean).join(' ');
        b.onclick = () => goTo(q);
        row.appendChild(b);
      });
      box.appendChild(row);
    } else {
      const inv = document.getElementById('invite-btn');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'nb-invite';
      b.textContent = '👫 ' + tr('Invita a un amigo y gana créditos');
      b.onclick = () => { if (inv) inv.click(); };
      box.appendChild(b);
    }
  };
})();
