'use strict';
// 🧭 EXPLORADOR (solo el muñeco del administrador, cuenta Lodam): SOLO pasea por las calles de la Tierra (el viaje automático en cohete está apagado; se activa con localStorage 'explorerTravel' = '1'). No abre paneles, no pulsa botones, no entra en casas, bares ni monumentos.
//   1. Cuando el administrador lleva 5 s sin tocar nada, su muñeco echa a andar solo por las calles de la Tierra (jugador.js → autoWalk) y pasea un buen rato.
//   2. Después viaja en cohete (el viaje de verdad, con rampa y despegue) al siguiente mundo de la lista (Luna, Marte, planetas, Prehistoria…), se queda un rato y vuelve a la Tierra.
//   3. En la Tierra vuelve a pasear y luego va al mundo siguiente, y así en bucle. Un mundo nuevo en mundos.js (window.worldIds()) entra solo.
// Botón 🧭 abajo a la izquierda: activar / parar. Si tocas algo, se pausa y vuelve a los 5 s de estar quieto.
// Consola: Explorer.start(), Explorer.stop(), Explorer.stops() (mundos que visitará).
(function () {
  const KEY = 'explorerOn', START_IDLE = 5000, RESUME_IDLE = 5000, WALK_DWELL = 60000, WORLD_DWELL = 14000;   // 5 s quieto → anda; 60 s paseando por la Tierra entre un viaje y otro
  const INTERRUPT = { interrupted: true };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let on = false, running = null, lastUser = Date.now(), btn = null;

  // Quién es el administrador: la cuenta Lodam (antes Redecora63) o el dispositivo abierto con #admin
  function isAdmin() {
    try {
      if (window.isAdminDoll) return window.isAdminDoll();
      if (localStorage.getItem('adminView') === '1' || location.hash === '#admin') return true;
      const n = String((window.atlasPlayerName && window.atlasPlayerName()) || '').trim().toLowerCase();
      return n === 'lodam' || n === 'redecora63';
    } catch (e) { return false; }
  }
  const toast = t => { try { if (typeof flashToast === 'function') flashToast(t); } catch (e) { /* nada */ } };
  const earthReady = () => !document.hidden && !document.body.classList.contains('en-mundo') && !document.body.classList.contains('viajando')
    && !(window.worldBusy && window.worldBusy());
  const sceneOpen = () => !!(document.getElementById('visita') || document.getElementById('edif'));

  // Lo que toca el jugador de verdad (no los clics que hace el explorador, que no son «de confianza»)
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(n => document.addEventListener(n, e => { if (e.isTrusted) lastUser = Date.now(); }, { capture: true, passive: true }));

  // ---------- Qué hace ----------
  let nextWorld = 0;
  const TRAVEL = (() => { try { return localStorage.getItem('explorerTravel') === '1'; } catch (e) { return false; } })();
  const worldList = () => (window.worldIds ? window.worldIds() : []).filter(i => i !== 'tierra');
  const onEarth = () => !window.worldNow || window.worldNow() === 'tierra';
  async function arrive(ctx, id) {   // viaja en cohete y espera a que acabe el viaje
    const t0 = Date.now();
    while (window.worldBusy && window.worldBusy() && Date.now() - t0 < 180000) await ctx.wait(500);
    window.travelTo(id);
    await ctx.wait(1500);
    while (Date.now() - t0 < 360000 && ((window.worldBusy && window.worldBusy()) || (window.worldNow && window.worldNow() !== id))) await ctx.wait(500);
  }
  async function walkEarth(ctx) {   // en la Tierra el muñeco anda solo por las calles (jugador.js) mientras nadie toca nada
    try { if (typeof gl !== 'undefined' && gl && gl.getZoom && gl.getZoom() < 15.5) gl.easeTo({ zoom: 16.5, duration: 1200 }); } catch (e) { /* nada */ }
    ctx.say('🚶 Paseando por el mundo');
    await ctx.wait(WALK_DWELL);
  }
  async function trip(ctx) {         // un viaje en cohete: va al siguiente mundo, se queda un rato y vuelve
    const ids = worldList();
    if (!ids.length || !window.travelTo) return;
    const id = ids[nextWorld++ % ids.length], name = (window.worldInfo && window.worldInfo(id).name) || id;
    ctx.say('🚀 Viajando a ' + name);
    await arrive(ctx, id);
    await ctx.wait(WORLD_DWELL);
    ctx.say('🌎 Volviendo a la Tierra');
    await arrive(ctx, 'tierra');
    await ctx.wait(3000);
  }
  function buildStops() { return worldList().map(id => ({ id: 'mundo:' + id, label: '🚀 ' + ((window.worldInfo && window.worldInfo(id).name) || id) })); }

  // ---------- El recorrido ----------
  function makeCtx(started) {
    const check = () => { if (!on || lastUser > started) throw INTERRUPT; };
    return {
      say: toast,
      async wait(ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { check(); await sleep(250); } check(); },
      async whileScene() { const t0 = Date.now(); while (sceneOpen() && Date.now() - t0 < 180000) { check(); await sleep(500); } }   // si entró en una casa, espera a que salga
    };
  }
  async function waitReady() {
    for (;;) {
      if (!on) throw INTERRUPT;
      const need = running && running.paused ? RESUME_IDLE : START_IDLE;
      if (Date.now() - lastUser >= need && !document.hidden && !sceneOpen() && !document.querySelector('.modal:not(.hidden)')) { if (running) running.paused = false; return; }
      await sleep(500);
    }
  }
  async function tour(token) {
    while (on && running === token) {
      try {
        await waitReady();                                   // 5 s sin tocar nada
        const ctx = makeCtx(Date.now());
        if (!earthReady() || !onEarth()) { await sleep(1000); continue; }   // solo pasea por la Tierra; si estás en otro mundo no te trae de vuelta
        await walkEarth(ctx);                                // pasea
        if (TRAVEL) await trip(ctx);                         // viaje en cohete automático: apagado (solo pasea). Para activarlo: localStorage.setItem('explorerTravel','1')
      } catch (e) {
        if (e === INTERRUPT) { token.paused = true; continue; }   // el jugador tocó algo: se pausa y sigue cuando lleve 5 s quieto
        console.warn('[explorador]', e); await sleep(3000);
      }
    }
  }
  function start() {
    if (running || !isAdmin()) return false;
    on = true; try { localStorage.setItem(KEY, '1'); } catch (e) { /* nada */ }
    const token = running = { paused: false };
    paint();
    tour(token).finally(() => { if (running === token) running = null; paint(); });
    return true;
  }
  function stop() {
    on = false; try { localStorage.setItem(KEY, '0'); } catch (e) { /* nada */ }
    running = null; paint();
  }
  function paint() {
    if (!btn) return;
    btn.style.display = isAdmin() ? '' : 'none';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.style.opacity = on ? '1' : '.6';
    btn.title = on ? 'Explorador: recorriendo el juego (toca para parar)' : 'Explorador: parado (toca para que recorra todo el juego)';
  }
  function mount() {
    btn = document.createElement('button');
    btn.id = 'explorer-btn'; btn.type = 'button'; btn.textContent = '🧭'; btn.setAttribute('data-notranslate', '');
    btn.style.cssText = 'position:fixed;left:calc(10px + env(safe-area-inset-left,0px));bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:1200;width:44px;height:44px;border-radius:14px;border:1px solid rgba(0,0,0,.15);background:#fffffff0;font-size:22px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;display:none';
    btn.onclick = () => { if (on) { stop(); toast('🧭 Explorador parado'); } else if (start()) toast('🧭 Explorador en marcha'); };
    document.body.appendChild(btn);
    paint();
    // Por defecto, el administrador lo tiene en marcha (salvo que lo haya parado él)
    setInterval(() => { paint(); let off = false; try { off = localStorage.getItem(KEY) === '0'; } catch (e) { /* nada */ } if (!running && !off && isAdmin() && document.body.classList.contains('en-mundo') === false) start(); }, 5000);
  }
  window.Explorer = {
    start, stop, running: () => !!running,
    register() { /* el explorador ya no visita sitios: solo pasea y viaja en cohete */ },
    stops: () => buildStops().map(s => s.label || s.id)
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
