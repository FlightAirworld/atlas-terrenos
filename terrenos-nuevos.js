/* 🌱 Terrenos nuevos: 11 parcelas al azar según su rareza. Lo usan el servidor (require) y el navegador (<script>).
 *   oneIn = «sale 1 de cada N compras» (la Común es el resto). mult = lo que produce respecto a la Común.
 *   Para cambiar probabilidades o producción toca SOLO esta lista. */
(function (root) {
  const T = [
    { slug: 'comun',      name: 'Común',      icon: '🌎', color: '#6dd36d', oneIn: null,  mult: 1 },
    { slug: 'poco-comun', name: 'Poco común', icon: '🔵', color: '#4aa3ff', oneIn: 10,    mult: 3 },
    { slug: 'raro',       name: 'Raro',       icon: '🟣', color: '#b46bff', oneIn: 30,    mult: 10 },
    { slug: 'muy-raro',   name: 'Muy raro',   icon: '🌕', color: '#ffd84a', oneIn: 50,    mult: 25 },
    { slug: 'epico',      name: 'Épico',      icon: '💎', color: '#4ff0e6', oneIn: 100,   mult: 80 },
    { slug: 'legendario', name: 'Legendario', icon: '🟡', color: '#ffb300', oneIn: 250,   mult: 250 },
    { slug: 'mitico',     name: 'Mítico',     icon: '🔴', color: '#ff4b4b', oneIn: 500,   mult: 1000 },
    { slug: 'exotico',    name: 'Exótico',    icon: '🌈', color: '#ff7bd5', oneIn: 1000,  mult: 5000 },
    { slug: 'unico',      name: 'Único',      icon: '👑', color: '#ffd700', oneIn: 2500,  mult: 25000 },
    { slug: 'especial',   name: 'Especial',   icon: '⭐', color: '#fff27a', oneIn: 5000,  mult: 100000 },
    { slug: 'celestial',  name: 'Celestial',  icon: '🌌', color: '#9d7bff', oneIn: 10000, mult: 1000000 }
  ];
  T.forEach(t => { t.img = 'images/terreno-' + t.slug + '.webp'; });
  // Se mira de la más rara a la más común: cada una sale con probabilidad 1/oneIn; si ninguna, Común.
  function roll(rnd) { rnd = rnd || Math.random; for (let i = T.length - 1; i > 0; i--) if (rnd() < 1 / T[i].oneIn) return T[i]; return T[0]; }
  const byImg = img => T.find(t => t.img === String(img || '').replace(/\.png$/i, '.webp')) || null;
  const fmt = v => v.toLocaleString('es-ES', { maximumFractionDigits: v < 0.001 ? 8 : v < 1 ? 6 : 3 });
  const API = { TERRENOS: T, roll, byImg, PER_SEC_BASE: 1e-6 };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.TERRENOS_NUEVOS = API;

  // ---------- Pantalla «¡Te ha tocado…!» (solo navegador) ----------
  const css = document.createElement('style');
  css.textContent = `#tn-ov{position:fixed;inset:0;z-index:99999;background:#000d;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:16px;text-align:center;color:#fff;overflow:hidden}
  #tn-ov .orb{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#fff,var(--c) 60%,transparent 72%);animation:tnsh .35s infinite,tngr 1.6s forwards}
  @keyframes tnsh{0%,100%{transform:translateX(-5px) rotate(-3deg)}50%{transform:translateX(5px) rotate(3deg)}}@keyframes tngr{to{scale:1.8;filter:brightness(2)}}
  #tn-ov .rays{pointer-events:none;position:absolute;width:140vmax;height:140vmax;background:repeating-conic-gradient(var(--c) 0 8deg,transparent 8deg 20deg);opacity:.25;animation:tnsp 14s linear infinite;-webkit-mask:radial-gradient(circle,#000 5%,transparent 45%);mask:radial-gradient(circle,#000 5%,transparent 45%)}
  @keyframes tnsp{to{rotate:360deg}}
  #tn-ov .rv{display:flex;flex-direction:column;align-items:center;max-width:380px;position:relative;animation:tnpop .6s cubic-bezier(.2,1.5,.4,1)}
  @keyframes tnpop{from{scale:.2;opacity:0}to{scale:1;opacity:1}}
  #tn-ov img{width:min(78vw,340px);border-radius:18px;border:3px solid var(--c);box-shadow:0 0 40px var(--c)}
  #tn-ov h2{margin:14px 0 2px;font-size:26px;color:var(--c);text-shadow:0 0 14px var(--c)}#tn-ov p{margin:2px 0;color:#ddd}
  #tn-ov button{margin-top:14px;border:0;border-radius:12px;background:var(--c);color:#111;padding:11px 36px;font:inherit;font-weight:800;cursor:pointer}
  #tn-ov .pt{position:fixed;left:50%;top:45%;width:8px;height:8px;border-radius:50%;background:var(--c);pointer-events:none;animation:tnpt 1.4s forwards}
  @keyframes tnpt{to{transform:translate(var(--x),var(--y));opacity:0}}`;
  document.head.appendChild(css);
  // t = { slug, name, icon, color, oneIn, mult, img } (lo manda el servidor al reclamar el terreno)
  root.TERRENOS_NUEVOS.mostrar = function (t) {
    const d = byImg(t.img) || T.find(x => x.slug === t.slug) || T[0];
    const i = T.indexOf(d), ov = document.createElement('div');
    ov.id = 'tn-ov'; ov.style.setProperty('--c', d.color);
    ov.innerHTML = '<div class="rays"></div><div class="orb"></div><div style="margin-top:20px;font-weight:700">Abriendo terreno…</div>';
    document.body.appendChild(ov);
    setTimeout(() => {
      ov.innerHTML = '<div class="rays"></div><div class="rv"><img src="' + d.img.replace('.webp', '-m.webp') + '" alt=""><h2>' + d.icon + ' ' + d.name + '</h2><p>' +
        (d.oneIn ? 'Sale 1 de cada ' + fmt(d.oneIn) + ' compras' : 'Terreno común') + '</p><p>Produce ' + fmt(API.PER_SEC_BASE * d.mult) + ' créditos/segundo</p>' + (t.tienes ? '<p style="font-weight:800;font-size:20px;color:#fff;margin-top:8px">TIENES ' + t.tienes + '</p>' : '') + '<button type="button">Aceptar</button></div>';
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
