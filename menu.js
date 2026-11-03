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
