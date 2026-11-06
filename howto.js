'use strict';
// "Cómo jugar" / "How to play": ventana de ayuda (botón 📖 dentro de Extras y enlace en la portada) en español e inglés.
(function () {
  const btn = document.getElementById('howto-btn');
  const st = document.createElement('style');
  st.textContent = `
    #howto { z-index: 5300; }
    #howto .modal-card { max-height: min(86vh, 640px); overflow-y: auto; }
    #howto h3 { margin: 16px 0 4px; font-size: 16px; }
    #howto p, #howto li { font-size: 14px; line-height: 1.45; margin: 4px 0; }
    #howto ul { padding-left: 20px; margin: 4px 0; }
    #howto .tip { background: rgba(8,127,91,.12); border-radius: 10px; padding: 8px 10px; margin: 10px 0; }
    #howto .langs { display: flex; gap: 6px; margin: 0 0 8px; }
    #howto .langs button { border: 1px solid #087f5b; background: transparent; color: inherit; border-radius: 99px; padding: 4px 12px; font-size: 13px; font-weight: 700; cursor: pointer; }
    #howto .langs button.on { background: #087f5b; color: #fff; }`;
  document.head.appendChild(st);

  const T = {
    es: {
      title: '📖 Cómo jugar', close: 'Cerrar', ok: '¡A jugar!',
      body: `<h3>1. Reclama tu primer terreno</h3>
      <ul>
        <li>Mueve y acerca el mapa (📍 te lleva a tu ubicación y 🔍 busca cualquier lugar).</li>
        <li>Toca una parcela libre y pulsa <b>Reclamar este terreno</b>. Cuesta créditos 🎟️.</li>
        <li>Elige la casa que quieras al reclamarla (es gratis). Cada parcela es única: <b>una vez comprada, nadie más puede quitártela ni comprarla</b>.</li>
        <li>Para guardar tus terrenos y tu racha, entra con tu cuenta (Google o email).</li>
      </ul>

      <h3>2. Consigue créditos 🎟️</h3>
      <ul>
        <li><b>🎁 Regalo diario:</b> entra cada día. Cuantos más días seguidos, más premio; el día 7 es el grande y luego la racha vuelve a empezar.</li>
        <li><b>🎡 Ruleta diaria:</b> un giro gratis al día (hay que haber iniciado sesión).</li>
        <li><b>👫 Invita y gana:</b> comparte tu enlace; tú y tu amigo recibís créditos.</li>
        <li><b>Producción:</b> cada terreno genera créditos solo, hora a hora.</li>
        <li><b>Comprar créditos</b> (🎟️ en tu píldora de arriba) con tarjeta, Google Pay o PayPal.</li>
      </ul>

      <h3>3. Produce y mejora</h3>
      <ul>
        <li>Abre <b>🏠 Mis terrenos</b> y pulsa <b>Recoger créditos</b>. Se acumulan hasta un máximo de horas sin recoger (por defecto 24), así que pasa a recogerlos al menos una vez al día.</li>
        <li>Toca uno de tus terrenos para <b>subirlo de nivel</b>: produce más y la casa crece y gana estrellas ⭐.</li>
        <li>También puedes <b>cambiar la casa</b> cuando quieras (cuesta 1 crédito por defecto).</li>
      </ul>

      <h3>4. Compite y habla</h3>
      <ul>
        <li><b>🏆 Ranking:</b> mira quién tiene más terrenos.</li>
        <li><b>💬 Chat</b> de la zona donde estás mirando.</li>
        <li>El contador <b>en línea</b> muestra los jugadores conectados.</li>
        <li><b>🔔 Avisos</b> te mandan avisos al móvil, si los activas.</li>
      </ul>

      <h3>5. Un mapa con vida</h3>
      <p>Acércate a las calles y verás coches, peatones, trenes, aviones, helicópteros, semáforos, animales, lluvia, día y noche. Con el botón <b>🏙️ Vida urbana</b> del menú activas además obras, bodas, desfiles, humo, colas en las tiendas y más. Si tu móvil va justo, apágalo desde ahí o desde los botones del menú.</p>`,
      tip: `<div class="tip"><b>Consejos:</b> entra cada día (regalo + ruleta), recoge tus créditos antes de dormir, compra terrenos en lugares con significado para ti (tu calle, tu pueblo) y sube de nivel los que ya tienes antes de comprar muchos nuevos.</div>`
    },
    en: {
      title: '📖 How to play', close: 'Close', ok: "Let's play!",
      body: `
      <p><b>Redecora El Mundo</b> ("Redecorate the World") is a map of the planet divided into virtual plots of about 111 m. Claim the ones you like, put your name and a house on them, and let them earn credits so you can get more.</p>

      <h3>1. Claim your first plot</h3>
      <ul>
        <li>Move and zoom the map (📍 takes you to your location and 🔍 searches any place).</li>
        <li>Tap a free plot and press <b>Reclamar este terreno</b> (Claim this plot). It costs credits 🎟️.</li>
        <li>Pick the house you want when you claim it (it's free). Every plot is unique: <b>once bought, nobody else can take it or buy it</b>.</li>
        <li>To save your plots and your streak, sign in with your account (Google or email).</li>
      </ul>

      <h3>2. Earn credits 🎟️</h3>
      <ul>
        <li><b>🎁 Daily gift:</b> come back every day. The more days in a row, the bigger the prize; day 7 is the big one, then the streak starts over.</li>
        <li><b>🎡 Daily wheel:</b> one free spin per day (you need to be signed in).</li>
        <li><b>👫 Invite and earn:</b> share your link; you and your friend both get credits.</li>
        <li><b>Production:</b> each plot earns credits by itself, hour by hour.</li>
        <li><b>Buy credits</b> (🎟️ in the pill at the top) with card, Google Pay or PayPal.</li>
      </ul>

      <h3>3. Produce and upgrade</h3>
      <ul>
        <li>Open <b>🏠 Mis terrenos</b> (My plots) and press <b>Recoger créditos</b> (Collect credits). They pile up to a maximum number of hours (24 by default), so collect at least once a day.</li>
        <li>Tap one of your plots to <b>level it up</b>: it earns more, and the house grows and gets stars ⭐.</li>
        <li>You can also <b>change the house</b> any time (costs 1 credit by default).</li>
      </ul>

      <h3>4. Compete and chat</h3>
      <ul>
        <li><b>🏆 Ranking:</b> see who owns the most plots.</li>
        <li><b>💬 Chat</b> for the area you're looking at.</li>
        <li>The <b>online</b> counter shows how many players are connected.</li>
        <li><b>🔔 Alerts</b> send notifications to your phone, if you turn them on.</li>
      </ul>

      <h3>5. A living map</h3>
      <p>Zoom in to the streets and you'll see cars, pedestrians, trains, planes, helicopters, traffic lights, animals, rain, day and night. The <b>🏙️ Vida urbana</b> (City life) button in the menu adds roadworks, weddings, parades, smoke, shop queues and more. If your phone struggles, turn it off there.</p>
      <p>🔊 <b>Music:</b> the 🔊 button cycles music + effects, effects only, and silent.</p>`,
      tip: `<div class="tip"><b>Tips:</b> log in every day (gift + wheel), collect your credits before bed, buy plots in places that mean something to you (your street, your town), and level up the ones you own before buying lots of new ones.</div>
      <p class="muted" style="font-size:12px">Plots are virtual items: they give no rights over the real land. Exact figures (prices, production, prizes) may change; trust what the game shows.</p>`
    }
  };
  T.es.tip += `<p class="muted" style="font-size:12px">Los terrenos son objetos virtuales: no dan ningún derecho sobre el suelo real. Las cifras exactas (precios, producción, premios) pueden cambiar; fíjate en lo que muestra el juego.</p>`;
  T.es.body += `<p>🔊 <b>Música:</b> el botón 🔊 alterna música y efectos, solo efectos o silencio.</p>`;

  let lang = 'es';
  try { const s = localStorage.getItem('howtoLang'); lang = s || ((navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en'); } catch (e) {}
  if (lang !== 'es' && lang !== 'en') lang = 'es';

  const box = document.createElement('div');
  box.id = 'howto'; box.className = 'modal hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'howto-title');
  box.innerHTML = `
    <div class="modal-card">
      <button id="howto-close" class="close" type="button" aria-label="Close">×</button>
      <div class="langs"><button type="button" data-lang="es">Español</button><button type="button" data-lang="en">English</button></div>
      <h2 id="howto-title"></h2>
      <div id="howto-body"></div>
      <button id="howto-ok" class="primary" type="button"></button>
    </div>`;
  document.body.appendChild(box);

  function render() {
    const t = T[lang];
    box.querySelector('#howto-title').textContent = t.title;
    box.querySelector('#howto-body').innerHTML = t.body + t.tip;
    box.querySelector('#howto-ok').textContent = t.ok;
    box.querySelector('#howto-close').setAttribute('aria-label', t.close);
    box.querySelectorAll('.langs button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  }
  const open = l => {
    if (l === 'es' || l === 'en') lang = l;
    render(); box.classList.remove('hidden'); box.querySelector('.modal-card').scrollTop = 0;
  };
  const close = () => box.classList.add('hidden');
  window.openHowTo = open;
  if (btn) btn.addEventListener('click', () => open());
  box.querySelectorAll('.langs button').forEach(b => b.addEventListener('click', () => {
    lang = b.dataset.lang; try { localStorage.setItem('howtoLang', lang); } catch (e) {}
    render(); box.querySelector('.modal-card').scrollTop = 0;
  }));
  box.querySelector('#howto-close').addEventListener('click', close);
  box.querySelector('#howto-ok').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) close(); });
})();
