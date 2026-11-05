'use strict';
// Música y efectos de sonido generados con Web Audio (sin archivos externos).
// Modos: 2 = música + efectos, 1 = solo efectos, 0 = silencio. Se recuerda en el dispositivo.
(function () {
  const KEY = 'soundMode';
  let mode = 2;   // por defecto música + efectos (la música empieza con el primer toque); el botón 🔊 los cambia
  try { const s = localStorage.getItem(KEY); if (s !== null) mode = Math.min(2, Math.max(0, Number(s) || 0)); } catch (e) {}

  let ctx = null, master, sfxBus, musicBus, delay, started = false, timer = null, nextTime = 0, step = 0;
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

  function introPlaying() { const el = document.getElementById('intro'); return !!el && !el.classList.contains('hidden'); }

  function scheduler() {
    if (!ctx || mode < 2) return;
    if (ctx.state === 'suspended') return;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.6) {
      if (!introPlaying() && !document.hidden) playStep(step, nextTime);   // no suena sobre el vídeo ni en segundo plano
      nextTime += EIGHTH; step++;
    }
  }
  function startMusic() { if (!timer) { nextTime = 0; timer = setInterval(scheduler, 200); } }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

  function applyMode() {
    if (!ctx) return;
    if (mode >= 2) startMusic(); else stopMusic();
  }

  function play(name) {
    if (mode < 1) return;
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

  // ---------- Botón 🔊 / 🔔 / 🔇 ----------
  const ICONS = ['🔇', '🔔', '🔊'], TITLES = ['Sonido apagado', 'Solo efectos', 'Música y efectos'];
  function refreshBtn() {
    const b = document.getElementById('sound-btn'); if (!b) return;
    b.textContent = ICONS[mode]; b.title = TITLES[mode]; b.setAttribute('aria-label', TITLES[mode]);
  }
  function setMode(m) {
    mode = m;
    try { localStorage.setItem(KEY, String(mode)); } catch (e) {}
    refreshBtn();
    if (mode >= 1) ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    applyMode();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('sound-btn');
    if (b) b.addEventListener('click', e => { e.stopPropagation(); setMode((mode + 2) % 3); play('open'); });   // 2 -> 1 -> 0 -> 2
    refreshBtn();
  });

  // Clic suave en cualquier botón (el de sonido y los que tienen su propio sonido se excluyen)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.id === 'sound-btn' || b.dataset.nosound) return;
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
    const rg = ctx.createGain(); rg.gain.value = 0.9; src.connect(lp); lp.connect(rg); rg.connect(g);                 // tráfico lejano
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    const mg = ctx.createGain(); mg.gain.value = 0.35; src.connect(bp); bp.connect(mg); mg.connect(g);               // murmullo de gente
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.23; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(mg.gain);
    src.start(); lfo.start();
    amb = { g };
  }
  function farBus() { if (!far) { far = ctx.createBiquadFilter(); far.type = 'lowpass'; far.frequency.value = 1500; far.connect(sfxBus); } return far; }
  window.cityAudio = {
    level(v) {
      if (!ctx) return;
      if (mode < 1 || ctx.state !== 'running') { if (amb) amb.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); return; }
      ambStart(); amb.g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.16, ctx.currentTime, 0.8);
    },
    horn(vol, close) {
      if (!ctx || mode < 1 || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.02, bus = close ? sfxBus : farBus(), d = 0.2 + Math.random() * 0.2;
      tone(bus, 'square', 415, t, d, 0.2 * vol); tone(bus, 'square', 523, t, d, 0.16 * vol);
      if (Math.random() < 0.5) { tone(bus, 'square', 415, t + d + 0.12, d, 0.2 * vol); tone(bus, 'square', 523, t + d + 0.12, d, 0.16 * vol); }
    },
    bells(n, vol) {
      if (!ctx || mode < 1 || ctx.state !== 'running') return;
      for (let i = 0; i < Math.min(12, n); i++) {
        const t = ctx.currentTime + 0.1 + i * 1.7;
        [[196, 1], [392, 0.5], [588, 0.3], [1180, 0.12]].forEach(([f, a]) => tone(farBus(), 'sine', f, t, 2.6, 0.5 * a * (vol || 1), { attack: 0.005 }));
      }
    }
  };

  window.sfx = play;
  window.soundMode = () => mode;   // 0 = silencio, 1 = solo efectos, 2 = música y efectos (lo usa vehicles.js para aviones y sirenas)
})();
