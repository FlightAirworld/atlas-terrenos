// Dirección del servidor (API). Vacío = el mismo servidor que sirve esta página (funcionamiento de siempre).
// En el sitio estático lo reescribe build-static.js con la variable API_BASE.
window.API_BASE = '';

// Google Tag Manager (estadísticas). En el sitio estático build-static.js sobrescribe este archivo
// e inyecta GTM directamente en cada .html, así que aquí solo aplica al servidor web.
(function () {
  if (window.__gtmLoaded || /admin-online/.test(location.pathname)) return;
  window.__gtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-KMZP3379';
  (document.head || document.documentElement).appendChild(s);
})();
