/* Visitas animadas a parcelas naturales. Se añade al sistema existente sin tocar visita.js. */
(function () {
  const houseBtn = document.getElementById('enter-house-btn');
  if (!houseBtn || !houseBtn.parentNode) return;
  const btn = document.createElement('button');
  btn.id = 'enter-terrain-btn'; btn.type = 'button'; btn.className = 'primary hidden';
  btn.style.cssText = 'width:100%;padding:10px;margin:0 0 8px;font-weight:800';
  houseBtn.parentNode.insertBefore(btn, houseBtn.nextSibling);
  let current = null, busy = false;
  const style = document.createElement('style');
  style.textContent = `
    #terrain-visit{position:fixed;inset:0;z-index:3100;background:#06111dcc;display:grid;place-items:center;padding:14px}
    #terrain-visit .tv-card{width:min(560px,100%);background:#142b25;color:white;border-radius:18px;padding:14px;box-shadow:0 16px 50px #0009}
    #terrain-visit .tv-head{display:flex;justify-content:space-between;align-items:center;font-weight:900;margin-bottom:10px}
    #terrain-visit button{border:0;border-radius:50%;width:36px;height:36px;font-size:22px;background:#ffffff22;color:white}
    #terrain-visit .tv-scene{height:260px;position:relative;overflow:hidden;border-radius:13px;background:linear-gradient(#8bd4f3 0 48%,#65a94d 48%)}
    #terrain-visit.water .tv-scene{background:linear-gradient(#65c9e8,#0877a8 55%,#03456f)}
    #terrain-visit .tv-sun{position:absolute;right:34px;top:22px;font-size:34px}
    #terrain-visit .tv-ground{position:absolute;left:0;right:0;bottom:0;height:82px;background:repeating-linear-gradient(90deg,#579c3f 0 18px,#63aa48 18px 35px)}
    #terrain-visit .tv-hole{position:absolute;left:50%;bottom:24px;width:130px;height:38px;transform:translateX(-50%);border-radius:50%;background:#38271b;box-shadow:0 8px 0 #24180f;opacity:0}
    #terrain-visit .tv-person{position:absolute;left:50%;bottom:55px;transform:translateX(-50%);font-size:76px;filter:drop-shadow(0 5px 3px #0005)}
    #terrain-visit.grass .tv-person{animation:tv-dig 2.2s ease-in-out infinite}
    #terrain-visit.grass .tv-hole{opacity:1}
    #terrain-visit.water .tv-person{bottom:90px;animation:tv-swim 2.5s ease-in-out infinite}
    #terrain-visit .tv-bubble{position:absolute;left:35%;bottom:50px;font-size:23px;animation:tv-bubbles 1.8s linear infinite}
    #terrain-visit .tv-caption{text-align:center;min-height:25px;margin-top:10px;font-weight:700}
    @keyframes tv-dig{0%,100%{transform:translate(-50%,0) rotate(-8deg)}50%{transform:translate(-50%,28px) rotate(8deg)}}
    @keyframes tv-swim{0%,100%{transform:translate(-50%,0) rotate(-8deg)}50%{transform:translate(calc(-50% + 42px),-18px) rotate(8deg)}}
    @keyframes tv-bubbles{0%{transform:translateY(0);opacity:0}30%{opacity:1}100%{transform:translateY(-130px);opacity:0}}
    @media(prefers-reduced-motion:reduce){#terrain-visit *{animation:none!important}}
  `;
  document.head.appendChild(style);
  function close(root){root.remove();busy=false;}
  function start(){
    if(busy||!current)return; busy=true;
    const kind=current.visitTerrain==='water'?'water':'grass';
    const root=document.createElement('div'); root.id='terrain-visit'; root.className=kind; root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true');
    const title=kind==='water'?'🤿 Explorando bajo el agua':'🌱 Explorando bajo el césped';
    root.innerHTML=`<div class="tv-card"><div class="tv-head"><span>${title}</span><button type="button" aria-label="Cerrar">×</button></div><div class="tv-scene"><span class="tv-sun">${kind==='water'?'☀️':'🌤️'}</span><div class="tv-ground"></div><div class="tv-hole"></div><div class="tv-person">${kind==='water'?'🤿':'🧑‍🌾'}</div>${kind==='water'?'<div class="tv-bubble">🫧 🫧</div>':''}</div><div class="tv-caption">${kind==='water'?'Te colocas la escafandra y empiezas a bucear…':'Te agachas y comienzas a excavar bajo tierra…'}</div></div>`;
    document.body.appendChild(root); root.querySelector('button').onclick=()=>close(root);
    root.addEventListener('click',e=>{if(e.target===root)close(root)});
    const key=e=>{if(e.key==='Escape'){close(root);document.removeEventListener('keydown',key)}}; document.addEventListener('keydown',key);
    if(window.sfx)try{window.sfx('select')}catch(_){}
  }
  btn.addEventListener('click',start);
  const previous=window.visitaPanel;
  window.visitaPanel=function(p){if(previous)previous(p);current=p||null;
    const natural=!!(p&&p.owner&&!p.house&&['grass','water'].includes(p.visitTerrain));
    btn.textContent=p&&p.visitTerrain==='water'?'🤿 BUCEAR EN ESTA PARCELA':'🌱 EXPLORAR BAJO EL CÉSPED';
    btn.classList.toggle('hidden',!natural);
  };
})();
