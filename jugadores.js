'use strict';
// JUGADORES EN LÍNEA EN EL MAPA: los demás jugadores conectados se ven como muñecos (con su apodo y su bandera) caminando por el mapa de la Tierra,
// en el sitio del juego donde están. Cuando dos muñecos se encuentran (también el tuyo), se saludan y charlan solos con globos de texto.
//   - Cada ~4 s se avisa al servidor de por dónde estás (POST /api/online/pos: solo el centro del mapa del juego, nunca la ubicación real) y se reciben
//     los demás jugadores REALES conectados que caen dentro de tu pantalla.
//   - Solo a nivel de barrio/calle (zoom ≥ 14) y en la Tierra. Al alejar el mapa, entrar en una casa o viajar, dejas de enviarte y de verlos.
//   - Quien no ha iniciado sesión aparece como «Visitante» con la bandera de su país.
//   - Las charlas no se envían: cada navegador las genera, pero con la misma semilla (los dos identificadores públicos + el minuto), así que los DOS jugadores que se encuentran
//     ven la misma conversación a la vez, con el mismo que habla primero.
(function () {
  const POLL = 4000, MIN_ZOOM = 14, MEET_PX = 110, COOLDOWN = 60000, LINE_MS = 3000;
  const API = window.API_BASE || '';
  let cid = null;
  try { cid = localStorage.getItem('onlineCid'); } catch (e) {}
  if (!cid || !/^[\w-]{8,40}$/.test(cid)) return;   // online.js lo crea al arrancar; sin él no hay identificador

  const st = document.createElement('style');
  st.textContent = `
    .pw.ot { left: 0; top: 0; margin: 0; z-index: 2; animation: none;   /* la animación de entrada de .pw deja el transform fijo y taparía el movimiento */ transition: opacity .35s; will-change: transform; }
    .pw .nm { position: absolute; left: 50%; top: 100%; margin-top: 5px; transform: translateX(-50%); white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis;
      font: 700 11px/1 system-ui, sans-serif; color: #fff; background: rgba(0,0,0,.55); border-radius: 99px; padding: 3px 7px; pointer-events: none; }
    .pw .say { position: absolute; left: 50%; bottom: 100%; margin-bottom: 8px; transform: translateX(-50%) scale(.6); transform-origin: 50% 100%; opacity: 0; width: max-content; max-width: 170px; text-align: center;
      background: #fff; color: #16211c; border-radius: 14px; padding: 7px 10px; font: 700 13px/1.2 system-ui, sans-serif; box-shadow: 0 3px 10px rgba(0,0,0,.35); pointer-events: none; z-index: 5; transition: opacity .2s, transform .2s; }
    .pw .say::after { content: ''; position: absolute; left: 50%; top: 100%; margin-left: -6px; border: 6px solid transparent; border-top-color: #fff; }
    .pw.talking .say { opacity: 1; transform: translateX(-50%) scale(1); }
    .pw.talking { z-index: 6; }
    .pw.ot .face, .pw.ot .lg { transition: none; }`;
  document.head.appendChild(st);

  // ---------- Charlas (nombres: {a} habla primero, {b} contesta) ----------
  const TALKS = [
    ['Hola {b}, ¿cómo estás?', '¡Hola {a}! Muy bien, ¿y tú?', 'Genial, dando un paseo por el barrio.', '¡Qué bonito está esto! Hasta luego 👋'],
    ['¡Mira, {b}! Por fin alguien por aquí.', '¡Ey, {a}! Justo iba a comprar una parcela.', '¿Cerca de aquí? ¡Elige una con buenas vistas!', 'Hecho. ¡Nos vemos por el mapa!'],
    ['Buenas, {b}. ¿Qué tal van tus terrenos?', 'Bien, {a}. Ya cobro créditos cada hora 💰', '¡Yo también! ¿Has subido de nivel alguno?', 'Uno a nivel 3. ¡A por el 5! ⭐'],
    ['¡Hola, {b}! Qué gusto encontrarte.', '¡{a}! Hacía tiempo que no te veía.', 'He estado decorando mi casa.', 'Pues me paso a verla. ¡Hasta ahora!'],
    ['{b}, ¿sabes dónde está el tren?', 'Creo que por allí, {a}, lo he oído pasar 🚆', '¡Gracias! Voy a verlo.', 'De nada. ¡Buen viaje!'],
    ['Oye {b}, ¿ya has visto las rotondas con fuentes?', 'Sí, {a}, ¡me encantan!', 'Yo me hice una foto al lado de una 📸', 'Jajaja, yo también. ¡Qué buen sitio!'],
    ['¡Hola {b}! ¿De dónde vienes?', 'De dar la vuelta al mundo, {a} 🌎', '¡Qué suerte! Yo aún estoy explorando esta zona.', 'Pues disfruta, ¡es un barrio muy agradable!'],
    ['¡Buenas, {b}! ¿Tú también juegas cada día?', 'Claro, {a}, por la racha 🔥', 'Yo llevo varios días seguidos.', '¡Así se hace! No la pierdas.'],
    ['{b}, ¡qué casa más chula tienes cerca!', 'Gracias, {a}. La elegí con mucho cariño 🏡', 'Se nota. ¡Enhorabuena!', '¡Igualmente! Hasta pronto.'],
    ['Hola {b}. ¿Me recomiendas algún sitio para comprar?', 'Cerca del parque, {a}. Se está llenando.', 'Buena idea, voy para allá.', '¡Suerte! Y guárdame un hueco al lado 😄']
  ];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- Muñecos de los demás ----------
  const others = new Map();   // id -> { el, from, to, t0, shown:{lng,lat}, name, busy }
  let myId = '';
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  let polling = false, hiddenSent = false, lastTalk = new Map(), meetingTimer = 0, frame = 0;

  const myName = () => { let n = ''; try { n = (window.atlasPlayerName ? window.atlasPlayerName() : '') || ''; } catch (e) {} return String(n).trim() || 'amigo'; };
  const mapOk = () => typeof gl !== 'undefined' && gl && gl.getContainer && !document.body.classList.contains('en-mundo') && !document.body.classList.contains('viajando') && !document.hidden;
  const atStreetLevel = () => { try { return gl.getZoom() >= MIN_ZOOM; } catch (e) { return false; } };

  function make(p) {
    const name = p.nick || ('Visitante' + (p.cc ? ' ' + window.flagOf(p.cc) : ''));
    const look = window.playerLookFor(p.nick || ('v' + p.id));
    const el = document.createElement('div');
    el.className = 'pw ot'; el.setAttribute('data-notranslate', '');
    el.innerHTML = '<i class="pw-sh"></i>' + window.playerSVG({ look, flag: window.flagOf(p.cc) }) + '<div class="nm"></div><div class="say"></div>';
    el.querySelector('.nm').textContent = name;
    gl.getContainer().appendChild(el);
    return { el, from: { lng: p.lng, lat: p.lat }, to: { lng: p.lng, lat: p.lat }, t0: performance.now(), shown: { lng: p.lng, lat: p.lat }, name, busy: false, last: null };
  }
  function clearAll() { others.forEach(o => o.el.remove()); others.clear(); }

  async function poll() {
    if (polling) return;
    polling = true;
    try {
      if (!mapOk() || !atStreetLevel() || !window.playerLookFor || !window.playerSVG) {
        if (!hiddenSent && typeof gl !== 'undefined' && gl) { hiddenSent = true; fetch(API + '/api/online/pos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cid, hide: true }) }).catch(() => {}); }
        clearAll(); return;
      }
      hiddenSent = false;
      const c = gl.getCenter(), b = gl.getBounds();
      const headers = Object.assign({ 'Content-Type': 'application/json' }, typeof authHeaders === 'function' ? authHeaders() : {});
      const r = await fetch(API + '/api/online/pos', { method: 'POST', headers, body: JSON.stringify({ cid, lng: c.lng, lat: c.lat, bbox: { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() } }) });
      if (!r.ok) return;
      const j = await r.json(), seen = new Set(), now = performance.now();
      if (j.me) myId = j.me;
      (j.players || []).forEach(p => {
        seen.add(p.id);
        let o = others.get(p.id);
        if (!o) { o = make(p); others.set(p.id, o); }
        else {
          if (Math.abs(p.lng - o.to.lng) > 1e-9 || Math.abs(p.lat - o.to.lat) > 1e-9) { o.from = { lng: o.shown.lng, lat: o.shown.lat }; o.to = { lng: p.lng, lat: p.lat }; o.t0 = now; }
          if (p.nick && o.name !== p.nick) { o.name = p.nick; o.el.querySelector('.nm').textContent = p.nick; }
        }
      });
      others.forEach((o, id) => { if (!seen.has(id)) { o.el.remove(); others.delete(id); } });   // se ha ido o salió de tu pantalla
      startFrames();
    } catch (e) { /* sin conexión: se reintenta */ } finally { polling = false; }
  }

  // ---------- Movimiento y encuentros ----------
  function startFrames() { if (!frame) frame = requestAnimationFrame(tick); }
  function tick() {
    frame = 0;
    if (!others.size || !mapOk()) return;
    const now = performance.now(), W = gl.getContainer().clientWidth, H = gl.getContainer().clientHeight, pts = [];
    others.forEach((o, id) => {
      const k = Math.min(1, (now - o.t0) / POLL), e = k * (2 - k);   // camina hasta donde el jugador está ahora, frenando al llegar
      o.shown = { lng: o.from.lng + (o.to.lng - o.from.lng) * e, lat: o.from.lat + (o.to.lat - o.from.lat) * e };
      const p = gl.project([o.shown.lng, o.shown.lat]);
      o.el.style.transform = `translate(${p.x - 21 + (o.offX || 0)}px, ${p.y - 71}px)`;   // offX: al charlar se ponen uno al lado del otro
      const moving = k < 1 && (Math.abs(o.to.lng - o.from.lng) > 1e-9 || Math.abs(o.to.lat - o.from.lat) > 1e-9);
      if (moving) { const px = gl.project([o.to.lng, o.to.lat]).x - gl.project([o.from.lng, o.from.lat]).x; if (Math.abs(px) > 0.5) o.el.classList.toggle('left', px < 0); }
      if (!o.busy) o.el.classList.toggle('walking', moving);
      pts.push({ id, x: p.x, y: p.y, o });
    });
    const me = window.playerWalker && window.playerWalker.el && window.playerWalker.el();
    if (me && me.isConnected) pts.push({ id: myId || 'me', x: W / 2, y: H / 2, o: { el: me, name: myName(), busy: !!me._busy, mine: true } });
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      let a = pts[i], b = pts[j];
      if (a.id === 'me' || b.id === 'me') continue;   // aún no sé mi identificador público: espero a la siguiente respuesta
      if (a.id > b.id) [a, b] = [b, a];                // el de identificador menor habla primero, igual en los dos navegadores
      if (a.o.busy || b.o.busy) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > MEET_PX) continue;
      const key = [a.id, b.id].sort().join('|'), last = lastTalk.get(key) || 0;
      if (Date.now() - last < COOLDOWN) continue;
      lastTalk.set(key, Date.now());
      if (lastTalk.size > 200) lastTalk.clear();
      talk(a, b, TALKS[hash(key + ':' + Math.floor(Date.now() / COOLDOWN)) % TALKS.length]);   // misma semilla = misma charla en los dos móviles
    }
    frame = requestAnimationFrame(tick);
  }

  // Dos muñecos se miran y se van contestando con globos de texto
  async function talk(a, b, script) {
    const A = a.o, B = b.o;
    const set = (o, v) => { o.busy = v; if (o.mine) o.el._busy = v; };
    set(A, true); set(B, true);
    A.el.classList.remove('walking'); B.el.classList.remove('walking');
    A.el.classList.toggle('left', b.x < a.x); B.el.classList.toggle('left', a.x < b.x);   // se miran
    const mover = A.mine ? B : A, fixed = A.mine ? a : b, mv = A.mine ? b : a;   // si están casi encima, el de otro jugador se aparta para que se vean los dos
    if (Math.hypot(a.x - b.x, a.y - b.y) < 56) mover.offX = (mv.x >= fixed.x ? 1 : -1) * 56;
    try { if (window.sfx) window.sfx('pop'); } catch (e) {}
    try {
      for (let i = 0; i < script.length; i++) {
        const who = i % 2 ? B : A, other = i % 2 ? A : B;
        const bub = who.el.querySelector('.say'); if (!bub || !who.el.isConnected) break;
        bub.textContent = script[i].replace(/\{a\}/g, A.name).replace(/\{b\}/g, B.name);
        who.el.classList.add('talking'); other.el.classList.remove('talking');
        await wait(LINE_MS);
        who.el.classList.remove('talking');
        await wait(250);
      }
    } finally {
      A.el.classList.remove('talking'); B.el.classList.remove('talking');
      A.offX = 0; B.offX = 0; set(A, false); set(B, false);
    }
  }

  // ---------- Arranque ----------
  setInterval(poll, POLL);
  setTimeout(poll, 3000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearAll(); } else poll(); });
  addEventListener('pagehide', () => { try { navigator.sendBeacon(API + '/api/online/pos', new Blob([JSON.stringify({ cid, hide: true })], { type: 'application/json' })); } catch (e) {} });
})();
