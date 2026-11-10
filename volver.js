'use strict';
// Motivos para volver (lo que se ve sin abrir menús):
//  - Botón «Recoger +N» siempre a la vista cuando tus terrenos ya han producido créditos (un toque, con monedas volando al contador).
//    Avisa con «⏰» cuando un terreno está a punto de llenarse (deja de producir al llegar al tope).
//  - La 🔥 racha de días del regalo diario, pegada al botón 🎁 (antes solo se veía dentro de la ventana del regalo).
// Usa lo que ya hay en app.js: prodState / liveTotal() (producción en vivo), dailyState (racha), api(), updateCreditUi(), sfx.
(function () {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NEAR_CAP_MS = 30 * 60 * 1000;     // «a punto de llenarse»: menos de 30 min para el tope

  const st = document.createElement('style');
  st.textContent = `
    #collect-chip { position: fixed; left: 12px; top: 74px; z-index: 1000; display: none; align-items: center; gap: 6px; padding: 9px 14px;
      border: 0; border-radius: 999px; background: linear-gradient(135deg, #ffb703, #fb8500); color: #3a2200; font: 800 15px/1 system-ui, sans-serif;
      box-shadow: 0 4px 14px #0004; cursor: pointer; }
    #collect-chip.on { display: inline-flex; animation: chipbeat 1.8s ease-in-out infinite; }
    #collect-chip.warn { background: linear-gradient(135deg, #ff8a5b, #e63946); color: #fff; }
    #collect-chip:disabled { opacity: .7; animation: none; }
    @keyframes chipbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    @media (prefers-reduced-motion: reduce) { #collect-chip.on { animation: none; } }
    .coin-fly { position: fixed; z-index: 2100; pointer-events: none; font-size: 22px; transition: transform .9s cubic-bezier(.5,0,.8,.4), opacity .9s; }
    #streak-badge { position: absolute; right: -6px; bottom: -6px; padding: 1px 5px; border-radius: 999px; background: #ff7b00; color: #fff;
      font: 800 11px/1.3 system-ui, sans-serif; box-shadow: 0 1px 4px #0005; pointer-events: none; white-space: nowrap; }
    #streak-badge.hot { background: #e63946; }`;
  document.head.appendChild(st);

  // ---------- Botón «Recoger» ----------
  const chip = document.createElement('button');
  chip.id = 'collect-chip'; chip.type = 'button'; chip.setAttribute('data-nosound', '');
  document.body.appendChild(chip);

  const plural = (n, one, many) => n === 1 ? one : many;
  const tr = s => (window.i18n && i18n.lang !== 'es' && i18n.t) ? i18n.t(s) : s;
  let busy = false;

  function readyNow() {
    if (typeof authToken === 'undefined' || !authToken || typeof prodState === 'undefined' || !prodState || !prodState.parcels) return null;
    const v = liveTotal(), ready = Math.floor(v + 1e-9);
    const left = prodState.nextCapMs == null ? null : prodState.nextCapMs - (performance.now() - prodState.t0);
    return { ready, near: left != null && left > 0 && left < NEAR_CAP_MS };
  }
  function render() {
    if (busy) return;
    const r = readyNow();
    if (!r || r.ready < 1) { chip.classList.remove('on', 'warn'); return; }
    chip.classList.add('on'); chip.classList.toggle('warn', r.near);
    chip.textContent = `${r.near ? '⏰' : '🎟️'} ${tr('Recoger')} +${r.ready}`;
    chip.title = r.near ? tr('Un terreno está a punto de llenarse: recoge para no perder producción') : tr('Créditos listos para recoger');
  }

  function fly(from, to, n) {
    if (reduce) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'coin-fly'; c.textContent = '🪙';
      c.style.left = (from.x + (Math.random() - .5) * 30) + 'px'; c.style.top = (from.y + (Math.random() - .5) * 16) + 'px';
      document.body.appendChild(c);
      setTimeout(() => {
        c.style.transform = `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(.5)`;
        c.style.opacity = '.2';
      }, 30 + i * 70);
      setTimeout(() => c.remove(), 1200 + i * 70);
    }
  }

  chip.onclick = async () => {
    if (busy) return;
    busy = true; chip.disabled = true;
    const a = chip.getBoundingClientRect(), pill = document.getElementById('credit-count'), b = pill ? pill.getBoundingClientRect() : { left: innerWidth / 2, top: 20, width: 0, height: 0 };
    try {
      const j = await api('/api/production/collect', { method: 'POST', body: {} });
      credits = j.credits; updateCreditUi();
      if (typeof sfx === 'function') sfx('coin');
      fly({ x: a.left + a.width / 2, y: a.top + a.height / 2 }, { x: b.left + b.width / 2, y: b.top + b.height / 2 }, Math.min(10, 3 + j.collected));
      if (typeof flashToast === 'function') flashToast(`🎉 +${j.collected} ${plural(j.collected, 'crédito', 'créditos')}. ${tr('Ahora tienes')} ${j.credits}.`);
      if (typeof loadProduction === 'function') await loadProduction();
    } catch (e) {
      if (typeof flashToast === 'function') flashToast('⚠️ ' + (e && e.message ? e.message : 'No se pudo recoger'));
    }
    busy = false; chip.disabled = false; render();
  };

  // ---------- Racha pegada al 🎁 ----------
  const badge = document.createElement('span');
  badge.id = 'streak-badge'; badge.style.display = 'none';
  function placeBadge() {
    const b = document.getElementById('daily-btn');
    if (!b) return false;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.appendChild(badge);
    return true;
  }
  function renderStreak() {
    if (!badge.isConnected && !placeBadge()) return;
    const d = typeof dailyState !== 'undefined' ? dailyState : null;
    if (!d || !(d.streak > 0)) { badge.style.display = 'none'; return; }
    badge.style.display = '';
    badge.textContent = '🔥' + d.streak;
    badge.classList.toggle('hot', !!d.canClaim);           // en rojo: hoy todavía no has cobrado y la racha corre peligro
    badge.title = d.canClaim ? tr('¡Cobra hoy el regalo para no perder la racha!') : tr('Racha de días seguidos');
  }

  setInterval(() => { render(); renderStreak(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); renderStreak(); } });
})();
