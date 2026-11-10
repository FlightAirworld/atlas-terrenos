'use strict';
// Guía de las PRIMERAS PARCELAS GRATIS para el jugador anónimo (sin cuenta).
// Cuando acaba el tutorial (o se salta, o ya lo había visto), el juego:
//   1) le crea un pack de prueba con 2 parcelas gratis (POST /api/guest/start; el número lo fija GUEST_CREDITS en el servidor),
//   2) le lleva a un terreno libre — a su ubicación por GPS si da permiso, y si no a uno libre del mapa — y le dice «Crea tu primera parcela»,
//   3) le guía paso a paso: elegir casa y «Reclamar terreno», y después la segunda parcela cerca de la primera,
//   4) al gastar las parcelas gratis le lleva a crear su cuenta (Google o email) para guardarlas y seguir jugando.
// Al iniciar sesión, el servidor pasa el pack y las parcelas de prueba a la cuenta (ver linkAccount en server.js).
// Si el servidor no tiene las parcelas de prueba (GUEST_CREDITS=0) o ya se usaron desde esa conexión, solo le invita a crear cuenta.
// Para repetirlo en pruebas: localStorage.removeItem('fgDone'); localStorage.removeItem('fgCode'); localStorage.removeItem('fgClaims') y recargar
// (con un navegador sin sesión y sin packCode guardado).
(function () {
  const DONE = 'fgDone', CODE = 'fgCode', CLAIMS = 'fgClaims';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
  const T = s => (window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t(s) : s);
  const logged = () => { try { return !!authToken; } catch (e) { return false; } };
  const plural = (n, one, many) => (n === 1 ? one : many);
  const claims = () => Number(lsGet(CLAIMS) || 0);
  const ours = () => { try { return !!packCode && lsGet(CODE) === packCode; } catch (e) { return false; } };   // el pack de este navegador es el de prueba

  // app.js lo pregunta: ¿este jugador está usando un pack de prueba sin cuenta?
  window.firstGuide = { isGuest: () => !logged() && ours() };

  let box = null, stage = '', started = false, busy = false, lastClaim = null, shownKey = '';

  function eligible() {
    if (lsGet(DONE) === '1' || logged()) return false;
    if (typeof cfg === 'undefined' || !cfg || !(cfg.auth && cfg.auth.enabled)) return false;
    try { if (packCode && !ours()) return false; } catch (e) { return false; }   // pack de otro origen (VIP, regalo diario…): no se toca
    return true;
  }

  // ---------- Tarjeta de la guía ----------
  function ensureBox() {
    if (box) return;
    box = document.createElement('div');
    box.id = 'fg'; box.className = 'hidden'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    box.innerHTML = '<div class="fg-top"><span class="fg-badge"></span><span class="fg-dots" aria-hidden="true"></span></div>'
      + '<div class="fg-title" data-notranslate></div><div class="fg-text" data-notranslate></div>'
      + '<div class="fg-btns"><button type="button" class="fg-go"></button><button type="button" class="fg-x" aria-label="' + T('Cerrar guía') + '">✕</button></div>';
    document.body.appendChild(box);
    box.querySelector('.fg-x').onclick = () => { ssSet('fgHide', '1'); box.classList.add('hidden'); };
  }
  function total() { return (typeof cfg !== 'undefined' && cfg && cfg.guestCredits) || 2; }
  function paintDots() {
    if (!box) return;
    const d = box.querySelector('.fg-dots'), n = total(), c = Math.min(claims(), n);
    d.replaceChildren();
    for (let i = 0; i < n; i++) { const el = document.createElement('i'); if (i < c) el.className = 'on'; d.appendChild(el); }
  }
  // Pinta la tarjeta (solo si cambia algo, para no parpadear)
  function render(o) {
    ensureBox();
    const key = [o.badge, o.title, o.text, o.go, o.disabled ? 1 : 0].join('|');
    if (key === shownKey) { if (ssGet('fgHide') !== '1') box.classList.remove('hidden'); return; }
    shownKey = key;
    box.querySelector('.fg-badge').textContent = o.badge || '';
    box.querySelector('.fg-title').textContent = o.title;
    box.querySelector('.fg-text').textContent = o.text;
    const go = box.querySelector('.fg-go');
    go.textContent = o.go; go.disabled = !!o.disabled; go.onclick = o.fn || null;
    go.style.display = o.go ? '' : 'none';
    paintDots();
    ssSet('fgHide', '0');       // cada paso nuevo vuelve a mostrarse aunque la hayan cerrado antes
    box.classList.remove('hidden');
  }
  function hideBox() { if (box) box.classList.add('hidden'); shownKey = ''; }
  function toast(t) { try { if (typeof flashToast === 'function') flashToast(t); } catch (e) {} }
  const welcomeN = () => (typeof cfg !== 'undefined' && cfg && Number(cfg.welcomeCredits)) || 0;

  // ---------- Ir a un terreno libre ----------
  function getGps() {
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    });
  }
  // Busca el terreno libre más cercano a un punto, mirando anillos de parcelas alrededor (hasta 4 de radio)
  async function nearestFree(lat, lng) {
    const sz = cfg.size, cx = Math.floor((lng + 180) / sz), cy = Math.floor((lat + 90) / sz);
    for (let r = 0; r <= 4; r++) {
      const cells = [];
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) cells.push([dx, dy]);
      const res = await Promise.all(cells.map(([dx, dy]) => {
        const la = (cy + dy + 0.5) * sz - 90, ln = (cx + dx + 0.5) * sz - 180;
        return api('/api/parcel?lat=' + la + '&lng=' + ln, { method: 'GET' }).then(p => ({ p, la, ln, d: dx * dx + dy * dy }), () => null);
      }));
      const free = res.filter(o => o && o.p && !o.p.owner).sort((a, b) => a.d - b.d);
      if (free.length) return { lat: free[0].la, lng: free[0].ln };
    }
    return null;
  }
  // near: punto de partida (p. ej. la parcela que acaba de reclamar). Sin near: GPS y, si no hay, el centro del mapa.
  async function goToLot(near) {
    if (busy) return;
    busy = true; paintStage();
    try {
      let gps = null, base = near;
      if (!base) { gps = await getGps(); base = gps || map.getCenter(); }
      const lot = await nearestFree(base.lat, base.lng);
      if (!lot) { toast(T('No he encontrado un terreno libre cerca. Mueve el mapa y toca uno.')); return; }
      const ll = L.latLng(lot.lat, lot.lng), ms = gps ? 6500 : 3500;
      map.flyTo(ll, 18, { duration: ms });
      if (gps && window.skydive) window.skydive(ms, { target: 'map' });   // con GPS baja en paracaídas hasta el terreno
      await new Promise(done => { let d = false; const f = () => { if (!d) { d = true; done(); } }; map.once('moveend', f); setTimeout(f, ms + 4000); });
      await selectAt(ll);
    } catch (e) { /* si falla, la tarjeta sigue ofreciendo el botón */ }
    finally { busy = false; paintStage(); }
  }

  // ---------- Pasos ----------
  function paintStage() {
    if (stage !== 'first' && stage !== 'next') return;
    const n = total(), done = claims();
    const title = stage === 'first' ? '✨ ' + T('Crea tu primera parcela') : '✨ ' + `${T('Ahora tu parcela')} ${Math.min(done + 1, n)} ${T('de')} ${n}`;
    const badge = '🎁 ' + `${credits} ${plural(credits, T('parcela gratis'), T('parcelas gratis'))}`;
    if (busy) return render({ badge, title, text: '✈️ ' + T('Te llevo a un terreno libre…'), go: T('Volando…'), disabled: true });
    let panelOpen = false, free = false;
    try { panelOpen = !document.getElementById('panel').classList.contains('hidden'); free = panelOpen && selected && !selected.owner; } catch (e) {}
    if (free) render({ badge, title, text: T('Este terreno está libre y es tuyo gratis. Elige tu casa 🏠 (o deja el dado, que la elige por ti) y pulsa «Reclamar terreno».'),
      go: '⬇ ' + T('Ir al botón'), fn: () => { const b = document.getElementById('buy-parcel-btn'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
    else render({ badge, title, text: T('Toca una parcela libre del mapa para hacerla tuya, o te llevo yo a una.'),
      go: '📍 ' + T('Llévame a un terreno libre'), fn: () => goToLot(stage === 'next' ? lastClaim : null) });
  }
  function stageFirst() { stage = 'first'; shownKey = ''; paintStage(); goToLot(null); }
  function stageNext() {
    if (logged()) return;
    if (credits < 1) return stageLogin();
    stage = 'next'; shownKey = ''; paintStage();
    toast('🎉 ' + T('¡Primera parcela tuya! Vamos a por la siguiente.'));
    goToLot(lastClaim || null);
  }
  function loginMsg() { return T('Crea tu cuenta para guardar tus parcelas y seguir jugando 🎁'); }
  function stageLogin() {
    stage = 'login'; shownKey = '';
    const n = Math.max(claims(), 1), w = welcomeN();
    render({
      badge: '✅ ' + `${n} ${plural(n, T('parcela conseguida'), T('parcelas conseguidas'))}`,
      title: '🎉 ' + T('¡Ya eres propietario!'),
      text: T('Crea tu cuenta con Google o con tu email para guardar tus parcelas y seguir jugando.') + (w > 0 ? ' ' + `🎁 ${T('Te regalamos')} ${w} ${T('créditos de bienvenida')}.` : '') + ' ' + T('Sin cuenta podrías perderlas.'),
      go: '👤 ' + T('Crear mi cuenta'), fn: () => openLogin(loginMsg())
    });
    if (ssGet('fgLoginAuto') !== '1') {           // una vez por visita se abre solo, para que no se quede a medias
      ssSet('fgLoginAuto', '1');
      setTimeout(() => { if (stage === 'login' && !logged()) openLogin(loginMsg()); }, 1500);
    }
  }
  function stageNoGuest(msg) {
    stage = 'login'; shownKey = '';
    const w = welcomeN();
    render({
      badge: '🎁 ' + T('Empieza a jugar'), title: '👤 ' + T('Crea tu cuenta y empieza'),
      text: (msg ? msg + ' ' : '') + T('Entra con Google o con tu email para reclamar tu primer terreno.') + (w > 0 ? ' ' + `🎁 ${T('Te regalamos')} ${w} ${T('créditos de bienvenida')}.` : ''),
      go: '👤 ' + T('Entrar con Google o email'), fn: () => openLogin(T('Entra para reclamar tu primer terreno 🎁'))
    });
  }
  function stageWelcome(d) {
    stage = 'welcome'; shownKey = '';
    lsSet(DONE, '1');
    const a = Number((d && d.adopted) || claims()), c = Number((d && d.credits) || 0);
    render({
      badge: '✅ ' + T('Cuenta creada'), title: '🎉 ' + T('¡Todo guardado!'),
      text: (a > 0 ? (a === 1 ? T('Tu parcela ya es de tu cuenta.') : T('Tus parcelas ya son de tu cuenta.')) + ' ' : '') + (c > 0 ? `${T('Tienes')} ${c} ${plural(c, T('crédito'), T('créditos'))} 🎟️ ${T('para reclamar más terrenos.')}` : T('Sigue jugando y reclamando terrenos.')),
      go: '📍 ' + T('Buscar otra parcela'), fn: () => { stage = ''; hideBox(); goToLot(lastClaim || null); }
    });
    clearTimeout(stageWelcome.t); stageWelcome.t = setTimeout(() => { if (stage === 'welcome') { stage = ''; hideBox(); } }, 16000);
  }

  // ---------- Arranque ----------
  async function guestCall() {
    const r = await fetch('/api/guest/start', { method: 'POST', headers: packCode ? { Authorization: 'Bearer ' + packCode } : {} });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || T('No se han podido preparar tus parcelas gratis.'));
    return j;
  }
  async function start() {
    if (started || !eligible()) return;
    started = true;
    ensureBox();
    try { if (packCode) await refreshCredits(); } catch (e) {}                // si el pack de prueba ya no existe, se olvida
    if (logged()) return;
    if (ours()) {                                                             // vuelve a entrar: se retoma donde lo dejó
      if (credits < 1) return stageLogin();
      return claims() > 0 ? stageNext() : stageFirst();
    }
    render({ badge: '🎁 ' + T('Parcelas gratis'), title: '✨ ' + T('Preparando tus parcelas…'), text: T('Un momento, te regalo tus primeras parcelas.'), go: '', disabled: true });
    try {
      const j = await guestCall();
      if (!j.guest) { hideBox(); return; }                                    // ya tenía un pack que no es de prueba: no se toca
      saveCode(j.code); lsSet(CODE, j.code); credits = j.credits; updateCreditUi();
      if (credits < 1) return stageLogin();
      stageFirst();
    } catch (e) { stageNoGuest(e.message); }
  }

  document.addEventListener('parcel:claimed', e => {
    if (!window.firstGuide.isGuest()) return;
    lastClaim = { lat: e.detail.lat, lng: e.detail.lng };
    lsSet(CLAIMS, String(claims() + 1));
    paintDots();
    // Un respiro para que se vea la celebración (confeti y cámara a la casa) antes del siguiente paso
    if (e.detail.credits > 0) setTimeout(stageNext, 4000); else setTimeout(stageLogin, 5000);
  });
  document.addEventListener('account:linked', e => {
    // Cuenta creada o iniciada: si venía de las parcelas de prueba (también tras volver de Google por redirección), se felicita y se sigue guiando
    if (lsGet(DONE) !== '1' && (started || claims() > 0)) stageWelcome(e.detail);
  });

  // Mantiene la tarjeta al día y se aparta cuando hay una ventana abierta
  setInterval(() => {
    if (!box) return;
    if (logged() && stage !== 'welcome') { if (stage) { stage = ''; hideBox(); } if (claims() === 0) lsSet(DONE, '1'); return; }
    const modal = !!document.querySelector('.modal:not(.hidden), #login:not(.hidden)'), w = document.getElementById('welcome');
    if (modal || document.body.classList.contains('tut-on') || (w && !w.classList.contains('hidden'))) { box.style.visibility = 'hidden'; return; }
    box.style.visibility = '';
    if (stage === 'first' || stage === 'next') {
      if (typeof credits !== 'undefined' && credits < 1 && claims() > 0) return;   // el paso siguiente lo decide el evento de reclamar
      paintStage();
    }
  }, 700);

  // Espera a que el juego esté listo y el tutorial haya acabado (o no vaya a salir)
  document.addEventListener('tutorial:end', () => setTimeout(start, 900));
  let closedAt = 0;
  const wait = setInterval(() => {
    if (started || logged() || lsGet(DONE) === '1') { clearInterval(wait); return; }
    if (typeof cfg === 'undefined' || !cfg || typeof map === 'undefined') return;
    const intro = document.getElementById('intro');
    if (window.coverOpen || (intro && !intro.classList.contains('hidden'))) { closedAt = 0; return; }   // la portada sigue abierta
    if (!closedAt) closedAt = Date.now();
    if (document.body.classList.contains('tut-on')) return;                                             // el tutorial está en marcha
    if (lsGet('tutorialDone') !== '1' && Date.now() - closedAt < 30000) return;                         // el tutorial está a punto de empezar
    clearInterval(wait);
    start();
  }, 500);
})();
