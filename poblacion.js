'use strict';
// POBLACIÓN: botón de Extras con los pueblos del juego, sus habitantes y su categoría (Aldea → Pueblo → Villa → Ciudad → Gran ciudad).
// La población crece sola con cada terreno que se reclama o se mejora (la calcula el servidor: /api/towns).
// Los nombres son los reales: salen de la ubicación del terreno (geocodificación inversa del servidor).
(function () {
  const btn = document.getElementById('towns-btn'), box = document.getElementById('towns'), body = document.getElementById('towns-body');
  if (!btn || !box || !body || typeof api !== 'function') return;

  const st = document.createElement('style');
  st.textContent = `
    #towns .modal-card { max-height: 86vh; overflow-y: auto; }
    .tw-total { display:flex; gap:10px; margin:6px 0 12px; }
    .tw-total div { flex:1; background:rgba(0,0,0,.05); border-radius:12px; padding:8px 10px; text-align:center; }
    .tw-total b { display:block; font-size:20px; }
    .tw-total small { opacity:.7; }
    .tw-here { border:2px solid #2a9d8f; border-radius:14px; padding:10px 12px; margin-bottom:12px; }
    .tw-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
    .tw-item { width:100%; text-align:left; border:1px solid rgba(0,0,0,.12); border-radius:12px; padding:9px 12px; background:transparent; color:inherit; cursor:pointer; font:inherit; }
    .tw-row { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
    .tw-name { font-weight:800; }
    .tw-pop { font-weight:800; white-space:nowrap; }
    .tw-sub { font-size:12px; opacity:.75; margin-top:2px; }
    .tw-bar { height:6px; border-radius:99px; background:rgba(0,0,0,.1); margin-top:6px; overflow:hidden; }
    .tw-bar i { display:block; height:100%; background:#2a9d8f; border-radius:99px; transition:width .6s; }
    .tw-up { color:#2a9d8f; font-weight:700; }
    .tw-pres { display:flex; align-items:center; gap:10px; margin:0 0 12px; padding:10px 12px; border-radius:14px; border:2px solid #e9c46a; background:rgba(233,196,106,.18); }
    .tw-presrow { font-size:12px; margin:4px 6px 0; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .tw-claim { border:none; background:#e9c46a; color:#1d3557; font-weight:800; border-radius:99px; padding:6px 12px; cursor:pointer; font:inherit; font-weight:800; }
    .tw-claim:disabled { opacity:.6; }
    .tw-pres-ico { font-size:28px; line-height:1; }
    .tw-pres small { display:block; opacity:.75; }
    .tw-pres b { font-size:18px; }
  `;
  document.head.appendChild(st);

  const fmt = n => Math.round(n).toLocaleString('es-ES');
  const flag = c => (c && typeof flagOf === 'function' ? flagOf(c) + ' ' : '');
  const shown = new Map();      // pueblo -> población que se vio la última vez (para animar el crecimiento)
  let timer = null;

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function countUp(node, from, to) {
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = fmt(to) + ' hab.'; return; }
    const t0 = performance.now(), dur = 900;
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur);
      node.textContent = fmt(from + (to - from) * k) + ' hab.';
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function card(t, tag) {
    const root = el(tag || 'button', 'tw-item');
    if (root.tagName === 'BUTTON') root.type = 'button';
    const row = el('div', 'tw-row');
    row.append(el('span', 'tw-name', flag(t.country) + t.city + ' · ' + t.tier));
    const pop = el('span', 'tw-pop'); row.appendChild(pop);
    countUp(pop, shown.has(t.city) ? shown.get(t.city) : t.pop, t.pop);
    shown.set(t.city, t.pop);
    root.appendChild(row);
    const sub = el('div', 'tw-sub', `${t.parcels} terreno${t.parcels === 1 ? '' : 's'}`);
    if (t.today) { const up = el('span', 'tw-up', ` · +${t.today} hoy`); sub.appendChild(up); }
    root.appendChild(sub);
    if (t.next != null) {
      const bar = el('div', 'tw-bar'), i = el('i');
      i.style.width = Math.max(2, Math.min(100, (t.pop - t.from) / (t.next - t.from) * 100)) + '%';
      bar.appendChild(i); root.appendChild(bar);
      root.appendChild(el('div', 'tw-sub', `Faltan ${fmt(t.next - t.pop)} hab. para ser ${t.nextName}`));
    }
    if (t.lat != null && t.lng != null && typeof map !== 'undefined') {
      root.title = 'Ir al pueblo';
      root.addEventListener('click', () => { box.classList.add('hidden'); stop(); map.flyTo({ lat: t.lat, lng: t.lng }, 16); });
    }
    return root;
  }

  // Presidente del pueblo (el que más terrenos tiene allí). Si eres tú, puedes cobrar sus créditos del mes.
  function presRow(t) {
    if (!t.president) return null;
    const d = el('div', 'tw-presrow');
    d.appendChild(el('span', null, `🏛️ Presidente: ${t.president.owner} · ${t.president.n} terreno${t.president.n === 1 ? '' : 's'}`));
    if (t.mine) {
      if (t.canClaim) {
        const b = el('button', 'tw-claim', `🎁 Cobrar ${t.prize} créditos`); b.type = 'button';
        b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            const j = await api('/api/town/president/claim', { method: 'POST', body: { city: t.city } });
            if (typeof credits !== 'undefined') { credits = j.credits; if (typeof updateCreditUi === 'function') updateCreditUi(); }
            if (window.sfx) sfx('claim');
            b.replaceWith(el('span', 'tw-up', `🎉 +${j.amount} créditos`));
          } catch (e) { b.disabled = false; b.replaceWith(el('span', null, e.message)); }
        });
        d.appendChild(b);
      } else if (t.claimed) d.appendChild(el('span', 'tw-up', '✅ Premio de este mes cobrado'));
    }
    return d;
  }

  function render(j, president) {
    body.replaceChildren();
    const tot = el('div', 'tw-total');
    [[fmt(j.total.pop), 'habitantes en el juego'], [fmt(j.total.parcels), 'terrenos']].forEach(([a, b]) => {
      const d = el('div'); d.append(el('b', null, a), el('small', null, b)); tot.appendChild(d);
    });
    body.appendChild(tot);
    if (president && president.owner) {   // el jugador con más terrenos es el presidente
      const pr = el('div', 'tw-pres');
      pr.appendChild(el('span', 'tw-pres-ico', '🏛️'));
      const txt = el('div');
      txt.appendChild(el('small', null, 'Presidente del juego'));
      txt.appendChild(el('b', null, flag(president.country) + president.owner));
      txt.appendChild(el('small', null, `${fmt(president.n)} terreno${president.n === 1 ? '' : 's'}`));
      pr.appendChild(txt);
      body.appendChild(pr);
    }
    if (j.here) {
      const h = el('div', 'tw-here');
      h.appendChild(el('div', 'tw-sub', '📍 Donde estás mirando'));
      h.appendChild(card(j.here, 'div'));
      { const pr = presRow(j.here); if (pr) h.appendChild(pr); }
      if (!j.here.parcels) h.appendChild(el('div', 'tw-sub', 'Aún nadie vive aquí: reclama un terreno y nacerá la población.'));
      body.appendChild(h);
    }
    body.appendChild(el('h3', null, 'Pueblos con más población'));
    if (!j.towns.length) {
      body.appendChild(el('p', 'muted', 'Aún no hay pueblos. Los nombres se calculan solos a partir de la ubicación de cada terreno; vuelve en un rato.'));
    } else {
      const ul = el('ul', 'tw-list');
      j.towns.forEach(t => { const li = el('li'); li.appendChild(card(t)); const pr = presRow(t); if (pr) li.appendChild(pr); ul.appendChild(li); });
      body.appendChild(ul);
    }
    const tiers = (j.tiers || []).map(t => `${t.name} (${fmt(t.from)}+)`).join(' → ');
    body.appendChild(el('p', 'muted', 'Cada terreno suma habitantes y cada nivel de mejora, más. ' + tiers));
  }

  async function load() {
    try {
      const c = typeof map !== 'undefined' && map.getCenter ? map.getCenter() : null;
      const q = c ? `?lat=${c.lat.toFixed(5)}&lng=${c.lng.toFixed(5)}` : '';
      const [towns, stats] = await Promise.all([api('/api/towns' + q), api('/api/stats').catch(() => null)]);
      render(towns, stats && stats.top && stats.top[0]);
    } catch (e) {
      if (!body.firstChild || body.textContent === 'Cargando…') body.textContent = 'No se pudo cargar la población: ' + e.message;
    }
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  btn.addEventListener('click', () => {
    body.replaceChildren(el('p', 'muted', 'Cargando…'));
    box.classList.remove('hidden');
    load(); stop(); timer = setInterval(load, 20000);    // mientras está abierto se refresca y se ve crecer
  });
  document.getElementById('towns-close').addEventListener('click', () => { box.classList.add('hidden'); stop(); });
  box.addEventListener('pointerdown', e => { if (e.target === box) { box.classList.add('hidden'); stop(); } });
})();
