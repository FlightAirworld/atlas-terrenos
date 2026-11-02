'use strict';
// Botón "Instalar la app": en Android/Chrome/Edge abre el aviso de instalación del navegador;
// en iPhone/iPad (que no tiene ese aviso) explica cómo añadirla a la pantalla de inicio.
(function () {
  const btn = document.getElementById('install-btn'), help = document.getElementById('install-help');
  if (!btn) return;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone()) return;                                   // ya está instalada: el botón no aparece

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null;
  const hide = () => btn.classList.add('hidden');
  const show = () => btn.classList.remove('hidden');

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show(); });
  window.addEventListener('appinstalled', () => { deferred = null; hide(); });
  if (isIos) show();

  btn.addEventListener('click', async () => {
    if (deferred) {
      const d = deferred; deferred = null;
      try { d.prompt(); const r = await d.userChoice; if (r && r.outcome === 'accepted') hide(); else show(); } catch (e) {}
      return;
    }
    if (help) help.classList.remove('hidden');                // iPhone: instrucciones
  });
  if (help) {
    const close = () => help.classList.add('hidden');
    const x = document.getElementById('install-close'); if (x) x.addEventListener('click', close);
    help.addEventListener('click', e => { if (e.target === help) close(); });
  }
})();
