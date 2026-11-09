'use strict';
// Campeonato de luchas (botón 🥊 en Extras): cada terreno es una carta con nivel, poder y elemento (🔥 > 🌿 > 💧 > 🔥).
// Eliges tu carta, el servidor elige rival y decide el combate (/api/fight/start); aquí solo se dibuja y se anima.
// El combate se ve dentro de un ring (canvas a pantalla completa): presentación automática de los dos luchadores, ~15 s de puñetazos
// y patadas al azar (el resultado ya viene decidido por el servidor: gana quien tiene que ganar), público alrededor animando,
// focos de luz, sonidos generados con Web Audio y, al terminar, la ceremonia de victoria: la cámara se acerca a la cara destrozada
// del ganador, que levanta el puño; entra una chica del ring con la copa y se la entrega; y se pasa solo a la clasificación.
// Hasta 3 luchas al día; cada victoria da 1 crédito. Clasificación mensual en /api/fight/rank.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), fmtNum().
(function () {
  const $ = id => document.getElementById(id);
  const btn = $('fight-btn');
  if (!btn) return;
  // ---------- Puntito rojo: tienes combates disponibles hoy (y al menos un terreno para luchar). También enciende el de «Extras» ----------
  const dot = document.createElement('span'); dot.id = 'fight-dot'; dot.className = 'hidden'; btn.appendChild(dot);
  const setDot = on => { dot.classList.toggle('hidden', !on); if (window.syncExtrasDot) window.syncExtrasDot(); };
  async function checkDot() {
    if (typeof authToken === 'undefined' || !authToken) return setDot(false);
    try { const j = await api('/api/fight', { method: 'GET' }); setDot(!!(j.on && j.left > 0 && j.parcels && j.parcels.length)); } catch (e) { /* sin conexión: se deja como está */ }
  }
  window.fightRefresh = checkDot;
  let tokenSeen = null;
  setInterval(() => { if (typeof authToken !== 'undefined' && authToken !== tokenSeen) { tokenSeen = authToken; checkDot(); } }, 2000);   // entrar / salir de la cuenta
  setInterval(() => { if (!document.hidden) checkDot(); }, 5 * 60e3);                                                                   // día nuevo = luchas nuevas
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDot(); });
  const fmt = n => (typeof fmtNum === 'function' ? fmtNum(n) : String(n));
  const EL = { fuego: ['🔥', '#e8590c'], planta: ['🌿', '#2f9e44'], agua: ['💧', '#1c7ed6'] };
  // Iconos SVG propios (trazo, heredan el color del texto): sustituyen a los emojis del campeonato para que se vean igual en todos los móviles
  const IP = {
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
    swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="M5 14l4 4"/><path d="M7 17l-3 3"/><path d="M3 19l2 2"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
    fist: '<path d="M6 10a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v3a5 5 0 0 1-5 5H9a3 3 0 0 1-3-3z"/><path d="M7.5 18v3h8v-3"/><path d="M6 11.5H4.5a1.5 1.5 0 0 0 0 3H6"/><path d="M10 9h5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5h-3.3a1.7 1.7 0 0 0 0 3.4h1.6a1.7 1.7 0 0 1 0 3.4H9.5"/><path d="M12 7.5v1.6M12 15.9v1.6"/>'
  };
  const ELI = { fuego: 'flame', planta: 'leaf', agua: 'drop' };
  const ico = (n, cls) => '<svg class="fg-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (IP[n] || '') + '</svg>';   // solo textos fijos del juego: nunca datos de jugadores
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const HAIRS = ['#1b1b1b', '#4a2c12', '#b8860b', '#0d0d0d', '#7a3b0c'];

  const st = document.createElement('style');
  st.textContent = `
    #fight .modal-card { width: min(440px, 100%); max-height: 90vh; overflow-y: auto; overscroll-behavior: contain; text-align: center; padding: 22px 18px 16px; background: var(--bg); background: linear-gradient(180deg, color-mix(in srgb, #e63946 13%, var(--bg)) 0, var(--bg) 150px); }
    #fight h2 { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 0 8px; font-size: 22px; letter-spacing: -.01em; }
    #fight h2 .fg-ic { width: 26px; height: 26px; color: #e63946; }
    .fg-ic { width: 1.15em; height: 1.15em; flex: none; vertical-align: -0.2em; }
    .fg-ic.el-fuego { color: #e8590c; } .fg-ic.el-planta { color: #2f9e44; } .fg-ic.el-agua { color: #1c7ed6; }
    .fg-ic.ok { color: #2f9e44; } .fg-ic.ko { color: #e03131; }
    #fg-info { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 2px 0 6px; }
    .fg-chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); background: rgba(128,128,128,.1); background: color-mix(in srgb, var(--fg) 6%, transparent); color: var(--fg); font-size: 12.5px; font-weight: 700; }
    #fg-tabs { display: flex; gap: 4px; margin: 10px 0 12px; padding: 4px; border-radius: 14px; background: rgba(128,128,128,.14); background: color-mix(in srgb, var(--fg) 7%, transparent); }
    #fg-tabs button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 8px; border: 0; border-radius: 10px; background: transparent; color: var(--muted); font-weight: 700; transition: background-color .2s, color .2s, box-shadow .2s; }
    #fg-tabs button.on { background: var(--bg); color: var(--fg); box-shadow: 0 1px 6px rgba(0,0,0,.2); }
    .fg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; margin: 10px 0 14px; max-height: 36vh; overflow-y: auto; padding: 4px; }
    .fg-card { position: relative; overflow: hidden; border: 2px solid var(--el, #888); border: 2px solid color-mix(in srgb, var(--el, #888) 55%, transparent); border-radius: 16px; padding: 8px 6px 7px; background: rgba(128,128,128,.1); background: linear-gradient(180deg, color-mix(in srgb, var(--el, #888) 20%, var(--bg)), color-mix(in srgb, var(--el, #888) 6%, var(--bg))); box-shadow: 0 2px 8px rgba(0,0,0,.14); cursor: pointer; color: inherit; font: inherit; transition: transform .16s, box-shadow .2s, border-color .2s; }
    .fg-card:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(0,0,0,.2); }
    .fg-card.sel { border-color: var(--el, #888); box-shadow: 0 0 0 3px rgba(255,212,59,.55), 0 8px 20px rgba(0,0,0,.25); box-shadow: 0 0 0 3px color-mix(in srgb, var(--el, #888) 45%, transparent), 0 8px 20px color-mix(in srgb, var(--el, #888) 38%, transparent); transform: translateY(-3px); }
    .fg-card.sel::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.28) 50%, transparent 65%); transform: translateX(-120%); animation: fg-shine 2.6s ease-in-out infinite; pointer-events: none; }
    @keyframes fg-shine { 0% { transform: translateX(-120%); } 60%, 100% { transform: translateX(120%); } }
    .fg-card img { width: 100%; height: 60px; object-fit: contain; display: block; filter: drop-shadow(0 4px 4px rgba(0,0,0,.3)); }
    .fg-card b { display: block; margin-top: 2px; font-size: 13px; }
    .fg-card small { display: inline-flex; align-items: center; justify-content: center; gap: 3px; font-size: 12px; font-weight: 700; opacity: .9; }
    .fg-el { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: var(--el, #888); color: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.35); }
    .fg-el .fg-ic { width: 14px; height: 14px; color: #fff; }
    #fg-go { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; font-size: 17px; font-weight: 800; letter-spacing: .02em; border-radius: 14px; border: 0; background: #e63946; background: linear-gradient(180deg, #ff5a67, #e63946 55%, #c1121f); color: #fff; box-shadow: 0 8px 20px rgba(230,57,70,.4), inset 0 1px 0 rgba(255,255,255,.3); cursor: pointer; transition: transform .12s, box-shadow .2s, filter .2s; }
    #fg-go .fg-ic { width: 22px; height: 22px; }
    #fg-go:not(:disabled):hover { filter: brightness(1.07); }
    #fg-go:not(:disabled):active { transform: scale(.97); }
    #fg-go:disabled { background: #888; background: color-mix(in srgb, var(--fg) 25%, var(--bg)); color: #eee; box-shadow: none; cursor: not-allowed; }
    #fg-out { font-size: 16px; font-weight: 800; min-height: 1.2em; margin: 6px 0; }
    #fg-last { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 6px 0 10px; padding: 10px 12px; border-radius: 12px; font-size: 16px; font-weight: 800; background: rgba(128,128,128,.12); }
    #fg-last:empty { display: none; }
    #fg-last.win { background: rgba(255,212,59,.22); } #fg-last.win .fg-ic { color: #f08c00; }
    #fg-last.lose { background: rgba(224,49,49,.14); } #fg-last.lose .fg-ic { color: #e03131; }
    #fg-rank { width: 100%; border-collapse: separate; border-spacing: 0 4px; margin-top: 4px; }
    #fg-rank th { padding: 2px 4px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); text-align: left; }
    #fg-rank td { padding: 8px 6px; font-size: 14px; text-align: left; background: rgba(128,128,128,.1); background: color-mix(in srgb, var(--fg) 5%, transparent); }
    #fg-rank td:first-child { width: 40px; text-align: center; border-radius: 10px 0 0 10px; }
    #fg-rank td:last-child { border-radius: 0 10px 10px 0; }
    #fg-rank td:nth-child(n+3), #fg-rank th:nth-child(n+3) { text-align: center; white-space: nowrap; }
    #fg-rank td:nth-child(2) { word-break: break-word; }
    #fg-rank tr.me td { background: rgba(255,212,59,.3); font-weight: 800; }
    .fg-medal { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; font-weight: 900; color: #3a2a00; box-shadow: inset 0 -2px 0 rgba(0,0,0,.18); }
    .fg-medal.m1 { background: linear-gradient(135deg, #ffe066, #f5b400); }
    .fg-medal.m2 { background: linear-gradient(135deg, #f1f3f5, #adb5bd); }
    .fg-medal.m3 { background: linear-gradient(135deg, #ffc9a0, #c77b3f); }
    .fg-mine { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; margin: 8px 0 0; font-weight: 800; }
    .fg-help { display: block; font-size: 12px; margin-top: 12px; line-height: 1.5; }
    #fight-btn { position: relative; }
    #fight-dot { position: absolute; top: 1px; right: 1px; width: 13px; height: 13px; border-radius: 50%; background: #e63946; border: 2px solid #fff; animation: dailypulse 1.4s infinite; }
    #fight-dot.hidden { display: none; }
    @media (prefers-reduced-motion: reduce) { #fight-dot { animation: none; } .fg-card.sel::after { animation: none; display: none; } .fg-card, #fg-go { transition: none; } }
    #fg-stage { position: fixed; inset: 0; z-index: 2500; background: #000; touch-action: none; }
    #fg-cv { width: 100%; height: 100%; display: block; }
    #fg-skip { position: absolute; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); padding: 8px 14px; border-radius: 20px; border: 1px solid #fff6; background: #0009; color: #fff; font-weight: 700; cursor: pointer; }`;
  document.head.appendChild(st);

  const box = document.createElement('div');
  box.id = 'fight'; box.className = 'modal hidden';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'fg-title');
  box.innerHTML =
    '<div class="modal-card">' +
    '<button id="fg-close" class="close" type="button" aria-label="Cerrar">×</button>' +
    '<h2 id="fg-title">' + ico('fist') + '<span>Campeonato</span></h2>' +
    '<p class="muted" id="fg-info">Cargando…</p>' +
    '<div id="fg-tabs"><button type="button" id="fg-t1" class="on">' + ico('swords') + '<span>Luchar</span></button><button type="button" id="fg-t2">' + ico('trophy') + '<span>Clasificación</span></button></div>' +
    '<div id="fg-v1"><p id="fg-out" aria-live="polite"></p>' +
    '<p class="muted" id="fg-pick">Elige tu carta (tu terreno):</p><div class="fg-grid" id="fg-grid"></div>' +
    '<p class="muted" id="fg-cardlab">🃏 Carta de refuerzo (opcional): suma poder y pone su elemento</p><select id="fg-card" aria-label="Carta de refuerzo"><option value="0">Sin carta</option></select>' +
    '<button id="fg-go" type="button" disabled>' + ico('fist') + '<span>¡Luchar!</span></button></div>' +
    '<div id="fg-v2" class="hidden"><p id="fg-last" aria-live="polite"></p><p class="muted" id="fg-season"></p><div id="fg-ranklist"></div></div>' +
    '<p class="muted fg-help">' + ico('flame', 'el-fuego') + ' gana a ' + ico('leaf', 'el-planta') + ' · ' + ico('leaf', 'el-planta') + ' gana a ' + ico('drop', 'el-agua') + ' · ' + ico('drop', 'el-agua') + ' gana a ' + ico('flame', 'el-fuego') + '. El rival lo elige el sistema (otro jugador de nivel parecido) y no pierde nada. El combate se ve en el ring, dura unos 15 segundos y se juega solo.</p>' +
    '</div>';
  document.body.appendChild(box);

  const stage = document.createElement('div');
  stage.id = 'fg-stage'; stage.className = 'hidden';
  stage.setAttribute('role', 'img'); stage.setAttribute('aria-label', 'Combate en el ring');
  stage.innerHTML = '<canvas id="fg-cv"></canvas><button id="fg-skip" type="button">Saltar ⏭</button>';
  document.body.appendChild(stage);

  let state = null, selected = null, busy = false;

  function card(c, extra) {                                    // dibuja una carta; todo texto de jugadores va con textContent
    const el = document.createElement(extra && extra.tag || 'button');
    if (el.tagName === 'BUTTON') el.type = 'button';
    el.className = 'fg-card'; el.style.setProperty('--el', (EL[c.element] || EL.fuego)[1]);
    const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy';
    img.src = /^images\/[\w.-]+$/.test(c.house || '') ? c.house : 'images/casa-1.webp';
    const ek = EL[c.element] ? c.element : 'fuego';
    const e = document.createElement('span'); e.className = 'fg-el'; e.innerHTML = ico(ELI[ek]); e.title = ek;
    const b = document.createElement('b'); b.textContent = (extra && extra.title) || ('Nivel ' + c.level);
    const s = document.createElement('small'); s.insertAdjacentHTML('afterbegin', ico('sword')); s.append(String(c.power) + (extra && extra.sub ? ' · ' + extra.sub : ''));
    el.append(e, img, b, s);
    return el;
  }

  function renderGrid() {
    const grid = $('fg-grid'); grid.textContent = '';
    for (const p of state.parcels) {
      const c = card(p); if (selected === p.id) c.classList.add('sel');
      c.addEventListener('click', () => { if (busy) return; selected = p.id; renderGrid(); refreshGo(); });
      grid.appendChild(c);
    }
    fillCards();
    $('fg-pick').textContent = state.parcels.length ? 'Elige tu carta (tu terreno):' : 'Necesitas al menos un terreno para luchar.';
  }
  let myCards = null;   // cartas del jugador (se piden una vez al abrir el campeonato)
  async function fillCards() {
    const sel = $('fg-card'), lab = $('fg-cardlab'); if (!sel || !lab) return;
    if (myCards === null) { myCards = []; try { if (window.CardsCore && authToken) { const j = await api('/api/cards', { method: 'GET' }); if (j.on) myCards = (j.owned || []).map(o => ({ id: o.id, season: j.season })); } } catch (e) {} }
    const keep = sel.value; sel.textContent = '';
    const none = document.createElement('option'); none.value = '0'; none.textContent = 'Sin carta'; sel.appendChild(none);
    myCards.map(m => window.CardsCore.cardInfo(m.id, m.season)).sort((x, y) => y.poder - x.poder).forEach(i => {
      const o = document.createElement('option'); o.value = i.id; o.textContent = i.emoji + ' ' + i.name + ' · ' + i.element + ' ⚡' + i.poder + ' (+' + Math.round(i.poder * 0.35) + '%)'; sel.appendChild(o);
    });
    sel.value = [...sel.options].some(o => o.value === keep) ? keep : '0';
    const has = myCards.length > 0; sel.classList.toggle('hidden', !has); lab.classList.toggle('hidden', !has);
  }
  function refreshGo() {
    const g = $('fg-go');
    g.disabled = busy || !selected || state.left <= 0;
    g.innerHTML = state.left > 0 ? ico('fist') + '<span>¡Luchar!</span>' : ico('clock') + '<span>Vuelve mañana</span>';
  }
  function chip(icon, text) { const c = document.createElement('span'); c.className = 'fg-chip'; c.insertAdjacentHTML('afterbegin', icon); c.append(text); return c; }
  function renderInfo() {
    const i = $('fg-info'); i.textContent = '';
    i.append(chip(ico('swords'), `Luchas de hoy: ${state.used}/${state.max}`),
      chip(ico('coin'), `Cada victoria: +${state.prize} ${state.prize === 1 ? 'crédito' : 'créditos'}`),
      chip(ico('check', 'ok'), `Este mes: ${state.wins}`), chip(ico('x', 'ko'), String(state.losses)));
  }

  async function load() {
    $('fg-out').textContent = '';
    if (!authToken) { $('fg-info').textContent = 'Entra con tu cuenta para luchar.'; $('fg-grid').textContent = ''; $('fg-go').disabled = true; return; }
    $('fg-info').textContent = 'Cargando…';
    try {
      state = await api('/api/fight', { method: 'GET' });
      if (!state.on) { $('fg-info').textContent = 'El campeonato no está disponible ahora.'; return; }
      if (!state.parcels.some(p => p.id === selected)) selected = state.parcels[0] ? state.parcels[0].id : null;
      renderInfo(); renderGrid(); refreshGo();
      setDot(!!(state.left > 0 && state.parcels.length));
    } catch (e) { $('fg-info').textContent = e.message; $('fg-go').disabled = true; }
  }

  // ====================================================================================================
  //  SONIDO (Web Audio, sin archivos): golpes, patadas, público, campana y locutor
  // ====================================================================================================
  let ac = null, master = null, nbuf = null, crowdG = null, crowdSrc = null;
  const sfxOn = () => !(window.soundOn && window.soundOn('efectos') === false);
  const vozOn = () => !(window.soundOn && window.soundOn('gente') === false);

  function initAudio() {
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); }
    catch (e) { ac = null; return; }
    if (!master) {
      master = ac.createGain(); master.connect(ac.destination);
      const n = ac.sampleRate * 2; nbuf = ac.createBuffer(1, n, ac.sampleRate);
      const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    master.gain.value = sfxOn() ? 0.9 : 0;
  }
  function noise(t, dur, type, f1, f2, vol, q) {
    if (!ac) return;
    const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f1, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q || 1;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.012, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(t, type, f1, f2, dur, vol, lp) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f1, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = o;
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); out = f; }
    out.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const SND = {
    punch(p) { if (!ac) return; const t = ac.currentTime; tone(t, 'sine', 170, 45, 0.14, 0.9 * p); noise(t, 0.09, 'bandpass', 1200, 500, 0.9 * p, 0.7); noise(t, 0.04, 'highpass', 3000, 0, 0.35 * p, 0.7); },
    kick(p) { if (!ac) return; const t = ac.currentTime; tone(t, 'sine', 120, 35, 0.22, 1.0 * p); noise(t, 0.16, 'lowpass', 2400, 300, 1.1 * p, 0.7); noise(t, 0.05, 'highpass', 2500, 0, 0.4 * p, 0.7); },
    whoosh() { if (!ac) return; noise(ac.currentTime, 0.22, 'bandpass', 500, 2200, 0.28, 1.2); },
    block() { if (!ac) return; const t = ac.currentTime; noise(t, 0.07, 'bandpass', 700, 0, 0.5, 2); tone(t, 'triangle', 240, 150, 0.08, 0.4); },
    grunt() { if (!ac) return; tone(ac.currentTime, 'sawtooth', 150, 95, 0.2, 0.2, 700); },
    thud() { if (!ac) return; const t = ac.currentTime; tone(t, 'sine', 80, 30, 0.3, 1.1); noise(t, 0.2, 'lowpass', 400, 0, 0.7, 0.7); },
    bell(n) { if (!ac) return; const t0 = ac.currentTime; for (let i = 0; i < n; i++) { const t = t0 + i * 0.45; tone(t, 'triangle', 1046, 0, 1.2, 0.55); tone(t, 'sine', 2093, 0, 0.9, 0.25); tone(t, 'sine', 3136, 0, 0.5, 0.1); } },
    ooh(p) { if (!ac) return; const t = ac.currentTime; noise(t, 0.9, 'bandpass', 700, 500, 0.3 * p, 0.8); tone(t, 'sawtooth', 260, 300, 0.8, 0.07 * p, 800); tone(t, 'sawtooth', 330, 380, 0.8, 0.05 * p, 800); },
    roar(sec) {
      if (!ac) return; const t = ac.currentTime;
      noise(t, sec, 'bandpass', 900, 700, 0.55, 0.5);
      for (let i = 0; i < sec * 22; i++) noise(t + Math.random() * sec, 0.03, 'highpass', 2500 + Math.random() * 2000, 0, 0.1, 0.5);   // aplausos
    },
    click() { if (!ac) return; const t = ac.currentTime; noise(t, 0.03, 'highpass', 3500, 0, 0.3, 0.7); noise(t + 0.05, 0.035, 'bandpass', 1800, 0, 0.22, 1); },   // disparo de cámara de fotos
    ding() { if (!ac) return; const t = ac.currentTime; tone(t, 'triangle', 1318, 0, 0.9, 0.35); tone(t + 0.09, 'triangle', 1760, 0, 1.1, 0.3); tone(t + 0.18, 'sine', 2637, 0, 0.8, 0.12); }   // brillo al entregar la copa
  };
  function crowdStart() {
    if (!ac) return;
    crowdSrc = ac.createBufferSource(); crowdSrc.buffer = nbuf; crowdSrc.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 550; f.Q.value = 0.4;
    crowdG = ac.createGain(); crowdG.gain.value = 0.02;
    crowdSrc.connect(f); f.connect(crowdG); crowdG.connect(master); crowdSrc.start();
  }
  function crowdLevel(exc) { if (crowdG && ac) crowdG.gain.setTargetAtTime(vozOn() ? 0.05 + 0.3 * exc : 0, ac.currentTime, 0.12); }
  function crowdStop() { try { if (crowdSrc) crowdSrc.stop(); } catch (e) {} crowdSrc = null; crowdG = null; }
  function say(txt) {
    try {
      if (!vozOn() || !sfxOn() || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(txt); u.lang = 'es-ES'; u.rate = 1; u.pitch = 0.8;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) {}
  }

  // ====================================================================================================
  //  GUION DEL COMBATE: eventos al azar, pero el final siempre coincide con el resultado del servidor
  // ====================================================================================================
  const WORDS_P = ['¡POW!', '¡BAM!', '¡PAM!', '¡PUM!'], WORDS_K = ['¡BOOM!', '¡PATADÓN!', '¡CRACK!'];
  function makePlan(winnerSide, reduced) {
    const loserSide = winnerSide === 'A' ? 'B' : 'A';
    const D = reduced ? 5 : rnd(14, 16.5);                       // duración del combate: 14–16,5 s
    const KO_T = D - 1.6;
    const ev = [];
    let t = 1.0;
    while (t < KO_T - 0.8) {
      const att = Math.random() < 0.55 ? winnerSide : loserSide;
      const kick = Math.random() < 0.3;
      const type = kick ? (Math.random() < 0.5 ? 'kick' : 'low') : ['jab', 'cross', 'hook'][Math.floor(Math.random() * 3)];
      ev.push({ t, att, type, dur: kick ? 0.7 : 0.5, hit: Math.random() > 0.2, dmg: 0, ko: false, word: kick ? WORDS_K[Math.floor(Math.random() * WORDS_K.length)] : WORDS_P[Math.floor(Math.random() * WORDS_P.length)] });
      t += rnd(0.75, 1.3);
    }
    for (const side of [winnerSide, loserSide]) {                // cada uno acierta al menos 2 golpes
      let n = 0; for (const e of ev) if (e.att === side) { if (n < 2) e.hit = true; n++; }
    }
    ev.push({ t: KO_T, att: winnerSide, type: 'kick', dur: 0.75, hit: true, dmg: 0, ko: true, word: '¡K.O.!' });
    for (const e of ev) e.contact = e.t + e.dur * 0.42;
    // Reparto del daño: el perdedor llega a 0 exacto con el golpe final; el ganador acaba con 40–80 % de vida
    const share = (attacker, total) => {
      const hits = ev.filter(e => e.att === attacker && e.hit); if (!hits.length) return;
      const w = hits.map(e => e.ko ? 1.7 : rnd(0.6, 1.4)), sum = w.reduce((a, b) => a + b, 0);
      hits.forEach((e, i) => { e.dmg = total * w[i] / sum; });
    };
    share(winnerSide, 100);
    share(loserSide, rnd(20, 60));
    return { D, ev, winnerSide, ko: ev[ev.length - 1] };
  }

  function poseOf(plan, side, t) {
    const P = { atk: null, ext: 0, shock: 0, block: false, fall: 0, win: false, env: 0 };
    for (const e of plan.ev) {
      if (e.t > t) break;
      const p = (t - e.t) / e.dur;
      if (e.att === side && p < 1) { P.atk = e.type; P.ext = Math.max(0, p < 0.42 ? easeOut(p / 0.42) : 1 - (p - 0.42) / 0.58); }
      if (e.att !== side) {
        if (!e.hit && p > 0.15 && p < 0.75) P.block = true;
        if (e.hit) { const r = (t - e.contact) / 0.45; if (r >= 0 && r < 1) P.shock = Math.max(P.shock, Math.sin(Math.PI * r) * (e.ko ? 1.5 : 0.6 + Math.min(1, e.dmg / 14) * 0.6)); }
      }
    }
    if (side !== plan.winnerSide) P.fall = clamp((t - (plan.ko.contact + 0.15)) / 0.9, 0, 1);
    else P.win = t >= plan.ko.contact + 1.1;
    return P;
  }
  function hpAt(plan, side, t) {                                 // vida objetivo en el instante t
    let d = 0; for (const e of plan.ev) { if (e.contact > t) break; if (e.hit && e.att !== side) d += e.dmg; }
    return Math.max(0, 100 - d);
  }
  function excitement(plan, t) {                                 // 0..1: lo exaltado que está el público
    if (t >= plan.ko.contact) return 1;
    let x = 0.3; for (const e of plan.ev) { if (e.contact > t) break; if (e.hit) x = Math.max(x, 0.3 + 0.7 * Math.exp(-(t - e.contact) / 1.3)); }
    return x;
  }

  // ====================================================================================================
  //  DIBUJO: ring, público, luchadores, luces
  // ====================================================================================================
  function ik(ax, ay, tx, ty, l1, l2, bend) {                    // dos huesos (muslo/espinilla o brazo/antebrazo) → [codoX, codoY, puntaX, puntaY]
    let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 0.01;
    d = Math.min(d, l1 + l2 - 0.01);
    const ux = dx / (Math.hypot(dx, dy) || 0.01), uy = dy / (Math.hypot(dx, dy) || 0.01);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const mx = ax + ux * a, my = ay + uy * a;
    return [mx - uy * h * bend, my + ux * h * bend, ax + ux * d, ay + uy * d];
  }
  function line(c, pts, w, col) {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke();
  }
  function arm(c, s, tg, bend, fd) {
    const r = ik(s.x, s.y, tg.x, tg.y, 40, 38, bend);
    line(c, [s.x, s.y, r[0], r[1], r[2], r[3]], 15, fd.skin);
    c.fillStyle = fd.shorts; c.beginPath(); c.arc(r[2], r[3], 12, 0, 7); c.fill();
    c.fillStyle = '#fff5'; c.beginPath(); c.arc(r[2] - 3, r[3] - 4, 4, 0, 7); c.fill();
    return r;                                                   // [codoX, codoY, manoX, manoY]: la copa se dibuja sobre la mano
  }
  function leg(c, h, tg, fd) {
    const r = ik(h.x, h.y, tg.x, tg.y, 52, 52, -1);
    line(c, [h.x, h.y, r[0], r[1]], 28, fd.shorts);
    line(c, [r[0], r[1], r[2], r[3]], 18, fd.skin);
    c.fillStyle = '#151515'; c.beginPath(); c.ellipse(r[2] + 6, r[3] + 2, 14, 7, 0, 0, 7); c.fill();
  }

  function drawFighter(c, fd, P, t, floorY) {
    const bob = (P.fall > 0.05 || P.win) ? 0 : Math.sin(t * 7 + fd.ph) * 2.5;
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#000'; c.beginPath(); c.ellipse(fd.x, floorY + 3, 44 + P.fall * 40, 9, 0, 0, 7); c.fill(); c.restore();
    c.save(); c.translate(fd.x, floorY - P.fall * 16); c.scale(fd.face || fd.dir, 1); if (P.fall > 0) c.rotate(-P.fall * 1.5);   // fd.face: el ganador se gira hacia la chica de la copa
    const e = P.ext, kick = P.atk === 'kick' || P.atk === 'low';
    const hip = { x: -2 - (kick ? e * 6 : 0), y: -98 + bob * 0.6 + (kick ? e * 6 : 0) };
    let lean = (P.atk === 'cross' ? 10 * e : P.atk === 'hook' ? 12 * e : P.atk === 'jab' ? 5 * e : 0) - (kick ? 12 * e : 0) - P.shock * 16 + (P.block ? 4 : 0);
    if (P.win) lean = -4;
    const sh = { x: hip.x + 4 + lean, y: hip.y - 72 };
    const head = { x: sh.x + 6 - P.shock * 10, y: sh.y - 27 - P.shock * 3 };
    const sw = Math.sin(t * 3 + fd.ph) * 5;
    let leadFoot = { x: 26 + sw + (P.atk === 'jab' ? 10 * e : 0), y: 0 }, rearFoot = { x: -24 - sw, y: 0 };
    if (P.atk === 'kick') rearFoot = { x: lerp(-24, hip.x + 98, e), y: lerp(0, hip.y - 24, e) };
    if (P.atk === 'low') leadFoot = { x: lerp(26, hip.x + 92, e), y: lerp(0, hip.y + 44, e) };
    let lead = { x: sh.x + 30, y: sh.y + 8 }, rear = { x: sh.x + 14, y: sh.y + 24 }, bendR = 1;
    if (P.block) { lead = { x: sh.x + 26, y: sh.y - 16 }; rear = { x: sh.x + 34, y: sh.y - 2 }; }
    if (P.atk === 'jab') lead = { x: lerp(lead.x, sh.x + 78, e), y: lerp(lead.y, sh.y - 2, e) };
    if (P.atk === 'cross') rear = { x: lerp(rear.x, sh.x + 76, e), y: lerp(rear.y, sh.y, e) };
    if (P.atk === 'hook') { rear = { x: lerp(rear.x, sh.x + 60, e), y: lerp(rear.y, sh.y - 16, e) }; bendR = -1; }
    if (P.shock > 0) { lead.y += P.shock * 14; rear.y += P.shock * 12; }
    if (P.fall > 0.02) { lead = { x: sh.x + 8, y: sh.y + 58 }; rear = { x: sh.x - 4, y: sh.y + 60 }; }
    if (P.win) { lead = { x: sh.x + 62 + Math.sin(t * 9) * 4, y: sh.y - 60 + Math.sin(t * 9) * 5 }; rear = { x: sh.x - 10 + Math.cos(t * 9) * 6, y: sh.y - 96 }; }   // puño de delante en alto y hacia delante (así no tapa la cara)
    if (P.win && P.reach > 0) lead = { x: lerp(lead.x, sh.x + 64, P.reach), y: lerp(lead.y, sh.y + 40, P.reach) };   // baja el brazo para coger la copa
    let lh = null;
    const leadArm = () => { lh = arm(c, { x: sh.x + 6, y: sh.y + 2 }, lead, 1, fd); if (P.cup) drawTrophy(c, lh[2], lh[3] - 2, 70, t); };   // brazo de delante (+ copa si la tiene)
    if (P.win) leadArm();                                                               // con el puño en alto se dibuja detrás de la cabeza para no tapar la cara
    arm(c, { x: sh.x - 6, y: sh.y + 4 }, rear, bendR, fd);                              // brazo de atrás
    leg(c, { x: hip.x - 8, y: hip.y + 4 }, rearFoot, fd);                               // pierna de atrás
    line(c, [hip.x, hip.y, sh.x, sh.y], 40, fd.skin);                                   // torso
    line(c, [hip.x, hip.y + 14, hip.x, hip.y - 8], 46, fd.shorts);                      // pantalón
    line(c, [hip.x - 20, hip.y - 7, hip.x + 20, hip.y - 7], 5, '#fff8');                // cinturilla
    leg(c, { x: hip.x + 8, y: hip.y + 4 }, leadFoot, fd);                               // pierna de delante
    c.fillStyle = fd.skin; c.beginPath(); c.arc(head.x, head.y, 21, 0, 7); c.fill();    // cabeza
    c.fillStyle = fd.hair; c.beginPath(); c.arc(head.x - 2, head.y - 3, 22, Math.PI * 0.92, Math.PI * 2.08); c.fill();
    line(c, [head.x - 20, head.y - 9, head.x + 20, head.y - 9], 5, fd.shorts);          // cinta
    if (P.fall > 0.3) { line(c, [head.x + 6, head.y - 6, head.x + 14, head.y + 2], 2.5, '#111'); line(c, [head.x + 14, head.y - 6, head.x + 6, head.y + 2], 2.5, '#111'); }
    else if (!(P.bat > 0.35)) { c.fillStyle = '#fff'; c.beginPath(); c.arc(head.x + 10, head.y - 2, 4.5, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(head.x + 11.5, head.y - 2, 2.2, 0, 7); c.fill(); }   // con el ojo muy hinchado no se ve
    if (P.shout) { c.fillStyle = '#4a0d0d'; c.beginPath(); c.ellipse(head.x + 11, head.y + 11, 5.5, 4 + 1.8 * Math.abs(Math.sin(t * 10)), 0, 0, 7); c.fill(); }   // el ganador grita de rabia y de alegría
    else line(c, [head.x + 6, head.y + 11, head.x + 15, head.y + (P.shock > 0.3 ? 14 : 11)], 2.5, '#5a1a1a');   // boca
    if (P.bat > 0.08) drawBruises(c, fd, head, P, t);                                   // golpes en la cara
    if (!P.win) leadArm();
    c.restore();
  }

  // Cara destrozada: ojo morado e hinchado, pómulo amoratado, chichón, ceja abierta, nariz y labio sangrando. bat: 0 (intacto) … 1 (destrozado)
  function drawBruises(c, fd, h, P, t) {
    const bat = P.bat, ex = h.x + 10, ey = h.y - 2;
    c.save();
    if (bat > 0.12) {                                                                   // ojo morado
      const k = clamp((bat - 0.12) / 0.5, 0, 1);
      c.fillStyle = `rgba(86,32,120,${0.35 + 0.4 * k})`; c.beginPath(); c.ellipse(ex, ey + 1, 8 + 5 * k, 6.5 + 4 * k, -0.15, 0, 7); c.fill();
      if (k > 0.5) { c.strokeStyle = 'rgba(40,10,60,.6)'; c.lineWidth = 1.5; c.stroke(); }
      if (bat > 0.35 && P.fall <= 0.3) { line(c, [ex - 5, ey + 1, ex + 5, ey + 2], 2.8, '#1a0a14'); line(c, [ex - 5, ey - 3, ex + 5, ey - 2], 1.5, '#2a0f1e'); }   // ojo casi cerrado
    }
    if (bat > 0.3) {                                                                    // pómulo amoratado
      const k = clamp((bat - 0.3) / 0.6, 0, 1);
      c.fillStyle = `rgba(76,60,150,${0.25 + 0.4 * k})`; c.beginPath(); c.ellipse(h.x + 9, h.y + 8, 8 + 3 * k, 6 + 2 * k, 0.3, 0, 7); c.fill();
      if (k > 0.5) { c.fillStyle = 'rgba(160,170,50,.38)'; c.beginPath(); c.ellipse(h.x + 3, h.y + 13, 6, 3.5, 0.3, 0, 7); c.fill(); }
    }
    if (bat > 0.5) {                                                                    // chichón en la frente
      c.fillStyle = 'rgba(190,70,70,.75)'; c.beginPath(); c.arc(h.x + 2, h.y - 15, 5.5, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(h.x + 0.5, h.y - 17, 2, 0, 7); c.fill();
    }
    if (bat > 0.45) {                                                                   // ceja abierta con hilo de sangre
      line(c, [h.x + 4, h.y - 9, h.x + 15, h.y - 8], 2.4, '#8b0000');
      line(c, [h.x + 14.5, h.y - 8, h.x + 16, h.y + 4 + 6 * bat], 2.4, '#b00020');
    }
    if (bat > 0.4) {                                                                    // nariz rota y sangrando
      c.fillStyle = fd.skin; c.beginPath(); c.arc(h.x + 21, h.y + 3, 3.6, 0, 7); c.fill();
      line(c, [h.x + 21.5, h.y + 4, h.x + 20, h.y + 12], 2.6, '#c1121f');
    }
    if (bat > 0.5) {                                                                    // labio partido y sangre en la barbilla
      c.fillStyle = '#9d0208'; c.beginPath(); c.ellipse(h.x + 8, h.y + 11.5, 3.2, 2.2, 0, 0, 7); c.fill();
      line(c, [h.x + 9, h.y + 14, h.x + 9, h.y + 15 + 9 * bat], 2.4, '#b00020');
    }
    if (bat > 0.7 && !P.fall) {                                                         // gotas de sangre que caen
      for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i * 0.37) % 1; c.fillStyle = `rgba(190,10,30,${1 - ph})`; c.beginPath(); c.arc(h.x + 8 + i * 4, h.y + 24 + ph * 34, 2.1, 0, 7); c.fill(); }
    }
    c.restore();
  }

  // Copa dorada (x,y = base, donde la sostiene la mano; h = altura en píxeles)
  function drawTrophy(c, x, y, h, t) {
    const k = h / 70;
    c.save(); c.translate(x, y); c.scale(k, k); c.lineJoin = 'round';
    const g = c.createLinearGradient(-20, 0, 20, 0); g.addColorStop(0, '#b8860b'); g.addColorStop(0.35, '#ffe066'); g.addColorStop(0.62, '#ffd43b'); g.addColorStop(1, '#a8740a');
    c.fillStyle = g; c.strokeStyle = '#7a5200'; c.lineWidth = 1.6;
    c.strokeStyle = '#e0a800'; c.lineWidth = 4;                                         // asas
    c.beginPath(); c.arc(-21, -55, 9, Math.PI / 2, Math.PI * 1.5); c.stroke();
    c.beginPath(); c.arc(21, -55, 9, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.strokeStyle = '#7a5200'; c.lineWidth = 1.6; c.fillStyle = g;
    c.beginPath(); c.rect(-13, -12, 26, 10); c.fill(); c.stroke();                      // base
    c.beginPath(); c.rect(-4, -27, 8, 16); c.fill(); c.stroke();                        // pie
    c.beginPath(); c.moveTo(-20, -70); c.quadraticCurveTo(-23, -40, -7, -27); c.lineTo(7, -27); c.quadraticCurveTo(23, -40, 20, -70); c.closePath(); c.fill(); c.stroke();   // copa
    c.fillStyle = '#ffe9a0'; c.beginPath(); c.ellipse(0, -70, 20, 4, 0, 0, 7); c.fill(); c.stroke();   // borde
    c.fillStyle = '#7a5200'; c.fillRect(-13, -9, 26, 3);                                // placa
    c.fillStyle = '#fff8'; c.beginPath(); c.moveTo(-14, -64); c.quadraticCurveTo(-16, -46, -8, -35); c.lineTo(-5, -37); c.quadraticCurveTo(-11, -48, -10, -64); c.closePath(); c.fill();   // brillo
    c.fillStyle = '#b8860b'; c.beginPath();                                             // estrella
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.5 : 8, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, -50 + Math.sin(a) * r); }
    c.closePath(); c.fill();
    const sp = 0.5 + 0.5 * Math.sin(t * 8);                                             // destello que parpadea
    c.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * sp})`; c.lineWidth = 2; c.beginPath();
    c.moveTo(17, -80 - 7 * sp); c.lineTo(17, -80 + 7 * sp); c.moveTo(17 - 7 * sp, -80); c.lineTo(17 + 7 * sp, -80); c.stroke();
    c.restore();
  }

  // Chica del ring: entra andando con la copa, se la entrega al ganador y aplaude. g = {x, dir, walk, cup, give, clap, skin, hair}
  function drawRingGirl(c, g, t, floorY) {
    const sw = Math.sin(t * 9) * 16 * g.walk, bob = Math.abs(Math.sin(t * 9)) * 3 * g.walk;
    const gk = 0.92 * (g.sc || 1);   // g.sc: tamaño según la profundidad (más pequeña al fondo del ring)
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#000'; c.beginPath(); c.ellipse(g.x, floorY + 3, 34, 7, 0, 0, 7); c.restore();
    c.save(); c.translate(g.x, floorY); c.scale(g.dir * gk, gk);
    const sh = { x: 2, y: -148 - bob }, head = { x: 5, y: -174 - bob };
    const hand = { x: lerp(24, 62, g.give), y: -140 };
    const armTo = (s, tg) => { const r = ik(s.x, s.y, tg.x, tg.y, 36, 34, 1); line(c, [s.x, s.y, r[0], r[1], r[2], r[3]], 9, g.skin); c.fillStyle = g.skin; c.beginPath(); c.arc(r[2], r[3], 5.5, 0, 7); c.fill(); };
    const k = Math.abs(Math.sin(t * 10));
    const tF = g.sign ? { x: 28, y: -206 } : g.clap ? { x: 34 - k * 10, y: -138 } : g.cup ? hand : { x: 6 + sw * 0.5, y: -98 };   // g.sign: sujeta el cartel en alto
    const tB = g.sign ? { x: -10, y: -206 } : g.clap ? { x: 28 - k * 8, y: -132 } : g.cup ? { x: hand.x - 8, y: hand.y + 5 } : { x: 0 - sw * 0.5, y: -98 };
    line(c, [head.x - 6, head.y - 4, head.x - 13, head.y + 38 - bob * 0.3], 22, g.hair);   // melena larga
    armTo({ x: sh.x - 6, y: sh.y + 4 }, tB);                                            // brazo de atrás
    line(c, [-6, -90, -8 - sw, -10], 11, g.skin); line(c, [6, -90, 8 + sw, -10], 11, g.skin);   // piernas
    c.fillStyle = '#c1121f'; for (const sx of [-8 - sw, 8 + sw]) { c.beginPath(); c.ellipse(sx + 5, -5, 11, 5, 0, 0, 7); c.fill(); }   // zapatos de tacón
    c.fillStyle = '#e63946'; c.beginPath(); c.moveTo(-13, -146 - bob); c.lineTo(15, -146 - bob); c.lineTo(12, -118); c.lineTo(23, -82); c.lineTo(-21, -82); c.lineTo(-11, -118); c.closePath(); c.fill();   // vestido
    c.fillStyle = '#ffd43b'; c.beginPath(); c.moveTo(-13, -146 - bob); c.lineTo(-4, -146 - bob); c.lineTo(14, -110); c.lineTo(6, -110); c.closePath(); c.fill();                                  // fajín
    line(c, [-21, -82, 23, -82], 3, '#ffd43b');
    c.fillStyle = g.skin; c.fillRect(sh.x - 4, head.y + 12, 8, 14);                     // cuello
    c.fillStyle = g.skin; c.beginPath(); c.arc(head.x, head.y, 18, 0, 7); c.fill();     // cabeza
    c.fillStyle = g.hair; c.beginPath(); c.arc(head.x - 2, head.y - 2, 19.5, Math.PI * 0.82, Math.PI * 2.1); c.fill();
    line(c, [head.x - 10, head.y - 8, head.x - 12, head.y + 20], 7, g.hair);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(head.x + 8, head.y - 2, 3.8, 0, 7); c.fill(); c.fillStyle = '#2b1b12'; c.beginPath(); c.arc(head.x + 9, head.y - 2, 2, 0, 7); c.fill();
    line(c, [head.x + 4, head.y - 6, head.x + 12, head.y - 6], 1.6, '#111');            // pestañas
    c.fillStyle = 'rgba(255,120,140,.35)'; c.beginPath(); c.arc(head.x + 6, head.y + 5, 4, 0, 7); c.fill();
    c.strokeStyle = '#a4161a'; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.arc(head.x + 9, head.y + 5, 5, 0.2, Math.PI - 0.5); c.stroke();   // sonrisa
    c.fillStyle = '#ffd43b'; c.beginPath(); c.arc(head.x - 3, head.y + 8, 2.4, 0, 7); c.fill();   // pendiente
    armTo({ x: sh.x + 6, y: sh.y + 4 }, tF);                                            // brazo de delante
    if (g.cup) drawTrophy(c, hand.x, hand.y - 4, 76, t);
    c.restore();
  }

  // Cartel que levanta la chica antes del combate: los dos nombres con la bandera de su país. Siempre se lee del derecho (no se voltea con ella).
  function drawRingSign(c, g, floorY, A, B, t) {
    const k = 0.92 * (g.sc || 1), w = 236 * k, h = 128 * k, cx = g.x + g.dir * 9 * k, by = floorY - 212 * k;   // by: borde de abajo, justo donde la chica agarra el cartel
    c.save(); c.translate(cx, by); c.rotate(Math.sin(t * 5) * 0.035);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-w / 2 + 4 * k, -h + 5 * k, w, h);
    c.fillStyle = '#fff8e1'; c.fillRect(-w / 2, -h, w, h);
    c.strokeStyle = '#e63946'; c.lineWidth = Math.max(2, 5 * k); c.strokeRect(-w / 2, -h, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const line = (txt, y, col, size) => { fitText(c, txt, w - 20 * k, size * k, 900); c.fillStyle = col; c.fillText(txt, 0, y); };
    line(`${A.flag} ${A.name}`.trim(), -h * 0.8, '#1d3557', 27);
    line('VS', -h * 0.5, '#e63946', 30);
    line(`${B.flag} ${B.name}`.trim(), -h * 0.2, '#b5651d', 27);
    c.restore(); c.textBaseline = 'alphabetic';
  }

  function buildCrowd() {
    const L = [];
    const shirts = ['#d94a4a', '#3b82f6', '#f2c230', '#34a853', '#a855f7', '#f97316', '#e5e7eb', '#14b8a6', '#ec4899'];
    const dim = (hex, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${Math.round(((n >> 16) & 255) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)})`; };
    const add = (x, y, s, k, front) => {
      const sk = SKINS[Math.floor(Math.random() * 5)], sh = shirts[Math.floor(Math.random() * shirts.length)];
      L.push({ x, y, s, ph: Math.random() * 6.3, f: Math.random() * 3, arm: Math.random() < 0.6, flash: Math.random(), front: !!front,
        shirt: front ? '#0c0c12' : dim(sh, k), skin: front ? '#14141c' : dim(sk, k), hair: front ? '#0a0a0e' : dim(HAIRS[Math.floor(Math.random() * 5)], k) });
    };
    const rows = [[190, 0.6, 0.45], [215, 0.7, 0.55], [240, 0.8, 0.65], [265, 0.9, 0.78], [292, 1.0, 0.9]];   // gradas del fondo (las lejanas, más oscuras)
    for (const [y, s, k] of rows) for (let x = -420 + Math.random() * 20; x < 1420; x += 46 * s + Math.random() * 8) add(x, y, s, k);
    for (let i = 0; i < 5; i++) {                                                                               // gradas de los lados
      const y = 360 + i * 48, s = 0.9 + i * 0.1;
      for (let x = (i % 2) * 22; x > -420; x -= 46 * s) add(x + 20, y, s, 0.85);
      for (let x = 1000 - (i % 2) * 22; x < 1420; x += 46 * s) add(x - 20, y, s, 0.85);
    }
    for (let x = -380; x < 1380; x += 92 + Math.random() * 30) add(x, 735, 1.7, 1, true);                       // primera fila (siluetas oscuras)
    return L;
  }
  function drawPerson(c, p, t, exc) {
    const s = p.s, bob = Math.abs(Math.sin(t * (4 + p.f) + p.ph)) * 6 * exc * s;
    const x = p.x, y = p.y - bob;
    if (p.arm && exc > 0.5) {                                    // brazos arriba, animando
      c.strokeStyle = p.skin; c.lineWidth = 5 * s; c.lineCap = 'round';
      const w = Math.sin(t * 7 + p.ph) * 8 * s;
      c.beginPath(); c.moveTo(x - 13 * s, y - 32 * s); c.lineTo(x - 20 * s + w, y - 68 * s); c.moveTo(x + 13 * s, y - 32 * s); c.lineTo(x + 20 * s - w, y - 68 * s); c.stroke();
    }
    c.fillStyle = p.shirt; c.fillRect(x - 15 * s, y - 40 * s, 30 * s, 42 * s);
    c.fillStyle = p.skin; c.beginPath(); c.arc(x, y - 52 * s, 11 * s, 0, 7); c.fill();
    c.fillStyle = p.hair; c.beginPath(); c.arc(x, y - 55 * s, 11.5 * s, Math.PI, Math.PI * 2); c.fill();
    if (!p.front && exc > 0.6 && ((t * 0.7 + p.flash) % 1) < 0.03) {   // flashes de cámara
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 6 * s, y - 60 * s, 9 * s, 0, 7); c.fill();
    }
  }

  const RING = { BL: [230, 300], BR: [770, 300], FR: [905, 540], FL: [95, 540], HB: 150, HF: 210 };
  const ROPES = [[0.42, '#e63946'], [0.66, '#f1f1f1'], [0.9, '#3b82f6']];
  function ropeY(base, H, f) { return base - H * f; }
  function drawRopes(c, back) {
    const { BL, BR, FR, FL, HB, HF } = RING;
    for (const [f, col] of ROPES) {
      const bl = [BL[0], ropeY(BL[1], HB, f)], br = [BR[0], ropeY(BR[1], HB, f)], fr = [FR[0], ropeY(FR[1], HF, f)], fl = [FL[0], ropeY(FL[1], HF, f)];
      c.strokeStyle = col; c.lineCap = 'round';
      if (back) { c.lineWidth = 5; c.beginPath(); c.moveTo(fl[0], fl[1]); c.lineTo(bl[0], bl[1]); c.lineTo(br[0], br[1]); c.lineTo(fr[0], fr[1]); c.stroke(); }
      else { c.lineWidth = 8; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(fl[0], fl[1]); c.lineTo(fr[0], fr[1]); c.stroke(); c.globalAlpha = 1; }
    }
    const post = (p, H) => { c.fillStyle = '#c9c9d1'; c.fillRect(p[0] - 6, p[1] - H, 12, H); c.fillStyle = '#e63946'; c.fillRect(p[0] - 9, p[1] - H * 0.95, 18, H * 0.55); };
    if (back) { post(BL, HB); post(BR, HB); } else { post(FL, HF); post(FR, HF); }
  }
  function drawRingFloor(c) {
    const { BL, BR, FR, FL } = RING;
    c.fillStyle = '#6d0f1b'; c.beginPath(); c.moveTo(FL[0], FL[1]); c.lineTo(FR[0], FR[1]); c.lineTo(FR[0] + 6, 610); c.lineTo(FL[0] - 6, 610); c.closePath(); c.fill();   // faldón
    c.fillStyle = '#e8c15a'; c.fillRect(FL[0], FL[1] + 2, FR[0] - FL[0], 5);
    const g = c.createLinearGradient(0, BL[1], 0, FL[1]); g.addColorStop(0, '#1d2f6e'); g.addColorStop(1, '#2d4aa6');
    c.fillStyle = g; c.beginPath(); c.moveTo(BL[0], BL[1]); c.lineTo(BR[0], BR[1]); c.lineTo(FR[0], FR[1]); c.lineTo(FL[0], FL[1]); c.closePath(); c.fill();
    c.strokeStyle = '#fff6'; c.lineWidth = 3; c.stroke();
    drawFloorLogo(c);
  }

  // ---- Marca del juego: logo + «Redecora El Mundo 🌎» (en la pared de fondo, en colores, y pintado en la lona) ----
  const LOGO = new Image(); LOGO.src = 'images/icon-192.png';
  const logoOk = () => LOGO.complete && LOGO.naturalWidth > 0;
  const GAME = 'Redecora El Mundo';
  const RAINBOW = ['#ff4d4d', '#ff9f1c', '#ffd43b', '#51cf66', '#22b8cf', '#4c8dff', '#b36bff', '#ff6bd6'];
  function rainbowText(c, txt, cx, y, size) {   // letras de colores, centradas en cx (el espacio no consume color)
    c.font = `900 ${size}px system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
    const ws = [...txt].map(ch => c.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0);
    let x = cx - tot / 2, k = 0;
    [...txt].forEach((ch, i) => {
      if (ch !== ' ') { c.lineWidth = size * 0.12; c.strokeStyle = '#0b0b14'; c.strokeText(ch, x, y); c.fillStyle = RAINBOW[k++ % RAINBOW.length]; c.fillText(ch, x, y); }
      x += ws[i];
    });
    return tot;
  }
  let wallCache = null;
  function wallBanner() {   // el cartel se pinta una sola vez en un lienzo aparte (el brillo es caro de repetir en cada fotograma)
    if (wallCache || !logoOk()) return wallCache;
    const W = 860, H = 170, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#0d0f1ccc'; c.beginPath(); c.roundRect(6, 6, W - 12, H - 12, 26); c.fill();
    c.lineWidth = 5; const g = c.createLinearGradient(0, 0, W, 0); RAINBOW.forEach((col, i) => g.addColorStop(i / (RAINBOW.length - 1), col));
    c.strokeStyle = g; c.shadowColor = '#ffffffaa'; c.shadowBlur = 14; c.stroke(); c.shadowBlur = 0;
    const ls = 120; c.save(); c.beginPath(); c.roundRect(28, (H - ls) / 2, ls, ls, 22); c.clip(); c.drawImage(LOGO, 28, (H - ls) / 2, ls, ls); c.restore();
    let size = 76; c.font = `900 ${size}px system-ui, sans-serif`;
    const room = W - 28 - ls - 24 - 100;   // lo que queda entre el logo y el borde derecho (con hueco para el globo)
    while (c.measureText(GAME).width > room && size > 24) { size -= 2; c.font = `900 ${size}px system-ui, sans-serif`; }
    const tw = c.measureText(GAME).width, cx = 28 + ls + 24 + tw / 2;
    c.shadowColor = '#ffffff66'; c.shadowBlur = 8; rainbowText(c, GAME, cx, H / 2 + 2, size); c.shadowBlur = 0;
    c.font = `${Math.round(size * 0.95)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🌎', W - 56, H / 2 + 4);
    return (wallCache = cv);
  }
  let wallFlags = null;   // { A: '🇪🇸', B: '🇫🇷' }: bandera de cada luchador (se rellena en runFight)
  function drawWall(c) {   // pared negra de detrás del público: el cartel va justo encima de las primeras filas
    const b = wallBanner(); if (!b) return;
    const w = 780, h = w * b.height / b.width;
    c.save(); c.globalAlpha = 0.95; c.drawImage(b, 500 - w / 2, 160 - h, w, h); c.restore();
    if (wallFlags) {   // las dos banderas, grandes, encima del cartel de Redecora El Mundo: tú a la izquierda (azul), el rival a la derecha (naranja)
      [['A', 290, '#4c8dff'], ['B', 710, '#ff9f1c']].forEach(([k, cx, col]) => {
        const pw = 270, ph = 205, y0 = 160 - h - 26 - ph;
        c.save(); c.fillStyle = '#0d0f1ccc'; c.beginPath(); c.roundRect(cx - pw / 2, y0, pw, ph, 28); c.fill();
        c.lineWidth = 6; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 18; c.stroke(); c.shadowBlur = 0;
        c.font = '150px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
        c.fillText(wallFlags[k] || '🌍', cx, y0 + ph / 2 + 8);
        c.restore();
      });
    }
  }
  function drawFloorLogo(c) {   // pintado en la lona, en perspectiva y dentro de las cuerdas
    c.save(); c.translate(500, 425); c.scale(1, 0.32); c.textAlign = 'left'; c.textBaseline = 'middle';
    const ls = 110; let size = 64; c.font = `900 ${size}px system-ui, sans-serif`;
    while (c.measureText(GAME).width > 430 && size > 20) { size -= 2; c.font = `900 ${size}px system-ui, sans-serif`; }
    const tw = c.measureText(GAME).width, tot = (logoOk() ? ls + 22 : 0) + tw, x0 = -tot / 2;
    if (logoOk()) { c.globalAlpha = 0.38; c.save(); c.beginPath(); c.roundRect(x0, -ls / 2, ls, ls, 20); c.clip(); c.drawImage(LOGO, x0, -ls / 2, ls, ls); c.restore(); }
    c.globalAlpha = 0.42; c.fillStyle = '#ffffff'; c.fillText(GAME, x0 + (logoOk() ? ls + 22 : 0), 4);
    c.restore();
  }

  function drawLights(c, t, exc, flash, W, H, X, Y) {            // focos que se mueven + foco central + destello al golpear
    c.save(); c.globalCompositeOperation = 'lighter';
    const cols = ['255,240,200', '120,160,255', '255,110,110', '255,240,200', '160,255,170'];
    for (let i = 0; i < 5; i++) {
      const ox = 100 + i * 200, tx = 500 + Math.sin(t * (0.7 + i * 0.13) + i * 1.7) * (200 + exc * 120), ty = 470 + Math.cos(t * 0.9 + i) * 30;
      const g = c.createLinearGradient(ox, -60, tx, ty); g.addColorStop(0, `rgba(${cols[i]},${0.30 + 0.2 * exc})`); g.addColorStop(1, `rgba(${cols[i]},0.02)`);
      c.fillStyle = g; c.beginPath(); c.moveTo(ox - 8, -60); c.lineTo(ox + 8, -60); c.lineTo(tx + 95, ty); c.lineTo(tx - 95, ty); c.closePath(); c.fill();
    }
    const pool = c.createRadialGradient(500, 440, 20, 500, 440, 420); pool.addColorStop(0, 'rgba(255,240,210,0.30)'); pool.addColorStop(1, 'rgba(255,240,210,0)');
    c.fillStyle = pool; c.fillRect(-500, 0, 2000, 800);
    if (flash > 0.01) { c.fillStyle = `rgba(255,255,255,${0.22 * flash})`; c.fillRect(-500, -200, 2000, 1200); }
    c.restore();
  }

  function fitText(c, txt, maxW, size, weight) {
    let s = size; c.font = `${weight || 800} ${s}px system-ui, sans-serif`;
    while (c.measureText(txt).width > maxW && s > 10) { s -= 1; c.font = `${weight || 800} ${s}px system-ui, sans-serif`; }
  }
  function drawHud(c, W, names, hp, elems, t, phase) {
    const bw = Math.min(W * 0.4, 340), y = 14 + 8, h = 16;
    const bar = (x, left, v, name, el) => {
      c.fillStyle = '#000a'; c.fillRect(x - 3, y - 3, bw + 6, h + 6);
      c.fillStyle = '#333'; c.fillRect(x, y, bw, h);
      c.fillStyle = v > 50 ? '#37b24d' : v > 25 ? '#fab005' : '#e03131';
      const w = bw * clamp(v, 0, 100) / 100; c.fillRect(left ? x : x + bw - w, y, w, h);
      c.fillStyle = '#fff'; c.textBaseline = 'alphabetic'; c.textAlign = left ? 'left' : 'right';
      fitText(c, `${el} ${name}`, bw, 16); c.fillText(`${el} ${name}`, left ? x : x + bw, y - 7);
    };
    bar(W / 2 - bw - 36, true, hp.A, names.A, elems.A);
    bar(W / 2 + 36, false, hp.B, names.B, elems.B);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '900 22px system-ui, sans-serif'; c.fillText('VS', W / 2, y + h);
  }

  // ====================================================================================================
  //  ESCENA COMPLETA: intro automática → combate de ~15 s → ganador
  // ====================================================================================================
  function runFight(j) {
    return new Promise(resolve => {
      initAudio();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const winnerSide = j.won ? 'A' : 'B';
      const plan = makePlan(winnerSide, reduced);
      const names = { A: 'Tú', B: j.foe.owner || 'Rival' };
      const fl = c2 => { try { return (typeof flagOf === 'function' && flagOf(c2)) || ''; } catch (e) { return ''; } };
      wallFlags = { A: fl(j.mine.country), B: fl(j.foe.country) };
      const elems = { A: (EL[j.mine.element] || EL.fuego)[0], B: (EL[j.foe.element] || EL.fuego)[0] };
      const fa = { dir: 1, x: 400, ph: 0.3, shorts: (EL[j.mine.element] || EL.fuego)[1], skin: SKINS[hash(j.mine.id) % 5], hair: HAIRS[hash(j.mine.id + 'h') % 5] };
      const fb = { dir: -1, x: 600, ph: 2.1, shorts: (EL[j.foe.element] || EL.fuego)[1], skin: SKINS[hash(j.foe.id) % 5], hair: HAIRS[hash(j.foe.id + 'h') % 5] };
      const winnerName = j.won ? 'Tú' : names.B;
      const cv = $('fg-cv'), c = cv.getContext('2d');
      const crowd = buildCrowd();
      stage.classList.remove('hidden');
      crowdStart(); say(`¡Atención! Combate entre tú y ${names.B}`);
      const INTRO = 7000, END = 7600;                             // END: ceremonia de victoria (zoom, copa, fundido) y paso automático a la clasificación
      let start = performance.now(), last = start, phase = 'intro', fightStart = 0, skipOff = 0, lastT = 0, curT = 0, done = false;
      const hpD = { A: 100, B: 100 };

      // ---- EFECTOS DEL COMBATE: chispas y partículas según el elemento (🔥 brasas · 🌿 hojas · 💧 gotas), sudor, ondas de choque,
      //      polvo al caer, líneas de impacto en el K.O., golpe de cámara, cámara lenta en el golpe final y contador de combos ----
      const elOf = { A: j.mine.element, B: j.foe.element };
      const ELFX = { fuego: ['#ff922b', '#ffd43b', '#e03131'], planta: ['#69db7c', '#d8f5a2', '#2f9e44'], agua: ['#74c0fc', '#e7f5ff', '#1c7ed6'] };
      const fx = [];
      let fxT = 0, slowK = 1;
      const addP = p => { if (fx.length < 260) fx.push(Object.assign({ life: 0, vx: 0, vy: 0, g: 0, drag: 0, rot: 0, vr: 0, sz: 4 }, p)); };
      function burst(x, y, dir, el, big) {                        // dir: +1 el golpe va hacia la derecha, -1 hacia la izquierda
        if (reduced) return;
        const pal = ELFX[el] || ELFX.fuego, base = dir > 0 ? 0 : Math.PI;
        for (let i = 0, n = big ? 26 : 11; i < n; i++) {          // chispas
          const a = base + rnd(-1.1, 1.1), sp = rnd(180, big ? 620 : 420);
          addP({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 500, max: rnd(0.22, 0.45), col: pal[i % 2] });
        }
        for (let i = 0, n = big ? 14 : 6; i < n; i++) {           // partículas del elemento
          const a = rnd(0, Math.PI * 2), sp = rnd(60, 260);
          if (el === 'planta') addP({ k: 'leaf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 90, drag: 1.2, rot: rnd(0, 6), vr: rnd(-9, 9), sz: rnd(6, 11), max: rnd(0.6, 1.0), col: pal[i % 3] });
          else if (el === 'agua') addP({ k: 'drop', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 900, sz: rnd(3, 6.5), max: rnd(0.5, 0.8), col: pal[i % 2] });
          else addP({ k: 'ember', x, y, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp * 0.6 - 90, g: -160, drag: 1.5, sz: rnd(4, 9), max: rnd(0.5, 0.9), col: pal[i % 3] });
        }
        for (let i = 0, n = big ? 8 : 3; i < n; i++) {            // gotas de sudor
          const a = base + rnd(-1.4, 1.4), sp = rnd(120, 300);
          addP({ k: 'drop', x, y: y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, g: 800, sz: rnd(2, 3.6), max: rnd(0.45, 0.8), col: '#e7f5ff' });
        }
        addP({ k: 'ringhit', x, y, max: big ? 0.45 : 0.28, sz: big ? 90 : 46, col: pal[1] });
      }
      function landing(x, y) {                                     // el caído golpea la lona: polvo y onda de choque en el suelo
        if (reduced) return;
        for (let i = 0; i < 16; i++) addP({ k: 'dust', x: x + rnd(-40, 40), y: y - rnd(0, 6), vx: (i % 2 ? 1 : -1) * rnd(30, 150), vy: rnd(-40, -5), drag: 2.2, sz: rnd(10, 22), max: rnd(0.6, 1.1), col: '#c9b8a3' });
        addP({ k: 'ringfloor', x, y: y + 2, max: 0.7, sz: 220, col: '#ffffff' });
      }
      function stepFx(dt) {
        for (let i = fx.length - 1; i >= 0; i--) {
          const p = fx[i]; p.life += dt;
          if (p.life >= p.max) { fx.splice(i, 1); continue; }
          p.vy += p.g * dt;
          if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; if (p.k === 'ember' || p.k === 'leaf') p.vy *= k; }
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        }
      }
      function drawFx(c) {
        if (!fx.length) return;
        c.save();
        for (const p of fx) {
          const q = p.life / p.max, a = 1 - q;
          c.globalAlpha = Math.max(0, a);
          if (p.k === 'spark') { c.strokeStyle = p.col; c.lineWidth = 1.5 + 3 * a; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); c.stroke(); }
          else if (p.k === 'ember') { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.sz * (0.3 + 0.7 * a), 0, 7); c.fill(); }
          else if (p.k === 'drop') { c.fillStyle = p.col; c.beginPath(); c.ellipse(p.x, p.y, p.sz * 0.7, p.sz, Math.atan2(p.vy, p.vx) - Math.PI / 2, 0, 7); c.fill(); }
          else if (p.k === 'leaf') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.beginPath(); c.ellipse(0, 0, p.sz, p.sz * 0.45, 0, 0, 7); c.fill(); c.strokeStyle = '#2b8a3e'; c.lineWidth = 1; c.beginPath(); c.moveTo(-p.sz, 0); c.lineTo(p.sz, 0); c.stroke(); c.restore(); }
          else if (p.k === 'dust') { c.globalAlpha = Math.max(0, a) * 0.35; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.sz * (0.6 + q), 0, 7); c.fill(); }
          else if (p.k === 'ringhit') { c.strokeStyle = p.col; c.lineWidth = 6 * a + 1; c.beginPath(); c.arc(p.x, p.y, p.sz * easeOut(q), 0, 7); c.stroke(); }
          else if (p.k === 'ringfloor') { c.strokeStyle = p.col; c.lineWidth = 5 * a + 1; c.beginPath(); c.ellipse(p.x, p.y, p.sz * easeOut(q), p.sz * 0.16 * easeOut(q), 0, 0, 7); c.stroke(); }
        }
        c.restore();
      }
      function comboAt(t) {                                        // golpes seguidos del mismo luchador (menos de 1,7 s entre uno y otro)
        let n = 0, side = null, lastC = -9;
        for (const e of plan.ev) { if (e.contact > t) break; if (!e.hit) continue; if (e.att === side && e.contact - lastC < 1.7) n++; else { n = 1; side = e.att; } lastC = e.contact; }
        return { n, side, age: t - lastC };
      }

      // ---- CEREMONIA DE VICTORIA (u = segundos desde el final del combate) ----
      // -0,3…1,1 la cámara se acerca a la cara del ganador · 1,1…2,8 primer plano con flashes · 2,2…4,2 entra la chica con la copa
      // 4,0 el ganador se gira y baja la mano · 4,6 le entrega la copa y la levanta · 7,0…7,6 fundido a negro → clasificación
      const winnerFd = j.won ? fa : fb, wf = -winnerFd.dir;      // wf: el lado por el que entra la chica (a la espalda del ganador, lejos del caído)
      const girl = { x: 0, dir: -wf, walk: 0, cup: true, give: 0, clap: false, skin: SKINS[hash(String(j.foe.id) + 'g') % 5], hair: HAIRS[hash(String(j.mine.id) + 'g') % 5] };
      // ---- PRESENTACIÓN: una chica de pelo largo da la vuelta al ring con un cartel en alto con los dos nombres y sus banderas ----
      const LAP = [[500, 522], [865, 520], [735, 338], [265, 338], [135, 520], [500, 522]];
      const lapLen = LAP.slice(1).map((pt, i) => Math.hypot(pt[0] - LAP[i][0], pt[1] - LAP[i][1])), lapTot = lapLen.reduce((a, b) => a + b, 0);
      const lapAt = q => {
        let d = clamp(q, 0, 1) * lapTot, i = 0;
        while (i < lapLen.length - 1 && d > lapLen[i]) { d -= lapLen[i]; i++; }
        const a = LAP[i], b = LAP[i + 1], f = lapLen[i] ? d / lapLen[i] : 0;
        return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), dir: b[0] >= a[0] ? 1 : -1 };
      };
      const lapGirl = { x: 0, dir: 1, walk: 1, cup: false, give: 0, clap: false, sign: true, sc: 1, skin: girl.skin, hair: girl.hair };
      const signA = { name: j.mine.owner || 'Tú', flag: wallFlags.A || '🌍' }, signB = { name: names.B, flag: wallFlags.B || '🌍' };
      let lapY = 0;
      const lapPlace = (now0) => {   // coloca a la chica en su vuelta según el avance de la presentación; devuelve false si no se ve
        if (phase !== 'intro') return false;
        const pr = clamp((now0 - start) / INTRO, 0, 1), q = lapAt(clamp((pr - 0.03) / 0.9, 0, 1));
        lapGirl.x = q.x; lapGirl.dir = q.dir; lapY = q.y; lapGirl.sc = 0.62 + 0.38 * clamp((q.y - 300) / 240, 0, 1);
        return true;
      };
      const lapDraw = (c0, now0) => { drawRingSign(c0, lapGirl, lapY, signA, signB, (now0 - start) / 1000); drawRingGirl(c0, lapGirl, (now0 - start) / 1000, lapY); };
      const flashes = Array.from({ length: 16 }, () => ({ u: rnd(0.7, 6.6), x: rnd(0.06, 0.94), y: rnd(0.14, 0.5) })).sort((a, b) => a.u - b.u);   // fotógrafos
      const confetti = Array.from({ length: 80 }, () => ({ x: Math.random(), vy: rnd(0.22, 0.5), delay: rnd(0, 1.6), ph: rnd(0, 6.3), sz: rnd(8, 15), col: ['#ffd43b', '#e63946', '#4dabf7', '#69db7c', '#f783ac', '#fff'][Math.floor(Math.random() * 6)] }));
      const easeIO = x => { x = clamp(x, 0, 1); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
      const mixCam = (a, b, k) => ({ z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), k)), cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k) });
      function camAt(u, W, H, s) {                               // cámara en coordenadas de escena: zoom y punto central
        const fit = (bw, bh) => Math.max(1, Math.min(W / (s * bw), H / (s * bh)));   // zoom para que quepa un recuadro de bw×bh de escena (vale en móvil vertical y en pantalla ancha)
        const full = { z: 1, cx: 500, cy: 350 };
        const close = { z: fit(210, 200) * (1 + 0.08 * clamp((u - 1.1) / 1.9, 0, 1)), cx: winnerFd.x + winnerFd.dir * 26, cy: 262 };
        const wide = { z: fit(340, 400), cx: winnerFd.x + wf * 58, cy: 300 };
        return mixCam(mixCam(full, close, easeIO((u + 0.3) / 1.4)), wide, easeIO((u - 2.8) / 1.2));
      }
      function endTick(a, b) {                                   // sonidos de la ceremonia (a, b: u anterior y actual)
        if (!reduced) for (const fl of flashes) if (fl.u > a && fl.u <= b) SND.click();
        if (4.0 > a && 4.0 <= b) say(j.won ? '¡Enhorabuena, campeón!' : `¡Enhorabuena, ${names.B}!`);
        if (4.6 > a && 4.6 <= b) { SND.ding(); SND.roar(2.5); }
      }

      function finish() {
        if (done) return; done = true;
        crowdStop(); try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
        stage.classList.add('hidden'); $('fg-skip').onclick = null;
        resolve();
      }
      $('fg-skip').onclick = () => {
        if (phase === 'intro') start = performance.now() - INTRO;
        else if (phase === 'fight') { const target = plan.D + 0.1; skipOff += target - curT; lastT = target; }
        else finish();
      };

      function audioTick(a, b) {                                  // dispara los sonidos de los eventos cuyo instante se ha cruzado
        for (const e of plan.ev) {
          if (e.t > b) break;
          if (e.t > a) { SND.whoosh(); if (Math.random() < 0.4) SND.grunt(); }
          if (e.contact > a && e.contact <= b) {
            const kick = e.type === 'kick' || e.type === 'low';
            if (e.hit) { (kick ? SND.kick : SND.punch)(e.ko ? 1.4 : 0.7 + Math.min(1, e.dmg / 14) * 0.5); SND.ooh(e.ko ? 1.4 : 0.8); } else SND.block();
          }
        }
        if (plan.ko.contact + 1.0 > a && plan.ko.contact + 1.0 <= b) SND.thud();
      }

      function frame(now) {
        if (done) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const W = cv.clientWidth || innerWidth, H = cv.clientHeight || innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        let t = 0;
        if (phase === 'intro' && now - start >= INTRO) { phase = 'fight'; fightStart = now; skipOff = 0; lastT = 0; SND.bell(3); }
        if (phase !== 'intro') {
          slowK = 1;
          if (phase === 'fight' && !reduced) { const kd = lastT - (plan.ko.contact - 0.1); if (kd > 0 && kd < 0.3) { slowK = 0.33; skipOff -= (1 - slowK) * dt; } }   // cámara lenta justo en el golpe final
          t = (now - fightStart) / 1000 + skipOff;
          if (phase === 'fight' && t >= plan.D) { phase = 'end'; SND.bell(1); SND.roar(3); say(j.won ? '¡Has ganado el combate!' : `¡El ganador es ${names.B}!`); }
          if (phase === 'fight') audioTick(lastT, t);
          if (phase === 'end') endTick(lastT - plan.D, t - plan.D);
          if (phase === 'end' && t >= plan.D + END / 1000) { finish(); return; }
          lastT = t; curT = t;
        }
        const exc = phase === 'intro' ? 0.4 : excitement(plan, t);
        crowdLevel(exc);
        // --- escena ---
        const s = Math.min(W / 1000, H / 700), ox = (W - 1000 * s) / 2, oy = (H - 700 * s) / 2;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05050a'); bg.addColorStop(1, '#14101c');
        c.fillStyle = bg; c.fillRect(0, 0, W, H);
        let shake = 0, flash = 0, bump = 0;
        for (const e of plan.ev) { if (e.contact > t) break; if (e.hit) { const k = Math.exp(-(t - e.contact) / 0.14); shake = Math.max(shake, k * (e.ko ? 10 : 5)); flash = Math.max(flash, k * (e.ko ? 1 : 0.5)); bump = Math.max(bump, k * (e.ko ? 0.07 : 0.02)); } }
        if (reduced) { shake = 0; flash *= 0.4; bump = 0; }
        const u = phase === 'intro' ? -99 : t - plan.D, cer = u > -0.3;                  // u: segundos desde el final del combate
        const cam = camAt(u, W, H, s);                                                   // sin ceremonia la cámara es la de siempre (zoom 1 centrada)
        c.save(); c.translate(W / 2 + (Math.random() - 0.5) * shake, H / 2 + (Math.random() - 0.5) * shake); c.scale(s * cam.z * (1 + bump), s * cam.z * (1 + bump)); c.translate(-cam.cx, -cam.cy);
        drawWall(c);                                                                      // cartel del juego en la pared negra
        for (const p of crowd) if (!p.front && p.y < 300) drawPerson(c, p, t, exc);       // público del fondo
        drawRingFloor(c);
        for (const p of crowd) if (!p.front && p.y >= 300) drawPerson(c, p, t, exc);      // público de los lados
        drawRopes(c, true);
        if (cam.z > 1.01) {                                                              // al acercarse, el fondo se oscurece y un foco cálido ilumina al ganador
          const zk = clamp((cam.z - 1) / 1.1, 0, 1);
          c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
          c.fillStyle = `rgba(0,0,0,${0.55 * zk})`; c.fillRect(0, 0, W, H);
          const gl = c.createRadialGradient(W / 2, H * 0.5, 10, W / 2, H * 0.5, Math.max(W, H) * 0.45); gl.addColorStop(0, `rgba(255,226,150,${0.28 * zk})`); gl.addColorStop(1, 'rgba(255,226,150,0)');
          c.fillStyle = gl; c.fillRect(0, 0, W, H); c.restore();
        }
        // luchadores: posiciones según el combate
        const PA = poseOf(plan, 'A', t), PB = poseOf(plan, 'B', t);
        PA.bat = clamp((100 - hpD.A) / 55, 0, 1); PB.bat = clamp((100 - hpD.B) / 55, 0, 1);   // cuántos golpes lleva en la cara
        if (u > -1) {                                                                    // ceremonia: el ganador acaba con la cara destrozada, grita, recibe la copa y la levanta
          const PW = winnerSide === 'A' ? PA : PB;
          PW.bat = lerp(PW.bat, 1, easeOut(clamp((u + 0.2) / 1.0, 0, 1)));
          PW.shout = u > 0.2 && u < 2.9;
          PW.reach = easeOut(clamp((u - 4.0) / 0.5, 0, 1)) * (1 - easeOut(clamp((u - 4.65) / 0.7, 0, 1)));
          PW.cup = u >= 4.6;
          winnerFd.face = u >= 4.0 ? wf : undefined;                                     // se gira hacia la chica
        }
        let env = 0;
        for (const e of plan.ev) { if (e.t > t) break; const p = (t - e.t) / e.dur; if (p < 1) env = Math.sin(Math.PI * p); }
        const after = clamp((t - plan.ko.contact) / 1.0, 0, 1);
        const gap = lerp(205 + Math.sin(t * 2) * 10 - 105 * env, 300, after);
        fa.x = 500 - gap / 2 - fa.dir * (PA.shock * 16 + PA.fall * 70) * 1;
        fb.x = 500 + gap / 2 - fb.dir * (PB.shock * 16 + PB.fall * 70) * 1;
        const FLOOR = 470;
        if (fa.x > fb.x) { /* nunca se cruzan */ }
        if (phase !== 'intro') {                                                         // efectos: chispas y partículas del elemento en cada golpe, polvo al caer
          for (const e of plan.ev) {
            if (e.contact > t) break;
            if (e.hit && e.contact > fxT && e.contact > t - 0.3) { const v = e.att === 'A' ? fb : fa, kick = e.type === 'kick' || e.type === 'low'; burst(v.x + v.dir * 16, FLOOR - (kick ? 120 : 175), e.att === 'A' ? 1 : -1, elOf[e.att], e.ko); }
          }
          const tdn = plan.ko.contact + 1.0;                                             // el caído toca la lona (suena el golpe sordo)
          if (tdn > fxT && tdn <= t && t - tdn < 0.5) { const lf = winnerSide === 'A' ? fb : fa; landing(lf.x, FLOOR); }
          fxT = t;
          stepFx(dt * slowK);
        }
        const lapOn = lapPlace(now);
        if (lapOn && lapY < FLOOR) lapDraw(c, now);                                      // vuelta al ring: al fondo, por detrás de los luchadores
        drawFighter(c, fa, PA, t, FLOOR); drawFighter(c, fb, PB, t, FLOOR);
        if (lapOn && lapY >= FLOOR) lapDraw(c, now);                                     // ...y por delante cuando pasa por el frente
        if (u > 2.2) {                                                                   // la chica del ring llega andando con la copa y se la da al ganador
          const gp = clamp((u - 2.2) / 2.0, 0, 1);
          girl.x = winnerFd.x + wf * (119 + 300 * (1 - gp)); girl.walk = gp < 1 ? 1 : 0;
          girl.cup = u < 4.6; girl.clap = u > 4.95;
          girl.give = easeOut(clamp((u - 4.0) / 0.5, 0, 1)) * (1 - easeOut(clamp((u - 4.65) / 0.5, 0, 1)));
          drawRingGirl(c, girl, t, FLOOR);
        }
        // golpes: estrella + onomatopeya
        for (const e of plan.ev) {
          if (e.contact > t) break; const age = t - e.contact;
          if (!e.hit || age > 0.4) continue;
          const v = e.att === 'A' ? fb : fa, kick = e.type === 'kick' || e.type === 'low';
          const ex = v.x + v.dir * 16, ey = FLOOR - (kick ? 120 : 175), a = 1 - age / 0.4, sz = (e.ko ? 70 : 42) * (0.6 + age * 3);
          c.save(); c.translate(ex, ey); c.globalAlpha = a; c.fillStyle = '#ffe066'; c.strokeStyle = '#e8590c'; c.lineWidth = 3; c.beginPath();
          for (let i = 0; i < 16; i++) { const r = i % 2 ? sz * 0.45 : sz, an = i * Math.PI / 8; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
          c.closePath(); c.fill(); c.stroke();
          c.fillStyle = '#d00000'; c.strokeStyle = '#fff'; c.lineWidth = 4; c.font = '900 30px system-ui, sans-serif'; c.textAlign = 'center';
          c.strokeText(e.word, 0, -sz - 6 - age * 40); c.fillText(e.word, 0, -sz - 6 - age * 40);
          c.restore();
        }
        drawFx(c);
        drawRopes(c, false);
        for (const p of crowd) if (p.front) drawPerson(c, p, t, exc);                     // primera fila
        c.restore();
        if (!reduced && phase !== 'intro') {                                              // líneas de impacto en el K.O.
          const ka = t - plan.ko.contact;
          if (ka >= 0 && ka < 0.32) {
            const q = ka / 0.32, cx = W / 2, cy = H * 0.52, R = Math.hypot(W, H) * 0.6;
            c.save(); c.globalAlpha = 0.55 * (1 - q); c.strokeStyle = '#fff'; c.lineCap = 'round';
            for (let i = 0; i < 36; i++) {
              const an = i * Math.PI * 2 / 36 + Math.sin(i * 12.9898) * 0.05, r0 = R * (0.18 + 0.12 * ((i * 7) % 5) / 5 + q * 0.2), r1 = R * 0.75;
              c.lineWidth = 1.5 + ((i * 5) % 4); c.beginPath(); c.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); c.lineTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1); c.stroke();
            }
            c.restore();
          }
        }
        // viñeta oscura y luces
        const vg = c.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.25, W / 2, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)');
        c.fillStyle = vg; c.fillRect(0, 0, W, H);
        c.save(); c.translate(ox, oy); c.scale(s, s); drawLights(c, t, exc, flash, W, H, ox, oy); c.restore();
        // --- HUD ---
        for (const k of ['A', 'B']) { const target = hpAt(plan, k, t); hpD[k] += (target - hpD[k]) * Math.min(1, dt * 10); }
        const hudA = cer ? 1 - clamp((u + 0.3) / 0.5, 0, 1) : 1;                          // las barras de vida se funden al empezar la ceremonia
        if (hudA > 0.01) { c.save(); c.globalAlpha = hudA; drawHud(c, W, names, hpD, elems, t, phase); c.restore(); }
        c.textBaseline = 'alphabetic';
        if (phase === 'fight' && !cer) {                                                  // combo: dos o más golpes seguidos del mismo luchador
          const cb = comboAt(t);
          if (cb.n >= 2 && cb.age < 1.2) {
            const bw = Math.min(W * 0.4, 340), cx = cb.side === 'A' ? W / 2 - 36 - bw / 2 : W / 2 + 36 + bw / 2, pop = easeOut(cb.age / 0.18), fs = Math.min(W * 0.05, 26) + cb.n * 1.5;
            c.save(); c.globalAlpha = 1 - clamp((cb.age - 0.8) / 0.4, 0, 1); c.translate(cx, 78); c.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
            c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${fs}px system-ui, sans-serif`; c.lineWidth = 5; c.lineJoin = 'round';
            c.strokeStyle = '#000'; c.fillStyle = '#ffd43b'; c.strokeText(`COMBO x${cb.n}`, 0, 0); c.fillText(`COMBO x${cb.n}`, 0, 0); c.restore();
            c.textBaseline = 'alphabetic';
          }
        }
        if (phase === 'intro') {                                                          // presentación automática: quién se enfrenta a quién
          const p = clamp((now - start) / INTRO, 0, 1), pop = easeOut(clamp(p * 3, 0, 1));
          c.fillStyle = `rgba(0,0,0,${0.3 * Math.min(1, p * 4)})`; c.fillRect(0, 0, W, H);   // velo ligero: el ring y la chica se ven
          const cf = 1 - clamp((p - 0.3) / 0.15, 0, 1);                                  // las tarjetas se funden para dejar ver el ring
          c.textAlign = 'center'; c.fillStyle = '#ffd43b'; c.font = `900 ${Math.min(W * 0.09, 54)}px system-ui, sans-serif`; c.fillText('🥊 COMBATE', W / 2, H * 0.22);
          const card = (x, who, el, nm, lv, pw) => {
            c.save(); c.translate(x + (x < W / 2 ? -1 : 1) * (1 - pop) * W * 0.4, H * 0.45); c.globalAlpha = pop * cf;
            c.fillStyle = '#fff'; fitText(c, nm, W * 0.4, Math.min(W * 0.065, 36)); c.fillText(nm, 0, 0);
            c.font = `700 ${Math.min(W * 0.04, 20)}px system-ui, sans-serif`; c.fillStyle = '#ffd43b'; c.fillText(`${el} Nivel ${lv} · ⚔️ ${pw}`, 0, 34);
            c.restore();
          };
          card(W * 0.27, 'A', elems.A, names.A, j.mine.level, j.mine.power); card(W * 0.73, 'B', elems.B, names.B, j.foe.level, j.foe.power);
          c.save(); c.globalAlpha = cf; c.translate(W / 2, H * 0.47); c.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4); c.fillStyle = '#e63946'; c.strokeStyle = '#fff'; c.lineWidth = 6;
          c.font = `900 ${Math.min(W * 0.14, 84)}px system-ui, sans-serif`; c.strokeText('VS', 0, 0); c.fillText('VS', 0, 0); c.restore();
          c.fillStyle = '#fff'; c.font = `700 ${Math.min(W * 0.045, 20)}px system-ui, sans-serif`; c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeText(`Probabilidad de ganar: ${j.chance} %`, W / 2, H * 0.92); c.fillText(`Probabilidad de ganar: ${j.chance} %`, W / 2, H * 0.92);
        }
        if (cer) {                                                                       // ceremonia: flashes de fotógrafos, confeti, barras de cine con el ganador y fundido final
          if (!reduced) for (const fl of flashes) {                                      // destellos pequeños (nunca pantalla completa)
            const age = u - fl.u; if (age < 0 || age > 0.2) continue;
            const x = fl.x * W, y = fl.y * H, gr = c.createRadialGradient(x, y, 0, x, y, 26 + 300 * age);
            gr.addColorStop(0, `rgba(255,255,255,${1 - age / 0.2})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - 100, y - 100, 200, 200);
          }
          if (u > 4.6) for (const p of confetti) {
            const q = u - 4.6 - p.delay; if (q < 0) continue;
            const y = q * p.vy * H - 20; if (y > H + 20) continue;
            c.save(); c.translate(p.x * W + Math.sin(u * 3 + p.ph) * 22, y); c.rotate(u * 5 + p.ph); c.fillStyle = p.col; c.fillRect(-p.sz / 2, -p.sz / 4, p.sz, p.sz / 2); c.restore();
          }
          const bh = Math.min(H * 0.11, 90) * easeOut((u + 0.2) / 0.8);
          c.fillStyle = '#000'; c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          const pop = easeOut((u - 0.25) / 0.45), pn = easeOut((u - 1.0) / 0.5);
          if (pop > 0) {
            const tt = j.won ? '¡HAS GANADO!' : '¡HAS PERDIDO!';
            c.save(); c.globalAlpha = pop; c.translate(W / 2, bh / 2); c.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
            c.fillStyle = '#ffd43b'; fitText(c, tt, W * 0.9, Math.min(W * 0.07, bh * 0.62), 900); c.fillText(tt, 0, 0); c.restore();
          }
          if (pn > 0) {
            c.globalAlpha = pn; c.fillStyle = '#fff'; const l1 = `🏆 GANADOR: ${winnerName}`;
            fitText(c, l1, W * 0.7, Math.min(W * 0.05, bh * 0.36), 800); c.fillText(l1, W / 2, H - bh * 0.66);
            let l2 = '', col = '#69db7c';
            if (u > 6.2) { l2 = 'Ahora, la clasificación…'; col = '#ddd'; } else if (u > 4.7 && j.won && j.prize) l2 = `+${j.prize} ${j.prize === 1 ? 'crédito' : 'créditos'}`;
            if (l2) { c.fillStyle = col; fitText(c, l2, W * 0.7, Math.min(W * 0.04, bh * 0.26), 700); c.fillText(l2, W / 2, H - bh * 0.27); }
            c.globalAlpha = 1;
          }
          const fo = clamp((u - 7.0) / 0.6, 0, 1); if (fo > 0) { c.fillStyle = `rgba(0,0,0,${fo})`; c.fillRect(0, 0, W, H); }
          c.textBaseline = 'alphabetic';
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function go() {
    if (busy || !selected || !state || state.left <= 0) return;
    busy = true; refreshGo(); $('fg-out').textContent = '';
    initAudio();                                               // el audio se activa con el toque del jugador (los móviles lo exigen)
    let j;
    try { j = await api('/api/fight/start', { method: 'POST', body: { parcelId: selected, cardId: Number(($('fg-card') || {}).value) || 0 } }); }
    catch (e) { busy = false; $('fg-out').textContent = e.message; await load(); return; }
    credits = j.credits; updateCreditUi();                     // el servidor ya ha decidido y guardado el combate: se actualiza aunque se cierre la pestaña
    Object.assign(state, { used: j.used, left: j.left, wins: j.wins, losses: j.losses });
    try { await runFight(j); } catch (e) { console.error('Error en el combate:', e); stage.classList.add('hidden'); crowdStop(); }
    busy = false; renderInfo(); refreshGo();
    const last = $('fg-last');
    tab(2);                                                    // al terminar, vuelve a la clasificación
    checkDot();   // gastó una lucha: el puntito se apaga si ya no quedan
    last.textContent = ''; last.className = j.won ? 'win' : 'lose'; last.insertAdjacentHTML('afterbegin', ico(j.won ? 'trophy' : 'x'));
    last.append(j.won ? `¡Has ganado! +${j.prize} ${j.prize === 1 ? 'crédito' : 'créditos'}` : `Ha ganado ${j.foe.owner || 'tu rival'}. ¡Otra vez será!`);
    if (j.card) last.append(` 🃏 ${j.card.name}: +${j.card.pct}% de poder`);
  }

  async function loadRank() {
    const list = $('fg-ranklist'); list.textContent = 'Cargando…';
    try {
      const j = await api('/api/fight/rank', { method: 'GET' });
      if (!j.on) { list.textContent = 'El campeonato no está disponible ahora.'; return; }
      const [y, m] = j.month.split('-');
      $('fg-season').textContent = `Temporada de ${MONTHS[Number(m) - 1]} de ${y}. Ordena: más victorias y, a igualdad, menos derrotas.`;
      list.textContent = '';
      if (!j.top.length) { list.textContent = 'Todavía no ha luchado nadie este mes. ¡Sé el primero!'; return; }
      const t = document.createElement('table'); t.id = 'fg-rank';
      const hd = t.createTHead().insertRow();
      [['#'], ['Jugador'], [ico('trophy'), 'Trofeos'], [ico('check', 'ok'), 'Victorias'], [ico('x', 'ko'), 'Derrotas']].forEach(h => {
        const th = document.createElement('th');
        if (h[1]) { th.innerHTML = h[0]; th.title = h[1]; th.setAttribute('aria-label', h[1]); } else th.textContent = h[0];
        hd.appendChild(th);
      });
      const tb = t.createTBody();
      for (const r of j.top) {
        const tr = tb.insertRow(); if (r.me) tr.className = 'me';
        const c0 = tr.insertCell();
        if (r.pos >= 1 && r.pos <= 3) { const md = document.createElement('span'); md.className = 'fg-medal m' + r.pos; md.textContent = String(r.pos); c0.appendChild(md); }
        else c0.textContent = String(r.pos);
        tr.insertCell().textContent = [typeof flagOf === 'function' ? flagOf(r.country) : '', r.nick].filter(Boolean).join(' ');
        [r.trophies || 0, r.wins, r.losses].forEach(v => { tr.insertCell().textContent = String(v); });
      }
      list.appendChild(t);
      if (j.mine && !j.top.some(r => r.me)) {
        const p = document.createElement('p'); p.className = 'fg-mine';
        p.append(`Tu puesto: #${j.mine.pos}`, chip(ico('trophy'), String(j.mine.trophies || 0)), chip(ico('check', 'ok'), String(j.mine.wins)), chip(ico('x', 'ko'), String(j.mine.losses)));
        list.appendChild(p);
      }
    } catch (e) { list.textContent = e.message; }
  }

  function tab(n) {
    $('fg-v1').classList.toggle('hidden', n !== 1); $('fg-v2').classList.toggle('hidden', n !== 2);
    $('fg-t1').classList.toggle('on', n === 1); $('fg-t2').classList.toggle('on', n === 2);
    if (n === 2) loadRank();
  }
  $('fg-t1').onclick = () => tab(1);
  $('fg-t2').onclick = () => tab(2);
  $('fg-go').onclick = go;
  const close = () => { if (!busy) { box.classList.add('hidden'); if (window.fightMute) window.fightMute(false); } };   // al salir vuelve el sonido de la ciudad
  $('fg-close').onclick = close;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) close(); });
  btn.addEventListener('click', () => {
    if (!authToken) { openLogin('Entra para luchar en el campeonato 🥊'); return; }
    $('fg-last').textContent = '';
    if (window.fightMute) window.fightMute(true);              // en el campeonato solo suena el combate, no la ciudad
    box.classList.remove('hidden'); tab(1); load();
  });
})();
