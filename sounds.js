'use strict';
// Ajustes de sonido por categorías (botón 🔊 Sonidos del Menú). Se guardan en el navegador. Todo activado por defecto.
// window.soundOn('coches') -> true/false · window.soundPrefs.set('coches', false) · window.soundPrefs.onChange(fn(cat, valor))
(function () {
  const KEY = 'soundPrefs';
  const CATS = [
    ['musica', '🎵', 'Música'],
    ['efectos', '🔔', 'Efectos y botones'],
    ['gente', '🧑‍🤝‍🧑', 'Gente y voces'],
    ['coches', '🚗', 'Coches, bocinas y sirenas'],
    ['trenes', '🚆', 'Trenes'],
    ['aviones', '✈️', 'Aviones y helicópteros'],
    ['animales', '🐕', 'Animales'],
    ['mar', '🌊', 'Mar: olas, barcos y ferry'],
    ['marcianos', '👽', 'Marcianos y platillos'],
    ['lluvia', '⛈️', 'Lluvia y truenos'],
    ['campanas', '⛪', 'Campanas']
  ];
  let st = {};
  try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { st = {}; }
  const subs = [];
  const prefs = {
    cats: CATS,
    get: c => st[c] !== false,
    set(c, v) {
      st[c] = !!v;
      try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
      subs.forEach(f => { try { f(c, !!v); } catch (e) {} });
    },
    onChange: f => { subs.push(f); }
  };
  window.soundPrefs = prefs;
  window.soundOn = c => prefs.get(c);
})();
// Música y efectos de sonido generados con Web Audio (sin archivos externos).
// Ya no hay botón de sonido: siempre efectos y música. La música suena en la portada y mientras baja el paracaidista, y se corta al aterrizar (window.stopMusic()).
(function () {
  const mode = 2;   // efectos siempre activos; la música la corta window.stopMusic() cuando aterriza el paracaidista

  let musicStopped = false, ctx = null, master, sfxBus, musicBus, delay, started = false, timer = null, nextTime = 0, step = 0;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.35; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    // pequeño eco para dar ambiente a la música
    delay = ctx.createDelay(1); delay.delayTime.value = 0.375;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const wet = ctx.createGain(); wet.gain.value = 0.4;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musicBus);
    return ctx;
  }

  function tone(bus, type, freq, t, dur, vol, opts) {
    opts = opts || {};
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    const a = opts.attack || 0.01;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    if (opts.echo) g.connect(delay);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- Efectos ----------
  const SFX = {
    click:  t => tone(sfxBus, 'sine', 700, t, 0.07, 0.5, { slideTo: 1000 }),
    open:   t => { tone(sfxBus, 'sine', 520, t, 0.1, 0.5); tone(sfxBus, 'sine', 780, t + 0.07, 0.14, 0.5); },
    select: t => { tone(sfxBus, 'triangle', 660, t, 0.09, 0.6); tone(sfxBus, 'triangle', 990, t + 0.06, 0.12, 0.6); },
    claim:  t => { [60, 64, 67, 72, 76].forEach((n, i) => tone(sfxBus, 'triangle', hz(n + 12), t + i * 0.09, 0.4, 0.55)); tone(sfxBus, 'sine', hz(91), t + 0.5, 0.7, 0.35); },
    coin:   t => { tone(sfxBus, 'square', hz(83), t, 0.08, 0.25); tone(sfxBus, 'square', hz(88), t + 0.08, 0.35, 0.25); },
    gift:   t => { [72, 76, 79, 84, 88, 91].forEach((n, i) => tone(sfxBus, 'sine', hz(n), t + i * 0.11, 0.5, 0.5)); },
    pop:    t => tone(sfxBus, 'sine', 350, t, 0.16, 0.5, { slideTo: 900 }),
    bells:  t => { [91, 95, 100, 95, 91, 100, 103, 100, 95, 103, 107, 103].forEach((n, i) => tone(sfxBus, 'triangle', hz(n), t + i * 0.085, 0.3, 0.32)); },
    hohoho: t => { [0, 0.42, 0.84].forEach(d => { tone(sfxBus, 'sawtooth', 150, t + d, 0.32, 0.3, { slideTo: 105 }); tone(sfxBus, 'triangle', 300, t + d, 0.32, 0.22, { slideTo: 210 }); }); },
    // Aterrizaje del paracaidista: golpe sordo y un grito ("aaah" con vibrato) hecho con una onda diente de sierra filtrada por formantes
    grito:  t => {
      tone(sfxBus, 'sine', 110, t, 0.3, 1.2, { slideTo: 40 });
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(380, t + 0.05); o.frequency.linearRampToValueAtTime(820, t + 0.4);
      o.frequency.linearRampToValueAtTime(650, t + 0.85); o.frequency.exponentialRampToValueAtTime(330, t + 1.5);
      lfo.frequency.value = 7; lg.gain.value = 22; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.linearRampToValueAtTime(2.4, t + 0.12);
      g.gain.setValueAtTime(2.4, t + 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      [[800, 1], [1250, 0.6], [2600, 0.25]].forEach(([f, a]) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 5;
        const ga = ctx.createGain(); ga.gain.value = a; o.connect(bp); bp.connect(ga); ga.connect(g);
      });
      g.connect(sfxBus); o.start(t + 0.05); lfo.start(t + 0.05); o.stop(t + 1.7); lfo.stop(t + 1.7);
    },
    // Visitas a casas (visita.js): puerta, charla (murmullo de voces con sílabas), vasos, risas y sillas
    puerta: t => { tone(sfxBus, 'sine', 140, t, 0.12, 0.8, { slideTo: 70 }); tone(sfxBus, 'square', 90, t + 0.02, 0.06, 0.3); tone(sfxBus, 'sine', hz(88), t + 0.35, 0.5, 0.25); tone(sfxBus, 'sine', hz(93), t + 0.45, 0.6, 0.2); },   // golpe de la puerta + timbre
    charla: t => { const base = 150 + Math.random() * 120, n = 4 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) { const f = base * (0.8 + Math.random() * 0.7), d = 0.08 + Math.random() * 0.08, at = t + i * 0.13; tone(sfxBus, 'sawtooth', f, at, d, 0.16, { slideTo: f * (0.85 + Math.random() * 0.4) }); tone(sfxBus, 'triangle', f * 2.4, at, d, 0.07); } },
    vasos:  t => { [0, 0.09, 0.2].forEach((d, i) => { tone(sfxBus, 'sine', hz(96 + i * 3), t + d, 0.35, 0.3); tone(sfxBus, 'sine', hz(103 + i * 2), t + d, 0.25, 0.15); }); },
    risa:   t => { const b = 260 + Math.random() * 80; for (let i = 0; i < 5; i++) tone(sfxBus, 'sawtooth', b - i * 12, t + i * 0.12, 0.09, 0.2, { slideTo: b * 0.75 - i * 10 }); },
    silla:  t => { tone(sfxBus, 'triangle', 220, t, 0.12, 0.35, { slideTo: 120 }); tone(sfxBus, 'sine', 80, t + 0.1, 0.1, 0.4); },
    // ----- Timbre y sonidos de las escenas de edificios y parcelas (edificios.js, visita.js, terrenos-visita.js) -----
    timbre:   t => { tone(sfxBus, 'sine', hz(88), t, 1.0, 0.55); tone(sfxBus, 'triangle', hz(100), t, 0.55, 0.16); tone(sfxBus, 'sine', hz(84), t + 0.55, 1.3, 0.55); tone(sfxBus, 'triangle', hz(96), t + 0.55, 0.7, 0.16); },   // ding-dong
    campanilla: t => { tone(sfxBus, 'sine', hz(96), t, 0.9, 0.5); tone(sfxBus, 'sine', hz(108), t, 0.5, 0.2); },   // campanilla del mostrador del hotel
    ascensor: t => { tone(sfxBus, 'sine', hz(91), t, 0.5, 0.45); tone(sfxBus, 'sine', hz(86), t + 0.32, 0.7, 0.45); },
    silbato:  t => { const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(2600, t); lfo.frequency.value = 38; lg.gain.value = 230; lfo.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.03); g.gain.setValueAtTime(0.5, t + 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62); o.connect(g); g.connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + 0.7); lfo.stop(t + 0.7); },
    balon:    t => { tone(sfxBus, 'sine', 170, t, 0.16, 1.0, { slideTo: 55 }); tone(sfxBus, 'triangle', 340, t, 0.05, 0.3); },
    gol:      t => { [72, 76, 79, 84, 88].forEach((n, i) => tone(sfxBus, 'triangle', hz(n), t + i * 0.1, 0.55, 0.45)); for (let i = 0; i < 10; i++) tone(sfxBus, 'sawtooth', 220 + Math.random() * 260, t + 0.4 + i * 0.05, 0.4, 0.05, { slideTo: 300 + Math.random() * 200 }); },   // fanfarria + gritería de la grada
    cavar:    t => { const src = ctx.createBufferSource(); src.buffer = noiseBuf(1); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); src.connect(lp); lp.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.35); tone(sfxBus, 'sine', 120, t, 0.12, 0.6, { slideTo: 60 }); },
    burbujas: t => { for (let i = 0; i < 5; i++) { const f = 420 + Math.random() * 500; tone(sfxBus, 'sine', f, t + i * 0.13 + Math.random() * 0.05, 0.12, 0.3, { slideTo: f * 1.8 }); } },
    chapoteo: t => { const src = ctx.createBufferSource(); src.buffer = noiseBuf(1); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.8, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); src.connect(bp); bp.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 0.8); },
    adios:  t => { [79, 76, 72].forEach((n, i) => tone(sfxBus, 'triangle', hz(n), t + i * 0.16, 0.4, 0.4)); },
    // Cuenta atrás del cohete
    beep:   t => tone(sfxBus, 'sine', 880, t, 0.14, 0.5),
    ufo: t => { tone(sfxBus, 'sine', 640, t, 0.55, 0.3, { slideTo: 330 }); tone(sfxBus, 'sine', 330, t + 0.5, 0.55, 0.3, { slideTo: 700 }); tone(sfxBus, 'triangle', 1280, t, 1.05, 0.06); },
    beepgo: t => tone(sfxBus, 'sine', 1320, t, 0.5, 0.55),
    // Despegue: rugido de ruido que se abre y retumbo grave
    cohete: t => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(3); src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(250, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 4.5); lp.frequency.exponentialRampToValueAtTime(700, t + 7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(2.2, t + 1.0); g.gain.setValueAtTime(2.2, t + 4.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 7);
      src.connect(lp); lp.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 7.1);
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(36, t); o.frequency.linearRampToValueAtTime(72, t + 5);
      og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.5, t + 1.0); og.gain.exponentialRampToValueAtTime(0.0001, t + 7);
      o.connect(og); og.connect(sfxBus); o.start(t); o.stop(t + 7.1);
    },
    // Cohete que llega o se va (más corto y suave)
    retro: t => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(3); src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1400, t + 1.2); lp.frequency.linearRampToValueAtTime(400, t + 2.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1.3, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      src.connect(lp); lp.connect(g); g.connect(sfxBus); src.start(t); src.stop(t + 2.7);
    },
    // Grito del astronauta: más agudo y largo, filtrado como una radio, con pitidos de fin de transmisión
    grito2: t => {
      tone(sfxBus, 'sine', 90, t, 0.25, 0.9, { slideTo: 45 });
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      const hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 450; lp.type = 'lowpass'; lp.frequency.value = 3400;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t + 0.05); o.frequency.linearRampToValueAtTime(1150, t + 0.5);
      o.frequency.linearRampToValueAtTime(900, t + 1.0); o.frequency.exponentialRampToValueAtTime(420, t + 1.9);
      lfo.frequency.value = 5.5; lg.gain.value = 35; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t + 0.05); g.gain.linearRampToValueAtTime(2.2, t + 0.12);
      g.gain.setValueAtTime(2.2, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
      [[420, 1], [2300, 0.7], [3100, 0.3]].forEach(([f, a]) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 5;
        const ga = ctx.createGain(); ga.gain.value = a; o.connect(bp); bp.connect(ga); ga.connect(g);
      });
      g.connect(hp); hp.connect(lp); lp.connect(sfxBus);
      o.start(t + 0.05); lfo.start(t + 0.05); o.stop(t + 2.1); lfo.stop(t + 2.1);
      tone(sfxBus, 'sine', 1500, t + 2.1, 0.07, 0.5); tone(sfxBus, 'sine', 1100, t + 2.22, 0.09, 0.5);
    },
    error:  t => { tone(sfxBus, 'sawtooth', 220, t, 0.25, 0.3, { slideTo: 110 }); }
  };

  // ---------- Música ----------
  // Progresión suave en Do mayor: C - Am - F - G (cada acorde = 8 corcheas)
  const CHORDS = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
  const SCALE = [72, 74, 76, 79, 81, 84];      // pentatónica de Do
  const EIGHTH = 60 / 76 / 2;                  // ~76 bpm

  function playStep(i, t) {
    const pos = i % 8, chord = CHORDS[Math.floor(i / 8) % CHORDS.length];
    if (pos === 0) chord.forEach(n => tone(musicBus, 'sine', hz(n), t, EIGHTH * 8, 0.5, { attack: 0.4 }));
    if (pos % 2 === 0) tone(musicBus, 'triangle', hz(chord[0] + 12 * (pos === 4 ? 0 : 1)), t, EIGHTH * 1.8, 0.35);
    if (Math.random() < 0.55) {
      const n = SCALE[Math.floor(Math.random() * SCALE.length)];
      tone(musicBus, 'sine', hz(n), t, EIGHTH * 3, 0.4, { echo: true, attack: 0.02 });
    }
  }

  function introPlaying() { if (window.coverOpen) return false; const el = document.getElementById('intro'); return !!el && !el.classList.contains('hidden'); }   // en la portada sí suena la música

  function scheduler() {
    if (!ctx || mode < 2 || musicStopped) return;
    if (ctx.state === 'suspended') return;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.6) {
      if (!window.fightMuted && !introPlaying() && !document.hidden && window.soundOn('musica')) playStep(step, nextTime);   // no suena sobre el vídeo ni en segundo plano
      nextTime += EIGHTH; step++;
    }
  }
  function startMusic() { if (!timer && !musicStopped) { nextTime = 0; timer = setInterval(scheduler, 200); } }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

  function applyMode() {
    if (!ctx) return;
    if (mode >= 2) startMusic(); else stopMusic();
  }

  // Fuera de la Tierra (window.earthMuted) solo suenan los del viaje (cuenta atrás, cohete, platillos, gritos) y los de la interfaz (clics, seleccionar y comprar)
  const TRAVEL_SFX = { beep: 1, beepgo: 1, cohete: 1, retro: 1, grito: 1, grito2: 1, ufo: 1, select: 1, claim: 1, coin: 1, error: 1, open: 1, click: 1, pop: 1 };   // + los del panel de compra (comprar un terreno en otro planeta)
  const SFX_CAT = { ufo: 'marcianos', charla: 'gente', risa: 'gente' };   // el resto de efectos cuentan como «Efectos y botones»
  const HOUSE_SFX = { click: 1, open: 1, puerta: 1, silla: 1, vasos: 1, charla: 1, risa: 1, adios: 1, coin: 1, gift: 1, pop: 1, select: 1, timbre: 1, campanilla: 1, ascensor: 1, silbato: 1, balon: 1, gol: 1, cavar: 1, burbujas: 1, chapoteo: 1 };   // los únicos que suenan dentro de una casa (visita.js)
  function play(name) {
    if ((window.fightMuted && !(window.houseInside && HOUSE_SFX[name])) || mode < 1 || (window.earthMuted && !TRAVEL_SFX[name]) || !window.soundOn(SFX_CAT[name] || 'efectos')) return;
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const f = SFX[name]; if (f) f(ctx.currentTime + 0.01);
  }

  // El navegador solo deja sonar tras un gesto del usuario
  function unlock() {
    if (started) return;
    if (!ensure()) return;
    ctx.resume().then(() => { started = true; applyMode(); }).catch(() => {});
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
  unlock();   // intenta arrancar ya en la portada (si el navegador lo permite); si no, arranca con el primer toque

  // Clic suave en cualquier botón (el de sonido y los que tienen su propio sonido se excluyen)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.dataset.nosound) return;
    play(b.classList.contains('close') ? 'click' : 'open');
  }, true);

  // ---------- Ambiente de ciudad (lo maneja ciudad.js según el zoom) ----------
  // Murmullo y tráfico lejano (ruido filtrado), bocinazos lejanos y campanas. Todo sintetizado; respeta el botón 🔊 (apagado = silencio).
  let amb = null, far = null;
  function noiseBuf(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  }
  function ambStart() {
    if (amb || !ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(3); src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const rg = ctx.createGain(); rg.gain.value = 0.9; const trG = ctx.createGain(); trG.connect(g); src.connect(lp); lp.connect(rg); rg.connect(trG);   // tráfico lejano (categoría «coches»)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    const mg = ctx.createGain(); mg.gain.value = 0.35; const crG = ctx.createGain(); crG.connect(g); src.connect(bp); bp.connect(mg); mg.connect(crG);   // murmullo de gente (categoría «gente»)
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.23; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(mg.gain);
    src.start(); lfo.start();
    amb = { g, trG, crG };
    ambPrefs();
  }
  function ambPrefs() {
    if (!amb || !ctx) return;
    amb.trG.gain.setTargetAtTime(window.soundOn('coches') ? 1 : 0, ctx.currentTime, 0.2);
    amb.crG.gain.setTargetAtTime(window.soundOn('gente') ? 1 : 0, ctx.currentTime, 0.2);
  }
  window.soundPrefs.onChange(ambPrefs);
  function farBus() { if (!far) { far = ctx.createBiquadFilter(); far.type = 'lowpass'; far.frequency.value = 1500; far.connect(sfxBus); } return far; }
  window.cityAudio = {
    level(v) {
      if (!ctx) return;
      if (window.fightMuted || window.earthMuted || mode < 1 || ctx.state !== 'running') { if (amb) amb.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); return; }
      ambStart(); amb.g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.16, ctx.currentTime, 0.8);
    },
    horn(vol, close) {
      if (!ctx || window.fightMuted || window.earthMuted || mode < 1 || ctx.state !== 'running' || !window.soundOn('coches')) return;
      const t = ctx.currentTime + 0.02, bus = close ? sfxBus : farBus(), d = 0.2 + Math.random() * 0.2;
      tone(bus, 'square', 415, t, d, 0.2 * vol); tone(bus, 'square', 523, t, d, 0.16 * vol);
      if (Math.random() < 0.5) { tone(bus, 'square', 415, t + d + 0.12, d, 0.2 * vol); tone(bus, 'square', 523, t + d + 0.12, d, 0.16 * vol); }
    },
    bells(n, vol) {
      if (!ctx || window.fightMuted || window.earthMuted || mode < 1 || ctx.state !== 'running' || !window.soundOn('campanas')) return;
      for (let i = 0; i < Math.min(12, n); i++) {
        const t = ctx.currentTime + 0.1 + i * 1.7;
        [[196, 1], [392, 0.5], [588, 0.3], [1180, 0.12]].forEach(([f, a]) => tone(farBus(), 'sine', f, t, 2.6, 0.5 * a * (vol || 1), { attack: 0.005 }));
      }
    }
  };

  // Corta la música con un fundido (los efectos siguen igual). Lo llama el paracaidista al tocar tierra.
  window.stopMusic = function () {
    musicStopped = true;
    if (ctx && musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25); }
    setTimeout(stopMusic, 1500);
  };
  // Motor del cohete: ruido grave continuo (no se corta solo). Suena desde el despegue hasta que el astronauta aterriza (window.rocketEngine.stop()).
  // level(v) lo baja o sube (p. ej. durante el paracaídas, para que se oiga el grito). Si nadie lo para, se apaga solo a los 2 minutos.
  let eng = null, engKill = 0;
  window.rocketEngine = {
    start() {
      if (mode < 1 || !window.soundOn('efectos') || !ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      clearTimeout(engKill); engKill = setTimeout(() => window.rocketEngine.stop(), 120000);
      if (eng) { eng.g.gain.cancelScheduledValues(ctx.currentTime); eng.g.gain.setTargetAtTime(2.0, ctx.currentTime, 0.2); return; }
      const t = ctx.currentTime + 0.01;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf(3); src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(250, t); lp.frequency.exponentialRampToValueAtTime(1500, t + 3.5);   // el rugido se abre al despegar y se queda ahí
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency);   // pequeña oscilación para que no suene plano
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(2.0, t + 1.0);
      src.connect(lp); lp.connect(g); g.connect(sfxBus);
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(36, t); o.frequency.linearRampToValueAtTime(66, t + 4);
      og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.45, t + 1.0);
      o.connect(og); og.connect(g);
      src.start(t); o.start(t); lfo.start(t);
      eng = { g, nodes: [src, o, lfo] };
    },
    level(v) { if (eng && ctx) { eng.g.gain.cancelScheduledValues(ctx.currentTime); eng.g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.3); } },
    stop() {
      clearTimeout(engKill);
      if (!eng || !ctx) return;
      const e = eng; eng = null;
      e.g.gain.cancelScheduledValues(ctx.currentTime); e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.35);   // fundido de salida
      setTimeout(() => e.nodes.forEach(n => { try { n.stop(); } catch (x) {} }), 2000);
    }
  };
  window.sfx = play;
  // Campeonato de luchas (fight.js): mientras está abierto solo suena el combate (que usa su propio audio), no la ciudad
  window.fightMute = function (v) {
    v = !!v; window.fightMuted = v;
    try {
      if (ctx && musicBus) { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(v || musicStopped ? 0 : 0.22, ctx.currentTime, 0.2); }
      if (v && window.cityAudio) window.cityAudio.level(0);
      if (window.weatherMute) window.weatherMute(v || !!window.earthMuted);
      if (v && window.atlasVoice) window.atlasVoice.stop();
    } catch (e) {}
  };
  // Visita a una casa (visita.js): fuera no se oye nada (ciudad, música, lluvia, coches, trenes, voces de peatones...); dentro solo suenan la puerta, las sillas, los vasos y la charla.
  window.houseMute = function (v) {
    v = !!v; window.houseInside = v;
    if (window.fightMute) window.fightMute(v);   // reutiliza el silencio del campeonato: corta ciudad, música, lluvia, coches, trenes y voces de fuera
  };
  window.soundMode = () => (window.earthMuted || window.fightMuted ? 0 : mode);   // siempre 2 (lo usan vehicles.js y trains.js para aviones, sirenas y trenes)
})();
