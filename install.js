'use strict';
// Botón "Descargar la app" (con el icono de la app): si el navegador ofrece instalar, abre su aviso de instalación;
// si no (iPhone/iPad, o Chrome que aún no lo ha ofrecido) explica los pasos para añadirla a la pantalla de inicio.
(function () {
  const btn = document.getElementById('install-btn'), cbtn = document.getElementById('cover-install'), help = document.getElementById('install-help');
  if (!btn) return;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const FLAG = 'appInstalled';
  const setFlag = v => { try { v ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch (e) {} };
  const hasFlag = () => { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } };
  if (standalone()) { setFlag(true); return; }                // abierta como app: ya está instalada, el botón no aparece

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null;
  const hide = () => { btn.classList.add('hidden'); if (cbtn) cbtn.classList.add('hidden'); };
  const show = () => { btn.classList.remove('hidden'); if (cbtn) cbtn.classList.remove('hidden'); };

  // Si el navegador ofrece instalar, es que NO está instalada (se borra la marca por si la desinstalaron)
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; setFlag(false); show(); });
  window.addEventListener('appinstalled', () => { deferred = null; setFlag(true); hide(); });
  if (hasFlag()) hide(); else show();                         // instalada antes (aunque ahora abras la web en el navegador): sin botón
  // Chrome (Android) sabe si la app está instalada aunque abras la web en una pestaña normal
  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then(apps => { if (apps && apps.length) { setFlag(true); hide(); } }).catch(() => {});
  }                                                     // siempre visible: si el navegador no ofrece instalar solo, se muestran los pasos
  const ad = document.getElementById('install-android'), io = document.getElementById('install-ios');
  if (ad && io) { if (isIos) ad.classList.add('hidden'); else io.classList.add('hidden'); }   // solo los pasos de tu dispositivo

  const onClick = async () => {
    if (deferred) {
      const d = deferred; deferred = null;
      try { d.prompt(); const r = await d.userChoice; if (r && r.outcome === 'accepted') hide(); else show(); } catch (e) {}
      return;
    }
    if (help) help.classList.remove('hidden');                // sin aviso del navegador: instrucciones paso a paso
  };
  btn.addEventListener('click', onClick);
  if (cbtn) cbtn.addEventListener('click', onClick);
  if (help) {
    const close = () => help.classList.add('hidden');
    const x = document.getElementById('install-close'); if (x) x.addEventListener('click', close);
    help.addEventListener('click', e => { if (e.target === help) close(); });
  }
})();
