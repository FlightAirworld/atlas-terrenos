'use strict';
// «Redes sociales» (en Extras): ventana con botones para compartir el juego por WhatsApp, Facebook, X, Telegram, etc.
// Instagram y TikTok no tienen enlace web para compartir: se copia el mensaje con el enlace y se abre la app.
(function () {
  const $ = id => document.getElementById(id);
  const anchor = $('share-app-btn');
  if (!anchor || !anchor.parentNode) return;

  const btn = document.createElement('button');
  btn.id = 'social-btn'; btn.type = 'button'; btn.dataset.label = 'Redes sociales';
  btn.title = 'Compartir por redes sociales'; btn.setAttribute('aria-label', 'Compartir por redes sociales'); btn.textContent = '📣';
  anchor.insertAdjacentElement('afterend', btn);

  // ⬇⬇ PON AQUÍ los enlaces a TUS perfiles. Las redes que dejes vacías ('') no aparecen en «Síguenos por…».
  const PERFILES = [
    { n: 'Facebook',  i: '📘', c: '#1877f2', h: 'https://www.facebook.com/share/1FUBb33jYR/' },   // ej. 'https://www.facebook.com/tuPagina'
    { n: 'Instagram', i: '📸', c: '#c13584', h: '' },   // ej. 'https://www.instagram.com/tuUsuario'
    { n: 'X (Twitter)', i: '✖️', c: '#111',  h: '' },   // ej. 'https://x.com/tuUsuario'
    { n: 'Pinterest', i: '📌', c: '#e60023', h: '' },   // ej. 'https://www.pinterest.com/tuUsuario'
    { n: 'TikTok',    i: '🎵', c: '#010101', h: 'https://www.tiktok.com/@redecoraelmundo' },   // ej. 'https://www.tiktok.com/@tuUsuario'
    { n: 'YouTube',   i: '▶️', c: '#ff0000', h: 'https://youtube.com/@redecoraelmundo' },   // ej. 'https://www.youtube.com/@tuCanal'
    { n: 'Telegram',  i: '✈️', c: '#229ed9', h: '' },   // ej. 'https://t.me/tuCanal'
    { n: 'WhatsApp',  i: '💬', c: '#25d366', h: '' },   // ej. 'https://whatsapp.com/channel/XXXX'
    { n: 'Discord',   i: '🎮', c: '#5865f2', h: '' },   // ej. 'https://discord.gg/XXXX'
  ].filter(x => x.h);

  const URL_ = location.origin + '/';
  const TEXT = '🌎 Reclama terrenos virtuales en el mapa del mundo y ponles tu nombre en Redecora El Mundo. ¡Es gratis!';
  const u = encodeURIComponent(URL_), t = encodeURIComponent(TEXT), tu = encodeURIComponent(TEXT + ' ' + URL_);
  const NETS = [
    { n: 'WhatsApp', i: '💬', c: '#25d366', h: 'https://wa.me/?text=' + tu },
    { n: 'Facebook', i: '📘', c: '#1877f2', h: 'https://www.facebook.com/sharer/sharer.php?u=' + u + '&quote=' + t },
    { n: 'X (Twitter)', i: '✖️', c: '#111', h: 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u },
    { n: 'Telegram', i: '✈️', c: '#229ed9', h: 'https://t.me/share/url?url=' + u + '&text=' + t },
    { n: 'Messenger', i: '🗨️', c: '#0084ff', h: 'https://www.facebook.com/dialog/send?link=' + u + '&redirect_uri=' + u },
    { n: 'LinkedIn', i: '💼', c: '#0a66c2', h: 'https://www.linkedin.com/sharing/share-offsite/?url=' + u },
    { n: 'Reddit', i: '👽', c: '#ff4500', h: 'https://www.reddit.com/submit?url=' + u + '&title=' + encodeURIComponent('Redecora El Mundo') },
    { n: 'Pinterest', i: '📌', c: '#e60023', h: 'https://pinterest.com/pin/create/button/?url=' + u + '&description=' + t },
    { n: 'SMS', i: '📱', c: '#34a853', h: 'sms:?&body=' + tu },
    { n: 'Email', i: '✉️', c: '#6b7280', h: 'mailto:?subject=' + encodeURIComponent('Redecora El Mundo') + '&body=' + tu },
    { n: 'Instagram', i: '📸', c: '#c13584', copy: 'https://www.instagram.com/' },
    { n: 'TikTok', i: '🎵', c: '#010101', copy: 'https://www.tiktok.com/' },
  ];

  const modal = document.createElement('div');
  modal.id = 'social'; modal.className = 'modal hidden';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'social-title');
  modal.innerHTML =
    '<div class="modal-card" style="max-height:92vh;overflow-y:auto">' +
      '<button id="social-close" class="close" type="button" aria-label="Cerrar">×</button>' +
      '<h2 id="social-title">📣 Compartir por…</h2>' +
      '<p class="muted">Cuéntaselo a tus amigos y que vengan a reclamar su terreno.</p>' +
      '<button id="social-native" class="primary hidden" type="button" style="width:100%;margin-bottom:10px">📤 Elegir app de mi móvil</button>' +
      '<div id="social-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>' +
      '<button id="social-copy" type="button" style="width:100%;margin-top:10px">🔗 Copiar enlace</button>' +
      '<button id="social-follow-btn" class="primary hidden" type="button" style="width:100%;margin-top:10px">➕ Síguenos por…</button>' +
      '<div id="social-follow" class="hidden"><h3 style="margin:14px 0 8px">➕ Síguenos por…</h3><div id="social-follow-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div></div>' +
      '<p id="social-msg" class="msg" aria-live="polite"></p>' +
    '</div>';
  document.body.appendChild(modal);
  const msg = $('social-msg'), say = (x, k = '') => { msg.textContent = x; msg.className = 'msg ' + k; };

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const a = document.createElement('textarea'); a.value = text; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} a.remove(); return ok;
    }
  }

  const grid = $('social-grid');
  function chip(s) {
    const b = document.createElement('button');
    b.type = 'button'; b.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px;border-radius:10px;border:1px solid var(--line);font-weight:700;text-align:left;cursor:pointer';
    const ic = document.createElement('span'); ic.textContent = s.i; ic.style.cssText = `width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:${s.c};font-size:16px;flex:none`;
    const lb = document.createElement('span'); lb.textContent = s.n;
    b.append(ic, lb);
    b.onclick = async () => {
      if (s.follow) { window.open(s.follow, '_blank', 'noopener'); return; }
      if (s.copy) {   // Instagram / TikTok: sin enlace de compartir, así que copiamos el mensaje y abrimos la red
        const ok = await copy(TEXT + ' ' + URL_);
        say(ok ? `✅ Mensaje copiado. Pégalo en ${s.n}.` : `Copia el enlace y pégalo en ${s.n}.`, ok ? 'ok' : '');
        setTimeout(() => window.open(s.copy, '_blank', 'noopener'), 600);
        return;
      }
      if (s.h.startsWith('http')) window.open(s.h, '_blank', 'noopener'); else location.href = s.h;
    };
    return b;
  }
  NETS.forEach(s => grid.appendChild(chip(s)));
  if (PERFILES.length) {
    PERFILES.forEach(s => $('social-follow-grid').appendChild(chip({ n: s.n, i: s.i, c: s.c, follow: s.h })));
    $('social-follow-btn').classList.remove('hidden');
    $('social-follow-btn').onclick = () => { $('social-follow').classList.remove('hidden'); $('social-follow-btn').classList.add('hidden'); $('social-follow').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  }

  if (navigator.share) $('social-native').classList.remove('hidden');
  $('social-native').onclick = async () => { try { await navigator.share({ title: 'Redecora El Mundo', text: TEXT, url: URL_ }); } catch (e) {} };
  $('social-copy').onclick = async () => say((await copy(URL_)) ? '🔗 Enlace copiado' : 'No se pudo copiar', 'ok');

  const close = () => modal.classList.add('hidden');
  btn.addEventListener('click', () => {
    say(''); modal.classList.remove('hidden');
    if (PERFILES.length) { $('social-follow').classList.add('hidden'); $('social-follow-btn').classList.remove('hidden'); }
    const w = $('extras-wrap'); if (w) w.classList.remove('open');
    const eb = $('extras-btn'); if (eb) eb.setAttribute('aria-expanded', 'false');
  });
  $('social-close').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
