'use strict';
// Celebración al reclamar un terreno: la cámara se acerca a la casa nueva, estalla confeti, sale un cartel y vibra el móvil.
// app.js la llama así:  window.celebrateClaim({ lat, lng, first })   (el sonido «claim» ya lo pone app.js)
(function () {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#ffb703', '#fb8500', '#e63946', '#2a9d8f', '#8ecae6', '#9b5de5', '#ffffff', '#80ed99'];

  const st = document.createElement('style');
  st.textContent = `
    #cel-canvas { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 2050; pointer-events: none; }
    #cel-pill { position: fixed; z-index: 2060; left: 50%; top: 0; pointer-events: none; padding: 10px 18px; border-radius: 999px;
      background: #fffffff2; color: #14452f; font: 800 18px/1.2 system-ui, sans-serif; box-shadow: 0 6px 22px #0004; white-space: nowrap;
      transform: translate(-50%, -50%) scale(.3); opacity: 0; }
    #cel-pill.go { animation: celpop 2.4s cubic-bezier(.2,1.4,.4,1) forwards; }
    @keyframes celpop { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.3); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1.12); }
      25% { transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; transform: translate(-50%, -80%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -110%) scale(1); } }`;
  document.head.appendChild(st);

  let canvas = null, raf = 0, parts = [];
  const rnd = (a, b) => a + Math.random() * (b - a);

  function burst(x, y, n, power) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(2, power);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - rnd(2, 6), g: rnd(.12, .22), s: rnd(5, 10), r: rnd(0, 6.28), vr: rnd(-.3, .3),
        c: COLORS[Math.floor(Math.random() * COLORS.length)], life: rnd(70, 130), age: 0, round: Math.random() < .3 });
    }
  }
  function rain(n) {
    for (let i = 0; i < n; i++) parts.push({ x: rnd(0, innerWidth), y: rnd(-innerHeight * .4, -10), vx: rnd(-1, 1), vy: rnd(2, 5), g: .05, s: rnd(5, 9),
      r: rnd(0, 6.28), vr: rnd(-.2, .2), c: COLORS[Math.floor(Math.random() * COLORS.length)], life: rnd(110, 190), age: 0, round: Math.random() < .3 });
  }
  function loop() {
    const ctx = canvas.getContext('2d'), dpr = canvas.width / innerWidth;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age++; p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (p.age > p.life || p.y > innerHeight + 20) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, (p.life - p.age) / 30);
      ctx.fillStyle = p.c;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.2, 0, 6.28); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(loop);
    else { canvas.remove(); canvas = null; raf = 0; }
  }
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas'); canvas.id = 'cel-canvas';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    document.body.appendChild(canvas);
  }

  function pill(text, x, y) {
    let el = document.getElementById('cel-pill');
    if (!el) { el = document.createElement('div'); el.id = 'cel-pill'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.classList.remove('go'); void el.offsetWidth;          // reinicia la animación si se reclama otra vez enseguida
    el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px'; el.classList.add('go');
  }

  function screenPoint(lat, lng) {
    try { const p = map.latLngToContainerPoint({ lat, lng }); return { x: p.x, y: p.y }; } catch (e) { return { x: innerWidth / 2, y: innerHeight * .3 }; }
  }

  window.celebrateClaim = function (o) {
    if (!o || typeof map === 'undefined' || !map) return;
    const first = !!o.first;
    // 1) La cámara se acerca a la casa nueva (desplazada hacia arriba para que el panel de abajo no la tape)
    try {
      const panel = document.getElementById('panel'), ph = panel && !panel.classList.contains('hidden') ? panel.getBoundingClientRect().height : 0;
      const gl = map.gl, z = Math.max(gl.getZoom(), 17.2);
      gl.easeTo({ center: [o.lng, o.lat], zoom: z, duration: reduce ? 0 : 1300, offset: [0, -Math.min(ph, innerHeight * .6) / 2], essential: true });
    } catch (e) {}
    // 2) Confeti + cartel cuando la casa ya está casi en su sitio
    setTimeout(() => {
      const pt = screenPoint(o.lat, o.lng), y = Math.max(110, pt.y - 40);
      pill(first ? '🏡 ¡Tu primer terreno!' : '🎉 ¡Es tuyo!', Math.min(Math.max(pt.x, 120), innerWidth - 120), y);
      if (reduce) return;
      ensureCanvas();
      burst(pt.x, pt.y, first ? 130 : 70, first ? 11 : 9);
      rain(first ? 90 : 35);
      if (!raf) raf = requestAnimationFrame(loop);
      if (first) setTimeout(() => { if (canvas) { const q = screenPoint(o.lat, o.lng); burst(q.x, q.y, 70, 10); } }, 500);
    }, reduce ? 0 : 900);
    // 3) Un golpecito de vibración en el móvil
    try { if (navigator.vibrate && !reduce) navigator.vibrate([25, 40, 60]); } catch (e) {}
  };
})();
