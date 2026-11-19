/* Cascada · interfaz del juego, sonidos y partidas en segundo plano.
   Los créditos son los del jugador en todo el juego (su cuenta de Redecora El Mundo). El servidor sortea, cobra y paga
   cada partida (cascada-server.js: /api/cascada); aquí solo se dibuja el resultado. */
(() => {
  'use strict';
  const E = CascadaEngine;
  const $ = (s) => document.querySelector(s);
  const KEY = 'cascada.v2';   // solo preferencias (sonido, avisos, partidas a comprar); los créditos viven en el servidor
  const BG_MS = 3000;         // ritmo de juego cuando la pantalla está oculta
  const TIER = ['', 'rio', 'mar', 'cas'];
  const TIER_NAME = ['', 'Bote Río', 'Bote Mar', 'Bote Cascada'];
  const fmt = (n) => Number(n).toLocaleString('es-ES');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------------- estado ---------------- */
  const zeroBulk = () => ({ left: 0, total: 0, done: 0, won: 0 });
  const def = () => ({
    credits: 0, spins: 0, won: 0, best: 0, last: null, botes: [0, 0, 0, 0],   // vienen del servidor
    auto: false, sel: 10, sound: true, notify: false, bulk: zeroBulk(),        // solo en esta pantalla
  });
  const load = () => {
    const s = def();
    try {
      const j = JSON.parse(localStorage.getItem(KEY));
      if (j && typeof j === 'object') ['sound', 'notify', 'sel'].forEach((k) => { if (k in j) s[k] = j[k]; });
    } catch (e) { /* sin datos */ }
    s.sel = Math.min(100, Math.max(1, Math.floor(+s.sel) || 10));
    return s;
  };
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ sound: S.sound, notify: S.notify, sel: S.sel })); } catch (e) { /* sin espacio */ } };
  const sync = (j) => {
    S.credits = j.credits;
    const t = j.stats;
    S.spins = t.spins; S.won = t.won; S.best = t.best; S.botes = t.botes; S.last = t.last;
  };

  const newAW = () => ({ plays: 0, won: 0, wins: 0, best: 0, botes: [], bulks: [], noCredits: false, err: '' });
  let AW = newAW();             // resumen de lo jugado mientras no mirabas
  let running = false;          // bucle automático / compra activo
  let busy = false;             // partida manual en curso
  let ready = false;            // ya tenemos la cuenta y el saldo del servidor
  let hold = null;              // premio que aún no se ha "revelado" en pantalla
  let cur = E.play().grid;      // rodillos visibles

  /* ---------------- cuenta y servidor ---------------- */
  // Misma sesión que el mapa (Supabase Auth, mismo origen): si ya has entrado en el juego, aquí también estás dentro
  let sb = null;
  const loadSb = () => new Promise((res) => {
    if (window.supabase) return res(true);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4';
    s.onload = () => res(true); s.onerror = () => res(false);
    document.head.appendChild(s);
  });
  const token = async () => {
    if (!sb) {
      if (!(await loadSb())) return null;
      const cfg = await (await fetch('/api/config')).json().catch(() => null);
      if (!(cfg && cfg.auth && cfg.auth.enabled)) return null;
      sb = window.supabase.createClient(cfg.auth.url, cfg.auth.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    }
    const { data } = await sb.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  };
  const api = async (url, body) => {
    const t = await token();
    if (!t) { const e = new Error('Inicia sesión'); e.status = 401; throw e; }
    const post = body !== undefined;
    const r = await fetch(url, {
      method: post ? 'POST' : 'GET',
      headers: Object.assign({ 'X-Auth-Token': t }, post ? { 'Content-Type': 'application/json' } : {}),
      body: post ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Error ' + r.status); e.status = r.status; throw e; }
    return j;
  };

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

  const stopAll = () => { S.auto = false; S.bulk = zeroBulk(); };
  // Error del servidor: se paran el automático y la compra y se explica qué pasa
  const fail = async (e) => {
    stopAll(); save(); render();
    if (e.status === 401) {
      return modal('<h2>Entra en tu cuenta</h2><p>Cascada usa los créditos que tienes en el juego. Inicia sesión en el mapa y vuelve.</p>'
        + '<a class="btn gold" href="/" style="display:block;text-decoration:none;margin-top:12px;padding:13px;font-size:16px">Ir al juego</a>'
        + '<button class="btn" data-close>Cerrar</button>');
    }
    if (e.status === 402) {
      return modal('<h2>Sin créditos</h2><p>No te quedan créditos suficientes. Consigue más en el juego y vuelve.</p><button class="btn gold" data-close>Vale</button>');
    }
    if (e.status === 404) {
      return modal('<h2>Cascada no está disponible</h2><p>El servidor todavía no tiene activada la tragaperras. Inténtalo en unos minutos.</p><button class="btn gold" data-close>Vale</button>');
    }
    return modal(`<h2>Ups</h2><p>${esc(e.message || 'No se pudo jugar')}</p><button class="btn gold" data-close>Vale</button>`);
  };

  // una partida con animación. kind: manual | auto | bulk. Devuelve null si el servidor la rechaza
  const one = async (kind) => {
    const fast = kind !== 'manual';
    let j;
    try { j = await api('/api/cascada/play', { n: 1 }); } catch (e) { await fail(e); return null; }
    const r = j.results[0];
    const bestPrev = S.best;
    sync(j);
    if (kind === 'bulk') { S.bulk.left--; S.bulk.done++; S.bulk.won += r.prize; }
    hold = { prize: r.prize, tier: r.tier, bestPrev };
    render();
    sfx.spin();
    await spinAnim(r, fast);
    hold = null;
    render();
    celebrate(r);
    return r;
  };

  /* ---------------- juego con la pantalla oculta ---------------- */
  const endBulk = () => {
    const info = { total: S.bulk.total, won: S.bulk.won };
    S.bulk = zeroBulk();
    return info;
  };

  // Un paso sin animación (pantalla oculta): 1 partida de automático o hasta 5 de una compra
  const bgStep = async () => {
    const inBulk = S.bulk.left > 0;
    const k = inBulk ? Math.min(S.bulk.left, 5) : 1;
    if (!inBulk && S.credits < 1) { S.auto = false; AW.noCredits = true; return; }
    let j;
    try { j = await api('/api/cascada/play', { n: k }); } catch (e) {
      stopAll();
      if (e.status === 402) AW.noCredits = true; else AW.err = e.message || 'No se pudo jugar';
      return;
    }
    sync(j);
    j.results.forEach((r) => {
      if (inBulk) { S.bulk.left--; S.bulk.done++; S.bulk.won += r.prize; }
      AW.plays++; AW.won += r.prize;
      if (r.prize) AW.wins++;
      if (r.prize > AW.best) AW.best = r.prize;
      if (r.tier) { AW.botes.push({ tier: r.tier, prize: r.prize }); notify('¡' + TIER_NAME[r.tier] + '!', `Has ganado ${fmt(r.prize)} créditos`); }
    });
    if (inBulk && S.bulk.left === 0) {
      AW.bulks.push(endBulk());
      notify('Compra completada', 'Se han jugado todas las partidas compradas');
    }
  };

  const hasAway = () => AW.plays > 0 || AW.noCredits || AW.bulks.length || AW.err;
  const showAway = () => {
    const a = AW; AW = newAW();
    let h = `<h2>🌊 Mientras no mirabas</h2><p>Se han jugado <b>${fmt(a.plays)}</b> partidas.</p>`;
    h += `<div class="big">+${fmt(a.won)}</div><p>créditos ganados en ${fmt(a.wins)} premios · mejor premio ${fmt(a.best)}</p>`;
    a.botes.forEach((b) => { h += `<p>🏆 ¡Te tocó el <b>${TIER_NAME[b.tier]}</b>: +${fmt(b.prize)}!</p>`; });
    a.bulks.forEach((b) => { h += `<p>✅ Compra de ${fmt(b.total)} partidas completada: ganaste ${fmt(b.won)} créditos.</p>`; });
    if (a.noCredits) h += '<p>⚠️ Se paró porque te quedaste sin créditos.</p>';
    if (a.err) h += `<p>⚠️ Se paró: ${esc(a.err)}</p>`;
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
        if (document.hidden) { await bgStep(); await sleep(BG_MS); continue; }
        if (hasAway()) await showAway();
        if (!(S.bulk.left > 0 || S.auto)) break;
        if (S.bulk.left > 0) {
          const r = await one('bulk');
          if (!r) break;
          if (S.bulk.left === 0) {
            const info = endBulk(); render(); sfx.done();
            notify('Compra completada', `Se han jugado ${info.total} partidas`);
            await modal(`<h2>✅ Compra completada</h2><p>Se han jugado las <b>${fmt(info.total)}</b> partidas.</p>
              <div class="big">+${fmt(info.won)}</div><p>créditos ganados en esta compra</p>
              <button class="btn gold" data-close>Aceptar</button>`);
          } else if (r.tier) await sleep(2600);
        } else {
          if (S.credits < 1) {
            S.auto = false; render();
            await modal('<h2>Sin créditos</h2><p>El modo automático se ha parado.</p><button class="btn gold" data-close>Aceptar</button>');
            break;
          }
          const r = await one('auto');
          if (!r) break;
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
    const lock = running || busy;
    $('#bPlay').disabled = lock || !ready || S.credits < 1;
    $('#bPlay').classList.toggle('spinning', lock);
    $('#bAuto').textContent = S.auto ? '■ PARAR AUTOMÁTICO' : '▶ AUTOMÁTICO';
    $('#bAuto').classList.toggle('on', S.auto);
    $('#bAuto').disabled = busy || !ready;
    $('#hint').innerHTML = ready && S.credits < 1 && S.bulk.left === 0
      ? 'sin créditos · <a href="/" style="color:#ffd86b">consíguelos en el juego</a>'
      : ready ? 'cada partida cuesta 1 crédito · son tus créditos del juego' : 'conectando con tu cuenta…';
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
    $('#selN').textContent = S.sel;
    $('#range').value = S.sel;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', +c.dataset.n === S.sel));
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
  $('#bPlay').onclick = async () => {
    if (running || busy || !ready || S.credits < 1) return;
    busy = true; render();
    try { await one('manual'); } finally { busy = false; render(); }
  };
  $('#bAuto').onclick = () => {
    A();
    if (S.auto) { S.auto = false; render(); return; }
    if (!ready) return;
    if (S.credits < 1 && S.bulk.left === 0) {
      modal('<h2>Sin créditos</h2><p>Necesitas créditos del juego para jugar.</p><button class="btn gold" data-close>Vale</button>');
      return;
    }
    S.auto = true; render(); loop();
  };

  [1, 10, 25, 50, 100].forEach((n) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.dataset.n = n; b.textContent = n;
    b.onclick = () => { S.sel = n; save(); render(); };
    $('#chips').appendChild(b);
  });
  $('#bMinus').onclick = () => { S.sel = Math.max(1, S.sel - 1); render(); };
  $('#bPlus').onclick = () => { S.sel = Math.min(100, S.sel + 1); render(); };
  $('#range').oninput = (e) => { S.sel = +e.target.value; render(); };
  $('#range').onchange = save;

  // Comprar N partidas: se juegan una a una y solo se cobra cada partida jugada (nada se cobra por adelantado)
  $('#bBuy').onclick = () => {
    const n = S.sel;
    if (S.bulk.left > 0 || busy || !ready || S.credits < n) return;
    A(); sfx.buy();
    S.bulk = { left: n, total: n, done: 0, won: 0 };
    render(); loop();
  };
  $('#bStop').onclick = () => {
    if (S.bulk.left <= 0) return;
    S.bulk.total = S.bulk.done; S.bulk.left = 0;   // las que no se jugaron no se cobran
    render();
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
      + '<p>Cada partida cuesta <b>1 crédito</b> de los que tienes en el juego. Gana quien consigue símbolos iguales seguidos desde la izquierda en la <b>línea central</b>.</p>'
      + '<div class="pt">';
    let last = -1;
    rows.forEach(([s, c, p]) => {
      const g = p >= 100 ? 2 : p >= 15 ? 1 : 0;
      if (g !== last) { h += sec(['Premios pequeños', 'Premios medios', 'Botes · figuras raras'][g]); last = g; }
      h += `<span class="c">${Array.from({ length: c }, () => `<svg viewBox="0 0 100 100"><use href="#s${s}"/></svg>`).join('')}</span>`
        + `<span>${c} ${E.NAMES[s]}</span><b>${fmt(p)}</b>`;
    });
    h += '</div><p style="font-size:13px">Suelen salir unos 3 premios de 1 a 10 créditos cada 20 partidas y, de media, un bote de 100 a 1000 cada 700 partidas, siempre al azar. El resultado lo decide el servidor.</p>'
      + '<p style="font-size:13px">Con <b>AUTOMÁTICO</b> o <b>COMPRAR</b> (1 a 100 partidas) el juego sigue mientras la página esté abierta, aunque apagues la pantalla; al volver verás un resumen. Solo se cobra cada partida que se juega.</p>'
      + '<button class="btn gold" data-close>Entendido</button>';
    modal(h);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); return; }
    render();
    if (running) return;   // el bucle enseñará el resumen
    if (hasAway()) showAway();
    loop();
  });
  window.addEventListener('pagehide', save);

  /* ---------------- arranque ---------------- */
  // Los créditos ya no se «cargan»: son los del jugador. Se quita el bloque antiguo y se actualizan los textos
  const lb = $('#bLoad');
  if (lb && lb.closest('.bulk')) lb.closest('.bulk').remove();
  const bs = $('#bStop'); if (bs) bs.textContent = 'PARAR la compra (no se cobran las que quedan)';
  const ft = $('.foot');
  if (ft) ft.innerHTML = 'Cada partida cuesta 1 crédito de los que tienes en todo el juego, y lo que ganas se suma a tu saldo.<br>El modo automático y la compra siguen jugando mientras la página esté abierta, aunque apagues la pantalla.';

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
    try {
      const j = await api('/api/cascada');
      if (j.on === false) { await modal('<h2>Cascada descansa</h2><p>La tragaperras está desactivada ahora mismo.</p><button class="btn gold" data-close>Vale</button>'); return; }
      sync(j); ready = true;
    } catch (e) { await fail(e); }
    render();
  })();
})();
