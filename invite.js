'use strict';
// Invita y gana: enlace personal (?ref=CODIGO), ventana para compartirlo y alta del invitado.
// Usa lo que ya hay en app.js: authToken, api(), openLogin(), plural(), refreshCredits(), myNick.
(function () {
  const $id = id => document.getElementById(id);
  const btn = $id('invite-btn'), box = $id('invite');
  if (!btn || !box) return;

  function toast(text) {
    let t = $id('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 6000);
  }

  // 1) Llega con ?ref=CODIGO: se guarda ya (el login con Google recarga la página sin parámetros) y se limpia la dirección
  try {
    const u = new URL(location.href), r = u.searchParams.get('ref');
    if (r && /^[A-Za-z0-9]{5,12}$/.test(r)) {
      localStorage.setItem('refCode', r.toUpperCase());
      u.searchParams.delete('ref');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
      setTimeout(() => { if (typeof authToken === 'undefined' || !authToken) toast('🎁 Te han invitado: entra con tu cuenta y reclama tu primer terreno, ¡con regalo de bienvenida!'); }, 2500);
    }
  } catch (e) {}

  // 2) Al iniciar sesión (lo llama app.js tras vincular la cuenta): apunta de quién viene
  window.inviteAfterLink = async function () {
    let code = null;
    try { code = localStorage.getItem('refCode'); } catch (e) {}
    if (!code || !authToken) return;
    try {
      const r = await fetch('/api/ref/attach', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authToken }, body: JSON.stringify({ code }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        try { localStorage.removeItem('refCode'); } catch (e) {}
        if (j.bonus > 0) toast(`🎁 Te invitó un amigo: al reclamar tu primer terreno recibes +${j.bonus} ${plural(j.bonus, 'terreno', 'terrenos')} de regalo`);
      } else if (r.status !== 401 && r.status !== 429 && r.status < 500) {
        try { localStorage.removeItem('refCode'); } catch (e) {}      // código no válido, propio o ya usado: no se reintenta
      }
    } catch (e) {}
  };

  // 3) Ventana "Invita y gana"
  let linkUrl = '', shareText = '';
  const setMsg2 = (t, k = '') => { const m = $id('invite-msg'); m.textContent = t; m.className = 'msg ' + k; };
  async function openInvite() {
    if (!authToken) return openLogin('Entra para conseguir tu enlace de invitación 🎁');
    setMsg2(''); box.classList.remove('hidden');
    $id('invite-link').value = 'Cargando…'; $id('invite-stats').textContent = '';
    try {
      const j = await api('/api/ref', { method: 'GET' });
      linkUrl = `${location.origin}/?ref=${j.code}`;
      $id('invite-link').value = linkUrl;
      const a = j.inviterReward, b = j.inviteeReward;
      $id('invite-lead').textContent = `Por cada amigo nuevo que entre con tu enlace y reclame su primer terreno, tú ganas ${a} ${plural(a, 'terreno', 'terrenos')} y él recibe ${b} de regalo.`;
      shareText = `Te invito a Redecora El Mundo: reclama tu terreno en el mapa del mundo y ponle tu nombre. Si entras con mi enlace, ¡empiezas con ${b} ${plural(b, 'terreno', 'terrenos')} de regalo!`;
      const lines = [`👥 ${j.done} ${plural(j.done, 'amigo ya ha reclamado', 'amigos ya han reclamado')} su primer terreno`, `🎟️ Has ganado ${j.earned} ${plural(j.earned, 'terreno', 'terrenos')}`];
      if (j.pending) lines.push(`⏳ ${j.pending} ${plural(j.pending, 'amigo pendiente', 'amigos pendientes')} de reclamar el suyo`);
      if (j.done >= j.max) lines.push('Has llegado al máximo de invitaciones con premio.');
      $id('invite-stats').textContent = lines.join('\n');
      if (typeof refreshCredits === 'function') refreshCredits();   // por si ya has ganado créditos
    } catch (e) { $id('invite-link').value = ''; setMsg2(e.message, 'err'); }
  }
  btn.addEventListener('click', openInvite);
  $id('invite-close').addEventListener('click', () => box.classList.add('hidden'));
  box.addEventListener('click', e => { if (e.target === box) box.classList.add('hidden'); });

  $id('invite-copy').addEventListener('click', async () => {
    if (!linkUrl) return;
    try { await navigator.clipboard.writeText(linkUrl); setMsg2('🔗 Enlace copiado', 'ok'); }
    catch (e) { const i = $id('invite-link'); i.focus(); i.select(); setMsg2('Copia el enlace de la casilla', ''); }
  });
  $id('invite-share').addEventListener('click', async () => {
    if (!linkUrl) return;
    try { if (navigator.share) { await navigator.share({ title: 'Redecora El Mundo', text: shareText, url: linkUrl }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(shareText + ' ' + linkUrl); setMsg2('🔗 Mensaje y enlace copiados', 'ok'); }
    catch (e) { setMsg2(linkUrl); }
  });
})();
