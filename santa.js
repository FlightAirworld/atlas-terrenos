'use strict';
// Papá Noel: cada hora (lo decide el servidor, ver server.js) llega volando en su trineo, aterriza en la casa de un jugador al azar
// y le deja un regalo (1 crédito). Todos los jugadores conectados lo ven y lo oyen; el dueño además recibe un mensaje.
(function () {
  if (typeof map === 'undefined' || !map) return;
  const REF_Z = 17, ALT = 190;   // ALT = altura del vuelo en píxeles de pantalla
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ev = null, skew = 0, sleigh = null, glow = null, banner = null, raf = 0, timers = [], gifted = false;
  const now = () => Date.now() + skew;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t * t * (3 - 2 * t);
  const sfx = n => { try { if (window.sfx) window.sfx(n); } catch (e) {} };
  const isMine = e => typeof myNick !== 'undefined' && myNick && e && String(e.owner || '').toLowerCase() === String(myNick).toLowerCase();

  const st = document.createElement('style');
  st.textContent = `
    .sn-wrap, .sn-glowwrap { background: transparent !important; border: 0 !important; pointer-events: none !important; }
    .sn-in { position: relative; width: 150px; height: 64px; }
    .sn-alt { position: absolute; inset: 0; transition: opacity .3s; }
    .sn-flip { width: 100%; height: 100%; }
    .sn-flip.flip { transform: scaleX(-1); }
    .sn-flip svg { overflow: visible; }
    .sn-shadow { position: absolute; left: 50%; bottom: -4px; width: 110px; height: 14px; margin-left: -55px; border-radius: 50%; background: rgba(0,0,0,.28); transition: opacity .2s; }
    .sn-say { position: absolute; left: 50%; top: -22px; transform: translateX(-50%) scale(.6); white-space: nowrap; font: 900 12px system-ui, sans-serif; background: #fff; color: #c92a2a;
      padding: 2px 8px; border-radius: 99px; box-shadow: 0 1px 4px rgba(0,0,0,.4); opacity: 0; transition: opacity .2s, transform .2s; }
    .sn-in.say .sn-say { opacity: 1; transform: translateX(-50%) scale(1); }
    .sn-gift { position: absolute; left: 50%; top: 10px; font-size: 22px; opacity: 0; }
    .sn-in.give .sn-gift { animation: sngift 1.6s ease-out forwards; }
    .sn-plus { position: absolute; left: 50%; top: -6px; transform: translateX(-50%); white-space: nowrap; font: 900 16px system-ui, sans-serif; color: #fff; text-shadow: 0 1px 3px #000, 0 0 8px #ffd43b; opacity: 0; }
    .sn-in.give .sn-plus { animation: snplus 2.4s ease-out forwards; }
    .sn-trail i { position: absolute; font-style: normal; font-size: 12px; opacity: 0; animation: sntw 1s ease-in-out infinite; }
    .sn-in.fly .sn-trail i { opacity: 1; }
    .sn-glow { position: absolute; left: 0; top: 0; width: max(calc(var(--ppx, 60) * 1px), 30px); height: max(calc(var(--ppy, 60) * 1px), 30px); transform: translate(-50%, -50%);
      border-radius: 50%; opacity: 0; transition: opacity 1s; background: radial-gradient(circle, rgba(255,230,120,.75), rgba(255,200,60,.3) 50%, rgba(255,200,60,0) 72%); animation: snglow .9s ease-in-out infinite alternate; }
    .sn-glow.on { opacity: 1; }
    .sn-glow span { position: absolute; font-size: clamp(12px, calc(var(--ppx, 60) * .12px), 30px); animation: sntw .8s ease-in-out infinite; }
    @keyframes sngift { 0% { transform: translate(-50%, 0) scale(.5); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-50%, 46px) scale(1.4); opacity: 0; } }
    @keyframes snplus { 0% { transform: translate(-50%, 30px) scale(.6); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translate(-50%, -26px) scale(1.2); opacity: 0; } }
    @keyframes sntw { 0%, 100% { transform: scale(.5); opacity: .2; } 50% { transform: scale(1.2); opacity: 1; } }
    @keyframes snglow { from { transform: translate(-50%, -50%) scale(.94); } to { transform: translate(-50%, -50%) scale(1.06); } }
    #santa-banner { position: fixed; left: 50%; top: 62px; z-index: 2500; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
      max-width: min(94vw, 420px); padding: 8px 12px; border-radius: 14px; color: #fff; font: 700 13px/1.25 system-ui, sans-serif;
      background: linear-gradient(135deg, #d6283a, #8e1424); box-shadow: 0 4px 14px rgba(0,0,0,.35); border: 2px solid #fff; }
    #santa-banner.hidden { display: none; }
    #santa-banner.mine { animation: snbeat .8s ease-in-out infinite alternate; }
    #santa-banner button { flex: none; border: 0; border-radius: 99px; padding: 6px 12px; font: 800 12px system-ui, sans-serif; background: #fff; color: #b3202f; cursor: pointer; }
    @keyframes snbeat { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.04); } }
    #santa-modal .modal-card { text-align: center; }
    #santa-modal .big { font-size: 56px; line-height: 1; }
    #santa-modal h2 { color: #c92a2a; margin: 8px 0; font-size: 19px; }
    #santa-modal img { width: 120px; height: 120px; object-fit: cover; border-radius: 10px; margin: 6px 0; box-shadow: 0 0 0 3px #ffd43b; }
    #santa-modal .reward { background: #ebfbee; color: #1b6e2f; border-radius: 10px; padding: 8px 10px; margin: 8px 0; font-size: 15px; }
    @media (prefers-reduced-motion: reduce) { .sn-glow, .sn-glow span, .sn-trail i, #santa-banner.mine { animation: none; } }`;
  document.head.appendChild(st);
  map.createPane('santa');
  const pane = map.getPane('santa'); pane.style.zIndex = 597; pane.style.pointerEvents = 'none';

  // ---------- Dibujo: Papá Noel en su trineo tirado por dos renos (mira a la derecha) ----------
  const reindeer = x => `<g transform="translate(${x} 0)">
      <line x1="6" y1="38" x2="4" y2="50" stroke="#6b4423" stroke-width="2.6" stroke-linecap="round">${reduce ? '' : '<animateTransform attributeName="transform" type="rotate" values="-30 6 38;30 6 38;-30 6 38" dur=".5s" repeatCount="indefinite"/>'}</line>
      <line x1="20" y1="38" x2="22" y2="50" stroke="#6b4423" stroke-width="2.6" stroke-linecap="round">${reduce ? '' : '<animateTransform attributeName="transform" type="rotate" values="30 20 38;-30 20 38;30 20 38" dur=".5s" repeatCount="indefinite"/>'}</line>
      <ellipse cx="13" cy="33" rx="13" ry="7" fill="#9a6a3a"/>
      <path d="M23 29 L30 18" stroke="#9a6a3a" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="33" cy="16" rx="6.5" ry="4.6" fill="#9a6a3a"/>
      <circle cx="39" cy="17" r="2.5" fill="#e03131"/>
      <circle cx="35" cy="14.5" r="1" fill="#222"/>
      <path d="M31 12 L28 3 M29.5 7.5 L25 6 M33 12 L35 3 M34.2 7.4 L38.5 5" stroke="#5a3a1c" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <rect x="21" y="26" width="6" height="3" rx="1.5" fill="#d6283a"/></g>`;
  function sleighSVG() {
    return `<svg width="150" height="64" viewBox="0 0 150 64" aria-hidden="true">
      <!-- riendas -->
      <path d="M46 26 Q70 18 92 30 M46 28 Q80 22 120 30" stroke="#d4a017" stroke-width="1.2" fill="none"/>
      ${reindeer(96)}${reindeer(62)}
      <!-- trineo -->
      <path d="M2 50 Q-2 44 4 42 L50 42 Q56 42 54 48 Q52 54 44 54 L10 54 Q4 54 2 50Z" fill="#d4a017"/>
      <path d="M6 40 L6 22 Q6 17 11 17 L40 17 Q46 17 46 23 L50 40 Q50 46 42 46 L12 46 Q6 46 6 40Z" fill="#c9202f"/>
      <path d="M6 40 Q26 46 50 40" stroke="#ffd43b" stroke-width="2" fill="none"/>
      <!-- saco de regalos -->
      <path d="M8 28 Q4 14 14 12 Q24 12 20 28Z" fill="#8a5a2b"/>
      <rect x="9" y="6" width="7" height="7" fill="#339af0"/><rect x="9" y="6" width="7" height="2" fill="#fff"/>
      <rect x="15" y="4" width="6" height="8" fill="#51cf66"/><rect x="17.5" y="4" width="1.5" height="8" fill="#fff"/>
      <!-- Papá Noel -->
      <rect x="26" y="20" width="14" height="16" rx="5" fill="#e03131"/><rect x="26" y="28" width="14" height="2.5" fill="#222"/><rect x="31.5" y="28" width="3" height="2.5" fill="#ffd43b"/>
      <circle cx="33" cy="15" r="5.2" fill="#f1c9a5"/>
      <path d="M27.4 17 Q33 29 38.6 17 Q33 20 27.4 17Z" fill="#fff"/>
      <circle cx="35" cy="14" r=".8" fill="#222"/><circle cx="37" cy="16" r="1.1" fill="#e8a38f"/>
      <path d="M27.4 13 Q33 -2 39 12 Z" fill="#e03131"/><rect x="27" y="11.6" width="12.2" height="2.6" rx="1.3" fill="#fff"/><circle cx="26.5" cy="4" r="2.4" fill="#fff"/>
      <line x1="38" y1="24" x2="49" y2="26" stroke="#e03131" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }
  const TRAIL = [[-4, 22], [-14, 30], [-8, 40], [-22, 18], [-20, 44]];

  const sizeDeg = () => (typeof cfg !== 'undefined' && cfg && cfg.size) || 0.0005;
  const halfRef = () => sizeDeg() * 512 * Math.pow(2, REF_Z - 1) / 360 / 2;
  const scaleNow = () => Math.pow(2, map.getZoom() - REF_Z);

  function later(fn, ms) { if (ms >= 0) timers.push(setTimeout(fn, ms)); }
  function clearAll() {
    if (sleigh) { map.removeLayer(sleigh.mk); sleigh = null; }
    if (glow) { map.removeLayer(glow.mk); glow = null; }
    if (banner) banner.classList.add('hidden');
    timers.forEach(clearTimeout); timers = [];
    cancelAnimationFrame(raf); raf = 0;
  }
  function showBanner() {
    if (!banner) {
      banner = document.createElement('div'); banner.id = 'santa-banner'; banner.setAttribute('role', 'status');
      banner.innerHTML = '<span class="t"></span><button type="button">Ver</button>';
      banner.querySelector('button').onclick = () => { if (ev) map.flyTo({ lat: ev.lat, lng: ev.lng }, 18); };
      document.body.appendChild(banner);
    }
    const mine = isMine(ev);
    banner.classList.toggle('mine', mine);
    banner.querySelector('.t').textContent = mine ? '🎅 ¡PAPÁ NOEL VA A VISITAR TU CASA!' : `🎅 ¡Ha venido Papá Noel! Visita la casa de ${ev.owner || 'un jugador'}`;
    banner.classList.remove('hidden');
  }

  function setEvent(e) {
    if (ev && e && ev.id === e.id) return;
    clearAll();
    ev = e || null; gifted = false;
    if (!ev) return;
    const t0 = now();
    if (t0 >= ev.endsAt) { ev = null; return; }
    const ll = { lat: ev.lat, lng: ev.lng };
    // resplandor dorado sobre la parcela mientras está posado
    const ge = document.createElement('div'); ge.className = 'sn-glow';
    ge.innerHTML = [[18, 22], [78, 18], [12, 70], [84, 72], [48, 8], [50, 88]].map(p => `<span style="left:${p[0]}%;top:${p[1]}%;animation-delay:${(Math.random() * .8).toFixed(2)}s">✨</span>`).join('');
    glow = { el: ge, mk: L.marker(ll, { pane: 'santa', interactive: false, keyboard: false, icon: L.divIcon({ className: 'sn-glowwrap', html: ge, iconSize: [0, 0] }) }).addTo(map) };
    // trineo
    const we = document.createElement('div'); we.className = 'sn-in fly';
    we.innerHTML = `<div class="sn-shadow"></div><div class="sn-alt"><div class="sn-flip">${sleighSVG()}</div>
      <span class="sn-trail">${TRAIL.map(p => `<i style="left:${p[0]}px;top:${p[1]}px;animation-delay:${(Math.random() * .9).toFixed(2)}s">✨</i>`).join('')}</span>
      <span class="sn-say">¡JO JO JO!</span><span class="sn-gift">🎁</span><span class="sn-plus">+${ev.reward || 1} 🎟️</span></div>`;
    const dir = Math.random() < 0.5 ? 1 : -1;
    sleigh = { el: we, alt: we.querySelector('.sn-alt'), flip: we.querySelector('.sn-flip'), shadow: we.querySelector('.sn-shadow'), dir, dy: (Math.random() - 0.5) * 0.5, last: null,
      mk: L.marker(ll, { pane: 'santa', interactive: false, keyboard: false, icon: L.divIcon({ className: 'sn-wrap', html: we, iconSize: [150, 64], iconAnchor: [75, 56] }) }).addTo(map) };
    showBanner();
    // sonidos: campanillas al llegar, jo-jo-jo al aterrizar, campanitas al soltar el regalo
    if (t0 < ev.landAt - 1500) sfx('bells');
    later(() => { sfx('hohoho'); }, ev.landAt - t0 + 300);
    later(() => sfx('bells'), ev.leaveAt - t0);
    raf = requestAnimationFrame(frame);
  }

  function frame() {
    if (!ev || !sleigh) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const t = now(), sc = scaleNow();
    const c = map.project({ lat: ev.lat, lng: ev.lng }, REF_Z), hh = halfRef() / Math.max(0.2, Math.cos(ev.lat * Math.PI / 180));
    const far = 460 / sc, d = sleigh.dir;
    let gx = c.x, gy = c.y + hh * 0.1, alt = 0, vis = 1, moveX = -d, flying = true;
    if (t < ev.landAt) {                                      // llega volando desde un lado y desciende
      const k = ease(clamp((t - ev.startedAt) / Math.max(1, ev.landAt - ev.startedAt), 0, 1));
      gx = c.x + d * far * (1 - k); gy = c.y + hh * 0.1 + d * 0 + sleigh.dy * far * (1 - k);
      alt = ALT * (1 - k) + (reduce ? 0 : Math.sin(t / 260) * 6 * (1 - k)); vis = Math.min(1, (t - ev.startedAt) / 700);
    } else if (t < ev.leaveAt) {                              // posado en la casa
      flying = false;
      const ta = (t - ev.landAt) / 1000;
      if (ta < 0.6) alt = 6 * (1 - ta / .6);
      sleigh.el.classList.toggle('say', ta > 0.4 && ta < 2.6);
      glow.el.classList.add('on');
      if (t >= ev.giftAt && !gifted) { gifted = true; sleigh.el.classList.add('give'); sfx('gift'); }
    } else {                                                  // despega y se va por el otro lado
      const k = ease(clamp((t - ev.leaveAt) / Math.max(1, ev.endsAt - ev.leaveAt), 0, 1));
      gx = c.x - d * far * k; gy = c.y + hh * 0.1 - sleigh.dy * far * k;
      alt = ALT * k + (reduce ? 0 : Math.sin(t / 260) * 6 * k); vis = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; moveX = -d;
      glow.el.classList.remove('on'); sleigh.el.classList.remove('say');
    }
    sleigh.el.classList.toggle('fly', flying);
    sleigh.mk.setLatLng(map.unproject({ x: gx, y: gy }, REF_Z));
    sleigh.alt.style.transform = `translateY(${(-alt).toFixed(1)}px)`;
    sleigh.alt.style.opacity = vis.toFixed(2);
    sleigh.shadow.style.opacity = (flying || alt > 1 ? clamp(1 - alt / ALT, 0, 1) * 0.9 : 0.9).toFixed(2);
    const f = moveX < 0;
    if (f !== sleigh.last) { sleigh.last = f; sleigh.flip.classList.toggle('flip', f); }
  }

  // ---------- Mensajes ----------
  function onMsg(m) {
    if (!m) return;
    if (Number.isFinite(m.now)) skew = m.now - Date.now();
    if (m.type === 'start' && m.ev) setEvent(m.ev);
    else if (m.type === 'gift') { if (ev && !gifted) { /* el trineo lo hace por reloj */ } setTimeout(poll, 700); }
    else if (m.type === 'end') { clearAll(); ev = null; setTimeout(poll, 800); }
  }
  window.addEventListener('santa-msg', e => onMsg(e.detail));

  let modal = null;
  function showNotice(list) {
    if (modal || !list.length) return;
    const n = list[list.length - 1], many = list.length > 1, reward = list.reduce((s, x) => s + (x.reward || 0), 0);
    modal = document.createElement('div');
    modal.id = 'santa-modal'; modal.className = 'modal'; modal.setAttribute('role', 'alertdialog'); modal.setAttribute('aria-modal', 'true');
    let img = '';
    try { if (typeof houseFor === 'function') img = `<img src="${houseFor(n.parcelId || '', n.house)}" alt="">`; } catch (e) {}
    modal.innerHTML = `<div class="modal-card"><div class="big">🎅🎁</div><h2>¡PAPÁ NOEL TE HA DEJADO UN REGALO!</h2>${img}
      <p class="muted">${many ? `Papá Noel ha visitado tus casas ${list.length} veces.` : 'Papá Noel ha aterrizado en tu casa.'}</p>
      ${reward ? `<p class="reward">🎁 Has recibido <b>${reward} ${reward === 1 ? 'crédito' : 'créditos'}</b> 🎟️</p>` : ''}
      <button class="primary" type="button">¡Gracias, Papá Noel!</button></div>`;
    document.body.appendChild(modal);
    if (reward) { sfx('claim'); if (typeof refreshCredits === 'function') refreshCredits(); }
    modal.querySelector('button').onclick = async () => {
      modal.remove(); modal = null;
      try { await api('/api/santa/seen', { method: 'POST', body: {} }); } catch (e) {}
    };
  }

  async function poll() {
    try {
      const j = await api('/api/santa');
      if (Number.isFinite(j.now)) skew = j.now - Date.now();
      if (j.active && (!ev || ev.id !== j.active.id)) setEvent(j.active);
      if (!j.active && ev) { clearAll(); ev = null; }
      if (j.notices && j.notices.length) showNotice(j.notices);
    } catch (e) { /* sin sesión o servidor dormido: se reintenta */ }
  }
  setTimeout(poll, 2500); setInterval(poll, 20000);
  window.santaPoll = poll;
})();
