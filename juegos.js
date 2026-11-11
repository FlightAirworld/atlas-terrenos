'use strict';
// CARPETA «JUEGOS» dentro de Extras: un solo botón 🎮 que despliega todos los juegos (ruleta, campeonato, trivia, rasca y parejas).
// Los botones de los juegos siguen teniendo sus mismos id, así que cada juego funciona igual que antes; solo están agrupados en index.html
// dentro de #games-items. Aquí solo se abre/cierra la carpeta y se enciende el punto rojo si algún juego tiene algo pendiente.
(function () {
  const wrap = document.getElementById('games-wrap'), btn = document.getElementById('games-btn'), items = document.getElementById('games-items');
  if (!wrap || !btn || !items) return;

  const st = document.createElement('style');
  st.textContent = `
    #games-wrap { display: flex; flex-direction: column; }
    #games-items { display: none; flex-direction: column; gap: 2px; margin: 2px 0 6px 20px; padding-left: 8px; border-left: 2px solid rgba(128, 128, 128, .35); }
    #games-wrap.open #games-items { display: flex; }
    #games-items button:not(.hidden) { height: 46px !important; }
    .mp-ic #games-dot, #games-dot { position: absolute; border-radius: 50%; background: #e63946; }
    #games-dot.hidden { display: none; }
  `;
  document.head.appendChild(st);

  const dot = () => document.getElementById('games-dot');
  function paintLabel(open) { btn.setAttribute('data-label', open ? 'Juegos ▴' : 'Juegos ▾'); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  function syncDot() {   // punto rojo en la carpeta si algún juego de dentro tiene el suyo y la carpeta está cerrada
    const d = dot(); if (!d) return;
    const any = [...items.querySelectorAll('[id$="-dot"]')].some(x => !x.classList.contains('hidden'));
    d.classList.toggle('hidden', wrap.classList.contains('open') || !any);
  }
  function set(open) { wrap.classList.toggle('open', open); paintLabel(open); syncDot(); }

  paintLabel(false);
  btn.setAttribute('aria-controls', 'games-items');
  // stopPropagation: el menú Extras se cierra al tocar cualquier botón; este solo abre/cierra la carpeta y Extras debe seguir abierto.
  btn.addEventListener('click', e => { e.stopPropagation(); set(!wrap.classList.contains('open')); });

  new MutationObserver(syncDot).observe(items, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
  setInterval(syncDot, 3000);
  syncDot();
})();
