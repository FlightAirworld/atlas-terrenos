'use strict';
// DISCOTECA y SALA DE BAILE: dos escenas más para «🚪 ENTRAR EN …» (edificios.js). Se cargan después de edificios.js y de clubmusica.js.
//   · Al abrirse la puerta suena la música del local (clubmusica.js) y la gente de la pista empieza a bailar.
//   · La pista de baile tiene baldosas de colores, bola de espejos, rayos de luz y notas flotando.
//   · Tu muñeco se lanza a la pista, pide un zumo o un refresco en la barra y se fija en otra persona. Intenta ligar con ella con frases ingeniosas:
//     le pregunta el nombre, la invita a un zumo o un refresco, brindan, charlan y la saca a bailar. Al azar sale bien (te da su número) o mal (rechazo simpático).
//   · Todo hablado con las voces del navegador (cada persona con su tono) y con burbujas de texto, igual que el resto de edificios.
// Para añadir más frases: están en OPEN_COMUN / OPEN_DISCO / OPEN_BAILE (saludos), INVITA, CHARLA, BAILA, SI y NO (más abajo).
(function () {
  if (!window.edificiosRegistrar) return;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // ---------- Estilos: pista, luces y baile ----------
  const st = document.createElement('style');
  st.textContent = `
    #edif .e-sign.c-neon { background: #12001f; color: var(--sc); border: 2px solid var(--sc); text-shadow: 0 0 6px var(--sc), 0 0 16px var(--sc); box-shadow: 0 0 12px var(--sc), inset 0 0 8px #0008; letter-spacing: 3px; animation: c-flick 5s infinite; }
    #edif .c-fx { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
    #edif .c-pista { position: absolute; left: 170px; bottom: 8px; width: 240px; height: 100px; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(3, 1fr); gap: 2px; padding: 3px; background: #0b0014; border-radius: 6px; box-shadow: 0 0 22px #b100ff99; }
    #edif .c-tile { border-radius: 2px; animation: c-tile 1.9s steps(1) infinite; opacity: .88; }
    #edif .c-beam { position: absolute; top: 0; width: 90px; height: 235px; margin-left: -45px; transform-origin: 50% 0; background: linear-gradient(rgba(var(--bc), .5), rgba(var(--bc), 0)); clip-path: polygon(42% 0, 58% 0, 100% 100%, 0 100%); mix-blend-mode: screen; animation: c-sweep 3.4s ease-in-out infinite alternate; }
    #edif .c-bola { position: absolute; top: -4px; font-size: 40px; line-height: 1; margin-left: -20px; z-index: 2; animation: c-spin 3.2s linear infinite; filter: drop-shadow(0 0 8px #fff9); }
    #edif .c-bola::before { content: ''; position: absolute; left: 50%; bottom: 80%; width: 2px; height: 40px; background: #cfd8dc; }
    #edif .c-note { position: absolute; bottom: 80px; font-size: 20px; opacity: 0; animation: c-note 3.6s ease-out infinite; }
    #edif .c-pulse { position: absolute; inset: 0; z-index: 45; pointer-events: none; background: radial-gradient(circle at 50% 80%, rgba(255, 60, 220, .16), rgba(0, 200, 255, .06) 55%, transparent 75%); animation: c-pulse .484s ease-out infinite; }
    #edif .v-fig.dance .v-body { animation: c-bob .484s ease-in-out infinite alternate; animation-delay: var(--dd, 0s); }
    #edif .v-fig.dance.d2 .v-body { animation-name: c-sway; animation-duration: .97s; }
    #edif .v-fig.dance.d3 .v-body { animation-name: c-step; animation-duration: .97s; }
    #edif .v-fig.dance .leg.l { animation: c-legA .484s ease-in-out infinite alternate; animation-delay: var(--dd, 0s); }
    #edif .v-fig.dance .leg.r { animation: c-legB .484s ease-in-out infinite alternate; animation-delay: var(--dd, 0s); }
    #edif .v-fig.dance:not(.talk) .arm.l { animation: c-armL .484s ease-in-out infinite alternate; animation-delay: var(--dd, 0s); }
    #edif .v-fig.dance:not(.talk) .arm.r { animation: c-armR .484s ease-in-out infinite alternate; animation-delay: var(--dd, 0s); }
    #edif .v-fig.dance.d1:not(.talk) .arm.l { animation-name: c-armUpL; }
    #edif .v-fig.dance.d1:not(.talk) .arm.r { animation-name: c-armUpR; }
    @keyframes c-flick { 0%, 100% { opacity: 1; } 47% { opacity: 1; } 49% { opacity: .78; } 51% { opacity: 1; } 80% { opacity: .9; } }
    @keyframes c-tile { 0% { background: #ff2bd6; } 20% { background: #29d3ff; } 40% { background: #8a2bff; } 60% { background: #ff7ad9; } 80% { background: #2b5bff; } }
    @keyframes c-sweep { from { transform: rotate(-26deg); } to { transform: rotate(26deg); } }
    @keyframes c-spin { from { transform: perspective(200px) rotateY(0); } to { transform: perspective(200px) rotateY(360deg); } }
    @keyframes c-note { 0% { transform: translateY(0) scale(.7); opacity: 0; } 15% { opacity: .9; } 100% { transform: translateY(-120px) translateX(14px) scale(1.1); opacity: 0; } }
    @keyframes c-pulse { 0% { opacity: .9; } 100% { opacity: .15; } }
    @keyframes c-bob { from { transform: translateY(0) rotate(-1.5deg); } to { transform: translateY(-6px) rotate(1.5deg); } }
    @keyframes c-sway { from { transform: translateX(-4px) rotate(-5deg); } to { transform: translateX(4px) rotate(5deg); } }
    @keyframes c-step { 0% { transform: translateX(-8px); } 50% { transform: translateX(0) translateY(-4px); } 100% { transform: translateX(8px); } }
    @keyframes c-legA { from { transform: rotate(-14deg); } to { transform: rotate(14deg); } }
    @keyframes c-legB { from { transform: rotate(14deg); } to { transform: rotate(-14deg); } }
    @keyframes c-armL { from { transform: rotate(25deg); } to { transform: rotate(75deg); } }
    @keyframes c-armR { from { transform: rotate(-75deg); } to { transform: rotate(-25deg); } }
    @keyframes c-armUpL { from { transform: rotate(150deg); } to { transform: rotate(35deg); } }
    @keyframes c-armUpR { from { transform: rotate(-35deg); } to { transform: rotate(-150deg); } }
    @media (prefers-reduced-motion: reduce) { #edif .c-tile, #edif .c-beam, #edif .c-bola, #edif .c-note, #edif .c-pulse, #edif .e-sign.c-neon { animation: none; } #edif .c-pulse { opacity: 0; } }
  `;
  document.head.appendChild(st);

  // ---------- Decoración: pista de baile, rayos, bola de espejos y notas ----------
  const fx = (hue, beams) => (room, add) => {
    const wrap = add('c-fx', '');
    wrap.style.filter = hue ? `hue-rotate(${hue}deg)` : '';
    const pista = document.createElement('div'); pista.className = 'c-pista';
    for (let i = 0; i < 24; i++) { const t = document.createElement('i'); t.className = 'c-tile'; t.style.animationDelay = (-Math.random() * 1.9).toFixed(2) + 's'; pista.appendChild(t); }
    wrap.appendChild(pista);
    beams.forEach((b, i) => {
      const e = document.createElement('div'); e.className = 'c-beam';
      e.style.left = b[0] + 'px'; e.style.setProperty('--bc', b[1]);
      e.style.animationDelay = (-i * 1.1).toFixed(1) + 's'; e.style.animationDirection = i % 2 ? 'alternate-reverse' : 'alternate';
      wrap.appendChild(e);
    });
    for (let i = 0; i < 5; i++) {
      const n = document.createElement('span'); n.className = 'c-note'; n.textContent = pick(['🎵', '🎶', '🎵']);
      n.style.left = (190 + i * 46 + Math.random() * 14) + 'px'; n.style.animationDelay = (-Math.random() * 3.6).toFixed(1) + 's'; wrap.appendChild(n);
    }
    const bola = document.createElement('div'); bola.className = 'c-bola'; bola.textContent = '🪩'; bola.style.left = '290px'; wrap.appendChild(bola);
    add('c-pulse', '');
  };

  // ---------- Datos al azar de cada visita ----------
  const BEBIDAS = [['un zumo de naranja', '🧃'], ['un refresco de limón', '🥤'], ['un refresco de cola', '🥤'], ['un zumo de piña', '🍹'], ['un zumo de melocotón', '🧃'], ['una limonada fría', '🥤'], ['un zumo de manzana', '🧃']];
  const nickOfPlayer = () => {
    let n = '';
    try { n = (window.atlasPlayerName ? window.atlasPlayerName() : '') || (typeof nickOf === 'function' ? nickOf() : '') || (document.getElementById('name') || {}).value || ''; } catch (e) {}
    return String(n).replace(/\s+/g, ' ').trim().slice(0, 24);
  };

  // ---------- Frases: cada bloque es una mini conversación [quién, frase] ----------
  // V = tú · C = la persona que te gusta · {C} = su nombre · {g} = guapa/guapo · {yo} = tu presentación
  const OPEN_COMUN = [
    [['V', 'Perdona, no quiero molestar, pero llevo diez minutos buscando una excusa para hablarte y se me acaba de ocurrir esta.'], ['C', 'Vaya, qué sinceridad. ¿Y esa es la mejor que has encontrado?'], ['V', 'La segunda. La primera era preguntarte la hora, pero a tu lado el tiempo se ha parado.'], ['C', 'Eso ha estado bien. Te has ganado un minuto de mi atención.'], ['V', 'Pues voy a aprovecharlo como si fuera el último.']],
    [['V', 'Disculpa, ¿has venido a bailar o solo a dejar sin aliento a todo el mundo?'], ['C', 'Qué frase tan de manual… Aunque, la verdad, me ha hecho gracia.'], ['V', 'Lo sé, la tenía guardada para una ocasión especial. Hoy he sentido que podía estrenarla.'], ['C', 'Pues enhorabuena: has estrenado una frase y una sonrisa mía.'], ['V', 'Dos estrenos en una sola noche. Esto promete.']],
    [['V', 'Hola. Voy a ir al grano: si la música no sonara tan fuerte, te diría que tienes la sonrisa más bonita de la sala.'], ['C', 'Te estoy oyendo perfectamente, ¿eh?'], ['V', 'Entonces la música es mi cómplice y tú mi testigo. Lo dicho: la sonrisa más bonita de la sala.'], ['C', 'Mira que tienes valor. Me gusta eso.']],
    [['V', 'Hola, perdona. Es que un amigo dice que no me atrevo a hablarte, y quiero demostrarle que se equivoca.'], ['C', '¿Y tienes ese amigo o te lo acabas de inventar?'], ['V', 'Es un amigo imaginario muy persuasivo. Pero aquí estoy, hablándote, así que ya le he ganado.'], ['C', 'Pues dile a tu amigo imaginario que ha hecho un gran trabajo.']],
    [['V', 'Con permiso. Hago experimentos en mis ratos libres y acabo de descubrir que cuando sonríes sube la temperatura de toda la sala.'], ['C', '¡Ja, ja, ja! ¿Y eso se mide con algún aparato?'], ['V', 'Con el más fiable que existe: las ganas que tengo de seguir hablando contigo.'], ['C', 'Vale, esa ha sido muy buena. Sigue, que me has enganchado.']],
    [['V', 'Perdona la interrupción. Bailabas tan bien que he pensado que el suelo debería pagarte entrada.'], ['C', 'Qué exageración… Pero gracias, me he reído.'], ['V', 'Si te hago reír la primera vez que hablamos, imagínate la segunda.'], ['C', 'Me lo estás poniendo difícil para decirte que no. Cuidado.']]
  ];
  const OPEN_DISCO = [
    [['V', '¡Menudo temazo! Dicen que cuando suena esta canción hay que presentarse a la persona más interesante de la pista. Y ya la he encontrado.'], ['C', '¿Eso dicen? Pues quien lo dice conoce bien a la gente.'], ['V', 'Y quien lo cumple tiene buen ojo, ¿no crees?'], ['C', 'Veremos si además tiene buena conversación.']],
    [['V', 'Tengo una duda existencial: ¿la bola de espejos gira por ti o tú por la bola?'], ['C', '¡Qué cursi eres! Pero lo has dicho con tanta gracia que lo voy a dejar pasar.'], ['V', 'Es mi truco: me pongo cursi, pero con precisión.'], ['C', 'Pues apunta bien, que tienes mi atención.']],
    [['V', 'Qué cosa más rara: estaba bailando con toda la calma y de repente se me ha olvidado cómo se baila. Creo que eres tú.'], ['C', '¿Yo? ¡Pero si no he hecho nada!'], ['V', 'Exacto. Y me has dejado sin un solo paso.'], ['C', 'Pues ahora tendrás que improvisar, y me muero por verlo.']]
  ];
  const OPEN_BAILE = [
    [['V', 'Esta música tiene tanto ritmo que mis pies han decidido venir a hablar contigo sin pedirme permiso.'], ['C', 'Pues tus pies tienen muy buen gusto.'], ['V', 'Ellos mandan; yo solo los acompaño.'], ['C', 'Qué buena excusa. Me quedo con ella.']],
    [['V', 'Me han dicho que en esta sala quien baila bien consigue un deseo. Yo ya sé cuál pediría.'], ['C', '¿Y cuál sería, si se puede saber?'], ['V', 'Que me dijeras tu nombre antes de que acabe la canción.'], ['C', 'Pues tienes suerte: todavía quedan treinta segundos.']],
    [['V', 'Perdona, llevo toda la noche viendo cómo bailas y creo que ya me sé tus pasos. ¿Me dejas comprobarlo?'], ['C', 'Qué atrevimiento. A ver si es verdad.'], ['V', 'Si me equivoco, me pisas un pie y quedamos en paz.'], ['C', 'Trato hecho. Pero primero, conversación.']]
  ];
  const NOMBRE = [['C', 'Me llamo {C}. Ahora te toca a ti.'], ['V', '{yo}. Un placer conocerte, {C}.']];
  const INVITA = [
    [['V', '¿Te invito a un zumo o a un refresco? Prometo que sin segundas intenciones… bueno, con una o dos.'], ['C', 'Aceptado, por la sinceridad. Quiero {d[0]}.']],
    [['V', 'Esto de bailar da sed. Déjame invitarte a algo: ¿un zumo, un refresco…?'], ['C', 'Pues me apetece {d[0]}, gracias.']],
    [['V', 'Me han dicho que el zumo es el cóctel de los valientes. ¿Te animas a uno conmigo?'], ['C', '¡Me has convencido! Yo tomaré {d[0]}.']],
    [['V', 'Voy a pedirte algo, y no es el teléfono: todavía. ¿Qué te apetece beber? Invito yo.'], ['C', 'Qué orden tan elegante. Tomaré {d[0]}.']]
  ];
  const BRINDIS = [
    [['V', '¡Por esta noche y por las buenas casualidades!'], ['C', '¡Y porque duren mucho más!']],
    [['V', 'Por la música, que nos ha puesto en el mismo sitio.'], ['C', 'Y por quien se atreve a hablarle a alguien que no conoce. ¡Salud!']],
    [['V', 'Brindo por tu sonrisa, que hoy ha ganado a todas las luces de la sala.'], ['C', 'Qué ocurrencia… pero brindo con gusto. ¡Chin, chin!']]
  ];
  const CHARLA = [
    [['V', 'Cuéntame, {C}, ¿vienes mucho por aquí o te ha traído la noche?'], ['C', 'Vengo cuando necesito olvidarme de la semana. Y esta ha sido de las largas.'], ['V', 'Pues vamos a conseguir que esta noche valga por todas ellas.']],
    [['V', 'Dime una cosa: ¿qué canción te hace bailar aunque no te queden fuerzas?'], ['C', 'Cualquiera con un buen bajo. Lo demás me da igual.'], ['V', 'Anotado. Tu debilidad son los bajos y la mía, ahora mismo, tu risa.']],
    [['V', '¿Y a qué te dedicas cuando no estás conquistando pistas de baile?'], ['C', 'Mejor te lo cuento otro día. Así tengo una excusa para volver a verte.'], ['V', 'Eso es jugar sucio. Y me encanta.']],
    [['V', 'Si tu vida fuera una canción, ¿cómo se llamaría?'], ['C', '«Una noche cualquiera».'], ['V', 'Pues acabo de cambiarle el título: «La noche en que nos conocimos».']]
  ];
  const BAILA = [
    [['V', 'Confieso que no soy de los que mejor bailan, pero sí de los que mejor te van a mirar mientras lo hacen. ¿Bailamos?'], ['C', 'Dicho así, es imposible negarse. Vamos.']],
    [['V', 'Suena nuestra canción. Bueno, todavía no lo era, pero lo será dentro de treinta segundos. ¿Me acompañas a la pista?'], ['C', 'Qué seguridad tienes. Venga, vamos a comprobarlo.']],
    [['V', 'Tengo un trato que proponerte: tú pones el ritmo y yo pongo las ganas. ¿Qué me dices?'], ['C', 'Trato hecho. ¡Vamos!']]
  ];
  const BAILA_SALA = [[['V', 'Esta pieza pide dos personas y me temo que solo conozco a una. ¿Me concedes este baile?'], ['C', 'Concedido. A ver si sabes llevarme.']]];
  const EN_PISTA = [
    [['C', '¡Bailas mucho mejor de lo que decías!'], ['V', 'Es que tengo muy buena compañía.']],
    [['C', 'Cuidado con esos pies, que me los vas a pisar.'], ['V', 'Si te pisara, sería por mirarte demasiado.']],
    [['C', 'Esto empieza a gustarme más de la cuenta.'], ['V', 'Pues que no pare la música, entonces.']]
  ];
  const SI = [
    [['C', 'Me lo estoy pasando de maravilla. Dame tu móvil y te dejo mi número.'], ['V', 'Mi móvil es tuyo; mi corazón, esta noche, está en rebajas.'], ['C', '¡Qué ocurrente! Pero me ha encantado. Te escribo mañana.']],
    [['C', 'Normalmente no doy mi número a quien conozco en una discoteca, ¿sabes?'], ['V', 'Entonces tengo muchísima suerte.'], ['C', 'Pues anótalo, y no me hagas arrepentirme.']],
    [['C', 'Mañana trabajo, pero creo que merece la pena trasnochar un poco por ti.'], ['V', '¿Quedamos para tomar un helado? Esta vez sin música alta.'], ['C', 'Me parece un plan precioso. Cuenta conmigo.']]
  ];
  const NO = [
    [['C', 'Me lo he pasado genial, de verdad, pero he venido con mis amigos y me están esperando.'], ['V', 'Pues me quedo con el baile, que ya es mucho.'], ['C', 'Eres un encanto. Quizá nos veamos otro día en la pista.']],
    [['C', 'Tienes mucha gracia y bailas muy bien, pero hoy solo quería bailar y olvidarme de todo.'], ['V', 'Lo entiendo. Gracias por la canción y por la sonrisa.'], ['C', 'Gracias a ti por no insistir. Pásalo muy bien.']],
    [['C', 'Tengo que irme ya, que mañana madrugo. Ha sido un placer.'], ['V', 'El placer ha sido mío. Si alguna vez quieres otro baile, ya sabes dónde encontrarme.'], ['C', 'Lo tendré en cuenta.']]
  ];

  // Convierte una mini conversación en pasos del guion
  const lines = blk => blk.map(l => [l[0], l[1]]);

  // ---------- Las dos escenas ----------
  function escena(o) {
    return {
      t: o.t, ic: o.ic, sign: o.sign, sx: o.sx, sc: o.sc, signCls: 'c-neon', club: true, music: o.music, wall: o.wall, floor: o.floor, cnt: '#2a1442', uni: '#14101f', uniD: o.uniD, bell: 0,
      roles: { E: 'camarero', D: 'DJ', C: 'cliente' },
      crowd: [[205, .45, 1], [388, .5, 0], [350, .22, 1], [190, .82, 0], [408, .78, 1]],
      dec: [
        ['fn', fx(o.hue, o.beams)],
        ['sh', 424, 218, 122, ['🍹', '🧃', '🥤', '🍾', '🧃']], ['cn', 440, 104], ['it', '🧃', 462, 128, 24, 21], ['it', '🥤', 505, 128, 24, 21],
        ['cn', 222, 120], ['it', '🎧', 246, 128, 26, 21], ['it', '🎛️', 290, 128, 26, 21], ['it', '💿', 322, 128, 22, 21],
        ['it', '🔊', 176, 102, 48, 4], ['it', '🔊', 380, 102, 48, 4], ['it', '🌴', 120, 100, 48, 4], ['it', '🌴', 545, 100, 40, 4]
      ],
      sp: { in: [135, .35], pista: [255, .3], pista2: [335, .3], bar: [458, .2], bar2: [418, .3], barra: [494, .92], dj: [282, .93], c0: [335, .5], junto: [298, .42], door: [45, 1] },
      v: () => { const b = pick(BEBIDAS); let d = pick(BEBIDAS); while (d === b) d = pick(BEBIDAS); return { b, d }; },
      body: v => {
        const nick = nickOfPlayer();
        v.yo = nick ? 'Yo soy ' + nick : 'Yo soy quien te ha interrumpido el baile';
        v.g = v.cf ? 'guapa' : 'guapo';
        const S = [], add = blk => lines(blk).forEach(l => S.push(l));
        const ok = Math.random() < 0.7;   // el ligue sale bien una de cada… casi tres
        S.push(['put', 'E', 'barra'], ['put', 'D', 'dj'], ['put', 'C', 'c0']);
        S.push(['sub', o.entra], ['dance', 'D', 'd2'], ['dance', 'C', 'd1']);
        S.push(['D', pick(o.dj), { big: true }], ['V', pick(o.v1)]);
        S.push(['sub', 'Te lanzas a la pista de baile'], ['go', 'V', 'pista', 90], ['dance', 'V', 'd1'], ['sfx', 'risa'], ['wait', 2600],
          ['V', '¡Esto sí que es música! Qué ganas tenía de bailar.'], ['wait', 1800]);
        S.push(['sub', 'Pides algo de beber'], ['nodance', 'V'], ['go', 'V', 'bar', 90],
          ['V', 'Buenas, ¿me pones {b[0]}, por favor? Con tanto baile me voy a quedar sin fuerzas.'],
          ['E', 'Marchando {b[0]}. Aquí tienes, bien fresquito.'], ['hold', 'E', '{b[1]}'], ['wait', 500], ['hold', 'E', null], ['hold', 'V', '{b[1]}'], ['sfx', 'vasos'],
          ['V', 'Gracias. Con esta música y este refresco, la noche empieza muy bien.']);
        S.push(['sub', 'Alguien te llama la atención'], ['look', 'V', 'C'], ['wait', 600],
          ['V', 'Vaya… ¡qué bien baila esa persona! Respira hondo. Vamos allá.']);
        S.push(['go', 'V', 'junto', 85], ['nodance', 'C'], ['look', 'C', 'V']);
        add(pick(OPEN_COMUN.concat(o.open)));
        add(NOMBRE);
        S.push(['sub', 'La invitas a un zumo o a un refresco']);
        add(pick(INVITA));
        S.push(['bg', 'C', 'bar2', 85], ['go', 'V', 'bar', 85], ['look', 'E', 'V'],
          ['E', 'Marchando {d[0]}. Aquí tenéis.'], ['hold', 'E', '{d[1]}'], ['wait', 500], ['hold', 'E', null], ['hold', 'C', '{d[1]}'], ['sfx', 'vasos']);
        S.push(['sub', 'Brindáis'], ['cheer', 'V'], ['cheer', 'C']);
        add(pick(BRINDIS));
        S.push(['sub', 'Conversáis un rato']);
        add(pick(CHARLA));
        S.push(['sub', 'Le propones bailar']);
        add(pick(BAILA.concat(o.baila)));
        S.push(['hold', 'V', null], ['hold', 'C', null], ['sfx', 'pop'], ['bg', 'C', 'pista2', 85], ['go', 'V', 'pista', 85], ['wait', 500],
          ['pair', 'V', 'C', o.par], ['sub', '¡Bailáis juntos!'], ['wait', 3200]);
        add(pick(EN_PISTA));
        S.push(['D', pick(o.djPareja), { big: true }], ['sfx', 'risa'], ['wait', 1800]);
        S.push(['sub', ok ? '¡Parece que le gustas!' : 'Se acaba la canción…']);
        add(pick(ok ? SI : NO));
        if (ok) S.push(['sfx', 'pop'], ['cheer', 'V']);
        S.push(['nodance', 'C'], ['nodance', 'V'], ['sub', 'Te despides'], ['D', pick(o.dj2), { big: true }], ['V', ok ? '¡Qué noche tan buena! Hasta la próxima.' : 'Ha sido una noche estupenda igualmente. Hasta la próxima.']);
        return S;
      }
    };
  }

  const DISCO = escena({
    t: 'Discoteca', ic: '🪩', sign: 'DISCOTECA', sx: 190, sc: '#ff2bd6', wall: 'linear-gradient(#10001d, #2a0a4a)', floor: '#1b0a2e', uniD: '#7c3aed',
    music: 'disco', hue: 0, par: 'd2', entra: 'Entras en la discoteca',
    beams: [[110, '255,43,214'], [290, '41,211,255'], [470, '138,43,255']],
    dj: ['¡Buenas noches a todos! ¡Que suba el volumen y que no pare la fiesta!', '¡Muy buenas, discoteca! ¿Estáis preparados para bailar toda la noche?', '¡Manos arriba! Esta noche suena lo mejor de lo mejor.'],
    v1: ['¡Qué ambientazo! Aquí se viene a bailar.', '¡Madre mía, qué luces y qué música! Esto es otro mundo.', 'Guau, la pista está llena. ¡Qué ganas de bailar!'],
    djPareja: ['¡Esa pareja sí que sabe moverse! Un aplauso para la pista.', '¡Eso es! ¡A mover el esqueleto, que la noche es joven!'],
    dj2: ['¡Gracias por venir! ¡Vuelve cuando quieras, que aquí siempre hay fiesta!', 'Cuídate y vuelve pronto. ¡La pista te espera!'],
    open: OPEN_DISCO, baila: []
  });
  const BAILE = escena({
    t: 'Sala de baile', ic: '💃', sign: 'SALA DE BAILE', sx: 150, sc: '#ffcc33', wall: 'linear-gradient(#1b0836, #45125a)', floor: '#2b1340', uniD: '#c026d3',
    music: 'baile', hue: -35, par: 'd3', entra: 'Entras en la sala de baile',
    beams: [[110, '255,200,60'], [290, '255,90,170'], [470, '255,160,60']],
    dj: ['¡Buenas noches, señoras y señores! ¡Empieza el baile! Salsa, bachata y todo lo que haga mover los pies.', '¡Bienvenidos a la sala de baile! Busquen pareja, que la música ya está lista.', '¡A bailar se ha dicho! Esta noche, ritmo latino para todos.'],
    v1: ['¡Qué buena música! Tengo ganas de bailar hasta el amanecer.', 'Qué ritmo tan contagioso. Los pies se me van solos.', '¡Qué ambiente tan bonito! Aquí da gusto bailar.'],
    djPareja: ['¡Qué pareja de baile tan elegante! Un aplauso para ellos.', '¡Eso es! ¡Con ritmo y con arte!'],
    dj2: ['¡Gracias por bailar con nosotros! La sala siempre estará abierta para ti.', 'Vuelve pronto, que aquí el ritmo no se acaba nunca.'],
    open: OPEN_BAILE, baila: BAILA_SALA
  });

  window.edificiosRegistrar('discoteca', DISCO, /^discoteca/);
  window.edificiosRegistrar('salabaile', BAILE, /^(sala-de-baile|sala-baile|salon-de-baile|salabaile)/);
})();
