'use strict';
// Botón "Menú": agrupa los botones de la derecha en un desplegable.
(function () {
  const box = document.getElementById('map-controls'), btn = document.getElementById('menu-btn'), list = document.getElementById('menu-items');
  if (!box || !btn || !list) return;
  const KEEP_OPEN = ['people-btn', 'vehicles-btn', 'sound-btn', 'view-btn', 'base-btn'];   // interruptores: se puede tocar varios seguidos

  function set(open) {
    box.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? '✕ Cerrar' : '☰ Menú';
  }
  btn.addEventListener('click', e => { e.stopPropagation(); set(!box.classList.contains('open')); });

  // Al elegir una opción, el menú se cierra (salvo los interruptores)
  list.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && !KEEP_OPEN.includes(b.id)) set(false);
  });
  // Tocar fuera o pulsar Escape también lo cierra
  document.addEventListener('pointerdown', e => { if (box.classList.contains('open') && !box.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) { set(false); btn.focus(); } });
})();

// Botón "Extras": desplegable arriba, junto a Menú, con los botones que antes estaban sueltos a la izquierda.
(function () {
  const wrap = document.getElementById('extras-wrap'), btn = document.getElementById('extras-btn'), list = document.getElementById('extras-items');
  const menuBtn = document.getElementById('menu-btn'), menuBox = document.getElementById('map-controls');
  if (!wrap || !btn || !list) return;
  function set(open) {
    wrap.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !wrap.classList.contains('open');
    if (open && menuBox && menuBox.classList.contains('open') && menuBtn) menuBtn.click();   // abrir Extras cierra Menú
    set(open);
  });
  if (menuBtn) menuBtn.addEventListener('click', () => set(false));                          // abrir Menú cierra Extras
  list.addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.id !== 'online-btn') set(false); });
  document.addEventListener('pointerdown', e => { if (wrap.classList.contains('open') && !wrap.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && wrap.classList.contains('open')) { set(false); btn.focus(); } });
  // El puntito rojo del regalo diario también se ve en el botón Extras, aunque esté cerrado
  const dot = document.getElementById('daily-dot'), eDot = document.getElementById('extras-dot');
  if (dot && eDot) {
    const sync = () => eDot.classList.toggle('hidden', dot.classList.contains('hidden'));
    new MutationObserver(sync).observe(dot, { attributes: true, attributeFilter: ['class'] });
    sync();
  }
})();
