/* Visitas animadas a parcelas naturales. Se añade al sistema existente sin tocar visita.js.
 *   · Parcela de CÉSPED: entras BAJO TIERRA. Cavas un pozo, bajas por la escalera con casco y linterna, abres un túnel entre raíces,
 *     lombrices y hormigas, encuentras un hueso de dinosaurio y un cofre con un diamante, y vuelves a salir al césped.
 *   · Parcela de AGUA: te pones la ESCAFANDRA de buceador (casco de latón, ventanilla y manguera de aire), te lanzas desde la barca,
 *     bajas entre peces, tortugas y algas, abres un cofre del tesoro en el fondo y subes a la superficie.
 * Usa globals de app.js / sounds.js si existen: sfx(), houseMute(). Cada escena es un guion automático (se cierra con × o Esc).
 */
(function () {
  const houseBtn = document.getElementById('enter-house-btn');
  if (!houseBtn || !houseBtn.parentNode) return;
  const btn = document.createElement('button');
  btn.id = 'enter-terrain-btn'; btn.type = 'button'; btn.className = 'primary hidden';
  btn.style.cssText = 'width:100%;padding:10px;margin:0 0 8px;font-weight:800';
  houseBtn.parentNode.insertBefore(btn, houseBtn.nextSibling);
  let current = null, running = null;

  // ---------- Estilos ----------
  const style = document.createElement('style');
  style.textContent = `
    #terrain-visit{position:fixed;inset:0;z-index:3100;background:#06111dcc;display:grid;place-items:center;padding:14px}
    #terrain-visit .tv-card{width:min(580px,100%);background:#142b25;color:#fff;border-radius:18px;padding:14px;box-shadow:0 16px 50px #0009}
    #terrain-visit.water .tv-card{background:#0d2b45}
    #terrain-visit .tv-head{display:flex;justify-content:space-between;align-items:center;font-weight:900;margin-bottom:10px;gap:8px}
    #terrain-visit .tv-x{border:0;border-radius:50%;width:36px;height:36px;font-size:22px;background:#ffffff22;color:#fff;cursor:pointer;flex:none}
    #terrain-visit .tv-scene{height:320px;position:relative;overflow:hidden;border-radius:13px;background:#000;isolation:isolate}
    #terrain-visit .tv-scene *{box-sizing:border-box}
    #terrain-visit .tv-caption{text-align:center;min-height:44px;margin-top:10px;font-weight:700;line-height:1.3}
    #terrain-visit .tv-again{display:none;margin:6px auto 0;border:0;border-radius:99px;padding:9px 20px;font-weight:800;background:#ffd23f;color:#3b2410;cursor:pointer}
    #terrain-visit .tv-again.on{display:block}
    #terrain-visit .abs{position:absolute}
    #terrain-visit .tv-fig{position:absolute;width:64px;height:96px;margin-left:-32px;z-index:20;transform-origin:50% 100%}
    #terrain-visit .tv-fig svg{width:100%;height:100%;overflow:visible;display:block}
    #terrain-visit .tv-flip{position:absolute;inset:0;transition:transform .3s}
    #terrain-visit .puff{position:absolute;width:7px;height:7px;border-radius:50%;background:#6b4423;z-index:25;pointer-events:none;animation:tv-puff .7s ease-out forwards}
    @keyframes tv-puff{0%{transform:translate(0,0);opacity:1}100%{transform:translate(var(--dx),var(--dy));opacity:0}}
    @keyframes tv-leg-a{0%,100%{transform:rotate(-24deg)}50%{transform:rotate(24deg)}}
    @keyframes tv-leg-b{0%,100%{transform:rotate(24deg)}50%{transform:rotate(-24deg)}}
    @keyframes tv-arm-swing{0%,100%{transform:rotate(-70deg)}50%{transform:rotate(25deg)}}
    @keyframes tv-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
    @keyframes tv-twinkle{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
    @keyframes tv-pop{0%{transform:translate(-50%,0) scale(.2)}70%{transform:translate(-50%,0) scale(1.25)}100%{transform:translate(-50%,0) scale(1)}}
    #terrain-visit .tv-fig .leg-l,#terrain-visit .tv-fig .leg-r,#terrain-visit .tv-fig .arm-f,#terrain-visit .tv-fig .arm-b{transform-box:fill-box;transform-origin:50% 8%}
    #terrain-visit .tv-fig.walk .leg-l{animation:tv-leg-a .55s linear infinite}
    #terrain-visit .tv-fig.walk .leg-r{animation:tv-leg-b .55s linear infinite}
    #terrain-visit .tv-fig.walk .arm-b{animation:tv-leg-a .55s linear infinite}
    #terrain-visit .tv-fig.walk .tv-flip{animation:tv-bob .3s ease-in-out infinite}
    #terrain-visit .tv-fig.dig .arm-f{animation:tv-arm-swing .55s ease-in-out infinite}
    #terrain-visit .tv-fig.swim .leg-l{animation:tv-leg-a .9s ease-in-out infinite}
    #terrain-visit .tv-fig.swim .leg-r{animation:tv-leg-b .9s ease-in-out infinite}
    #terrain-visit .tv-fig.swim .arm-b{animation:tv-leg-b 1.2s ease-in-out infinite}
    #terrain-visit .tv-fig.swim .arm-f{animation:tv-leg-a 1.2s ease-in-out infinite}

    /* ===== Césped: bajo tierra ===== */
    #terrain-visit .g-sky{left:0;right:0;top:0;height:100px;background:linear-gradient(#7ec8f5,#cfeaff)}
    #terrain-visit .g-sun{right:26px;top:10px;font-size:34px}
    #terrain-visit .g-cloud{top:14px;font-size:30px;opacity:.9;animation:tv-cloud 32s linear infinite}
    @keyframes tv-cloud{from{transform:translateX(-80px)}to{transform:translateX(640px)}}
    #terrain-visit .g-grass{left:0;right:0;top:96px;height:16px;background:repeating-linear-gradient(90deg,#4f9a3a 0 14px,#5fae46 14px 29px);border-bottom:3px solid #3d7a2c;z-index:6}
    #terrain-visit .g-soil{left:0;right:0;top:112px;bottom:0;background:
      radial-gradient(circle at 12% 30%,#0003 0 3px,#0000 4px),radial-gradient(circle at 38% 62%,#0003 0 4px,#0000 5px),radial-gradient(circle at 70% 24%,#0002 0 3px,#0000 4px),radial-gradient(circle at 86% 74%,#0003 0 4px,#0000 5px),radial-gradient(circle at 55% 88%,#0003 0 3px,#0000 4px),
      linear-gradient(#9a6a3c 0,#84552e 34%,#6a4426 62%,#4d3523 100%)}
    #terrain-visit .g-root{width:3px;background:#d8b27a;border-radius:0 0 3px 3px;z-index:7;transform-origin:50% 0}
    #terrain-visit .g-item{z-index:9;font-size:28px;line-height:1;transform:translate(-50%,0);opacity:0;transition:opacity .4s}
    #terrain-visit .g-item.on{opacity:1}
    #terrain-visit .g-item.pop.on{animation:tv-pop .6s ease-out}
    #terrain-visit .g-fixed{z-index:5;font-size:24px;line-height:1;opacity:.75;transform:translate(-50%,0)}
    #terrain-visit .g-shaft{left:14%;top:108px;width:50px;height:0;margin-left:-25px;background:repeating-linear-gradient(#0000 0 12px,#c79a5f 12px 15px),linear-gradient(90deg,#1c120a,#33200f 50%,#1c120a);border-radius:0 0 8px 8px;z-index:8;transition:height 2.2s ease-in}
    #terrain-visit .g-tunnel{left:14%;top:206px;height:84px;width:0;margin-left:-25px;background:linear-gradient(#2b1b10,#3a2615 55%,#241509);border-radius:0 40px 40px 12px;box-shadow:inset 0 10px 18px #000a,inset 0 -8px 12px #0008;z-index:8;transition:width 1s linear}
    #terrain-visit .g-hole{left:14%;top:100px;width:0;height:12px;margin-left:0;transform:translateX(-50%);background:#2a1a10;border-radius:50%;z-index:7;transition:width .8s}
    #terrain-visit .g-light{position:absolute;left:30px;top:6px;width:150px;height:76px;background:linear-gradient(90deg,#fff3a8cc,#fff3a800);clip-path:polygon(0 38%,100% 0,100% 100%);opacity:0;transition:opacity .4s;z-index:-1;pointer-events:none}
    #terrain-visit .tv-fig.lamp .g-light{opacity:1}
    #terrain-visit .g-worm{z-index:10;font-size:26px;opacity:0;transform:translate(-50%,0)}
    #terrain-visit .g-worm.on{opacity:1;animation:tv-worm 6s linear forwards}
    @keyframes tv-worm{0%{margin-left:-30px}100%{margin-left:40px}}
    #terrain-visit .g-ants{z-index:10;font-size:16px;opacity:0;white-space:nowrap;letter-spacing:2px}
    #terrain-visit .g-ants.on{opacity:1;animation:tv-ants 7s linear forwards}
    @keyframes tv-ants{0%{transform:translateX(0)}100%{transform:translateX(130px)}}
    #terrain-visit .g-spark{z-index:11;font-size:20px;opacity:0}
    #terrain-visit .g-spark.on{opacity:1;animation:tv-twinkle .8s ease-in-out infinite}

    /* ===== Agua: buceo con escafandra ===== */
    #terrain-visit .w-sky{left:0;right:0;top:0;height:78px;background:linear-gradient(#8fd8ff,#e3f6ff)}
    #terrain-visit .w-sun{right:24px;top:8px;font-size:32px}
    #terrain-visit .w-sea{left:0;right:0;top:74px;bottom:0;background:linear-gradient(#52c4e8 0,#1f93c4 28%,#0b5f93 62%,#05304f 100%)}
    #terrain-visit .w-rays{left:0;right:0;top:74px;height:170px;background:repeating-linear-gradient(105deg,#ffffff1f 0 18px,#ffffff00 18px 56px);opacity:.55;pointer-events:none;animation:tv-rays 8s ease-in-out infinite alternate;z-index:2}
    @keyframes tv-rays{from{transform:translateX(-18px)}to{transform:translateX(18px)}}
    #terrain-visit .w-surface{left:-10px;right:-10px;top:68px;height:14px;background:repeating-radial-gradient(circle at 10px 0,#bdf0ff 0 8px,#52c4e8 9px 18px);z-index:12;opacity:.85;animation:tv-wave 4s linear infinite}
    @keyframes tv-wave{from{transform:translateX(0)}to{transform:translateX(-20px)}}
    #terrain-visit .w-sand{left:0;right:0;bottom:0;height:52px;background:linear-gradient(#e6cf94,#c9ac66);border-radius:50% 50% 0 0/22px 22px 0 0;z-index:4}
    #terrain-visit .w-boat{left:3%;top:34px;width:130px;height:50px;z-index:11}
    #terrain-visit .w-deco{z-index:5;line-height:1;transform:translate(-50%,0)}
    #terrain-visit .w-fish{z-index:6;line-height:1;white-space:nowrap}
    @keyframes tv-fish-r{from{left:-8%}to{left:108%}}
    @keyframes tv-fish-l{from{left:108%}to{left:-8%}}
    #terrain-visit .w-fish.r{animation:tv-fish-r var(--t,14s) linear infinite}
    #terrain-visit .w-fish.l{animation:tv-fish-l var(--t,16s) linear infinite}
    #terrain-visit .w-fish.l span{display:inline-block;transform:scaleX(-1)}
    #terrain-visit .w-bub{position:absolute;z-index:22;pointer-events:none;font-size:14px;animation:tv-bub 2.6s ease-in forwards}
    @keyframes tv-bub{0%{transform:translate(0,0) scale(.6);opacity:0}15%{opacity:.95}100%{transform:translate(var(--dx),-170px) scale(1.2);opacity:0}}
    #terrain-visit .w-splash{position:absolute;z-index:23;font-size:30px;transform:translate(-50%,-50%);animation:tv-pop .5s ease-out,tv-fade 1.1s ease-in forwards}
    @keyframes tv-fade{to{opacity:0}}
    #terrain-visit .w-gauge{right:10px;top:88px;z-index:30;background:#021827cc;border:2px solid #ffffff55;border-radius:10px;padding:3px 9px;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
    #terrain-visit .w-hose{left:0;top:0;width:100%;height:100%;z-index:19;pointer-events:none;overflow:visible}
    #terrain-visit .w-chest{z-index:7;transform:translate(-50%,0);line-height:1}
    #terrain-visit .w-gem{z-index:8;opacity:0;transform:translate(-50%,0);line-height:1}
    #terrain-visit .w-gem.on{opacity:1;animation:tv-pop .6s ease-out}
    #terrain-visit .tv-fig .helmet{transition:transform .8s cubic-bezier(.3,1.4,.5,1),opacity .4s;transform:translateY(-46px);opacity:0}
    #terrain-visit .tv-fig.helm .helmet{transform:translateY(0);opacity:1}
    @media(prefers-reduced-motion:reduce){#terrain-visit .g-cloud,#terrain-visit .w-rays,#terrain-visit .w-surface,#terrain-visit .w-fish{animation:none!important}}
  `;
  document.head.appendChild(style);

  // ---------- Utilidades ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const sound = n => { try { if (window.sfx) window.sfx(n); } catch (e) {} };
  const svgNS = 'http://www.w3.org/2000/svg';

  // Minero: casco amarillo con linterna, chaleco naranja, pala/pico en la mano delantera
  const MINER = `<svg viewBox="0 0 64 96" aria-hidden="true"><g class="leg-r"><rect x="33" y="58" width="11" height="30" rx="4" fill="#2f4a6b"/><rect x="31" y="84" width="17" height="9" rx="4" fill="#3a2a1d"/></g>
    <g class="arm-b"><rect x="12" y="34" width="9" height="28" rx="4.5" fill="#f0b98b"/></g>
    <g class="leg-l"><rect x="20" y="58" width="11" height="30" rx="4" fill="#355a85"/><rect x="18" y="84" width="17" height="9" rx="4" fill="#3a2a1d"/></g>
    <rect x="14" y="30" width="36" height="36" rx="10" fill="#e8742a"/><rect x="14" y="48" width="36" height="6" fill="#ffd23f" opacity=".9"/>
    <rect x="28" y="22" width="8" height="10" fill="#f0b98b"/><circle cx="32" cy="16" r="13" fill="#f6c9a0"/>
    <circle cx="36" cy="16" r="1.8" fill="#2a211c"/><path d="M33 22 q4 3 8 0" stroke="#9a4545" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M17 13 a15 14 0 0 1 30 0 z" fill="#ffd23f"/><rect x="15" y="12" width="34" height="4" rx="2" fill="#e0b21c"/><circle cx="46" cy="8" r="4.2" fill="#fffbe0" stroke="#7a6a20" stroke-width="1.2"/>
    <g class="arm-f"><rect x="43" y="34" width="9" height="28" rx="4.5" fill="#f0b98b"/><g><rect x="46" y="52" width="3" height="40" rx="1.5" fill="#7a4b24"/><path d="M34 52 q14 -12 28 0 q-14 -5 -28 0z" fill="#8a949c"/></g></g></svg>`;

  // Buceador con escafandra: traje azul, botas pesadas, casco de latón con remaches y ventanilla
  const DIVER = `<svg viewBox="0 0 64 96" aria-hidden="true"><g class="leg-r"><rect x="33" y="60" width="11" height="26" rx="5" fill="#1d3a5c"/><rect x="30" y="82" width="19" height="11" rx="4" fill="#2b2b2b"/></g>
    <g class="arm-b"><rect x="12" y="38" width="10" height="28" rx="5" fill="#23466f"/><circle cx="17" cy="68" r="5" fill="#2b2b2b"/></g>
    <g class="leg-l"><rect x="19" y="60" width="11" height="26" rx="5" fill="#23466f"/><rect x="16" y="82" width="19" height="11" rx="4" fill="#2b2b2b"/></g>
    <rect x="14" y="34" width="36" height="34" rx="11" fill="#2a5282"/><rect x="14" y="52" width="36" height="6" fill="#8a6a2a"/><rect x="29" y="50" width="6" height="10" rx="1.5" fill="#d1a733"/>
    <ellipse cx="32" cy="34" rx="20" ry="7" fill="#c8a13a"/>
    <g class="helmet"><circle cx="32" cy="20" r="19" fill="#c8a13a" stroke="#8a6a1a" stroke-width="2"/><circle cx="32" cy="20" r="14.5" fill="#a9822a"/>
      <circle cx="35" cy="21" r="10.5" fill="#bfeaff" stroke="#6b4f12" stroke-width="2.5"/><circle cx="35" cy="21" r="10.5" fill="#7fd0ee" opacity=".35"/><path d="M29 17 a8 8 0 0 1 8 -4" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".9"/>
      <circle cx="17" cy="14" r="1.8" fill="#6b4f12"/><circle cx="14" cy="24" r="1.8" fill="#6b4f12"/><circle cx="23" cy="34" r="1.8" fill="#6b4f12"/><circle cx="41" cy="34" r="1.8" fill="#6b4f12"/>
      <rect x="29" y="-3" width="7" height="8" rx="2" fill="#8a6a1a"/></g>
    <circle class="facebare" cx="32" cy="20" r="0" fill="#f6c9a0"/>
    <g class="arm-f"><rect x="42" y="38" width="10" height="28" rx="5" fill="#2a5282"/><circle cx="47" cy="68" r="5" fill="#2b2b2b"/></g></svg>`;

  function makeFig(svg, cls) {
    const f = document.createElement('div'); f.className = 'tv-fig ' + (cls || '');
    f.innerHTML = '<div class="tv-flip">' + svg + '</div>';
    return f;
  }

  // ---------- Escena: bajo el césped ----------
  async function sceneGrass(S, T) {
    const add = (cls, css, txt) => { const d = document.createElement('div'); d.className = 'abs ' + cls; d.style.cssText = css || ''; if (txt != null) d.textContent = txt; S.appendChild(d); return d; };
    add('g-sky'); add('g-sun', '', '🌤️');
    add('g-cloud', 'left:0;animation-delay:-6s', '☁️'); add('g-cloud', 'left:0;top:34px;animation-duration:44s;animation-delay:-22s;font-size:24px', '☁️');
    [['🌼', 62], ['🌷', 168], ['🌻', 292], ['🌼', 414], ['🌿', 500]].forEach(([e, x]) => add('', `left:${x}px;top:76px;font-size:22px;z-index:5;line-height:1;transform:translateX(-50%)`, e));
    add('g-soil'); add('g-grass');
    [[110, 0, 56], [340, 0, 70], [455, 0, 48], [200, 0, 40], [520, 0, 60]].forEach(([x, , h], i) => add('g-root', `left:${x}px;top:112px;height:${h}px;transform:rotate(${i % 2 ? 7 : -7}deg)`));
    [['🪨', 30, 140], ['🪨', 300, 296], ['🪨', 520, 160], ['🐚', 380, 150], ['🪨', 90, 296], ['🌰', 470, 300], ['🪨', 240, 150]].forEach(([e, x, y]) => add('g-fixed', `left:${x}px;top:${y}px`, e));
    const hole = add('g-hole'), shaft = add('g-shaft'), tunnel = add('g-tunnel');
    const worm = add('g-worm', 'left:30%;top:262px', '🪱'), ants = add('g-ants', 'left:34%;top:268px', '🐜 🐜 🐜 🐜');
    const bone = add('g-item pop', 'left:56%;top:250px;font-size:34px', '🦴'), chest = add('g-item pop', 'left:80%;top:244px;font-size:40px', '🧰');
    const gem = add('g-item pop', 'left:80%;top:206px;font-size:34px', '💎'), spark = add('g-spark', 'left:76%;top:214px', '✨ ✨');
    const miner = makeFig(MINER); S.appendChild(miner);
    const light = document.createElement('div'); light.className = 'g-light'; miner.appendChild(light);
    const W = () => S.clientWidth, X = pct => W() * pct / 100;
    const place = (xPct, top, ms, ease) => { miner.style.transition = ms ? `left ${ms}ms ${ease || 'linear'}, top ${ms}ms ${ease || 'linear'}` : 'none'; miner.style.left = xPct + '%'; miner.style.top = top + 'px'; };
    const face = dir => { miner.querySelector('.tv-flip').style.transform = `scaleX(${dir})`; };
    const puff = (x, y, n) => { for (let i = 0; i < n; i++) { const p = document.createElement('div'); p.className = 'puff'; p.style.left = x + 'px'; p.style.top = y + 'px'; p.style.setProperty('--dx', rnd(-34, 34) + 'px'); p.style.setProperty('--dy', rnd(-46, -12) + 'px'); S.appendChild(p); setTimeout(() => p.remove(), 800); } };
    const dig = async (x, y, times) => { miner.classList.add('dig'); for (let i = 0; i < times; i++) { sound('cavar'); puff(x, y, 7); await T.sleep(560); } miner.classList.remove('dig'); };

    // 1) En la superficie
    face(1); place(14, 14, 0); T.cap('Estás sobre el césped. Coges la pala y el casco con linterna…'); await T.sleep(2200);
    T.cap('Empiezas a excavar un pozo en el suelo…'); hole.style.width = '70px';
    await dig(X(14) + 14, 104, 4);
    shaft.style.height = '182px'; T.cap('Colocas una escalera y bajas ¡bajo tierra!'); sound('pop');
    miner.classList.add('lamp'); place(14, 186, 2200, 'ease-in'); await T.sleep(2400);
    // 2) Túnel hacia la derecha
    face(1); miner.classList.add('walk');
    T.cap('Bajo el césped hay un mundo oculto: raíces, lombrices y hormigas…');
    tunnel.style.transition = 'width 3s linear'; tunnel.style.width = 'calc(34% + 25px)'; place(34, 186, 3000); worm.classList.add('on'); ants.classList.add('on'); await T.sleep(3200);
    // 3) Hueso de dinosaurio
    miner.classList.remove('walk'); T.cap('Sigues cavando hacia delante con la luz del casco…');
    tunnel.style.transition = 'width 2.4s linear'; tunnel.style.width = 'calc(56% + 25px)'; miner.classList.add('walk'); place(54, 186, 2400); await T.sleep(2500);
    miner.classList.remove('walk'); await dig(X(54) + 30, 272, 3);
    bone.classList.add('on'); sound('pop'); T.cap('¡Has encontrado un hueso de dinosaurio! 🦴'); await T.sleep(2400);
    // 4) Cofre con diamante
    tunnel.style.transition = 'width 2.4s linear'; tunnel.style.width = 'calc(80% + 25px)'; miner.classList.add('walk'); place(77, 186, 2400); await T.sleep(2500);
    miner.classList.remove('walk'); await dig(X(77) + 30, 272, 3);
    chest.classList.add('on'); sound('pop'); T.cap('¡Y un cofre enterrado!'); await T.sleep(1500);
    gem.classList.add('on'); spark.classList.add('on'); sound('coin'); T.cap('¡Dentro hay un diamante enorme! 💎'); await T.sleep(2800);
    // 5) Volver a la superficie
    T.cap('Vuelves por el túnel y subes por la escalera…'); spark.classList.remove('on'); face(-1); miner.classList.add('walk'); place(14, 186, 3600); await T.sleep(3700);
    miner.classList.remove('walk'); sound('pop'); place(14, 14, 2400, 'ease-out'); await T.sleep(2500);
    miner.classList.remove('lamp'); face(1);
    T.cap('¡Sales de nuevo al césped! Qué aventura tan increíble.'); sound('gift'); await T.sleep(1200);
  }

  // ---------- Escena: buceo con escafandra ----------
  async function sceneWater(S, T) {
    const add = (cls, css, txt) => { const d = document.createElement('div'); d.className = 'abs ' + cls; d.style.cssText = css || ''; if (txt != null) d.textContent = txt; S.appendChild(d); return d; };
    const W = () => S.clientWidth;
    add('w-sky'); add('w-sun', '', '☀️'); add('w-sea'); add('w-rays'); add('w-sand');
    [['🌿', 40, 262, 30], ['🪸', 120, 268, 34], ['🌿', 200, 264, 28], ['🪸', 300, 270, 30], ['🌿', 372, 262, 32], ['🪸', 470, 268, 36], ['🌿', 530, 264, 28], ['🐚', 250, 288, 20], ['⭐', 420, 292, 20]].forEach(([e, x, y, fs]) => add('w-deco', `left:${x}px;top:${y}px;font-size:${fs}px`, e));
    [['🐠', 150, 'r', 13], ['🐟', 210, 'l', 17], ['🐡', 120, 'r', 21], ['🐠', 245, 'l', 15], ['🐢', 190, 'r', 28], ['🦑', 160, 'l', 24]].forEach(([e, y, d, t], i) => { const f = add('w-fish ' + d, `top:${y}px;font-size:${e === '🐢' ? 30 : 24}px;--t:${t}s;animation-delay:${-i * 3}s`); const sp = document.createElement('span'); sp.textContent = e; f.appendChild(sp); });
    add('w-fish r', 'top:205px;font-size:20px;--t:19s;animation-delay:-9s').innerHTML = '<span>🐟</span>';
    add('w-surface');
    // barca (SVG)
    const boat = add('w-boat'); boat.innerHTML = '<svg viewBox="0 0 130 50" width="130" height="50" aria-hidden="true"><path d="M4 22 H126 L112 46 H20 Z" fill="#b7472a"/><path d="M4 22 H126 L123 28 H7 Z" fill="#e8e0d0"/><rect x="86" y="4" width="4" height="20" fill="#6b4423"/><path d="M90 5 L118 14 L90 18 Z" fill="#ffd23f"/><circle cx="30" cy="34" r="5" fill="#bfeaff" stroke="#6b4f12" stroke-width="2"/><circle cx="52" cy="34" r="5" fill="#bfeaff" stroke="#6b4f12" stroke-width="2"/></svg>';
    const chest = add('w-chest', 'left:78%;top:262px;font-size:42px', '🧰'), gem = add('w-gem', 'left:78%;top:218px;font-size:34px', '💎');
    const gauge = add('w-gauge', '', '🌊 0 m');
    const hoseSvg = document.createElementNS(svgNS, 'svg'); hoseSvg.setAttribute('class', 'abs w-hose');
    const hose = document.createElementNS(svgNS, 'path'); hose.setAttribute('fill', 'none'); hose.setAttribute('stroke', '#2d2d2d'); hose.setAttribute('stroke-width', '4'); hose.setAttribute('stroke-linecap', 'round'); hose.setAttribute('stroke-dasharray', '1 0');
    const hose2 = document.createElementNS(svgNS, 'path'); hose2.setAttribute('fill', 'none'); hose2.setAttribute('stroke', '#6a6a6a'); hose2.setAttribute('stroke-width', '1.2'); hose2.setAttribute('stroke-dasharray', '5 4');
    hoseSvg.append(hose, hose2); S.appendChild(hoseSvg);
    const diver = makeFig(DIVER); S.appendChild(diver);

    // Movimiento suave del buceador hacia un objetivo (la manguera lo sigue desde la barca)
    const st = { x: 0, y: 0, tx: 0, ty: 0, k: 0.06, under: false, t0: performance.now() };
    const pos = (x, y) => { st.x = st.tx = x; st.y = st.ty = y; };
    const target = (x, y, k) => { st.tx = x; st.ty = y; st.k = k || 0.06; };
    pos(W() * 0.19, -38);   // de pie en la cubierta de la barca (alto 96: los pies quedan en y≈58)
    const SEABED = 268;
    let raf = 0;
    const frame = now => {
      if (T.dead()) return;
      raf = requestAnimationFrame(frame);
      st.x += (st.tx - st.x) * st.k; st.y += (st.ty - st.y) * st.k;
      const bob = st.under ? Math.sin((now - st.t0) / 480) * 3 : 0;
      diver.style.left = st.x + 'px'; diver.style.top = (st.y + bob) + 'px';
      const hx = st.x + 2, hy = st.y + bob + 2, bx = W() * 0.19 + 30, by = 52;   // casco y punto de la barca
      const sag = Math.max(hy, by) + 36 + (st.under ? 22 : 0);
      const d = `M${bx} ${by} Q${(bx + hx) / 2} ${sag} ${hx} ${hy}`; hose.setAttribute('d', d); hose2.setAttribute('d', d);
      const depth = Math.max(0, Math.round((st.y + 96 - 80) / (SEABED - 80) * 18)); gauge.textContent = '🌊 ' + depth + ' m';
    };
    raf = requestAnimationFrame(frame);
    // Burbujas que salen del casco mientras estás bajo el agua
    const bubbles = async () => { while (!T.dead()) { await T.sleep(rnd(260, 520)); if (st.under) { const b = document.createElement('div'); b.className = 'w-bub'; b.textContent = '🫧'; b.style.left = (st.x + 6 + rnd(-6, 6)) + 'px'; b.style.top = (st.y + 4) + 'px'; b.style.setProperty('--dx', rnd(-14, 14) + 'px'); S.appendChild(b); setTimeout(() => b.remove(), 2700); } } };
    bubbles().catch(() => {});
    const splash = (x, y) => { const sp = document.createElement('div'); sp.className = 'w-splash'; sp.style.left = x + 'px'; sp.style.top = y + 'px'; sp.textContent = '💦'; S.appendChild(sp); setTimeout(() => sp.remove(), 1200); };

    // 1) En la barca: te pones la escafandra
    T.cap('Subes a la barca y sacas el traje de buceo…'); await T.sleep(2200);
    diver.classList.add('helm'); sound('pop'); T.cap('Te colocas la escafandra de buceador y compruebas el aire…'); await T.sleep(900); sound('burbujas'); await T.sleep(1500);
    T.cap('¡Todo en orden! Te lanzas al agua…'); await T.sleep(900);
    // 2) Salto al agua
    target(W() * 0.3, -46, 0.1); await T.sleep(600);
    target(W() * 0.3, 54, 0.12); await T.sleep(550);
    splash(W() * 0.3 + 6, 84); sound('chapoteo'); st.under = true; diver.classList.add('swim'); sound('burbujas');
    // 3) Descenso
    T.cap('Desciendes despacio. ¡El agua está transparente!'); target(W() * 0.33, 112, 0.025); await T.sleep(3000); sound('burbujas');
    // 4) Nadar entre peces
    T.cap('Nadas entre peces de colores, tortugas y algas…'); target(W() * 0.5, 142, 0.02); await T.sleep(3600); sound('burbujas');
    diver.querySelector('.tv-flip').style.transform = 'scaleX(1)';
    // 5) Cofre del fondo
    T.cap('¡Algo brilla en el fondo del mar!'); target(W() * 0.7, 170, 0.025); await T.sleep(3600);
    sound('pop'); await T.sleep(500); gem.classList.add('on'); sound('coin'); T.cap('¡Un cofre del tesoro con un diamante! 💎'); await T.sleep(3000);
    // 6) Subir
    diver.querySelector('.tv-flip').style.transform = 'scaleX(-1)';
    T.cap('Subes a la superficie con cuidado, soltando burbujas…'); sound('burbujas'); target(W() * 0.25, 58, 0.02); await T.sleep(4200);
    st.under = false; diver.classList.remove('swim'); target(W() * 0.19, -38, 0.06); splash(W() * 0.25, 84); sound('chapoteo'); await T.sleep(1800);
    diver.querySelector('.tv-flip').style.transform = 'scaleX(1)';
    T.cap('¡Misión cumplida! Has explorado el fondo del mar.'); sound('gift'); await T.sleep(1200);
    cancelAnimationFrame(raf);
  }

  // ---------- Abrir / cerrar ----------
  function open() {
    if (running || !current) return;
    const kind = current.visitTerrain === 'water' ? 'water' : 'grass';
    const root = document.createElement('div');
    root.id = 'terrain-visit'; root.className = kind; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.innerHTML = `<div class="tv-card"><div class="tv-head"><span class="tv-title"></span><button type="button" class="tv-x" aria-label="Cerrar">×</button></div><div class="tv-scene"></div><div class="tv-caption" aria-live="polite"></div><button type="button" class="tv-again">↻ Repetir</button></div>`;
    root.querySelector('.tv-title').textContent = kind === 'water' ? '🤿 Buceando bajo el agua' : '🌱 Bajo tierra, en el césped';
    document.body.appendChild(root);
    const S = root.querySelector('.tv-scene'), capEl = root.querySelector('.tv-caption'), again = root.querySelector('.tv-again');
    let dead = false;
    const token = {}; running = token;
    const T = {
      dead: () => dead,
      cap: t => { capEl.textContent = t; },
      sleep: ms => new Promise((res, rej) => setTimeout(() => (dead ? rej(token) : res()), ms))
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      if (dead) return; dead = true; root.remove(); if (running === token) running = null;
      document.removeEventListener('keydown', onKey);
      try { if (window.houseMute) window.houseMute(false); } catch (e) {}   // vuelve el sonido de fuera
    }
    root.querySelector('.tv-x').onclick = close;
    root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
    document.addEventListener('keydown', onKey);
    try { if (window.houseMute) window.houseMute(true); } catch (e) {}   // dentro de la escena solo suenan sus efectos
    sound('select');
    const play = async () => {
      S.replaceChildren(); again.classList.remove('on');
      try { await (kind === 'water' ? sceneWater : sceneGrass)(S, T); again.classList.add('on'); }
      catch (e) { if (e !== token) { console.error(e); close(); } }
    };
    again.onclick = () => { if (!dead) play(); };
    play();
  }

  btn.addEventListener('click', open);
  const previous = window.visitaPanel;
  window.visitaPanel = function (p) {
    if (previous) previous(p);
    current = p || null;
    const natural = !!(p && p.owner && !p.house && ['grass', 'water'].includes(p.visitTerrain));
    btn.textContent = p && p.visitTerrain === 'water' ? '🤿 BUCEAR CON ESCAFANDRA' : '🌱 BAJAR BAJO TIERRA';
    btn.classList.toggle('hidden', !natural);
  };
})();
