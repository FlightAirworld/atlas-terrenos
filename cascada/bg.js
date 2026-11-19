/* Cascada · juego en segundo plano fuera de la pantalla de Cascada.
 * Se carga en la página principal (lo añade cascada-wire.js). Si el modo AUTOMÁTICO o una COMPRA de partidas siguen activos,
 * continúa jugando aquí (sin dibujos) y deja el resumen en localStorage para que Cascada lo enseñe al volver.
 * Los «tres cofres» que salgan aquí quedan guardados en el servidor y se juegan al volver a Cascada. */
(() => {
  'use strict';
  if (/^\/cascada(\/|$)/.test(location.pathname)) return;   // dentro de Cascada manda game.js
  const KEY = 'cascada.v2', AWK = 'cascada.aw', LK = 'cascada.lock', STEP = 3000;
  const me = Math.random().toString(36).slice(2);
  const rd = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio */ } };
  const mine = () => {   // un solo ejecutor a la vez (otra pestaña o la propia pantalla de Cascada)
    const l = rd(LK), now = Date.now();
    if (l && l.id !== me && now - l.t < 15000) return false;
    wr(LK, { id: me, t: now }); return true;
  };
  const session = () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!/^sb-.+-auth-token$/.test(k)) continue;
        const j = JSON.parse(localStorage.getItem(k)), s = j && (j.currentSession || j);
        if (s && s.access_token) return { k, j, s };
      }
    } catch (e) { /* sin sesión */ }
    return null;
  };
  const refresh = async (ss) => {
    try {
      const cfg = await (await fetch('/api/config')).json(), a = cfg && cfg.auth;
      if (!a || !a.url || !a.anonKey || !ss.s.refresh_token) return null;
      const r = await fetch(a.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: a.anonKey }, body: JSON.stringify({ refresh_token: ss.s.refresh_token }) });
      if (!r.ok) return null;
      const n = await r.json(); if (!n.access_token) return null;
      const merged = Object.assign({}, ss.s, n);
      localStorage.setItem(ss.k, JSON.stringify(ss.j.currentSession ? Object.assign({}, ss.j, { currentSession: merged }) : merged));
      return n.access_token;
    } catch (e) { return null; }
  };
  const post = async (body, tok) => {
    const r = await fetch('/api/cascada/play', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': tok }, body: JSON.stringify(body) });
    return { r, j: await r.json().catch(() => ({})) };
  };
  const play = async (n, m) => {
    const ss = session(); if (!ss) throw new Error('login');
    let { r, j } = await post({ n, m }, ss.s.access_token);
    if (r.status === 401) { const t = await refresh(ss); if (!t) throw new Error('login'); ({ r, j } = await post({ n, m }, t)); }
    if (!r.ok) { const e = new Error(j.error || 'error'); e.status = r.status; throw e; }
    return j;
  };

  const newAW = () => ({ plays: 0, won: 0, wins: 0, best: 0, botes: [], bulks: [], noCredits: false, bonus: 0 });
  const tally = (AW, r) => {
    AW.plays++; AW.won += r.prize; if (r.prize) AW.wins++; if (r.prize > AW.best) AW.best = r.prize;
    if (r.tier) AW.botes.push({ tier: r.tier, prize: r.prize });
    if (r.bonusId) AW.bonus++;
  };

  let busy = false;
  const tick = async () => {
    if (busy) return;
    const S = rd(KEY);
    if (!S || !(S.auto || (S.bulk && S.bulk.left > 0))) return;
    if (!mine()) return;
    busy = true;
    try {
      const AW = Object.assign(newAW(), rd(AWK) || {});
      if (S.bulk && S.bulk.left > 0 && S.bulk.queue && S.bulk.queue.length) {
        const r = S.bulk.queue.shift(); S.bulk.left--; S.bulk.done++; S.bulk.won += r.prize;
        tally(AW, r);
        if (S.bulk.left === 0) { AW.bulks.push({ total: S.bulk.total, won: S.bulk.won }); S.bulk = { left: 0, total: 0, done: 0, won: 0, queue: [] }; }
      } else if (S.auto) {
        const m = Math.min(50, Math.max(1, Math.floor(S.mult) || 1));
        try {
          const j = await play(1, m);
          tally(AW, j.results[0]);
          if (j.credits - j.results[0].prize < m) { S.auto = false; AW.noCredits = true; }   // no queda saldo para otra partida
        } catch (e) {
          S.auto = false; if (e.status === 402) AW.noCredits = true;
        }
      } else { S.bulk = { left: 0, total: 0, done: 0, won: 0, queue: [] }; }
      S.tick = Date.now();
      wr(AWK, AW); wr(KEY, S);
    } finally { busy = false; }
  };
  setInterval(tick, STEP);
  setTimeout(tick, 800);
})();
