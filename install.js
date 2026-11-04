'use strict';
// Botón "Descargar la app" (con el icono de la app): si el navegador ofrece instalar, abre su aviso de instalación;
// si no (iPhone/iPad, o Chrome que aún no lo ha ofrecido) explica los pasos para añadirla a la pantalla de inicio.
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
  show();                                                     // siempre visible: si el navegador no ofrece instalar solo, se muestran los pasos
  const ad = document.getElementById('install-android'), io = document.getElementById('install-ios');
  if (ad && io) { if (isIos) ad.classList.add('hidden'); else io.classList.add('hidden'); }   // solo los pasos de tu dispositivo

  btn.addEventListener('click', async () => {
    if (deferred) {
      const d = deferred; deferred = null;
      try { d.prompt(); const r = await d.userChoice; if (r && r.outcome === 'accepted') hide(); else show(); } catch (e) {}
      return;
    }
    if (help) help.classList.remove('hidden');                // sin aviso del navegador: instrucciones paso a paso
  });
  if (help) {
    const close = () => help.classList.add('hidden');
    const x = document.getElementById('install-close'); if (x) x.addEventListener('click', close);
    help.addEventListener('click', e => { if (e.target === help) close(); });
  }
})();
