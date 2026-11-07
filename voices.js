'use strict';
// Voces y sonidos de los bichos: hace que hablen (y suenen) las burbujas de texto del juego.
//  - Marcianos y humanos: síntesis de voz del navegador (speechSynthesis), cada uno con su tono y velocidad. Los marcianos sueltan un «pío» raro antes de hablar.
//  - Vichos (babosas, escarabajos, medusas): sonidos sintetizados (blup, bzzz, ñic ñic, miau, piii…).
//  - Platillos: zumbido al bajar, al subir y al pasar de largo (con paneo de izquierda a derecha), y un golpe al aterrizar.
//  - León de la Tierra: rugido.
// Todo se genera con Web Audio (sin archivos). Lo usan aliens.js, ciudad.js y animals.js a través de window.atlasVoice.
// Para silenciarlo: atlasVoice.mute(true) (se recuerda en el navegador). Para probar: atlasVoice.speak('Hola terrícola', atlasVoice.profile('alien'), { force: true }).
(function () {
  const ss = window.speechSynthesis, hasTTS = !!ss && !!window.SpeechSynthesisUtterance;
  const KEY = 'voicesOff';
  let off = false;
  try { off = localStorage.getItem(KEY) === '1'; } catch (e) {}

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Voz (síntesis del navegador) ----------
  let voices = [];
  function loadVoices() { try { voices = (ss.getVoices() || []).filter(v => /^es/i.test(v.lang)); } catch (e) { voices = []; } }
  if (hasTTS) { loadVoices(); try { ss.addEventListener('voiceschanged', loadVoices); } catch (e) { ss.onvoiceschanged = loadVoices; } }
  // Las voces «de red» (p. ej. Google) en Chrome ignoran el tono: si hay locales, se prefieren para que cada uno suene distinto
  function pickVoice(p) {
    if (!voices.length) return null;
    const local = voices.filter(v => v.localService), pool = local.length ? local : voices;
    return pool[Math.floor(p.vi * pool.length) % pool.length];
  }
  // Cada personaje tiene su voz para siempre: tono, velocidad y qué voz del sistema usa
  function profile(kind) {
    if (kind === 'human') return { k: 'human', pitch: rnd(0.7, 1.45), rate: rnd(0.95, 1.12), vi: Math.random(), chirp: 0 };
    const deep = Math.random() < 0.25;   // algún marciano de voz grave, de ultratumba
    return { k: 'alien', pitch: deep ? rnd(0.3, 0.6) : rnd(1.5, 2), rate: rnd(0.8, 1.18), vi: Math.random(), chirp: rnd(520, 1500) };
  }
  // Los emojis no se leen bien: los más típicos se dicen con palabras y el resto se quita
  const EMO = { '🎵': 'la la la la', '☕': 'mmm, un cafecito', '🐶': '¡guau guau!', '🌧️': '¡uf, cómo llueve!', '☔': '¡uf, cómo llueve!', '🌙': 'buenas noches', '😴': 'zzz, qué sueño',
    '📱': 'bip bip, un mensaje', '😄': 'ja ja ja', '✨': '' };
  function clean(t) {
    t = String(t);
    Object.keys(EMO).forEach(k => { t = t.split(k).join(' ' + EMO[k] + ' '); });
    return t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}️‍]/gu, ' ')
      .replace(/−/g, 'menos ').replace(/\s?°\s?C/g, ' grados').replace(/km\/h/g, 'kilómetros por hora').replace(/\.{3}/g, '…').replace(/\s+/g, ' ').trim();
  }
  let gen = 0, pend = 0;   // gen sube con cada stop(); pend cuenta frases esperando su turno
  function speak(text, p, o) {
    o = o || {}; p = p || profile('human');
    if (off || !hasTTS || document.hidden) return false;
    const t = clean(text); if (!t || !/[\p{L}\p{N}]/u.test(t)) return false;
    const busy = ss.speaking || ss.pending || pend > 0;
    if (busy && !o.force) return false;   // una sola voz a la vez: los pensamientos sueltos se saltan si alguien ya está hablando
    if (o.force) gen++;   // una frase forzada (conversación) pasa por delante de las que esperaban
    const my = gen;   // si alguien llama a stop() mientras esperamos (cambio de mundo, silencio…), esta frase ya no se dice
    if (busy) { try { ss.cancel(); } catch (e) {} }
    let wait = busy ? 90 : 0;
    if (p.k === 'alien' && p.chirp) { sfx('chirp', { vol: (o.vol || 1) * 0.8, f: p.chirp }); wait = Math.max(wait, 230); }
    pend++;
    setTimeout(() => {
      pend--;
      if (off || my !== gen) return;
      try {
        const u = new SpeechSynthesisUtterance(t), v = pickVoice(p);
        u.lang = v ? v.lang : 'es-ES'; if (v) u.voice = v;
        u.pitch = clamp(p.pitch, 0.1, 2); u.rate = clamp(p.rate, 0.5, 1.6); u.volume = clamp(o.vol == null ? 1 : o.vol, 0.05, 1);
        if (ss.paused) ss.resume();
        ss.speak(u);
      } catch (e) {}
    }, wait);
    return true;
  }
  function stop() { gen++; try { if (hasTTS) ss.cancel(); } catch (e) {} }

  // ---------- Sonidos (Web Audio) ----------
  let ctx = null, bus = null, nbuf = null;
  function ac() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    bus = ctx.createGain(); bus.gain.value = 0.6; bus.connect(ctx.destination);
    return ctx;
  }
  function out(o) {   // salida con paneo opcional (pan fijo, o barrido de panFrom a panTo durante dur segundos)
    if (!ctx.createStereoPanner || (o.pan == null && o.panFrom == null)) return bus;
    const p = ctx.createStereoPanner(), t = ctx.currentTime;
    if (o.panFrom != null) { p.pan.setValueAtTime(o.panFrom, t); p.pan.linearRampToValueAtTime(o.panTo, t + (o.dur || 3)); } else p.pan.value = clamp(o.pan, -1, 1);
    p.connect(bus); return p;
  }
  // Un tono con deslizamiento (f0→f1), vibrato opcional, filtro opcional y envolvente (hold: se mantiene y se apaga al final)
  function tone(dest, type, f0, f1, t, dur, vol, x) {
    x = x || {};
    const o = ctx.createOscillator(), g = ctx.createGain(), a = x.a || 0.01;
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
    if (x.hold) { g.gain.setValueAtTime(vol, t + dur - x.hold); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); } else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = g;
    if (x.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = x.lp; g.connect(f); last = f; }
    o.connect(g); last.connect(dest);
    if (x.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = x.vib[0]; lg.gain.value = x.vib[1]; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dest, t, dur, vol, fc) {
    if (!nbuf) { nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nbuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = fc;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.05);
  }
  const SFX = {
    // marciano: «pío» raro con vibrato antes de hablar
    chirp: (d, t, v, o) => { const f = o.f || 900; tone(d, 'sine', f, f * 1.5, t, 0.08, 0.3 * v, { vib: [30, 40] }); tone(d, 'sine', f * 1.35, f * 0.8, t + 0.09, 0.08, 0.3 * v, { vib: [30, 40] }); tone(d, 'triangle', f * 1.7, f * 1.1, t + 0.18, 0.07, 0.25 * v); },
    // vichos
    blup: (d, t, v) => { tone(d, 'sine', 300, 900, t, 0.14, 0.55 * v); tone(d, 'sine', 500, 1200, t + 0.12, 0.12, 0.4 * v); },
    bzzz: (d, t, v) => tone(d, 'sawtooth', 170, 150, t, 0.7, 0.2 * v, { vib: [45, 18], lp: 1200, hold: 0.2 }),
    nic: (d, t, v) => { tone(d, 'square', 1400, 1900, t, 0.07, 0.12 * v); tone(d, 'square', 1500, 2000, t + 0.13, 0.07, 0.12 * v); },
    miau: (d, t, v) => { tone(d, 'triangle', 500, 850, t, 0.2, 0.45 * v, { vib: [6, 10] }); tone(d, 'triangle', 850, 420, t + 0.2, 0.4, 0.45 * v, { vib: [6, 10] }); },
    piii: (d, t, v) => tone(d, 'sine', 2000, 2300, t, 0.55, 0.28 * v, { hold: 0.2 }),
    glub: (d, t, v) => { tone(d, 'sine', 220, 120, t, 0.13, 0.65 * v); tone(d, 'sine', 260, 140, t + 0.17, 0.13, 0.55 * v); },
    hip: (d, t, v) => tone(d, 'sine', 380, 760, t, 0.09, 0.55 * v),
    splosh: (d, t, v) => { noise(d, t, 0.35, 0.5 * v, 900); tone(d, 'sine', 400, 150, t, 0.25, 0.4 * v); },
    // platillos
    ufoIn: (d, t, v) => { tone(d, 'sine', 950, 300, t, 3.6, 0.14 * v, { vib: [7, 60], a: 0.4, hold: 1 }); tone(d, 'triangle', 1500, 500, t, 3.6, 0.04 * v, { a: 0.4, hold: 1 }); },
    ufoOut: (d, t, v) => { tone(d, 'sine', 300, 1100, t, 3.2, 0.14 * v, { vib: [7, 60], a: 0.3, hold: 1 }); tone(d, 'triangle', 500, 1700, t, 3.2, 0.04 * v, { a: 0.3, hold: 1 }); },
    ufoFly: (d, t, v, o) => { const du = o.dur || 9; tone(d, 'sine', 520, 720, t, du, 0.12 * v, { vib: [5, 45], a: du * 0.25, hold: du * 0.4 }); tone(d, 'triangle', 1040, 1440, t, du, 0.035 * v, { a: du * 0.25, hold: du * 0.4 }); },
    thud: (d, t, v) => { tone(d, 'sine', 130, 40, t, 0.3, 0.7 * v); noise(d, t, 0.25, 0.25 * v, 300); },
    // león
    roar: (d, t, v) => { noise(d, t, 0.9, 0.45 * v, 450); tone(d, 'sawtooth', 120, 55, t, 0.9, 0.35 * v, { vib: [28, 25], lp: 700 }); }
  };
  function sfx(name, o) {
    o = o || {};
    if (off || document.hidden || !SFX[name] || !ac()) return;
    try { if (ctx.state === 'suspended') ctx.resume(); SFX[name](out(o), ctx.currentTime + 0.01, clamp(o.vol == null ? 1 : o.vol, 0.05, 1.5), o); } catch (e) {}
  }
  // Qué suena según lo que «dice» el bichito
  function critter(text, vol) {
    const t = String(text).toLowerCase().replace(/[^a-zñáéíóú]/g, '');
    const n = /blup/.test(t) ? 'blup' : /bz/.test(t) ? 'bzzz' : /ñic|nic/.test(t) ? 'nic' : /miau/.test(t) ? 'miau' : /pi{2,}/.test(t) ? 'piii' : /glub/.test(t) ? 'glub' : /hip/.test(t) ? 'hip' : /splosh/.test(t) ? 'splosh' : 'blup';
    sfx(n, { vol });
  }

  window.atlasVoice = {
    profile, speak, stop, sfx, critter,
    roar: vol => sfx('roar', { vol }),
    mute(v) { off = !!v; try { localStorage.setItem(KEY, off ? '1' : '0'); } catch (e) {} if (off) stop(); },
    get muted() { return off; }
  };
})();
