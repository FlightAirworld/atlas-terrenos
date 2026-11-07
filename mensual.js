'use strict';
// PREMIOS DEL MES (botón 🗓️ en Extras): calendario de recompensas por entrar cada día. Se reinicia cada mes; si te saltas un día vuelves al día 1.
// Rota crédito gratis → mejora de terreno gratis → giro extra de la ruleta, cada vez más grande; el último día del mes, el premio final (20 créditos).
// El servidor decide todo (ver monthlyGet / monthlyClaim en server.js). Aquí se dibuja, se avisa al jugador y se reclama.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api().
(function () {
  const $ = id => document.getElementById(id);
  const btn = $('monthly-btn');
  if (!btn) return;
  const fmt = n => String(n).replace('.', ',');
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const ICON = { credits: '🎟️', upgrade: '⬆️', spin: '🎡' };
  let S = null, tokenSeen, timer = null;
  window.freeUpgrades = 0;                                   // mejoras gratis disponibles (las usa el botón de subir nivel de app.js)

  const word = (rw, long) => {
    if (rw.type === 'credits') return long ? `${fmt(rw.amount)} ${rw.amount === 1 ? 'crédito gratis' : 'créditos gratis'}` : (rw.amount === 1 ? 'crédito' : 'créditos');
    if (rw.type === 'spin') return long ? (rw.amount === 1 ? '1 giro extra de la ruleta' : `${rw.amount} giros extra de la ruleta`) : (rw.amount === 1 ? 'giro' : 'giros');
    return long ? (rw.amount === 1 ? '1 mejora de terreno gratis' : `${rw.amount} mejoras de terreno gratis`) : (rw.amount === 1 ? 'mejora' : 'mejoras');
  };
  const shortVal = rw => rw.type === 'credits' ? fmt(rw.amount) : (rw.amount > 1 ? '×' + rw.amount : '1');

  const st = document.createElement('style');
  st.textContent = `
    #monthly .modal-card { padding: 0; max-height: min(90vh, 720px); overflow-y: auto; }
    #monthly .mh { background: linear-gradient(#0d5cb0, #083b78); color: #fff; text-align: center; padding: 18px 16px 14px; border-radius: 14px 14px 0 0; }
    #monthly .mh h2 { margin: 0; font-size: 22px; letter-spacing: .5px; }
    #monthly .mh .mm { opacity: .85; font-size: 13px; text-transform: capitalize; margin: 2px 0 8px; }
    #monthly .mh .mt { font-size: 12px; font-weight: 800; }
    #monthly .mh .mt b { color: #ffd43b; font-size: 15px; font-variant-numeric: tabular-nums; }
    #monthly .mb { padding: 12px 14px 16px; }
    #monthly .mp { height: 22px; border-radius: 99px; background: rgba(0,0,0,.18); overflow: hidden; position: relative; margin: 2px 0 10px; }
    #monthly .mp i { display: block; height: 100%; background: linear-gradient(90deg, #ffb703, #f59f00); transition: width .5s; }
    #monthly .mp span { position: absolute; inset: 0; text-align: center; font-size: 12px; font-weight: 800; line-height: 22px; }
    #monthly .mg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    #monthly .mc { position: relative; border-radius: 10px; padding: 14px 2px 5px; text-align: center; background: var(--card); border: 1px solid var(--line); min-height: 66px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
    #monthly .mc .d { position: absolute; top: 2px; left: 6px; font-size: 10px; opacity: .65; font-weight: 700; }
    #monthly .mc .ic { font-size: 20px; line-height: 1; }
    #monthly .mc .tx { font-size: 11px; font-weight: 800; line-height: 1.15; }
    #monthly .mc .tx small { display: block; font-weight: 600; font-size: 9px; opacity: .75; }
    #monthly .mc.done { opacity: .5; }
    #monthly .mc.done::after { content: '✅'; position: absolute; right: 2px; top: 0; font-size: 13px; }
    #monthly .mc.today { border: 2px solid #ffb703; box-shadow: 0 0 0 3px rgba(255,183,3,.35); animation: mpulse 1.4s ease-in-out infinite; }
    #monthly .mc.last { grid-column: 1 / -1; flex-direction: row; gap: 12px; min-height: 60px; padding: 8px; color: #222; background: linear-gradient(135deg, #ffe066, #f59f00); border-color: #b97800; }
    #monthly .mc.last .ic { font-size: 30px; }
    #monthly .mc.last .tx { font-size: 15px; text-align: left; }
    #monthly .mc.last .d { color: #222; }
    @keyframes mpulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    #monthly .mi { background: rgba(8,127,91,.12); border-radius: 10px; padding: 8px 10px; margin: 12px 0 8px; font-size: 13px; line-height: 1.4; }
    #monthly .mi.warn { background: rgba(230,57,70,.14); }
    #monthly .minv { font-size: 13px; font-weight: 700; margin: 6px 0; text-align: center; }
    #monthly-dot { position: absolute; top: 1px; right: 1px; width: 13px; height: 13px; border-radius: 50%; background: #e63946; border: 2px solid #fff; animation: dailypulse 1.4s infinite; }
    #monthly-dot.hidden { display: none; }
    #monthly-banner { position: fixed; left: 50%; bottom: 130px; transform: translateX(-50%); z-index: 1250; width: min(92vw, 380px); box-sizing: border-box;
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 16px; background: rgba(8,59,120,.96); color: #fff; font-size: 15px;
      box-shadow: 0 4px 18px rgba(0,0,0,.45); animation: mbin .4s ease-out; }
    #monthly-banner.hidden { display: none !important; }
    #monthly-banner span { flex: 1 1 100%; }
    #monthly-banner button { padding: 9px 14px; border-radius: 999px; border: 0; font-size: 14px; font-weight: bold; cursor: pointer; background: #ffb703; color: #222; }
    #monthly-banner #monthly-banner-x { background: transparent; color: #fff; border: 1px solid #fff8; margin-left: auto; }
    @keyframes mbin { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @media (prefers-reduced-motion: reduce) { #monthly .mc.today, #monthly-banner, #monthly-dot { animation: none; } }`;
  document.head.appendChild(st);

  const dot = document.createElement('span'); dot.id = 'monthly-dot'; dot.className = 'hidden'; btn.appendChild(dot);
  const box = document.createElement('div');
  box.id = 'monthly'; box.className = 'modal hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'monthly-title');
  box.innerHTML = `
    <div class="modal-card">
      <button id="monthly-close" class="close" type="button" aria-label="Cerrar" style="color:#fff">×</button>
      <div class="mh"><h2 id="monthly-title">🗓️ PREMIOS DEL MES</h2><div class="mm" id="monthly-month"></div><div class="mt">EL MES TERMINA EN: <b id="monthly-left">–</b></div></div>
      <div class="mb">
        <div class="mp"><i id="monthly-bar" style="width:0"></i><span id="monthly-prog"></span></div>
        <div id="monthly-grid" class="mg"></div>
        <p id="monthly-inv" class="minv"></p>
        <div id="monthly-note" class="mi"></div>
        <button id="monthly-claim" class="primary" type="button" disabled>Cargando…</button>
        <p id="monthly-msg" class="msg" aria-live="polite"></p>
      </div>
    </div>`;
  document.body.appendChild(box);
  const banner = document.createElement('div');
  banner.id = 'monthly-banner'; banner.className = 'hidden'; banner.setAttribute('role', 'status');
  banner.innerHTML = '<span id="monthly-banner-t"></span><button id="monthly-banner-go" type="button">Ver premio</button><button id="monthly-banner-x" type="button" aria-label="Cerrar aviso">×</button>';
  document.body.appendChild(banner);

  const msg = (t, k) => { const m = $('monthly-msg'); m.textContent = t || ''; m.className = 'msg ' + (k || ''); };
  const left = () => Math.max(0, S ? S.msToEnd - (Date.now() - S.at) : 0);
  function tickLeft() {
    const ms = left(), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
    $('monthly-left').textContent = S ? `${d}d ${h}h ${m}m ${s}s` : '–';
    if (S && ms <= 0) load();                                  // empieza un mes nuevo
  }
  function syncDots() {                                        // puntito rojo en el botón y en Extras
    const on = !!(S && S.canClaim);
    dot.classList.toggle('hidden', !on);
    if (window.syncExtrasDot) window.syncExtrasDot();
    else { const e = $('extras-dot'), dd = $('daily-dot'); if (e) e.classList.toggle('hidden', !on && !(dd && !dd.classList.contains('hidden'))); }
  }

  function render() {
    const grid = $('monthly-grid'), claim = $('monthly-claim'), note = $('monthly-note');
    if (!authToken || !S) {
      grid.innerHTML = ''; $('monthly-bar').style.width = '0'; $('monthly-prog').textContent = '';
      $('monthly-inv').textContent = ''; $('monthly-left').textContent = '–'; $('monthly-month').textContent = '';
      note.className = 'mi';
      note.innerHTML = '<b>Entra cada día y gana premios.</b> Créditos gratis, mejoras de terreno y giros extra de la ruleta, cada vez más grandes. El último día del mes, ¡<b>20 créditos</b>! Si te saltas un día, vuelves al día 1; el calendario se reinicia cada mes.';
      claim.disabled = false; claim.textContent = '👤 Entra para participar';
      return;
    }
    const [y, mo] = S.month.split('-').map(Number);
    $('monthly-month').textContent = `${MONTHS[mo - 1]} ${y}`;
    $('monthly-bar').style.width = (S.claimed / S.total * 100).toFixed(1) + '%';
    $('monthly-prog').textContent = `Día ${S.claimed} de ${S.total}`;
    let h = '';
    S.rewards.forEach(r => {
      const isToday = S.canClaim && r.day === S.nextDay, done = r.day <= S.claimed;
      const cls = 'mc' + (r.last ? ' last' : '') + (done ? ' done' : '') + (isToday ? ' today' : '');
      h += `<div class="${cls}" aria-label="Día ${r.day}: ${word(r, true)}${done ? ' (reclamado)' : ''}"><span class="d">${r.last ? 'ÚLTIMO DÍA · ' : ''}${r.day}</span>` +
        `<span class="ic">${r.last ? '🏆' : ICON[r.type]}</span><span class="tx">${r.last ? fmt(r.amount) + ' CRÉDITOS' : shortVal(r) + '<small>' + word(r, false) + '</small>'}</span></div>`;
    });
    grid.innerHTML = h;
    $('monthly-inv').textContent = (S.freeSpins || S.freeUpgrades) ? `Tienes: 🎡 ${S.freeSpins} ${S.freeSpins === 1 ? 'giro extra' : 'giros extra'} · ⬆️ ${S.freeUpgrades} ${S.freeUpgrades === 1 ? 'mejora gratis' : 'mejoras gratis'}` : '';
    if (S.canClaim) {
      const rw = S.rewards[S.nextDay - 1];
      note.className = 'mi' + (S.broken ? ' warn' : '');
      note.innerHTML = (S.broken ? '⚠️ Te saltaste un día y el calendario ha vuelto al día 1. ' : '') + `Hoy te toca (día ${S.nextDay}): <b>${word(rw, true)}</b>.`;
      claim.disabled = false; claim.textContent = `🎁 Reclamar premio del día ${S.nextDay}`;
    } else {
      note.className = 'mi';
      note.innerHTML = S.claimed >= S.total ? '🏆 ¡Has completado todo el mes! Vuelve el día 1 para empezar de nuevo.' : `✅ Hoy ya has reclamado. Mañana (día ${S.claimed + 1}): <b>${word(S.rewards[S.claimed], true)}</b>. ¡No te saltes ningún día!`;
      claim.disabled = true; claim.textContent = '✅ Vuelve mañana';
    }
    tickLeft();
  }

  async function load() {
    if (!authToken) { S = null; window.freeUpgrades = 0; syncDots(); render(); return; }
    try {
      const j = await api('/api/monthly', { method: 'GET' });
      S = { ...j, at: Date.now() }; window.freeUpgrades = j.freeUpgrades || 0;
      syncDots(); render(); maybeAnnounce();
      if (window.renderLevelBox && typeof selected !== 'undefined' && selected && selected.mine) { try { renderLevelBox(selected); } catch (e) {} }
    } catch (e) { /* sin conexión: se vuelve a intentar luego */ }
  }
  window.monthlyRefresh = load;

  // ---------- Aviso del premio de hoy ----------
  function introOpen() { const el = $('intro'); return !!el && !el.classList.contains('hidden'); }
  function maybeAnnounce() {
    if (!S || !S.canClaim) { banner.classList.add('hidden'); return; }
    let seen = null; try { seen = localStorage.getItem('monthlyAnn'); } catch (e) {}
    if (seen === S.today) return;
    const show = () => {
      if (!S || !S.canClaim) return;
      if (introOpen() || !box.classList.contains('hidden')) return void setTimeout(show, 2000);
      const rw = S.rewards[S.nextDay - 1];
      $('monthly-banner-t').innerHTML = `🗓️ <b>¡Tu premio del día ${S.nextDay} está listo!</b><br>${ICON[rw.type]} ${word(rw, true)}`;
      banner.classList.remove('hidden');
      if (window.sfx) sfx('gift');
      try { localStorage.setItem('monthlyAnn', S.today); } catch (e) {}
    };
    setTimeout(show, 2500);
  }
  $('monthly-banner-x').onclick = () => banner.classList.add('hidden');
  $('monthly-banner-go').onclick = () => { banner.classList.add('hidden'); openBox(); };

  // ---------- Ventana ----------
  function openBox() { msg(''); box.classList.remove('hidden'); box.querySelector('.modal-card').scrollTop = 0; render(); load(); clearInterval(timer); timer = setInterval(tickLeft, 1000); }
  function closeBox() { box.classList.add('hidden'); clearInterval(timer); }
  btn.addEventListener('click', openBox);
  $('monthly-close').onclick = closeBox;
  box.addEventListener('click', e => { if (e.target === box) closeBox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) closeBox(); });

  $('monthly-claim').onclick = async () => {
    if (!authToken) { closeBox(); openLogin('Entra para ganar los premios del mes 🗓️'); return; }
    if (!S || !S.canClaim) return;
    const b = $('monthly-claim'); b.disabled = true; msg('');
    try {
      const j = await api('/api/monthly/claim', { method: 'POST', body: {} });
      credits = j.credits; updateCreditUi();
      S = { ...j, at: Date.now() }; window.freeUpgrades = j.freeUpgrades || 0;
      banner.classList.add('hidden'); syncDots(); render();
      if (window.sfx) sfx(j.reward.last ? 'claim' : 'gift');
      msg(`🎉 ¡Día ${j.day}! Has ganado ${word(j.reward, true)}${j.reward.type === 'upgrade' ? '. Se usará solo la próxima vez que subas un terreno de nivel.' : j.reward.type === 'spin' ? '. Úsalo en la 🎡 ruleta.' : ''}`, 'ok');
    } catch (e) { msg(e.message, 'err'); await load(); }
  };

  // Cambios de sesión (entrar / salir), nuevo día y vuelta a la app
  setInterval(() => { if (authToken !== tokenSeen) { tokenSeen = authToken; S = null; load(); } }, 2000);
  setInterval(() => { if (!document.hidden) load(); }, 5 * 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  const dd = $('daily-dot');
  if (dd) new MutationObserver(syncDots).observe(dd, { attributes: true, attributeFilter: ['class'] });
  render();
})();
