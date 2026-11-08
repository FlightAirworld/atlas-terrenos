'use strict';
// Campeonato de luchas (botón 🥊 en Extras): cada terreno es una carta con nivel, poder y elemento (🔥 > 🌿 > 💧 > 🔥).
// Eliges tu carta, el servidor elige rival y decide el combate (/api/fight/start); aquí solo se dibuja y se anima.
// El combate se ve dentro de un ring (canvas a pantalla completa): presentación automática de los dos luchadores, ~15 s de puñetazos
// y patadas al azar (el resultado ya viene decidido por el servidor: gana quien tiene que ganar), público alrededor animando,
// focos de luz, sonidos generados con Web Audio y, al terminar, el ganador y la clasificación.
// Hasta 3 luchas al día; cada victoria da 1 crédito. Clasificación mensual en /api/fight/rank.
// Usa globals de app.js: authToken, credits, updateCreditUi(), openLogin(), api(), fmtNum().
(function () {
  const $ = id => document.getElementById(id);
  const btn = $('fight-btn');
  if (!btn) return;
  const fmt = n => (typeof fmtNum === 'function' ? fmtNum(n) : String(n));
  const EL = { fuego: ['🔥', '#e8590c'], planta: ['🌿', '#2f9e44'], agua: ['💧', '#1c7ed6'] };
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
    #fight .modal-card { max-height: 90vh; overflow-y: auto; text-align: center; }
    #fg-tabs { display: flex; gap: 6px; margin: 8px 0; }
    #fg-tabs button { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid #8884; background: transparent; font-weight: 700; cursor: pointer; color: inherit; }
    #fg-tabs button.on { background: #222; color: #fff; }
    .fg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; margin: 10px 0; max-height: 34vh; overflow-y: auto; padding: 2px; }
    .fg-card { position: relative; border: 3px solid var(--el, #888); border-radius: 12px; padding: 6px 4px; background: #8881; cursor: pointer; color: inherit; font: inherit; }
    .fg-card.sel { box-shadow: 0 0 0 3px #ffd43b; transform: translateY(-2px); }
    .fg-card img { width: 100%; height: 56px; object-fit: contain; display: block; }
    .fg-card b { display: block; font-size: 13px; }
    .fg-card small { display: block; opacity: .8; font-size: 11px; }
    .fg-el { position: absolute; top: 2px; right: 4px; font-size: 16px; }
    #fg-go { width: 100%; padding: 12px; font-size: 17px; font-weight: 800; border-radius: 12px; border: 0; background: #e63946; color: #fff; cursor: pointer; }
    #fg-go:disabled { background: #888; cursor: default; }
    #fg-out { font-size: 20px; font-weight: 800; min-height: 1.4em; margin: 6px 0; }
    #fg-last { font-size: 18px; font-weight: 800; margin: 6px 0; }
    #fg-rank { width: 100%; border-collapse: collapse; margin-top: 8px; }
    #fg-rank td, #fg-rank th { padding: 6px 4px; border-bottom: 1px solid #8883; text-align: left; font-size: 14px; }
    #fg-rank tr.me { background: #ffd43b44; font-weight: 800; }
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
    '<h2 id="fg-title">🥊 Campeonato</h2>' +
    '<p class="muted" id="fg-info">Cargando…</p>' +
    '<div id="fg-tabs"><button type="button" id="fg-t1" class="on">Luchar</button><button type="button" id="fg-t2">Clasificación</button></div>' +
    '<div id="fg-v1"><p id="fg-out" aria-live="polite"></p>' +
    '<p class="muted" id="fg-pick">Elige tu carta (tu terreno):</p><div class="fg-grid" id="fg-grid"></div>' +
    '<button id="fg-go" type="button" disabled>🥊 ¡Luchar!</button></div>' +
    '<div id="fg-v2" class="hidden"><p id="fg-last" aria-live="polite"></p><p class="muted" id="fg-season"></p><div id="fg-ranklist"></div></div>' +
    '<p class="muted" style="font-size:12px;margin-top:10px">🔥 gana a 🌿 · 🌿 gana a 💧 · 💧 gana a 🔥. El rival lo elige el sistema (otro jugador de nivel parecido) y no pierde nada. El combate se ve en el ring, dura unos 15 segundos y se juega solo.</p>' +
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
    const e = document.createElement('span'); e.className = 'fg-el'; e.textContent = (EL[c.element] || EL.fuego)[0];
    const b = document.createElement('b'); b.textContent = (extra && extra.title) || ('Nivel ' + c.level);
    const s = document.createElement('small'); s.textContent = '⚔️ ' + c.power + (extra && extra.sub ? ' · ' + extra.sub : '');
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
    $('fg-pick').textContent = state.parcels.length ? 'Elige tu carta (tu terreno):' : 'Necesitas al menos un terreno para luchar.';
  }
  function refreshGo() {
    const g = $('fg-go');
    g.disabled = busy || !selected || state.left <= 0;
    g.textContent = state.left > 0 ? '🥊 ¡Luchar!' : '⏳ Vuelve mañana';
  }
  function renderInfo() {
    $('fg-info').textContent = `Luchas de hoy: ${state.used}/${state.max} · Cada victoria: +${state.prize} ${state.prize === 1 ? 'crédito' : 'créditos'} · Este mes: ${state.wins} ✅ ${state.losses} ❌`;
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
    }
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
    c.save(); c.translate(fd.x, floorY - P.fall * 16); c.scale(fd.dir, 1); if (P.fall > 0) c.rotate(-P.fall * 1.5);
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
    if (P.win) { lead = { x: sh.x + 14 + Math.sin(t * 9) * 6, y: sh.y - 92 }; rear = { x: sh.x - 10 + Math.cos(t * 9) * 6, y: sh.y - 96 }; }
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
    else { c.fillStyle = '#fff'; c.beginPath(); c.arc(head.x + 10, head.y - 2, 4.5, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(head.x + 11.5, head.y - 2, 2.2, 0, 7); c.fill(); }
    line(c, [head.x + 6, head.y + 11, head.x + 15, head.y + (P.shock > 0.3 ? 14 : 11)], 2.5, '#5a1a1a');   // boca
    arm(c, { x: sh.x + 6, y: sh.y + 2 }, lead, 1, fd);                                  // brazo de delante
    c.restore();
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
    c.save(); c.translate(500, 425); c.scale(1, 0.32); c.fillStyle = '#ffffff22'; c.font = '900 120px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('ATLAS', 0, 40); c.restore();
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
      const elems = { A: (EL[j.mine.element] || EL.fuego)[0], B: (EL[j.foe.element] || EL.fuego)[0] };
      const fa = { dir: 1, x: 400, ph: 0.3, shorts: (EL[j.mine.element] || EL.fuego)[1], skin: SKINS[hash(j.mine.id) % 5], hair: HAIRS[hash(j.mine.id + 'h') % 5] };
      const fb = { dir: -1, x: 600, ph: 2.1, shorts: (EL[j.foe.element] || EL.fuego)[1], skin: SKINS[hash(j.foe.id) % 5], hair: HAIRS[hash(j.foe.id + 'h') % 5] };
      const winnerName = j.won ? 'Tú' : names.B;
      const cv = $('fg-cv'), c = cv.getContext('2d');
      const crowd = buildCrowd();
      stage.classList.remove('hidden');
      crowdStart(); say(`¡Atención! Combate entre tú y ${names.B}`);
      const INTRO = 2800, END = 3800;
      let start = performance.now(), last = start, phase = 'intro', fightStart = 0, skipOff = 0, lastT = 0, curT = 0, done = false;
      const hpD = { A: 100, B: 100 };

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
          t = (now - fightStart) / 1000 + skipOff;
          if (phase === 'fight' && t >= plan.D) { phase = 'end'; SND.bell(1); SND.roar(3); say(j.won ? '¡Has ganado el combate!' : `¡El ganador es ${names.B}!`); }
          if (phase === 'fight') audioTick(lastT, t);
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
        let shake = 0, flash = 0;
        for (const e of plan.ev) { if (e.contact > t) break; if (e.hit) { const k = Math.exp(-(t - e.contact) / 0.14); shake = Math.max(shake, k * (e.ko ? 10 : 5)); flash = Math.max(flash, k * (e.ko ? 1 : 0.5)); } }
        if (reduced) { shake = 0; flash *= 0.4; }
        c.save(); c.translate(ox + (Math.random() - 0.5) * shake, oy + (Math.random() - 0.5) * shake); c.scale(s, s);
        for (const p of crowd) if (!p.front && p.y < 300) drawPerson(c, p, t, exc);       // público del fondo
        drawRingFloor(c);
        for (const p of crowd) if (!p.front && p.y >= 300) drawPerson(c, p, t, exc);      // público de los lados
        drawRopes(c, true);
        // luchadores: posiciones según el combate
        const PA = poseOf(plan, 'A', t), PB = poseOf(plan, 'B', t);
        let env = 0;
        for (const e of plan.ev) { if (e.t > t) break; const p = (t - e.t) / e.dur; if (p < 1) env = Math.sin(Math.PI * p); }
        const after = clamp((t - plan.ko.contact) / 1.0, 0, 1);
        const gap = lerp(205 + Math.sin(t * 2) * 10 - 105 * env, 300, after);
        fa.x = 500 - gap / 2 - fa.dir * (PA.shock * 16 + PA.fall * 70) * 1;
        fb.x = 500 + gap / 2 - fb.dir * (PB.shock * 16 + PB.fall * 70) * 1;
        const FLOOR = 470;
        if (fa.x > fb.x) { /* nunca se cruzan */ }
        drawFighter(c, fa, PA, t, FLOOR); drawFighter(c, fb, PB, t, FLOOR);
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
        drawRopes(c, false);
        for (const p of crowd) if (p.front) drawPerson(c, p, t, exc);                     // primera fila
        c.restore();
        // viñeta oscura y luces
        const vg = c.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.25, W / 2, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)');
        c.fillStyle = vg; c.fillRect(0, 0, W, H);
        c.save(); c.translate(ox, oy); c.scale(s, s); drawLights(c, t, exc, flash, W, H, ox, oy); c.restore();
        // --- HUD ---
        for (const k of ['A', 'B']) { const target = hpAt(plan, k, t); hpD[k] += (target - hpD[k]) * Math.min(1, dt * 10); }
        drawHud(c, W, names, hpD, elems, t, phase);
        c.textBaseline = 'alphabetic';
        if (phase === 'intro') {                                                          // presentación automática: quién se enfrenta a quién
          const p = clamp((now - start) / INTRO, 0, 1), pop = easeOut(clamp(p * 3, 0, 1));
          c.fillStyle = `rgba(0,0,0,${0.62 * Math.min(1, p * 4)})`; c.fillRect(0, 0, W, H);
          c.textAlign = 'center'; c.fillStyle = '#ffd43b'; c.font = `900 ${Math.min(W * 0.09, 54)}px system-ui, sans-serif`; c.fillText('🥊 COMBATE', W / 2, H * 0.22);
          const card = (x, who, el, nm, lv, pw) => {
            c.save(); c.translate(x + (x < W / 2 ? -1 : 1) * (1 - pop) * W * 0.4, H * 0.45); c.globalAlpha = pop;
            c.fillStyle = '#fff'; fitText(c, nm, W * 0.4, Math.min(W * 0.065, 36)); c.fillText(nm, 0, 0);
            c.font = `700 ${Math.min(W * 0.04, 20)}px system-ui, sans-serif`; c.fillStyle = '#ffd43b'; c.fillText(`${el} Nivel ${lv} · ⚔️ ${pw}`, 0, 34);
            c.restore();
          };
          card(W * 0.27, 'A', elems.A, names.A, j.mine.level, j.mine.power); card(W * 0.73, 'B', elems.B, names.B, j.foe.level, j.foe.power);
          c.save(); c.translate(W / 2, H * 0.47); c.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4); c.fillStyle = '#e63946'; c.strokeStyle = '#fff'; c.lineWidth = 6;
          c.font = `900 ${Math.min(W * 0.14, 84)}px system-ui, sans-serif`; c.strokeText('VS', 0, 0); c.fillText('VS', 0, 0); c.restore();
          c.fillStyle = '#fff'; c.font = `700 ${Math.min(W * 0.045, 20)}px system-ui, sans-serif`; c.fillText(`Probabilidad de ganar: ${j.chance} %`, W / 2, H * 0.7);
        } else if (phase === 'end') {                                                     // ganador
          const p = clamp((t - plan.D) / 0.6, 0, 1);
          c.fillStyle = `rgba(0,0,0,${0.5 * p})`; c.fillRect(0, 0, W, H); c.globalAlpha = p; c.textAlign = 'center';
          c.fillStyle = '#ffd43b'; c.strokeStyle = '#000'; c.lineWidth = 6; fitText(c, j.won ? '¡HAS GANADO!' : '¡HAS PERDIDO!', W * 0.9, Math.min(W * 0.11, 64), 900);
          c.strokeText(j.won ? '¡HAS GANADO!' : '¡HAS PERDIDO!', W / 2, H * 0.4); c.fillText(j.won ? '¡HAS GANADO!' : '¡HAS PERDIDO!', W / 2, H * 0.4);
          c.fillStyle = '#fff'; fitText(c, `🏆 GANADOR: ${winnerName}`, W * 0.9, Math.min(W * 0.06, 32)); c.fillText(`🏆 GANADOR: ${winnerName}`, W / 2, H * 0.4 + 46);
          if (j.won && j.prize) { c.fillStyle = '#69db7c'; c.font = `800 ${Math.min(W * 0.05, 26)}px system-ui, sans-serif`; c.fillText(`+${j.prize} ${j.prize === 1 ? 'crédito' : 'créditos'}`, W / 2, H * 0.4 + 86); }
          c.fillStyle = '#ddd'; c.font = `600 ${Math.min(W * 0.04, 18)}px system-ui, sans-serif`; c.fillText('Ahora, la clasificación…', W / 2, H * 0.4 + 124); c.globalAlpha = 1;
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
    try { j = await api('/api/fight/start', { method: 'POST', body: { parcelId: selected } }); }
    catch (e) { busy = false; $('fg-out').textContent = e.message; await load(); return; }
    credits = j.credits; updateCreditUi();                     // el servidor ya ha decidido y guardado el combate: se actualiza aunque se cierre la pestaña
    Object.assign(state, { used: j.used, left: j.left, wins: j.wins, losses: j.losses });
    try { await runFight(j); } catch (e) { console.error('Error en el combate:', e); stage.classList.add('hidden'); crowdStop(); }
    busy = false; renderInfo(); refreshGo();
    const last = $('fg-last');
    tab(2);                                                    // al terminar, vuelve a la clasificación
    last.textContent = j.won ? `🏆 ¡Has ganado! +${j.prize} ${j.prize === 1 ? 'crédito' : 'créditos'}` : `💥 Ha ganado ${j.foe.owner || 'tu rival'}. ¡Otra vez será!`;
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
      const hd = t.createTHead().insertRow(); ['#', 'Jugador', '✅', '❌'].forEach(h => { const th = document.createElement('th'); th.textContent = h; hd.appendChild(th); });
      const tb = t.createTBody();
      for (const r of j.top) {
        const tr = tb.insertRow(); if (r.me) tr.className = 'me';
        [r.pos === 1 ? '🥇' : r.pos === 2 ? '🥈' : r.pos === 3 ? '🥉' : String(r.pos), r.nick, String(r.wins), String(r.losses)].forEach(v => { tr.insertCell().textContent = v; });
      }
      list.appendChild(t);
      if (j.mine && !j.top.some(r => r.me)) { const p = document.createElement('p'); p.textContent = `Tu puesto: #${j.mine.pos} (${j.mine.wins} ✅ ${j.mine.losses} ❌)`; list.appendChild(p); }
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
  const close = () => { if (!busy) box.classList.add('hidden'); };
  $('fg-close').onclick = close;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) close(); });
  btn.addEventListener('click', () => {
    if (!authToken) { openLogin('Entra para luchar en el campeonato 🥊'); return; }
    $('fg-last').textContent = '';
    box.classList.remove('hidden'); tab(1); load();
  });
})();
