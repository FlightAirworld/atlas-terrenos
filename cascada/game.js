/* Cascada · lógica del juego, sonidos y partidas en segundo plano */
(() => {
  'use strict';
  const E = CascadaEngine;
  const $ = (s) => document.querySelector(s);
  const KEY = 'cascada.v1';
  const MAX_LOAD = 100000; // máximo de créditos que se pueden cargar de una vez
  const BG_MS = 3000;     // ritmo de juego cuando la pantalla está cerrada/oculta
  const TIER = ['', 'rio', 'mar', 'cas'];
  const TIER_NAME = ['', 'Bote Río', 'Bote Mar', 'Bote Cascada'];
  const fmt = (n) => Number(n).toLocaleString('es-ES');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------------- estado persistente ---------------- */
  const def = () => ({
    credits: 0, loaded: 0, last: null, spins: 0, won: 0, best: 0, auto: false, sel: 10, load: 50,
    sound: true, notify: false,
    bulk: { left: 0, total: 0, done: 0, won: 0 },
    botes: [0, 0, 0, 0], tick: Date.now(),
  });
  const load = () => {
    try {
      const j = JSON.parse(localStorage.getItem(KEY));
      if (j && typeof j.credits === 'number' && isFinite(j.credits)) return Object.assign(def(), j);
    } catch (e) { /* sin datos */ }
    return def();
  };
  let S = load();
  const save = () => { S.tick = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sin espacio */ } };

  const newAW = () => ({ plays: 0, won: 0, wins: 0, best: 0, botes: [], bulks: [], noCredits: false });
  let AW = newAW();             // resumen de lo jugado mientras no mirabas
  let running = false;          // bucle automático / compra activo
  let busy = false;             // partida manual en curso
  let hold = null;              // premio que aún no se ha "revelado" en pantalla
  let cur = E.play().grid;      // rodillos visibles

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
  // aplica el resultado al estado (y al resumen "mientras no mirabas" si se pasa sum)
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
    if (inBulk) { S.bulk.left--; S.bulk.done++; } else S.credits--;
    const r = E.play();
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
    S.bulk = { left: 0, total: 0, done: 0, won: 0 };
    return info;
  };

  const catchUp = (minEl) => {
    const now = Date.now(), el = now - S.tick;
    if (el < minEl) return;
    if (!(S.auto || S.bulk.left > 0)) { S.tick = now; return; }
    const n = Math.min(Math.floor(el / BG_MS), 5000);
    for (let i = 0; i < n; i++) {
      let inBulk = false;
      if (S.bulk.left > 0) { S.bulk.left--; S.bulk.done++; inBulk = true; }
      else if (S.auto && S.credits >= 1) S.credits--;
      else { if (S.auto) { S.auto = false; AW.noCredits = true; } break; }
      const r = E.play();
      apply(r, inBulk, AW);
      if (r.tier) notify('¡' + TIER_NAME[r.tier] + '!', `Has ganado ${fmt(r.prize)} créditos`);
      if (inBulk && S.bulk.left === 0) {
        AW.bulks.push(endBulk());
        notify('Compra completada', 'Se han jugado todas las partidas compradas');
      }
    }
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
    if (running) return;
    running = true; render();
    try {
      while (S.bulk.left > 0 || S.auto) {
        if (document.hidden) { await sleep(BG_MS); catchUp(BG_MS); continue; }
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
          const r = await one('auto');
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
    $('#bPlay').disabled = lock || S.credits < 1;
    $('#bPlay').classList.toggle('spinning', lock);
    $('#bAuto').textContent = S.auto ? '■ PARAR AUTOMÁTICO' : '▶ AUTOMÁTICO';
    $('#bAuto').classList.toggle('on', S.auto);
    $('#bAuto').disabled = busy;
    $('#loadN').textContent = fmt(S.load);
    $('#loadRange').value = S.load;
    document.querySelectorAll('.lchip').forEach((c) => c.classList.toggle('sel', +c.dataset.n === S.load));
    $('#bLoad').textContent = `CARGAR ${fmt(S.load)} ${S.load === 1 ? 'crédito' : 'créditos'}`;
    $('#bLoad').disabled = busy;
    $('#hint').textContent = S.credits < 1 && S.bulk.left === 0
      ? 'carga los créditos que quieras jugar'
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
    $('#selN').textContent = S.sel;
    $('#range').value = S.sel;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('sel', +c.dataset.n === S.sel));
    $('#bBuy').textContent = `COMPRAR ${S.sel} · ${S.sel} ${S.sel === 1 ? 'crédito' : 'créditos'}`;
    $('#bBuy').disabled = busy || S.bulk.left > 0 || S.credits < S.sel;
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
    if (running || busy || S.credits < 1) return;
    busy = true; render();
    await one('manual');
    busy = false; render();
  };
  $('#bAuto').onclick = () => {
    A();
    if (S.auto) { S.auto = false; save(); render(); return; }
    if (S.credits < 1 && S.bulk.left === 0) {
      modal('<h2>Sin créditos</h2><p>Carga primero los créditos que quieras jugar.</p><button class="btn gold" data-close>Vale</button>');
      return;
    }
    S.auto = true; save(); loop();
  };
  // cargar créditos: el jugador decide cuántos quiere jugar
  [10, 50, 100, 500, 1000].forEach((n) => {
    const b = document.createElement('button');
    b.className = 'chip lchip'; b.dataset.n = n; b.textContent = fmt(n);
    b.onclick = () => { S.load = n; save(); render(); };
    $('#lchips').appendChild(b);
  });
  $('#lMinus').onclick = () => { S.load = Math.max(1, S.load - (S.load > 100 ? 10 : 1)); render(); };
  $('#lPlus').onclick = () => { S.load = Math.min(MAX_LOAD, S.load + (S.load >= 100 ? 10 : 1)); render(); };
  $('#loadRange').oninput = (e) => { S.load = +e.target.value; render(); };
  $('#loadRange').onchange = save;
  $('#bLoad').onclick = () => {
    if (busy) return;
    A(); sfx.buy();
    S.credits += S.load; S.loaded += S.load;
    save(); render();
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

  $('#bBuy').onclick = () => {
    const n = S.sel;
    if (S.bulk.left > 0 || busy || S.credits < n) return;
    A(); sfx.buy();
    S.credits -= n;
    S.bulk = { left: n, total: n, done: 0, won: 0 };
    save(); render(); loop();
  };
  $('#bStop').onclick = () => {
    if (S.bulk.left <= 0) return;
    S.credits += S.bulk.left;
    S.bulk.total = S.bulk.done; S.bulk.left = 0;
    save(); render();
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
      + '<p>Cada partida cuesta <b>1 crédito</b>. Gana quien consigue símbolos iguales seguidos desde la izquierda en la <b>línea central</b>.</p>'
      + '<div class="pt">';
    let last = -1;
    rows.forEach(([s, c, p]) => {
      const g = p >= 100 ? 2 : p >= 15 ? 1 : 0;
      if (g !== last) { h += sec(['Premios pequeños', 'Premios medios', 'Botes · figuras raras'][g]); last = g; }
      h += `<span class="c">${Array.from({ length: c }, () => `<svg viewBox="0 0 100 100"><use href="#s${s}"/></svg>`).join('')}</span>`
        + `<span>${c} ${E.NAMES[s]}</span><b>${fmt(p)}</b>`;
    });
    h += '</div><p style="font-size:13px">Suelen salir varios premios de 1 a 10 créditos cada 20 partidas y, de media, un bote de 100 a 1000 cada 500 partidas, siempre al azar.</p>'
      + '<p style="font-size:13px">Con <b>AUTOMÁTICO</b> o <b>COMPRAR</b> (1 a 100 partidas) el juego sigue aunque cierres la pantalla; al volver verás un resumen.</p>'
      + '<button class="btn gold" data-close>Entendido</button>';
    modal(h);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); return; }
    catchUp(BG_MS);
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

  catchUp(BG_MS);
  render();
  if (AW.plays > 0 || AW.noCredits || AW.bulks.length) showAway();
  loop();
})();
