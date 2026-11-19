/* Cascada · lógica del juego, sonidos y partidas en segundo plano
 * VERSIÓN CON CRÉDITOS REALES: el saldo es el del jugador en todo el juego (tabla packs) y lo manda el SERVIDOR.
 * Cada partida (o compra de partidas) se cobra y se paga en el servidor (/api/cascada/play); aquí solo se dibuja el resultado.
 * Ya no existe «Cargar créditos»: no se pueden jugar más créditos de los que tienes. */
(() => {
  'use strict';
  const E = CascadaEngine;
  const $ = (s) => document.querySelector(s);
  const KEY = 'cascada.v2';
  const BG_MS = 3000;     // ritmo de juego cuando la pantalla está cerrada/oculta
  const TIER = ['', 'rio', 'mar', 'cas'];
  const TIER_NAME = ['', 'Bote Río', 'Bote Mar', 'Bote Cascada'];
  const fmt = (n) => Number(n).toLocaleString('es-ES');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------------- estado ---------------- */
  // En el navegador solo se guardan preferencias y la compra en curso; el saldo y las estadísticas vienen del servidor.
  const def = () => ({
    credits: 0, last: null, spins: 0, won: 0, best: 0, auto: false, sel: 10,
    sound: true, notify: false,
    bulk: { left: 0, total: 0, done: 0, won: 0, queue: [] },
    botes: [0, 0, 0, 0], tick: Date.now(),
  });
  const load = () => {
    try {
      const j = JSON.parse(localStorage.getItem(KEY));
      if (j && typeof j === 'object') {
        const d = def();
        d.auto = !!j.auto; d.sel = Math.min(100, Math.max(1, +j.sel || 10));
        d.sound = j.sound !== false; d.notify = !!j.notify;
        if (j.bulk && Array.isArray(j.bulk.queue)) d.bulk = Object.assign(d.bulk, j.bulk);
        d.tick = +j.tick || Date.now();
        return d;
      }
    } catch (e) { /* sin datos */ }
    return def();
  };
  let S = load();
  const save = () => {
    S.tick = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify({ auto: S.auto, sel: S.sel, sound: S.sound, notify: S.notify, bulk: S.bulk, tick: S.tick })); } catch (e) { /* sin espacio */ }
  };

  const newAW = () => ({ plays: 0, won: 0, wins: 0, best: 0, botes: [], bulks: [], noCredits: false });
  let AW = newAW();             // resumen de lo jugado mientras no mirabas
  let running = false;          // bucle automático / compra activo
  let busy = false;             // partida manual en curso
  let ready = false;            // saldo cargado del servidor
  let needLogin = false;
  let catching = false;
  let hold = null;              // premio que aún no se ha "revelado" en pantalla
  let cur = E.play().grid;      // rodillos visibles (solo dibujo inicial)

  /* ---------------- conexión con el servidor ---------------- */
  const findSession = () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!/^sb-.+-auth-token$/.test(k)) continue;
        const j = JSON.parse(localStorage.getItem(k));
        const s = j && (j.currentSession || j);
        if (s && s.access_token) return { k, j, s };
      }
    } catch (e) { /* sin sesión */ }
    return null;
  };
  const refreshSession = async () => {
    const ss = findSession(); if (!ss || !ss.s.refresh_token) return null;
    try {
      const cfg = await (await fetch('/api/config')).json();
      const a = cfg && cfg.auth; if (!a || !a.url || !a.anonKey) return null;
      const r = await fetch(a.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: a.anonKey }, body: JSON.stringify({ refresh_token: ss.s.refresh_token }) });
      if (!r.ok) return null;
      const n = await r.json();
      if (!n.access_token) return null;
      const merged = Object.assign({}, ss.s, n);
      localStorage.setItem(ss.k, JSON.stringify(ss.j.currentSession ? Object.assign({}, ss.j, { currentSession: merged }) : merged));   // se guarda también para el resto del juego
      return n.access_token;
    } catch (e) { return null; }
  };
  const call = async (url, body, token) => {
    const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    return { r, j };
  };
  const api = async (url, body) => {
    const ss = findSession();
    if (!ss) { const e = new Error('Entra con tu cuenta'); e.login = true; throw e; }
    let { r, j } = await call(url, body, ss.s.access_token);
    if (r.status === 401) {
      const t = await refreshSession();
      if (!t) { const e = new Error('Entra con tu cuenta'); e.login = true; throw e; }
      ({ r, j } = await call(url, body, t));
      if (r.status === 401) { const e = new Error('Entra con tu cuenta'); e.login = true; throw e; }
    }
    if (!r.ok) { const e = new Error(j.error || 'Error ' + r.status); e.status = r.status; throw e; }
    return j;
  };
  // Pide n partidas al servidor (cobra n y paga los premios en una sola operación). Devuelve { credits, results }.
  const playServer = (n) => api('/api/cascada/play', { n });
  const takeStats = (st) => {
    if (!st) return;
    S.spins = st.spins; S.won = st.won; S.best = st.best; S.botes = st.botes || S.botes; S.last = st.last || S.last;
  };
  const sync = async () => {
    try {
      const j = await api('/api/cascada');
      if (j.on === false) { await modal('<h2>Cascada</h2><p>Ahora mismo está desactivada.</p><a class="btn gold" href="/">Volver</a>'); return false; }
      S.credits = j.credits; takeStats(j.stats); ready = true; needLogin = false;
      return true;
    } catch (e) {
      if (e.login) { needLogin = true; return false; }
      return false;
    }
  };
  const loginModal = () => modal('<h2>Entra con tu cuenta</h2><p>Cascada se juega con tus créditos del juego. Entra con tu cuenta en el juego y vuelve aquí.</p><a class="btn gold" href="/" style="display:block;text-decoration:none">Ir al juego</a>');

  /* ---------------- sonido (sintetizado, sin archivos) ---------------- */
  let ac = null;
  const A = () => {
    if (!S.sound) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  };
  const tone = (f, t, d, o = {}) => {
    const c = A(); if (!c) return;
    const { type = 'sine', g = 0.15, to = null } = o;
    const os = c.createOscillator(), v = c.createGain(), t0 = c.currentTime + t;
    os.type = type; os.frequency.setValueAtTime(f, t0);
    if (to) os.frequency.exponentialRampToValueAtTime(to, t0 + d);
    v.gain.setValueAtTime(0.0001, t0);
    v.gain.exponentialRampToValueAtTime(g, t0 + 0.012);
    v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    os.connect(v); v.connect(c.destination); os.start(t0); os.stop(t0 + d + 0.05);
  };
  const noise = (t, d, o = {}) => {
    const c = A(); if (!c) return;
    const { g = 0.1, f = 1200 } = o;
    const len = Math.floor(c.sampleRate * d), b = c.createBuffer(1, len, c.sampleRate), dt = b.getChannelData(0);
    for (let i = 0; i < len; i++) dt[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), v = c.createGain();
    s.buffer = b; fl.type = 'lowpass'; fl.frequency.value = f; v.gain.value = g;
    s.connect(fl); fl.connect(v); v.connect(c.destination); s.start(c.currentTime + t);
  };
  const sfx = {
    spin() { for (let i = 0; i < 7; i++) noise(i * 0.11, 0.1, { g: 0.05, f: 800 + i * 220 }); },
    stop(i) { tone(560 - i * 45, 0, 0.2, { to: 170, g: 0.17 }); noise(0, 0.09, { g: 0.06, f: 2200 }); },
    win(p) {
      const n = [523, 659, 784, 1047, 1319, 1568];
      const k = p >= 75 ? 6 : p >= 15 ? 5 : p >= 5 ? 4 : p >= 2 ? 3 : 2;
      for (let i = 0; i < k; i++) tone(n[i], i * 0.09, 0.3, { type: 'triangle', g: 0.14 });
    },
    bote() {
      noise(0, 0.9, { g: 0.2, f: 3000 });
      [392, 523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.15 + i * 0.12, 0.4, { type: 'triangle', g: 0.17 }));
      tone(130, 0, 1.2, { type: 'sine', g: 0.2, to: 60 });
    },
    done() { [784, 988, 1175].forEach((f, i) => tone(f, i * 0.14, 0.4, { type: 'sine', g: 0.16 })); },
    buy() { tone(880, 0, 0.12, { type: 'square', g: 0.06 }); tone(1320, 0.08, 0.15, { type: 'square', g: 0.06 }); },
  };

  /* ---------------- avisos y efectos ---------------- */
  const notify = (title, body) => {
    if (S.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(title, { body }); } catch (e) { /* ignorar */ }
    }
  };
  const rain = (n, coins) => {
    const box = $('#splash');
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = coins && i % 2 ? 'coin' : 'drop';
      d.style.left = Math.random() * 100 + '%';
      d.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
      d.style.animationDelay = Math.random() * 0.8 + 's';
      box.appendChild(d);
      setTimeout(() => d.remove(), 4500);
    }
  };
  const modal = (html, cls = '') => new Promise((res) => {
    const m = $('#modal');
    m.className = 'modal ' + cls; m.innerHTML = html;
    $('#ov').classList.add('show');
    const b = m.querySelector('[data-close]');
    if (b) b.addEventListener('click', () => { $('#ov').classList.remove('show'); res(); });
    else res();
  });
  const rndSym = (() => { const w = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6, 7]; return () => w[Math.floor(Math.random() * w.length)]; })();

  /* ---------------- rodillos ---------------- */
  const cell = (s) => `<div class="cell"><svg viewBox="0 0 100 100"><use href="#s${s}"/></svg></div>`;
  const reelsBox = $('#reels');
  for (let i = 0; i < 5; i++) {
    const r = document.createElement('div');
    r.className = 'reel';
    r.innerHTML = `<div class="strip">${[0, 1, 2].map((k) => cell(cur[k][i])).join('')}</div>`;
    reelsBox.appendChild(r);
  }
  const reelEls = () => [...document.querySelectorAll('.reel')];
  const clearWin = () => {
    document.querySelectorAll('.cell.win').forEach((e) => e.classList.remove('win'));
    $('#line').classList.remove('on');
  };
  const highlight = (r) => {
    const rs = reelEls();
    for (let c = 0; c < r.count; c++) rs[c].firstElementChild.children[1].classList.add('win');
    $('#line').classList.add('on');
  };

  const spinAnim = (r, fast) => new Promise((done) => {
    clearWin();
    let fin = 0;
    reelEls().forEach((el, i) => {
      const strip = el.firstElementChild;
      const extra = (fast ? 7 : 13) + i * (fast ? 2 : 4);
      const items = [];
      for (let k = 0; k < 3; k++) items.push(cur[k][i]);
      for (let k = 0; k < extra; k++) items.push(rndSym());
      for (let k = 0; k < 3; k++) items.push(r.grid[k][i]);
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      strip.innerHTML = items.map(cell).join('');
      void strip.offsetHeight;
      const dur = fast ? 420 + i * 110 : 950 + i * 330;
      strip.style.transition = `transform ${dur}ms cubic-bezier(.2,.75,.25,1)`;
      strip.style.transform = `translateY(-${((items.length - 3) / items.length) * 100}%)`;
      setTimeout(() => {
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        strip.innerHTML = [0, 1, 2].map((k) => cell(r.grid[k][i])).join('');
        sfx.stop(i);
        if (++fin === 5) { cur = r.grid; done(); }
      }, dur + 40);
    });
  });

  /* ---------------- resultado de una partida ---------------- */
  // El servidor ya ha cobrado y pagado: aquí solo se «revela» (se suma el premio a lo que se ve en pantalla)
  const apply = (r, inBulk, sum) => {
    S.spins++;
    S.credits += r.prize;
    S.won += r.prize;
    if (r.prize > S.best) S.best = r.prize;
    if (inBulk) S.bulk.won += r.prize;
    if (r.tier) S.botes[r.tier]++;
    if (r.prize) S.last = { prize: r.prize, tier: r.tier, sym: r.sym, count: r.count };
    if (sum) {
      sum.plays++; sum.won += r.prize;
      if (r.prize) sum.wins++;
      if (r.prize > sum.best) sum.best = r.prize;
      if (r.tier) sum.botes.push({ tier: r.tier, prize: r.prize });
    }
  };
  const sumPrize = (list) => list.reduce((a, r) => a + r.prize, 0);

  const celebrate = (r) => {
    if (!r.prize) return;
    highlight(r);
    const lvl = r.tier ? 4 : r.prize >= 15 ? 3 : r.prize >= 5 ? 2 : 1;
    const label = ['', '¡PREMIO!', '¡BUEN PREMIO!', '¡GRAN PREMIO!', '¡BOTE!'][lvl];
    const t = $('#toast');
    t.innerHTML = `+${fmt(r.prize)}<small>${label}</small>`;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    if (lvl >= 3) rain(lvl === 4 ? 40 : 14, lvl === 4);
    if (navigator.vibrate) navigator.vibrate(lvl === 4 ? [200, 80, 200, 80, 400] : 40 * lvl);
    if (r.tier) {
      sfx.bote();
      const el = $(['', '#boteRio', '#boteMar', '#boteCas'][r.tier]);
      el.classList.add('hit'); setTimeout(() => el.classList.remove('hit'), 3200);
      modal(
        `<h2>🌊 ¡${TIER_NAME[r.tier].toUpperCase()}! 🌊</h2>
         <div class="big">+${fmt(r.prize)}</div><p>créditos</p>
         <p>${r.count} × ${E.NAMES[r.sym]} en la línea central</p>
         <button class="btn gold" data-close>¡Genial!</button>`, TIER[r.tier]);
      notify('¡' + TIER_NAME[r.tier] + '!', `Has ganado ${fmt(r.prize)} créditos`);
    } else {
      sfx.win(r.prize);
    }
  };

  // una partida con animación. kind: manual | auto | bulk
  const one = async (kind) => {
    const fast = kind !== 'manual';
    const inBulk = kind === 'bulk';
    let r;
    if (inBulk) {
      r = S.bulk.queue.shift(); S.bulk.left--; S.bulk.done++;
    } else {
      const j = await playServer(1);                 // el servidor cobra 1 y paga el premio; si no hay saldo, falla y no pasa nada
      r = j.results[0];
      S.credits = j.credits - r.prize;               // el saldo lo manda el servidor (el premio se suma al revelarlo)
    }
    const bestPrev = S.best;
    apply(r, inBulk, null);
    hold = { prize: r.prize, tier: r.tier, bestPrev };
    render(); save();
    sfx.spin();
    await spinAnim(r, fast);
    hold = null;
    render(); save();
    celebrate(r);
    return r;
  };

  /* ---------------- juego en segundo plano / pantalla cerrada ---------------- */
  const endBulk = () => {
    const info = { total: S.bulk.total, won: S.bulk.won };
    S.bulk = { left: 0, total: 0, done: 0, won: 0, queue: [] };
    return info;
  };

  const catchUp = async (minEl) => {
    if (catching) return;
    const now = Date.now(), el = now - S.tick;
    if (el < minEl) return;
    if (!(S.auto || S.bulk.left > 0)) { S.tick = now; return; }
    catching = true;
    try {
      let n = Math.min(Math.floor(el / BG_MS), 5000);
      // compra en curso: se van revelando las partidas que ya cobró el servidor
      while (n > 0 && S.bulk.left > 0) {
        const r = S.bulk.queue.shift(); S.bulk.left--; S.bulk.done++; n--;
        apply(r, true, AW);
        if (r.tier) notify('¡' + TIER_NAME[r.tier] + '!', `Has ganado ${fmt(r.prize)} créditos`);
        if (S.bulk.left === 0) {
          AW.bulks.push(endBulk());
          notify('Compra completada', 'Se han jugado todas las partidas compradas');
        }
      }
      // automático: se piden al servidor en bloques, sin pasarse del saldo
      while (n > 0 && S.auto && S.bulk.left === 0) {
        const k = Math.min(n, 100, Math.floor(S.credits));
        if (k < 1) { S.auto = false; AW.noCredits = true; break; }
        let j;
        try { j = await playServer(k); } catch (e) { if (e.status === 402) { S.auto = false; AW.noCredits = true; } break; }
        S.credits = j.credits - sumPrize(j.results);
        for (const r of j.results) {
          apply(r, false, AW);
          if (r.tier) notify('¡' + TIER_NAME[r.tier] + '!', `Has ganado ${fmt(r.prize)} créditos`);
        }
        n -= k;
      }
    } finally { catching = false; }
    save();
  };

  const showAway = () => {
    const a = AW; AW = newAW();
    let h = `<h2>🌊 Mientras no mirabas</h2><p>Se han jugado <b>${fmt(a.plays)}</b> partidas.</p>`;
    h += `<div class="big">+${fmt(a.won)}</div><p>créditos ganados en ${fmt(a.wins)} premios · mejor premio ${fmt(a.best)}</p>`;
    a.botes.forEach((b) => { h += `<p>🏆 ¡Te tocó el <b>${TIER_NAME[b.tier]}</b>: +${fmt(b.prize)}!</p>`; });
    a.bulks.forEach((b) => { h += `<p>✅ Compra de ${fmt(b.total)} partidas completada: ganaste ${fmt(b.won)} créditos.</p>`; });
    if (a.noCredits) h += '<p>⚠️ El modo automático se paró porque te quedaste sin créditos.</p>';
    h += '<button class="btn gold" data-close>Seguir jugando</button>';
    if (a.botes.length) sfx.bote(); else sfx.done();
    render();
    return modal(h, a.botes.length ? TIER[a.botes[0].tier] : '');
  };

  /* ---------------- bucle automático / compras ---------------- */
  const loop = async () => {
    if (running || !ready) return;
    running = true; render();
    try {
      while (S.bulk.left > 0 || S.auto) {
        if (document.hidden) { await sleep(BG_MS); await catchUp(BG_MS); continue; }
        if (AW.plays > 0 || AW.noCredits || AW.bulks.length) await showAway();
        if (S.bulk.left > 0) {
          const r = await one('bulk');
          if (S.bulk.left === 0) {
            const info = endBulk(); save(); render(); sfx.done();
            notify('Compra completada', `Se han jugado ${info.total} partidas`);
            await modal(`<h2>✅ Compra completada</h2><p>Se han jugado las <b>${fmt(info.total)}</b> partidas.</p>
              <div class="big">+${fmt(info.won)}</div><p>créditos ganados en esta compra</p>
              <button class="btn gold" data-close>Aceptar</button>`);
          } else if (r.tier) await sleep(2600);
        } else {
          if (S.credits < 1) {
            S.auto = false; save(); render();
            await modal('<h2>Sin créditos</h2><p>El modo automático se ha parado.</p><button class="btn gold" data-close>Aceptar</button>');
            break;
          }
          let r;
          try { r = await one('auto'); } catch (e) {
            S.auto = false; save(); render();
            await modal(`<h2>Modo automático parado</h2><p>${e.login ? 'Entra con tu cuenta para jugar.' : e.message}</p><button class="btn gold" data-close>Aceptar</button>`);
            await sync(); render();
            break;
          }
          if (r.tier) await sleep(2600);
        }
        await sleep(450);
      }
    } finally { running = false; render(); }
  };

  /* ---------------- pantalla ---------------- */
  const render = () => {
    const h = hold || { prize: 0, tier: 0, bestPrev: S.best };
    const cr = S.credits - h.prize;
    $('#stCredits').textContent = fmt(cr);
    $('#balance').textContent = fmt(cr);
    $('#stSpins').textContent = fmt(S.spins);
    $('#stWon').textContent = fmt(S.won - h.prize);
    $('#stBest').textContent = fmt(hold ? h.bestPrev : S.best);
    ['Rio', 'Mar', 'Cas'].forEach((k, i) => {
      const n = S.botes[i + 1] - (h.tier === i + 1 ? 1 : 0);
      $('#n' + k).textContent = n === 1 ? '1 vez' : n + ' veces';
    });
    const lock = running || busy || !ready;
    $('#bPlay').disabled = lock || S.credits < 1;
    $('#bPlay').classList.toggle('spinning', running || busy);
    $('#bAuto').textContent = S.auto ? '■ PARAR AUTOMÁTICO' : '▶ AUTOMÁTICO';
    $('#bAuto').classList.toggle('on', S.auto);
    $('#bAuto').disabled = busy || !ready;
    $('#hint').textContent = needLogin ? 'entra con tu cuenta para jugar'
      : !ready ? 'cargando tu saldo…'
      : S.credits < 1 && S.bulk.left === 0 ? 'no te quedan créditos'
      : 'cada partida cuesta 1 crédito';
    // último premio, siempre visible en la pantalla del juego (en Cascada)
    const L = hold ? null : S.last;
    const lp = $('#lastPrize');
    if (hold) { /* se revela al parar los rodillos */ }
    else if (L) {
      lp.classList.add('has');
      lp.innerHTML = `<span>ÚLTIMO PREMIO</span><b>+${fmt(L.prize)}</b><em>${L.tier ? TIER_NAME[L.tier] + ' · ' : ''}${L.count} × ${E.NAMES[L.sym]}</em>`;
    } else {
      lp.classList.remove('has');
      lp.innerHTML = '<span>ÚLTIMO PREMIO</span><em>todavía ninguno · ¡suerte!</em>';
    }
    // las partidas compradas no pueden pasar del saldo
    const maxSel = Math.max(1, Math.min(100, Math.floor(S.credits)));
    if (S.sel > maxSel && S.bulk.left === 0) S.sel = maxSel;
    $('#range').max = maxSel;
    $('#selN').textContent = S.sel;
    $('#range').value = S.sel;
    document.querySelectorAll('.chip').forEach((c) => { c.classList.toggle('sel', +c.dataset.n === S.sel); c.disabled = +c.dataset.n > S.credits; });
    $('#bBuy').textContent = `COMPRAR ${S.sel} · ${S.sel} ${S.sel === 1 ? 'crédito' : 'créditos'}`;
    $('#bBuy').disabled = busy || !ready || S.bulk.left > 0 || S.credits < S.sel;
    const bi = $('#bulkInfo');
    bi.style.display = S.bulk.total > 0 ? '' : 'none';
    if (S.bulk.total > 0) {
      $('#progBar').style.width = (S.bulk.done / S.bulk.total) * 100 + '%';
      $('#progTxt').textContent = `Partida ${S.bulk.done} de ${S.bulk.total} · ganado ${fmt(S.bulk.won)}`;
    }
    $('#bSound').textContent = S.sound ? '🔊' : '🔇';
    $('#bSound').classList.toggle('off', !S.sound);
    $('#bBell').classList.toggle('off', !S.notify);
  };

  /* ---------------- controles ---------------- */
  // Ya no se pueden «cargar» créditos gratis: se quita ese bloque y se explica de dónde sale el saldo
  const loadBlock = $('#bLoad') && $('#bLoad').closest('.bulk');
  if (loadBlock) loadBlock.style.display = 'none';
  const foot = $('.foot');
  if (foot) foot.innerHTML = 'Juegas con tus créditos del juego: cada partida se descuenta de tu saldo y los premios se suman a él. No se puede jugar más de lo que tienes.<br>Si cierras la pantalla, el modo automático o la compra siguen jugando.';
  const stopBtn = $('#bStop'); if (stopBtn) stopBtn.textContent = 'TERMINAR YA y ver el resultado';

  $('#bPlay').onclick = async () => {
    if (running || busy || !ready || S.credits < 1) return;
    busy = true; render();
    try { await one('manual'); }
    catch (e) {
      if (e.login) { needLogin = true; loginModal(); }
      else { sfx.done(); await sync(); modal(`<h2>No se pudo jugar</h2><p>${e.status === 402 ? 'No tienes créditos suficientes.' : e.message}</p><button class="btn gold" data-close>Vale</button>`); }
    }
    busy = false; render();
  };
  $('#bAuto').onclick = () => {
    A();
    if (S.auto) { S.auto = false; save(); render(); return; }
    if (S.credits < 1 && S.bulk.left === 0) {
      modal('<h2>Sin créditos</h2><p>No te quedan créditos para jugar.</p><button class="btn gold" data-close>Vale</button>');
      return;
    }
    S.auto = true; save(); loop();
  };

  [1, 10, 25, 50, 100].forEach((n) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.dataset.n = n; b.textContent = n;
    b.onclick = () => { S.sel = Math.min(n, Math.max(1, Math.floor(S.credits))); save(); render(); };
    $('#chips').appendChild(b);
  });
  $('#bMinus').onclick = () => { S.sel = Math.max(1, S.sel - 1); render(); };
  $('#bPlus').onclick = () => { S.sel = Math.min(100, Math.max(1, Math.floor(S.credits)), S.sel + 1); render(); };
  $('#range').oninput = (e) => { S.sel = Math.min(+e.target.value, Math.max(1, Math.floor(S.credits))); render(); };
  $('#range').onchange = save;

  $('#bBuy').onclick = async () => {
    const n = S.sel;
    if (S.bulk.left > 0 || busy || !ready || S.credits < n) return;
    A(); sfx.buy();
    busy = true; render();
    try {
      const j = await playServer(n);                 // el servidor cobra las n partidas y paga todos los premios de golpe
      S.credits = j.credits - sumPrize(j.results);   // los premios se van sumando al revelarlas
      S.bulk = { left: n, total: n, done: 0, won: 0, queue: j.results };
      save(); busy = false; render(); loop();
    } catch (e) {
      busy = false;
      if (e.login) { needLogin = true; loginModal(); }
      else { await sync(); modal(`<h2>No se pudo comprar</h2><p>${e.status === 402 ? 'No tienes créditos suficientes.' : e.message}</p><button class="btn gold" data-close>Vale</button>`); }
      render();
    }
  };
  // Las partidas compradas ya están cobradas en el servidor, así que no se devuelven: «terminar» las juega todas de golpe
  $('#bStop').onclick = () => {
    if (S.bulk.left <= 0) return;
    const rest = S.bulk.queue.splice(0);
    rest.forEach((r) => { S.bulk.left--; S.bulk.done++; apply(r, true, null); });
    const info = endBulk(); save(); render(); sfx.done();
    modal(`<h2>✅ Compra terminada</h2><p>Se han jugado las <b>${fmt(info.total)}</b> partidas.</p><div class="big">+${fmt(info.won)}</div><p>créditos ganados en esta compra</p><button class="btn gold" data-close>Aceptar</button>`);
  };

  $('#bSound').onclick = () => { S.sound = !S.sound; save(); render(); if (S.sound) sfx.buy(); };
  $('#bBell').onclick = async () => {
    if (S.notify) { S.notify = false; save(); render(); return; }
    if (!('Notification' in window)) {
      modal('<h2>Avisos</h2><p>Tu navegador no permite avisos del sistema. Los avisos dentro del juego sí funcionan.</p><button class="btn" data-close>Vale</button>');
      return;
    }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    S.notify = p === 'granted'; save(); render();
    if (!S.notify) modal('<h2>Avisos desactivados</h2><p>Permite las notificaciones del navegador para recibir avisos cuando salga un bote con la pantalla apagada.</p><button class="btn" data-close>Vale</button>');
  };

  $('#bInfo').onclick = () => {
    const rows = [...E.PAY].sort((a, b) => a[2] - b[2]);
    const sec = (t) => `<div class="sec">${t}</div>`;
    let h = '<h2>Cómo se juega</h2>'
      + '<p>Cada partida cuesta <b>1 crédito</b> de tu saldo. Gana quien consigue símbolos iguales seguidos desde la izquierda en la <b>línea central</b>.</p>'
      + '<div class="pt">';
    let last = -1;
    rows.forEach(([s, c, p]) => {
      const g = p >= 100 ? 2 : p >= 15 ? 1 : 0;
      if (g !== last) { h += sec(['Premios pequeños', 'Premios medios', 'Botes · figuras raras'][g]); last = g; }
      h += `<span class="c">${Array.from({ length: c }, () => `<svg viewBox="0 0 100 100"><use href="#s${s}"/></svg>`).join('')}</span>`
        + `<span>${c} ${E.NAMES[s]}</span><b>${fmt(p)}</b>`;
    });
    h += '</div><p style="font-size:13px">Suelen salir varios premios de 1 a 10 créditos cada 20 partidas y, de media, un bote de 100 a 1000 cada 500 partidas, siempre al azar.</p>'
      + '<p style="font-size:13px">Con <b>AUTOMÁTICO</b> o <b>COMPRAR</b> (1 a 100 partidas) el juego sigue aunque cierres la pantalla; al volver verás un resumen. Solo puedes jugar los créditos que tienes.</p>'
      + '<button class="btn gold" data-close>Entendido</button>';
    modal(h);
  };

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { save(); return; }
    await catchUp(BG_MS);
    if (!running && !busy && S.bulk.left === 0) await sync();   // el saldo puede haber cambiado en el resto del juego
    render();
    if (running) return;
    if (AW.plays > 0 || AW.noCredits || AW.bulks.length) showAway();
    loop();
  });
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);

  /* ---------------- arranque ---------------- */
  // burbujas de fondo
  const sc = $('#scenery');
  for (let i = 0; i < 14; i++) {
    const b = document.createElement('i');
    b.className = 'bubble';
    const s = 8 + Math.random() * 22;
    b.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${9 + Math.random() * 12}s;animation-delay:${-Math.random() * 15}s`;
    sc.appendChild(b);
  }

  render();
  (async () => {
    const ok = await sync();
    if (!ok) { render(); if (needLogin) loginModal(); return; }
    // si se cerró a mitad de una compra: el servidor ya cobró y pagó todo, así que lo que quedaba se da por jugado
    if (S.bulk.queue.length > 0) {
      const rest = S.bulk.queue.splice(0);
      AW.bulks.push({ total: S.bulk.total, won: S.bulk.won + sumPrize(rest) });
      AW.plays += rest.length; AW.won += sumPrize(rest);
      S.bulk = { left: 0, total: 0, done: 0, won: 0, queue: [] };
    } else if (S.bulk.left > 0) { S.bulk = { left: 0, total: 0, done: 0, won: 0, queue: [] }; }
    save();
    await catchUp(BG_MS);
    render();
    if (AW.plays > 0 || AW.noCredits || AW.bulks.length) showAway();
    loop();
  })();
})();
