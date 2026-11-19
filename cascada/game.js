/* Cascada · lógica del juego, sonidos y partidas en segundo plano
 * VERSIÓN CON CRÉDITOS REALES: el saldo es el del jugador en todo el juego (tabla packs) y lo manda el SERVIDOR.
 * Cada partida (o compra de partidas) se cobra y se paga en el servidor (/api/cascada/play); aquí solo se dibuja el resultado.
 * No existe «Cargar créditos»: no se pueden jugar más créditos de los que tienes.
 * APUESTA: el botón rojo juega con una apuesta de 1 a 50 créditos; los premios se multiplican por la apuesta.
 * TESORO: tres cofres en la línea central abren una partida especial de 15 cartas (3 bombas). Todo se decide en el servidor.
 * SEGUNDO PLANO: fuera de esta pantalla sigue jugando cascada/bg.js (cargado en la página principal). */
(() => {
  'use strict';
  const E = CascadaEngine;
  const $ = (s) => document.querySelector(s);
  const KEY = 'cascada.v2', AWK = 'cascada.aw', LK = 'cascada.lock';
  const BG_MS = 3000;     // ritmo de juego cuando la pantalla está cerrada/oculta
  const MAX_MULT = 50;    // apuesta máxima por partida
  const CF_PLAYS = 20;    // el confeti no sale antes de 20 partidas…
  const CF_GAP = 30 * 60 * 1000;   // …ni más de una vez cada media hora
  const TIER = ['', 'rio', 'mar', 'cas'];
  const TIER_NAME = ['', 'Bote Río', 'Bote Mar', 'Bote Cascada'];
  const fmt = (n) => Number(n).toLocaleString('es-ES');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------------- estilos de lo nuevo (Perdido, parar, tesoro, confeti) ---------------- */
  const css = document.createElement('style');
  css.textContent = `
  .stats{grid-template-columns:repeat(5,1fr);gap:4px}
  .stat b{font-size:14px}.stat.credits b{font-size:16px}.stat span{font-size:9px;letter-spacing:.5px}
  .stat.lost b{color:#ffb0a8}
  .bulk h3 .btn{padding:6px 12px;font-size:12px;letter-spacing:1px}
  .cf{position:absolute;top:-20px;width:10px;height:16px;border-radius:2px;animation:fall linear forwards}
  .bz{position:fixed;inset:0;z-index:70;overflow:auto;padding:14px 12px calc(20px + env(safe-area-inset-bottom));
    background:radial-gradient(120% 60% at 50% -10%,#6a3fd0 0,transparent 60%),linear-gradient(#1a1040,#0b2a4a 60%,#07323f);animation:mpop .4s cubic-bezier(.2,1.2,.4,1)}
  .bz-in{max-width:480px;margin:0 auto;text-align:center}
  .bz h2{margin:6px 0 4px;font-size:24px;letter-spacing:1px;color:#ffe9a0;text-shadow:0 3px 0 #5a3500,0 0 20px #ffd25a88}
  .bz-sub{margin:0 0 10px;font-size:13px;color:#d6fbff;line-height:1.4}
  .bz-acc{margin:6px 0 12px;padding:8px;border-radius:16px;background:#00000040;border:2px solid #ffd25a66}
  .bz-acc span{display:block;font-size:11px;letter-spacing:3px;color:#9ee9f7}
  .bz-acc b{font-size:44px;color:var(--gold);text-shadow:0 3px 0 #7a4a00}
  .bz-acc small{display:block;font-size:11px;color:#b5f1fb}
  .bz-acc.pop b{animation:hit .5s}
  .bz-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  .bz-card{aspect-ratio:3/4;border-radius:12px;font-weight:900;font-size:clamp(15px,4.6vw,22px);display:grid;place-items:center;
    background:linear-gradient(160deg,#37c4e6,#1b5fb3);border:2px solid #cffaff;box-shadow:0 4px 0 #0a3e6e;color:#fff;transition:transform .15s}
  .bz-card:active:not(:disabled){transform:scale(.93)}
  .bz-card:disabled{opacity:1;cursor:default}
  .bz-card.back::before{content:"🌊";font-size:1.5em;opacity:.9}
  .bz-card.open{background:linear-gradient(#ffd25a,#ea9a10);color:#4a2a00;border-color:#fff3b0;box-shadow:0 4px 0 #8a5300;animation:flip .45s}
  .bz-card.bomb{background:linear-gradient(#ff7d70,#a3121f);border-color:#ffd0cc;box-shadow:0 4px 0 #5a0a12;font-size:30px;animation:flip .45s,shake .5s .3s}
  .bz-card.ghost{opacity:.4;filter:saturate(.5)}
  @keyframes flip{from{transform:rotateY(90deg) scale(.8)}to{transform:none}}
  @keyframes shake{25%{transform:translate(-5px,3px)}50%{transform:translate(5px,-3px)}75%{transform:translate(-3px,-2px)}}
  .bz-msg{min-height:44px;margin:12px 0 4px;font-size:18px;font-weight:800;color:#fff}
  .bz-msg.bad{color:#ffb0a8}.bz-msg.good{color:#9dffc0}
  .bz .btn.bz-cash{width:100%;font-size:18px;padding:14px;margin-top:6px}
  `;
  document.head.appendChild(css);

  /* ---------------- estado ---------------- */
  // En el navegador solo se guardan preferencias y la compra en curso; el saldo y las estadísticas vienen del servidor.
  const def = () => ({
    credits: 0, last: null, spins: 0, won: 0, spent: 0, lost: 0, best: 0, auto: false, sel: 10, mult: 1,
    sound: true, notify: false, cf: { at: 0, n: 0 },
    bulk: { left: 0, total: 0, done: 0, won: 0, queue: [] },
    botes: [0, 0, 0, 0], jackpots: [0, 0, 0, 0], tick: Date.now(),
  });
  const load = () => {
    try {
      const j = JSON.parse(localStorage.getItem(KEY));
      if (j && typeof j === 'object') {
        const d = def();
        d.auto = !!j.auto; d.sel = Math.min(100, Math.max(1, +j.sel || 10));
        d.mult = Math.min(MAX_MULT, Math.max(1, Math.floor(+j.mult) || 1));
        d.sound = j.sound !== false; d.notify = !!j.notify;
        if (j.cf && typeof j.cf === 'object') d.cf = { at: +j.cf.at || 0, n: +j.cf.n || 0 };
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
    try { localStorage.setItem(KEY, JSON.stringify({ auto: S.auto, sel: S.sel, mult: S.mult, sound: S.sound, notify: S.notify, cf: S.cf, bulk: S.bulk, tick: S.tick })); } catch (e) { /* sin espacio */ }
  };

  const newAW = () => ({ plays: 0, won: 0, wins: 0, best: 0, botes: [], bulks: [], noCredits: false, bonus: 0 });
  let AW = newAW();             // resumen de lo jugado mientras no mirabas
  let running = false;          // bucle automático / compra activo
  let busy = false;             // partida manual en curso
  let ready = false;            // saldo cargado del servidor
  let needLogin = false;
  let catching = false;
  let inBonus = false;          // pantalla del tesoro abierta
  let needBonus = false;        // hay partidas del tesoro pendientes en el servidor
  let hold = null;              // premio que aún no se ha "revelado" en pantalla
  let cur = E.play().grid;      // rodillos visibles (solo dibujo inicial)

  // apuesta: nunca más que el saldo real, y como mucho 50
  const maxMult = () => Math.max(1, Math.min(MAX_MULT, Math.floor(S.credits)));
  const clampMult = () => { S.mult = Math.min(Math.max(1, Math.floor(S.mult) || 1), maxMult()); };
  // partidas que se pueden comprar con la apuesta actual y el saldo real
  const maxSel = () => Math.max(1, Math.min(100, Math.floor(S.credits / S.mult)));
  const unit = (n) => (n === 1 ? 'crédito' : 'créditos');
  // parte del bote que corresponde a la apuesta actual (igual que el servidor: bote × apuesta / 50)
  const potShare = (pot) => Math.floor(Math.max(0, Number(pot) || 0) * Math.min(MAX_MULT, Math.max(1, Math.floor(S.mult) || 1)) / MAX_MULT);

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
  // Pide n partidas con apuesta m al servidor (cobra n×m y paga los premios en una sola operación). Devuelve { credits, results }.
  const playServer = (n, m) => api('/api/cascada/play', { n, m });
  const takeJackpots = (jp) => { if (jp) S.jackpots = [0, Number(jp.rio || 0), Number(jp.mar || 0), Number(jp.cas || 0)]; };
  const takeStats = (st) => {
    if (!st) return;
    S.spins = st.spins; S.won = st.won; S.spent = st.spent || 0; S.lost = st.lost || 0; S.best = st.best; S.botes = st.botes || S.botes; S.last = st.last || S.last;
  };
  const sync = async () => {
    try {
      const j = await api('/api/cascada');
      if (j.on === false) { await modal('<h2>Cascada</h2><p>Ahora mismo está desactivada.</p><a class="btn gold" href="/">Volver</a>'); return false; }
      S.credits = j.credits; takeStats(j.stats); takeJackpots(j.jackpots); ready = true; needLogin = false;
      if (j.bonusPending > 0) needBonus = true;
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
    chests() {   // fanfarria al salir los tres cofres
      noise(0, 1.1, { g: 0.16, f: 2600 });
      [262, 330, 392, 523, 392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.45, { type: 'triangle', g: 0.17 }));
      tone(98, 0, 1.6, { type: 'sine', g: 0.22, to: 55 });
    },
    card(v) { tone(660 + Math.min(v || 0, 40) * 12, 0, 0.18, { type: 'triangle', g: 0.15 }); tone(990, 0.07, 0.2, { type: 'sine', g: 0.1 }); },
    boom() { noise(0, 0.9, { g: 0.32, f: 600 }); tone(120, 0, 0.8, { type: 'sawtooth', g: 0.2, to: 35 }); },
    done() { [784, 988, 1175].forEach((f, i) => tone(f, i * 0.14, 0.4, { type: 'sine', g: 0.16 })); },
    buy() { tone(880, 0, 0.12, { type: 'square', g: 0.06 }); tone(1320, 0.08, 0.15, { type: 'square', g: 0.06 }); },
  };
  // Música de la partida del tesoro (bucle sintetizado que suena mientras la pantalla está abierta)
  const music = {
    t: null, i: 0,
    start() {
      if (this.t || !A()) return;
      const mel = [392, 494, 587, 784, 587, 494, 440, 523, 659, 880, 659, 523, 392, 494, 587, 740, 587, 494, 330, 392, 494, 659, 494, 392];
      this.i = 0;
      this.t = setInterval(() => {
        const i = this.i++, f = mel[i % mel.length];
        tone(f, 0, 0.24, { type: 'triangle', g: 0.085 });
        if (i % 2 === 0) tone(f / 2, 0, 0.34, { type: 'sine', g: 0.07 });
        if (i % 4 === 0) noise(0, 0.05, { g: 0.03, f: 5000 });
      }, 220);
    },
    stop() { clearInterval(this.t); this.t = null; },
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
  // Confeti de colores
  const confetti = (n = 90) => {
    const box = $('#splash'), cols = ['#ffd25a', '#ff6a5a', '#5ae0ff', '#7dffa9', '#c58bff', '#ff9ad0', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'cf';
      d.style.left = Math.random() * 100 + '%';
      d.style.background = cols[i % cols.length];
      d.style.transform = 'rotate(' + Math.floor(Math.random() * 360) + 'deg)';
      d.style.animationDuration = 2.2 + Math.random() * 2.4 + 's';
      d.style.animationDelay = Math.random() * 0.9 + 's';
      box.appendChild(d);
      setTimeout(() => d.remove(), 6000);
    }
  };
  // Confeti al azar: no antes de 20 partidas desde el anterior y como mucho una vez cada media hora
  const maybeConfetti = () => {
    S.cf.n++;
    if (document.hidden || S.cf.n < CF_PLAYS || Date.now() - S.cf.at < CF_GAP || Math.random() > 0.1) return;
    S.cf.n = 0; S.cf.at = Date.now();
    confetti(110); sfx.done();
    const t = $('#toast');
    t.innerHTML = '🎉<small>¡CONFETI!</small>';
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
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
    S.spent += r.mult || 1;
    S.lost += Math.max(0, (r.mult || 1) - r.prize); // pérdida neta de ESTA partida; los premios previos no la compensan
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
      if (r.bonusId) { sum.bonus++; needBonus = true; }
    }
  };
  const sumPrize = (list) => list.reduce((a, r) => a + r.prize, 0);

  const celebrate = (r) => {
    if (!r.prize && !r.bonusId) return;
    highlight(r);
    const t = $('#toast');
    if (r.bonusId) {   // tres cofres: ¡partida especial!
      t.innerHTML = '🧰 ¡TESORO!<small>PARTIDA ESPECIAL</small>';
      t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
      rain(26, true);
      if (navigator.vibrate) navigator.vibrate([150, 60, 150, 60, 300]);
      sfx.chests();
      notify('🧰 ¡Tres cofres!', 'Tienes una partida del tesoro esperando');
      return;
    }
    const lvl = r.tier ? 4 : r.prize >= 15 ? 3 : r.prize >= 5 ? 2 : 1;
    const label = ['', '¡PREMIO!', '¡BUEN PREMIO!', '¡GRAN PREMIO!', '¡BOTE!'][lvl];
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
         <p>${r.count} × ${E.NAMES[r.sym]} en la línea central${r.mult > 1 ? ' · apuesta ×' + r.mult : ''}</p>
         <button class="btn gold" data-close>¡Genial!</button>`, TIER[r.tier]);
      notify('¡' + TIER_NAME[r.tier] + '!', `Has ganado ${fmt(r.prize)} créditos`);
    } else {
      sfx.win(r.prize);
    }
  };

  /* ---------------- partida especial del tesoro ---------------- */
  // 15 cartas tapadas, 3 con bomba. Cada carta se destapa en el servidor; el acumulado solo se paga al cobrar.
  const bonusScreen = (b) => new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'bz';
    ov.innerHTML = `<div class="bz-in">
      <h2>🧰 TESORO HUNDIDO 🧰</h2>
      <p class="bz-sub">Destapa cartas: cada una suma premio… pero <b>${b.bombs} esconden una 💣</b>. Si sale una bomba, <b>pierdes todo lo acumulado</b>. ¡Cobra cuando quieras!</p>
      <div class="bz-acc" id="bzAccBox"><span>ACUMULADO</span><b id="bzAcc">0</b>${b.mult > 1 ? `<small>apuesta ×${b.mult}</small>` : ''}</div>
      <div class="bz-grid" id="bzGrid"></div>
      <div class="bz-msg" id="bzMsg">Elige una carta</div>
      <button class="btn gold bz-cash" id="bzCash">RETIRARSE</button>
    </div>`;
    document.body.appendChild(ov);
    const grid = ov.querySelector('#bzGrid'), msg = ov.querySelector('#bzMsg'), cashB = ov.querySelector('#bzCash'), accEl = ov.querySelector('#bzAcc');
    let acc = b.acc, wait = false, ended = false;
    const opened = new Set();
    const cards = [];
    const say = (t, cls = '') => { msg.textContent = t; msg.className = 'bz-msg ' + cls; };
    const setAcc = (v) => {
      acc = v; accEl.textContent = fmt(v);
      const bx = ov.querySelector('#bzAccBox'); bx.classList.remove('pop'); void bx.offsetWidth; bx.classList.add('pop');
      cashB.textContent = ended ? cashB.textContent : (acc > 0 ? 'COBRAR ' + fmt(acc) : 'RETIRARSE');
    };
    const show = (i, v, ghost) => {
      const c = cards[i]; opened.add(i);
      c.className = 'bz-card ' + (v === 0 ? 'bomb' : 'open') + (ghost ? ' ghost' : '');
      c.textContent = v === 0 ? '💣' : '+' + fmt(v);
      c.disabled = true;
    };
    const revealRest = (board) => { if (Array.isArray(board)) board.forEach((v, i) => { if (!opened.has(i)) show(i, v, true); }); };
    const lock = (d) => { cards.forEach((c, i) => { c.disabled = d || opened.has(i); }); cashB.disabled = d; };
    const close = () => {
      ov.querySelector('.bz-in').appendChild(Object.assign(document.createElement('div'), { id: 'bzEnd' }));
      cashB.disabled = false; cashB.className = 'btn gold bz-cash'; cashB.textContent = 'VOLVER AL JUEGO';
      cashB.onclick = () => { ov.remove(); music.stop(); render(); save(); resolve(true); };
    };
    const won = (j) => {
      S.credits = j.credits;
      if (j.paid > 0) { S.won += j.paid; if (j.paid > S.best) S.best = j.paid; S.last = { prize: j.paid, tier: 0, sym: 7, count: 3 }; }
    };
    for (let i = 0; i < b.cards; i++) {
      const c = document.createElement('button');
      c.className = 'bz-card back'; c.type = 'button';
      c.onclick = async () => {
        if (wait || ended || opened.has(i)) return;
        wait = true; lock(true);
        try {
          const j = await api('/api/cascada/bonus/pick', { id: b.id, i });
          if (j.bomb) {
            ended = true; show(i, 0); sfx.boom(); if (navigator.vibrate) navigator.vibrate([300, 80, 300]);
            acc = 0; accEl.textContent = '0'; S.credits = j.credits;
            say(`💥 ¡BOMBA! Pierdes ${fmt(j.lost)}`, 'bad');
            setTimeout(() => revealRest(j.board), 700);
            close();
          } else {
            show(i, j.v); sfx.card(j.v / (b.mult || 1)); ended = !!j.done; setAcc(j.acc);
            if (j.done) {   // las ha destapado todas: se cobra solo
              won(j); sfx.done(); confetti(120); revealRest(j.board);
              say(`🏆 ¡Todas las cartas! Cobras +${fmt(j.paid)}`, 'good'); close();
            } else say(`+${fmt(j.v)} · quedan ${j.left} cartas buenas`, 'good');
          }
        } catch (e) {
          if (e.status === 409) { ended = true; say('Esta partida ya había terminado', 'bad'); close(); }
          else say(e.login ? 'Entra con tu cuenta' : (e.message || 'Error, inténtalo otra vez'), 'bad');
        }
        wait = false; if (!ended) lock(false);
      };
      cards.push(c); grid.appendChild(c);
    }
    b.picked.forEach((p) => show(p.i, p.v));
    setAcc(b.acc);
    cashB.onclick = async () => {
      if (wait || ended) return;
      wait = true; lock(true);
      try {
        const j = await api('/api/cascada/bonus/cash', { id: b.id });
        ended = true; won(j); revealRest(j.board);
        if (j.paid > 0) { sfx.done(); if (j.paid >= 20 * b.mult) confetti(80); say(`✅ Cobras +${fmt(j.paid)} créditos`, 'good'); }
        else say('Te retiras sin premio', '');
        close();
      } catch (e) {
        if (e.status === 409) { ended = true; say('Esta partida ya había terminado', 'bad'); close(); }
        else say(e.message || 'Error, inténtalo otra vez', 'bad');
        wait = false; if (!ended) lock(false);
      }
    };
    music.start();
  });

  // Abre una partida del tesoro (por su id). Devuelve true si el jugador la jugó hasta el final.
  const runBonus = async (id, pre) => {
    if (inBonus) return false;
    inBonus = true;
    try {
      let b = pre;
      if (!b) {
        try { const j = await api('/api/cascada/bonus/state', { id }); b = j.bonus; }
        catch (firstError) {
          // Recuperación: si el ID recibido no se puede consultar, busca la partida pendiente del usuario.
          const fallback = await api('/api/cascada/bonus/state', {});
          b = fallback.bonus;
          if (!b) throw firstError;
        }
      }
      if (!b) throw new Error('La partida del tesoro no aparece como pendiente en el servidor.');
      await bonusScreen(b);
      return true;
    } catch (e) {
      await modal(`<h2>No se pudo abrir el tesoro</h2><p>${String(e.message || 'Error de conexión')}</p><p>La partida queda guardada. Vuelve a intentarlo al recargar CASCADA.</p><button class="btn gold" data-close>Vale</button>`);
      return false;
    } finally { inBonus = false; render(); }
  };
  // Juega todas las partidas del tesoro que estén pendientes en el servidor (por ejemplo las que salieron en segundo plano)
  const pendingBonus = async () => {
    if (inBonus || !ready) return;
    needBonus = false;
    for (let g = 0; g < 50; g++) {
      let j; try { j = await api('/api/cascada/bonus/state', {}); } catch (e) { return; }
      if (!j.bonus) return;
      if (!(await runBonus(j.bonus.id, j.bonus))) return;
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
      clampMult();
      const j = await playServer(1, S.mult);         // el servidor cobra la apuesta y paga el premio; si no hay saldo, falla y no pasa nada
      takeJackpots(j.jackpots);
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
    if (r.bonusId) { await sleep(2200); await runBonus(r.bonusId); }
    else maybeConfetti();
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
        clampMult();
        const k = Math.min(n, 100, Math.floor(S.credits / S.mult));
        if (k < 1) { S.auto = false; AW.noCredits = true; break; }
        let j;
        try { j = await playServer(k, S.mult); } catch (e) { if (e.status === 402) { S.auto = false; AW.noCredits = true; } break; }
        takeJackpots(j.jackpots);
        S.credits = j.credits - sumPrize(j.results);
        for (const r of j.results) {
          apply(r, false, AW);
          if (r.tier) notify('¡' + TIER_NAME[r.tier] + '!', `Has ganado ${fmt(r.prize)} créditos`);
          if (r.bonusId) notify('🧰 ¡Tres cofres!', 'Tienes una partida del tesoro esperando');
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
    if (a.bonus > 0) h += `<p>🧰 ¡Salieron <b>tres cofres</b> ${a.bonus > 1 ? a.bonus + ' veces' : ''}! Tienes ${a.bonus > 1 ? 'partidas' : 'una partida'} del tesoro esperando.</p>`;
    a.bulks.forEach((b) => { h += `<p>✅ Compra de ${fmt(b.total)} partidas completada: ganaste ${fmt(b.won)} créditos.</p>`; });
    if (a.noCredits) h += '<p>⚠️ El modo automático se paró porque te quedaste sin créditos.</p>';
    h += '<button class="btn gold" data-close>Seguir jugando</button>';
    if (a.botes.length) sfx.bote(); else sfx.done();
    render();
    return modal(h, a.botes.length ? TIER[a.botes[0].tier] : '');
  };
  const hasAway = () => AW.plays > 0 || AW.noCredits || AW.bulks.length || AW.bonus > 0;

  /* ---------------- bucle automático / compras ---------------- */
  const loop = async () => {
    if (running || !ready) return;
    running = true; render();
    try {
      while (S.bulk.left > 0 || S.auto) {
        if (document.hidden) { await sleep(BG_MS); await catchUp(BG_MS); continue; }
        if (hasAway()) await showAway();
        if (needBonus) await pendingBonus();
        if (!(S.bulk.left > 0 || S.auto)) break;   // el jugador pulsó PARAR mientras tanto
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
            await modal(`<h2>Modo automático parado</h2><p>${e.login ? 'Entra con tu cuenta para jugar.' : e.status === 402 ? 'No tienes créditos suficientes.' : e.message}</p><button class="btn gold" data-close>Aceptar</button>`);
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
    $('#stLost').textContent = fmt(S.lost);
    $('#stBest').textContent = fmt(hold ? h.bestPrev : S.best);
    clampMult();   // la apuesta nunca puede pasar del saldo real (y los botes se calculan con ella)
    ['Rio', 'Mar', 'Cas'].forEach((k, i) => {
      const n = S.botes[i + 1] - (h.tier === i + 1 ? 1 : 0);
      $('#n' + k).textContent = n === 1 ? '1 vez' : n + ' veces';
      const value = $('#bote' + k + ' .v');
      // el bote que se ve es la parte que cobrarías con la apuesta actual: bote × apuesta / 50
      if (value) value.textContent = fmt(potShare(S.jackpots[i + 1]));
    });

    const lock = running || busy || !ready;
    $('#bPlay').innerHTML = `jugar<b>${S.mult}</b><small>${unit(S.mult)}</small>`;
    $('#bPlay').disabled = lock || S.credits < S.mult;
    $('#bPlay').classList.toggle('spinning', running || busy);
    $('#bAuto').textContent = S.auto ? '■ PARAR AUTOMÁTICO' : '▶ AUTOMÁTICO';
    $('#bAuto').classList.toggle('on', S.auto);
    $('#bAuto').disabled = busy || !ready;
    $('#bStopAll').disabled = !(S.auto || S.bulk.left > 0);
    $('#hint').textContent = needLogin ? 'entra con tu cuenta para jugar'
      : !ready ? 'cargando tu saldo…'
      : S.credits < 1 && S.bulk.left === 0 ? 'no te quedan créditos'
      : `cada partida cuesta ${S.mult} ${unit(S.mult)}`;

    // selector de apuesta (1 a 50)
    const mm = maxMult();
    $('#multN').textContent = S.mult;
    $('#multU').textContent = unit(S.mult);
    $('#mRange').max = Math.max(2, mm);
    $('#mRange').value = S.mult;
    $('#mMinus').disabled = S.mult <= 1;
    $('#mPlus').disabled = S.mult >= mm;
    document.querySelectorAll('.mchip').forEach((c) => { c.classList.toggle('sel', +c.dataset.n === S.mult); c.disabled = +c.dataset.n > S.credits; });

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

    // las partidas compradas no pueden pasar del saldo (partidas × apuesta ≤ saldo)
    const ms = maxSel();
    if (S.sel > ms && S.bulk.left === 0) S.sel = ms;
    const cost = S.sel * S.mult;
    $('#range').max = Math.max(2, ms);
    $('#selN').textContent = S.sel;
    $('#range').value = S.sel;
    document.querySelectorAll('#chips .chip').forEach((c) => { c.classList.toggle('sel', +c.dataset.n === S.sel); c.disabled = +c.dataset.n * S.mult > S.credits; });
    $('#bBuy').textContent = S.mult > 1
      ? `COMPRAR ${S.sel} × ${S.mult} · ${fmt(cost)} créditos`
      : `COMPRAR ${S.sel} · ${S.sel} ${unit(S.sel)}`;
    $('#bBuy').disabled = busy || !ready || S.bulk.left > 0 || S.credits < cost;
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
  // «Perdido» forma parte del HTML inicial para que siempre esté visible, incluso antes de iniciar JavaScript.

  // No se pueden «cargar» créditos gratis: el bloque de carga se sustituye por el selector de apuesta (1 a 50), con su botón de PARAR
  const loadBlock = $('#bLoad') && $('#bLoad').closest('.bulk');
  const betBlock = document.createElement('div');
  betBlock.className = 'bulk';
  betBlock.innerHTML = `
    <h3><span>Apuesta por partida <small style="letter-spacing:0;text-transform:none">· 1 a ${MAX_MULT}</small></span><button class="btn red" id="bStopAll" title="Parar el automático y las partidas compradas">■ PARAR</button></h3>
    <div class="stepper">
      <button class="rnd" id="mMinus">−</button>
      <div class="num"><span id="multN">1</span> <small id="multU">crédito</small></div>
      <button class="rnd" id="mPlus">+</button>
    </div>
    <input type="range" id="mRange" min="1" max="${MAX_MULT}" value="1">
    <div class="chips" id="mchips"></div>`;
  if (loadBlock) loadBlock.replaceWith(betBlock);
  else $('#bBuy').closest('.bulk').before(betBlock);

  const foot = $('.foot');
  if (foot) foot.innerHTML = 'Juegas con tus créditos del juego: cada partida se descuenta de tu saldo y los premios se suman a él. No se puede jugar más de lo que tienes.<br>Si sales de esta pantalla, el modo automático o la compra siguen jugando en el juego principal.';
  const stopBtn = $('#bStop'); if (stopBtn) stopBtn.textContent = 'TERMINAR YA y ver el resultado';

  [1, 5, 10, 25, 50].forEach((n) => {
    const b = document.createElement('button');
    b.className = 'chip mchip'; b.dataset.n = n; b.textContent = n;
    b.onclick = () => { S.mult = Math.min(n, maxMult()); save(); render(); };
    $('#mchips').appendChild(b);
  });
  $('#mMinus').onclick = () => { S.mult = Math.max(1, S.mult - 1); save(); render(); };
  $('#mPlus').onclick = () => { S.mult = Math.min(maxMult(), S.mult + 1); save(); render(); };
  $('#mRange').oninput = (e) => { S.mult = Math.min(Math.max(1, +e.target.value), maxMult()); render(); };
  $('#mRange').onchange = save;

  // Las partidas compradas ya están cobradas en el servidor, así que no se devuelven: «terminar» las juega todas de golpe
  const finishBulk = () => {
    if (S.bulk.left <= 0) return;
    const rest = S.bulk.queue.splice(0);
    rest.forEach((r) => { S.bulk.left--; S.bulk.done++; apply(r, true, null); if (r.bonusId) needBonus = true; });
    const info = endBulk(); save(); render(); sfx.done();
    modal(`<h2>✅ Compra terminada</h2><p>Se han jugado las <b>${fmt(info.total)}</b> partidas.</p><div class="big">+${fmt(info.won)}</div><p>créditos ganados en esta compra</p><button class="btn gold" data-close>Aceptar</button>`)
      .then(() => { if (needBonus) pendingBonus(); });
  };
  $('#bStop').onclick = finishBulk;
  // PARAR (junto a la apuesta): detiene el modo automático y termina la compra en curso
  $('#bStopAll').onclick = () => {
    if (!(S.auto || S.bulk.left > 0)) return;
    S.auto = false; save();
    if (S.bulk.left > 0) finishBulk();
    render();
  };

  $('#bPlay').onclick = async () => {
    if (running || busy || !ready || S.credits < S.mult) return;
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
    b.onclick = () => { S.sel = Math.min(n, maxSel()); save(); render(); };
    $('#chips').appendChild(b);
  });
  $('#bMinus').onclick = () => { S.sel = Math.max(1, S.sel - 1); render(); };
  $('#bPlus').onclick = () => { S.sel = Math.min(100, maxSel(), S.sel + 1); render(); };
  $('#range').oninput = (e) => { S.sel = Math.min(+e.target.value, maxSel()); render(); };
  $('#range').onchange = save;

  $('#bBuy').onclick = async () => {
    const n = S.sel, m = S.mult;
    if (S.bulk.left > 0 || busy || !ready || S.credits < n * m) return;
    A(); sfx.buy();
    busy = true; render();
    try {
      const j = await playServer(n, m);              // el servidor cobra n×m y paga todos los premios de golpe
      takeJackpots(j.jackpots);
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

  $('#bSound').onclick = () => { S.sound = !S.sound; if (!S.sound) music.stop(); save(); render(); if (S.sound) sfx.buy(); };
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
      + '<p>Cada partida cuesta lo que apuestes: de <b>1 a 50 créditos</b> de tu saldo. Gana quien consigue símbolos iguales seguidos desde la izquierda en la <b>línea central</b>, y el premio se <b>multiplica por tu apuesta</b>.</p>'
      + '<p style="font-size:13px">Los premios de la tabla son con apuesta 1. Los botes que ves son la parte que cobrarías con tu apuesta actual: con apuesta 50 cobras el bote entero.</p>'
      + '<p>🧰 <b>Tres cofres</b> seguidos abren la <b>partida del tesoro</b>: 15 cartas tapadas y 3 con bomba. Las demás suman premio (× tu apuesta). Si sale una bomba <b>pierdes lo acumulado</b>; puedes <b>cobrar</b> cuando quieras. Sale de media 1 de cada 500 partidas.</p>'
      + '<div class="pt">';
    let last = -1;
    rows.forEach(([s, c, p]) => {
      const g = p >= 100 ? 2 : p >= 15 ? 1 : 0;
      if (g !== last) { h += sec(['Premios pequeños', 'Premios medios', 'Botes · figuras raras'][g]); last = g; }
      h += `<span class="c">${Array.from({ length: c }, () => `<svg viewBox="0 0 100 100"><use href="#s${s}"/></svg>`).join('')}</span>`
        + `<span>${c} ${E.NAMES[s]}</span><b>${fmt(p)}</b>`;
    });
    h += '</div><p style="font-size:13px">Suelen salir varios premios de 1 a 10 créditos cada 20 partidas y, de media, un bote de 100 a 1000 cada 500 partidas, siempre al azar.</p>'
      + '<p style="font-size:13px">Con <b>AUTOMÁTICO</b> o <b>COMPRAR</b> (1 a 100 partidas) el juego sigue aunque salgas de esta pantalla; al volver verás un resumen. Con <b>PARAR</b> lo detienes cuando quieras. Solo puedes jugar los créditos que tienes.</p>'
      + '<button class="btn gold" data-close>Entendido</button>';
    modal(h);
  };

  // pasar a otra pestaña/pantalla: la partida sigue (cascada/bg.js en el juego principal); al volver se pone al día
  const heartbeat = () => { try { localStorage.setItem(LK, JSON.stringify({ id: 'game', t: Date.now() })); } catch (e) { /* ignorar */ } };
  const mergeBg = () => {   // resumen de lo jugado por bg.js mientras estabas en el juego principal
    try {
      const b = JSON.parse(localStorage.getItem(AWK));
      localStorage.removeItem(AWK);
      if (!b || typeof b !== 'object') return;
      AW.plays += b.plays || 0; AW.won += b.won || 0; AW.wins += b.wins || 0; AW.best = Math.max(AW.best, b.best || 0);
      AW.botes = AW.botes.concat(b.botes || []); AW.bulks = AW.bulks.concat(b.bulks || []);
      AW.noCredits = AW.noCredits || !!b.noCredits; AW.bonus += b.bonus || 0;
      if (b.bonus) needBonus = true;
    } catch (e) { /* sin resumen */ }
  };
  const leave = () => { save(); try { localStorage.removeItem(LK); } catch (e) { /* ignorar */ } };

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { save(); return; }
    heartbeat(); mergeBg();
    await catchUp(BG_MS);
    if (!running && !busy && S.bulk.left === 0) await sync();   // el saldo puede haber cambiado en el resto del juego
    render();
    if (running) return;
    if (hasAway()) await showAway();
    if (needBonus) await pendingBonus();
    loop();
  });
  window.addEventListener('pagehide', leave);
  window.addEventListener('beforeunload', leave);
  heartbeat(); setInterval(heartbeat, 2000);
  // Los tres botes son globales: actualizar su importe también mientras el jugador está quieto.
  setInterval(async () => {
    if (!ready || running || busy || document.hidden) return;
    try {
      const j = await api('/api/cascada');
      takeJackpots(j.jackpots);
      render();
    } catch (e) { /* se reintentará en la siguiente actualización */ }
  }, 5000);

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
    mergeBg();
    // si se cerró a mitad de una compra: el servidor ya cobró y pagó todo, así que lo que quedaba se da por jugado
    if (S.bulk.queue.length > 0) {
      const rest = S.bulk.queue.splice(0);
      AW.bulks.push({ total: S.bulk.total, won: S.bulk.won + sumPrize(rest) });
      AW.plays += rest.length; AW.won += sumPrize(rest);
      rest.forEach((r) => { if (r.bonusId) { AW.bonus++; needBonus = true; } });
      S.bulk = { left: 0, total: 0, done: 0, won: 0, queue: [] };
    } else if (S.bulk.left > 0) { S.bulk = { left: 0, total: 0, done: 0, won: 0, queue: [] }; }
    save();
    await catchUp(BG_MS);
    render();
    if (hasAway()) await showAway();
    await pendingBonus();   // partidas del tesoro que quedaron a medias o salieron en segundo plano
    loop();
  })();
})();
