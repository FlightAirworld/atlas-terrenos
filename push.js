'use strict';
// Avisos al móvil (notificaciones push): botón 🔔 en el menú y una pregunta amable la primera vez.
// El servidor (server.js, "Avisos al móvil") avisa de: racha en peligro, producción lista o a punto de llenarse y regalo diario.
// Usa lo que ya hay en app.js: cfg, authToken, api(), prodState, dailyState, plural().
(function () {
  const btn = document.getElementById('push-btn');
  if (!btn || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } };
  const supported = () => typeof cfg !== 'undefined' && cfg && cfg.push && cfg.push.key;

  function toast(text) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 6000);
  }

  // Apunta este móvil en el servidor (también reactiva los avisos cada vez que el jugador vuelve a entrar)
  async function register(sub) {
    await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON(), tz: tz() } });
  }
  async function getSub() { const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }

  async function enable() {
    if (typeof authToken === 'undefined' || !authToken) return openLogin('Entra para recibir avisos 🔔');
    if (!supported()) return toast('Los avisos no están disponibles ahora mismo.');
    if (Notification.permission === 'denied') return toast('Tienes los avisos bloqueados. Actívalos en los ajustes del navegador para este sitio.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return refresh();
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.push.key) });
      await register(sub);
      lsSet('pushOn', '1');
      toast('🔔 ¡Listo! Te avisaremos cuando tu racha corra peligro o tengas créditos por recoger.');
    } catch (e) { toast('No se pudieron activar los avisos: ' + (e && e.message || 'inténtalo de nuevo')); }
    refresh();
  }
  async function disable() {
    try {
      const sub = await getSub();
      if (sub) { try { await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }); } catch {} await sub.unsubscribe(); }
    } catch {}
    lsSet('pushOn', '0');
    toast('🔕 Avisos desactivados.');
    refresh();
  }

  let on = false;
  async function refresh() {
    let sub = null; try { sub = await getSub(); } catch {}
    on = !!sub && Notification.permission === 'granted' && lsGet('pushOn') !== '0';
    btn.textContent = on ? '🔔' : '🔕';
    btn.title = on ? 'Avisos activados (toca para desactivar)' : 'Activar avisos';
    btn.setAttribute('aria-label', btn.title);
    btn.dataset.label = on ? 'Avisos: sí' : 'Avisos: no';
    ask.classList.add('hidden');
  }
  btn.addEventListener('click', () => (on ? disable() : enable()));

  // Pregunta amable (una vez): cuando ya tiene algo que perder (un terreno o una racha)
  const ask = document.createElement('div');
  ask.id = 'push-ask'; ask.className = 'hidden'; ask.setAttribute('role', 'dialog'); ask.setAttribute('aria-label', 'Activar avisos');
  ask.innerHTML = '<div class="pa-text">🔔 ¿Te avisamos cuando tu <b>racha</b> corra peligro o tengas <b>créditos</b> por recoger?</div><div class="pa-btns"><button type="button" class="pa-yes">Sí, avisadme</button><button type="button" class="pa-no">Ahora no</button></div>';
  document.body.appendChild(ask);
  ask.querySelector('.pa-yes').onclick = () => { lsSet('pushAsked', '1'); ask.classList.add('hidden'); enable(); };
  ask.querySelector('.pa-no').onclick = () => { lsSet('pushAsked', '1'); ask.classList.add('hidden'); };

  let registered = false, tries = 0;
  async function tick() {
    const logged = typeof authToken !== 'undefined' && !!authToken;
    btn.classList.toggle('hidden', !(logged && supported()));
    if (!logged || !supported()) { registered = false; ask.classList.add('hidden'); return; }
    if (!registered) {
      registered = true; await refresh();
      // Ya tenía avisos activados: se renueva el registro para que no se pausen
      try { const sub = await getSub(); if (sub && Notification.permission === 'granted' && lsGet('pushOn') !== '0') await register(sub); } catch {}
    }
    const hasStake = (typeof prodState !== 'undefined' && prodState && prodState.parcels > 0) || (typeof dailyState !== 'undefined' && dailyState && dailyState.streak > 0);
    const coach = document.getElementById('coach'), coachOn = coach && !coach.classList.contains('hidden');
    const modalOpen = document.querySelector('.modal:not(.hidden)') || !document.getElementById('panel').classList.contains('hidden');
    const show = hasStake && !on && lsGet('pushAsked') !== '1' && Notification.permission === 'default' && !coachOn && !modalOpen;
    ask.classList.toggle('hidden', !show);
  }
  setInterval(tick, 2000);
})();
