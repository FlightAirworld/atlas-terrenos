/* 🌱 Terrenos nuevos: 26 parcelas al azar según su rareza. Lo usan el servidor (require) y el navegador (<script>).
 *   oneIn = «sale 1 de cada N compras» (la Común es el resto). mult = lo que produce respecto a la Común.
 *   Para cambiar probabilidades o producción toca SOLO esta lista. */
(function (root) {
  const T = [
    { slug: 'comun',      name: 'Común',      icon: '🌎', color: '#6dd36d', oneIn: null,  mult: 0.21 },
    { slug: 'comun-plus', nueva: true, name: 'Común Plus', icon: '🍀', color: '#7be07b', oneIn: 3, mult: 0.1 },
    { slug: 'superior', nueva: true, name: 'Superior', icon: '🔷', color: '#3d8bff', oneIn: 8, mult: 0.14 },
    { slug: 'poco-comun', name: 'Poco común', icon: '🔵', color: '#4aa3ff', oneIn: 9,    mult: 0.3 },
    { slug: 'extraordinario', nueva: true, name: 'Extraordinario', icon: '💠', color: '#7fe8ff', oneIn: 12, mult: 0.44 },
    { slug: 'raro', alt: ['images/terreno-raro-2.webp'], name: 'Raro',       icon: '🟣', color: '#b46bff', oneIn: 13,    mult: 0.63 },
    { slug: 'arcano', nueva: true, name: 'Arcano', icon: '🧿', color: '#3b5bdb', oneIn: 15, mult: 0.91 },
    { slug: 'muy-raro',   name: 'Muy raro',   icon: '🌕', color: '#ffd84a', oneIn: 16,    mult: 1.3 },
    { slug: 'supremo', nueva: true, name: 'Supremo', icon: '🏆', color: '#ffcc33', oneIn: 18, mult: 1.9 },
    { slug: 'epico',      name: 'Épico',      icon: '💎', color: '#4ff0e6', oneIn: 19,   mult: 2.8 },
    { slug: 'ancestral', nueva: true, name: 'Ancestral', icon: '🔥', color: '#ff7a2f', oneIn: 21, mult: 4 },
    { slug: 'legendario', name: 'Legendario', icon: '🟡', color: '#ffb300', oneIn: 22,   mult: 5.8 },
    { slug: 'trascendente', nueva: true, name: 'Trascendente', icon: '⚡', color: '#ffe94a', oneIn: 24, mult: 8.3 },
    { slug: 'mitico',     name: 'Mítico',     icon: '🔴', color: '#ff4b4b', oneIn: 25,   mult: 12 },
    { slug: 'imperial', nueva: true, name: 'Imperial', icon: '🐉', color: '#c0392b', oneIn: 27, mult: 17 },
    { slug: 'exotico',    name: 'Exótico',    icon: '🌈', color: '#ff7bd5', oneIn: 28,  mult: 25 },
    { slug: 'astral', nueva: true, name: 'Astral', icon: '💫', color: '#b9a7ff', oneIn: 30, mult: 36 },
    { slug: 'unico',      name: 'Único',      icon: '👑', color: '#ffd700', oneIn: 31,  mult: 52 },
    { slug: 'sagrado', nueva: true, name: 'Sagrado', icon: '☀️', color: '#fff0a8', oneIn: 33, mult: 76 },
    { slug: 'especial',   name: 'Especial',   icon: '⭐', color: '#fff27a', oneIn: 34,  mult: 110 },
    { slug: 'abismal', nueva: true, name: 'Abismal', icon: '🌑', color: '#5b2a86', oneIn: 36, mult: 160 },
    { slug: 'celestial',  name: 'Celestial',  icon: '🌌', color: '#9d7bff', oneIn: 37, mult: 230 },
    { slug: 'divino', nueva: true, name: 'Divino', icon: '🪽', color: '#fdfdfd', oneIn: 39, mult: 330 },
    { slug: 'infinito', nueva: true, name: 'Infinito', icon: '♾️', color: '#00e5ff', oneIn: 42, mult: 480 },
    { slug: 'primordial', nueva: true, name: 'Primordial', icon: '💠', color: '#ff4fd8', oneIn: 45, mult: 690 },
    { slug: 'absoluto', nueva: true, name: 'Absoluto', icon: '👁️', color: '#ff1f1f', oneIn: 50, mult: 1000 }
  ];
  T.forEach(t => { t.img = 'images/terreno-' + t.slug + '.webp'; });
  // 🪐 Terrenos de otros mundos: cada mundo tiene sus casas (de más sencilla a más espectacular, igual que WORLD_HOUSES de server.js/app.js).
  // Cada casa lleva la rareza y la producción de una de las categorías de arriba (repartidas de la más baja a la más alta), y se sortea igual que en la Tierra.
  const CASAS = {
    luna: ['luna-cupula', 'luna-rover', 'luna-granja-solar', 'luna-radiotelescopio', 'luna-ciudad-lunar', 'luna-estacion-lunar', 'luna-complejo-lunar', 'luna-base-geodesica'],
    marte: ['marte-cupula-marciana', 'marte-invernadero', 'marte-base-rover', 'marte-mina-roja', 'marte-torre-radio', 'marte-puerto-marte'],
    mercurio: ['mercurio-base-crater', 'mercurio-escudo-solar', 'mercurio-observatorio', 'mercurio-mina-metal', 'mercurio-antena-solar', 'mercurio-estacion-polar'],
    venus: ['venus-ciudad-aerostato', 'venus-plataforma-nube', 'venus-laboratorio-acido', 'venus-globo-dorado', 'venus-torre-nubes', 'venus-puerto-aereo'],
    jupiter: ['jupiter-plataforma-flotante', 'jupiter-globo-gas', 'jupiter-refineria-hidrogeno', 'jupiter-observatorio-tormenta', 'jupiter-ciudad-nube', 'jupiter-puerto-nubes'],
    saturno: ['saturno-plataforma-anillos', 'saturno-ciudad-flotante', 'saturno-globo-anillo', 'saturno-laboratorio-gas', 'saturno-refineria-saturno', 'saturno-puerto-saturno'],
    urano: ['urano-cristal-hielo', 'urano-plataforma-azul', 'urano-globo-hielo', 'urano-estacion-eje', 'urano-refineria-metano', 'urano-puerto-urano'],
    neptuno: ['neptuno-plataforma-tormenta', 'neptuno-globo-azul', 'neptuno-refineria-diamante', 'neptuno-ciudad-neptuno', 'neptuno-laboratorio-frio', 'neptuno-puerto-neptuno'],
    pluton: ['pluton-cupula-hielo', 'pluton-base-corazon', 'pluton-criolaboratorio', 'pluton-mina-nitrogeno', 'pluton-sonda-horizontes', 'pluton-refugio-polar'],
    prehistoria: ['prehistoria-cueva', 'prehistoria-choza-paja', 'prehistoria-nido-gigante', 'prehistoria-casa-arbol', 'prehistoria-cabana-troncos', 'prehistoria-fortaleza-huesos']
  };
  const porMult = T.slice().sort((a, b) => a.mult - b.mult);
  const MUNDOS = {};   // mundo -> lista (de la más común a la más rara) de { ...categoría, img: casa del mundo }
  Object.keys(CASAS).forEach(w => {
    const n = CASAS[w].length;
    MUNDOS[w] = CASAS[w].map((c, k) => Object.assign({}, porMult[Math.round(k * (porMult.length - 1) / (n - 1))], { img: 'images/' + c + '.webp', mundo: w, oneIn: Math.max(3, Math.round(Math.sqrt(porMult[Math.round(k * (porMult.length - 1) / (n - 1))].oneIn || 4))) }));   // en otros mundos salen más fácil: raíz cuadrada de la Tierra
  });
  // Se mira de la más rara a la más común: cada una sale con probabilidad 1/oneIn; si ninguna, Común.
  function roll(rnd, mundo) {
    rnd = rnd || Math.random;
    const L = mundo && MUNDOS[mundo] ? MUNDOS[mundo] : T;   // en la Tierra, las categorías de siempre; en otro mundo, sus casas
    const pick = c => c.alt && c.alt.length ? Object.assign({}, c, { img: [c.img].concat(c.alt)[Math.floor(rnd() * (c.alt.length + 1)) % (c.alt.length + 1)] }) : c;   // varias imágenes de la misma rareza: sale una al azar
    for (let i = L.length - 1; i > 0; i--) if (rnd() < 1 / L[i].oneIn) return pick(L[i]);
    return pick(L[0]);
  }
  const byImg = img => { const u = String(img || '').replace(/\.png$/i, '.webp'); return T.find(t => t.img === u || (t.alt && t.alt.includes(u))) || [].concat(...Object.keys(MUNDOS).map(w => MUNDOS[w])).find(t => t.img === u) || null; };
  const fmt = v => v.toLocaleString('es-ES', { maximumFractionDigits: v < 0.001 ? 8 : v < 1 ? 6 : 3 });
  const API = { TERRENOS: T, MUNDOS, CASAS, roll, byImg, PER_SEC_BASE: 1e-6 };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.TERRENOS_NUEVOS = API;


  // ---------- Cartel «MAÑANA PODRÁS COMPRAR MÁS» (al llegar al tope de terrenos del día) ----------
  root.TERRENOS_NUEVOS.avisoTope = function () {
    if (document.getElementById('tn-tope')) return;
    const st = document.createElement('style');
    st.textContent = '#tn-tope{position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 70px);z-index:100000;background:#e00000;color:#fff;font:900 20px/1.25 system-ui,sans-serif;text-align:center;padding:14px 12px;border-radius:14px;border:3px solid #fff;box-shadow:0 6px 24px #0008;animation:tntope .7s steps(1) infinite;text-transform:uppercase}' +
      '#tn-tope small{display:block;margin-top:4px;font:600 11px system-ui,sans-serif;opacity:.9;text-transform:none}@keyframes tntope{0%{opacity:1}50%{opacity:.15}}';
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'tn-tope';
    d.innerHTML = 'Mañana podrás comprar más<small>Has llegado al máximo de 10 terrenos hoy · toca para cerrar</small>';
    d.onclick = () => { d.remove(); st.remove(); };
    document.body.appendChild(d);
    setTimeout(() => { if (d.isConnected) { d.remove(); st.remove(); } }, 20000);
  };

  // ---------- Pantalla «¡Te ha tocado…!» (solo navegador) ----------
  const css = document.createElement('style');
  css.textContent = `#tn-ov{position:fixed;inset:0;z-index:99999;background:#000d;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:16px;text-align:center;color:#fff;overflow:hidden}
  #tn-ov .orb{width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,#fff,var(--c) 60%,transparent 72%);animation:tnsh .35s infinite,tngr 1.6s forwards}
  @keyframes tnsh{0%,100%{transform:translateX(-5px) rotate(-3deg)}50%{transform:translateX(5px) rotate(3deg)}}@keyframes tngr{to{scale:1.8;filter:brightness(2)}}
  #tn-ov .rays{pointer-events:none;position:absolute;width:140vmax;height:140vmax;background:repeating-conic-gradient(var(--c) 0 8deg,transparent 8deg 20deg);opacity:.25;animation:tnsp 14s linear infinite;-webkit-mask:radial-gradient(circle,#000 5%,transparent 45%);mask:radial-gradient(circle,#000 5%,transparent 45%)}
  @keyframes tnsp{to{rotate:360deg}}
  #tn-ov .rv{display:flex;flex-direction:column;align-items:center;max-width:380px;position:relative;animation:tnpop .6s cubic-bezier(.2,1.5,.4,1)}
  @keyframes tnpop{from{scale:.2;opacity:0}to{scale:1;opacity:1}}
  #tn-ov img{width:min(52vw,220px);border-radius:18px;border:3px solid var(--c);box-shadow:0 0 40px var(--c)}
  #tn-ov h2{margin:14px 0 2px;font-size:26px;color:var(--c);text-shadow:0 0 14px var(--c)}#tn-ov p{margin:2px 0;color:#ddd}
  #tn-ov button{margin-top:14px;border:0;border-radius:12px;background:var(--c);color:#111;padding:11px 36px;font:inherit;font-weight:800;cursor:pointer}
  #tn-ov .pt{position:fixed;left:50%;top:45%;width:8px;height:8px;border-radius:50%;background:var(--c);pointer-events:none;animation:tnpt 1.4s forwards}
  @keyframes tnpt{to{transform:translate(var(--x),var(--y));opacity:0}}`;
  document.head.appendChild(css);
  // t = { slug, name, icon, color, oneIn, mult, img } (lo manda el servidor al reclamar el terreno)
  root.TERRENOS_NUEVOS.mostrar = function (t) {
    const d = Object.assign({}, byImg(t.img) || T.find(x => x.slug === t.slug) || T[0]); if (t.img) d.img = t.img;
    const i = T.indexOf(d), ov = document.createElement('div');
    ov.id = 'tn-ov'; ov.style.setProperty('--c', d.color);
    ov.innerHTML = '<div class="rays"></div><div class="orb"></div><div style="margin-top:20px;font-weight:700">Abriendo terreno…</div>';
    document.body.appendChild(ov);
    setTimeout(() => {
      ov.innerHTML = '<div class="rays"></div><div class="rv"><img src="' + d.img.replace('.webp', '-m.webp') + '" alt=""><h2>' + d.icon + ' ' + d.name + '</h2><p>Produce ' + fmt(API.PER_SEC_BASE * d.mult) + ' créditos/segundo</p>' + (t.tienes ? '<p style="font-weight:800;font-size:20px;color:#fff;margin-top:8px">TIENES ' + t.tienes + '</p>' : '') + '<button type="button">Aceptar</button></div>';
      const evs = ['pointerup', 'touchend', 'click', 'mouseup', 'keydown'], desde = Date.now() + 600;
      const cerrar = e => { if (e && e.type !== 'keydown' && Date.now() < desde) return; off(); ov.remove(); };
      const off = () => evs.forEach(n => window.removeEventListener(n, cerrar, true));
      evs.forEach(n => window.addEventListener(n, cerrar, true));   // toques en la ventana (fase de captura): cierra aunque otra capa tape el botón
      const hint = document.createElement('p'); hint.style.cssText = 'font-size:12px;opacity:.7;margin-top:8px'; hint.textContent = 'Toca para cerrar'; ov.querySelector('.rv').appendChild(hint);
      const bt = ov.querySelector('button'); bt.onclick = cerrar; bt.addEventListener('touchend', cerrar); bt.addEventListener('pointerup', cerrar);
      setTimeout(() => { if (document.body.contains(ov)) ov.remove(); }, 60000);   // por si acaso, nunca se queda pegada
      if (window.sfx) try { window.sfx('claim'); } catch (e) {}
      for (let k = 0; k < 24 + i * 4; k++) {
        const p = document.createElement('i'), a = Math.random() * 6.28, r = 100 + Math.random() * 180;
        p.className = 'pt'; p.style.cssText = '--c:' + d.color + ';--x:' + Math.cos(a) * r + 'px;--y:' + Math.sin(a) * r + 'px';
        ov.appendChild(p); setTimeout(() => p.remove(), 1500);
      }
    }, 1300 + i * 140);
  };
})(typeof window !== 'undefined' ? window : globalThis);
