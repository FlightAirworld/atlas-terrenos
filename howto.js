'use strict';
// "Cómo jugar": ventana de ayuda (botón 📖 dentro de Extras) que explica el juego paso a paso.
(function () {
  const btn = document.getElementById('howto-btn');
  if (!btn) return;
  const st = document.createElement('style');
  st.textContent = `
    #howto .modal-card { max-height: min(86vh, 640px); overflow-y: auto; }
    #howto h3 { margin: 16px 0 4px; font-size: 16px; }
    #howto p, #howto li { font-size: 14px; line-height: 1.45; margin: 4px 0; }
    #howto ul { padding-left: 20px; margin: 4px 0; }
    #howto .tip { background: rgba(8,127,91,.12); border-radius: 10px; padding: 8px 10px; margin: 10px 0; }`;
  document.head.appendChild(st);

  const box = document.createElement('div');
  box.id = 'howto'; box.className = 'modal hidden'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'howto-title');
  box.innerHTML = `
    <div class="modal-card">
      <button id="howto-close" class="close" type="button" aria-label="Cerrar">×</button>
      <h2 id="howto-title">📖 Cómo jugar</h2>
      <p><b>Redecora El Mundo</b> es un mapa del planeta dividido en parcelas virtuales de unos 111 m. Reclama las que quieras, ponles tu nombre y una casa, y deja que produzcan créditos para conseguir más.</p>

      <h3>1. Reclama tu primer terreno</h3>
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
      <p>Acércate a las calles y verás coches, peatones, trenes, aviones, helicópteros, semáforos, animales, lluvia, día y noche. Con el botón <b>🏙️ Vida urbana</b> del menú activas además obras, bodas, desfiles, humo, colas en las tiendas y más. Si tu móvil va justo, apágalo desde ahí o desde los botones del menú.</p>

      <div class="tip"><b>Consejos:</b> entra cada día (regalo + ruleta), recoge tus créditos antes de dormir, compra terrenos en lugares con significado para ti (tu calle, tu pueblo) y sube de nivel los que ya tienes antes de comprar muchos nuevos.</div>
      <p class="muted" style="font-size:12px">Los terrenos son objetos virtuales: no dan ningún derecho sobre el suelo real. Las cifras exactas (precios, producción, premios) pueden cambiar; fíjate en lo que muestra el juego.</p>
      <button id="howto-ok" class="primary" type="button">¡A jugar!</button>
    </div>`;
  document.body.appendChild(box);

  const open = () => { box.classList.remove('hidden'); box.querySelector('.modal-card').scrollTop = 0; };
  const close = () => box.classList.add('hidden');
  btn.addEventListener('click', open);
  box.querySelector('#howto-close').addEventListener('click', close);
  box.querySelector('#howto-ok').addEventListener('click', close);
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.classList.contains('hidden')) close(); });
})();
