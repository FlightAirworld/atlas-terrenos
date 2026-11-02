'use strict';
// Clima sobre el mapa: nubes que pasan al azar, lluvia, relámpagos y truenos (sonido sintetizado, sin archivos).
(function () {
  const KEY = 'weatherOn';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('weather-btn');
  let on = true;
  try { const s = localStorage.getItem(KEY); if (s !== null) on = s === '1'; } catch (e) {}

  // ---------- Canvas ----------
  const cv = document.createElement('canvas');
  cv.id = 'weather-canvas';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  // ---------- Nubes ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clouds = [];
  function makeCloud(fromEdge) {
    const w = rnd(220, 520), dir = Math.random() < 0.8 ? 1 : -1;
    const puffs = [];
    const n = 7 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) puffs.push({ x: rnd(-0.5, 0.5) * w, y: rnd(-0.18, 0.18) * w, r: rnd(0.16, 0.3) * w });
    return {
      x: fromEdge ? (dir > 0 ? -w : W + w) : rnd(-w * 0.5, W + w * 0.5),
      y: rnd(-40, H * 0.75), w, puffs,
      vx: dir * rnd(8, 26),               // px/s
      dark: rnd(0.45, 0.85),              // 0 = blanca, 1 = oscura
      alpha: rnd(0.28, 0.5)
    };
  }
  const nClouds = () => Math.max(5, Math.round(W / 140));
  for (let i = 0; i < nClouds(); i++) clouds.push(makeCloud(false));

  function drawCloud(c, k) {
    const g = Math.round(255 - c.dark * k * 175);          // gris de la nube
    for (const p of c.puffs) {
      const px = c.x + p.x, py = c.y + p.y;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.r);
      grad.addColorStop(0, `rgba(${g},${g},${g + 8},${c.alpha * k})`);
      grad.addColorStop(1, `rgba(${g},${g},${g + 8},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(px, py, p.r, 0, 6.2832); ctx.fill();
    }
  }

  // ---------- Lluvia ----------
  const drops = [];
  const nDrops = () => Math.min(420, Math.round(W * H / 3500));
  function makeDrop(top) {
    return { x: rnd(-50, W + 50), y: top ? rnd(-H * 0.2, -10) : rnd(0, H), len: rnd(10, 22), v: rnd(650, 950), a: rnd(0.25, 0.55) };
  }
  for (let i = 0; i < nDrops(); i++) drops.push(makeDrop(false));

  // ---------- Relámpagos ----------
  let flash = 0;          // brillo actual del flash (0..1)
  let bolt = null;        // {pts, life}
  let nextStrike = rnd(2, 5);
  // Tormenta intermitente: periodos de calma y de tormenta, con transición suave
  let storm = false, intensity = 0, phaseT = rnd(15, 40);   // phaseT = segundos hasta el próximo cambio
  const pendingThunder = [];

  function makeBolt() {
    const x0 = rnd(W * 0.1, W * 0.9);
    const pts = [[x0, 0]];
    let x = x0, y = 0;
    const end = rnd(H * 0.35, H * 0.7);
    while (y < end) { y += rnd(18, 40); x += rnd(-28, 28); pts.push([x, y]); }
    return { pts, life: 1 };
  }
  function strike() {
    bolt = makeBolt();
    flash = reduce ? 0.12 : 0.75;
    // Distancia al azar: cuanto más lejos, más tarde y más suave suena el trueno
    const dist = Math.random();
    pendingThunder.push({ t: 0.15 + dist * 2.6, vol: 1 - dist * 0.65, dist });
    if (Math.random() < 0.35) setTimeout(() => { if (on) { flash = Math.max(flash, reduce ? 0.1 : 0.5); } }, 140);
  }

  // ---------- Audio (truenos sintetizados) ----------
  let ac = null, master = null, rainGain = null, rainSrc = null, muted = false;
  function noiseBuffer(seconds) {
    const b = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // ruido marrón
    return b;
  }
  function initAudio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ac.destination);
    // Sonido de lluvia suave y continuo
    const nb = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    rainSrc = ac.createBufferSource(); rainSrc.buffer = nb; rainSrc.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    rainGain = ac.createGain(); rainGain.gain.value = 0;
    rainSrc.connect(hp); hp.connect(lp); lp.connect(rainGain); rainGain.connect(master);
    rainSrc.start();
  }
  function thunder(vol, dist) {
    if (!ac || muted || !on) return;
    const now = ac.currentTime, dur = 2.6 + dist * 2.4;
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(Math.ceil(dur) + 1);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900 - dist * 450, now);
    lp.frequency.exponentialRampToValueAtTime(70, now + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol * 1.4, now + 0.04 + dist * 0.25);   // golpe
    g.gain.exponentialRampToValueAtTime(vol * 0.5, now + 0.5 + dist * 0.4);
    // retumbos
    for (let i = 1; i <= 3; i++) g.gain.linearRampToValueAtTime(vol * rnd(0.25, 0.6) / i, now + 0.5 + i * rnd(0.3, 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(now); src.stop(now + dur + 0.1);
  }
  // El navegador solo permite audio tras un gesto del usuario
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, function once() {
    if (on) initAudio();
    if (ac) ['pointerdown', 'keydown', 'touchstart'].forEach(e => removeEventListener(e, once));
  }, { passive: true }));

  // ---------- Bucle ----------
  let last = performance.now(), running = false;
  function frame(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.05); last = t;
    ctx.clearRect(0, 0, W, H);

    // alterna calma y tormenta
    phaseT -= dt;
    if (phaseT <= 0) { storm = !storm; phaseT = storm ? rnd(45, 100) : rnd(70, 180); }
    const goal = storm ? 1 : 0;
    intensity += Math.sign(goal - intensity) * Math.min(Math.abs(goal - intensity), dt / 6);   // ~6 s de transición
    const k = 0.3 + 0.7 * intensity;           // las nubes nunca desaparecen del todo
    if (ac && rainGain) rainGain.gain.setTargetAtTime(0.07 * intensity, ac.currentTime, 0.4);

    // tono de tormenta
    if (intensity > 0.01) { ctx.fillStyle = `rgba(20,30,50,${0.16 * intensity})`; ctx.fillRect(0, 0, W, H); }

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]; c.x += c.vx * dt;
      if ((c.vx > 0 && c.x - c.w > W) || (c.vx < 0 && c.x + c.w < 0)) clouds[i] = makeCloud(true);
      else drawCloud(c, k);
    }
    if (clouds.length < nClouds() && Math.random() < dt * 0.3) clouds.push(makeCloud(true));

    // lluvia (ligeramente inclinada)
    ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    const slant = 0.18;
    const nRain = Math.floor(drops.length * intensity);
    for (let i = 0; i < nRain; i++) {
      const d = drops[i];
      d.y += d.v * dt; d.x += d.v * slant * dt;
      if (d.y > H) { drops[i] = makeDrop(true); continue; }
      ctx.strokeStyle = `rgba(190,210,235,${d.a})`;
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * slant, d.y - d.len); ctx.stroke();
    }
    while (drops.length < nDrops()) drops.push(makeDrop(false));

    // relámpago
    if (intensity > 0.7) nextStrike -= dt;
    if (nextStrike <= 0) { strike(); nextStrike = rnd(6, 16); }
    if (flash > 0.01) { ctx.fillStyle = `rgba(235,240,255,${flash})`; ctx.fillRect(0, 0, W, H); flash *= Math.pow(0.002, dt); }
    if (bolt) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, bolt.life * 1.4)})`;
      ctx.shadowColor = 'rgba(180,200,255,1)'; ctx.shadowBlur = 18; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath(); bolt.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.shadowBlur = 0;
      bolt.life -= dt * 4; if (bolt.life <= 0) bolt = null;
    }
    // truenos pendientes (llegan después del relámpago)
    for (let i = pendingThunder.length - 1; i >= 0; i--) {
      const p = pendingThunder[i]; p.t -= dt;
      if (p.t <= 0) { thunder(p.vol, p.dist); pendingThunder.splice(i, 1); }
    }
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true; cv.style.display = 'block'; last = performance.now();
    if (ac) { if (ac.state === 'suspended') ac.resume(); }
    requestAnimationFrame(frame);
  }
  function stop() {
    running = false; cv.style.display = 'none'; ctx.clearRect(0, 0, W, H);
    pendingThunder.length = 0; flash = 0; bolt = null;
    if (ac && rainGain) rainGain.gain.setTargetAtTime(0, ac.currentTime, 0.1);
  }
  function apply() {
    if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.style.opacity = on ? '1' : '.55'; btn.title = on ? 'Tormentas: activadas' : 'Tormentas: desactivadas'; }
    on ? start() : stop();
  }
  if (btn) btn.onclick = function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (on) { initAudio(); storm = true; phaseT = rnd(45, 90); nextStrike = rnd(2, 5); }
    apply();
  };
  // Ahorra batería con la pestaña oculta
  document.addEventListener('visibilitychange', () => { if (document.hidden) { running = false; } else if (on) { running = false; start(); } });
  apply();
})();
