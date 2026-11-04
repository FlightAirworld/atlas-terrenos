'use strict';
// El piromano: cada hora (lo decide el servidor, ver server.js) llega un piromano con una antorcha, prende fuego a la parcela
// de un jugador, arde unos 30 segundos y la parcela desaparece. Todos los jugadores conectados ven el incendio; el dueño,
// además, recibe el mensaje "EL PIROMANO TE HA QUEMADO UNA CASA" la próxima vez que entra (o al momento si está jugando).
(function () {
  if (typeof map === 'undefined' || !map) return;
  const REF_Z = 17;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ev = null, skew = 0, fire = null, pyro = null, banner = null, raf = 0;
  const now = () => Date.now() + skew;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t * t * (3 - 2 * t);

  const st = document.createElement('style');
  st.textContent = `
    .fire-wrap, .pyro-wrap { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .fire-box { position: absolute; left: 0; top: 0; width: max(calc(var(--ppx, 60) * 1px), 30px); height: max(calc(var(--ppy, 60) * 1px), 30px); transform: translate(-50%, -50%); }
    .fire-box.pre { display: none; }
    .fire-char { position: absolute; inset: 0; background: rgba(18, 9, 4, 0); transition: background 1s linear; }
    .fire-glow { position: absolute; inset: -14%; border-radius: 50%; opacity: 0; transition: opacity 1s;
      background: radial-gradient(circle, rgba(255,180,50,.8), rgba(255,90,0,.4) 45%, rgba(255,60,0,0) 72%); animation: fglow .45s ease-in-out infinite alternate; }
    .fire-box.lit .fire-glow { opacity: 1; }
    .fl { position: absolute; font-size: clamp(16px, calc(var(--ppx, 60) * .34px), 90px); line-height: 1; opacity: 0; transition: opacity .6s;
      transform: translate(-50%, -85%); animation: fflick .34s ease-in-out infinite alternate; filter: drop-shadow(0 0 6px #ff8a00); }
    .fl.on { opacity: 1; }
    .sm { position: absolute; left: 50%; top: 25%; width: 45%; height: 45%; border-radius: 50%; opacity: 0;
      background: radial-gradient(circle, rgba(35,35,35,.6), rgba(35,35,35,0) 70%); animation: fsmoke 2.8s ease-out infinite; }
    .fire-box.lit .sm { display: block; }
    @keyframes fglow { from { transform: scale(.94); } to { transform: scale(1.06); } }
    @keyframes fflick { from { transform: translate(-50%, -85%) scale(.88) rotate(-5deg); } to { transform: translate(-50%, -93%) scale(1.18) rotate(5deg); } }
    @keyframes fsmoke { from { transform: translate(-50%, 0) scale(.5); opacity: .7; } to { transform: translate(-50%, -170%) scale(1.7); opacity: 0; } }
    .pyro-in { width: 30px; height: 44px; transition: opacity .3s; }
    .pyro-in svg { overflow: visible; }
    .pyro-in.flip svg { transform: scaleX(-1); }
    .pyro-in .torch-fl { transform-origin: 20px -3px; animation: ftorch .22s ease-in-out infinite alternate; }
    .pyro-in.throw .torch-fl { transform: scale(1.5); }
    @keyframes ftorch { from { transform: scale(.85) rotate(-6deg); } to { transform: scale(1.2) rotate(6deg); } }
    #arson-banner { position: fixed; left: 50%; top: 62px; z-index: 2500; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
      max-width: min(94vw, 420px); padding: 8px 12px; border-radius: 14px; color: #fff; font: 700 13px/1.25 system-ui, sans-serif;
      background: linear-gradient(135deg, #d9480f, #a61e1e); box-shadow: 0 4px 14px rgba(0,0,0,.35); }
    #arson-banner.hidden { display: none; }
    #arson-banner.mine { background: linear-gradient(135deg, #e03131, #7a0c0c); animation: abeat .8s ease-in-out infinite alternate; }
    #arson-banner button { flex: none; border: 0; border-radius: 99px; padding: 6px 12px; font: 800 12px system-ui, sans-serif; background: #fff; color: #a61e1e; cursor: pointer; }
    @keyframes abeat { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.03); } }
    #arson-modal .modal-card { text-align: center; }
    #arson-modal .big { font-size: 54px; line-height: 1; animation: fflick .34s ease-in-out infinite alternate; }
    #arson-modal h2 { color: #c92a2a; margin: 8px 0; font-size: 19px; letter-spacing: .2px; }
    #arson-modal .reward { background: #ebfbee; color: #1b6e2f; border-radius: 10px; padding: 8px 10px; margin: 8px 0; font-size: 14px; }
    #arson-modal img { width: 120px; height: 120px; object-fit: cover; border-radius: 10px; filter: grayscale(.9) brightness(.55) sepia(.5); margin: 6px 0; }
    @media (prefers-reduced-motion: reduce) { .fl, .fire-glow, .sm, .pyro-in .torch-fl, #arson-banner.mine, #arson-modal .big { animation: none; } }`;
  document.head.appendChild(st);
  map.createPane('fire');
  const pane = map.getPane('fire');
  pane.style.zIndex = 596; pane.style.pointerEvents = 'none';

  // ---------- Dibujos ----------
  const FLAMES = [[22, 50, 0], [50, 42, .05], [78, 50, .1], [14, 78, .18], [50, 72, .26], [86, 78, .34], [30, 98, .44], [70, 98, .54], [50, 58, .66]];
  function fireEl() {
    const box = document.createElement('div');
    box.className = 'fire-box pre';
    box.innerHTML = '<div class="fire-char"></div><div class="fire-glow"></div>' +
      FLAMES.map(f => `<span class="fl" data-th="${f[2]}" style="left:${f[0]}%;top:${f[1]}%;animation-delay:${(Math.random() * .3).toFixed(2)}s">🔥</span>`).join('') +
      [0, .9, 1.8].map(d => `<span class="sm" style="animation-delay:${d}s"></span>`).join('');
    return box;
  }
  function pyroSVG() {
    return `<svg width="30" height="44" viewBox="-2 -16 30 46" aria-hidden="true">
      <ellipse cx="9" cy="27" rx="6" ry="1.6" fill="rgba(0,0,0,.3)"/>
      <line x1="7.5" y1="17" x2="7.5" y2="26" stroke="#222" stroke-width="3.2" stroke-linecap="round">${reduce ? '' : '<animateTransform attributeName="transform" type="rotate" values="-26 7.5 17;26 7.5 17;-26 7.5 17" dur=".55s" repeatCount="indefinite"/>'}</line>
      <line x1="10.5" y1="17" x2="10.5" y2="26" stroke="#222" stroke-width="3.2" stroke-linecap="round">${reduce ? '' : '<animateTransform attributeName="transform" type="rotate" values="26 10.5 17;-26 10.5 17;26 10.5 17" dur=".55s" repeatCount="indefinite"/>'}</line>
      <rect x="4" y="8" width="9" height="10" rx="3.2" fill="#3b3b44"/>
      <line x1="6" y1="10" x2="2.5" y2="16" stroke="#c9a27a" stroke-width="2.3" stroke-linecap="round"/>
      <line x1="12" y1="10" x2="18" y2="4" stroke="#c9a27a" stroke-width="2.3" stroke-linecap="round"/>
      <line x1="18" y1="4" x2="20" y2="-3" stroke="#7a4a1d" stroke-width="2.2" stroke-linecap="round"/>
      <g class="torch-fl"><path d="M20 -3 C15 -7 17 -11 20 -15 C23 -11 25 -7 20 -3Z" fill="#ff7a00"/><path d="M20 -4 C18 -7 19 -9 20 -11 C21.5 -9 22 -7 20 -4Z" fill="#ffd43b"/></g>
      <circle cx="8.5" cy="4.5" r="3.6" fill="#c9a27a"/>
      <path d="M4.6 4 Q8.5 -1.8 12.4 4 L12.4 2.6 Q8.5 -4.6 4.6 2.6Z" fill="#7a0c0c"/>
      <rect x="4.7" y="3.2" width="7.6" height="1.5" fill="#222"/>
    </svg>`;
  }

  // ---------- Geometría ----------
  const sizeDeg = () => (typeof cfg !== 'undefined' && cfg && cfg.size) || 0.0005;
  const halfRef = () => sizeDeg() * 512 * Math.pow(2, REF_Z - 1) / 360 / 2;     // medio ancho de parcela en px de mundo a REF_Z
  const scaleNow = () => Math.pow(2, map.getZoom() - REF_Z);

  function clearAll() {
    if (fire) { map.removeLayer(fire.mk); fire = null; }
    if (pyro) { map.removeLayer(pyro.mk); pyro = null; }
    if (banner) banner.classList.add('hidden');
    cancelAnimationFrame(raf); raf = 0;
  }
  function showBanner() {
    if (!banner) {
      banner = document.createElement('div'); banner.id = 'arson-banner'; banner.setAttribute('role', 'status');
      banner.innerHTML = '<span class="t"></span><button type="button">Ver</button>';
      banner.querySelector('button').onclick = () => { if (ev) map.flyTo({ lat: ev.lat, lng: ev.lng }, 18); };
      document.body.appendChild(banner);
    }
    const mine = typeof myNick !== 'undefined' && myNick && ev && String(ev.owner || '').toLowerCase() === String(myNick).toLowerCase();
    banner.classList.toggle('mine', !!mine);
    banner.querySelector('.t').textContent = mine ? '🔥 ¡EL PIROMANO ESTÁ QUEMANDO TU CASA!' : `🔥 ¡El piromano está quemando la casa de ${ev.owner || 'un jugador'}!`;
    banner.classList.remove('hidden');
  }

  function setEvent(e) {
    if (ev && e && ev.id === e.id) return;
    clearAll();
    ev = e || null;
    if (!ev) return;
    if (now() >= ev.endsAt) { ev = null; return; }
    const ll = { lat: ev.lat, lng: ev.lng };
    const fe = fireEl();
    fire = { el: fe, chars: fe.querySelector('.fire-char'), fls: [...fe.querySelectorAll('.fl')], lit: false, mk: L.marker(ll, { pane: 'fire', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'fire-wrap', html: fe, iconSize: [0, 0] }) }).addTo(map) };
    const a = Math.random() * Math.PI * 2;
    const pe = document.createElement('div'); pe.className = 'pyro-in'; pe.innerHTML = pyroSVG();
    pyro = { el: pe, dx: Math.cos(a), dy: Math.sin(a), flip: null, mk: L.marker(ll, { pane: 'fire', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'pyro-wrap', html: pe, iconSize: [30, 44], iconAnchor: [15, 40] }) }).addTo(map) };
    showBanner();
    raf = requestAnimationFrame(frame);
  }

  function frame() {
    if (!ev) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const t = now(), sc = scaleNow();
    const walk = Math.max(1, ev.igniteAt - ev.startedAt);
    // Fuego
    if (t >= ev.igniteAt) {
      if (!fire.lit) { fire.lit = true; fire.el.classList.remove('pre'); fire.el.classList.add('lit'); }
      const p = clamp((t - ev.igniteAt) / Math.max(1, ev.endsAt - ev.igniteAt), 0, 1);
      for (const f of fire.fls) f.classList.toggle('on', p >= Number(f.dataset.th));
      fire.chars.style.background = `rgba(18,9,4,${(p * 0.7).toFixed(2)})`;       // la casa se va ennegreciendo
    }
    // Piromano: llega andando, prende, y se va corriendo
    const c = map.project({ lat: ev.lat, lng: ev.lng }, REF_Z), hw = halfRef(), hh = hw / Math.max(0.2, Math.cos(ev.lat * Math.PI / 180));
    const spot = { x: c.x + pyro.dx * hw * 1.05, y: c.y + pyro.dy * hh * 1.05 };    // a un lado de la parcela
    const far = 150 / sc;
    let px, py, vis = 1, moveX = -pyro.dx;
    const tw = (t - ev.startedAt) / walk;
    if (tw < 1) {
      const k = ease(clamp(tw, 0, 1));
      px = spot.x + pyro.dx * far * (1 - k); py = spot.y + pyro.dy * far * (1 - k); vis = Math.min(1, tw * 6);
    } else {
      const ta = (t - ev.igniteAt) / 1000;
      if (ta < 1.6) { px = spot.x; py = spot.y; pyro.el.classList.toggle('throw', ta < .9); moveX = c.x - spot.x; }
      else {
        const k = clamp((ta - 1.6) / 6, 0, 1);
        px = spot.x + pyro.dx * far * k; py = spot.y + pyro.dy * far * k; vis = 1 - k; moveX = pyro.dx;
        pyro.el.classList.remove('throw');
      }
    }
    pyro.mk.setLatLng(map.unproject({ x: px, y: py }, REF_Z));
    pyro.el.style.opacity = vis.toFixed(2);
    const f = moveX < 0;
    if (f !== pyro.flip) { pyro.flip = f; pyro.el.classList.toggle('flip', f); }
  }

  // ---------- Mensajes ----------
  function onMsg(m) {
    if (!m) return;
    if (Number.isFinite(m.now)) skew = m.now - Date.now();
    if (m.type === 'start' && m.ev) setEvent(m.ev);
    else if (m.type === 'end') {
      const id = ev && ev.id;
      clearAll(); ev = null;
      if (m.burned && m.parcelId && window.removeParcelClient) window.removeParcelClient(m.parcelId);
      void id;
      setTimeout(poll, 1500);          // por si el dueño está jugando: le sale el aviso al momento
    }
  }
  window.addEventListener('arson-msg', e => onMsg(e.detail));

  let modal = null;
  function showNotice(list) {
    if (modal || !list.length) return;
    const n = list[list.length - 1], many = list.length > 1, reward = list.reduce((s, x) => s + (x.reward || 0), 0);
    modal = document.createElement('div');
    modal.id = 'arson-modal'; modal.className = 'modal'; modal.setAttribute('role', 'alertdialog'); modal.setAttribute('aria-modal', 'true');
    let img = '';
    try { if (typeof houseFor === 'function') img = `<img src="${houseFor(n.parcelId || '', n.house)}" alt="">`; } catch (e) {}
    modal.innerHTML = `<div class="modal-card"><div class="big">🔥</div><h2>EL PIROMANO TE HA QUEMADO UNA CASA</h2>${img}
      <p class="muted">${many ? `Has perdido ${list.length} parcelas.` : 'Has perdido una de tus parcelas.'}</p>
      ${reward ? `<p class="reward">🎁 Como compensación has recibido <b>${reward} ${reward === 1 ? 'crédito' : 'créditos'}</b> 🎟️</p>` : ''}
      <button class="primary" type="button">Entendido</button></div>`;
    document.body.appendChild(modal);
    if (reward && typeof refreshCredits === 'function') refreshCredits();      // el contador de créditos sube al momento
    modal.querySelector('button').onclick = async () => {
      modal.remove(); modal = null;
      try { await api('/api/arson/seen', { method: 'POST', body: {} }); } catch (e) {}
    };
  }

  async function poll() {
    try {
      const j = await api('/api/arson');
      if (Number.isFinite(j.now)) skew = j.now - Date.now();
      if (j.active && (!ev || ev.id !== j.active.id)) setEvent(j.active);
      if (!j.active && ev) { clearAll(); ev = null; }
      if (j.notices && j.notices.length) {
        j.notices.forEach(n => { if (window.removeParcelClient && n.parcelId) window.removeParcelClient(n.parcelId); });
        showNotice(j.notices);
      }
    } catch (e) { /* sin sesión o servidor dormido: se reintenta */ }
  }
  (window.apiReady || Promise.resolve()).then(() => { setTimeout(poll, 2500); setInterval(poll, 20000); });
  window.arsonPoll = poll;
})();
