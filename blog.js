'use strict';
// 📰 Blog del juego: preguntas y respuestas. Botón "Blog" en el Menú que abre una ventana con buscador.
// Para añadir una pregunta: pon otra línea  ['pregunta', 'respuesta']  dentro de su categoría en BLOG (más abajo).
(function () {
  const BLOG = [
    { icon: '🌍', name: 'Empezar', qa: [
      ['¿Qué es Redecora El Mundo?', 'Es un juego de mapa del mundo en español: eliges parcelas libres en un mapa real, las haces tuyas con tu nombre y vas coleccionando terrenos, tanto en la Tierra como en la Luna y otros planetas.'],
      ['¿Es gratis?', 'Sí. Se juega desde el navegador sin descargar nada y no hace falta pagar para jugar. También puedes instalarlo como app en el móvil.'],
      ['¿Cómo reclamo un terreno?', 'Acerca el zoom en el mapa, toca una parcela libre y pulsa reclamar. Cuesta créditos y tiene que estar cerca de ti (en tu barrio, unos 500 m de donde estás).'],
      ['¿Cuántos terrenos puedo reclamar al día?', 'Hasta 10 terrenos por día y jugador. El día cambia a medianoche (hora de Madrid).'],
      ['¿Los terrenos son reales?', 'No. Son terrenos virtuales de un videojuego y no dan ningún derecho sobre terrenos reales.'],
      ['¿Necesito una cuenta?', 'Con cuenta se guardan tus terrenos y tus créditos para siempre y puedes jugar desde cualquier dispositivo. Entra desde el botón 👤 Cuenta del Menú.']
    ] },
    { icon: '🎟️', name: 'Créditos y producción', qa: [
      ['¿Cómo consigo créditos?', 'Con el regalo diario, la ruleta diaria, el rasca y gana, la trivia, el juego de parejas, invitando a amigos, tocando al muñeco que pasea por el mapa y, sobre todo, con lo que producen tus propios terrenos.'],
      ['¿Cómo producen créditos mis terrenos?', 'Cada terreno produce créditos por hora, según su rareza y su nivel. Abre 🏠 Mis terrenos (tocando tus créditos arriba) y pulsa Recoger cuando haya al menos 1 crédito listo.'],
      ['¿Por qué mi acumulado deja de subir?', 'Los terrenos solo acumulan hasta 24 horas sin recoger. Pasado ese tope dejan de sumar, así que entra y recoge antes de que se llene.'],
      ['¿Qué son los niveles?', 'Cada terreno tiene un nivel del 1 al 50. Subirlo cuesta créditos y hace que el terreno produzca más. Los niveles altos cuestan más, así que merece la pena empezar por los terrenos más raros.']
    ] },
    { icon: '🌱', name: 'Terrenos y rarezas', qa: [
      ['¿Puedo elegir cómo es mi terreno?', 'No. Al reclamar, el servidor sortea el terreno al azar según su rareza. Es igual para todos y no se puede trucar desde el navegador.'],
      ['¿Qué rarezas existen?', 'Hay muchas categorías, desde la Común (la más habitual) hasta las ultra raras como Divino, Infinito o Absoluto. Cuanto más rara, menos probable es que te toque y muchísimo más produce.'],
      ['¿Qué veo en Mis terrenos?', 'Tus terrenos agrupados por rareza (de la más rara a la más común), un cuadro con estadísticas de dónde están tus parcelas (mundos, países y ciudades) y el botón para recoger créditos.'],
      ['¿Puedo cambiar la casa de un terreno?', 'No. Las casas se asignan al azar al reclamar y ya no se pueden elegir ni cambiar.']
    ] },
    { icon: '🪐', name: 'Mundos', qa: [
      ['¿Puedo tener terrenos en la Luna y en otros planetas?', 'Sí. Desde el botón 🌎 Mundos del Menú viajas a la Luna, Marte, Mercurio, Venus, Júpiter, Saturno, Urano, Neptuno, Plutón y también a la Prehistoria. Cada mundo tiene sus propios terrenos y sus propias casas.'],
      ['¿Se sortean igual que en la Tierra?', 'Sí. En cada mundo también sale una casa al azar según su rareza, de la más sencilla a la más espectacular.']
    ] },
    { icon: '🎮', name: 'Minijuegos y extras', qa: [
      ['¿Cómo funciona el regalo diario?', 'Entra cada día para recoger tu regalo. Si no te saltas ningún día, la racha sube y los premios mejoran; el día 7 es el premio grande y luego se repite.'],
      ['¿Qué minijuegos hay?', 'Ruleta diaria, rasca y gana, trivia del mundo, juego de parejas, juego de gemas y bingo. Dan créditos y algunos también cartas.'],
      ['¿Qué son las cartas coleccionables?', 'Cartas de temporada que consigues jugando. Puedes abrir sobres, completar el álbum e intercambiar con otros jugadores.'],
      ['¿Cómo funcionan las luchas?', 'Puedes retar a terrenos de otros jugadores. Tienes un máximo de 3 luchas al día y cada una puede ganar o perder según la probabilidad que se muestra antes de luchar.']
    ] },
    { icon: '👥', name: 'Amigos y comunidad', qa: [
      ['¿Puedo jugar con mis amigos?', 'Sí. Invítalos con tu enlace, regálales créditos, chatea con los jugadores de tu zona y compite con ellos en el ranking.'],
      ['¿Qué es el ranking?', 'Es la clasificación de propietarios, países y ciudades. Se abre con el botón 🏆 del Menú.'],
      ['¿Hay clanes?', 'Sí. Puedes crear un clan o unirte a uno para jugar en equipo con otros jugadores.']
    ] },
    { icon: '📱', name: 'Ayuda técnica', qa: [
      ['¿Funciona en el móvil?', 'Sí, en Android, iPhone, tablet y ordenador. Puedes añadirlo a la pantalla de inicio y se comporta como una app.'],
      ['El juego tarda en abrir, ¿es normal?', 'A veces el servidor está dormido y puede tardar hasta un minuto en despertar la primera vez. Se abre solo cuando esté listo.'],
      ['El mapa va lento, ¿qué hago?', 'Activa el modo ⚡ ligero desde el Menú: reduce los efectos para que el mapa vaya más fluido en móviles modestos.']
    ] }
  ];

  const $ = id => document.getElementById(id);
  const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let modal = null, listBox = null, search = null;

  function render(filter) {
    const f = norm(filter || '').trim();
    listBox.replaceChildren();
    let shown = 0;
    BLOG.forEach(cat => {
      const items = cat.qa.filter(([q, a]) => !f || norm(q + ' ' + a).includes(f));
      if (!items.length) return;
      listBox.appendChild(el('h3', 'margin:14px 0 6px;font-size:15px', cat.icon + ' ' + cat.name));
      items.forEach(([q, a]) => {
        const d = el('details', 'margin:6px 0;border:1px solid var(--line);border-radius:12px;overflow:hidden');
        if (f) d.open = true;
        d.appendChild(el('summary', 'cursor:pointer;padding:10px 12px;font-weight:700;list-style:revert', q));
        d.appendChild(el('p', 'margin:0;padding:2px 14px 12px;line-height:1.5;color:var(--fg)', a));
        listBox.appendChild(d);
        shown++;
      });
    });
    if (!shown) listBox.appendChild(el('p', 'color:var(--muted);margin:14px 0', 'No hay resultados. Prueba con otra palabra.'));
  }

  function build() {
    modal = el('div'); modal.id = 'blog'; modal.className = 'modal hidden';
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'blog-title');
    const card = el('div', 'width:min(560px,100%);max-height:88vh;overflow:auto'); card.className = 'modal-card';
    const close = el('button', '', '×'); close.className = 'close'; close.type = 'button'; close.setAttribute('aria-label', 'Cerrar');
    const h = el('h2', '', '📰 Blog del juego'); h.id = 'blog-title';
    const sub = el('p', '', 'Preguntas y respuestas sobre Redecora El Mundo.'); sub.className = 'muted';
    search = el('input', 'width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-size:15px');
    search.type = 'search'; search.placeholder = '🔎 Busca una pregunta…'; search.setAttribute('aria-label', 'Buscar en el blog');
    listBox = el('div');
    card.append(close, h, sub, search, listBox);
    modal.appendChild(card);
    document.body.appendChild(modal);
    search.addEventListener('input', () => render(search.value));
    close.onclick = hide;
    modal.addEventListener('click', e => { if (e.target === modal) hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) hide(); });
    render('');
  }
  function show() { if (!modal) build(); search.value = ''; render(''); modal.classList.remove('hidden'); }
  function hide() { if (modal) modal.classList.add('hidden'); }

  function addButton(tries) {
    const list = $('menu-items');
    if (!list) { if (tries < 40) setTimeout(() => addButton(tries + 1), 250); return; }
    if ($('blog-btn')) return;
    const b = el('button'); b.id = 'blog-btn'; b.type = 'button'; b.title = 'Blog: preguntas y respuestas'; b.setAttribute('data-label', 'Blog'); b.setAttribute('aria-label', 'Blog: preguntas y respuestas');
    const s = el('span', '', '📰'); s.className = 'mp-ic'; b.appendChild(s);
    b.onclick = show;
    list.insertBefore(b, $('account-btn') || null);   // justo antes de "Cuenta", como el resto de botones añadidos
  }
  addButton(0);
  window.openBlog = show;
})();
