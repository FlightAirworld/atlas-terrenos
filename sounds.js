'use strict';
// Música y efectos de sonido generados con Web Audio (sin archivos externos).
// Modos: 2 = música + efectos, 1 = solo efectos, 0 = silencio. Se recuerda en el dispositivo.
(function () {
  const KEY = 'soundMode';
  let mode = 1;   // por defecto solo efectos (sin música); sin botón 🔊 en la página no se puede cambiar
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
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
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

  window.sfx = play;
})();
