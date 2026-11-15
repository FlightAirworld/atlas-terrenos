'use strict';
// MÚSICA DE LA DISCOTECA Y DE LA SALA DE BAILE (la usan las escenas de discoteca.js al entrar en el local).
// Se genera con Web Audio (sin archivos): dos estilos con su batería, bajo, acordes y melodía.
//   · 'disco'  → house/dance a 124 pulsaciones (bombo en cada tiempo, palmas, charles, bajo en contratiempo, acordes y arpegio).
//   · 'baile'  → pop latino a 100 pulsaciones (clave, congas, güiro, bajo tumbao y piano montuno).
// API:  window.clubMusic.unlock()          → crear/despertar el audio dentro de un toque (el móvil lo exige)
//       window.clubMusic.start('disco')    → empieza a sonar; devuelve la función que la para
//       window.clubMusic.duck(true/false)  → baja el volumen mientras alguien habla
//       window.clubMusic.stop()
// Respeta el ajuste 🔊 «Música» del menú de sonidos (window.soundOn('musica')).
(function () {
  let ctx = null, master = null, comp = null, noiseBuf = null, timer = null, nextTime = 0, step = 0, style = null, ducked = false;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const VOL = 0.5, VOL_DUCK = 0.16;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value = 0; master.connect(comp);
      const len = ctx.sampleRate, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = b;
    } catch (e) { ctx = null; }
    return ctx;
  }
  function unlock() { try { if (ensure() && ctx.state === 'suspended') ctx.resume(); } catch (e) {} }

  // ----- Instrumentos -----
  function tone(type, f, t, dur, vol, o) {
    o = o || {};
    const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    let out = g;
    if (o.lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); fl.Q.value = o.q || 1; g.connect(fl); out = fl; }
    const a = o.a || 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); out.connect(master); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, o) {
    o = o || {};
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = o.type || 'highpass'; fl.frequency.value = o.f || 7000; fl.Q.value = o.q || 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.002)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const kick = (t, v) => { tone('sine', 150, t, 0.28, v || 0.95, { to: 42, glide: 0.12, a: 0.002 }); noise(t, 0.02, 0.18, { f: 3000 }); };
  const clap = t => { for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.09, 0.3, { type: 'bandpass', f: 1500, q: 0.8 }); noise(t + 0.03, 0.18, 0.2, { type: 'bandpass', f: 1300, q: 0.7 }); };
  const hat = (t, v, open) => noise(t, open ? 0.18 : 0.04, v, { f: open ? 6500 : 8500 });
  const bass = (t, m, dur, v) => { tone('sawtooth', hz(m), t, dur, v || 0.42, { lp: 520, lpTo: 140, q: 3, a: 0.004 }); tone('sine', hz(m), t, dur, 0.35, { a: 0.004 }); };
  const stab = (t, notes, dur, v) => notes.forEach(m => tone('sawtooth', hz(m), t, dur, v || 0.07, { lp: 2600, lpTo: 700, a: 0.006 }));
  const lead = (t, m, dur, v) => { tone('square', hz(m), t, dur, v || 0.07, { lp: 3200, lpTo: 1200, a: 0.004 }); };
  const conga = (t, hi, v) => tone('sine', hi ? 340 : 210, t, 0.16, v || 0.4, { to: hi ? 250 : 150, glide: 0.08, a: 0.002 });
  const clave = t => { tone('sine', 2500, t, 0.07, 0.38, { a: 0.001 }); tone('sine', 1900, t, 0.05, 0.2, { a: 0.001 }); };
  const guiro = (t, v) => noise(t, 0.05, v || 0.12, { type: 'bandpass', f: 5200, q: 2 });
  const piano = (t, m, dur, v) => { tone('triangle', hz(m), t, dur, v || 0.16, { a: 0.003 }); tone('sine', hz(m) * 2, t, dur * 0.5, (v || 0.16) * 0.35, { a: 0.003 }); };

  // ----- DISCO (house, 124 bpm): Am - F - C - G -----
  const D_ROOT = [33, 29, 36, 31];                   // La, Fa, Do, Sol (graves)
  const D_CH = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]];
  const D_ARP = [[69, 72, 76, 72], [69, 72, 77, 72], [67, 72, 76, 72], [67, 71, 74, 71]];
  function stepDisco(s, t, sd) {
    const bar = Math.floor(s / 16) % 4, i = s % 16, sec = Math.floor(s / 64) % 4;   // 4 compases de acordes; cada 64 pasos cambia la sección
    if (i % 4 === 0 && !(sec === 3 && Math.floor(s / 16) % 4 === 3 && i > 7)) kick(t);
    if (i === 4 || i === 12) clap(t);
    if (i % 2 === 0 && i % 4 !== 0) hat(t, 0.1, true);
    if (sec > 0 && i % 2 === 1) hat(t, 0.045, false);
    if (i % 4 === 2) bass(t, D_ROOT[bar] + (i === 10 ? 12 : 0), sd * 1.6, 0.4);
    if (sec > 0 && (i === 3 || i === 6 || i === 11)) stab(t, D_CH[bar], sd * 1.4);
    if (sec > 1) { const a = D_ARP[bar]; lead(t, a[(i >> 1) % 4] + (i % 2 ? 12 : 0), sd * 0.9, 0.05); }
    if (sec === 0 && i === 0 && bar === 0) stab(t, D_CH[0], sd * 12, 0.045);
  }
  // ----- BAILE (latino, 100 bpm): Am - Dm - E7 - Am -----
  const B_ROOT = [45, 50, 52, 45];
  const B_FIFTH = [52, 57, 59, 52];
  const B_CH = [[57, 60, 64], [57, 62, 65], [56, 59, 62, 64], [57, 60, 64]];
  const CLAVE = [0, 3, 6, 10, 12];
  function stepBaile(s, t, sd) {
    const bar = Math.floor(s / 16) % 4, i = s % 16, sec = Math.floor(s / 64) % 4;
    if (CLAVE.includes(i)) clave(t);
    if (i % 2 === 0) guiro(t, i % 4 === 0 ? 0.13 : 0.08);
    if (i === 2 || i === 10) conga(t, false, 0.42);
    if (i === 4 || i === 6 || i === 12 || i === 14) conga(t, true, 0.28);
    if (sec > 0 && i === 8) tone('sine', 120, t, 0.12, 0.35, { to: 70, a: 0.002 });   // bombo suave
    if (i === 0) bass(t, B_ROOT[bar], sd * 2.4, 0.4);
    if (i === 6 || i === 8) bass(t, i === 6 ? B_FIFTH[bar] : B_ROOT[bar] + 12, sd * 1.8, 0.36);
    if (i === 12) bass(t, B_FIFTH[bar], sd * 2, 0.36);
    if (sec > 0 && (i === 3 || i === 7 || i === 11 || i === 15)) B_CH[bar].forEach((m, k) => piano(t + k * 0.006, m + 12, sd * 1.4, 0.1));
    if (sec > 1 && i % 4 === 0) { const mel = [76, 74, 72, 74, 76, 79, 76, 72]; piano(t, mel[(Math.floor(s / 4)) % 8] , sd * 3, 0.13); }
  }
  const STYLES = { disco: { bpm: 124, fn: stepDisco }, baile: { bpm: 100, fn: stepBaile } };

  function scheduler() {
    if (!ctx || !style) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} return; }
    const S = STYLES[style], sd = 60 / S.bpm / 4;   // duración de una semicorchea
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    const on = !document.hidden && (!window.soundOn || window.soundOn('musica'));
    while (nextTime < ctx.currentTime + 0.25) { if (on) { try { S.fn(step, nextTime, sd); } catch (e) {} } nextTime += sd; step++; }
  }
  function setLevel() { if (ctx && master) master.gain.setTargetAtTime(style ? (ducked ? VOL_DUCK : VOL) : 0, ctx.currentTime, 0.15); }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    style = null;
    if (ctx && master) { try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.12); } catch (e) {} }
  }
  function start(st) {
    stop();
    if (!STYLES[st] || !ensure()) return stop;
    try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
    style = st; step = 0; nextTime = 0; ducked = false;
    setLevel(); timer = setInterval(scheduler, 50); scheduler();
    return stop;
  }
  window.clubMusic = { unlock, start, stop, duck(v) { ducked = !!v; setLevel(); }, playing: () => !!style };
})();
